import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrderEventsGateway } from './order-events.gateway.js';
import { OrderEventsPublisher } from './order-events.publisher.js';

// docs/plan.md §8 Phase 3b, Хэсэг A — WebSocket бодит цагийн мэдэгдэл.
// AuthModule-г импортлосон нь `OrderEventsGateway`-д `TokenVerifierService`
// (WebSocket handshake JWT баталгаажуулах, §6.2-той ижил) хэрэгтэй тул.
@Module({
  imports: [AuthModule],
  providers: [OrderEventsGateway, OrderEventsPublisher],
  exports: [OrderEventsPublisher],
})
export class RealtimeModule {}
