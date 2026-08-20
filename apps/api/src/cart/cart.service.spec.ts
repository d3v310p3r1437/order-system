import { Prisma } from '@prisma/client';
import { CartService } from './cart.service.js';

function buildRedisMock() {
  const store = new Map<string, string>();
  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    // тестэд шууд store-той ажиллаж эхлэл нөхцөл бэлдэхэд ашиглана.
    __store: store,
  };
}

function buildPrismaMock() {
  const variantFindMany = jest.fn();
  const queryRaw = jest.fn().mockResolvedValue([]);
  const tx = {
    productVariant: { findMany: variantFindMany },
    $queryRaw: queryRaw,
  };
  return {
    prisma: {
      get tx() {
        return tx;
      },
    },
    mocks: { variantFindMany, queryRaw },
  };
}

function buildMinioMock() {
  return {
    getPublicUrl: jest.fn(
      (key: string) => `http://minio.local/product-images/${key}`,
    ),
  };
}

function newService(
  redis = buildRedisMock(),
  prismaBundle = buildPrismaMock(),
  minio = buildMinioMock(),
) {
  const service = new CartService(
    redis as unknown as ConstructorParameters<typeof CartService>[0],
    prismaBundle.prisma as unknown as ConstructorParameters<
      typeof CartService
    >[1],
    minio as unknown as ConstructorParameters<typeof CartService>[2],
  );
  return { service, redis, prismaMocks: prismaBundle.mocks, minio };
}

const USER_ID = 'user-1';

function buildVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'variant-1',
    sku: 'sku-1',
    unit: 'ширхэг',
    isActive: true,
    basePrice: new Prisma.Decimal(10000),
    product: {
      id: 'product-1',
      name: 'Тест бүтээгдэхүүн',
      isActive: true,
      images: [{ objectKey: 'products/product-1/img.jpg' }],
    },
    ...overrides,
  };
}

