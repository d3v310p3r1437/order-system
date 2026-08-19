const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test' });
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) =>
    (createTransportMock as (...a: unknown[]) => unknown)(...args),
}));

import { SmtpNotificationProvider } from './smtp-notification.provider.js';

describe('SmtpNotificationProvider', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
    };
    sendMailMock.mockClear();
    createTransportMock.mockClear();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sendEmail(): SMTP_HOST/PORT env-ээр transporter үүсгэж sendMail дуудна', async () => {
    const provider = new SmtpNotificationProvider();
    await provider.sendEmail('customer@example.mn', 'Гарчиг', 'Агуулга');

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'localhost', port: 1025, secure: false }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.mn',
        subject: 'Гарчиг',
        text: 'Агуулга',
      }),
    );
  });

  it('sendEmail(): дараагийн дуудлагад transporter-ийг дахин ашиглана (нэг л удаа createTransport дуудна)', async () => {
    const provider = new SmtpNotificationProvider();
    await provider.sendEmail('a@b.mn', 's1', 'b1');
    await provider.sendEmail('c@d.mn', 's2', 'b2');

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it('sendSms(): vendor тохируулагдаагүй тул алдаа шидэлгүй стаб (no-op) хэвээр', async () => {
    const provider = new SmtpNotificationProvider();
    await expect(
      provider.sendSms('+97688112233', 'test'),
    ).resolves.toBeUndefined();
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
