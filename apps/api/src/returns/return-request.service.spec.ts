import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReturnRequestService } from './return-request.service.js';

function buildPrismaMock() {
  const orderItemFindUnique = jest.fn();
  const returnRequestFindFirst = jest.fn();
  const returnRequestCreate = jest.fn();
  const returnRequestFindUnique = jest.fn();
  const returnRequestUpdate = jest.fn();
  // Атомик "claim" (approve()-ийн race-condition хамгаалалт) — анхдагчаар
  // амжилттай (1 мөр эзэмшсэн) гэж тооцно, тест бүрт шаардлагатай бол
  // дахин mockResolvedValue хийж {count: 0} болгож болно.
  const returnRequestUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const queryRaw = jest
    .fn()
    .mockResolvedValue([{ app_adjust_inventory_for_order: 1 }]);
  const executeRawUnsafe = jest.fn().mockResolvedValue(undefined);

  const tx = {
    orderItem: { findUnique: orderItemFindUnique },
    returnRequest: {
      findFirst: returnRequestFindFirst,
      create: returnRequestCreate,
      findUnique: returnRequestFindUnique,
      update: returnRequestUpdate,
      updateMany: returnRequestUpdateMany,
    },
    $queryRaw: queryRaw,
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
      orderItemFindUnique,
      returnRequestFindFirst,
      returnRequestCreate,
      returnRequestFindUnique,
      returnRequestUpdate,
      returnRequestUpdateMany,
      queryRaw,
      executeRawUnsafe,
    },
  };
}

function buildSettingsMock(feePercent = 10) {
  return {
    getReturnFeePercent: jest
      .fn()
      .mockResolvedValue(new Prisma.Decimal(feePercent)),
  };
}

function buildPaymentProviderMock() {
  return {
    createInvoice: jest.fn(),
    checkPayment: jest.fn(),
    refundPayment: jest.fn(),
  };
}

function buildOrderEventsMock() {
  return { publishReturnStatusChanged: jest.fn() };
}

function buildNotificationTriggerMock() {
  return { notifyReturnStatusChanged: jest.fn().mockResolvedValue(undefined) };
}

function newService(
  prisma: unknown,
  settings = buildSettingsMock(),
  paymentProvider = buildPaymentProviderMock(),
  orderEvents = buildOrderEventsMock(),
  notificationTrigger = buildNotificationTriggerMock(),
) {
  return new ReturnRequestService(
    prisma as ConstructorParameters<typeof ReturnRequestService>[0],
    settings as ConstructorParameters<typeof ReturnRequestService>[1],
    paymentProvider,
    orderEvents as ConstructorParameters<typeof ReturnRequestService>[3],
    notificationTrigger as ConstructorParameters<
      typeof ReturnRequestService
    >[4],
  );
}

const NOW = new Date('2026-08-17T00:00:00.000Z');

function completedOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'oi-1',
    orderId: 'o-1',
    variantId: 'v-1',
    quantity: 2,
    unitPriceSnapshot: new Prisma.Decimal(10000),
    order: {
      id: 'o-1',
      status: 'COMPLETED',
      completedAt: new Date('2026-08-15T00:00:00.000Z'),
      branchId: 'b-1',
      customerId: 'cust-1',
      providerInvoiceId: 'mock_inv_1',
    },
    ...overrides,
  };
}

describe('ReturnRequestService.create', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('захиалга COMPLETED биш бол BadRequestException шидэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindUnique.mockResolvedValue(
      completedOrderItem({ order: { status: 'CREATED', completedAt: null } }),
    );

    const service = newService(prisma);
    await expect(
      service.create('cust-1', { orderItemId: 'oi-1', reason: 'эвдэрсэн' }),
    ).rejects.toThrow(BadRequestException);
    expect(mocks.returnRequestCreate).not.toHaveBeenCalled();
  });

  it('7 хоногийн хугацаа хэтэрсэн бол BadRequestException шидэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindUnique.mockResolvedValue(
      completedOrderItem({
        order: {
          status: 'COMPLETED',
          completedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      }),
    );

    const service = newService(prisma);
    await expect(
      service.create('cust-1', { orderItemId: 'oi-1', reason: 'эвдэрсэн' }),
    ).rejects.toThrow(BadRequestException);
    expect(mocks.returnRequestCreate).not.toHaveBeenCalled();
  });

  it('идэвхтэй (REQUESTED/APPROVED) буцаалт аль хэдийн байвал ConflictException шидэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindUnique.mockResolvedValue(completedOrderItem());
    mocks.returnRequestFindFirst.mockResolvedValue({ id: 'rr-existing' });

    const service = newService(prisma);
    await expect(
      service.create('cust-1', { orderItemId: 'oi-1', reason: 'эвдэрсэн' }),
    ).rejects.toThrow(ConflictException);
    expect(mocks.returnRequestCreate).not.toHaveBeenCalled();
  });

  it('хүчинтэй хүсэлт бол returnRequest.create дуудна', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderItemFindUnique.mockResolvedValue(completedOrderItem());
    mocks.returnRequestFindFirst.mockResolvedValue(null);
    mocks.returnRequestCreate.mockResolvedValue({ id: 'rr-1' });

    const service = newService(prisma);
    await service.create('cust-1', { orderItemId: 'oi-1', reason: 'эвдэрсэн' });

    expect(mocks.returnRequestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          orderItemId: 'oi-1',
          requestedByUserId: 'cust-1',
          reason: 'эвдэрсэн',
        },
      }),
    );
  });
});

