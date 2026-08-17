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

  it('PAID invoice-г refundPayment() хийхэд providerRefundId буцаана', async () => {
    const provider = new MockPaymentProvider();
    const invoice = await provider.createInvoice('order-1', 1000);
    provider.simulatePaid(invoice.providerInvoiceId);

    const refund = await provider.refundPayment(invoice.providerInvoiceId, 500);
    expect(refund.providerRefundId).toMatch(/^mock_refund_/);
  });

  it('PAID БИШ (PENDING эсвэл танигдаагүй) invoice-г refundPayment() хийхийг оролдвол алдаа шидэнэ (§8 Phase 3c REFUND_FAILED зам)', async () => {
    const provider = new MockPaymentProvider();
    const invoice = await provider.createInvoice('order-1', 1000);

    await expect(
      provider.refundPayment(invoice.providerInvoiceId, 500),
    ).rejects.toThrow();
    await expect(provider.refundPayment('mock_unknown', 500)).rejects.toThrow();
  });
});
