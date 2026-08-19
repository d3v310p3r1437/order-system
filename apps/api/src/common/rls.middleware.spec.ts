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
