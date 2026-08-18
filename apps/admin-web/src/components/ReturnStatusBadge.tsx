import { Badge } from "@/components/ui/badge";
import type { ReturnStatus } from "@/lib/api";
import {
  RETURN_STATUS_BADGE_CLASS,
  RETURN_STATUS_LABELS,
} from "@/lib/return-status";

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <Badge className={RETURN_STATUS_BADGE_CLASS[status]}>
      {RETURN_STATUS_LABELS[status]}
    </Badge>
  );
}
