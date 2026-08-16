import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth-context";
import { Layout } from "@/components/Layout";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, getMe: vi.fn() };
});

// useOrderEvents (src/lib/realtime.ts) бодит WebSocket холболт хийхийг
// сэргийлнэ — энэ тестэд backend/сүлжээ шаардлагагүй байх ёстой.
vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({ on: vi.fn(), disconnect: vi.fn() })),
}));

describe("Layout", () => {
  it("хэрэглэгчийн и-мэйл, дүрийн монгол нэршил, Гарах товчийг харуулна", async () => {
    vi.mocked(api.getMe).mockResolvedValue({
      userId: "u1",
      roles: [{ role: "BRANCH_MANAGER", branchId: "b1" }],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AuthProvider
            session={{
              accessToken: "tok",
              email: "menejer@order-system.mn",
            }}
            onLogout={() => {}}
          >
            <Routes>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<div>Агуулгын хэсэг</div>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("menejer@order-system.mn")).toBeInTheDocument();
    expect(await screen.findByText(/Салбарын менежер/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Гарах" })).toBeInTheDocument();
    expect(screen.getByText("Агуулгын хэсэг")).toBeInTheDocument();
  });
});
