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

export type ReturnStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "REFUNDED"
  | "REFUND_FAILED";

export interface ReturnStatusChangedEvent {
  returnRequestId: string;
  orderId: string;
  branchId: string;
  customerId: string;
  status: ReturnStatus;
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

    // §7 модуль #9, §8 Phase 3c: PATCH /returns/:id/approve|reject амжилттай
    // ажилласан бүрт "Буцаалтууд" дэлгэцийн cache-ийг invalidate хийнэ —
    // order.status_changed-тэй ижил зарчим (backend event-ийг ШУУД
    // ашиглахгүй, зөвхөн "ямар нэг зүйл өөрчлөгдсөн" гэдгийг л дохио болгоно).
    socket.on(
      "return.status_changed",
      (payload: ReturnStatusChangedEvent) => {
        void queryClient.invalidateQueries({ queryKey: ["returns"] });
        void queryClient.invalidateQueries({
          queryKey: ["return", payload.returnRequestId],
        });
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);
}
