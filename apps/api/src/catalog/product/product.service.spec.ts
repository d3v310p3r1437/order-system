import { ProductService } from './product.service.js';

function buildPrismaMock() {
  const productFindUnique = jest.fn();
  const productFindMany = jest.fn();
  const productCreate = jest.fn();
  const productUpdate = jest.fn();
  const productDelete = jest.fn();
  const categoryFindUnique = jest.fn();
  const queryRaw = jest.fn().mockResolvedValue([]);

  const tx = {
    product: {
      findUnique: productFindUnique,
      findMany: productFindMany,
      create: productCreate,
      update: productUpdate,
      delete: productDelete,
    },
    category: { findUnique: categoryFindUnique },
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
      productFindUnique,
      productFindMany,
      productCreate,
      productUpdate,
      productDelete,
      categoryFindUnique,
      queryRaw,
    },
  };
}

function buildSearchIndexerMock() {
  return {
    indexProduct: jest.fn(),
    deleteProduct: jest.fn(),
    reindexAll: jest.fn(),
  };
}

function buildMinioMock() {
  return {
    getPublicUrl: jest.fn(
      (key: string) => `http://minio.local/product-images/${key}`,
    ),
  };
}

function buildReviewServiceMock() {
  return {
    getCustomerReviewContext: jest
      .fn()
      .mockResolvedValue({ canReview: false, myReview: null }),
  };
}

function newService(
  prisma: unknown,
  searchIndexer = buildSearchIndexerMock(),
  minio = buildMinioMock(),
  reviewService = buildReviewServiceMock(),
) {
  return {
    service: new ProductService(
      prisma as ConstructorParameters<typeof ProductService>[0],
      searchIndexer as ConstructorParameters<typeof ProductService>[1],
      minio as ConstructorParameters<typeof ProductService>[2],
      reviewService as ConstructorParameters<typeof ProductService>[3],
    ),
    searchIndexer,
    minio,
    reviewService,
  };
}

describe('ProductService — Meilisearch индексжилт (§8 Phase 2 Хэсэг B)', () => {
  it('create() амжилттай бол category+variants-тай хамт дахин уншиж searchIndexer.indexProduct()-г дуудна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productCreate.mockResolvedValue({
      id: 'p-1',
      name: 'Ноолуур цамц',
      description: null,
      brand: 'Gobi',
      categoryId: 'c-1',
      isActive: true,
    });
    mocks.productFindUnique.mockResolvedValue({
      id: 'p-1',
      name: 'Ноолуур цамц',
      description: null,
      brand: 'Gobi',
      categoryId: 'c-1',
      isActive: true,
      category: { id: 'c-1', name: 'Цамц' },
      // Давхардсан/null-той variant-уудаар colors/sizes-ийн ДАВХАРДААГҮЙ,
      // эрэмбэлэгдсэн денормалчлалыг шалгана.
      variants: [
        { color: 'хөх', size: 'M' },
        { color: 'улаан', size: 'M' },
        { color: 'улаан', size: null },
      ],
    });
    const { service, searchIndexer } = newService(prisma);

    await service.create({
      name: 'Ноолуур цамц',
      slug: 'noolluur-tsamts',
      brand: 'Gobi',
      categoryId: 'c-1',
    });

    expect(searchIndexer.indexProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p-1',
        name: 'Ноолуур цамц',
        categoryId: 'c-1',
        categoryName: 'Цамц',
        isActive: true,
        colors: ['улаан', 'хөх'],
        sizes: ['M'],
      }),
    );
  });

  it('update() амжилттай бол шинэчлэгдсэн categoryId+variants-аар searchIndexer.indexProduct()-г дуудна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productUpdate.mockResolvedValue({
      id: 'p-1',
      name: 'Ноолуур цамц',
      description: null,
      brand: 'Gobi',
      categoryId: 'c-2',
      isActive: true,
    });
    mocks.productFindUnique.mockResolvedValue({
      id: 'p-1',
      name: 'Ноолуур цамц',
      description: null,
      brand: 'Gobi',
      categoryId: 'c-2',
      isActive: true,
      category: { id: 'c-2', name: 'Гадуур хувцас' },
      variants: [],
    });
    const { service, searchIndexer } = newService(prisma);

    await service.update('p-1', { categoryId: 'c-2' });

    expect(searchIndexer.indexProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'c-2',
        categoryName: 'Гадуур хувцас',
        colors: [],
        sizes: [],
      }),
    );
  });

  it('reindexProduct() Product мөр байхгүй бол searchIndexer-г дуудахгүй чимээгүй буцна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productFindUnique.mockResolvedValue(null);
    const { service, searchIndexer } = newService(prisma);

    await service.reindexProduct('p-missing');

    expect(searchIndexer.indexProduct).not.toHaveBeenCalled();
  });

  it('remove() амжилттай бол searchIndexer.deleteProduct()-г дуудна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productDelete.mockResolvedValue({ id: 'p-1' });
    const { service, searchIndexer } = newService(prisma);

    await service.remove('p-1');

    expect(searchIndexer.deleteProduct).toHaveBeenCalledWith('p-1');
  });

  it('reindexAll() бүх Product-ыг category нэртэй нь дахин индекслэж, тоог буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productFindMany.mockResolvedValue([
      {
        id: 'p-1',
        name: 'A',
        description: null,
        brand: null,
        categoryId: 'c-1',
        isActive: true,
        category: { id: 'c-1', name: 'Цамц' },
        variants: [],
      },
      {
        id: 'p-2',
        name: 'B',
        description: null,
        brand: null,
        categoryId: 'c-2',
        isActive: false,
        category: { id: 'c-2', name: 'Өмд' },
        variants: [],
      },
    ]);
    const { service, searchIndexer } = newService(prisma);

    const count = await service.reindexAll();

    expect(count).toBe(2);
    expect(searchIndexer.reindexAll).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'p-1', categoryName: 'Цамц' }),
      expect.objectContaining({ id: 'p-2', categoryName: 'Өмд' }),
    ]);
  });
});

