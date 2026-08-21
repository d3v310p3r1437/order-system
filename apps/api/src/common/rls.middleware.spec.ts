import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TokenVerifierService } from '../auth/token-verifier.service.js';
import { RequestContextService } from './request-context.js';
import { RlsMiddleware } from './rls.middleware.js';

// ⚠️ Энэ файл 2026-08-19-ний CI incident-ийн (orders.e2e-spec.ts/
// returns.e2e-spec.ts/realtime.e2e-spec.ts-д давтан гарсан 404/400,
// PR #8/#10/#12) яг үндсэн шалтгааныг (HTTP хариу DB COMMIT-ээс ӨМНӨ
// клиент рүү явдаг байсан race) регресс болгож битгий дахин оруулаагүй
// эсэхийг батлана.

// Express middleware-ийн `use()`-ийг Express ӨӨРӨӨ хэзээ ч await хийдэггүй
// (fire-and-forget) тул тестэд ч `middleware.use(...)`-ийн буцаах Promise-ыг
// synchronization цэг болгож ашиглаж болохгүй — оронд нь бүх pending
// microtask бүрэн "тайрагдтал" (`setImmediate`, Node-ийн microtask
// queue-ээс ДАРАА ажилладаг) хүлээнэ.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildResponse(): {
  res: Response;
  originalEndSpy: jest.Mock;
  emitClose: () => void;
} {
  const emitter = new EventEmitter();
  const originalEndSpy = jest.fn(() => res);
  const res = Object.assign(emitter, {
    headersSent: false,
    end: originalEndSpy,
  }) as unknown as Response;
  return { res, originalEndSpy, emitClose: () => emitter.emit('close') };
}