describe('ReturnRequestService.approve', () => {
  it('refund амжилттай бол claim хийж (updateMany), REFUNDED болгож, нөөц буцааж, event нийтэлнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const orderItem = completedOrderItem();
    mocks.returnRequestFindUnique
      .mockResolvedValueOnce({ id: 'rr-1', status: 'REQUESTED', orderItem })
      .mockResolvedValueOnce({ id: 'rr-1', status: 'REFUNDED', orderItem });
    mocks.returnRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.returnRequestUpdate.mockResolvedValue({});

    const paymentProvider = buildPaymentProviderMock();
    paymentProvider.refundPayment.mockResolvedValue({
      providerRefundId: 'mock_refund_1',
    });
    const orderEvents = buildOrderEventsMock();

    const service = newService(
      prisma,
      buildSettingsMock(10),
      paymentProvider,
      orderEvents,
    );
    const result = await service.approve('rr-1', 'staff-1');

    const claimArgs = (
      mocks.returnRequestUpdateMany.mock.calls[0] as unknown[]
    )[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(claimArgs.where).toEqual({
      id: 'rr-1',
      status: { in: ['REQUESTED', 'REFUND_FAILED'] },
    });
    expect(claimArgs.data.status).toBe('APPROVED');
    // claim (updateMany) refundPayment()-ээс ӨМНӨ дуудагдсан эсэхийг
    // дуудлагын дараалал (mock.invocationCallOrder)-аар шалгана —
    // энэ бол race-ийн засварын гол цөм (davhar refund-оос сэргийлэх).
    expect(
      mocks.returnRequestUpdateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(paymentProvider.refundPayment.mock.invocationCallOrder[0]);

    expect(paymentProvider.refundPayment).toHaveBeenCalledWith(
      'mock_inv_1',
      18000,
    );
    const updateArgs = (
      mocks.returnRequestUpdate.mock.calls[0] as unknown[]
    )[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.status).toBe('REFUNDED');
    expect(updateArgs.data.providerRefundId).toBe('mock_refund_1');
    expect(mocks.queryRaw).toHaveBeenCalled();
    expect(orderEvents.publishReturnStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ returnRequestId: 'rr-1', status: 'REFUNDED' }),
    );
    expect(result.status).toBe('REFUNDED');
  });

  it('refund амжилтгүй бол REFUND_FAILED болгож, нөөц буцаахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const orderItem = completedOrderItem();
    mocks.returnRequestFindUnique
      .mockResolvedValueOnce({ id: 'rr-1', status: 'REQUESTED', orderItem })
      .mockResolvedValueOnce({
        id: 'rr-1',
        status: 'REFUND_FAILED',
        orderItem,
      });
    mocks.returnRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.returnRequestUpdate.mockResolvedValue({});

    const paymentProvider = buildPaymentProviderMock();
    paymentProvider.refundPayment.mockRejectedValue(new Error('provider boom'));
    const orderEvents = buildOrderEventsMock();

    const service = newService(
      prisma,
      buildSettingsMock(10),
      paymentProvider,
      orderEvents,
    );
    const result = await service.approve('rr-1', 'staff-1');

    const updateArgs = (
      mocks.returnRequestUpdate.mock.calls[0] as unknown[]
    )[0] as {
      data: Record<string, unknown>;
    };
    expect(updateArgs.data.status).toBe('REFUND_FAILED');
    expect(updateArgs.data.refundedAt).toBeNull();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(result.status).toBe('REFUND_FAILED');
  });

  it('REFUND_FAILED-ээс дахин дуудвал (гараар дахин оролдох) зөвшөөрнө', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const orderItem = completedOrderItem();
    mocks.returnRequestFindUnique
      .mockResolvedValueOnce({ id: 'rr-1', status: 'REFUND_FAILED', orderItem })
      .mockResolvedValueOnce({ id: 'rr-1', status: 'REFUNDED', orderItem });
    mocks.returnRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.returnRequestUpdate.mockResolvedValue({});

    const paymentProvider = buildPaymentProviderMock();
    paymentProvider.refundPayment.mockResolvedValue({
      providerRefundId: 'mock_refund_retry',
    });

    const service = newService(prisma, buildSettingsMock(10), paymentProvider);
    const result = await service.approve('rr-1', 'staff-1');

    expect(result.status).toBe('REFUNDED');
    expect(mocks.queryRaw).toHaveBeenCalled();
  });

  it('аль хэдийн шийдвэрлэгдсэн (claim 0 мөр өөрчилсөн) бол ConflictException шидэж, PaymentProvider-ийг ОГТ дуудахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.returnRequestFindUnique.mockResolvedValue({
      id: 'rr-1',
      status: 'REFUNDED',
      orderItem: completedOrderItem(),
    });
    mocks.returnRequestUpdateMany.mockResolvedValue({ count: 0 });

    const paymentProvider = buildPaymentProviderMock();
    const service = newService(prisma, buildSettingsMock(), paymentProvider);
    await expect(service.approve('rr-1', 'staff-1')).rejects.toThrow(
      ConflictException,
    );
    // Race-ийн засварын гол баталгаа: claim амжилтгүй бол refundPayment()
    // ЯМАР Ч тохиолдолд дуудагдахгүй — давхар санхүүгийн refund-оос
    // сэргийлнэ (Playwright-аар илэрсэн race, доорх commit-ийг үз).
    expect(paymentProvider.refundPayment).not.toHaveBeenCalled();
    expect(mocks.returnRequestUpdate).not.toHaveBeenCalled();
  });

  it('ЗЭРЭГ ирсэн хоёр дахь claim оролдлого (updateMany 0 мөр) PaymentProvider-ийг дуудахгүй — davhar refund-ийн race-ийн шууд симуляц', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const orderItem = completedOrderItem();
    mocks.returnRequestFindUnique.mockResolvedValue({
      id: 'rr-1',
      status: 'REQUESTED',
      orderItem,
    });
    // Эхний хүсэлт аль хэдийн claim хийчихсэн (committed) гэдгийг simulate
    // хийхийн тулд ЭНЭ хүсэлтийн updateMany 0 мөр буцаана.
    mocks.returnRequestUpdateMany.mockResolvedValue({ count: 0 });

    const paymentProvider = buildPaymentProviderMock();
    const service = newService(prisma, buildSettingsMock(), paymentProvider);

    await expect(service.approve('rr-1', 'staff-2')).rejects.toThrow(
      ConflictException,
    );
    expect(paymentProvider.refundPayment).not.toHaveBeenCalled();
  });
});

