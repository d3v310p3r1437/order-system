import { QPayProvider } from './qpay.provider.js';

// docs/adr/006-qpay-verify-dont-trust.md: бодит QPay sandbox credential
// байхгүй тул ЭНД зөвхөн HTTP давхаргыг (global fetch) mock хийж, дуудлагын
// payload/эрэмбэ, токен кэшлэлт зэрэг ЛОГИКийг л шалгана — бодит сүлжээ
// рүү хэзээ ч хандахгүй.
function mockFetchSequence(responses: { status: number; body: unknown }[]) {
  const fetchMock = jest.fn();
  for (const res of responses) {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: () => Promise.resolve(res.body),
      }),
    );
  }
  global.fetch = fetchMock;
  return fetchMock;
}

describe('QPayProvider', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      QPAY_CLIENT_ID: 'client-1',
      QPAY_CLIENT_SECRET: 'secret-1',
      QPAY_INVOICE_CODE: 'invoice-code-1',
      QPAY_CALLBACK_BASE_URL: 'https://api.example.mn',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  it('createInvoice(): эхлээд /v2/auth/token (Basic auth), дараа нь /v2/invoice дуудна', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      {
        status: 200,
        body: { invoice_id: 'inv-1', qPay_shortUrl: 'https://qpay.mn/s/inv-1' },
      },
    ]);
    const provider = new QPayProvider();

    const result = await provider.createInvoice('order-1', 1000);

    expect(result).toEqual({
      providerInvoiceId: 'inv-1',
      payUrl: 'https://qpay.mn/s/inv-1',
      qrText: undefined,
      bankDeeplinks: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toContain('/v2/auth/token');
    expect((tokenInit.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`,
    );

    const [invoiceUrl, invoiceInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(invoiceUrl).toContain('/v2/invoice');
    const body = JSON.parse(invoiceInit.body as string) as Record<
      string,
      unknown
    >;
    expect(body.sender_invoice_no).toBe('order-1');
    expect(body.amount).toBe(1000);
    expect(body.callback_url).toBe(
      'https://api.example.mn/payment/webhook/order-1',
    );
  });

  it('createInvoice(): qr_text/urls ирвэл qrText/bankDeeplinks-руу хөрвүүлж буцаана (name/link дутуу мөрийг алгасна)', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      {
        status: 200,
        body: {
          invoice_id: 'inv-1',
          qPay_shortUrl: 'https://qpay.mn/s/inv-1',
          qr_text: '000201010211...',
          urls: [
            { name: 'Хаан банк', link: 'khanbank://q?qPay_QRcode=inv-1' },
            { name: 'дутуу link' },
          ],
        },
      },
    ]);
    const provider = new QPayProvider();

    const result = await provider.createInvoice('order-1', 1000);

    expect(result.qrText).toBe('000201010211...');
    expect(result.bankDeeplinks).toEqual([
      { bankName: 'Хаан банк', link: 'khanbank://q?qPay_QRcode=inv-1' },
    ]);
  });

  it('checkPayment(): rows дотор PAID мөр байвал PAID буцаана', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      {
        status: 200,
        body: { count: 1, rows: [{ payment_status: 'PAID' }] },
      },
    ]);
    const provider = new QPayProvider();

    const result = await provider.checkPayment('inv-1');
    expect(result.status).toBe('PAID');
  });

  it('checkPayment(): count=0 бол FAILED буцаана', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      { status: 200, body: { count: 0, rows: [] } },
    ]);
    const provider = new QPayProvider();

    const result = await provider.checkPayment('inv-1');
    expect(result.status).toBe('FAILED');
  });

  it('давхар дуудлагад access token дахин авахгүй (кэшлэгдсэн)', async () => {
    const fetchMock = mockFetchSequence([
      { status: 200, body: { access_token: 'tok-1', expires_in: 3600 } },
      { status: 200, body: { count: 0, rows: [] } },
      { status: 200, body: { count: 0, rows: [] } },
    ]);
    const provider = new QPayProvider();

    await provider.checkPayment('inv-1');
    await provider.checkPayment('inv-2');

    // Токены дуудлага (auth/token) ганцхан удаа л явсан байх ёстой.
    const tokenCalls = fetchMock.mock.calls.filter(([url]: [string]) =>
      url.includes('/v2/auth/token'),
    );
    expect(tokenCalls).toHaveLength(1);
  });

  it('HTTP алдаа буцвал Error шидэнэ', async () => {
    mockFetchSequence([{ status: 401, body: {} }]);
    const provider = new QPayProvider();

    await expect(provider.checkPayment('inv-1')).rejects.toThrow(/QPay/);
  });
});
