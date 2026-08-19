import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  exportSalesSummaryCsv,
  getBranchComparison,
  getBranches,
  getRevenueTrend,
  getSalesSummary,
  getTopProducts,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BRANCH_COMPARISON_ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_BRANCHES = "ALL";

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: string | number): string {
  return `${Number(value).toLocaleString("mn-MN")}₮`;
}

// docs/plan.md §7 модуль #14, §8 Phase 5. §6.1 матрицын "Тайлан/аналитик"
// мөрийг ReportsPage-ийн бүх query ашиглана — RLS (odoo байгаа
// orders_select гэх мэт) хэн ямар салбарын мэдээллийг харахыг шийднэ,
// энд дахин шүүлт хийхгүй (OrdersPage-тэй ижил зарчим).
export function ReportsPage() {
  const { accessToken, hasRole } = useAuth();
  const canCompareBranches = hasRole(BRANCH_COMPARISON_ROLES);

  const [to, setTo] = useState(() => toIsoDate(new Date()));
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toIsoDate(d);
  });
  const [branchId, setBranchId] = useState<string>(ALL_BRANCHES);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const branchesQuery = useQuery({
    queryKey: ["branches", accessToken],
    queryFn: () => getBranches(accessToken),
  });

  const filter = {
    from,
    to,
    branchId: branchId === ALL_BRANCHES ? undefined : branchId,
  };
  const rangeValid = from !== "" && to !== "" && from <= to;

  const salesSummaryQuery = useQuery({
    queryKey: ["reports", "sales-summary", filter],
    queryFn: () => getSalesSummary(accessToken, filter),
    enabled: rangeValid,
  });

  const topProductsQuery = useQuery({
    queryKey: ["reports", "top-products", filter],
    queryFn: () => getTopProducts(accessToken, { ...filter, limit: 10 }),
    enabled: rangeValid,
  });

  const revenueTrendQuery = useQuery({
    queryKey: ["reports", "revenue-trend", filter],
    queryFn: () => getRevenueTrend(accessToken, filter),
    enabled: rangeValid,
  });

  const branchComparisonQuery = useQuery({
    queryKey: ["reports", "branch-comparison", from, to],
    queryFn: () => getBranchComparison(accessToken, { from, to }),
    enabled: rangeValid && canCompareBranches,
  });

  useEffect(() => {
    setExportError(null);
  }, [filter.from, filter.to, filter.branchId]);

  async function handleExport() {
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await exportSalesSummaryCsv(accessToken, filter);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sales-summary-${from}_${to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Татахад алдаа гарлаа",
      );
    } finally {
      setIsExporting(false);
    }
  }

  const chartData =
    revenueTrendQuery.data?.map((p) => ({
      date: p.date,
      revenue: Number(p.revenue),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Тайлан</h1>
          <p className="text-sm text-muted-foreground">
            Сонгосон хугацаа, (шаардлагатай бол) салбарын борлуулалтын
            тайлан.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void handleExport()}
          disabled={!rangeValid || isExporting}
        >
          {isExporting ? "Татаж байна…" : "CSV татах"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-from">Эхлэх огноо</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to">Дуусах огноо</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
          />
        </div>
        {branchesQuery.data && branchesQuery.data.length > 1 && (
          <div className="w-full max-w-xs space-y-1.5">
            <Label htmlFor="report-branch">Салбар</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger
                id="report-branch"
                className="w-full"
                aria-label="Салбар сонгох"
              >
                <SelectValue placeholder="Бүх салбар" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_BRANCHES}>Бүх салбар</SelectItem>
                {branchesQuery.data.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!rangeValid && (
        <p role="alert" className="text-sm text-destructive">
          Эхлэх огноо дуусах огнооноос хойш байж болохгүй.
        </p>
      )}
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Нийт орлого</CardDescription>
            <CardTitle className="text-2xl">
              {salesSummaryQuery.data
                ? formatCurrency(salesSummaryQuery.data.totalRevenue)
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Захиалгын тоо</CardDescription>
            <CardTitle className="text-2xl">
              {salesSummaryQuery.data?.orderCount ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Дундаж захиалгын дүн</CardDescription>
            <CardTitle className="text-2xl">
              {salesSummaryQuery.data
                ? formatCurrency(salesSummaryQuery.data.averageOrderAmount)
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Буцаалт (дүн / тоо)</CardDescription>
            <CardTitle className="text-2xl">
              {salesSummaryQuery.data
                ? `${formatCurrency(salesSummaryQuery.data.returnAmount)} / ${salesSummaryQuery.data.returnCount}`
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Орлогын хандлага</CardTitle>
          <CardDescription>Өдөр тутмын нийт орлого.</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueTrendQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {revenueTrendQuery.isSuccess && chartData.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Сонгосон хугацаанд өгөгдөл алга.
            </p>
          )}
          {chartData.length > 0 && (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-chart-1)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tickFormatter={(v: number) => v.toLocaleString("mn-MN")}
                  />
                  <Tooltip
                    formatter={(value) =>
                      formatCurrency(Array.isArray(value) ? value[0] : value)
                    }
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Их зарагдсан бүтээгдэхүүн</CardTitle>
        </CardHeader>
        <CardContent>
          {topProductsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Ачааллаж байна…</p>
          )}
          {topProductsQuery.isSuccess && topProductsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Сонгосон хугацаанд зарагдсан бүтээгдэхүүн алга.
            </p>
          )}
          {topProductsQuery.data && topProductsQuery.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Бүтээгдэхүүн</th>
                    <th className="py-2 pr-3 font-medium">Тоо ширхэг</th>
                    <th className="py-2 pr-3 font-medium">Орлого</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topProductsQuery.data.map((row) => (
                    <tr key={row.variantId}>
                      <td className="py-2 pr-3">
                        {row.productName}
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.variantName}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{row.quantitySold}</td>
                      <td className="py-2 pr-3 font-medium">
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canCompareBranches && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Салбаруудын харьцуулалт</CardTitle>
          </CardHeader>
          <CardContent>
            {branchComparisonQuery.isLoading && (
              <p className="text-sm text-muted-foreground">
                Ачааллаж байна…
              </p>
            )}
            {branchComparisonQuery.data && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Салбар</th>
                      <th className="py-2 pr-3 font-medium">Захиалгын тоо</th>
                      <th className="py-2 pr-3 font-medium">Орлого</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {branchComparisonQuery.data.map((row) => (
                      <tr key={row.branchId}>
                        <td className="py-2 pr-3">{row.branchName}</td>
                        <td className="py-2 pr-3">{row.orderCount}</td>
                        <td className="py-2 pr-3 font-medium">
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
