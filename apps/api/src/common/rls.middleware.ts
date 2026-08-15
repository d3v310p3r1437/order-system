import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestContextService } from './request-context.js';

// §6.3 ADR spike: хүсэлт бүрийг RLS-д хамрагдсан interactive transaction-д
// ороож, дараа нь дараагийн middleware/controller-уудыг тухайн transaction-ы
// AsyncLocalStorage контекст дотор ажиллуулна.
//
// ЧУХАЛ (Phase 1 TODO): JwtAuthGuard хараахан бичигдээгүй тул одоогоор
// зөвхөн `x-debug-user-id` header-ээр userId авч байгаа нь ЗӨВХӨН spike/dev
// зорилготой. Prod-д ямар ч тохиолдолд header-ээс шууд итгэмжлэгдсэн
// identity авах ёсгүй — JWT баталгаажуулалт заавал орлоно.
@Injectable()
export class RlsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RlsMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const userId = req.header('x-debug-user-id')?.trim() || null;

    let finishResponse: () => void;
    const responseFinished = new Promise<void>((resolve) => {
      finishResponse = resolve;
    });
    res.once('finish', () => finishResponse());
    res.once('close', () => finishResponse());

    this.prisma
      .runRequestTransaction(userId, (tx) =>
        this.requestContext.run({ tx, userId }, async () => {
          next();
          await responseFinished;
        }),
      )
      .catch((err: unknown) => {
        this.logger.error('RLS transaction алдаа гарлаа', err instanceof Error ? err.stack : err);
        if (!res.headersSent) {
          next(err);
        }
      });
  }
}
