import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RequestContextService } from './request-context.js';
import { RolesGuard } from './roles.guard.js';

function mockContext(): ExecutionContext {
  return { getHandler: () => jest.fn() } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflectorGet: jest.Mock;
  let reflector: Reflector;
  let findMany: jest.Mock;
  let findUnique: jest.Mock;
  let prisma: PrismaService;
  let requestContextGet: jest.Mock;
  let requestContext: RequestContextService;

  beforeEach(() => {
    reflectorGet = jest.fn();
    reflector = { get: reflectorGet } as unknown as Reflector;
    findMany = jest.fn().mockResolvedValue([]);
    findUnique = jest.fn().mockResolvedValue(null);
    prisma = {
      get tx() {
        return { userBranchRole: { findMany }, user: { findUnique } };
      },
    } as unknown as PrismaService;
    requestContextGet = jest.fn();
    requestContext = {
      get: requestContextGet,
    } as unknown as RequestContextService;
  });

  function guard() {
    return new RolesGuard(reflector, prisma, requestContext);
  }

  it('userId байхгүй (нэвтрээгүй) бол UnauthorizedException шидэнэ', async () => {
    requestContextGet.mockReturnValue({ userId: null });
    await expect(guard().canActivate(mockContext())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(reflectorGet).not.toHaveBeenCalled();
  });

  it('@Roles() metadata байхгүй бол нэвтэрсэн хэрэглэгчийг л зөвшөөрнө', async () => {
    requestContextGet.mockReturnValue({ userId: 'user-1' });
    reflectorGet.mockReturnValue(undefined);
    await expect(guard().canActivate(mockContext())).resolves.toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('@Roles() хоосон массив бол мөн адил нэвтэрсэн байхыг л шаардана', async () => {
    requestContextGet.mockReturnValue({ userId: 'user-1' });
    reflectorGet.mockReturnValue([]);
    await expect(guard().canActivate(mockContext())).resolves.toBe(true);
  });

  it('хэрэглэгчийн дүр шаардлагатай жагсаалтад байвал зөвшөөрнө', async () => {
    requestContextGet.mockReturnValue({ userId: 'user-1' });
    reflectorGet.mockReturnValue(['SUPER_ADMIN', 'ALL_BRANCH_MANAGER']);
    findMany.mockResolvedValue([
      { role: 'ALL_BRANCH_MANAGER', branchId: null },
    ]);
    await expect(guard().canActivate(mockContext())).resolves.toBe(true);
  });

  it('хэрэглэгчийн дүр шаардлагатай жагсаалтад байхгүй бол ForbiddenException шидэнэ', async () => {
    requestContextGet.mockReturnValue({ userId: 'user-1' });
    reflectorGet.mockReturnValue(['SUPER_ADMIN']);
    findMany.mockResolvedValue([{ role: 'SALESPERSON', branchId: 'b-1' }]);
    await expect(guard().canActivate(mockContext())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('user_branch_roles мөргүй харилцагчийг authProvider-аар нь CUSTOMER гэж танина', async () => {
    requestContextGet.mockReturnValue({ userId: 'customer-1' });
    reflectorGet.mockReturnValue(['CUSTOMER']);
    findMany.mockResolvedValue([]);
    findUnique.mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' });
    await expect(guard().canActivate(mockContext())).resolves.toBe(true);
  });
});
