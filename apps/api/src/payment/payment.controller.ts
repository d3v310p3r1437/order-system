import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import type { Request } from 'express';
import { Audit } from '../common/audit.decorator.js';
import { PaymentWebhookDto } from './dto/payment-webhook.dto.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { PaymentService } from './payment.service.js';

const INVOICE_NOT_FOUND = {
  code: 'INVOICE_NOT_FOUND',
  message: 'Ийм providerInvoiceId-тай invoice олдсонгүй',
};
const SIMULATE_PAID_NOT_AVAILABLE = {
  code: 'NOT_FOUND',
  message: 'Олдсонгүй',
};

// docs/plan.md §8 Phase 3b, Хэсэг B. ⚠️ Энэ controller-д ЗОРИУДАА
// `RolesGuard` тавьсангүй: webhook нь QPay-ийн сервэрээс ирдэг, манай
// системд бүртгэлтэй хэрэглэгчийн session (Authorization header) огт
// байхгүй тул ердийн auth guard-аар хамгаалж БОЛОХГҮЙ — цорын ганц
// хамгаалалт бол payload-д ямар ч итгэлгүйгээр provider-той дахин
// баталгаажуулах (docs/adr/006-qpay-verify-dont-trust.md).
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly mockProvider: MockPaymentProvider,
  ) {}

  // QPay invoice үүсгэх үед бид өөрсдөө `callback_url`-д энэ замыг
  // (orderId хамт) бэхэлж өгсөн байдаг (qpay.provider.ts) тул orderId
  // энд ХЭЗЭЭ Ч хэрэглэгчийн шууд оролтоос ирдэггүй.
  @Post('webhook/:orderId')
  @Audit('orders', {
    action: 'orders.payment_confirmed',
    recordId: (req: Request) => req.params.orderId as string,
  })
  async webhook(
    @Param('orderId') orderId: string,
    @Body() dto: PaymentWebhookDto,
  ) {
    const result = await this.paymentService.confirmWebhookPayment(
      orderId,
      dto.payment_id,
    );
    return { orderId, status: result.status, paid: result.marked };
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
