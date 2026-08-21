import {
  Injectable,
  Logger,
  type NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TokenVerifierService } from '../auth/token-verifier.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequestContextService } from './request-context.js';

// §6.3 ADR: хүсэлт бүрийг RLS-д хамрагдсан interactive transaction-д ороож,
// дараа нь дараагийн middleware/controller-уудыг тухайн transaction-ы
// AsyncLocalStorage контекст дотор ажиллуулна.
//
// §6.2: identity-г `Authorization: Bearer <token>` header-ээс
// TokenVerifierService-ээр баталгаажуулж олно (custom customer JWT эсвэл
// Keycloak JWT аль аль нь адилхан замаар). Token байхгүй үед л (мөн зөвхөн
// NODE_ENV !== 'production' орчинд) хуучин `x-debug-user-id` debug header
// fallback хэвээр үлдсэн.
@Injectable()
export class RlsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RlsMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly tokenVerifier: TokenVerifierService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let userId: string | null;
    try {
      userId = await this.resolveUserId(req);
    } catch (err) {
      next(err);
      return;
    }

    // ⚠️ ЧУХАЛ ЗАСВАР (2026-08-19, orders.e2e-spec.ts/returns.e2e-spec.ts/
    // realtime.e2e-spec.ts-д давтан гарсан CI incident, PR #8/#10/#12):
    // `res.end()`-ийг (HTTP хариу бодитоор клиент рүү явах цэг) доорх
    // транзакц бодитоор COMMIT хийгдэх хүртэл түр саатуулна.
    //
    // Өмнөх алдаатай хувилбарт `res.once('finish', ...)` (хариу АЛЬ ХЭДИЙН
    // явсны ДАРАА гарах event)-ийг ашиглаж, зөвхөн ТҮҮНИЙ дараа Prisma-ийн
    // `$transaction()` callback-аа буцааж COMMIT хийдэг байсан — өөрөөр
    // хэлбэл, HTTP хариу ЗААВАЛ COMMIT-ээс ӨМНӨ клиент рүү явдаг байсан.
    // Үр дүнд нь: клиент (тест эсвэл mobile апп) хариу хүлээн авангуутаа
    // ШУУД дараагийн хүсэлт (жиш: checkout → шууд PATCH .../status) илгээвэл,
    // тэр шинэ хүсэлтийн ӨӨР transaction анхны бичилтийг ХАРААХАН commit
    // хийгдээгүй үед (race) харж чадахгүй 404 (`ORDER_NOT_FOUND`)/400
    // (`INVALID_ORDER_STATUS_TRANSITION`, өмнөх шатны бичилт хараахан
    // харагдаагүйгээс шалтгаалж) буцаадаг байсныг локал `node`
    // reproduce-скриптээр (дараалсан, delay=0, 1000 оролдлогод ~1 удаа)
    // бодитоор баталсан.
    //
    // Одоо `res.end()`-ийг monkey-patch хийж, controller дуудсан МӨЧИД
    // (`signalControllerDone()`-ээр) транзакцын callback-ыг чөлөөлж
    // (→ Prisma COMMIT хийнэ), харин ЖИНХЭНЭ `originalEnd()`-ийг зөвхөн
    // `transactionSettled` биелсний (COMMIT/ROLLBACK аль аль нь дуусаж)
    // ДАРАА л дуудна. Ингэснээр клиент хариу хүлээн авах мөчид DB
    // транзакц ЗААВАЛ commit (эсвэл rollback) хийгдсэн байх нь баталгаатай
    // болно.
    let signalControllerDone: () => void;
    const controllerDone = new Promise<void>((resolve) => {
      signalControllerDone = resolve;
    });
    // Controller-ийн response бичих механизм ер нь res.end()-ээр төгсдөггүй
    // тохиолдол (жиш: клиент холболтоо цуцалсан) гарвал ч транзакц мөнхөд
    // "нээлттэй" зогсохгүйн тулд 'close' дээр ч давхар чөлөөлнө.
    res.once('close', () => signalControllerDone());

    // `res.end`-ийн Express-ийн overload бүхий төрөл `.bind()`-ийн дараа
    // `any` болж хувирдаг тул (eslint `no-unsafe-*`) тодорхой төрөл зааж
    // өгсөн.
    const originalEnd = res.end.bind(res) as (
      ...args: Parameters<Response['end']>
    ) => Response;
    let transactionSettled: Promise<void> = Promise.resolve();
    // ⚠️ ЧУХАЛ ЗАСВАР (2026-08-21, backend процессыг бүхэлд нь унагаадаг
    // байсан ноцтой алдаа): Prisma-ийн interactive transaction-ий 5000ms
    // timeout нь `handler(tx)` (→ `next(); await controllerDone;`) АМЖИЛТТАЙ
    // дуусаад ч (controller аль хэдийн 200 хариу бэлдчихсэн байсан ч),
    // ЗӨВХӨН COMMIT хийх мөчид "Transaction already closed: ... expired"
    // алдаа шидэж болохыг олов (жиш: `GET /orders`-ийн олон мянган мөрийн
    // join query 5с-аас удаан үргэлжлэхэд) — ийм тохиолдолд
    // `runRequestTransaction`-ий Promise REJECT хийж, доод `.catch()`
    // `next(err)`-ийг дуудна, энэ нь Nest-ийн exception filter-ээр дамжиж
    // `res.end()`-ийг ХОЁР ДАХЬ удаа (алдааны биетэй) дуудуулдаг байсан.
    // Хуучин код `res.end()`-ийн дуудлага БҮРД ШУУД шинэ
    // `transactionSettled.finally(() => originalEnd(...))` бүртгэдэг байсан
    // тул хоёр дахь удаагийн бүртгэл ХОЁР ДАХЬ `originalEnd()` дуудлага
    // болж, Node.js-ийн ServerResponse аль хэдийн "төгссөн" урсгал руу
    // дахин бичихийг оролдоход `ERR_STREAM_WRITE_AFTER_END`-г 'error'
    // event-ээр шидэж (`res`-д listener бүртгэгдээгүй тул) БҮХЭЛ Node
    // процессыг unhandled exception-оор унагаадаг байв (2 удаа бодитоор
    // давтан баталгаажуулсан, `rls.middleware.spec.ts`-ийн "controller
    // res.end()-ийг АМЖИЛТТАЙ дуудсаны ДАРАА..." тестээр регресс
    // болгосон). **Засвар:** (1) `flushed` — `originalEnd`-ийг ЯГ 1 удаа л
    // дуудна (идемпотент хамгаалалт, давхар дуудлагаас процесс унахаас
    // сэргийлнэ); (2) `pendingEndArgs`-ийг ХАМГИЙН СҮҮЛД дуудсан
    // `res.end()`-ийн аргументаар ДАХИН БИЧНЭ ("сүүлчийн бичилт ялна") —
    // ингэснээр controller "амжилттай" гэж эхлээд бодсон ч, транзакц
    // эцэст нь бодитоор REJECT хийвэл клиент ХУУРАМЧ 200 БИШ, ЖИНХЭНЭ
    // (алдааны) хариуг л хүлээн авна.
    let flushed = false;
    let pendingEndArgs: Parameters<Response['end']> | null = null;
    res.end = ((...args: Parameters<Response['end']>) => {
      signalControllerDone();
      pendingEndArgs = args;
      void transactionSettled.finally(() => {
        if (flushed) {
          return;
        }
        flushed = true;
        originalEnd(...(pendingEndArgs as Parameters<Response['end']>));
      });
      return res;
    }) as Response['end'];
    // Дэд хамгаалалт (defense-in-depth): дээрх засвар double-end-ийг
    // логикийн түвшинд арилгасан ч, ирээдүйд ижил төстэй өөр зам
    // (жиш: streaming response, өөр middleware) санамсаргүй дахин
    // давхар бичвэл ч БҮХЭЛ процессыг унагахгүй, зөвхөн лог бичээд
    // өнгөрнө — Node.js-ийн стандарт зарчим: EventEmitter-ийн 'error'
    // event-д listener байхгүй бол throw хийдэг тул ямар ч 'error'
    // listener-гүй response объект procees-crash-ийн нэг эх үүсвэр байдаг.
    res.on('error', (err: unknown) => {
      this.logger.error(
        'HTTP response стрим алдаа гарлаа (процесс амьд үлдэнэ)',
        err instanceof Error ? err.stack : err,
      );
    });

    // Энэ массивыг `run()`-д дамжуулсан context-той ИЖИЛ reference-ээр
    // хуваалцаж, доор (transaction амжилттай commit хийгдсэний дараа) дахин
    // ашиглана — array бол доторх мөрөнд push хийхэд reference өөрчлөгдөхгүй.
    const afterCommitCallbacks: Array<() => void> = [];

    transactionSettled = this.prisma
      .runRequestTransaction(userId, (tx) =>
        this.requestContext.run(
          { tx, userId, afterCommitCallbacks },
          async () => {
            next();
            await controllerDone;
          },
        ),
      )
      .then(() => {
        // Энэ мөрд хүрсэн үед `$transaction` (Prisma) аль хэдийн COMMIT
        // хийгдсэн байна — зөвхөн ЭНЭ ХОЙНО л event/side-effect callback-уудыг
        // ажиллуулна.
        for (const callback of afterCommitCallbacks) {
          try {
            callback();
          } catch (err) {
            this.logger.error(
              'afterCommit callback алдаа гарлаа',
              err instanceof Error ? err.stack : err,
            );
          }
        }
      })
      .catch((err: unknown) => {
        this.logger.error(
          'RLS transaction алдаа гарлаа',
          err instanceof Error ? err.stack : err,
        );
        if (!res.headersSent) {
          next(err);
        }
      });
  }

  private async resolveUserId(req: Request): Promise<string | null> {
    const authHeader = req.header('authorization');
    if (authHeader) {
      const [scheme, token] = authHeader.split(' ');
      if (scheme?.toLowerCase() !== 'bearer' || !token) {
        throw new UnauthorizedException({
          code: 'INVALID_AUTH_HEADER',
          message:
            'Authorization header буруу форматтай (Bearer <token> байх ёстой)',
        });
      }
      const { localUserId } = await this.tokenVerifier.verify(token);
      return localUserId;
    }

    // prod-д header-ийг огт үл тоомсорлоно — зөвхөн dev/spike орчинд ашиглана.
    if (process.env.NODE_ENV !== 'production') {
      return req.header('x-debug-user-id')?.trim() || null;
    }
    return null;
  }
}
