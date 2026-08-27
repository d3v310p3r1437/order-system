import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { SupportTicketController } from './support-ticket.controller.js';
import { SupportTicketService } from './support-ticket.service.js';

// docs/plan.md §7 модуль #13 (Харилцагчийн үйлчилгээ). RealtimeModule-ийг
// OrderModule/ReturnModule-той ижил зарчмаар дахин ашиглав (support.
// message.created event, OrderEventsPublisher-ийн нэг мэдэгдлийн
// системд нэгтгэсэн — тусдаа WS gateway зохиогоогүй).
@Module({
  imports: [RealtimeModule],
  controllers: [SupportTicketController],
  providers: [SupportTicketService, RolesGuard],
})
export class SupportModule {}
