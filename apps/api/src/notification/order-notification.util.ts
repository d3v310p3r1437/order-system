import type { OrderStatus, ReturnStatus } from '@prisma/client';

export interface NotificationMessage {
  subject: string;
  smsBody: string;
  emailBody: string;
}

// docs/plan.md §8 Phase 4, Хэсэг B #14: order.status_changed event-ийн
// CONFIRMED/READY/COMPLETED статусуудад л мессеж бүрдүүлнэ (бусад статус
// дуудагдвал null буцаана — NotificationTrigger нь илгээхгүй, зөвхөн
// эдгээр 3 статусыг л trigger болгоно). Pure функц тул unit тестлэхэд
// хялбар (return-refund.util.ts/order-state-machine.ts-тэй адил хэв маяг).
const ORDER_STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'баталгаажлаа',
  READY: 'бэлэн боллоо',
  COMPLETED: 'хүргэгдлээ',
};

export function buildOrderStatusMessage(
  status: OrderStatus,
  orderId: string,
): NotificationMessage | null {
  const label = ORDER_STATUS_LABELS[status];
  if (!label) {
    return null;
  }
  const shortId = orderId.slice(0, 8);
  const subject = `Захиалга №${shortId} ${label}`;
  const body = `Таны №${shortId} захиалга ${label}.`;
  return { subject, smsBody: body, emailBody: body };
}

const RETURN_STATUS_LABELS: Partial<Record<ReturnStatus, string>> = {
  APPROVED: 'зөвшөөрөгдлөө',
  REJECTED: 'татгалзагдлаа',
};

export function buildReturnStatusMessage(
  status: ReturnStatus,
  returnRequestId: string,
): NotificationMessage | null {
  const label = RETURN_STATUS_LABELS[status];
  if (!label) {
    return null;
  }
  const shortId = returnRequestId.slice(0, 8);
  const subject = `Буцаалтын хүсэлт №${shortId} ${label}`;
  const body = `Таны №${shortId} буцаалтын хүсэлт ${label}.`;
  return { subject, smsBody: body, emailBody: body };
}
