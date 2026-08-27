import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SupportTicketService } from './support-ticket.service.js';

function buildPrismaMock() {
  const orderFindUnique = jest.fn();
  const supportTicketFindUnique = jest.fn();
  const supportTicketFindMany = jest.fn();
  const supportTicketCreate = jest.fn();
  const supportTicketUpdate = jest.fn();
  const supportMessageCreate = jest.fn();

  const tx = {
    order: { findUnique: orderFindUnique },
    supportTicket: {
      findUnique: supportTicketFindUnique,
      findMany: supportTicketFindMany,
      create: supportTicketCreate,
      update: supportTicketUpdate,
    },
    supportMessage: { create: supportMessageCreate },
  };

  const prisma = {
    get tx() {
      return tx;
    },
  };

  return {
    prisma,
    mocks: {
      orderFindUnique,
      supportTicketFindUnique,
      supportTicketFindMany,
      supportTicketCreate,
      supportTicketUpdate,
      supportMessageCreate,
    },
  };
}

function newService(prisma: unknown, ticketEvents?: unknown) {
  return new SupportTicketService(
    prisma as ConstructorParameters<typeof SupportTicketService>[0],
    (ticketEvents ?? {
      publishSupportMessageCreated: jest.fn(),
    }) as ConstructorParameters<typeof SupportTicketService>[1],
  );
}

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('mock', {
    code,
    clientVersion: '6.19.3',
  });
}

describe('SupportTicketService.create', () => {
  it('orderId өгөгдөөгүй бол Order-ийг шалгахгүйгээр шууд ticket үүсгэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketCreate.mockResolvedValue({ id: 't-1' });
    const service = newService(prisma);

    const result = await service.create('cust-1', {
      subject: 'Асуулт',
      category: 'OTHER',
    });

    expect(result).toEqual({ id: 't-1' });
    expect(mocks.orderFindUnique).not.toHaveBeenCalled();
    expect(mocks.supportTicketCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          customerId: 'cust-1',
          orderId: undefined,
          subject: 'Асуулт',
          category: 'OTHER',
        },
      }),
    );
  });

  it('orderId өгөгдсөн ч orders_select RLS-ээр харагдахгүй (өөр хэрэглэгчийн захиалга) бол NotFoundException', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue(null);
    const service = newService(prisma);

    await expect(
      service.create('cust-1', {
        subject: 'Асуулт',
        category: 'ORDER_ISSUE',
        orderId: 'o-other',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.supportTicketCreate).not.toHaveBeenCalled();
  });

  it('orderId ЖИНХЭНЭ өөрийнх нь захиалга бол амжилттай ticket үүсгэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.orderFindUnique.mockResolvedValue({ id: 'o-1' });
    mocks.supportTicketCreate.mockResolvedValue({ id: 't-1', orderId: 'o-1' });
    const service = newService(prisma);

    const result = await service.create('cust-1', {
      subject: 'Захиалга ирээгүй',
      category: 'ORDER_ISSUE',
      orderId: 'o-1',
    });

    expect(result.orderId).toBe('o-1');
  });
});

