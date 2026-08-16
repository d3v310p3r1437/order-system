import type { OrderStatus } from '@prisma/client';

// docs/plan.md §8 Phase 3a: "CREATED→CONFIRMED→PREPARING→READY→COMPLETED,
// эсвэл CREATED/CONFIRMED→CANCELLED". Staff (RolesGuard-аар зөвшөөрөгдсөн
// дүрүүд) энэ бүх шилжилтийг хийж болно; CUSTOMER-ийн хувьд OrderService
// нэмэлтээр CREATED→CANCELLED-аас өөр аль ч шилжилтийг хориглодог (өөрийн
// эрхийн шалгалт, энэ файлд биш).
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isOrderTransitionAllowed(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Захиалгын нөөц буцаах (increment) шаардлагатай эсэх — зөвхөн CANCELLED
// болох үед (§7 модуль #6: "cancel/CANCELLED дээр inventory буцаж
// нэмэгдэх").
export function isRestockingTransition(to: OrderStatus): boolean {
  return to === 'CANCELLED';
}
