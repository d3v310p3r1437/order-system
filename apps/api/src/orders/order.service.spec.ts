import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderService } from './order.service.js';

function buildPrismaMock() {
  const orderFindUnique = jest.fn();
  const orderCreate = jest.fn();
  const orderUpdate = jest.fn();
  const orderItemCreateMany = jest.fn();
  const productVariantFindUnique = jest.fn();
  const branchFindUnique = jest.fn();
  const userBranchRoleFindMany = jest.fn();
  const userFindUnique = jest.fn();
  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const executeRawUnsafe = jest.fn();

  const tx = {
    order: {
      findUnique: orderFindUnique,
      create: orderCreate,
      update: orderUpdate,
    },
    orderItem: { createMany: orderItemCreateMany },
    productVariant: { findUnique: productVariantFindUnique },
    branch: { findUnique: branchFindUnique },
    userBranchRole: { findMany: userBranchRoleFindMany },
    user: { findUnique: userFindUnique },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $executeRawUnsafe: executeRawUnsafe,
  };

  const prisma = {
    get tx() {
      return tx;
    },
  };

  return {
    prisma,
    mocks: {
      orderFindUnique,
      orderCreate,
      orderUpdate,
      orderItemCreateMany,
      productVariantFindUnique,
      branchFindUnique,
      userBranchRoleFindMany,
      userFindUnique,
      queryRaw,
      executeRaw,
      executeRawUnsafe,
    },
  };
}

function buildPaymentProviderMock() {
  return {
    createInvoice: jest.fn().mockResolvedValue({
      providerInvoiceId: 'mock_inv_1',
      payUrl: 'mock://pay/1',
    }),
    checkPayment: jest.fn(),
    refundPayment: jest.fn(),
  };
}

function buildOrderEventsPublisherMock() {
  return { publishOrderStatusChanged: jest.fn() };
}

function buildRoutingProviderMock() {
  return { getRoute: jest.fn() };
}

function buildNotificationTriggerMock() {
  return {
    notifyOrderStatusChanged: jest.fn().mockResolvedValue(undefined),
    notifyReturnStatusChanged: jest.fn().mockResolvedValue(undefined),
  };
}

function buildCartServiceMock(
  items: { variantId: string; quantity: number }[] = [
    { variantId: 'v-1', quantity: 1 },
  ],
) {
  return {
    listForCheckout: jest.fn().mockResolvedValue(items),
    clear: jest.fn().mockResolvedValue(undefined),
  };
}

function buildCouponServiceMock() {
  return {
    validateForCheckout: jest.fn(),
    redeemAtomic: jest.fn().mockResolvedValue(undefined),
  };
}

function buildMinioServiceMock() {
  return {
    getPublicUrl: jest.fn((objectKey: string) => `https://minio.local/bucket/${objectKey}`),
  };
}

function buildReviewServiceMock() {
  return { findManyForCustomer: jest.fn().mockResolvedValue(new Map()) };
}

function buildRequestContextMock(userId: string | null = null) {
  // Бодит RequestContextService.onCommit()-той адил: тест дотор ШУУД
  // (синхрон) дуудагдана — RlsMiddleware-ийн бодит "COMMIT-ийн дараа"
  // хойшлолт unit тестийн хамрах хүрээнд биш (order.service.spec.ts нь
  // OrderService-ийг ганцаараа, RlsMiddleware-гүй тестэлдэг). `get()` нь
  // `OrderService.findBranchForRoute()`-ийн userId-г л буцаана.
  return {
    onCommit: jest.fn((cb: () => void) => cb()),
    get: jest.fn(() => ({ userId })),
  };
}

