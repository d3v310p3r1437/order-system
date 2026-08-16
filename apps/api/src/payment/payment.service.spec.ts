import { PaymentService } from './payment.service.js';

function buildDeps() {
  const checkPayment = jest.fn();
  const paymentProvider = {
    checkPayment,
    createInvoice: jest.fn(),
    refundPayment: jest.fn(),
  };

  const queryRaw = jest.fn();
  const prisma = {
    get tx() {
      return { $queryRaw: queryRaw };
    },
  };

  return { paymentProvider, prisma, mocks: { checkPayment, queryRaw } };
}

describe('PaymentService.confirmWebhookPayment', () => {
  it('checkPayment() PENDING буцаавал app_mark_order_paid огт дуудахгүй', async () => {
    const { paymentProvider, prisma, mocks } = buildDeps();
    mocks.checkPayment.mockResolvedValue({ status: 'PENDING' });
    const service = new PaymentService(paymentProvider, prisma as never);

    const result = await service.confirmWebhookPayment('order-1', 'pay-1');

    expect(result).toEqual({ status: 'PENDING', marked: false });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it('checkPayment() PAID буцаавал app_mark_order_paid дуудна, mark=true', async () => {
    const { paymentProvider, prisma, mocks } = buildDeps();
    mocks.checkPayment.mockResolvedValue({ status: 'PAID' });
    mocks.queryRaw.mockResolvedValue([{ app_mark_order_paid: 1 }]);
    const service = new PaymentService(paymentProvider, prisma as never);

    const result = await service.confirmWebhookPayment('order-1', 'pay-1');

    expect(result).toEqual({ status: 'PAID', marked: true });
    expect(mocks.checkPayment).toHaveBeenCalledWith('pay-1');
  });

  it('PAID ч гэсэн providerInvoiceId таарахгүй бол (0 мөр) marked=false', async () => {
    const { paymentProvider, prisma, mocks } = buildDeps();
    mocks.checkPayment.mockResolvedValue({ status: 'PAID' });
    mocks.queryRaw.mockResolvedValue([{ app_mark_order_paid: 0 }]);
    const service = new PaymentService(paymentProvider, prisma as never);

    const result = await service.confirmWebhookPayment(
      'order-1',
      'pay-mismatched',
    );

    expect(result).toEqual({ status: 'PAID', marked: false });
  });
});
