import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportService } from './report.service.js';

interface AggregateArgs {
  where: Record<string, unknown>;
}

function buildPrismaMock() {
  // orderAggregate/returnRequestAggregate-д тодорхой generic төрөл
  // өгсөн нь `.mock.calls[0][0]`-ээр where-г уншихад "any" гинжлэгдэхээс
  // сэргийлнэ (jest.fn() generic-гүй бол MockContext.calls нь `any`
  // болдог тул @typescript-eslint/no-unsafe-member-access-д баригддаг).
  const orderAggregate = jest.fn<Promise<unknown>, [AggregateArgs]>();
  const returnRequestAggregate = jest.fn<Promise<unknown>, [AggregateArgs]>();
  const orderItemFindMany = jest.fn();
  const queryRaw = jest.fn();
  const tx = {
    order: { aggregate: orderAggregate },
    returnRequest: { aggregate: returnRequestAggregate },
    orderItem: { findMany: orderItemFindMany },
    $queryRaw: queryRaw,
  };
  const prisma = {
    get tx() {
      return tx;
    },
  };
  return {
    prisma,
    mocks: {
      orderAggregate,
      returnRequestAggregate,
      orderItemFindMany,
      queryRaw,
    },
  };
}

function makeService(prisma: unknown): ReportService {
  return new ReportService(
    prisma as ConstructorParameters<typeof ReportService>[0],
  );
}

