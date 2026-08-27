import type { SupportTicketStatus } from '@prisma/client';

// docs/plan.md §7 модуль #13: "PATCH /support-tickets/:id (status,
// staff-only — IN_PROGRESS/RESOLVED/CLOSED, буруу шилжилт 400)" — CLOSED
// нь эцсийн (terminal) төлөв, OPEN рүү энэ endpoint-оор ХЭЗЭЭ Ч буцахгүй
// (зөвшөөрөгдсөн бүх target нь IN_PROGRESS/RESOLVED/CLOSED-ийн аль нэг).
// order-state-machine.ts-тэй ЯГ ижил "цэвэр функц" загвар.
const ALLOWED_TRANSITIONS: Record<
  SupportTicketStatus,
  readonly SupportTicketStatus[]
> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  // Харилцагч сэтгэл ханамжгүй бол staff дахин нээж болно (IN_PROGRESS).
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export function isTicketTransitionAllowed(
  from: SupportTicketStatus,
  to: SupportTicketStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
