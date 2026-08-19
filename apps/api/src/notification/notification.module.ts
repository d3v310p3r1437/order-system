import { Module } from '@nestjs/common';
import { MockNotificationProvider } from './mock-notification.provider.js';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface.js';
import { NotificationTrigger } from './notification-trigger.service.js';
import { SmtpNotificationProvider } from './smtp-notification.provider.js';

// docs/plan.md §8 Phase 4, Хэсэг B #13: `NOTIFICATION_PROVIDER` env-ээр
// аль provider-ийг DI-д залгахаа сонгоно (анхдагч `mock`) — payment.module.ts-тэй
// ЯГ ижил factory загвар.
@Module({
  providers: [
    MockNotificationProvider,
    SmtpNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      useFactory: (
        mock: MockNotificationProvider,
        smtp: SmtpNotificationProvider,
      ) => (process.env.NOTIFICATION_PROVIDER === 'real' ? smtp : mock),
      inject: [MockNotificationProvider, SmtpNotificationProvider],
    },
    NotificationTrigger,
  ],
  exports: [NOTIFICATION_PROVIDER, NotificationTrigger],
})
export class NotificationModule {}
