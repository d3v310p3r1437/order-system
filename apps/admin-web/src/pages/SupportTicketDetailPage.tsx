import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addSupportTicketMessage,
  getSupportTicket,
  updateSupportTicketStatus,
  type SupportTicketStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSupportTicketEvents } from "@/lib/realtime";
import { SUPPORT_TICKET_STATUS_UPDATE_ROLES } from "@/lib/roles";
import {
  SUPPORT_TICKET_ALLOWED_TRANSITIONS,
  SUPPORT_TICKET_CATEGORY_LABELS,
} from "@/lib/support-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SupportTicketStatusBadge } from "@/components/SupportTicketStatusBadge";

const STATUS_ACTION_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Дахин нээх",
  IN_PROGRESS: "Шийдвэрлэж эхлэх",
  RESOLVED: "Шийдэгдсэн гэж тэмдэглэх",
  CLOSED: "Хаах",
};

// §7 модуль #13, 7: "дэлгэрэнгүй (мессежийн урсгал, чат UI, доод хэсэгт
// бичих талбар), статус өөрчлөх dropdown/товч".
export function SupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, userId, hasRole } = useAuth();
  const canUpdateStatus = hasRole(SUPPORT_TICKET_STATUS_UPDATE_ROLES);
  const queryClient = useQueryClient();
  const [messageBody, setMessageBody] = useState("");

  useSupportTicketEvents(accessToken, id ?? null);

  const ticketQuery = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: () => getSupportTicket(accessToken, id as string),
    enabled: !!id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (body: string) =>
      addSupportTicketMessage(accessToken, id as string, body),
    onSuccess: () => {
      setMessageBody("");
      void queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: SupportTicketStatus) =>
      updateSupportTicketStatus(accessToken, id as string, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
      void queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });

  if (ticketQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>;
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <p className="text-sm text-destructive">
        Тасалбар олдсонгүй эсвэл татахад алдаа гарлаа.
      </p>
    );
  }

  const ticket = ticketQuery.data;
  const allowedTransitions = SUPPORT_TICKET_ALLOWED_TRANSITIONS[ticket.status];
  // ⚠️ support_messages_insert RLS-ийн "CUSTOMER CLOSED тасалбарт бичихийг
  // хориглодог" хязгаарлалт ЗӨВХӨН CUSTOMER-д хамаарна (§7 модуль #13, 6б)
  // — admin-web ЗӨВХӨН staff-ийн ашигладаг тул ЭНД ямар ч status-д
  // хамааралгүй үргэлж бичих боломжтой (backend-д ч staff-д ийм
  // хязгаарлалт байхгүй, support-ticket.service.ts-ийн addMessage()-ийг үз).

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/support"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Тасалбарууд руу буцах
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {ticket.subject}
          </h1>
          <SupportTicketStatusBadge status={ticket.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
          {ticket.orderId && (
            <>
              {" · "}
              <Link
                to={`/orders/${ticket.orderId}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                захиалга №{ticket.orderId.slice(0, 8)}
              </Link>
            </>
          )}
          {" · "}
          {new Date(ticket.createdAt).toLocaleString("mn-MN")}
        </p>
      </div>

      {canUpdateStatus && allowedTransitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Статус өөрчлөх</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {allowedTransitions.map((target) => (
              <Button
                key={target}
                variant={target === "CLOSED" ? "destructive" : "default"}
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(target)}
              >
                {STATUS_ACTION_LABELS[target]}
              </Button>
            ))}
          </CardContent>
          {statusMutation.isError && (
            <CardContent className="pt-0 text-sm text-destructive">
              Статус өөрчлөхөд алдаа гарлаа.
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Харилцан яриа</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ticket.messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Мессеж хараахан алга.
            </p>
          )}
          <ul className="space-y-2">
            {ticket.messages.map((message) => {
              const isOwn = message.senderId === userId;
              return (
                <li
                  key={message.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.body}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        isOwn
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {new Date(message.createdAt).toLocaleString("mn-MN")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <form
            className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = messageBody.trim();
              if (trimmed) {
                sendMessageMutation.mutate(trimmed);
              }
            }}
          >
            <Textarea
              aria-label="Мессеж бичих"
              placeholder="Хариу бичих…"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="min-h-16 flex-1"
            />
            <Button
              type="submit"
              disabled={sendMessageMutation.isPending || !messageBody.trim()}
            >
              {sendMessageMutation.isPending ? "Илгээж байна…" : "Илгээх"}
            </Button>
          </form>
          {sendMessageMutation.isError && (
            <p className="text-sm text-destructive">
              Мессеж илгээхэд алдаа гарлаа.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
