import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { ProductImageGallery } from "@/components/ProductImageGallery";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    uploadProductImage: vi.fn(),
    deleteProductImage: vi.fn(),
  };
});

const sampleImage: api.ProductImage = {
  id: "img-1",
  productId: "p-1",
  objectKey: "products/p-1/a.jpg",
  displayOrder: 0,
  altText: null,
  createdAt: new Date().toISOString(),
  url: "http://localhost:9000/product-images/products/p-1/a.jpg",
};

function renderGallery(canWrite: boolean, images: api.ProductImage[] = [sampleImage]) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: "SUPER_ADMIN", branchId: null }],
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        session={{ accessToken: "test-token", email: "a@order-system.mn" }}
        onLogout={() => {}}
      >
        <ProductImageGallery productId="p-1" images={images} canWrite={canWrite} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// docs/plan.md §8 Phase 2 Хэсэг A, даалгавар #7: admin-web smoke тест.
describe("ProductImageGallery", () => {
  it("canWrite=true үед upload dropzone болон устгах товч харагдана", () => {
    renderGallery(true);
    expect(
      screen.getByRole("button", { name: "Зураг байршуулах" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", sampleImage.url);
    expect(screen.getByRole("button", { name: "Устгах" })).toBeInTheDocument();
  });

  it("canWrite=false үед upload dropzone болон устгах товч ХАРАГДАХГҮЙ, зураг л харагдана", () => {
    renderGallery(false);
    expect(
      screen.queryByRole("button", { name: "Зураг байршуулах" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Устгах" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("зураггүй үед 'Зураг оруулаагүй байна.' гэсэн мессеж харагдана", () => {
    renderGallery(true, []);
    expect(screen.getByText("Зураг оруулаагүй байна.")).toBeInTheDocument();
  });

  it("'Устгах' товч дарахад deleteProductImage(productId, imageId)-г дуудна", async () => {
    vi.mocked(api.deleteProductImage).mockResolvedValue(sampleImage);
    renderGallery(true);

    fireEvent.click(screen.getByRole("button", { name: "Устгах" }));

    await waitFor(() =>
      expect(api.deleteProductImage).toHaveBeenCalledWith(
        "test-token",
        "p-1",
        "img-1",
      ),
    );
  });
});
