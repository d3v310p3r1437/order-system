import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { ProductsPage } from "@/pages/ProductsPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getCategories: vi.fn(),
    getProducts: vi.fn(),
    searchProducts: vi.fn(),
  };
});

const PRODUCT_A: api.Product = {
  id: "p-a",
  name: "Ноолуур цамц",
  slug: "noolluur-tsamts",
  description: null,
  brand: "Gobi",
  categoryId: "cat-1",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const PRODUCT_B: api.ProductDetail = {
  id: "p-b",
  name: "Ноолуур пальто",
  slug: "noolluur-palto",
  description: null,
  brand: "Gobi",
  categoryId: "cat-1",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  variants: [],
  images: [],
};

function renderProductsPage() {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: "SUPER_ADMIN", branchId: null }],
  });
  vi.mocked(api.getCategories).mockResolvedValue([]);
  vi.mocked(api.getProducts).mockResolvedValue([PRODUCT_A]);
  vi.mocked(api.searchProducts).mockResolvedValue([PRODUCT_B]);

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
          <ProductsPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// docs/plan.md §8 Phase 2 Хэсэг B, даалгавар #11: admin-web-ийн
// хайлтын талбар (debounce-той) GET /catalog/search дуудна.
describe("ProductsPage — хайлтын талбар", () => {
  it("хайлтын талбар хоосон үед энгийн GET /products жагсаалт харуулна", async () => {
    renderProductsPage();
    expect(await screen.findByText("Ноолуур цамц")).toBeInTheDocument();
    expect(api.searchProducts).not.toHaveBeenCalled();
  });

  it("хайлтын талбарт бичихэд (debounce-ийн дараа) searchProducts()-г дуудаж, үр дүнг харуулна", async () => {
    renderProductsPage();
    await screen.findByText("Ноолуур цамц");

    fireEvent.change(screen.getByPlaceholderText("Нэрээр хайх…"), {
      target: { value: "Ноолуур" },
    });

    await waitFor(
      () =>
        expect(api.searchProducts).toHaveBeenCalledWith("test-token", {
          q: "Ноолуур",
          categoryId: undefined,
        }),
      { timeout: 1000 },
    );
    expect(await screen.findByText("Ноолуур пальто")).toBeInTheDocument();
    expect(screen.queryByText("Ноолуур цамц")).not.toBeInTheDocument();
  });
});
