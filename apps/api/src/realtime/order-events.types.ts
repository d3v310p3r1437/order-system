import type { OrderStatus } from '@prisma/client';

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

export function orderRoom(orderId: string): string {
  return `order:${orderId}`;
}

export function branchRoom(branchId: string): string {
  return `branch:${branchId}`;
}
