import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/api";
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABELS } from "@/lib/order-status";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge className={ORDER_STATUS_BADGE_CLASS[status]}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