describe('RlsMiddleware', () => {
  let requestContext: RequestContextService;
  let tokenVerifier: TokenVerifierService;
  let req: Request;

  beforeEach(() => {
    requestContext = new RequestContextService();
    tokenVerifier = {
      verify: jest.fn().mockResolvedValue({ localUserId: 'user-1' }),
    } as unknown as TokenVerifierService;
    req = {
      header: (name: string) =>
        name.toLowerCase() === 'authorization' ? 'Bearer token123' : undefined,
    } as unknown as Request;
  });

  it(
    'controller res.end() дуудсан ч, DB транзакц бодитоор COMMIT ' +
      'хийгдэх (Prisma-ийн $transaction callback дуусах) хүртэл жинхэнэ ' +
      'HTTP хариуг клиент рүү ЯВУУЛАХГҮЙ',
    async () => {
      // `runRequestTransaction`-ыг бодит Prisma шиг: handler(tx) дуусаад
      // ЗӨВХӨН дараа нь ("commit"-ийг дуурайлгасан гадны gate нээгдэх
      // хүртэл) өөрийн Promise-оо resolve хийдэг болгож mock хийнэ.
      let resolveCommitGate: () => void;
      const commitGate = new Promise<void>((resolve) => {
        resolveCommitGate = resolve;
      });
      const order: string[] = [];

      const prisma = {
        runRequestTransaction: jest
          .fn()
          .mockImplementation(
            async (
              _userId: string | null,
              handler: (tx: unknown) => Promise<void>,
            ) => {
              await handler({});
              order.push('handler-done');
              await commitGate;
              order.push('commit-done');
            },
          ),
      } as unknown as PrismaService;

      const middleware = new RlsMiddleware(
        prisma,
        requestContext,
        tokenVerifier,
      );
      const { res, originalEndSpy } = buildResponse();

      const next: NextFunction = jest.fn(() => {
        // Nest-ийн controller pipeline асинхрон (microtask) — синхрон биш
        // тул `next()` дуудагдмагц шууд бус, дараагийн microtask дээр
        // res.end()-ийг дуудна.
        void Promise.resolve().then(() => {
          res.end();
        });
      });

      void middleware.use(req, res, next);
      await flushMicrotasks();

      // Энэ мөчид controller "res.end()" дуудсан (order-т 'handler-done'
      // орсон) ч, COMMIT (commitGate) хараахан нээгдээгүй тул ЖИНХЭНЭ
      // хариу клиент рүү ХАРААХАН явж болохгүй.
      expect(order).toEqual(['handler-done']);
      expect(originalEndSpy).not.toHaveBeenCalled();

      resolveCommitGate!();
      await flushMicrotasks();

      expect(originalEndSpy).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['handler-done', 'commit-done']);
    },
  );

  it('res.end()-д дамжуулсан аргументууд (status/body) хадгалагдаж дамждаг', async () => {
    const prisma = {
      runRequestTransaction: jest
        .fn()
        .mockImplementation(
          async (
            _userId: string | null,
            handler: (tx: unknown) => Promise<void>,
          ) => handler({}),
        ),
    } as unknown as PrismaService;

    const middleware = new RlsMiddleware(prisma, requestContext, tokenVerifier);
    const { res, originalEndSpy } = buildResponse();

    const next: NextFunction = jest.fn(() => {
      void Promise.resolve().then(() => {
        res.end('{"ok":true}');
      });
    });

    void middleware.use(req, res, next);
    await flushMicrotasks();

    expect(originalEndSpy).toHaveBeenCalledWith('{"ok":true}');
  });

  it(
    'ALGAA-ны хариу (4xx, Nest-ийн exception filter-ээр боловсруулагдсан, ' +
      'ROLLBACK хийгддэг зам) ч мөн адил транзакц (ROLLBACK) бодитоор ' +
      'дуусах хүртэл res.end()-ийг хойшлуулна',
    async () => {
      // Nest-ийн HttpExceptionFilter нь controller-оос шидэгдсэн 4xx-ийг
      // ЭНЭ middleware-ийн `next()`-ийн ДОТОР (Nest-ийн request pipeline
      // дотор) барьж, `res.end()`-ийг ШУУД дуудна — алдаа middleware-ийн
      // `next()`-ийн гадуур "тасарч" (throw) гардаггүй тул
      // `runRequestTransaction`-ийн callback АМЖИЛТТАЙ (resolve) дуусна.
      // Гэвч ЖИНХЭНЭ Prisma-д ROLLBACK-ийг ч мөн `$transaction()`-ийн
      // callback дуусахаас ӨМНӨ автоматаар хийдэггүй (callback дуусаад
      // Prisma commit/rollback шийднэ) тул commit-ийн адилаар "гадны
      // gate" (энд ROLLBACK-ийг дуурайлгасан) нээгдэх хүртэл
      // runRequestTransaction-ийн Promise ӨӨРӨӨ resolve хийхгүй байхаар
      // mock хийв.
      let resolveRollbackGate: () => void;
      const rollbackGate = new Promise<void>((resolve) => {
        resolveRollbackGate = resolve;
      });
      const order: string[] = [];

      const prisma = {
        runRequestTransaction: jest
          .fn()
          .mockImplementation(
            async (
              _userId: string | null,
              handler: (tx: unknown) => Promise<void>,
            ) => {
              await handler({});
              order.push('handler-done');
              await rollbackGate;
              order.push('rollback-done');
            },
          ),
      } as unknown as PrismaService;

      const middleware = new RlsMiddleware(
        prisma,
        requestContext,
        tokenVerifier,
      );
      const { res, originalEndSpy } = buildResponse();
      res.headersSent = false;

      // HttpExceptionFilter: controller 404 шидэж, res.status(404).json(...)
      // дуудна гэж загварчилав — эцэст нь res.end() дуудагддагтай адил.
      const next: NextFunction = jest.fn(() => {
        void Promise.resolve().then(() => {
          res.end('{"error":{"code":"ORDER_NOT_FOUND"}}');
        });
      });

      void middleware.use(req, res, next);
      await flushMicrotasks();

      expect(order).toEqual(['handler-done']);
      expect(originalEndSpy).not.toHaveBeenCalled();

      resolveRollbackGate!();
      await flushMicrotasks();

      expect(originalEndSpy).toHaveBeenCalledTimes(1);
      expect(originalEndSpy).toHaveBeenCalledWith(
        '{"error":{"code":"ORDER_NOT_FOUND"}}',
      );
      expect(order).toEqual(['handler-done', 'rollback-done']);
    },
  );

  it(
    'runRequestTransaction ӨӨРӨӨ REJECT хийвэл (next() ХЭЗЭЭ Ч дуудагдаагүй, ' +
      'жиш: app.user_id тохируулах SQL шидвэл) rollback дуусахыг хүлээгээд, ' +
      'алдааны хариуг ГАНЦ л удаа явуулна (hang/давхар дуудлагагүй)',
    async () => {
      // `PrismaService.runRequestTransaction`-ийн бодит хэрэгжилтэд
      // `tx.$executeRaw` (app.user_id тохируулах) `handler(tx)` (→ next())
      // дуудагдахаас ӨМНӨ ажилладаг тул тэр мөрөнд алдаа гарвал `next()`
      // ХЭЗЭЭ Ч дуудагдахгүйгээр шууд REJECT хийнэ.
      const boom = new Error('SET app.user_id алдаа');
      const prisma = {
        runRequestTransaction: jest.fn().mockRejectedValue(boom),
      } as unknown as PrismaService;

      const middleware = new RlsMiddleware(
        prisma,
        requestContext,
        tokenVerifier,
      );
      const { res, originalEndSpy } = buildResponse();
      res.headersSent = false;

      // `next(err)`-ийг дуудахад (Express-ийн стандарт алдааны зам) Nest-ийн
      // global exception filter эцэст нь res.end()-ийг дуудна гэж
      // загварчилав.
      const receivedErrors: unknown[] = [];
      const next = jest.fn((err?: unknown) => {
        if (err) {
          receivedErrors.push(err);
          res.end('{"error":{"code":"INTERNAL_ERROR"}}');
        }
      }) as unknown as NextFunction;

      void middleware.use(req, res, next);
      await flushMicrotasks();
      await flushMicrotasks();

      expect(receivedErrors).toEqual([boom]);
      expect(originalEndSpy).toHaveBeenCalledTimes(1);
      expect(originalEndSpy).toHaveBeenCalledWith(
        '{"error":{"code":"INTERNAL_ERROR"}}',
      );
    },
  );

  it(
    'controller res.end()-ийг АМЖИЛТТАЙ дуудсаны ДАРАА (handler(tx) аль ' +
      'хэдийн дуусаад) `runRequestTransaction` COMMIT-ийн үед л REJECT ' +
      'хийвэл (жинхэнэ Prisma-ийн interactive transaction timeout-той ' +
      'адилхан — "Transaction already closed: ... expired") res.end() ' +
      'ЯГ 1 удаа, СҮҮЛИЙН (алдааны) биетэйгээр дуудагдана — 2 дахь ' +
      'дуудлага (write-after-end/процесс унагаах эрсдэлтэй) ХЭЗЭЭ Ч ' +
      'болохгүй',
    async () => {
      // GET /orders-ийн 7758 мөрийн join query-той адил: query ӨӨРӨӨ
      // (handler(tx)) АМЖИЛТТАЙ дуусаж, controller res.end()-ийг зөв
      // (200) биетэйгээр дуудсан ч, Prisma COMMIT хийхээр оролдоход
      // 5000ms-ийн transaction timeout аль хэдийн давсан байх нь бий —
      // энэ үед `runRequestTransaction`-ий буцаах Promise өөрөө REJECT
      // хийнэ (handler(tx) АМЖИЛТТАЙ дуусаад ч). Хуучин код (fix-ээс
      // өмнө) энэ тохиолдолд res.end()-ийг ХОЁР удаа (эхлээд амжилтын
      // 200, дараа нь next(err)-ийн алдааны 500) дуудуулж, бодит Node.js
      // орчинд `ERR_STREAM_WRITE_AFTER_END` шидэж, res-ийн 'error'
      // listener байхгүй тул процессыг унагаадаг байсан.
      const timeoutErr = new Error(
        'Transaction API error: Transaction already closed: A commit ' +
          'cannot be executed on an expired transaction.',
      );
      const prisma = {
        runRequestTransaction: jest
          .fn()
          .mockImplementation(
            async (
              _userId: string | null,
              handler: (tx: unknown) => Promise<void>,
            ) => {
              await handler({});
              throw timeoutErr;
            },
          ),
      } as unknown as PrismaService;

      const middleware = new RlsMiddleware(
        prisma,
        requestContext,
        tokenVerifier,
      );
      const { res, originalEndSpy } = buildResponse();
      res.headersSent = false;

      const next: NextFunction = jest.fn((err?: unknown) => {
        if (!err) {
          // Controller: тооцоолол амжилттай дууссан гэж үзээд шууд 200
          // хариу бэлдэнэ (жинхэнэ OrderController.findAll()-той адил).
          void Promise.resolve().then(() => {
            res.end('{"ok":true}');
          });
        } else {
          // HttpExceptionFilter: транзакц REJECT хийсний дараа л,
          // controller-ийн "амжилттай" гэж бодсон хариуг ААЛГАЖ, ЖИНХЭНЭ
          // алдааны хариугаар СОЛИНО.
          void Promise.resolve().then(() => {
            res.end('{"error":{"code":"INTERNAL_ERROR"}}');
          });
        }
      });

      void middleware.use(req, res, next);
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(originalEndSpy).toHaveBeenCalledTimes(1);
      expect(originalEndSpy).toHaveBeenCalledWith(
        '{"error":{"code":"INTERNAL_ERROR"}}',
      );
    },
  );

  it(
    'client холболтоо цуцалж res.end() ХЭЗЭЭ Ч дуудагдаагүй ч ' +
      "('close' event) транзакц мөнхөд зогсохгүй",
    async () => {
      let handlerResolved = false;
      const prisma = {
        runRequestTransaction: jest
          .fn()
          .mockImplementation(
            async (
              _userId: string | null,
              handler: (tx: unknown) => Promise<void>,
            ) => {
              await handler({});
              handlerResolved = true;
            },
          ),
      } as unknown as PrismaService;

      const middleware = new RlsMiddleware(
        prisma,
        requestContext,
        tokenVerifier,
      );
      const { res, emitClose } = buildResponse();

      // Controller res.end()-ийг ХЭЗЭЭ Ч дуудахгүй (клиент цуцалсан загвар).
      const next: NextFunction = jest.fn();

      void middleware.use(req, res, next);
      await flushMicrotasks();
      expect(handlerResolved).toBe(false);

      emitClose();
      await flushMicrotasks();

      expect(handlerResolved).toBe(true);
    },
  );
});
