import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { SupportTicketDetailPage } from "@/pages/SupportTicketDetailPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getSupportTicket: vi.fn(),
    addSupportTicketMessage: vi.fn(),
    updateSupportTicketStatus: vi.fn(),
  };
});

// useSupportTicketEvents (src/lib/realtime.ts) бодит WebSocket холболт
// хийхийг сэргийлнэ — Layout.test.tsx-ийн ЯГ ижил зарчим.
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() })),
}));

const SAMPLE_TICKET: api.SupportTicketDetail = {
  id: "ticket-1",
  customerId: "cust-1",
  orderId: "order-1",
  subject: "Захиалга ирсэнгүй",
  category: "ORDER_ISSUE",
  status: "OPEN",
  createdAt: "2026-08-27T10:00:00.000Z",
  resolvedAt: null,
  closedAt: null,
  messages: [
    {
      id: "m-1",
      ticketId: "ticket-1",
      senderId: "cust-1",
      body: "Сайн байна уу, надад тусламж хэрэгтэй",
      createdAt: "2026-08-27T10:05:00.000Z",
    },
  ],
};

function renderDetailPage(roleName: string, ticket = SAMPLE_TICKET) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "staff-1",
    roles: [{ role: roleName, branchId: "branch-1" }],
  });
  vi.mocked(api.getSupportTicket).mockResolvedValue(ticket);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/support/ticket-1"]}>
        <AuthProvider
          session={{ accessToken: "test-token", email: "a@order-system.mn" }}
          onLogout={() => {}}
        >
          <Routes>
            <Route path="/support/:id" element={<SupportTicketDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupportTicketDetailPage", () => {
  it("тасалбарын гарчиг, мессежийг харуулна", async () => {
    renderDetailPage("BRANCH_MANAGER");

    expect(await screen.findByText("Захиалга ирсэнгүй")).toBeInTheDocument();
    expect(
      screen.getByText("Сайн байна уу, надад тусламж хэрэгтэй"),
    ).toBeInTheDocument();
  });

  it("staff-only статус товч (BRANCH_MANAGER) харагдана", async () => {
    renderDetailPage("BRANCH_MANAGER");

    expect(
      await screen.findByRole("button", { name: "Шийдвэрлэж эхлэх" }),
    ).toBeInTheDocument();
  });

  it("OWNER-д (зөвхөн R) статус товч ОГТ харагдахгүй", async () => {
    renderDetailPage("OWNER");

    await screen.findByText("Захиалга ирсэнгүй");
    expect(
      screen.queryByRole("button", { name: "Шийдвэрлэж эхлэх" }),
    ).not.toBeInTheDocument();
  });

  it("мессеж бичиж 'Илгээх' дарахад addSupportTicketMessage дуудагдана", async () => {
    const user = userEvent.setup();
    vi.mocked(api.addSupportTicketMessage).mockResolvedValue({
      id: "m-2",
      ticketId: "ticket-1",
      senderId: "staff-1",
      body: "Тусалъя",
      createdAt: "2026-08-27T10:10:00.000Z",
    });
    renderDetailPage("BRANCH_MANAGER");

    await screen.findByText("Захиалга ирсэнгүй");
    const textarea = screen.getByLabelText("Мессеж бичих");
    await user.type(textarea, "Тусалъя");
    await user.click(screen.getByRole("button", { name: "Илгээх" }));

    await waitFor(() =>
      expect(api.addSupportTicketMessage).toHaveBeenCalledWith(
        "test-token",
        "ticket-1",
        "Тусалъя",
      ),
    );
  });

  it("CLOSED тасалбарт ч staff мессеж бичих талбар идэвхтэй хэвээр", async () => {
    renderDetailPage("BRANCH_MANAGER", { ...SAMPLE_TICKET, status: "CLOSED" });

    await screen.findByText("Захиалга ирсэнгүй");
    expect(screen.getByLabelText("Мессеж бичих")).toBeEnabled();
  });
});
