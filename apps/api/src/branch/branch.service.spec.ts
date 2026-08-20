import { BranchService } from './branch.service.js';

function buildPrismaMock() {
  const branchFindMany = jest.fn();
  const queryRaw = jest.fn().mockResolvedValue([]);
  const tx = {
    branch: { findMany: branchFindMany },
    $queryRaw: queryRaw,
  };
  return {
    prisma: {
      get tx() {
        return tx;
      },
    },
    mocks: { branchFindMany, queryRaw },
  };
}

function buildRequestContextMock(userId: string | null) {
  return { get: jest.fn(() => ({ userId })) };
}

describe('BranchService — CUSTOMER-д зориулсан public branch жагсаалт (Android emulator дээр илэрсэн олдвор)', () => {
  it('staff (жиш SUPER_ADMIN) дуудвал одоо байгаа RLS-ээр шүүгдсэн tx.branch.findMany()-г ашиглана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.branchFindMany.mockResolvedValue([{ id: 'b-1', name: 'Салбар' }]);
    const requestContext = buildRequestContextMock('user-1');
    // resolveUserRoleNames DB-ээс уншдаг тул tx-ийн userBranchRole/user
    // mock-ийг бэлдэх шаардлагагүй — SUPER_ADMIN шалгахын тулд шууд
    // findFirst-ийг simulate хийхийн оронд findAll()-ийн дуудлагыг
    // тестлэхэд зөвхөн CUSTOMER БУС гэдгийг л батлах шаардлагатай тул
    // userBranchRole.findMany-г SUPER_ADMIN мөртэй буцаана.
    (
      prisma.tx as unknown as { userBranchRole: { findMany: jest.Mock } }
    ).userBranchRole = {
      findMany: jest.fn().mockResolvedValue([{ role: 'SUPER_ADMIN' }]),
    };

    const service = new BranchService(
      prisma as unknown as ConstructorParameters<typeof BranchService>[0],
      requestContext as unknown as ConstructorParameters<
        typeof BranchService
      >[1],
    );

    const result = await service.findAll();

    expect(mocks.branchFindMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'b-1', name: 'Салбар' }]);
  });

  it('CUSTOMER дуудвал app_public_branches() SECURITY DEFINER функцээр (raw SQL) уншина, tx.branch.findMany() ДУУДАХГҮЙ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([
      { id: 'b-1', name: 'Идэвхтэй салбар', address: null, district: null },
    ]);
    const requestContext = buildRequestContextMock('customer-1');
    // CUSTOMER: user_branch_roles мөргүй (resolveUserRoleNames-ийн
    // "authProvider=CUSTOMER_AUTH бол CUSTOMER" fallback замыг simulate).
    (
      prisma.tx as unknown as {
        userBranchRole: { findMany: jest.Mock };
        user: { findUnique: jest.Mock };
      }
    ).userBranchRole = { findMany: jest.fn().mockResolvedValue([]) };
    (prisma.tx as unknown as { user: { findUnique: jest.Mock } }).user = {
      findUnique: jest
        .fn()
        .mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' }),
    };

    const service = new BranchService(
      prisma as unknown as ConstructorParameters<typeof BranchService>[0],
      requestContext as unknown as ConstructorParameters<
        typeof BranchService
      >[1],
    );

    const result = await service.findAll();

    expect(mocks.branchFindMany).not.toHaveBeenCalled();
    expect(mocks.queryRaw).toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'b-1', name: 'Идэвхтэй салбар', address: null, district: null },
    ]);
  });
});
