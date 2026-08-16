import { Badge } from "@/components/ui/badge";
import type { AvailabilityResult } from "@/lib/api";

const STATUS_CONFIG: Record<
  AvailabilityResult["status"],
  { label: string; className: string }
> = {
  IN_STOCK: {
    label: "Бэлэн",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  PRE_ORDER: {
    label: "Захиалгаар",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  OUT_OF_STOCK: {
    label: "Дууссан",
    className:
      "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  },
};

// Backend-ийн computeAvailabilityStatus()-ийн тооцоолсон утгыг ЗӨВХӨН
// харуулна — IN_STOCK/PRE_ORDER/OUT_OF_STOCK шийдвэрийг энд дахин
// тооцоолохгүй (docs/adr/005-security-definer-pattern.md-ийн "ганц газар
// л шийднэ" зарчим frontend талд ч мөн хамаарна).
export function AvailabilityBadge({ status, leadDays }: AvailabilityResult) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge className={cfg.className}>
      {cfg.label}
      {status === "PRE_ORDER" && leadDays != null ? ` · ${leadDays} хоног` : ""}
    </Badge>
  );
}
