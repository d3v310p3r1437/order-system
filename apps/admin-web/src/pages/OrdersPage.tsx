import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getBranches, getOrders, type OrderStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

const ALL_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];
const STATUS_FILTER_ALL = "ALL";

// §6.1 матриц "Захиалга" мөр: жагсаалт RLS (orders_select)-ээр аль хэдийн
// хэрэглэгчийн эрхээр шүүгдсэн байдаг (жиш: SALESPERSON зөвхөн өөрийн
// салбарынхаа захиалгыг харна) — admin-web талд дахин шүүлт хийхгүй.
export function OrdersPage() {
  const { accessToken } = useAuth();

  const [branchId, setBranchId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | typeof STATUS_FILTER_ALL>(
    STATUS_FILTER_ALL,
  );

  const branchesQuery = useQuery({
    queryKey: ["branches", accessToken],
    queryFn: () => getBranches(accessToken),
  });

  useEffect(() => {
    if (!branchId && branchesQuery.data && branchesQuery.data.length > 0) {
      setBranchId(branchesQuery.data[0].id);
    }
  }, [branchesQuery.data, branchId]);

  const ordersQuery = useQuery({
    queryKey: ["orders", branchId, statusFilter],
    queryFn: () =>
      getOrders(accessToken, {
        branchId: branchId ?? undefined,
        status: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter,
      }),
    enabled: !!branchId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Захиалгууд</h1>
        <p className="text-sm text-muted-foreground">
          Сонгосон салбарын захиалгын жагсаалт, статусаар шүүх боломжтой.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {branchesQuery.data && branchesQuery.data.length > 1 && (
          <div className="w-full max-w-xs">
            <Select value={branchId ?? undefined} onValueChange={setBranchId}>
              <SelectTrigger className="w-full" aria-label="Салбар сонгох">
                <SelectValue placeholder="Салбар сонгох" />
              </SelectTrigger>
              <SelectContent>
                {branchesQuery.data.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="w-full max-w-xs">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as OrderStatus | typeof STATUS_FILTER_ALL)}
          >
            <SelectTrigger className="w-full" aria-label="Статусаар шүүх">
              <SelectValue placeholder="Статусаар шүүх" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_FILTER_ALL}>Бүх статус</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent>
          {!branchesQuery.isLoading &&
            (branchesQuery.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Танд хандах эрхтэй салбар алга.
              </p>
            )}

          {ordersQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {ordersQuery.isError && (
            <p className="text-sm text-destructive">
              Захиалгын мэдээлэл татахад алдаа гарлаа (эрхээ шалгана уу).
            </p>
          )}
          {ordersQuery.isSuccess && ordersQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Энэ шүүлтүүрт тохирох захиалга алга.
            </p>
          )}

          <ul className="divide-y divide-border">
            {(ordersQuery.data ?? []).map((order) => (
              <li key={order.id}>
                <Link
                  to={`/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      №{order.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleString("mn-MN")} ·{" "}
                      {order.items.length} нэр төрөл
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium">
                      {Number(order.totalAmount).toLocaleString("mn-MN")}₮
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
