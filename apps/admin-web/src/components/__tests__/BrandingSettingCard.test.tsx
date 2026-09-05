import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { BrandingSettingCard } from "@/components/BrandingSettingCard";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, getBranding: vi.fn(), updateBranding: vi.fn() };
});

function renderCard() {
  vi.mocked(api.getBranding).mockResolvedValue({
    storeName: "ЧАНАР",
    logoUrl: "http://minio.local/product-images/branding/logo.png",
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return { queryClient, ...render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        session={{ accessToken: "test-token", email: "a@order-system.mn" }}
        onLogout={() => {}}
      >
        <BrandingSettingCard />
      </AuthProvider>
    </QueryClientProvider>,
  ) };
}

// §7 "Дэлгүүрийн нэр/лого" даалгавар 6-р зүйл: Dashboard-ийн брэндинг карт.
describe("BrandingSettingCard", () => {
  it("одоогийн дэлгүүрийн нэр/лого зургийг урьдчилан харуулна", async () => {
    renderCard();

    expect(await screen.findByDisplayValue("ЧАНАР")).toBeInTheDocument();
    expect(screen.getByAltText("ЧАНАР")).toHaveAttribute(
      "src",
      "http://minio.local/product-images/branding/logo.png",
    );
  });

  it("нэрийг өөрчилж Хадгалах дарахад updateBranding-г шинэ нэрээр дуудна", async () => {
    vi.mocked(api.updateBranding).mockResolvedValue({
      storeName: "Шинэ нэр",
      logoUrl: null,
    });
    renderCard();

    const input = await screen.findByDisplayValue("ЧАНАР");
    fireEvent.change(input, { target: { value: "Шинэ нэр" } });
    fireEvent.click(screen.getByRole("button", { name: "Хадгалах" }));

    await waitFor(() => expect(api.updateBranding).toHaveBeenCalledWith(
      "test-token",
      { storeName: "Шинэ нэр", logoFile: undefined },
    ));
    expect(await screen.findByText("Шинэчлэгдлээ.")).toBeInTheDocument();
  });
});
