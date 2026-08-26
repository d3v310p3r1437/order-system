import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewService } from './review.service.js';

function buildPrismaMock() {
  const orderItemFindFirst = jest.fn();
  const reviewFindUnique = jest.fn();
  const reviewFindMany = jest.fn();
  const reviewCount = jest.fn();
  const reviewAggregate = jest.fn();
  const reviewCreate = jest.fn();
  const reviewUpdate = jest.fn();
  const reviewDelete = jest.fn();

  const tx = {
    orderItem: { findFirst: orderItemFindFirst },
    review: {
      findUnique: reviewFindUnique,
      findMany: reviewFindMany,
      count: reviewCount,
      aggregate: reviewAggregate,
      create: reviewCreate,
      update: reviewUpdate,
      delete: reviewDelete,
    },
  };

  const prisma = {
    get tx() {
      return tx;
    },
  };

  return {
    prisma,
    mocks: {
      orderItemFindFirst,
      reviewFindUnique,
      reviewFindMany,
      reviewCount,
      reviewAggregate,
      reviewCreate,
      reviewUpdate,
      reviewDelete,
    },
  };
}

function newService(prisma: unknown) {
  return new ReviewService(
    prisma as ConstructorParameters<typeof ReviewService>[0],
  );
}

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('mock', {
    code,
    clientVersion: '6.19.3',
  });
}

describe('ReviewService — verified-purchase шалгалт', () => {
  it('hasVerifiedPurchase() COMPLETED захиалгын OrderItem олдвол true буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindFirst.mockResolvedValue({ id: 'oi-1' });
    const service = newService(prisma);

    const result = await service.hasVerifiedPurchase('cust-1', 'p-1');

    expect(result).toBe(true);
    expect(mocks.orderItemFindFirst).toHaveBeenCalledWith({
      where: {
        variant: { productId: 'p-1' },
        order: { customerId: 'cust-1', status: 'COMPLETED' },
      },
      select: { id: true },
    });
  });

  it('hasVerifiedPurchase() олдоогүй бол false буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindFirst.mockResolvedValue(null);
    const service = newService(prisma);

    expect(await service.hasVerifiedPurchase('cust-1', 'p-1')).toBe(false);
  });

  it('create() худалдаж аваагүй бол ForbiddenException шидэж, Review.create() ОГТ дуудагдахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindFirst.mockResolvedValue(null);
    const service = newService(prisma);

    await expect(
      service.create('cust-1', 'p-1', { rating: 5 }),
    ).rejects.toThrow(ForbiddenException);
    expect(mocks.reviewCreate).not.toHaveBeenCalled();
  });

  it('create() худалдаж авсан бол амжилттай Review үүсгэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindFirst.mockResolvedValue({ id: 'oi-1' });
    mocks.reviewCreate.mockResolvedValue({
      id: 'r-1',
      customerId: 'cust-1',
      productId: 'p-1',
      rating: 5,
      comment: 'сайхан',
    });
    const service = newService(prisma);

    const result = await service.create('cust-1', 'p-1', {
      rating: 5,
      comment: 'сайхан',
    });

    expect(result.id).toBe('r-1');
    expect(mocks.reviewCreate).toHaveBeenCalledWith({
      data: {
        customerId: 'cust-1',
        productId: 'p-1',
        rating: 5,
        comment: 'сайхан',
      },
    });
  });

  it('create() давхардсан (customerId,productId) unique constraint зөрчвөл ConflictException (409) шиднэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindFirst.mockResolvedValue({ id: 'oi-1' });
    mocks.reviewCreate.mockRejectedValue(knownRequestError('P2002'));
    const service = newService(prisma);

    await expect(
      service.create('cust-1', 'p-1', { rating: 4 }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('ReviewService — getCustomerReviewContext (ProductService.findOne()-д дахин ашиглагдана)', () => {
  it('canReview нь зөвхөн verified-purchase шалгалтаас хамаарна (myReview байгаа эсэхээс үл хамааран)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindFirst.mockResolvedValue({ id: 'oi-1' });
    mocks.reviewFindUnique.mockResolvedValue({ id: 'r-1', rating: 3 });
    const service = newService(prisma);

    const result = await service.getCustomerReviewContext('cust-1', 'p-1');

    expect(result.canReview).toBe(true);
    expect(result.myReview).toEqual({ id: 'r-1', rating: 3 });
  });

  it('худалдаж аваагүй бол canReview=false, myReview=null', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindFirst.mockResolvedValue(null);
    mocks.reviewFindUnique.mockResolvedValue(null);
    const service = newService(prisma);

    const result = await service.getCustomerReviewContext('cust-1', 'p-1');

    expect(result).toEqual({ canReview: false, myReview: null });
  });
});

describe('ReviewService — дундаж үнэлгээ тооцоолол (aggregate, денормалиц ХИЙХГҮЙ)', () => {
  it('findForProduct() Prisma aggregate _avg-аар averageRating-ийг тооцоолж буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.reviewFindMany.mockResolvedValue([{ id: 'r-1' }, { id: 'r-2' }]);
    mocks.reviewCount.mockResolvedValue(2);
    mocks.reviewAggregate.mockResolvedValue({ _avg: { rating: 4.5 } });
    const service = newService(prisma);

    const result = await service.findForProduct('p-1', {});

    expect(result.averageRating).toBe(4.5);
    expect(result.totalCount).toBe(2);
    expect(result.reviews).toHaveLength(2);
    expect(mocks.reviewAggregate).toHaveBeenCalledWith({
      where: { productId: 'p-1' },
      _avg: { rating: true },
    });
  });

  it('findForProduct() сэтгэгдэл байхгүй бол averageRating=0 (null-ийг эелдэгээр 0 болгоно)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.reviewFindMany.mockResolvedValue([]);
    mocks.reviewCount.mockResolvedValue(0);
    mocks.reviewAggregate.mockResolvedValue({ _avg: { rating: null } });
    const service = newService(prisma);

    const result = await service.findForProduct('p-1', {});

    expect(result.averageRating).toBe(0);
  });

  it('findForProduct() page/limit-ээр skip/take тооцоолно', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.reviewFindMany.mockResolvedValue([]);
    mocks.reviewCount.mockResolvedValue(0);
    mocks.reviewAggregate.mockResolvedValue({ _avg: { rating: null } });
    const service = newService(prisma);

    await service.findForProduct('p-1', { page: 3, limit: 10 });

    expect(mocks.reviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

describe('ReviewService — update()/remove() (RLS-ийн 0-мөр → 404 хөрвүүлэлт)', () => {
  it('update() P2025 (RLS-ээр харагдахгүй/олдоогүй мөр) NotFoundException болно', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.reviewUpdate.mockRejectedValue(knownRequestError('P2025'));
    const service = newService(prisma);

    await expect(service.update('r-1', { rating: 2 })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('remove() P2025 NotFoundException болно', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.reviewDelete.mockRejectedValue(knownRequestError('P2025'));
    const service = newService(prisma);

    await expect(service.remove('r-1')).rejects.toMatchObject({
      status: 404,
    });
  });
});
