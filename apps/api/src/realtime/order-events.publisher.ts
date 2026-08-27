import { Injectable } from '@nestjs/common';
import { RequestContextService } from '../common/request-context.js';
import { OrderEventsGateway } from './order-events.gateway.js';
import type {
  OrderPaymentConfirmedPayload,
  OrderStatusChangedPayload,
  ReturnStatusChangedPayload,
  SupportMessageCreatedPayload,
} from './order-events.types.js';

// OrderService-ийн ганц холбоос энэ модультай — `OrderEventsGateway`
// (Socket.io-той шууд харьцдаг)-ийг шууд импортлохгүй, зөвхөн энэ нимгэн
// wrapper-ээр дамжина (unit тестэд mock хийхэд хялбар, WS internals-аас
// тусгаарлагдсан).
//
// ⚠️ Publish хийхийг ШУУД биш, `RequestContextService.onCommit()`-оор
// хойшлуулна — учир нь `OrderService` RlsMiddleware-ийн нэг л том
// interactive transaction (docs/adr/001) дотор ажилладаг тул энд шууд
// event нийтэлбэл, ХЭРЭВ дараа нь (ижил хүсэлтийн явцад) өөр шалтгаанаар
// уг transaction commit хийгдэхгүй бол (жиш: response бичихэд алдаа
// гарах) хэрэглэгчид "худал" (DB-д бодитоор хадгалагдаагүй) event очих
// эрсдэлтэй. `onCommit()` transaction амжилттай COMMIT хийгдсэний ДАРАА
// л дуудагдахыг баталгаажуулдаг (`RlsMiddleware`-г үз).
@Injectable()
export class OrderEventsPublisher {
  constructor(
    private readonly gateway: OrderEventsGateway,
    private readonly requestContext: RequestContextService,
  ) {}

  publishOrderStatusChanged(payload: OrderStatusChangedPayload): void {
    this.requestContext.onCommit(() => {
      this.gateway.emitOrderStatusChanged(payload);
    });
  }

  publishOrderPaymentConfirmed(payload: OrderPaymentConfirmedPayload): void {
    this.requestContext.onCommit(() => {
      this.gateway.emitOrderPaymentConfirmed(payload);
    });
  }

  publishReturnStatusChanged(payload: ReturnStatusChangedPayload): void {
    this.requestContext.onCommit(() => {
      this.gateway.emitReturnStatusChanged(payload);
    });
  }

  publishSupportMessageCreated(payload: SupportMessageCreatedPayload): void {
    this.requestContext.onCommit(() => {
      this.gateway.emitSupportMessageCreated(payload);
    });
  }
}