function newService(
  prisma: unknown,
  paymentProvider = buildPaymentProviderMock(),
  orderEvents = buildOrderEventsPublisherMock(),
  routingProvider = buildRoutingProviderMock(),
  notificationTrigger = buildNotificationTriggerMock(),
  cartService = buildCartServiceMock(),
  requestContext = buildRequestContextMock(),
  couponService = buildCouponServiceMock(),
  minioService = buildMinioServiceMock(),
  reviewService = buildReviewServiceMock(),
) {
  return new OrderService(
    prisma as ConstructorParameters<typeof OrderService>[0],
    paymentProvider,
    routingProvider,
    orderEvents as ConstructorParameters<typeof OrderService>[3],
    notificationTrigger as ConstructorParameters<typeof OrderService>[4],
    cartService as ConstructorParameters<typeof OrderService>[5],
    requestContext as ConstructorParameters<typeof OrderService>[6],
    couponService as ConstructorParameters<typeof OrderService>[7],
    minioService as ConstructorParameters<typeof OrderService>[8],
    reviewService as ConstructorParameters<typeof OrderService>[9],
  );
}

describe('OrderService.updateStatus', () => {
  it('staff (BRANCH_MANAGER) зөвшөөрөгдөөгүй шилжилт (READY→CANCELLED) хийхийг оролдвол 400, ямар ч бичилт хийхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue({
      id: 'o-1',
      status: 'READY',
      customerId: 'cust-1',
      branchId: 'b-1',
      items: [],
    });
    mocks.userBranchRoleFindMany.mockResolvedValue([
      { role: 'BRANCH_MANAGER' },
    ]);

    const service = newService(prisma);
    await expect(
      service.updateStatus('o-1', 'staff-1', { status: 'CANCELLED' }),
    ).rejects.toThrow(BadRequestException);
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it('CUSTOMER өөр хэрэглэгчийн захиалгыг cancel хийхийг оролдвол 400', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue({
      id: 'o-1',
      status: 'CREATED',
      customerId: 'cust-OTHER',
      branchId: 'b-1',
      items: [],
    });
    mocks.userBranchRoleFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' });

    const service = newService(prisma);
    await expect(
      service.updateStatus('o-1', 'cust-1', { status: 'CANCELLED' }),
    ).rejects.toThrow(BadRequestException);
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
  });

  it('CUSTOMER CONFIRMED төлөвт байгаа ӨӨРИЙН захиалгаа cancel хийхийг оролдвол 400 (зөвхөн CREATED-ээс)', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue({
      id: 'o-1',
      status: 'CONFIRMED',
      customerId: 'cust-1',
      branchId: 'b-1',
      items: [],
    });
    mocks.userBranchRoleFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' });

    const service = newService(prisma);
    await expect(
      service.updateStatus('o-1', 'cust-1', { status: 'CANCELLED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('CUSTOMER ӨӨРИЙН CREATED захиалгаа cancel хийвэл SAVEPOINT ашиглаж нөөц буцаана, cancelledAt тавигдана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique
      .mockResolvedValueOnce({
        id: 'o-1',
        status: 'CREATED',
        customerId: 'cust-1',
        branchId: 'b-1',
        items: [
          {
            variantId: 'v-1',
            quantity: 2,
            variant: { productId: 'p-1', product: { images: [] } },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'o-1',
        status: 'CANCELLED',
        customerId: 'cust-1',
        branchId: 'b-1',
        items: [],
      });
    mocks.userBranchRoleFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' });
    mocks.queryRaw.mockResolvedValue([{ app_adjust_inventory_for_order: 1 }]);
    mocks.orderUpdate.mockResolvedValue({});

    const service = newService(prisma);
    await service.updateStatus('o-1', 'cust-1', { status: 'CANCELLED' });

    // common/savepoint.util.ts нь давхцалгүй нэр өгөхийн тулд тоолуур
    // залгадаг (sp_1, sp_2, ...) тул яг тоог биш хэв маягийг л шалгана.
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/^SAVEPOINT sp_\d+$/),
    );
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/^RELEASE SAVEPOINT sp_\d+$/),
    );
    const updateArgs = (mocks.orderUpdate.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      data: { status: string; completedAt?: Date; cancelledAt?: Date };
    };
    expect(updateArgs.where).toEqual({ id: 'o-1' });
    expect(updateArgs.data.status).toBe('CANCELLED');
    expect(updateArgs.data.completedAt).toBeUndefined();
    expect(updateArgs.data.cancelledAt).toBeInstanceOf(Date);
  });

  it('staff COMPLETED болгоход completedAt тавигдана, нөөц буцаахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique
      .mockResolvedValueOnce({
        id: 'o-1',
        status: 'READY',
        customerId: 'cust-1',
        branchId: 'b-1',
        items: [
          {
            variantId: 'v-1',
            quantity: 2,
            variant: { productId: 'p-1', product: { images: [] } },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'o-1',
        status: 'COMPLETED',
        customerId: 'cust-1',
        branchId: 'b-1',
        items: [],
      });
    mocks.userBranchRoleFindMany.mockResolvedValue([
      { role: 'BRANCH_MANAGER' },
    ]);
    mocks.orderUpdate.mockResolvedValue({});

    const service = newService(prisma);
    await service.updateStatus('o-1', 'staff-1', { status: 'COMPLETED' });

    expect(mocks.executeRaw).not.toHaveBeenCalled();
    const updateArgs = (mocks.orderUpdate.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      data: { status: string; completedAt?: Date; cancelledAt?: Date };
    };
    expect(updateArgs.where).toEqual({ id: 'o-1' });
    expect(updateArgs.data.status).toBe('COMPLETED');
    expect(updateArgs.data.completedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.cancelledAt).toBeUndefined();
  });
});

