import type { OrderStatus, ReturnStatus } from '@prisma/client';

// docs/plan.md Phase 3b, Хэсэг A #2: PATCH /orders/:id/status амжилттай
// ажилласан бүрт нийтлэгдэх event-ийн payload хэлбэр.
export interface OrderStatusChangedPayload {
  orderId: string;
  branchId: string;
  customerId: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
}

export const ORDER_STATUS_CHANGED_EVENT = 'order.status_changed';

// docs/adr/006-qpay-verify-dont-trust.md: webhook-ийн server-to-server
// баталгаажуулалтаар Order.paidAt ШИНЭЭР тавигдсан (idempotent давталт
// биш) үед л нийтлэгдэнэ.
export interface OrderPaymentConfirmedPayload {
  orderId: string;
  branchId: string;
  customerId: string;
}

export const ORDER_PAYMENT_CONFIRMED_EVENT = 'order.payment_confirmed';

// §7 модуль #9, §8 Phase 3c: PATCH /returns/:id/approve|reject амжилттай
// ажилласан бүрт нийтлэгдэнэ — orderRoom/branchRoom-г ДАХИН АШИГЛАВ (шинэ
// "return:*" room зохиогоогүй, буцаалт нь угаасаа тодорхой Order-той
// холбоотой тул тухайн orderId/branchId-ийн одоо байгаа room-д хангалттай).
export interface ReturnStatusChangedPayload {
  returnRequestId: string;
  orderId: string;
  branchId: string;
  customerId: string;
  status: ReturnStatus;
}

export const RETURN_STATUS_CHANGED_EVENT = 'return.status_changed';

export function orderRoom(orderId: string): string {
  return `order:${orderId}`;
}

export function branchRoom(branchId: string): string {
  return `branch:${branchId}`;
}
