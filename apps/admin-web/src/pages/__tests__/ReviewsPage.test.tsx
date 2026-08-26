import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { ReviewsPage } from "@/pages/ReviewsPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getMe: vi.fn(),
    getReviewsForModeration: vi.fn(),
    deleteReview: vi.fn(),
  };
});

function renderReviewsPage(roleName: string) {
  vi.mocked(api.getMe).mockResolvedValue({
    userId: "u1",
    roles: [{ role: roleName, branchId: null }],
  });
  vi.mocked(api.getReviewsForModeration).mockResolvedValue({
    reviews: [
      {
        id: "r-1",
        customerId: "cust-1",
        productId: "p-1",
        rating: 4,
        comment: "сайхан бүтээгдэхүүн",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        product: { id: "p-1", name: "Coca-Cola 0.5л" },
      },
    ],
    totalCount: 1,
    page: 1,
    limit: 20,
  });
  vi.mocked(api.deleteReview).mockResolvedValue({
    id: "r-1",
    customerId: "cust-1",
    productId: "p-1",
    rating: 4,
    comment: "сайхан бүтээгдэхүүн",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
        <ReviewsPage />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// roles.ts-ийн REVIEW_MODERATION_ROLES (зөвхөн 3 глобал-эрхийн дүр) —
// backend review.controller.ts-ийн REVIEW_MODERATION_ROLES-тэй тохирно.
describe("ReviewsPage — эрхийн UI + модераци (устгах)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SUPER_ADMIN эрхтэй үед жагсаалт харагдана", async () => {
    renderReviewsPage("SUPER_ADMIN");
    expect(await screen.findByText("Coca-Cola 0.5л")).toBeInTheDocument();
    expect(screen.getByText("сайхан бүтээгдэхүүн")).toBeInTheDocument();
  });

  it("BRANCH_ADMIN (глобал биш) эрхтэй үед 'Энэ хуудсыг харах эрхгүй' гэж харуулж, GET /reviews дуудагдахгүй", async () => {
    renderReviewsPage("BRANCH_ADMIN");
    await waitFor(() =>
      expect(
        screen.getByText("Энэ хуудсыг харах эрхгүй байна."),
      ).toBeInTheDocument(),
    );
    expect(api.getReviewsForModeration).not.toHaveBeenCalled();
  });

  it("'Устгах' товч дарж баталгаажуулахад deleteReview дуудагдана", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderReviewsPage("SUPER_ADMIN");

    const deleteButton = await screen.findByRole("button", {
      name: "Устгах",
    });
    await user.click(deleteButton);

    await waitFor(() => expect(api.deleteReview).toHaveBeenCalledWith(
      "test-token",
      "r-1",
    ));
  });

  it("баталгаажуулах цонхыг цуцалвал deleteReview ОГТ дуудагдахгүй", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderReviewsPage("SUPER_ADMIN");

    const deleteButton = await screen.findByRole("button", {
      name: "Устгах",
    });
    await user.click(deleteButton);

    expect(api.deleteReview).not.toHaveBeenCalled();
  });
});
