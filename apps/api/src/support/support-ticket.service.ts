import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  SupportTicketCategory,
  SupportTicketStatus,
} from '@prisma/client';
import { isRecordNotFoundError } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderEventsPublisher } from '../realtime/order-events.publisher.js';
import type { CreateSupportMessageDto } from './dto/create-support-message.dto.js';
import type { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import type { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto.js';
import { isTicketTransitionAllowed } from './support-ticket-state-machine.js';

const TICKET_NOT_FOUND = {
  code: 'SUPPORT_TICKET_NOT_FOUND',
  message: 'Тасалбар олдсонгүй',
};
const ORDER_NOT_FOUND = {
  code: 'ORDER_NOT_FOUND',
  message: 'Захиалга олдсонгүй',
};
const INVALID_TRANSITION = {
  code: 'INVALID_TICKET_STATUS_TRANSITION',
  message: 'Тасалбарын энэ төлөвийн шилжилт зөвшөөрөгдөөгүй байна',
};
const TICKET_CLOSED = {
  code: 'SUPPORT_TICKET_CLOSED',
  message: 'Хаагдсан тасалбарт мессеж бичих боломжгүй',
};

const TICKET_WITH_MESSAGES_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' } },
} as const;

// docs/plan.md §7 модуль #13. ADR 005-ийн зарчмаар шинэ SECURITY DEFINER
// функц ЗОХИОГООГҮЙ — support_tickets_select/insert/update,
// support_messages_select/insert RLS (enable_support_tickets_rls
// migration) л эрхийг сүүлчийн давхаргад хамгаалдаг, энэ service зөвхөн
// RLS-ийн нөхцлийг тольдсон UX-friendly урьдчилсан шалгалт хийдэг
// (review.service.ts/return-request.service.ts-тэй ижил загвар).
@Injectable()
export class SupportTicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketEvents: OrderEventsPublisher,
  ) {}

  // RLS (support_tickets_select) нь дүрд харагдахгүй мөрийг өөрөө шүүж
  // хасна (харилцагч: өөрийнх, staff: харах эрхтэй бүгд) — filter зөвхөн
  // тодруулга.
  findAll(filter: {
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
  }) {
    return this.prisma.tx.supportTicket.findMany({
      where: { status: filter.status, category: filter.category },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.tx.supportTicket.findUnique({
      where: { id },
      include: TICKET_WITH_MESSAGES_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException(TICKET_NOT_FOUND);
    }
    return ticket;
  }

  // §7 модуль #13, 1: subject/category/orderId?.
  async create(customerId: string, dto: CreateSupportTicketDto) {
    // orders_select RLS нь CUSTOMER-д зөвхөн ӨӨРИЙН захиалгыг харуулдаг
    // тул өөр хэрэглэгчийн orderId дамжуулбал энд null ирнэ (эрхийн
    // алдагдалгүйгээр 404) — support_tickets_insert-ийн WITH CHECK мөн
    // адил join-оор давхар баталгаажуулна (return-request.service.ts-ийн
    // create()-тэй ЯГ ижил зарчим).
    if (dto.orderId) {
      const order = await this.prisma.tx.order.findUnique({
        where: { id: dto.orderId },
        select: { id: true },
      });
      if (!order) {
        throw new NotFoundException(ORDER_NOT_FOUND);
      }
    }

    return this.prisma.tx.supportTicket.create({
      data: {
        customerId,
        orderId: dto.orderId,
        subject: dto.subject,
        category: dto.category,
      },
      include: TICKET_WITH_MESSAGES_INCLUDE,
    });
  }

  // PATCH /support-tickets/:id: staff-only (controller-ийн @Roles()-оор
  // хамгаалагдсан, OWNER/CUSTOMER орохгүй). support_tickets_update RLS
  // (branch-scoped staff-ийн хувьд SELECT-тэй ЯГ ижил нөхцөл) энэ
  // Prisma typed .update()-тэй уялдана — RolesGuard-аар зөвшөөрөгдсөн
  // дүр бүрд SELECT/UPDATE аль аль нь ижил тохирдог тул нормал урсгалд
  // isRecordNotFoundError ХЭЗЭЭ Ч хөндөгдөхгүй, гэхдээ (жиш: race,
  // orderId цэвэрлэгдсэн) хамгаалалт болгон үлдээв.
  async updateStatus(id: string, dto: UpdateSupportTicketStatusDto) {
    const ticket = await this.findOne(id);
    if (!isTicketTransitionAllowed(ticket.status, dto.status)) {
      throw new BadRequestException(INVALID_TRANSITION);
    }

    try {
      await this.prisma.tx.supportTicket.update({
        where: { id },
        data: {
          status: dto.status,
          resolvedAt:
            dto.status === 'RESOLVED' ? new Date() : ticket.resolvedAt,
          closedAt: dto.status === 'CLOSED' ? new Date() : ticket.closedAt,
        },
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundException(TICKET_NOT_FOUND);
      }
      throw error;
    }
    return this.findOne(id);
  }

  // §7 модуль #13, 3: POST /support-tickets/:id/messages. CUSTOMER
  // (эцэг тасалбарын ЭЗЭН) ЗӨВХӨН ticket.status != 'CLOSED' үед л мессеж
  // нэмж болно — support_messages_insert-ийн WITH CHECK-тэй ЯГ ижил
  // нөхцлийг ЭНД урьдчилан (findOne()-ийн RLS SELECT-ээр аль хэдийн
  // "харагдах" эсэхийг баталгаажуулсны дараа) шалгаж, RLS-ийг зорин
  // "татгалзуулж" 500 маягийн raw SQL алдаа гаргуулахгүй, тодорхой 403
  // буцаана (staff-д ийм хязгаарлалт байхгүй тул senderId===
  // ticket.customerId биш тохиолдолд алгасна).
  async addMessage(
    ticketId: string,
    senderId: string,
    dto: CreateSupportMessageDto,
  ) {
    const ticket = await this.findOne(ticketId);
    if (ticket.customerId === senderId && ticket.status === 'CLOSED') {
      throw new ForbiddenException(TICKET_CLOSED);
    }

    const message = await this.prisma.tx.supportMessage.create({
      data: { ticketId, senderId, body: dto.body },
    });

    // §7 модуль #13, 4: onCommit()-гэйт (RealtimeModule-ийн бусад
    // publish*-тэй ЯГ ижил зарчим) — RLS transaction бодитоор COMMIT
    // хийгдсэний ДАРАА л WebSocket event явна.
    this.ticketEvents.publishSupportMessageCreated({
      ticketId,
      messageId: message.id,
      senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    });

    return message;
  }
}
