import { useQuery } from "@tanstack/react-query";
import { getSalesSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: string): string {
  return `${Number(value).toLocaleString("mn-MN")}₮`;
}

// docs/plan.md §8 Phase 5, §Даалгавар #6: "Dashboard-д товч KPI карт
// (өнөөдрийн орлого, долоо хоногийн захиалгын тоо гэх мэт)". ReportsPage
// (/reports)-ийн бүрэн тайлантай ЯГ ижил getSalesSummary()-г л дахин
// ашигласан (шинэ backend endpoint шаардлагагүй) — зөвхөн эндхийн
// зорилгодоо нийцсэн хоёр (өнөөдөр/долоо хоног) тусдаа query.
export function DashboardKpiCards() {
  const { accessToken } = useAuth();
  const today = toIsoDate(new Date());
  const weekStart = toIsoDate(
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  );

  const todayQuery = useQuery({
    queryKey: ["reports", "sales-summary", "kpi-today", today],
    queryFn: () => getSalesSummary(accessToken, { from: today, to: today }),
  });

  const weekQuery = useQuery({
    queryKey: ["reports", "sales-summary", "kpi-week", weekStart, today],
    queryFn: () =>
      getSalesSummary(accessToken, { from: weekStart, to: today }),
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Өнөөдрийн орлого</CardDescription>
          <CardTitle className="text-2xl">
            {todayQuery.data ? formatCurrency(todayQuery.data.totalRevenue) : "—"}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Өнөөдрийн захиалгын тоо</CardDescription>
          <CardTitle className="text-2xl">
            {todayQuery.data?.orderCount ?? "—"}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Сүүлийн 7 хоногийн захиалгын тоо</CardDescription>
          <CardTitle className="text-2xl">
            {weekQuery.data?.orderCount ?? "—"}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
