import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentWebhookDto } from './dto/payment-webhook.dto.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { PaymentService } from './payment.service.js';
import { WebhookGuardService } from './webhook-guard.service.js';

const INVOICE_NOT_FOUND = {
  code: 'INVOICE_NOT_FOUND',
  message: 'Ийм providerInvoiceId-тай invoice олдсонгүй',
};
const SIMULATE_PAID_NOT_AVAILABLE = {
  code: 'NOT_FOUND',
  message: 'Олдсонгүй',
};
const RATE_LIMITED = {
  code: 'RATE_LIMITED',
  message: 'Хэт олон хүсэлт ирлээ, түр хүлээгээд дахин оролдоно уу',
};

// docs/plan.md §8 Phase 3b, Хэсэг B. ⚠️ Энэ controller-д ЗОРИУДАА
// `RolesGuard` тавьсангүй: webhook нь QPay-ийн сервэрээс ирдэг, манай
// системд бүртгэлтэй хэрэглэгчийн session (Authorization header) огт
// байхгүй тул ердийн auth guard-аар хамгаалж БОЛОХГҮЙ — цорын ганц
// хамгаалалт бол payload-д ямар ч итгэлгүйгээр provider-той дахин
// баталгаажуулах (docs/adr/006-qpay-verify-dont-trust.md).
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly webhookGuard: WebhookGuardService,
  ) {}

  // QPay invoice үүсгэх үед бид өөрсдөө `callback_url`-д энэ замыг
  // (orderId хамт) бэхэлж өгсөн байдаг (qpay.provider.ts) тул orderId
  // энд ХЭЗЭЭ Ч хэрэглэгчийн шууд оролтоос ирдэггүй.
  //
  // docs/adr/006-ийн "Webhook idempotency/rate-limit" (Stripe/PayPal-ийн
  // стандарт practice-аар үндэслэсэн):
  // 1. IP-ээр coarse rate-limit (1 минутад 30) — үерлүүлэх халдлагаас.
  // 2. payment_id-аар 10 секундын dedupe lock — QPay-ийн бодит давталт
  //    эсвэл зэрэг ирсэн давхар хүсэлтэд checkPayment()-ийг ДАХИН
  //    дуудахгүй.
  // 3. ЗААВАЛ HTTP 200 буцаана (rate-limit-ээс бусад бүх тохиолдолд) —
  //    илгээгч тал (QPay) дахин дахин retry хийхээс сэргийлнэ.
  @Post('webhook/:orderId')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request,
    @Param('orderId') orderId: string,
    @Body() dto: PaymentWebhookDto,
  ) {
    const ip = req.ip ?? 'unknown';
    if (await this.webhookGuard.isRateLimited(ip)) {
      this.logger.warn(
        `Webhook rate-limited: ip=${ip} orderId=${orderId} payment_id=${dto.payment_id}`,
      );
      throw new HttpException(RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (await this.webhookGuard.isDuplicate(dto.payment_id)) {
      this.logger.log(
        `Webhook давхардсан (10с dedupe): orderId=${orderId} payment_id=${dto.payment_id}`,
      );
      return { orderId, checkStatus: null, result: 'DUPLICATE_SKIPPED' };
    }

    const { checkStatus, result } =
      await this.paymentService.confirmWebhookPayment(orderId, dto.payment_id);
    this.logger.log(
      `Webhook боловсруулагдав: orderId=${orderId} payment_id=${dto.payment_id} checkStatus=${checkStatus} result=${result}`,
    );
    return { orderId, checkStatus, result, paid: result === 'MARKED_PAID' };
  }

  // docs/plan.md §8 Phase 3b, Хэсэг B #7: dev-only "хэрэглэгч төлбөр
  // төлсөн" симуляц. Зөвхөн NODE_ENV !== 'production' үед идэвхтэй,
  // мөн зөвхөн PAYMENT_PROVIDER=mock (анхдагч) үед л ямар нэг invoiceId
  // танигдана (QPay идэвхтэй бол MockPaymentProvider-ийн in-memory Map
  // огт дүүргэгдээгүй байх тул үргэлж 404 буцна).
  @Post('mock/simulate-paid/:providerInvoiceId')
  simulatePaid(@Param('providerInvoiceId') providerInvoiceId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException(SIMULATE_PAID_NOT_AVAILABLE);
    }
    const ok = this.mockProvider.simulatePaid(providerInvoiceId);
    if (!ok) {
      throw new NotFoundException(INVOICE_NOT_FOUND);
    }
    return { providerInvoiceId, status: 'PAID' };
  }
}
