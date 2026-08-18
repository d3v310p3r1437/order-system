import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { ReturnsPage } from "@/pages/ReturnsPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getReturnRequests: vi.fn(),
  };
});

const SAMPLE_RETURN: api.ReturnRequest = {
  id: "return-1",
  orderItemId: "item-1",
  requestedByUserId: "cust-1",
  status: "REQUESTED",
  reason: "хэмжээ таарсангүй",
  rejectedReason: null,
  refundFeePercent: null,
  refundAmount: null,
  providerRefundId: null,
  reviewedByUserId: null,
  requestedAt: "2026-08-17T10:00:00.000Z",
  reviewedAt: null,
  refundedAt: null,
  orderItem: {
    id: "item-1",
    orderId: "order-1",
    variantId: "variant-1",
    quantity: 1,
    unitPriceSnapshot: "39000.00",
    order: {
      id: "order-1",
      branchId: "branch-1",
      customerId: "cust-1",
      status: "COMPLETED",
      providerInvoiceId: "mock_inv_1",
    },
  },
};

function renderReturnsPage(
  roleName: string,
  returns: api.ReturnRequest[] = [SAMPLE_RETURN],
) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: "branch-1" }],
  });
  vi.mocked(api.getReturnRequests).mockResolvedValue(returns);

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
          <ReturnsPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// §7 модуль #9 7-р зүйл: "Буцаалтууд" (/returns) — жагсаалт (статусаар шүүх).
describe("ReturnsPage", () => {
  it("буцаалтын хүсэлтийн жагсаалт, статус, шалтгааныг харуулна", async () => {
    renderReturnsPage("BRANCH_MANAGER");

    expect(await screen.findByText("хэмжээ таарсангүй")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Хүсэлт гаргасан")).toBeInTheDocument();
    });
  });

  it("буцаалт алга үед мессеж харуулна", async () => {
    renderReturnsPage("SALESPERSON", []);

    await waitFor(() =>
      expect(
        screen.getByText("Энэ шүүлтүүрт тохирох буцаалтын хүсэлт алга."),
      ).toBeInTheDocument(),
    );
  });
});
