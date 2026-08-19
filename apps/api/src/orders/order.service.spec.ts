import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderService } from './order.service.js';

function buildPrismaMock() {
  const orderFindUnique = jest.fn();
  const orderCreate = jest.fn();
  const orderUpdate = jest.fn();
  const orderItemCreateMany = jest.fn();
  const productVariantFindUnique = jest.fn();
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
