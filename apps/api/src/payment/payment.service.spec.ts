import { PaymentService } from './payment.service.js';

function buildDeps() {
  const checkPayment = jest.fn();
  const paymentProvider = {
    checkPayment,
    createInvoice: jest.fn(),
    refundPayment: jest.fn(),
  };

  const queryRaw = jest.fn();
  const executeRaw = jest.fn();
  const prisma = {
    get tx() {
      return { $queryRaw: queryRaw, $executeRaw: executeRaw };
    },
  };

  const requestContext = {
    get: jest
      .fn()
      .mockReturnValue({ tx: { $executeRaw: executeRaw }, userId: null }),
  };
  const publishOrderPaymentConfirmed = jest.fn();
  const orderEvents = { publishOrderPaymentConfirmed };

  return {
    paymentProvider,
    prisma,
    requestContext,
    orderEvents,
    mocks: { checkPayment, queryRaw, executeRaw, publishOrderPaymentConfirmed },
  };
}

function newService(deps: ReturnType<typeof buildDeps>) {
  return new PaymentService(
    deps.paymentProvider,
    deps.prisma as never,
    deps.requestContext as never,
    deps.orderEvents as never,
  );
}

describe('PaymentService.confirmWebhookPayment', () => {
  it('checkPayment() PENDING буцаавал app_mark_order_paid огт дуудахгүй, audit/event ч гарахгүй', async () => {
    const deps = buildDeps();
    deps.mocks.checkPayment.mockResolvedValue({ status: 'PENDING' });
    const service = newService(deps);

    const result = await service.confirmWebhookPayment('order-1', 'pay-1');

    expect(result).toEqual({ checkStatus: 'PENDING', result: 'NOT_PAID' });
    expect(deps.mocks.queryRaw).not.toHaveBeenCalled();
    expect(deps.mocks.executeRaw).not.toHaveBeenCalled();
    expect(deps.mocks.publishOrderPaymentConfirmed).not.toHaveBeenCalled();
  });

  it('checkPayment() PAID + шинээр MARKED_PAID болвол audit бичигдэж, WS event нийтлэгдэнэ', async () => {
    const deps = buildDeps();
    deps.mocks.checkPayment.mockResolvedValue({ status: 'PAID' });
    deps.mocks.queryRaw.mockResolvedValue([
      { result: 'MARKED_PAID', branch_id: 'b-1', customer_id: 'c-1' },
    ]);
    const service = newService(deps);

    const result = await service.confirmWebhookPayment('order-1', 'pay-1');

    expect(result).toEqual({ checkStatus: 'PAID', result: 'MARKED_PAID' });
    expect(deps.mocks.checkPayment).toHaveBeenCalledWith('pay-1');
    expect(deps.mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(deps.mocks.publishOrderPaymentConfirmed).toHaveBeenCalledWith({
      orderId: 'order-1',
      branchId: 'b-1',
      customerId: 'c-1',
    });
  });

  it('ALREADY_PAID (idempotent давталт) үед audit/event ХОЁУЛАА гарахгүй', async () => {
    const deps = buildDeps();
    deps.mocks.checkPayment.mockResolvedValue({ status: 'PAID' });
    deps.mocks.queryRaw.mockResolvedValue([
      { result: 'ALREADY_PAID', branch_id: null, customer_id: null },
    ]);
    const service = newService(deps);

    const result = await service.confirmWebhookPayment('order-1', 'pay-1');

    expect(result).toEqual({ checkStatus: 'PAID', result: 'ALREADY_PAID' });
    expect(deps.mocks.executeRaw).not.toHaveBeenCalled();
    expect(deps.mocks.publishOrderPaymentConfirmed).not.toHaveBeenCalled();
  });

  it('MISMATCH (providerInvoiceId таарахгүй) үед audit/event ХОЁУЛАА гарахгүй', async () => {
    const deps = buildDeps();
    deps.mocks.checkPayment.mockResolvedValue({ status: 'PAID' });
    deps.mocks.queryRaw.mockResolvedValue([
      { result: 'MISMATCH', branch_id: null, customer_id: null },
    ]);
    const service = newService(deps);

    const result = await service.confirmWebhookPayment(
      'order-1',
      'pay-mismatched',
    );

    expect(result).toEqual({ checkStatus: 'PAID', result: 'MISMATCH' });
    expect(deps.mocks.executeRaw).not.toHaveBeenCalled();
    expect(deps.mocks.publishOrderPaymentConfirmed).not.toHaveBeenCalled();
  });
});
