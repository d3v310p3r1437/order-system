import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { ReportsPage } from "@/pages/ReportsPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getBranches: vi.fn(),
    getSalesSummary: vi.fn(),
    getTopProducts: vi.fn(),
    getRevenueTrend: vi.fn(),
    getBranchComparison: vi.fn(),
  };
});

const SALES_SUMMARY: api.SalesSummary = {
  from: "2026-07-21T00:00:00.000Z",
  to: "2026-08-19T23:59:59.999Z",
  branchId: null,
  totalRevenue: "300000.00",
  orderCount: 3,
  averageOrderAmount: "100000.00",
  returnAmount: "9000.00",
  returnCount: 1,
};

const TOP_PRODUCT: api.TopProduct = {
  variantId: "v-1",
  productName: "Гутал",
  variantName: "Улаан",
  quantitySold: 5,
  revenue: "50000.00",
};

const TREND_POINT: api.RevenueTrendPoint = {
  date: "2026-08-19",
  revenue: "300000.00",
  orderCount: 3,
};

const BRANCH_ROW: api.BranchComparisonRow = {
  branchId: "b-1",
  branchName: "Төв салбар",
  revenue: "300000.00",
  orderCount: 3,
};

function renderReportsPage(roleName: string) {
  vi.clearAllMocks();
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: roleName === "SUPER_ADMIN" ? null : "branch-1" }],
  });
  vi.mocked(api.getBranches).mockResolvedValue([]);
  vi.mocked(api.getSalesSummary).mockResolvedValue(SALES_SUMMARY);
  vi.mocked(api.getTopProducts).mockResolvedValue([TOP_PRODUCT]);
  vi.mocked(api.getRevenueTrend).mockResolvedValue([TREND_POINT]);
  vi.mocked(api.getBranchComparison).mockResolvedValue([BRANCH_ROW]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthProvider
          session={{ accessToken: "test-token", email: "a@order-system.mn" }}
          onLogout={() => {}}
        >
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// docs/plan.md §7 модуль #14, §8 Phase 5.
describe("ReportsPage", () => {
  it("KPI карт, их зарагдсан бүтээгдэхүүний хүснэгтийг харуулна", async () => {
    renderReportsPage("SUPER_ADMIN");

    expect(await screen.findByText("300,000₮")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Гутал")).toBeInTheDocument();
  });

  it("SUPER_ADMIN (global scope) салбаруудын харьцуулалтын хүснэгтийг харуулна", async () => {
    renderReportsPage("SUPER_ADMIN");

    expect(await screen.findByText("Салбаруудын харьцуулалт")).toBeInTheDocument();
    expect(await screen.findByText("Төв салбар")).toBeInTheDocument();
    await waitFor(() => expect(api.getBranchComparison).toHaveBeenCalled());
  });

  it("BRANCH_MANAGER (global scope БИШ) салбар харьцуулах хэсгийг огт харуулахгүй, дуудахгүй", async () => {
    renderReportsPage("BRANCH_MANAGER");

    await screen.findByText("300,000₮");
    expect(
      screen.queryByText("Салбаруудын харьцуулалт"),
    ).not.toBeInTheDocument();
    expect(api.getBranchComparison).not.toHaveBeenCalled();
  });
});
