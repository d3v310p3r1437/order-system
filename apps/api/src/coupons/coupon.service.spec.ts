import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CouponService } from './coupon.service.js';

function buildPrismaMock() {
  const couponFindUnique = jest.fn();
  const couponCreate = jest.fn();
  const couponUpdate = jest.fn();
  const couponDelete = jest.fn();
  const couponFindMany = jest.fn();
  const couponRedemptionCount = jest.fn().mockResolvedValue(0);
  const queryRaw = jest.fn();

  const tx = {
    coupon: {
      findUnique: couponFindUnique,
      create: couponCreate,
      update: couponUpdate,
      delete: couponDelete,
      findMany: couponFindMany,
    },
    couponRedemption: { count: couponRedemptionCount },
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
      couponFindUnique,
      couponCreate,
      couponUpdate,
      couponDelete,
      couponFindMany,
      couponRedemptionCount,
      queryRaw,
    },
  };
}

function newService(prisma: unknown) {
  return new CouponService(
    prisma as ConstructorParameters<typeof CouponService>[0],
  );
}

const NOW = new Date('2026-08-21T12:00:00.000Z');

function activeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    code: 'SALE10',
    discountType: 'PERCENTAGE',
    discountValue: new Prisma.Decimal(10),
    maxDiscountAmount: null,
    minOrderAmount: null,
    usageLimit: null,
    usageCount: 0,
    usageLimitPerCustomer: 1,
    isActive: true,
    validFrom: new Date(NOW.getTime() - 60_000),
    validTo: new Date(NOW.getTime() + 60_000),
    ...overrides,
  };
}

describe('CouponService.validateForCheckout', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('олдоогүй код бол NotFoundException', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(null);
    const service = newService(prisma);

    await expect(
      service.validateForCheckout('NOSUCH', new Prisma.Decimal(1000), null),
    ).rejects.toThrow(NotFoundException);
  });

  it('идэвхгүй купон бол BadRequestException (COUPON_INACTIVE)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(activeCoupon({ isActive: false }));
    const service = newService(prisma);

    await expect(
      service.validateForCheckout('SALE10', new Prisma.Decimal(1000), null),
    ).rejects.toMatchObject({
      response: { code: 'COUPON_INACTIVE' },
    });
  });

  it('validFrom-оос өмнө бол COUPON_NOT_YET_VALID', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(
      activeCoupon({ validFrom: new Date(NOW.getTime() + 60_000) }),
    );
    const service = newService(prisma);

    await expect(
      service.validateForCheckout('SALE10', new Prisma.Decimal(1000), null),
    ).rejects.toMatchObject({ response: { code: 'COUPON_NOT_YET_VALID' } });
  });

  it('validTo-оос хойш бол COUPON_EXPIRED', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(
      activeCoupon({ validTo: new Date(NOW.getTime() - 1000) }),
    );
    const service = newService(prisma);

    await expect(
      service.validateForCheckout('SALE10', new Prisma.Decimal(1000), null),
    ).rejects.toMatchObject({ response: { code: 'COUPON_EXPIRED' } });
  });

  it('minOrderAmount хангаагүй бол COUPON_MIN_ORDER_NOT_MET', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(
      activeCoupon({ minOrderAmount: new Prisma.Decimal(5000) }),
    );
    const service = newService(prisma);

    await expect(
      service.validateForCheckout('SALE10', new Prisma.Decimal(1000), null),
    ).rejects.toMatchObject({
      response: { code: 'COUPON_MIN_ORDER_NOT_MET' },
    });
  });

  it('нийт usageLimit дууссан бол ConflictException (COUPON_USAGE_LIMIT_REACHED)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(
      activeCoupon({ usageLimit: 5, usageCount: 5 }),
    );
    const service = newService(prisma);

    await expect(
      service.validateForCheckout('SALE10', new Prisma.Decimal(1000), null),
    ).rejects.toThrow(ConflictException);
  });

  it('customerId өгөгдсөн үед аль хэдийн ашигласан бол COUPON_ALREADY_USED', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(activeCoupon());
    mocks.couponRedemptionCount.mockResolvedValue(1);
    const service = newService(prisma);

    await expect(
      service.validateForCheckout('SALE10', new Prisma.Decimal(1000), 'cust-1'),
    ).rejects.toMatchObject({ response: { code: 'COUPON_ALREADY_USED' } });
  });

  it('customerId=null (staff preview) үед "хэдэн удаа ашигласан" шалгалт алгасагдана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(activeCoupon());
    const service = newService(prisma);

    const result = await service.validateForCheckout(
      'SALE10',
      new Prisma.Decimal(1000),
      null,
    );
    expect(mocks.couponRedemptionCount).not.toHaveBeenCalled();
    expect(result.discountAmount.toString()).toBe('100');
  });

  it('хүчинтэй тохиолдолд зөв discountAmount буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.couponFindUnique.mockResolvedValue(
      activeCoupon({
        discountType: 'FIXED_AMOUNT',
        discountValue: new Prisma.Decimal(1500),
      }),
    );
    const service = newService(prisma);

    const result = await service.validateForCheckout(
      'SALE10',
      new Prisma.Decimal(10000),
      'cust-1',
    );
    expect(result.discountAmount.toString()).toBe('1500');
  });
});

describe('CouponService.redeemAtomic', () => {
  it('SQL функц 1 буцаавал амжилттай (алдаа шидэхгүй)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([{ app_redeem_coupon: 1 }]);
    const service = newService(prisma);

    await expect(
      service.redeemAtomic(
        'coupon-1',
        'order-1',
        'cust-1',
        new Prisma.Decimal(100),
      ),
    ).resolves.toBeUndefined();
  });

  it('SQL функц 0 буцаавал ConflictException шидэнэ (race-д ялагдсан)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.queryRaw.mockResolvedValue([{ app_redeem_coupon: 0 }]);
    const service = newService(prisma);

    await expect(
      service.redeemAtomic(
        'coupon-1',
        'order-1',
        'cust-1',
        new Prisma.Decimal(100),
      ),
    ).rejects.toThrow(ConflictException);
  });
});

describe('CouponService.create', () => {
  it('PERCENTAGE discountValue 100-аас их бол BadRequestException', async () => {
    const { prisma } = buildPrismaMock();
    const service = newService(prisma);

    await expect(
      service.create(
        {
          code: 'BIG',
          discountType: 'PERCENTAGE',
          discountValue: 150,
          validFrom: NOW.toISOString(),
          validTo: new Date(NOW.getTime() + 60_000).toISOString(),
        } as never,
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('validFrom >= validTo бол BadRequestException', async () => {
    const { prisma } = buildPrismaMock();
    const service = newService(prisma);

    await expect(
      service.create(
        {
          code: 'BAD',
          discountType: 'FIXED_AMOUNT',
          discountValue: 100,
          validFrom: new Date(NOW.getTime() + 60_000).toISOString(),
          validTo: NOW.toISOString(),
        } as never,
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('код автоматаар UPPERCASE болж хадгалагдана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    let capturedCode: string | undefined;
    mocks.couponCreate.mockImplementation(
      (args: { data: { code: string } }) => {
        capturedCode = args.data.code;
        return Promise.resolve(activeCoupon());
      },
    );
    const service = newService(prisma);

    await service.create(
      {
        code: 'sale10',
        discountType: 'FIXED_AMOUNT',
        discountValue: 100,
        validFrom: NOW.toISOString(),
        validTo: new Date(NOW.getTime() + 60_000).toISOString(),
      } as never,
      'admin-1',
    );

    expect(capturedCode).toBe('SALE10');
  });
});