describe('ReturnRequestService.reject', () => {
  it('REQUESTED хүсэлтийг REJECTED болгож, InventoryItem/refund хөндөхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    const orderItem = completedOrderItem();
    mocks.returnRequestFindUnique
      .mockResolvedValueOnce({ id: 'rr-1', status: 'REQUESTED', orderItem })
      .mockResolvedValueOnce({ id: 'rr-1', status: 'REJECTED', orderItem });
    mocks.returnRequestUpdate.mockResolvedValue({});

    const paymentProvider = buildPaymentProviderMock();
    const orderEvents = buildOrderEventsMock();
    const service = newService(
      prisma,
      buildSettingsMock(),
      paymentProvider,
      orderEvents,
    );

    const result = await service.reject('rr-1', 'staff-1', {
      rejectedReason: 'хугацаа хэтэрсэн',
    });

    const updateArgs = (
      mocks.returnRequestUpdate.mock.calls[0] as unknown[]
    )[0] as { where: { id: string }; data: Record<string, unknown> };
    expect(updateArgs.where).toEqual({ id: 'rr-1' });
    expect(updateArgs.data.status).toBe('REJECTED');
    expect(updateArgs.data.rejectedReason).toBe('хугацаа хэтэрсэн');
    expect(updateArgs.data.reviewedByUserId).toBe('staff-1');
    expect(paymentProvider.refundPayment).not.toHaveBeenCalled();
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(orderEvents.publishReturnStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ returnRequestId: 'rr-1', status: 'REJECTED' }),
    );
    expect(result.status).toBe('REJECTED');
  });

  it('аль хэдийн шийдвэрлэгдсэн бол ConflictException шидэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.returnRequestFindUnique.mockResolvedValue({
      id: 'rr-1',
      status: 'REJECTED',
      orderItem: completedOrderItem(),
    });

    const service = newService(prisma);
    await expect(
      service.reject('rr-1', 'staff-1', { rejectedReason: 'дахин' }),
    ).rejects.toThrow(ConflictException);
    expect(mocks.returnRequestUpdate).not.toHaveBeenCalled();
  });
});
