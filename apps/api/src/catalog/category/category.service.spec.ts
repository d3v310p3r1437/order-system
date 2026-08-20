import { CategoryService } from './category.service.js';

describe('CategoryService', () => {
  let findManyCategory: jest.Mock;
  let findManyUbr: jest.Mock;
  let findUniqueUser: jest.Mock;
  let userId: string | null;
  let service: CategoryService;

  beforeEach(() => {
    findManyCategory = jest.fn().mockResolvedValue([]);
    findManyUbr = jest.fn().mockResolvedValue([]);
    findUniqueUser = jest.fn().mockResolvedValue(null);
    userId = 'user-1';

    const prisma = {
      get tx() {
        return {
          category: { findMany: findManyCategory },
          userBranchRole: { findMany: findManyUbr },
          user: { findUnique: findUniqueUser },
        };
      },
    };
    const requestContext = { get: () => ({ userId }) };

    service = new CategoryService(
      prisma as unknown as ConstructorParameters<typeof CategoryService>[0],
      requestContext as unknown as ConstructorParameters<
        typeof CategoryService
      >[1],
    );
  });

  describe('findAll', () => {
    // §6.1 "GET /categories нь admin-web-ийн (идэвхгүйг ч харуулдаг) удирдах
    // хуудас БОЛОН mobile-ийн харилцагчийн chip мөрийг хуваалцдаг" зарчмыг
    // шалгана — category.service.ts-ийн шинэ role-conditional filter.
    it('CUSTOMER дүртэй бол зөвхөн isActive:true шүүлттэй дуудна', async () => {
      findUniqueUser.mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' });

      await service.findAll();

      expect(findManyCategory).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });

    it('staff дүртэй (жиш SUPER_ADMIN) бол isActive шүүлтгүй бүгдийг дуудна', async () => {
      findManyUbr.mockResolvedValue([
        { userId: 'user-1', branchId: null, role: 'SUPER_ADMIN' },
      ]);

      await service.findAll();

      expect(findManyCategory).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });

    it('parentId дамжсан бол CUSTOMER-ийн хувьд ч хоёр нөхцөл хамт орно', async () => {
      findUniqueUser.mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' });

      await service.findAll('parent-1');

      expect(findManyCategory).toHaveBeenCalledWith({
        where: { parentId: 'parent-1', isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });
});
