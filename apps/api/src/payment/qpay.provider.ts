import { Injectable, Logger } from '@nestjs/common';
import type {
  CheckPaymentResult,
  CreateInvoiceResult,
  PaymentProvider,
  RefundPaymentResult,
} from './payment-provider.interface.js';

interface QPayTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface QPayInvoiceResponse {
  invoice_id: string;
  qPay_shortUrl?: string;
}

interface QPayPaymentCheckRow {
  payment_status?: string;
}

interface QPayPaymentCheckResponse {
  count: number;
  rows?: QPayPaymentCheckRow[];
}

interface QPayRefundResponse {
  refund_id?: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} орчны хувьсагч тохируулагдаагүй байна (QPay)`);
  }
  return value;
}

// docs/plan.md §8 Phase 3b, Хэсэг B #8: developer.qpay.mn (Merchant V2)-ийн
// эх сурвалжаас цуглуулсан бодит endpoint/талбарын нэрсээр бичсэн —
// ГЭХДЭЭ бодит sandbox credential байхгүй тул ЭНЭ бүрэн урсгалыг бодитоор
// ТУРШИЖ БАТАЛГААЖУУЛААГҮЙ (зөвхөн qpay.provider.spec.ts-ийн mock HTTP
// хариугаар нэгж тестлэсэн). Credential ирмэгц docs/adr/006-ийн
// checklist-ийн дагуу дахин баталгаажуулах ёстой:
// - POST /v2/auth/token — Basic auth (`base64(client_id:client_secret)`),
//   хариу `access_token`/`expires_in` (`refresh_token` одоохондоо
//   ашиглаагүй — expiry-д хүрэхэд зүгээр дахин /v2/auth/token дуудна).
// - POST /v2/invoice — багц `invoice_code`, `sender_invoice_no`
//   (давтагдашгүй байх ёстой — бид `orderId`-г шууд ашиглав),
//   `invoice_receiver_code`, `invoice_description`, `amount`,
//   `callback_url`; хариу `invoice_id`, `qPay_shortUrl` (`qr_text`/
//   `qr_image`/`urls` mobile deeplink-үүд одоогоор хэрэглэгдэхгүй, web
//   checkout-д зөвхөн `qPay_shortUrl`-ийг ашигласан).
// - POST /v2/payment/check — `object_type: 'INVOICE'`, `object_id`
//   (= invoice_id), `offset.page_number/page_limit`; хариу `count`,
//   `rows[].payment_status` ("PAID" гэх мэт утга — бусад боломжит
//   утгуудыг (жиш: "NEW", "FAILED") эх сурвалжид бүрэн баталгаажуулаагүй
//   тул `paid` bool-оос бусад тохиолдлыг зөвхөн `count`-аар PENDING/FAILED
//   болгож дүгнэсэн).
// - Буцаалтын (refund) endpoint/талбарын нэр эх сурвалжаас олдоогүй тул
//   `refundPayment()`-ийн доорх зам БҮРЭН ТААМАГЛАЛ — credential ирмэгц
//   ЗААВАЛ баталгаажуулах.
@Injectable()
export class QPayProvider implements PaymentProvider {
  private readonly logger = new Logger(QPayProvider.name);
  private readonly baseUrl: string;
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor() {
    this.baseUrl = process.env.QPAY_BASE_URL ?? 'https://merchant.qpay.mn';
  }

  async createInvoice(
    orderId: string,
    amount: number,
  ): Promise<CreateInvoiceResult> {
    const body = await this.request<QPayInvoiceResponse>('/v2/invoice', {
      invoice_code: requireEnv('QPAY_INVOICE_CODE'),
      sender_invoice_no: orderId,
      invoice_receiver_code: 'terminal',
      invoice_description: `Захиалга ${orderId}`,
      amount,
      // Webhook-д ирэх orderId-г ӨӨРСДӨӨ энд бэхэлж өгнө (§Хэсэг B #10-ийн
      // "verify don't trust" — payment_id ГАНЦААРАА orderId-г нотлохгүй,
      // callback_url-ийн path-аар дамжуулсан orderId нь ЭНЭ backend
      // ӨӨРӨӨ үүсгэсэн холбоос тул итгэмжтэй эх сурвалж).
      callback_url: `${requireEnv('QPAY_CALLBACK_BASE_URL')}/payment/webhook/${orderId}`,
    });
    return { providerInvoiceId: body.invoice_id, payUrl: body.qPay_shortUrl };
  }

  async checkPayment(providerPaymentId: string): Promise<CheckPaymentResult> {
    const body = await this.request<QPayPaymentCheckResponse>(
      '/v2/payment/check',
      {
        object_type: 'INVOICE',
        object_id: providerPaymentId,
        offset: { page_number: 1, page_limit: 100 },
      },
    );
    const paid = (body.rows ?? []).some((row) => row.payment_status === 'PAID');
    return { status: paid ? 'PAID' : body.count > 0 ? 'PENDING' : 'FAILED' };
  }

  async refundPayment(
    providerPaymentId: string,
    amount: number,
  ): Promise<RefundPaymentResult> {
    this.logger.warn(
      'QPayProvider.refundPayment(): endpoint бодит credential-ээр баталгаажаагүй (эх сурвалж дутуу — файлын толгой хэсгийн тайлбарыг үз)',
    );
    const body = await this.request<QPayRefundResponse>(
      `/v2/payment/refund/${providerPaymentId}`,
      { amount },
    );
    return { providerRefundId: body.refund_id ?? providerPaymentId };
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.accessToken;
    }
    const basic = Buffer.from(
      `${requireEnv('QPAY_CLIENT_ID')}:${requireEnv('QPAY_CLIENT_SECRET')}`,
    ).toString('base64');
    const res = await fetch(`${this.baseUrl}/v2/auth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok) {
      throw new Error(`QPay token авахад алдаа гарлаа: HTTP ${res.status}`);
    }
    const body = (await res.json()) as QPayTokenResponse;
    // 5 секундын нөөц (clock skew) — expiry-д яг таг хүрэхээс өмнө сэргээнэ.
    this.cachedToken = {
      accessToken: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - 5000,
    };
    return this.cachedToken.accessToken;
  }

  private async request<T>(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`QPay ${path} алдаа гарлаа: HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }
}