describe('ProductService — сэтгэгдэл/үнэлгээ нэгтгэл (§7 модуль #11)', () => {
  it('customerId өгөгдөөгүй бол ReviewService огт дуудагдахгүй, canReview/myReview хариунд ороогүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productFindUnique.mockResolvedValue({
      id: 'p-1',
      name: 'A',
      variants: [],
      images: [],
    });
    const { service, reviewService } = newService(prisma);

    const result = await service.findOne('p-1');

    expect(reviewService.getCustomerReviewContext).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('canReview');
    expect(result).not.toHaveProperty('myReview');
  });

  it('customerId өгөгдвөл ReviewService.getCustomerReviewContext()-ийн үр дүнг хариунд нэгтгэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productFindUnique.mockResolvedValue({
      id: 'p-1',
      name: 'A',
      variants: [],
      images: [],
    });
    const { service, reviewService } = newService(prisma);
    reviewService.getCustomerReviewContext.mockResolvedValue({
      canReview: true,
      myReview: { id: 'r-1', rating: 5 },
    });

    const result = await service.findOne('p-1', undefined, 'cust-1');

    expect(reviewService.getCustomerReviewContext).toHaveBeenCalledWith(
      'cust-1',
      'p-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        canReview: true,
        myReview: { id: 'r-1', rating: 5 },
      }),
    );
  });
});

describe('ProductService — зурагтай hydrate (§8 Phase 2 Хэсэг A)', () => {
  it('findOne() ProductImage мөр бүрт MinioService.getPublicUrl()-ээр public URL нэмнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productFindUnique.mockResolvedValue({
      id: 'p-1',
      name: 'A',
      variants: [],
      images: [
        {
          id: 'img-1',
          productId: 'p-1',
          objectKey: 'products/p-1/a.jpg',
          displayOrder: 0,
          altText: null,
        },
      ],
    });
    const { service, minio } = newService(prisma);

    const result = await service.findOne('p-1');

    expect(minio.getPublicUrl).toHaveBeenCalledWith('products/p-1/a.jpg');
    expect(result.images[0]).toEqual(
      expect.objectContaining({
        id: 'img-1',
        url: 'http://minio.local/product-images/products/p-1/a.jpg',
      }),
    );
  });

  it('findManyWithAvailability() Meilisearch-ийн эрэмбийг (id жагсаалт) хадгална', async () => {
    const { prisma, mocks } = buildPrismaMock();
    // Prisma findMany нь query-д заасан дарааллыг баталгаажуулдаггүй тул
    // "буруу" эрэмбээр буцаана — service нь дахин id-аар эрэмбэлэх ёстой.
    mocks.productFindMany.mockResolvedValue([
      { id: 'p-2', name: 'B', variants: [], images: [] },
      { id: 'p-1', name: 'A', variants: [], images: [] },
    ]);
    const { service } = newService(prisma);

    const result = await service.findManyWithAvailability(['p-1', 'p-2']);

    expect(result.map((p) => p.id)).toEqual(['p-1', 'p-2']);
  });

  it('findManyWithAvailability() ids хоосон бол Prisma-г огт дуудахгүй, хоосон массив буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const { service } = newService(prisma);

    const result = await service.findManyWithAvailability([]);

    expect(result).toEqual([]);
    expect(mocks.productFindMany).not.toHaveBeenCalled();
  });
});
