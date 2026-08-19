// docs/plan.md §8 Phase 4, Хэсэг B #9: захиалга/буцаалтын статус
// өөрчлөгдөх мөчид харилцагч руу мэдэгдэл илгээх provider-ийн абстракц.
// PaymentProvider/RoutingProvider-тэй ЯГ ИЖИЛ загвар. Тусдаа embedded
// `SmsProvider` interface ЗОРИУДАА зохиогоогүй — "SMS vendor солиход код
// өөрчлөгдөхгүй" шаардлагыг `sendSms()`-ийн дотоод хэрэгжилтийг сольж
// (`SmtpNotificationProvider`-ийн дотор) л хангана, нэмэлт давхар
// абстракц шаардлагагүй (YAGNI, PaymentProvider ганц интерфэйстэй адил).
export interface NotificationProvider {
  sendSms(phone: string, message: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

// NestJS custom provider token — payment-provider.interface.ts-тэй адил.
export const NOTIFICATION_PROVIDER = 'NOTIFICATION_PROVIDER';
