import type { SupportTicketCategory, SupportTicketStatus } from "@/lib/api";

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Нээлттэй",
  IN_PROGRESS: "Шийдвэрлэж байгаа",
  RESOLVED: "Шийдэгдсэн",
  CLOSED: "Хаагдсан",
};

export const SUPPORT_TICKET_STATUS_BADGE_CLASS: Record<
  SupportTicketStatus,
  string
> = {
  OPEN: "bg-slate-100 text-slate-800 dark:bg-slate-500/15 dark:text-slate-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  RESOLVED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  CLOSED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export const SUPPORT_TICKET_CATEGORY_LABELS: Record<
  SupportTicketCategory,
  string
> = {
  ORDER_ISSUE: "Захиалгын асуудал",
  PAYMENT_ISSUE: "Төлбөрийн асуудал",
  DELIVERY_ISSUE: "Хүргэлтийн асуудал",
  PRODUCT_QUESTION: "Бүтээгдэхүүний асуулт",
  ACCOUNT_ISSUE: "Хэрэглэгчийн эрхийн асуудал",
  OTHER: "Бусад",
};

// support-ticket-state-machine.ts-тэй (apps/api) ЯГ тохирно — PATCH
// /support-tickets/:id-ийн зөвшөөрөгдсөн target статус бүрд аль товч
// харуулахыг шийднэ.
export const SUPPORT_TICKET_ALLOWED_TRANSITIONS: Record<
  SupportTicketStatus,
  readonly SupportTicketStatus[]
> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
};
