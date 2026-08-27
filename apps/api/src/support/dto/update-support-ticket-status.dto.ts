import type { SupportTicketStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

// PATCH /support-tickets/:id: даалгаврын шууд заавар "staff-only —
// IN_PROGRESS/RESOLVED/CLOSED" — OPEN энд ЗОРИУДАА ороогүй (эхний OPEN
// төлөв зөвхөн @default(OPEN)-оор л тавигдана, энэ endpoint-оор буцаж
// OPEN рүү шилжих боломжгүй — support-ticket-state-machine.ts-тэй нийцнэ).
const TARGET_STATUSES: SupportTicketStatus[] = [
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

export class UpdateSupportTicketStatusDto {
  @IsIn(TARGET_STATUSES)
  status!: SupportTicketStatus;
}
