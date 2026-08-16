import type { OrderStatus } from "@/lib/api";

// ЗӨВХӨН UX (аль товчийг харуулах) — жинхэнэ хамгаалалт
// apps/api/src/orders/order-state-machine.ts (isOrderTransitionAllowed)
// дээр, RolesGuard/RLS-ээр бэхлэгдсэн. Энд ЯГ ТААРАХ ёстой.
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function allowedNextStatuses(
  status: OrderStatus,
): readonly OrderStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: "Үүсгэсэн",
  CONFIRMED: "Баталгаажсан",
  PREPARING: "Бэлтгэж байна",
  READY: "Бэлэн болсон",
  COMPLETED: "Дууссан",
  CANCELLED: "Цуцалсан",
};

export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  CREATED:
    "bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-300",
  CONFIRMED:
    "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  PREPARING:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  READY:
    "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  COMPLETED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};
