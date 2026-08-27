import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSupportTickets, type SupportTicketCategory, type SupportTicketStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
} from "@/lib/support-status";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupportTicketStatusBadge } from "@/components/SupportTicketStatusBadge";

const ALL_STATUSES = Object.keys(
  SUPPORT_TICKET_STATUS_LABELS,
) as SupportTicketStatus[];
const ALL_CATEGORIES = Object.keys(
  SUPPORT_TICKET_CATEGORY_LABELS,
) as SupportTicketCategory[];
const FILTER_ALL = "ALL";

// §7 модуль #13, 7: "/support дэлгэц: жагсаалт (статус/ангиллаар шүүх)".
// RLS (support_tickets_select) хэрэглэгчийн эрхээр аль хэдийн шүүсэн
// байдаг (харилцагч: өөрийнх, staff: харах эрхтэй бүгд) тул admin-web
// талд дахин шүүлт хийхгүй.
export function SupportPage() {
  const { accessToken } = useAuth();
  const [statusFilter, setStatusFilter] = useState<
    SupportTicketStatus | typeof FILTER_ALL
  >(FILTER_ALL);
  const [categoryFilter, setCategoryFilter] = useState<
    SupportTicketCategory | typeof FILTER_ALL
  >(FILTER_ALL);

  const ticketsQuery = useQuery({
    queryKey: ["support-tickets", statusFilter, categoryFilter],
    queryFn: () =>
      getSupportTickets(accessToken, {
        status: statusFilter === FILTER_ALL ? undefined : statusFilter,
        category: categoryFilter === FILTER_ALL ? undefined : categoryFilter,
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Харилцагчийн үйлчилгээ
        </h1>
        <p className="text-sm text-muted-foreground">
          Харилцагчийн тусламжийн тасалбарууд, статус/ангиллаар шүүх
          боломжтой.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-xl">
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as SupportTicketStatus | typeof FILTER_ALL)
          }
        >
          <SelectTrigger className="w-full" aria-label="Статусаар шүүх">
            <SelectValue placeholder="Статусаар шүүх" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Бүх статус</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SUPPORT_TICKET_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(v) =>
            setCategoryFilter(v as SupportTicketCategory | typeof FILTER_ALL)
          }
        >
          <SelectTrigger className="w-full" aria-label="Ангилалаар шүүх">
            <SelectValue placeholder="Ангилалаар шүүх" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>Бүх ангилал</SelectItem>
            {ALL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {SUPPORT_TICKET_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent>
          {ticketsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {ticketsQuery.isError && (
            <p className="text-sm text-destructive">
              Тасалбарын мэдээлэл татахад алдаа гарлаа (эрхээ шалгана уу).
            </p>
          )}
          {ticketsQuery.isSuccess && ticketsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Энэ шүүлтүүрт тохирох тасалбар алга.
            </p>
          )}

          <ul className="divide-y divide-border">
            {(ticketsQuery.data ?? []).map((ticket) => (
              <li key={ticket.id}>
                <Link
                  to={`/support/${ticket.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {ticket.subject}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
                      {ticket.orderId
                        ? ` · захиалга №${ticket.orderId.slice(0, 8)}`
                        : " · ерөнхий"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleString("mn-MN")}
                    </span>
                  </div>
                  <SupportTicketStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
