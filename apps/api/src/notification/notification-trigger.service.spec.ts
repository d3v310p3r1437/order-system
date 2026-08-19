import { NotificationTrigger } from './notification-trigger.service.js';

function buildPrismaMock(
  user: { phone: string | null; email: string | null } | null,
) {
  const userFindUnique = jest.fn().mockResolvedValue(user);
  const tx = { user: { findUnique: userFindUnique } };
  return {
    prisma: {
      get tx() {
        return tx;
      },
    },
    userFindUnique,
  };
}

function buildRequestContextMock() {
  const callbacks: Array<() => void> = [];
  return {
    onCommit: jest.fn((cb: () => void) => callbacks.push(cb)),
    runCommitted: () => callbacks.forEach((cb) => cb()),
  };
}

function buildProviderMock() {
  return {
    sendSms: jest.fn().mockResolvedValue(undefined),
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };
}

describe('NotificationTrigger.notifyOrderStatusChanged', () => {
  it.each(['CONFIRMED', 'READY', 'COMPLETED'] as const)(
    '%s статуст onCommit бүртгэж, commit-ийн дараа phone+email хоёуланд илгээнэ',
    async (status) => {
      const { prisma, userFindUnique } = buildPrismaMock({
        phone: '+97688112233',
        email: 'customer@example.mn',
      });
      const requestContext = buildRequestContextMock();
      const provider = buildProviderMock();
      const trigger = new NotificationTrigger(
        prisma as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[0],
        requestContext as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[1],
        provider,
      );

      await trigger.notifyOrderStatusChanged({
        orderId: 'order-1',
        customerId: 'cust-1',
        newStatus: status,
      });

      // tx хараахан "committed" болоогүй байхад ч харилцагчийн мэдээллийг
      // аль хэдийн уншсан байх ёстой (onCommit-ийн ДОТОР биш, өмнө нь).
      expect(userFindUnique).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        select: { phone: true, email: true },
      });
      expect(provider.sendSms).not.toHaveBeenCalled();
      expect(provider.sendEmail).not.toHaveBeenCalled();

      requestContext.runCommitted();
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.sendSms).toHaveBeenCalledWith(
        '+97688112233',
        expect.any(String),
      );
      expect(provider.sendEmail).toHaveBeenCalledWith(
        'customer@example.mn',
        expect.any(String),
        expect.any(String),
      );
    },
  );

  it.each(['CREATED', 'PREPARING', 'CANCELLED'] as const)(
    '%s статуст onCommit огт бүртгэхгүй (харилцагчийн мэдээлэл ч уншихгүй)',
    async (status) => {
      const { prisma, userFindUnique } = buildPrismaMock({
        phone: '+97688112233',
        email: null,
      });
      const requestContext = buildRequestContextMock();
      const provider = buildProviderMock();
      const trigger = new NotificationTrigger(
        prisma as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[0],
        requestContext as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[1],
        provider,
      );

      await trigger.notifyOrderStatusChanged({
        orderId: 'order-1',
        customerId: 'cust-1',
        newStatus: status,
      });

      expect(userFindUnique).not.toHaveBeenCalled();
      expect(requestContext.onCommit).not.toHaveBeenCalled();
    },
  );

  it('email null бол зөвхөн sendSms дуудна, sendEmail-г огт дуудахгүй', async () => {
    const { prisma } = buildPrismaMock({ phone: '+97688112233', email: null });
    const requestContext = buildRequestContextMock();
    const provider = buildProviderMock();
    const trigger = new NotificationTrigger(
      prisma as unknown as ConstructorParameters<typeof NotificationTrigger>[0],
      requestContext as unknown as ConstructorParameters<
        typeof NotificationTrigger
      >[1],
      provider,
    );

    await trigger.notifyOrderStatusChanged({
      orderId: 'order-1',
      customerId: 'cust-1',
      newStatus: 'CONFIRMED',
    });
    requestContext.runCommitted();
    await Promise.resolve();
    await Promise.resolve();

    expect(provider.sendSms).toHaveBeenCalled();
    expect(provider.sendEmail).not.toHaveBeenCalled();
  });

  it('sendSms алдаа шидвэл ч (.catch()-оор баригдсан) throw хийхгүй', async () => {
    const { prisma } = buildPrismaMock({ phone: '+97688112233', email: null });
    const requestContext = buildRequestContextMock();
    const provider = buildProviderMock();
    provider.sendSms.mockRejectedValue(new Error('sms fail'));
    const trigger = new NotificationTrigger(
      prisma as unknown as ConstructorParameters<typeof NotificationTrigger>[0],
      requestContext as unknown as ConstructorParameters<
        typeof NotificationTrigger
      >[1],
      provider,
    );

    await trigger.notifyOrderStatusChanged({
      orderId: 'order-1',
      customerId: 'cust-1',
      newStatus: 'CONFIRMED',
    });

    expect(() => requestContext.runCommitted()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe('NotificationTrigger.notifyReturnStatusChanged', () => {
  it.each(['APPROVED', 'REJECTED'] as const)(
    '%s статуст мэдэгдэл илгээнэ',
    async (status) => {
      const { prisma } = buildPrismaMock({
        phone: '+97688112233',
        email: null,
      });
      const requestContext = buildRequestContextMock();
      const provider = buildProviderMock();
      const trigger = new NotificationTrigger(
        prisma as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[0],
        requestContext as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[1],
        provider,
      );

      await trigger.notifyReturnStatusChanged({
        returnRequestId: 'ret-1',
        customerId: 'cust-1',
        status,
      });
      requestContext.runCommitted();
      await Promise.resolve();
      await Promise.resolve();

      expect(provider.sendSms).toHaveBeenCalled();
    },
  );

  it.each(['REQUESTED', 'REFUNDED', 'REFUND_FAILED'] as const)(
    '%s статуст onCommit огт бүртгэхгүй',
    async (status) => {
      const { prisma, userFindUnique } = buildPrismaMock({
        phone: '+97688112233',
        email: null,
      });
      const requestContext = buildRequestContextMock();
      const provider = buildProviderMock();
      const trigger = new NotificationTrigger(
        prisma as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[0],
        requestContext as unknown as ConstructorParameters<
          typeof NotificationTrigger
        >[1],
        provider,
      );

      await trigger.notifyReturnStatusChanged({
        returnRequestId: 'ret-1',
        customerId: 'cust-1',
        status,
      });

      expect(userFindUnique).not.toHaveBeenCalled();
      expect(requestContext.onCommit).not.toHaveBeenCalled();
    },
  );
});
