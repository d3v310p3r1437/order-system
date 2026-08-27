import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { SupportPage } from "@/pages/SupportPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getSupportTickets: vi.fn(),
  };
});

const SAMPLE_TICKET: api.SupportTicket = {
  id: "ticket-1",
  customerId: "cust-1",
  orderId: "order-1",
  subject: "Захиалга ирсэнгүй",
  category: "ORDER_ISSUE",
  status: "OPEN",
  createdAt: "2026-08-27T10:00:00.000Z",
  resolvedAt: null,
  closedAt: null,
};

function renderSupportPage(
  roleName: string,
  tickets: api.SupportTicket[] = [SAMPLE_TICKET],
) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: "branch-1" }],
  });
  vi.mocked(api.getSupportTickets).mockResolvedValue(tickets);

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
          <SupportPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// §7 модуль #13, 7: "/support дэлгэц: жагсаалт (статус/ангиллаар шүүх)".
describe("SupportPage", () => {
  it("тасалбарын жагсаалт, ангилал, статусыг харуулна", async () => {
    renderSupportPage("BRANCH_MANAGER");

    expect(await screen.findByText("Захиалга ирсэнгүй")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Нээлттэй")).toBeInTheDocument();
    });
    expect(screen.getByText(/Захиалгын асуудал/)).toBeInTheDocument();
  });

  it("ерөнхий (orderId=null) тасалбарыг 'ерөнхий' гэж харуулна", async () => {
    renderSupportPage("SUPER_ADMIN", [
      { ...SAMPLE_TICKET, id: "ticket-2", orderId: null, category: "OTHER" },
    ]);

    expect(await screen.findByText(/ерөнхий/)).toBeInTheDocument();
  });

  it("тасалбар алга үед мессеж харуулна", async () => {
    renderSupportPage("SALESPERSON", []);

    await waitFor(() =>
      expect(
        screen.getByText("Энэ шүүлтүүрт тохирох тасалбар алга."),
      ).toBeInTheDocument(),
    );
  });
});
