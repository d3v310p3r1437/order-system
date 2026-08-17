import type { ReturnStatus } from "@/lib/api";

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Хүсэлт гаргасан",
  APPROVED: "Зөвшөөрсөн",
  REJECTED: "Татгалзсан",
  REFUNDED: "Буцаагдсан",
  REFUND_FAILED: "Буцаалт амжилтгүй",
};

export const RETURN_STATUS_BADGE_CLASS: Record<ReturnStatus, string> = {
  REQUESTED:
    "bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-300",
  APPROVED:
    "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  REFUNDED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  REFUND_FAILED:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};
