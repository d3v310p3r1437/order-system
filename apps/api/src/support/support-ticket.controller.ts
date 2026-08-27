import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Audit } from '../common/audit.decorator.js';
import { RequestContextService } from '../common/request-context.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { CreateSupportMessageDto } from './dto/create-support-message.dto.js';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import { SupportTicketQueryDto } from './dto/support-ticket-query.dto.js';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto.js';
import { SupportTicketService } from './support-ticket.service.js';

// PATCH-ийн статус шинэчлэлт staff-only (даалгаврын шууд заавар) —
// support_tickets_update RLS-тэй (20260827120500 migration) ЯГ тохирно:
// OWNER (зөвхөн R бүх) БОЛОН CUSTOMER орохгүй.
const STATUS_UPDATE_ROLES = [
  'SUPER_ADMIN',
  'ALL_BRANCH_MANAGER',
  'BRANCH_ADMIN',
  'BRANCH_MANAGER',
  'SALESPERSON',
] as const;

@Controller('support-tickets')
@UseGuards(RolesGuard)
export class SupportTicketController {
  constructor(
    private readonly ticketService: SupportTicketService,
    private readonly requestContext: RequestContextService,
  ) {}

  // RLS (support_tickets_select) дүрд харагдах мөрийг өөрөө шүүнэ —
  // @Roles()-гүй тул зөвхөн нэвтэрсэн байхыг шаардана.
  @Get()
  findAll(@Query() query: SupportTicketQueryDto) {
    return this.ticketService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketService.findOne(id);
  }

  // §7 модуль #13, 3: зөвхөн CUSTOMER — support_tickets_insert RLS-тэй нийцнэ.
  @Post()
  @Roles('CUSTOMER')
  @Audit('support_tickets')
  create(@Body() dto: CreateSupportTicketDto) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.ticketService.create(userId, dto);
  }

  // CUSTOMER (өөрийн тасалбар) БОЛОН staff (харах эрхтэй тасалбар)
  // хоёулаа мессеж нэмж болно — @Roles()-гүй, RLS (support_messages_insert)
  // л эцсийн зөвшөөрлийг шийднэ (CLOSED тохиолдлыг SupportTicketService
  // урьдчилан шалгаж 403 болгоно). ⚠️ Route param-ыг ЗОРИУДАА `:id` БИШ
  // `:ticketId` гэж нэрлэв (ReviewProductController-ийн `:productId`-тэй
  // ижил зарчим) — AuditInterceptor.writeAuditLog()-ийн анхдагч
  // `req.params.id` fallback нь ЭНД тасалбарын id-г (мессежийн ӨӨРИЙН
  // id-ийн оронд) recordId болгож санамсаргүй авчихаас сэргийлнэ; param
  // нэр өөр байснаар recordId шууд responseBody.id (шинэ мессежийн id)
  // рүү унана.
  @Post(':ticketId/messages')
  @Audit('support_messages')
  addMessage(
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    const { userId } = this.requestContext.get();
    if (!userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Нэвтрээгүй байна',
      });
    }
    return this.ticketService.addMessage(ticketId, userId, dto);
  }

  @Patch(':id')
  @Roles(...STATUS_UPDATE_ROLES)
  @Audit('support_tickets', { action: 'support_tickets.status_changed' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketStatusDto,
  ) {
    return this.ticketService.updateStatus(id, dto);
  }
}
