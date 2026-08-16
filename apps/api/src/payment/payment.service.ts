import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderEventsPublisher } from '../realtime/order-events.publisher.js';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type PaymentStatus,
} from './payment-provider.interface.js';

// app_mark_order_paid() SQL функцийн буцаах утга
// (20260817090000_atomic_idempotent_mark_paid_function migration-ийг үз).
export type WebhookMarkResult =
  'MARKED_PAID' | 'ALREADY_PAID' | 'MISMATCH' | 'NOT_PAID';

export interface WebhookConfirmationResult {
  checkStatus: PaymentStatus;
  result: WebhookMarkResult;
}

interface MarkOrderPaidRow {
  result: string;
  branch_id: string | null;
  customer_id: string | null;
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
    private readonly requestContext: RequestContextService,
    private readonly orderEvents: OrderEventsPublisher,
  ) {}

  async confirmWebhookPayment(
    orderId: string,
    providerPaymentId: string,
  ): Promise<WebhookConfirmationResult> {
    const { status: checkStatus } =
      await this.paymentProvider.checkPayment(providerPaymentId);
    if (checkStatus !== 'PAID') {
      return { checkStatus, result: 'NOT_PAID' };
    }

    // p_provider_invoice_id нь checkout үед PaymentProvider.createInvoice()-ийн
    // буцаасан, тухайн Order-д БИД ӨӨРСДӨӨ бичсэн утгатай яг таарах ёстой —
    // энэ бол webhook-ийн ганц эрх мэдлийн "нотолгоо" (session identity
    // энд байхгүй). Функц ӨӨРӨӨ 0 мөр өөрчлөгдсөн шалтгааныг (аль хэдийн
    // PAID vs огт таарахгүй) ялгаж 'result'-оор буцаадаг тул алдаа
    // шидэхгүй, idempotent (Stripe/PayPal-ийн стандарт webhook practice).
    const rows = await this.prisma.tx.$queryRaw<MarkOrderPaidRow[]>`
      SELECT * FROM app_mark_order_paid(${orderId}, ${providerPaymentId})
    `;
    const row = rows[0];
    const result = (row?.result ?? 'MISMATCH') as WebhookMarkResult;

    // Зөвхөн ЖИНХЭНЭ шинэ мутаци (idempotent давталт БИШ) үед л:
    // (a) audit_logs-д бичиж (CLAUDE.md-ийн "мутаци бүрт audit" дүрэм),
    // (b) WebSocket event нийтэлнэ ("зөвхөн 1 удаа" — давталт дээр
    // дахин нийтлэхгүй).
    if (result === 'MARKED_PAID' && row?.branch_id && row?.customer_id) {
      await this.writeAuditLog(orderId, providerPaymentId);
      this.orderEvents.publishOrderPaymentConfirmed({
        orderId,
        branchId: row.branch_id,
        customerId: row.customer_id,
      });
    }

    return { checkStatus, result };
  }

  // AuditInterceptor-ийн @Audit()-той адил raw INSERT (RETURNING-гүй,
  // audit_select RLS-д мөргөлдөхгүй) — гэхдээ энд ЗОРИУДАА @Audit()
  // decorator ашиглаагүй: webhook нь rate-limit/dedupe-ийн улмаас БҮХ
  // хүсэлтэд biznes мутаци хийдэггүй (`PaymentController`-ийг үз), харин
  // @Audit() controller handler бүрийн АМЖИЛТТАЙ хариу дээр нөхцөлгүй
  // бичдэг тул MARKED_PAID биш үед ч "мутаци болсон" мэт худал audit мөр
  // үлдээх эрсдэлтэй байсан — иймд манай мутаци өөрөө ЯГ ХЭЗЭЭ болсныг
  // мэдэх PaymentService дотроос л, зөвхөн MARKED_PAID-ийн үед бичнэ.
  private async writeAuditLog(
    orderId: string,
    providerPaymentId: string,
  ): Promise<void> {
    const { tx, userId } = this.requestContext.get();
    await tx.$executeRaw`
      INSERT INTO audit_logs
        (id, "userId", action, "tableName", "recordId", "beforeData", "afterData", "branchId")
      VALUES
        (${randomUUID()}, ${userId}, 'orders.payment_confirmed', 'orders', ${orderId}, NULL,
         ${JSON.stringify({ providerPaymentId, paidAt: new Date().toISOString() })}::jsonb, NULL)
    `;
  }
}
