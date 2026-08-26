import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { StaffPage } from "@/pages/StaffPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getStaff: vi.fn(),
    getBranches: vi.fn(),
  };
});

function renderStaffPage(roleName: string) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: null }],
  });
  vi.mocked(api.getStaff).mockResolvedValue([
    {
      id: "s1",
      email: "bat@order-system.mn",
      fullName: "Бат Болд",
      isActive: true,
      createdAt: new Date().toISOString(),
      roles: [{ role: "SALESPERSON", branchId: "b1", branchName: "Салбар 1" }],
    },
  ]);
  vi.mocked(api.getBranches).mockResolvedValue([]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        session={{ accessToken: "test-token", email: "a@order-system.mn" }}
        onLogout={() => {}}
      >
        <StaffPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// §6.1 матриц + StaffController-ийн STAFF_MANAGE_ROLES (SUPER_ADMIN/
// ALL_BRANCH_MANAGER/BRANCH_ADMIN)-тэй нийцэж байгааг батал —
// BRANCH_MANAGER/SALESPERSON аль алинд нь ажилтан удирдах эрхгүй тул
// хуудас БҮХЭЛДЭЭ (жагсаалт+товч) ХАРАГДАХГҮЙ ёстой (backend @Roles()
// findAll/create/update ГУРВАЛАНД нь ЯГ ижил жагсаалтаар хамгаалагдсан
// тул admin-web талд ч "all-or-nothing" загвар зөв).
describe("StaffPage — эрхийн UI", () => {
  // vi.fn() дуудлагын тоо тест хооронд ХАЛХАВЧГҮЙ (accumulate) хуримтлагддаг
  // тул "огт дуудагдаагүй" гэсэн шалгалт (доор) өмнөх тестүүдийн дуудлагаас
  // хамааралгүй байхын тулд зайлшгүй цэвэрлэнэ.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN эрхтэй үед жагсаалт болон 'Ажилтан нэмэх' товч харагдана", async () => {
    renderStaffPage("SUPER_ADMIN");
    expect(
      await screen.findByRole("button", { name: "Ажилтан нэмэх" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Бат Болд")).toBeInTheDocument();
  });

  it("BRANCH_ADMIN эрхтэй үед мөн харагдана (STAFF_MANAGE_ROLES-д орсон)", async () => {
    renderStaffPage("BRANCH_ADMIN");
    expect(
      await screen.findByRole("button", { name: "Ажилтан нэмэх" }),
    ).toBeInTheDocument();
  });

  it("SALESPERSON эрхтэй үед 'Энэ хуудсыг харах эрхгүй' гэж харуулж, GET /staff огт дуудагдахгүй", async () => {
    renderStaffPage("SALESPERSON");
    await waitFor(() =>
      expect(
        screen.getByText("Энэ хуудсыг харах эрхгүй байна."),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "Ажилтан нэмэх" }),
    ).not.toBeInTheDocument();
    expect(api.getStaff).not.toHaveBeenCalled();
  });
});
