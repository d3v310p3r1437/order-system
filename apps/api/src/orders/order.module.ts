import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/roles.guard.js';
import { NotificationModule } from '../notification/notification.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { RoutingModule } from '../routing/routing.module.js';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';

// docs/plan.md §7 модуль #5 (Сагс ба захиалга үүсгэх), #6 (Захиалгын
// удирдлага) — Phase 3a-д нэг модульд нэгтгэв (§7 модуль #3-ийн
// catalog.module.ts-тэй адил). Phase 3b: RealtimeModule (статус
// өөрчлөгдөх бүрт WebSocket event), PaymentModule (checkout дээр
// PaymentProvider.createInvoice()) нэмэгдэв. Phase 4: RoutingModule
// (GET /:id/route), NotificationModule (статус өөрчлөгдөх бүрт
// SMS/email мэдэгдэл).
@Module({
  imports: [RealtimeModule, PaymentModule, RoutingModule, NotificationModule],
  controllers: [OrderController],
  providers: [OrderService, RolesGuard],
})
export class OrderModule {}
