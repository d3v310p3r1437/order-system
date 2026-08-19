import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { DashboardKpiCards } from "@/components/DashboardKpiCards";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getSalesSummary: vi.fn(),
  };
});

function renderKpiCards() {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: "SUPER_ADMIN", branchId: null }],
  });
  vi.mocked(api.getSalesSummary).mockImplementation((_token, filter) =>
    Promise.resolve({
      from: filter.from,
      to: filter.to,
      branchId: null,
      totalRevenue: filter.from === filter.to ? "50000.00" : "300000.00",
      orderCount: filter.from === filter.to ? 2 : 9,
      averageOrderAmount: "0.00",
      returnAmount: "0.00",
      returnCount: 0,
    }),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        session={{ accessToken: "test-token", email: "a@order-system.mn" }}
        onLogout={() => {}}
      >
        <DashboardKpiCards />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// §Даалгавар #6: Dashboard-д товч KPI карт (өнөөдрийн орлого, долоо
// хоногийн захиалгын тоо гэх мэт).
describe("DashboardKpiCards", () => {
  it("өнөөдрийн орлого/захиалгын тоо, 7 хоногийн захиалгын тоог тусад нь харуулна", async () => {
    renderKpiCards();

    expect(await screen.findByText("50,000₮")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
