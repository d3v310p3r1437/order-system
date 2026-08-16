import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { CategoriesPage } from "@/pages/CategoriesPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getCategories: vi.fn(),
  };
});

function renderCategoriesPage(roleName: string) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: null }],
  });
  vi.mocked(api.getCategories).mockResolvedValue([]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        session={{ accessToken: "test-token", email: "a@order-system.mn" }}
        onLogout={() => {}}
      >
        <CategoriesPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// §Даалгавар 2/7: GET /auth/me-ийн role утгаар CUD товч харуулах/нуух
// логик — CATEGORY_WRITE_ROLES (SUPER_ADMIN, ALL_BRANCH_MANAGER) -тэй
// нийцэж байгааг батал.
describe("CategoriesPage — role-аар 'Ангилал нэмэх' товч харуулах/нуух", () => {
  it("SUPER_ADMIN эрхтэй үед товч харагдана", async () => {
    renderCategoriesPage("SUPER_ADMIN");
    expect(
      await screen.findByRole("button", { name: "Ангилал нэмэх" }),
    ).toBeInTheDocument();
  });

  it("BRANCH_ADMIN эрхтэй үед товч харагдахгүй (CATEGORY_WRITE_ROLES-д ороогүй)", async () => {
    renderCategoriesPage("BRANCH_ADMIN");
    await waitFor(() =>
      expect(
        screen.getByText("Одоогоор ангилал бүртгэгдээгүй байна."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Ангилал нэмэх" }),
    ).not.toBeInTheDocument();
  });
});
