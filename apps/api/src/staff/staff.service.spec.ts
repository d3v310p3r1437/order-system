import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StaffService } from './staff.service.js';

function buildPrismaMock() {
  const userFindMany = jest.fn();
  const userFindUnique = jest.fn();
  const queryRaw = jest.fn();

  const tx = {
    user: { findMany: userFindMany, findUnique: userFindUnique },
    $queryRaw: queryRaw,
  };

  const prisma = {
    get tx() {
      return tx;
    },
  };

  return { prisma, mocks: { userFindMany, userFindUnique, queryRaw } };
}

function buildKeycloakAdminMock() {
  return {
    provisionUser: jest.fn(),
    deleteUser: jest.fn(),
  };
}

function newService(prisma: unknown, keycloakAdmin: unknown) {
  return new StaffService(
    prisma as ConstructorParameters<typeof StaffService>[0],
    keycloakAdmin as ConstructorParameters<typeof StaffService>[1],
  );
}

describe('StaffService.create — Keycloak+Postgres атомик орчуулга', () => {
  it('амжилттай: Keycloak provision хийгээд, Postgres CREATED буцаавал temporaryPassword-той хариу буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    keycloakAdmin.provisionUser.mockResolvedValue({
      keycloakUserId: 'kc-1',
      wasCreated: true,
      temporaryPassword: 'temp-pass-123',
    });
    mocks.queryRaw.mockResolvedValue([{ app_create_staff_member: 'CREATED' }]);

    const service = newService(prisma, keycloakAdmin);
    const result = await service.create({
      email: 'Bat@Order-System.mn',
      fullName: 'Бат Болд',
      role: 'BRANCH_MANAGER',
      branchId: 'branch-1',
    });

    expect(result.email).toBe('bat@order-system.mn');
    expect(result.temporaryPassword).toBe('temp-pass-123');
    expect(keycloakAdmin.deleteUser).not.toHaveBeenCalled();
  });

  it('⚠️ ЦӨМ: Postgres тал FORBIDDEN буцаавал, ШИНЭЭР үүссэн Keycloak хэрэглэгчийг rollback (устгана)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    keycloakAdmin.provisionUser.mockResolvedValue({
      keycloakUserId: 'kc-new-1',
      wasCreated: true,
      temporaryPassword: 'temp-pass-123',
    });
    mocks.queryRaw.mockResolvedValue([{ app_create_staff_member: 'FORBIDDEN' }]);

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.create({
        email: 'evil@order-system.mn',
        fullName: 'Attacker',
        role: 'SALESPERSON',
        branchId: 'other-branch',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(keycloakAdmin.deleteUser).toHaveBeenCalledWith('kc-new-1');
  });

  it('⚠️ ЦӨМ: Postgres тал алдаа шидвэл (жиш: email давхардал), ШИНЭЭР үүссэн Keycloak хэрэглэгчийг rollback хийнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    keycloakAdmin.provisionUser.mockResolvedValue({
      keycloakUserId: 'kc-new-2',
      wasCreated: true,
      temporaryPassword: 'temp-pass-123',
    });
    mocks.queryRaw.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.0',
      }),
    );

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.create({
        email: 'dup@order-system.mn',
        fullName: 'Dup User',
        role: 'SALESPERSON',
        branchId: 'branch-1',
      }),
    ).rejects.toThrow(ConflictException);

    expect(keycloakAdmin.deleteUser).toHaveBeenCalledWith('kc-new-2');
  });

  it('⚠️ ЦӨМ: Keycloak-ийн ОЛДСОН (дахин ашигласан, wasCreated=false) хэрэглэгчийг Postgres FORBIDDEN болоход ХЭЗЭЭ Ч устгахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    keycloakAdmin.provisionUser.mockResolvedValue({
      keycloakUserId: 'kc-existing-1',
      wasCreated: false,
      temporaryPassword: 'temp-pass-123',
    });
    mocks.queryRaw.mockResolvedValue([{ app_create_staff_member: 'FORBIDDEN' }]);

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.create({
        email: 'reused@order-system.mn',
        fullName: 'Reused User',
        role: 'SALESPERSON',
        branchId: 'other-branch',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(keycloakAdmin.deleteUser).not.toHaveBeenCalled();
  });

  it('глобал дүрд (SUPER_ADMIN) branchId зааж болохгүй — Keycloak-д ХҮРЭХГҮЙ шууд 400', async () => {
    const { prisma } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.create({
        email: 'super@order-system.mn',
        fullName: 'Super Admin',
        role: 'SUPER_ADMIN',
        branchId: 'branch-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(keycloakAdmin.provisionUser).not.toHaveBeenCalled();
  });

  it('салбарын дүрд (BRANCH_MANAGER) branchId заавал шаардлагатай', async () => {
    const { prisma } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.create({
        email: 'mgr@order-system.mn',
        fullName: 'Manager',
        role: 'BRANCH_MANAGER',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(keycloakAdmin.provisionUser).not.toHaveBeenCalled();
  });
});

describe('StaffService.update', () => {
  it('дүр/салбар амжилттай солиход UPDATED буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    mocks.userFindUnique.mockResolvedValue({ id: 'u-1', authProvider: 'KEYCLOAK' });
    mocks.queryRaw.mockResolvedValue([{ app_update_staff_member: 'UPDATED' }]);

    const service = newService(prisma, keycloakAdmin);
    const result = await service.update('u-1', {
      oldBranchId: 'branch-1',
      role: 'BRANCH_ADMIN',
      branchId: 'branch-1',
    });

    expect(result).toEqual({ id: 'u-1' });
  });

  it('SQL FORBIDDEN буцаавал ForbiddenException шиднэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    mocks.userFindUnique.mockResolvedValue({ id: 'u-1', authProvider: 'KEYCLOAK' });
    mocks.queryRaw.mockResolvedValue([{ app_update_staff_member: 'FORBIDDEN' }]);

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.update('u-1', { isActive: false, oldBranchId: 'other-branch' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('SQL ASSIGNMENT_NOT_FOUND буцаавал NotFoundException шиднэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    mocks.userFindUnique.mockResolvedValue({ id: 'u-1', authProvider: 'KEYCLOAK' });
    mocks.queryRaw.mockResolvedValue([
      { app_update_staff_member: 'ASSIGNMENT_NOT_FOUND' },
    ]);

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.update('u-1', {
        oldBranchId: 'wrong-branch',
        role: 'BRANCH_ADMIN',
        branchId: 'branch-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('CUSTOMER (authProvider !== KEYCLOAK) бол NotFoundException', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    mocks.userFindUnique.mockResolvedValue({
      id: 'customer-1',
      authProvider: 'CUSTOMER_AUTH',
    });

    const service = newService(prisma, keycloakAdmin);
    await expect(
      service.update('customer-1', { isActive: false }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('StaffService.findAll', () => {
  it('role/branchId шүүлтийг Prisma where-рүү зөв дамжуулна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const keycloakAdmin = buildKeycloakAdminMock();
    mocks.userFindMany.mockResolvedValue([]);

    const service = newService(prisma, keycloakAdmin);
    await service.findAll({ role: 'SALESPERSON', branchId: 'branch-1' });

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          authProvider: 'KEYCLOAK',
          userBranchRoles: {
            some: { role: 'SALESPERSON', branchId: 'branch-1' },
          },
        }),
      }),
    );
  });
});
