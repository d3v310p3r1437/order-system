import { MockNotificationProvider } from './mock-notification.provider.js';

describe('MockNotificationProvider', () => {
  it('sendSms()/sendEmail() бодит сүлжээ рүү хандалгүй амжилттай resolve хийнэ', async () => {
    const provider = new MockNotificationProvider();
    await expect(
      provider.sendSms('+97688112233', 'test'),
    ).resolves.toBeUndefined();
    await expect(
      provider.sendEmail('a@b.mn', 'subject', 'body'),
    ).resolves.toBeUndefined();
  });
});
