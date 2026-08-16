import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { concatMap, type Observable } from 'rxjs';
import { AUDIT_METADATA_KEY, type AuditMetadata } from './audit.decorator.js';
import { RequestContextService } from './request-context.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// tableName нь §4.4-ийн дагуу зөвхөн @Audit(...) дотор хатуу бичигдсэн
// (hardcoded) утга байх ёстой тул энэ pattern зөвхөн хөгжүүлэгчийн алдаанаас
// (ж: dynamic string дамжуулах) хамгаалах сүүлчийн давхарга.
const TABLE_NAME_PATTERN = /^[a-z_]+$/;

// docs/plan.md Phase1 checklist "(шинэ) Суурь аудит лог", §7 модуль #15:
// бүх mutation (POST/PUT/PATCH/DELETE) хүсэлтийг барьж, @Audit()-ээр
// тэмдэглэсэн endpoint-үүдийг audit_logs-д бичнэ. GET/HEAD-ийг үргэлж
// алгасна. Зөвхөн ХАРИУ АМЖИЛТТАЙ буцсаны дараа (RxJS pipe-ийн `next`
// утгад) бичих тул 4xx/5xx алдаа гарвал (Observable error-луу орно, `tap`/
// `concatMap`-ийн callback огт дуудагдахгүй) бичихгүй.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!MUTATION_METHODS.has(req.method)) {
      return next.handle();
    }

    const metadata = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );
    if (!metadata || !TABLE_NAME_PATTERN.test(metadata.tableName)) {
      if (metadata) {
        this.logger.warn(
          `@Audit-д буруу хүснэгтийн нэр өгсөн тул алгасав: "${metadata.tableName}"`,
        );
      }
      return next.handle();
    }

    // captureBeforeData-г ЭНД ШУУД (concatMap-ийн амжилттай замд хүрэхээс
    // өмнө) эхлүүлдэг тул handler алдаа шидвэл (жиш: RLS-ээр хориглогдсон
    // мөрийг update хийхээр оролдох үед .update() P2025 шидэх, харин
    // captureBeforeData-ийн raw SELECT өөрөө амжилттай хоосон массив
    // буцаадаг) concatMap-ийн callback ер нь дуудагдахгүй тул
    // beforeDataPromise хэзээ ч уншигдахгүй үлдэж болзошгүй. Хэрэв
    // captureBeforeData ӨӨРӨӨ (raw SQL) алдаа шидвэл ийм тохиолдолд
    // uncaught rejection болохоос сэргийлж, шууд .catch()-оор атгана —
    // "before" snapshot унших нь амжилтгүй болсноор ЭСЭН мутаци/хариуг
    // 500 болгож унагаах ёсгүй тул null болгож зөөлрүүлнэ.
    const beforeDataPromise = this.captureBeforeData(
      req,
      metadata.tableName,
    ).catch((err: unknown) => {
      this.logger.warn(
        `captureBeforeData амжилтгүй боллоо (${req.method} ${req.url}): ${String(err)}`,
      );
      return null;
    });

    return next.handle().pipe(
      concatMap(async (responseBody: unknown) => {
        const beforeData = await beforeDataPromise;
        await this.writeAuditLog(req, metadata, responseBody, beforeData);
        return responseBody;
      }),
    );
  }

  // PUT/PATCH/DELETE-ийн хувьд handler ажиллахаас ӨМНӨ (мөр өөрчлөгдөх/
  // устгагдахаас өмнө) route param `id`-аар өмнөх мөрийг уншиж авна.
  // POST (шинэ мөр үүсгэх)-ийн хувьд өмнөх төлөв байдаггүй тул null.
  private async captureBeforeData(
    req: Request,
    tableName: string,
  ): Promise<unknown> {
    if (req.method === 'POST') {
      return null;
    }
    const paramId = req.params?.id;
    if (!paramId) {
      return null;
    }
    const { tx } = this.requestContext.get();
    const rows = await tx.$queryRawUnsafe<unknown[]>(
      `SELECT * FROM "${tableName}" WHERE id = $1`,
      paramId,
    );
    return rows[0] ?? null;
  }

  private async writeAuditLog(
    req: Request,
    metadata: AuditMetadata,
    responseBody: unknown,
    beforeData: unknown,
  ): Promise<void> {
    const recordId =
      metadata.recordId?.(req, responseBody) ??
      req.params?.id ??
      extractIdField(responseBody);

    if (!recordId) {
      this.logger.warn(
        `@Audit("${metadata.tableName}")-д recordId тодорхойлогдсонгүй тул audit лог алгасав (${req.method} ${req.url})`,
      );
      return;
    }

    const { tx, userId } = this.requestContext.get();
    const action =
      metadata.action ?? defaultAction(metadata.tableName, req.method);

    // audit_select RLS policy нь "харилцагч/эрхгүй хэрэглэгч аудит лог
    // уншихгүй" (§6.1 матриц) гэдгийг хэрэгжүүлдэг тул Prisma-гийн
    // `.create()` (дотроо INSERT...RETURNING хийдэг) ашиглавал Postgres
    // RETURNING-ийг мөн SELECT policy-оор шүүж, харагдахгүй мөрийг
    // "violates row-level security policy" алдаа болгож шидэх тохиолдол
    // гардаг (жиш: харилцагч бүртгүүлэхэд өөрийнхөө audit мөрийг харах
    // эрхгүй ч бичих ёстой). RETURNING шаардахгүй raw INSERT ашиглаж
    // үүнийг тойрно — audit_insert policy (WITH CHECK true) л хангагдана.
    await tx.$executeRaw`
      INSERT INTO audit_logs
        (id, "userId", action, "tableName", "recordId", "beforeData", "afterData", "branchId")
      VALUES
        (${randomUUID()}, ${userId}, ${action}, ${metadata.tableName}, ${recordId},
         ${toJsonString(beforeData)}::jsonb, ${toJsonString(responseBody)}::jsonb, ${null})
    `;
  }
}

function extractIdField(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'id' in body) {
    const id = (body as Record<string, unknown>).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

function defaultAction(tableName: string, method: string): string {
  const verb =
    method === 'POST' ? 'created' : method === 'DELETE' ? 'deleted' : 'updated';
  return `${tableName}.${verb}`;
}

// jsonb баганад ::jsonb-ээр parameterize хийхийн тулд JSON текст болгоно
// (raw SQL-ээс ирсэн мөрөнд Date гэх мэт шууд jsonb болгож чадахгүй утга
// байж болзошгүй тул JSON.stringify өөрөө normalize хийж өгнө).
function toJsonString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}
