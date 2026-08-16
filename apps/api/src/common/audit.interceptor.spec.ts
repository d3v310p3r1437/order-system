import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { AuditMetadata } from './audit.decorator.js';
import { AuditInterceptor } from './audit.interceptor.js';
import type { RequestContextService } from './request-context.js';

function mockContext(req: {
  method: string;
  params?: Record<string, string>;
  url?: string;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function mockCallHandler(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

function mockErrorCallHandler(err: unknown): CallHandler {
  return { handle: () => throwError(() => err) };
}

// $executeRaw нь tagged template функц (`tx.$executeRaw\`...${a}...\``) тул
// дуудагдахдаа (stringsArray, ...values) хэлбэрээр ирнэ — mock.calls[0]-ийн
// index 0 нь strings array, 1-ээс хойш нь INSERT-ийн утгууд дараалан ирнэ:
// [id, userId, action, tableName, recordId, beforeDataJson, afterDataJson, branchId].
const enum InsertArg {
  Id = 1,
  UserId,
  Action,
  TableName,
  RecordId,
  BeforeData,
  AfterData,
  BranchId,
}

describe('AuditInterceptor', () => {
  let executeRaw: jest.Mock;
  let queryRawUnsafe: jest.Mock;
  let reflectorGet: jest.Mock;
  let requestContext: RequestContextService;
  let reflector: Reflector;

  beforeEach(() => {
    executeRaw = jest.fn().mockResolvedValue(1);
    queryRawUnsafe = jest.fn().mockResolvedValue([]);
    requestContext = {
      get: () => ({
        userId: 'user-1',
        tx: { $executeRaw: executeRaw, $queryRawUnsafe: queryRawUnsafe },
      }),
    } as unknown as RequestContextService;
    reflectorGet = jest.fn();
    reflector = { get: reflectorGet } as unknown as Reflector;
  });

  function interceptor() {
    return new AuditInterceptor(reflector, requestContext);
  }

  it('GET хүсэлтийг бүхэлд нь алгасна (reflector-оос metadata ч авахгүй)', async () => {
    const ctx = mockContext({ method: 'GET' });
    const result = await lastValueFrom(
      interceptor().intercept(ctx, mockCallHandler({ ok: true })),
    );
    expect(result).toEqual({ ok: true });
    expect(reflectorGet).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('@Audit metadata-гүй POST хүсэлтэд audit лог бичихгүй', async () => {
    reflectorGet.mockReturnValue(undefined);
    const ctx = mockContext({ method: 'POST' });
    await lastValueFrom(
      interceptor().intercept(ctx, mockCallHandler({ id: '1' })),
    );
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('@Audit("users")-той POST амжилттай бол handler ажилласны дараа audit лог бичнэ, beforeData нь null', async () => {
    const metadata: AuditMetadata = {
      tableName: 'users',
      action: 'user.registered',
      recordId: (_req, body) => (body as { id: string }).id,
    };
    reflectorGet.mockReturnValue(metadata);
    const ctx = mockContext({ method: 'POST', url: '/auth/customer/register' });

    const responseBody = { id: 'new-user-id', phone: '+97699112233' };
    const result = await lastValueFrom(
      interceptor().intercept(ctx, mockCallHandler(responseBody)),
    );

    expect(result).toEqual(responseBody);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const call = executeRaw.mock.calls[0] as unknown[];
    expect(typeof call[InsertArg.Id]).toBe('string');
    expect(call[InsertArg.UserId]).toBe('user-1');
    expect(call[InsertArg.Action]).toBe('user.registered');
    expect(call[InsertArg.TableName]).toBe('users');
    expect(call[InsertArg.RecordId]).toBe('new-user-id');
    expect(call[InsertArg.BeforeData]).toBeNull();
    expect(call[InsertArg.AfterData]).toBe(JSON.stringify(responseBody));
    expect(call[InsertArg.BranchId]).toBeNull();
  });

  it('PATCH хүсэлтэд handler ажиллахаас өмнө req.params.id-аар beforeData-г уншиж авна', async () => {
    const metadata: AuditMetadata = { tableName: 'branches' };
    reflectorGet.mockReturnValue(metadata);
    queryRawUnsafe.mockResolvedValue([{ id: 'branch-1', name: 'Хуучин нэр' }]);
    const ctx = mockContext({
      method: 'PATCH',
      params: { id: 'branch-1' },
      url: '/branches/branch-1',
    });

    const afterBody = { id: 'branch-1', name: 'Шинэ нэр' };
    await lastValueFrom(
      interceptor().intercept(ctx, mockCallHandler(afterBody)),
    );

    expect(queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT * FROM "branches" WHERE id = $1',
      'branch-1',
    );
    const call = executeRaw.mock.calls[0] as unknown[];
    expect(call[InsertArg.Action]).toBe('branches.updated');
    expect(call[InsertArg.TableName]).toBe('branches');
    expect(call[InsertArg.RecordId]).toBe('branch-1');
    expect(call[InsertArg.BeforeData]).toBe(
      JSON.stringify({ id: 'branch-1', name: 'Хуучин нэр' }),
    );
    expect(call[InsertArg.AfterData]).toBe(JSON.stringify(afterBody));
  });

  it('handler алдаа шидвэл (4xx/5xx) audit лог бичихгүй', async () => {
    const metadata: AuditMetadata = { tableName: 'users' };
    reflectorGet.mockReturnValue(metadata);
    const ctx = mockContext({ method: 'POST' });

    await expect(
      lastValueFrom(
        interceptor().intercept(ctx, mockErrorCallHandler(new Error('boom'))),
      ),
    ).rejects.toThrow('boom');
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('recordId тодорхойлогдохгүй бол алдаа шдэхгүйгээр audit лог бичихгүй', async () => {
    const metadata: AuditMetadata = { tableName: 'users' };
    reflectorGet.mockReturnValue(metadata);
    const ctx = mockContext({ method: 'POST' });

    const result = await lastValueFrom(
      interceptor().intercept(ctx, mockCallHandler({ ok: true })),
    );
    expect(result).toEqual({ ok: true });
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('captureBeforeData (raw SELECT) шидэх алдаа mutation-ы амжилттай хариуг унагаахгүй, зөвхөн анхааруулга бичнэ', async () => {
    const metadata: AuditMetadata = { tableName: 'inventory_items' };
    reflectorGet.mockReturnValue(metadata);
    queryRawUnsafe.mockRejectedValue(new Error('raw select boom'));
    const ctx = mockContext({
      method: 'PATCH',
      params: { id: 'item-1' },
      url: '/inventory-items/item-1/adjust-quantity',
    });

    const responseBody = { id: 'item-1', quantity: 4 };
    const result = await lastValueFrom(
      interceptor().intercept(ctx, mockCallHandler(responseBody)),
    );

    expect(result).toEqual(responseBody);
    const call = executeRaw.mock.calls[0] as unknown[];
    expect(call[InsertArg.BeforeData]).toBeNull();
    expect(call[InsertArg.AfterData]).toBe(JSON.stringify(responseBody));
  });

  it('буруу (том үсэг/тусгай тэмдэгттэй) tableName-той @Audit-ыг алгасна', async () => {
    const metadata = { tableName: 'DROP TABLE users;--' } as AuditMetadata;
    reflectorGet.mockReturnValue(metadata);
    const ctx = mockContext({ method: 'POST' });

    await lastValueFrom(
      interceptor().intercept(ctx, mockCallHandler({ id: '1' })),
    );
    expect(executeRaw).not.toHaveBeenCalled();
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });
});
