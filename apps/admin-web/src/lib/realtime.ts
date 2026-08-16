import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type OrderStatus =
  | "CREATED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface OrderStatusChangedEvent {
  orderId: string;
  branchId: string;
  customerId: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
}

// docs/plan.md §8 Phase 3b, Хэсэг A #4: apps/api/src/realtime/order-events.gateway.ts-тэй
// холбогдож, PATCH /orders/:id/status амжилттай ажиллах бүрт "Захиалгууд"
// (`/orders`, `/orders/:id`) дэлгэцийн TanStack Query cache-ийг автоматаар
// invalidate хийнэ (дахин refetch хийхэд шаардлагатай — backend-ийн
// event нь зөвхөн "ямар нэг зүйл өөрчлөгдсөн" гэдгийг мэдэгдэнэ, өөрөө
// шинэ өгөгдлийг дамжуулдаггүй тул RLS-ийг frontend талд дахин
// хэрэгжүүлэх шаардлагагүй).
//
// Staff (admin-web-ийг ашигладаг бүх дүр) холбогдох мөчид backend талд
// өөрт харагдах салбаруудын `branch:*` room-д автоматаар нэгддэг
// (OrderEventsGateway.handleConnection) — client талд room сонголт
// хийх шаардлагагүй.
export function useOrderEvents(accessToken: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const socket: Socket = io(`${API_URL}/ws/orders`, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    socket.on("order.status_changed", (payload: OrderStatusChangedEvent) => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({
        queryKey: ["order", payload.orderId],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);
}
