// docs/plan.md §8 Phase 3b, Хэсэг B #6: төлбөрийн provider-ийн абстракц.
// MockPaymentProvider (dev/тест, credential шаардлагагүй) БОЛОН
// QPayProvider (docs/adr/006-qpay-verify-dont-trust.md) хоёулаа энэ
// interface-ийг хэрэгжүүлж, `PAYMENT_PROVIDER` DI token-оор сольж
// залгах боломжтой (PaymentModule, env `PAYMENT_PROVIDER=mock|qpay`).
export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED';

// docs/plan.md §8 (Cart→Checkout→QPay): QR код + банкны deeplink-үүд.
// bankName/link-ийн бодит бүтэц QPay-ийн эх сурвалжаас баталгаажаагүй
// (docs/adr/006-ийн "QPay бодит холболт ирэхэд заавал баталгаажуулах
// зүйлс" адил тэмдэглэл) тул MockPaymentProvider dummy утга л буцаана.
export interface BankDeeplink {
  bankName: string;
  link: string;
}

export interface CreateInvoiceResult {
  providerInvoiceId: string;
  payUrl?: string;
  qrText?: string;
  bankDeeplinks?: BankDeeplink[];
}

export interface CheckPaymentResult {
  status: PaymentStatus;
}

export interface RefundPaymentResult {
  providerRefundId: string;
}

export interface PaymentProvider {
  createInvoice(orderId: string, amount: number): Promise<CreateInvoiceResult>;
  checkPayment(providerPaymentId: string): Promise<CheckPaymentResult>;
  refundPayment(
    providerPaymentId: string,
    amount: number,
  ): Promise<RefundPaymentResult>;
}

// NestJS custom provider token (interface-ийг runtime-д DI token болгож
// ашиглах боломжгүй тул string token хэрэгтэй).
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
