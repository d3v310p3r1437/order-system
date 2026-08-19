import { randomUUID } from 'node:crypto';
import { SmtpNotificationProvider } from '../src/notification/smtp-notification.provider.js';

interface MailpitMessage {
  To: { Address: string }[];
  Subject: string;
  Snippet: string;
}

interface MailpitMessagesResponse {
  messages: MailpitMessage[];
}

const MAILPIT_API_URL = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

// docs/plan.md §8 Phase 4, Хэсэг B #15: SmtpNotificationProvider-ийг
// SHUUD (DI сонголтоос үл хамааран, `NOTIFICATION_PROVIDER` env-ийг
// шалгахгүйгээр) instantiate хийж, Mailpit-руу бодит SMTP-ээр илгээгээд,
// Mailpit-ийн REST API-аар бодитоор ирснийг баталгаажуулна. Бүхэл
// order-status-changed урсгалаар (checkout→status update→notification
// trigger) шалгахаас ЭНЭ арга ХЯЛБАР бөгөөд найдвартай — учир нь
// CUSTOMER бүртгэлийн User.email ихэвчлэн NULL байдаг тул
// (auth-customer/dto/register.dto.ts зөвхөн phone цуглуулдаг) бүтэн
// урсгалаар шалгахад тест өгөгдлийг эрхгүй нарийн бэлтгэх шаардлагатай
// болно. Trigger-ийн WIRING логикийг (аль статуст илгээх, tx-ийн дараа
// хандахгүй г.м.) `notification-trigger.service.spec.ts`-д unit
// түвшинд аль хэдийн mock provider-оор баталгаажуулсан.
async function waitFor<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result !== null) {
      return result;
    }
    if (Date.now() > deadline) {
      throw new Error('waitFor: хугацаа дууслаа (Mailpit-д email ирсэнгүй)');
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function findMailpitMessage(
  recipient: string,
): Promise<MailpitMessage | null> {
  const res = await fetch(`${MAILPIT_API_URL}/api/v1/messages`);
  if (!res.ok) {
    throw new Error(`Mailpit API алдаа: HTTP ${res.status}`);
  }
  const body = (await res.json()) as MailpitMessagesResponse;
  return (
    body.messages.find((m) => m.To.some((to) => to.Address === recipient)) ??
    null
  );
}

describe('SmtpNotificationProvider (e2e, бодит Mailpit-тэй)', () => {
  it('sendEmail(): Mailpit-руу бодитоор SMTP-ээр илгээгдэж, REST API-аар бодитоор ирснийг баталгаажуулна', async () => {
    const provider = new SmtpNotificationProvider();
    const recipient = `test-${randomUUID()}@example.mn`;
    const subject = `Захиалга №${randomUUID().slice(0, 8)} баталгаажлаа`;
    const body = 'Таны захиалга баталгаажлаа.';

    await provider.sendEmail(recipient, subject, body);

    const message = await waitFor(() => findMailpitMessage(recipient));
    expect(message.Subject).toBe(subject);
    expect(message.Snippet).toContain('Таны захиалга баталгаажлаа');
  });

  it('sendSms(): SMS vendor тохируулагдаагүй тул алдаа шидэлгүй стаб (Mailpit рүү юу ч илгээхгүй)', async () => {
    const provider = new SmtpNotificationProvider();
    await expect(
      provider.sendSms('+97688112233', 'test'),
    ).resolves.toBeUndefined();
  });
});
