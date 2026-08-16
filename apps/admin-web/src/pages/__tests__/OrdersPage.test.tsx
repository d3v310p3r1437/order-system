import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { OrdersPage } from "@/pages/OrdersPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getBranches: vi.fn(),
    getOrders: vi.fn(),
  };
});

const SAMPLE_ORDER: api.Order = {
  id: "order-1",
  customerId: "cust-1",
  branchId: "branch-1",
  status: "CREATED",
  totalAmount: "39000.00",
  createdAt: "2026-08-16T10:00:00.000Z",
  updatedAt: "2026-08-16T10:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  providerInvoiceId: null,
  paidAt: null,
  items: [
    {
      id: "item-1",
      orderId: "order-1",
      variantId: "variant-1",
      quantity: 1,
      unitPriceSnapshot: "39000.00",
      createdAt: "2026-08-16T10:00:00.000Z",
    },
  ],
};

function renderOrdersPage(roleName: string, orders: api.Order[] = [SAMPLE_ORDER]) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: "branch-1" }],
  });
  vi.mocked(api.getBranches).mockResolvedValue([
    {
      id: "branch-1",
      name: "Салбар 1",
      address: null,
      district: null,
      latitude: null,
      longitude: null,
      phone: null,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  vi.mocked(api.getOrders).mockResolvedValue(orders);

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
          <OrdersPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// §8 Phase 3a 7-р зүйл: "жагсаалт (статусаар шүүх)" — захиалгын мөр,
// статус badge зөв харагдаж байгааг батал.
describe("OrdersPage", () => {
  it("захиалгын жагсаалт, статус, дүнг харуулна", async () => {
    renderOrdersPage("BRANCH_MANAGER");

    expect(await screen.findByText("№order-1")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Үүсгэсэн")).toBeInTheDocument();
    });
    expect(screen.getByText("39,000₮")).toBeInTheDocument();
  });

  it("захиалга алга үед мессеж харуулна", async () => {
    renderOrdersPage("SALESPERSON", []);

    await waitFor(() =>
      expect(
        screen.getByText("Энэ шүүлтүүрт тохирох захиалга алга."),
      ).toBeInTheDocument(),
    );
  });
});
