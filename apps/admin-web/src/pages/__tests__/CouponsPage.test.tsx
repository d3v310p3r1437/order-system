import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { CouponsPage } from "@/pages/CouponsPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getCoupons: vi.fn(),
  };
});

function renderCouponsPage(roleName: string) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: null }],
  });
  vi.mocked(api.getCoupons).mockResolvedValue([]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        session={{ accessToken: "test-token", email: "a@order-system.mn" }}
        onLogout={() => {}}
      >
        <CouponsPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// §6.1 матриц "Урамшуулал/купон" мөр: COUPON_CREATE_ROLES (SUPER_ADMIN,
// ALL_BRANCH_MANAGER) -тэй нийцэж байгааг батал — OWNER-д зөвхөн R/U
// байдаг тул "Купон нэмэх" товч ХАРАГДАХГҮЙ.
describe("CouponsPage — role-аар 'Купон нэмэх' товч харуулах/нуух", () => {
  it("SUPER_ADMIN эрхтэй үед товч харагдана", async () => {
    renderCouponsPage("SUPER_ADMIN");
    expect(
      await screen.findByRole("button", { name: "Купон нэмэх" }),
    ).toBeInTheDocument();
  });

  it("OWNER эрхтэй үед товч харагдахгүй (COUPON_CREATE_ROLES-д ороогүй)", async () => {
    renderCouponsPage("OWNER");
    await waitFor(() =>
      expect(
        screen.getByText("Одоогоор купон бүртгэгдээгүй байна."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Купон нэмэх" }),
    ).not.toBeInTheDocument();
  });

  it("BRANCH_MANAGER эрхтэй үед 'Нэмэх'/'Засах' товч аль алиныг нь харуулахгүй", async () => {
    renderCouponsPage("BRANCH_MANAGER");
    await waitFor(() =>
      expect(
        screen.getByText("Одоогоор купон бүртгэгдээгүй байна."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Купон нэмэх" }),
    ).not.toBeInTheDocument();
  });
});