describe('OrderService.checkout', () => {
  it('сагс хоосон бол 400 CART_EMPTY, ямар ч бичилт хийхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const cartService = buildCartServiceMock([]);

    const service = newService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      cartService,
    );
    await expect(
      service.checkout('cust-1', { branchId: 'b-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('вариант олдоогүй бол 400, ямар ч бичилт хийхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productVariantFindUnique.mockResolvedValue(null);

    const service = newService(prisma);
    await expect(
      service.checkout('cust-1', { branchId: 'b-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('нөөц хүрэлцэхгүй (0 мөр өөрчлөгдсөн) бол SAVEPOINT руу rollback хийж 409 OUT_OF_STOCK шидэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productVariantFindUnique.mockResolvedValue({
      id: 'v-1',
      isActive: true,
      basePrice: new Prisma.Decimal(100),
    });
    mocks.queryRaw.mockResolvedValue([]);
    mocks.orderCreate.mockResolvedValue({ id: 'o-1' });
    mocks.orderItemCreateMany.mockResolvedValue({ count: 1 });

    const service = newService(prisma);
    await expect(
      service.checkout('cust-1', { branchId: 'b-1' }),
    ).rejects.toThrow(ConflictException);

    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/^SAVEPOINT sp_\d+$/),
    );
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/^ROLLBACK TO SAVEPOINT sp_\d+$/),
    );
  });

  it('амжилттай checkout нь item-үүдийг cart-аас уншиж, дараа нь сагсыг цэвэрлэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productVariantFindUnique.mockResolvedValue({
      id: 'v-1',
      isActive: true,
      basePrice: new Prisma.Decimal(100),
    });
    mocks.queryRaw.mockResolvedValue([{ app_adjust_inventory_for_order: 1 }]);
    mocks.orderCreate.mockResolvedValue({ id: 'o-1' });
    mocks.orderItemCreateMany.mockResolvedValue({ count: 1 });
    mocks.orderFindUnique.mockResolvedValue({
      id: 'o-1',
      status: 'CREATED',
      items: [],
    });

    const cartService = buildCartServiceMock([
      { variantId: 'v-1', quantity: 2 },
    ]);
    const requestContext = buildRequestContextMock();

    const service = newService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      cartService,
      requestContext,
    );
    const result = await service.checkout('cust-1', { branchId: 'b-1' });

    expect(cartService.listForCheckout).toHaveBeenCalledWith('cust-1');
    expect(requestContext.onCommit).toHaveBeenCalledTimes(1);
    expect(cartService.clear).toHaveBeenCalledWith('cust-1');
    expect(result).toMatchObject({
      payUrl: 'mock://pay/1',
      qrText: undefined,
      bankDeeplinks: [],
    });
  });
});

