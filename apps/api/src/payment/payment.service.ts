import { Inject, Injectable } from '@nestjs/common';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PaymentStatus,
} from './payment-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface WebhookConfirmationResult {
  status: PaymentStatus;
  // true — Order.paidAt ЭНЭ дуудлагаар шинээр тавигдсан (эсвэл аль хэдийн
  // тавигдсан байсан ч orderId/providerInvoiceId хос зөв таарсан).
  marked: boolean;
}

// docs/adr/006-qpay-verify-dont-trust.md: webhook payload-ийн статусыг
// ШУУД итгэхгүй, идэвхтэй provider-ийн checkPayment()-ийг СЕРВЕР ТАЛААС
// дахин дуудаж, зөвхөн ТҮҮНИЙ хариу PAID байх үед л Order.paidAt-г
// SECURITY DEFINER функцээр (app_mark_order_paid, docs/adr/005 WRITE
// ангилал) тавина.
@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly prisma: PrismaService,
  ) {}

  async confirmWebhookPayment(
    orderId: string,
    providerPaymentId: string,
  ): Promise<WebhookConfirmationResult> {
    const { status } =
      await this.paymentProvider.checkPayment(providerPaymentId);
    if (status !== 'PAID') {
      return { status, marked: false };
    }

    // p_provider_invoice_id нь checkout үед PaymentProvider.createInvoice()-ийн
    // буцаасан, тухайн Order-д БИД ӨӨРСДӨӨ бичсэн утгатай яг таарах ёстой —
    // энэ бол webhook-ийн ганц эрх мэдлийн "нотолгоо" (migration
    // 20260816120500-ийн тайлбарыг үз, session identity энд байхгүй).
    const rows = await this.prisma.tx.$queryRaw<
      { app_mark_order_paid: number }[]
    >`SELECT app_mark_order_paid(${orderId}, ${providerPaymentId})`;
    const rowCount = rows[0]?.app_mark_order_paid ?? 0;

    return { status, marked: rowCount > 0 };
  }
}
