import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { AuditLogsPage } from "@/pages/AuditLogsPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getAuditLogs: vi.fn(),
  };
});

function renderAuditLogsPage(roleName: string) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: null }],
  });
  vi.mocked(api.getAuditLogs).mockResolvedValue([
    {
      id: "log-1",
      userId: "actor-1",
      action: "staff.created",
      tableName: "users",
      recordId: "record-1",
      beforeData: null,
      afterData: null,
      branchId: null,
      createdAt: new Date().toISOString(),
    },
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        session={{ accessToken: "test-token", email: "a@order-system.mn" }}
        onLogout={() => {}}
      >
        <AuditLogsPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// roles.ts-ийн AUDIT_LOG_VIEW_ROLES (зөвхөн 3 глобал-эрхийн дүр) — backend
// audit-log.controller.ts-ийн AUDIT_LOG_VIEW_ROLES-тэй тохирно.
describe("AuditLogsPage — эрхийн UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN эрхтэй үед жагсаалт харагдана", async () => {
    renderAuditLogsPage("SUPER_ADMIN");
    expect(await screen.findByText("staff.created")).toBeInTheDocument();
  });

  it("BRANCH_ADMIN (глобал биш) эрхтэй үед 'Энэ хуудсыг харах эрхгүй' гэж харуулж, GET /audit-logs дуудагдахгүй", async () => {
    renderAuditLogsPage("BRANCH_ADMIN");
    await waitFor(() =>
      expect(
        screen.getByText("Энэ хуудсыг харах эрхгүй байна."),
      ).toBeInTheDocument(),
    );
    expect(api.getAuditLogs).not.toHaveBeenCalled();
  });
});
