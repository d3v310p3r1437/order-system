import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getReturnRequests, type ReturnStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { RETURN_STATUS_LABELS } from "@/lib/return-status";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReturnStatusBadge } from "@/components/ReturnStatusBadge";

const ALL_STATUSES = Object.keys(RETURN_STATUS_LABELS) as ReturnStatus[];
const STATUS_FILTER_ALL = "ALL";

// §7 модуль #9 7-р зүйл: "Буцаалтууд" (/returns) — жагсаалт (статусаар
// шүүх). RLS (return_requests_select) хэрэглэгчийн эрхээр аль хэдийн
// шүүсэн байдаг тул admin-web талд дахин шүүлт хийхгүй.
export function ReturnsPage() {
  const { accessToken } = useAuth();
  const [statusFilter, setStatusFilter] = useState<
    ReturnStatus | typeof STATUS_FILTER_ALL
  >(STATUS_FILTER_ALL);

  const returnsQuery = useQuery({
    queryKey: ["returns", statusFilter],
    queryFn: () =>
      getReturnRequests(accessToken, {
        status: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter,
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Буцаалтууд</h1>
        <p className="text-sm text-muted-foreground">
          Харилцагчийн буцаалт хүссэн хүсэлтүүд, статусаар шүүх боломжтой.
        </p>
      </div>

      <div className="w-full max-w-xs">
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as ReturnStatus | typeof STATUS_FILTER_ALL)
          }
        >
          <SelectTrigger className="w-full" aria-label="Статусаар шүүх">
            <SelectValue placeholder="Статусаар шүүх" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_FILTER_ALL}>Бүх статус</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {RETURN_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent>
          {returnsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {returnsQuery.isError && (
            <p className="text-sm text-destructive">
              Буцаалтын мэдээлэл татахад алдаа гарлаа (эрхээ шалгана уу).
            </p>
          )}
          {returnsQuery.isSuccess && returnsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Энэ шүүлтүүрт тохирох буцаалтын хүсэлт алга.
            </p>
          )}

          <ul className="divide-y divide-border">
            {(returnsQuery.data ?? []).map((rr) => (
              <li key={rr.id}>
                <Link
                  to={`/returns/${rr.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      №{rr.id.slice(0, 8)} · захиалга №
                      {rr.orderItem.orderId.slice(0, 8)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {rr.reason}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(rr.requestedAt).toLocaleString("mn-MN")}
                    </span>
                  </div>
                  <ReturnStatusBadge status={rr.status} />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
