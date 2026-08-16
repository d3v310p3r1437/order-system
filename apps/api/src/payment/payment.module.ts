import { Module } from '@nestjs/common';
import { LoginThrottleService } from '../common/login-throttle.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { PAYMENT_PROVIDER } from './payment-provider.interface.js';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { QPayProvider } from './qpay.provider.js';
import { WebhookGuardService } from './webhook-guard.service.js';

// docs/plan.md §8 Phase 3b, Хэсэг B #9: `PAYMENT_PROVIDER` env-ээр аль
// provider-ийг DI-д залгахаа сонгоно (анхдагч `mock` — QPay sandbox
// credential хараахан байхгүй). `MockPaymentProvider`-ийг PAYMENT_PROVIDER
// token-оос ГАДНА тусад нь ч экспортолсон — PaymentController-ийн зөвхөн
// dev/тест орчинд идэвхтэй `simulate-paid` endpoint-д (аль ч идэвхтэй
// provider-оос үл хамааран ЗӨВХӨН MockPaymentProvider-ийн API байдаг тул)
// шууд тодорхой class хэрэгтэй.
@Module({
  imports: [RealtimeModule],
  providers: [
    MockPaymentProvider,
    QPayProvider,
    PaymentService,
    LoginThrottleService,
    WebhookGuardService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (mock: MockPaymentProvider, qpay: QPayProvider) =>
        process.env.PAYMENT_PROVIDER === 'qpay' ? qpay : mock,
      inject: [MockPaymentProvider, QPayProvider],
    },
  ],
  controllers: [PaymentController],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentModule {}