describe('OrderService.getRoute', () => {
  function deliveryOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 'o-1',
      branchId: 'b-1',
      deliveryMethod: 'DELIVERY',
      deliveryLatitude: 47.925,
      deliveryLongitude: 106.93,
      routeDistanceMeters: null,
      routeDurationSeconds: null,
      routeGeometry: null,
      items: [],
      ...overrides,
    };
  }

  it('кэш хоосон бол RoutingProvider дуудаж, үр дүнг Order мөр дээр бичээд буцаана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(deliveryOrder());
    mocks.branchFindUnique.mockResolvedValue({
      id: 'b-1',
      latitude: 47.918,
      longitude: 106.917,
    });
    mocks.orderUpdate.mockResolvedValue({});

    const routingProvider = buildRoutingProviderMock();
    routingProvider.getRoute.mockResolvedValue({
      distanceMeters: 1500,
      durationSeconds: 180,
      geometry: [
        [106.917, 47.918],
        [106.93, 47.925],
      ],
    });

    const service = newService(prisma, undefined, undefined, routingProvider);
    const result = await service.getRoute('o-1');

    expect(routingProvider.getRoute).toHaveBeenCalledTimes(1);
    expect(routingProvider.getRoute).toHaveBeenCalledWith(
      { lat: 47.918, lng: 106.917 },
      { lat: 47.925, lng: 106.93 },
    );
    // (2026-08-20) кэш-бичилт `tx.order.update()` БИШ, `app_cache_order_route()`
    // WRITE SECURITY DEFINER функцээр (orders_update-ийн WITH CHECK
    // CUSTOMER-д хамааралгүй тул) хийгддэг болсон.
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    const call = mocks.executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
      number,
      number,
      string,
    ];
    const [strings, orderIdArg, distanceArg, durationArg, geometryArg] = call;
    expect(strings.join('?')).toContain('app_cache_order_route');
    expect(orderIdArg).toBe('o-1');
    expect(distanceArg).toBe(1500);
    expect(durationArg).toBe(180);
    expect(JSON.parse(geometryArg)).toEqual([
      [106.917, 47.918],
      [106.93, 47.925],
    ]);
    expect(result).toEqual({
      distanceMeters: 1500,
      durationSeconds: 180,
      geometry: [
        [106.917, 47.918],
        [106.93, 47.925],
      ],
    });
  });

  it('CUSTOMER дуудвал branches_select RLS-ийг (tx.branch.findUnique) БИШ, app_public_branches()-ийг ашиглана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(deliveryOrder());
    // 1-р queryRaw дуудлага app_public_branches(), 2-р нь байхгүй (getRoute
    // дотор өөр queryRaw байхгүй) — branch байршлыг буцаана.
    mocks.queryRaw.mockResolvedValue([
      { latitude: 47.918, longitude: 106.917 },
    ]);
    mocks.userBranchRoleFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({ authProvider: 'CUSTOMER_AUTH' });

    const routingProvider = buildRoutingProviderMock();
    routingProvider.getRoute.mockResolvedValue({
      distanceMeters: 1500,
      durationSeconds: 180,
      geometry: [
        [106.917, 47.918],
        [106.93, 47.925],
      ],
    });
    const requestContext = buildRequestContextMock('cust-1');

    const service = newService(
      prisma,
      undefined,
      undefined,
      routingProvider,
      undefined,
      undefined,
      requestContext,
    );
    await service.getRoute('o-1');

    expect(mocks.branchFindUnique).not.toHaveBeenCalled();
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    const [strings, branchIdArg] = mocks.queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(strings.join('?')).toContain('app_public_branches');
    expect(branchIdArg).toBe('b-1');
  });

  it('кэш аль хэдийн бөглөгдсөн бол RoutingProvider огт дуудахгүй, Order мөр дээр ч бичихгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(
      deliveryOrder({
        routeDistanceMeters: 1500,
        routeDurationSeconds: 180,
        routeGeometry: [
          [106.917, 47.918],
          [106.93, 47.925],
        ],
      }),
    );

    const routingProvider = buildRoutingProviderMock();

    const service = newService(prisma, undefined, undefined, routingProvider);
    const result = await service.getRoute('o-1');

    expect(routingProvider.getRoute).not.toHaveBeenCalled();
    expect(mocks.branchFindUnique).not.toHaveBeenCalled();
    expect(mocks.orderUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      distanceMeters: 1500,
      durationSeconds: 180,
      geometry: [
        [106.917, 47.918],
        [106.93, 47.925],
      ],
    });
  });

  it('PICKUP захиалгад 400 NOT_DELIVERY_ORDER, RoutingProvider огт дуудахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(
      deliveryOrder({ deliveryMethod: 'PICKUP' }),
    );
    const routingProvider = buildRoutingProviderMock();

    const service = newService(prisma, undefined, undefined, routingProvider);

    await expect(service.getRoute('o-1')).rejects.toThrow(BadRequestException);
    expect(routingProvider.getRoute).not.toHaveBeenCalled();
  });
});

