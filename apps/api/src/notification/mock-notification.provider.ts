import { Injectable, Logger } from '@nestjs/common';
import type { NotificationProvider } from './notification-provider.interface.js';

// docs/plan.md §8 Phase 4, Хэсэг B #10: dev/тестэд зориулсан — бодит
// сүлжээ рүү хэзээ ч хандахгүй, зөвхөн Logger-оор (console) бичдэг.
// mock-payment.provider.ts-тэй адил зорилготой (анхдагч, credential
// шаардахгүй).
@Injectable()
export class MockNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(MockNotificationProvider.name);

  sendSms(phone: string, message: string): Promise<void> {
    this.logger.log(`[MOCK SMS] -> ${phone}: ${message}`);
    return Promise.resolve();
  }

  sendEmail(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[MOCK EMAIL] -> ${to} | ${subject}\n${body}`);
    return Promise.resolve();
  }
}
