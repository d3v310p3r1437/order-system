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

function newService(
  prisma: unknown,
  paymentProvider = buildPaymentProviderMock(),
  orderEvents = buildOrderEventsPublisherMock(),
  routingProvider = buildRoutingProviderMock(),
  notificationTrigger = buildNotificationTriggerMock(),
) {
  return new OrderService(
    prisma as ConstructorParameters<typeof OrderService>[0],
    paymentProvider,
    routingProvider,
    orderEvents as ConstructorParameters<typeof OrderService>[3],
    notificationTrigger as ConstructorParameters<typeof OrderService>[4],
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
        items: [{ variantId: 'v-1', quantity: 2 }],
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
        items: [{ variantId: 'v-1', quantity: 2 }],
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
  it('вариант олдоогүй бол 400, ямар ч бичилт хийхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.productVariantFindUnique.mockResolvedValue(null);

    const service = newService(prisma);
    await expect(
      service.checkout('cust-1', {
        branchId: 'b-1',
        items: [{ variantId: 'v-1', quantity: 1 }],
      }),
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
      service.checkout('cust-1', {
        branchId: 'b-1',
        items: [{ variantId: 'v-1', quantity: 1 }],
      }),
    ).rejects.toThrow(ConflictException);

    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/^SAVEPOINT sp_\d+$/),
    );
    expect(mocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringMatching(/^ROLLBACK TO SAVEPOINT sp_\d+$/),
    );
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
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: 'o-1' },
      data: {
        routeDistanceMeters: 1500,
        routeDurationSeconds: 180,
        routeGeometry: [
          [106.917, 47.918],
          [106.93, 47.925],
        ],
      },
    });
    expect(result).toEqual({
      distanceMeters: 1500,
      durationSeconds: 180,
      geometry: [
        [106.917, 47.918],
        [106.93, 47.925],
      ],
    });
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
