import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrder,
  getOrderRoute,
  updateOrderStatus,
  type OrderStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ORDER_STATUS_UPDATE_ROLES } from "@/lib/roles";
import { allowedNextStatuses, ORDER_STATUS_LABELS } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliveryRouteMap } from "@/components/DeliveryRouteMap";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

// docs/plan.md §8 Phase 3a 7-р зүйл: "статус шинэчлэх товч (state
// machine-ийн дагуу зөвшөөрөгдсөн шилжилтүүдийг л харуул)".
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, hasRole } = useAuth();
  const canUpdateStatus = hasRole(ORDER_STATUS_UPDATE_ROLES);
  // apps/api/src/orders/order.controller.ts-ийн ROUTE_VIEW_ROLES-тэй ЯГ
  // тохирно (SUPER_ADMIN/ALL_BRANCH_MANAGER/BRANCH_ADMIN/BRANCH_MANAGER/
  // SALESPERSON) — ORDER_STATUS_UPDATE_ROLES-той давхцдаг тул шинэ
  // тогтмол зохиогоогүй, дахин ашиглав.
  const canViewRoute = hasRole(ORDER_STATUS_UPDATE_ROLES);
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ["order", id],
    queryFn: () => getOrder(accessToken, id as string),
    enabled: !!id,
  });

  const isDelivery = orderQuery.data?.deliveryMethod === "DELIVERY";
  const routeQuery = useQuery({
    queryKey: ["order-route", id],
    queryFn: () => getOrderRoute(accessToken, id as string),
    enabled: !!id && isDelivery && canViewRoute,
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

      {isDelivery && (
        <Card>
          <CardHeader>
            <CardTitle>Хүргэлт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{order.deliveryAddress}</p>
            {!canViewRoute && (
              <p className="text-sm text-muted-foreground">
                Чиглэлийг харах эрхгүй байна.
              </p>
            )}
            {canViewRoute && routeQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Чиглэл ачааллаж байна…
              </p>
            )}
            {canViewRoute && routeQuery.isError && (
              <p className="text-sm text-destructive">
                Чиглэл тооцоолоход алдаа гарлаа.
              </p>
            )}
            {canViewRoute && routeQuery.data && (
              <>
                <p className="text-sm text-muted-foreground">
                  Зай: {(routeQuery.data.distanceMeters / 1000).toFixed(1)} км ·
                  ~{Math.round(routeQuery.data.durationSeconds / 60)} мин
                </p>
                <DeliveryRouteMap
                  branchLat={routeQuery.data.geometry[0][1]}
                  branchLng={routeQuery.data.geometry[0][0]}
                  deliveryLat={order.deliveryLatitude as number}
                  deliveryLng={order.deliveryLongitude as number}
                  route={routeQuery.data}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

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
