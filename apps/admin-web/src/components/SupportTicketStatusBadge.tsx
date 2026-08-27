import { Badge } from "@/components/ui/badge";
import type { SupportTicketStatus } from "@/lib/api";
import {
  SUPPORT_TICKET_STATUS_BADGE_CLASS,
  SUPPORT_TICKET_STATUS_LABELS,
} from "@/lib/support-status";

export function SupportTicketStatusBadge({
  status,
}: {
  status: SupportTicketStatus;
}) {
  return (
    <Badge className={SUPPORT_TICKET_STATUS_BADGE_CLASS[status]}>
      {SUPPORT_TICKET_STATUS_LABELS[status]}
    </Badge>
  );
}
