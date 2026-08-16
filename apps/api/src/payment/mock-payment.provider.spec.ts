import { MockPaymentProvider } from './mock-payment.provider.js';

describe('MockPaymentProvider', () => {
  it('createInvoice → checkPayment анхандаа PENDING буцаана', async () => {
    const provider = new MockPaymentProvider();
    const invoice = await provider.createInvoice('order-1', 1000);

    expect(invoice.providerInvoiceId).toMatch(/^mock_/);
    expect(invoice.payUrl).toContain(invoice.providerInvoiceId);

    const check = await provider.checkPayment(invoice.providerInvoiceId);
    expect(check.status).toBe('PENDING');
  });

  it('simulatePaid() дуудсаны дараа checkPayment() PAID буцаана', async () => {
    const provider = new MockPaymentProvider();
    const invoice = await provider.createInvoice('order-1', 1000);

    const ok = provider.simulatePaid(invoice.providerInvoiceId);
    expect(ok).toBe(true);

    const check = await provider.checkPayment(invoice.providerInvoiceId);
    expect(check.status).toBe('PAID');
  });

  it('танигдаагүй invoiceId-д simulatePaid() false буцаана, checkPayment() FAILED буцаана', async () => {
    const provider = new MockPaymentProvider();

    expect(provider.simulatePaid('mock_unknown')).toBe(false);
    const check = await provider.checkPayment('mock_unknown');
    expect(check.status).toBe('FAILED');
  });

  it('refundPayment() providerRefundId буцаана', async () => {
    const provider = new MockPaymentProvider();
    const refund = await provider.refundPayment('mock_x', 500);
    expect(refund.providerRefundId).toMatch(/^mock_refund_/);
  });
});