// (2026-08-26) §7 модуль #6-ийн "Захиалгын түүх → Сэтгэгдэл" даалгавар:
// OrderService.hydrateOrder() (findOne()/findAll() хоёуланд дахин
// ашиглагдана) productImageUrl/myReview-г зөв тооцоолж байгааг шалгана.
describe('OrderService hydration (productImageUrl / myReview)', () => {
  function orderWithItem(
    status: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 'o-1',
      status,
      customerId: 'cust-1',
      branchId: 'b-1',
      items: [
        {
          id: 'oi-1',
          variantId: 'v-1',
          quantity: 1,
          variant: {
            productId: 'p-1',
            product: { images: [{ objectKey: 'products/p-1/a.jpg' }] },
          },
        },
      ],
      ...overrides,
    };
  }

  it('COMPLETED захиалгад ReviewService.findManyForCustomer-аас олдсон review-г myReview-д залгана, productImageUrl зөв тооцоологдоно', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(orderWithItem('COMPLETED'));
    const review = { id: 'r-1', productId: 'p-1', rating: 5 };
    const reviewService = buildReviewServiceMock();
    reviewService.findManyForCustomer.mockResolvedValue(
      new Map([['p-1', review]]),
    );
    const minioService = buildMinioServiceMock();

    const service = newService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      minioService,
      reviewService,
    );
    const order = await service.findOne('o-1');

    expect(reviewService.findManyForCustomer).toHaveBeenCalledWith('cust-1', [
      'p-1',
    ]);
    expect(minioService.getPublicUrl).toHaveBeenCalledWith(
      'products/p-1/a.jpg',
    );
    expect(order.items[0].myReview).toEqual(review);
    expect(order.items[0].productImageUrl).toBe(
      'https://minio.local/bucket/products/p-1/a.jpg',
    );
    expect(mocks.orderFindUnique).toHaveBeenCalledTimes(1);
  });

  it('идэвхтэй (COMPLETED биш) захиалгад myReview үргэлж null, ReviewService огт дуудагдахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(orderWithItem('CONFIRMED'));
    const reviewService = buildReviewServiceMock();

    const service = newService(
      prisma,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      reviewService,
    );
    const order = await service.findOne('o-1');

    expect(reviewService.findManyForCustomer).not.toHaveBeenCalled();
    expect(order.items[0].myReview).toBeNull();
  });

  it('зурагтгүй бүтээгдэхүүнд productImageUrl null', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(
      orderWithItem('CREATED', {
        items: [
          {
            id: 'oi-1',
            variantId: 'v-1',
            quantity: 1,
            variant: { productId: 'p-1', product: { images: [] } },
          },
        ],
      }),
    );

    const service = newService(prisma);
    const order = await service.findOne('o-1');

    expect(order.items[0].productImageUrl).toBeNull();
  });
});