describe('ReportService', () => {
  describe('getSalesSummary', () => {
    it('нийт орлого, захиалгын тоо, дундаж, буцаалтыг зөв тооцно', async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.orderAggregate.mockResolvedValue({
        _sum: { totalAmount: new Prisma.Decimal(300000) },
        _count: 3,
      });
      mocks.returnRequestAggregate.mockResolvedValue({
        _sum: { refundAmount: new Prisma.Decimal(9000) },
        _count: 1,
      });

      const service = makeService(prisma);
      const result = await service.getSalesSummary({
        from: '2026-08-01',
        to: '2026-08-19',
      });

      expect(result.totalRevenue).toBe('300000.00');
      expect(result.orderCount).toBe(3);
      expect(result.averageOrderAmount).toBe('100000.00');
      expect(result.returnAmount).toBe('9000.00');
      expect(result.returnCount).toBe(1);
      expect(result.branchId).toBeNull();
    });

    it('захиалга байхгүй үед (orderCount=0) дундаж 0/0 биш "0.00" буцаана', async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.orderAggregate.mockResolvedValue({
        _sum: { totalAmount: null },
        _count: 0,
      });
      mocks.returnRequestAggregate.mockResolvedValue({
        _sum: { refundAmount: null },
        _count: 0,
      });

      const service = makeService(prisma);
      const result = await service.getSalesSummary({
        from: '2026-08-01',
        to: '2026-08-19',
      });

      expect(result.totalRevenue).toBe('0.00');
      expect(result.averageOrderAmount).toBe('0.00');
    });

    it('branchId дамжуулбал aggregate where-д орно', async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.orderAggregate.mockResolvedValue({
        _sum: { totalAmount: new Prisma.Decimal(0) },
        _count: 0,
      });
      mocks.returnRequestAggregate.mockResolvedValue({
        _sum: { refundAmount: new Prisma.Decimal(0) },
        _count: 0,
      });

      const service = makeService(prisma);
      await service.getSalesSummary({
        from: '2026-08-01',
        to: '2026-08-19',
        branchId: 'branch-1',
      });

      const orderArgs = mocks.orderAggregate.mock.calls[0][0];
      expect(orderArgs.where.branchId).toBe('branch-1');

      const returnArgs = mocks.returnRequestAggregate.mock.calls[0][0];
      expect(returnArgs.where.orderItem).toEqual({
        order: { branchId: 'branch-1' },
      });
    });

    it('from > to бол BadRequestException шидэнэ', async () => {
      const { prisma } = buildPrismaMock();
      const service = makeService(prisma);

      await expect(
        service.getSalesSummary({ from: '2026-08-19', to: '2026-08-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('буруу огнооны мөр бол BadRequestException шидэнэ', async () => {
      const { prisma } = buildPrismaMock();
      const service = makeService(prisma);

      await expect(
        service.getSalesSummary({ from: 'буруу-огноо', to: '2026-08-19' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTopProducts', () => {
    it('ижил variantId-тэй хэд хэдэн мөрийг нэгтгэж, тоо ширхэгээр буурахаар эрэмбэлнэ', async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.orderItemFindMany.mockResolvedValue([
        {
          variantId: 'v1',
          quantity: 2,
          unitPriceSnapshot: new Prisma.Decimal(1000),
          variant: { name: 'Улаан', product: { name: 'Гутал' } },
        },
        {
          variantId: 'v1',
          quantity: 3,
          unitPriceSnapshot: new Prisma.Decimal(1000),
          variant: { name: 'Улаан', product: { name: 'Гутал' } },
        },
        {
          variantId: 'v2',
          quantity: 1,
          unitPriceSnapshot: new Prisma.Decimal(5000),
          variant: { name: 'Хар', product: { name: 'Малгай' } },
        },
      ]);

      const service = makeService(prisma);
      const result = await service.getTopProducts({
        from: '2026-08-01',
        to: '2026-08-19',
      });

      expect(result).toEqual([
        {
          variantId: 'v1',
          productName: 'Гутал',
          variantName: 'Улаан',
          quantitySold: 5,
          revenue: '5000.00',
        },
        {
          variantId: 'v2',
          productName: 'Малгай',
          variantName: 'Хар',
          quantitySold: 1,
          revenue: '5000.00',
        },
      ]);
    });

    it('limit параметрээр үр дүнг хязгаарлана', async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.orderItemFindMany.mockResolvedValue([
        {
          variantId: 'v1',
          quantity: 5,
          unitPriceSnapshot: new Prisma.Decimal(100),
          variant: { name: 'A', product: { name: 'P1' } },
        },
        {
          variantId: 'v2',
          quantity: 3,
          unitPriceSnapshot: new Prisma.Decimal(100),
          variant: { name: 'B', product: { name: 'P2' } },
        },
        {
          variantId: 'v3',
          quantity: 1,
          unitPriceSnapshot: new Prisma.Decimal(100),
          variant: { name: 'C', product: { name: 'P3' } },
        },
      ]);

      const service = makeService(prisma);
      const result = await service.getTopProducts({
        from: '2026-08-01',
        to: '2026-08-19',
        limit: 2,
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.variantId)).toEqual(['v1', 'v2']);
    });
  });

  describe('getRevenueTrend', () => {
    it('$queryRaw-ийн мөрүүдийг өдөр/орлого/тоогоор хөрвүүлнэ', async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.queryRaw.mockResolvedValue([
        {
          day: new Date('2026-08-18T00:00:00.000Z'),
          revenue: '15000',
          orderCount: 2n,
        },
        {
          day: new Date('2026-08-19T00:00:00.000Z'),
          revenue: '5000',
          orderCount: 1n,
        },
      ]);

      const service = makeService(prisma);
      const result = await service.getRevenueTrend({
        from: '2026-08-18',
        to: '2026-08-19',
      });

      expect(result).toEqual([
        { date: '2026-08-18', revenue: '15000.00', orderCount: 2 },
        { date: '2026-08-19', revenue: '5000.00', orderCount: 1 },
      ]);
    });
  });

  describe('getBranchComparison', () => {
    it('$queryRaw-ийн мөрүүдийг салбарын нэр/орлого/тоогоор хөрвүүлнэ', async () => {
      const { prisma, mocks } = buildPrismaMock();
      mocks.queryRaw.mockResolvedValue([
        {
          branchId: 'b1',
          branchName: 'Төв салбар',
          revenue: '20000',
          orderCount: 4n,
        },
        {
          branchId: 'b2',
          branchName: '2-р салбар',
          revenue: '0',
          orderCount: 0n,
        },
      ]);

      const service = makeService(prisma);
      const result = await service.getBranchComparison({
        from: '2026-08-01',
        to: '2026-08-19',
      });

      expect(result).toEqual([
        {
          branchId: 'b1',
          branchName: 'Төв салбар',
          revenue: '20000.00',
          orderCount: 4,
        },
        {
          branchId: 'b2',
          branchName: '2-р салбар',
          revenue: '0.00',
          orderCount: 0,
        },
      ]);
    });
  });
});
