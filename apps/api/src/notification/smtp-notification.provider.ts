import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { NotificationProvider } from './notification-provider.interface.js';

// docs/plan.md §8 Phase 4, Хэсэг B #11-#12: Email-ийг БОДИТООР (nodemailer
// + SMTP, dev/CI-д Mailpit) хэрэгжүүлнэ — SMS-ээс ЯЛГААТАЙ, vendor
// credential шаардахгүй. SMS gateway vendor Phase 1-д хэдийч төлөвлөгдсөн
// боловч бодитоор сонгогдоогүй (docs/plan.md Phase 1 checklist-д "SMS
// gateway vendor үнэлгээ" зүйл хараахан `[ ]` хэвээр байгааг энэ Phase-д
// нээв) тул `sendSms()` энд ЗОРИУДАА стаб (алдаа шидэхгүй, зөвхөн
// анхааруулга бичээд буцна) — бодит vendor нэгдэхэд ЗӨВХӨН ЭНЭ методын
// дотоод хэрэгжилтийг сольно, `NotificationProvider` interface/дуудагч
// код өөрчлөгдөхгүй.
@Injectable()
export class SmtpNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(SmtpNotificationProvider.name);
  private transporter: nodemailer.Transporter | null = null;

  sendSms(phone: string): Promise<void> {
    this.logger.warn(
      `SMS vendor хараахан тохируулагдаагүй (§11.3) — ${phone} рүү SMS илгээгдсэнгүй (стаб)`,
    );
    return Promise.resolve();
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'no-reply@order-system.mn',
      to,
      subject,
      text: body,
    });
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: Number(process.env.SMTP_PORT ?? 1025),
        // Mailpit (dev/CI) TLS/auth шаардахгүй — бодит vendor нэгдэхэд
        // SMTP_USER/SMTP_PASSWORD env нэмж secure:true болгоно.
        secure: false,
      });
    }
    return this.transporter;
  }
}