describe('SupportTicketService.updateStatus', () => {
  it('буруу шилжилт (жиш: OPEN дахин OPEN) BadRequestException', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketFindUnique.mockResolvedValue({
      id: 't-1',
      status: 'CLOSED',
    });
    const service = newService(prisma);

    await expect(
      service.updateStatus('t-1', { status: 'IN_PROGRESS' }),
    ).rejects.toThrow(BadRequestException);
    expect(mocks.supportTicketUpdate).not.toHaveBeenCalled();
  });

  it('зөв шилжилт (OPEN→IN_PROGRESS) амжилттай, resolvedAt/closedAt хөндөгдөхгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketFindUnique
      .mockResolvedValueOnce({
        id: 't-1',
        status: 'OPEN',
        resolvedAt: null,
        closedAt: null,
      })
      .mockResolvedValueOnce({ id: 't-1', status: 'IN_PROGRESS' });
    const service = newService(prisma);

    await service.updateStatus('t-1', { status: 'IN_PROGRESS' });

    expect(mocks.supportTicketUpdate).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { status: 'IN_PROGRESS', resolvedAt: null, closedAt: null },
    });
  });

  it('RESOLVED рүү шилжихэд resolvedAt=one тавигдана', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketFindUnique
      .mockResolvedValueOnce({
        id: 't-1',
        status: 'OPEN',
        resolvedAt: null,
        closedAt: null,
      })
      .mockResolvedValueOnce({ id: 't-1', status: 'RESOLVED' });
    const service = newService(prisma);

    await service.updateStatus('t-1', { status: 'RESOLVED' });

    const updateArgs = (
      mocks.supportTicketUpdate.mock.calls[0] as unknown[]
    )[0] as {
      where: { id: string };
      data: {
        status: string;
        resolvedAt?: Date | null;
        closedAt?: Date | null;
      };
    };
    expect(updateArgs.where).toEqual({ id: 't-1' });
    expect(updateArgs.data.status).toBe('RESOLVED');
    expect(updateArgs.data.resolvedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.closedAt).toBeNull();
  });

  it('RLS-ээр UPDATE 0-мөр (P2025) NotFoundException болно', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketFindUnique.mockResolvedValue({
      id: 't-1',
      status: 'OPEN',
      resolvedAt: null,
      closedAt: null,
    });
    mocks.supportTicketUpdate.mockRejectedValue(knownRequestError('P2025'));
    const service = newService(prisma);

    await expect(
      service.updateStatus('t-1', { status: 'IN_PROGRESS' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SupportTicketService.addMessage', () => {
  it('CUSTOMER (тасалбарын ЭЗЭН) CLOSED тасалбарт бичихийг оролдвол ForbiddenException, INSERT ОГТ дуудагдахгүй', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketFindUnique.mockResolvedValue({
      id: 't-1',
      customerId: 'cust-1',
      status: 'CLOSED',
    });
    const service = newService(prisma);

    await expect(
      service.addMessage('t-1', 'cust-1', { body: 'Сайн байна уу' }),
    ).rejects.toThrow(ForbiddenException);
    expect(mocks.supportMessageCreate).not.toHaveBeenCalled();
  });

  it('staff (customerId != senderId) CLOSED тасалбарт ч мессеж бичиж болно', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketFindUnique.mockResolvedValue({
      id: 't-1',
      customerId: 'cust-1',
      status: 'CLOSED',
    });
    mocks.supportMessageCreate.mockResolvedValue({
      id: 'm-1',
      ticketId: 't-1',
      senderId: 'staff-1',
      body: 'Хаагдсан ч гэсэн тайлбар',
      createdAt: new Date('2026-08-27T00:00:00.000Z'),
    });
    const service = newService(prisma);

    const result = await service.addMessage('t-1', 'staff-1', {
      body: 'Хаагдсан ч гэсэн тайлбар',
    });

    expect(result.id).toBe('m-1');
  });

  it('OPEN тасалбарт CUSTOMER мессеж нэмэхэд амжилттай, event onCommit()-оор нийтлэгдэнэ', async () => {
    const { prisma, mocks } = buildPrismaMock();
    mocks.supportTicketFindUnique.mockResolvedValue({
      id: 't-1',
      customerId: 'cust-1',
      status: 'OPEN',
    });
    mocks.supportMessageCreate.mockResolvedValue({
      id: 'm-1',
      ticketId: 't-1',
      senderId: 'cust-1',
      body: 'Сайн байна уу',
      createdAt: new Date('2026-08-27T00:00:00.000Z'),
    });
    const publishSupportMessageCreated = jest.fn();
    const service = newService(prisma, { publishSupportMessageCreated });

    const result = await service.addMessage('t-1', 'cust-1', {
      body: 'Сайн байна уу',
    });

    expect(result.id).toBe('m-1');
    expect(publishSupportMessageCreated).toHaveBeenCalledWith({
      ticketId: 't-1',
      messageId: 'm-1',
      senderId: 'cust-1',
      body: 'Сайн байна уу',
      createdAt: '2026-08-27T00:00:00.000Z',
    });
  });
});