describe('CartService — Redis-д суурилсан сагс (§7 модуль #5)', () => {
  it('addOrUpdateItem() шинэ variant-ыг сагсанд нэмж, 30 хоногийн TTL-тэй бичнэ', async () => {
    const { service, redis } = newService();

    await service.addOrUpdateItem(USER_ID, 'variant-1', 2);

    expect(redis.set).toHaveBeenCalledWith(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 2 }]),
      'EX',
      30 * 24 * 60 * 60,
    );
  });

  it('addOrUpdateItem() аль хэдийн байгаа variant-ыг НЭМЭХГҮЙ, quantity-г шинэ утгаар СОЛИНО (upsert-set, delta биш)', async () => {
    const { service, redis } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 2 }]),
    );

    await service.addOrUpdateItem(USER_ID, 'variant-1', 5);

    expect(redis.set).toHaveBeenCalledWith(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 5 }]),
      'EX',
      30 * 24 * 60 * 60,
    );
  });

  it('removeItem() сагсны сүүлийн зүйлийг устгавал set() биш, redis.del()-ийг дуудна', async () => {
    const { service, redis } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 2 }]),
    );

    await service.removeItem(USER_ID, 'variant-1');

    expect(redis.del).toHaveBeenCalledWith('cart:user-1');
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('removeItem() бусад зүйл үлдвэл set()-ээр л дахин бичнэ', async () => {
    const { service, redis } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([
        { variantId: 'variant-1', quantity: 2 },
        { variantId: 'variant-2', quantity: 1 },
      ]),
    );

    await service.removeItem(USER_ID, 'variant-1');

    expect(redis.set).toHaveBeenCalledWith(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-2', quantity: 1 }]),
      'EX',
      30 * 24 * 60 * 60,
    );
  });

  it('clear() redis.del()-ийг дуудна', async () => {
    const { service, redis } = newService();
    await service.clear(USER_ID);
    expect(redis.del).toHaveBeenCalledWith('cart:user-1');
  });

  it('listForCheckout() Redis-д хадгалагдсан variantId/quantity-г түүхий хэвээр (нэмэлт баганагүйгээр) буцаана — OrderService.checkout()-ийн цорын ганц эх сурвалж', async () => {
    const { service, redis } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([{ variantId: 'v-1', quantity: 3 }]),
    );
    await expect(service.listForCheckout(USER_ID)).resolves.toEqual([
      { variantId: 'v-1', quantity: 3 },
    ]);
  });

  it('getCart() устсан/idle variant-ыг unavailable:true гэж тэмдэглэж, алдаа шидэхгүй', async () => {
    const { service, redis, prismaMocks } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([
        { variantId: 'variant-1', quantity: 2 },
        { variantId: 'variant-missing', quantity: 1 },
      ]),
    );
    prismaMocks.variantFindMany.mockResolvedValue([buildVariant()]);

    const cart = await service.getCart(USER_ID);

    expect(cart).toEqual([
      {
        variantId: 'variant-1',
        quantity: 2,
        unavailable: false,
        productId: 'product-1',
        productName: 'Тест бүтээгдэхүүн',
        imageUrl:
          'http://minio.local/product-images/products/product-1/img.jpg',
        sku: 'sku-1',
        unit: 'ширхэг',
        basePrice: new Prisma.Decimal(10000),
      },
      { variantId: 'variant-missing', quantity: 1, unavailable: true },
    ]);
  });

  it('getCart() idle (isActive=false) variant-ыг ч unavailable гэж үзнэ', async () => {
    const { service, redis, prismaMocks } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 1 }]),
    );
    prismaMocks.variantFindMany.mockResolvedValue([
      buildVariant({ isActive: false }),
    ]);

    const cart = await service.getCart(USER_ID);

    expect(cart).toEqual([
      { variantId: 'variant-1', quantity: 1, unavailable: true },
    ]);
  });

  it('validateBranch() бүгд бэлэн (IN_STOCK) үед available:true, нийт дүн зөв тооцогдоно', async () => {
    const { service, redis, prismaMocks } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 3 }]),
    );
    prismaMocks.variantFindMany.mockResolvedValue([buildVariant()]);
    prismaMocks.queryRaw.mockResolvedValue([
      {
        branchId: 'branch-1',
        quantity: 10,
        branchPrice: '9000',
        preOrderEnabledOverride: null,
        preOrderLeadDaysOverride: null,
      },
    ]);

    const result = await service.validateBranch(USER_ID, 'branch-1');

    expect(result.items).toEqual([
      {
        variantId: 'variant-1',
        quantity: 3,
        productName: 'Тест бүтээгдэхүүн',
        available: true,
        status: 'IN_STOCK',
        effectivePrice: new Prisma.Decimal(9000),
        leadDays: null,
      },
    ]);
    expect(result.totalAmount.toNumber()).toBe(9000 * 3);
  });

  it('validateBranch() нөөц дууссан (OUT_OF_STOCK, pre-order идэвхгүй) variant-ыг нийт дүнд оруулахгүй', async () => {
    const { service, redis, prismaMocks } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 2 }]),
    );
    prismaMocks.variantFindMany.mockResolvedValue([
      buildVariant({ defaultPreOrderEnabled: false }),
    ]);
    prismaMocks.queryRaw.mockResolvedValue([
      {
        branchId: 'branch-1',
        quantity: 0,
        branchPrice: null,
        preOrderEnabledOverride: null,
        preOrderLeadDaysOverride: null,
      },
    ]);

    const result = await service.validateBranch(USER_ID, 'branch-1');

    expect(result.items).toEqual([
      {
        variantId: 'variant-1',
        quantity: 2,
        productName: 'Тест бүтээгдэхүүн',
        available: false,
        status: 'OUT_OF_STOCK',
        effectivePrice: null,
        leadDays: null,
      },
    ]);
    expect(result.totalAmount.toNumber()).toBe(0);
  });

  it('validateBranch() PRE_ORDER variant-ыг available:true, leadDays-тай гэж тэмдэглэнэ', async () => {
    const { service, redis, prismaMocks } = newService();
    redis.__store.set(
      'cart:user-1',
      JSON.stringify([{ variantId: 'variant-1', quantity: 1 }]),
    );
    prismaMocks.variantFindMany.mockResolvedValue([
      buildVariant({
        defaultPreOrderEnabled: true,
        defaultPreOrderLeadDays: 7,
      }),
    ]);
    prismaMocks.queryRaw.mockResolvedValue([
      {
        branchId: 'branch-1',
        quantity: 0,
        branchPrice: null,
        preOrderEnabledOverride: null,
        preOrderLeadDaysOverride: null,
      },
    ]);

    const result = await service.validateBranch(USER_ID, 'branch-1');

    expect(result.items[0]).toEqual({
      variantId: 'variant-1',
      quantity: 1,
      productName: 'Тест бүтээгдэхүүн',
      available: true,
      status: 'PRE_ORDER',
      effectivePrice: new Prisma.Decimal(10000),
      leadDays: 7,
    });
    expect(result.totalAmount.toNumber()).toBe(10000);
  });
});
