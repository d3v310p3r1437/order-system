import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrder, updateOrderStatus, type OrderStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ORDER_STATUS_UPDATE_ROLES } from "@/lib/roles";
import { allowedNextStatuses, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

// docs/plan.md §8 Phase 3a 7-р зүйл: "статус шинэчлэх товч (state
// machine-ийн дагуу зөвшөөрөгдсөн шилжилтүүдийг л харуул)".
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, hasRole } = useAuth();
  const canUpdateStatus = hasRole(ORDER_STATUS_UPDATE_ROLES);
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(accessToken, id as string),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) =>
      updateOrderStatus(accessToken, id as string, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["order", id] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (orderQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>;
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <p className="text-sm text-destructive">
        Захиалга олдсонгүй эсвэл татахад алдаа гарлаа.
      </p>
    );
  }

  const order = orderQuery.data;
  const nextStatuses = allowedNextStatuses(order.status);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/orders"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Захиалгууд руу буцах
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Захиалга №{order.id.slice(0, 8)}
          </h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date(order.createdAt).toLocaleString("mn-MN")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Бараа</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {item.variantId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.quantity} ×{" "}
                    {Number(item.unitPriceSnapshot).toLocaleString("mn-MN")}₮
                  </span>
                </div>
                <span className="text-sm font-medium">
                  {(item.quantity * Number(item.unitPriceSnapshot)).toLocaleString(
                    "mn-MN",
                  )}
                  ₮
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-medium">Нийт дүн</span>
            <span className="text-sm font-semibold">
              {Number(order.totalAmount).toLocaleString("mn-MN")}₮
            </span>
          </div>
        </CardContent>
      </Card>

      {canUpdateStatus && nextStatuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Статус шинэчлэх</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                variant={status === "CANCELLED" ? "destructive" : "default"}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(status)}
              >
                {ORDER_STATUS_LABELS[status]} болгох
              </Button>
            ))}
          </CardContent>
          {statusMutation.isError && (
            <CardContent className="pt-0 text-sm text-destructive">
              Статус шинэчлэхэд алдаа гарлаа.
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
