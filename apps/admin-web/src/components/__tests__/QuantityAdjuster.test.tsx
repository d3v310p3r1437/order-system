import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityAdjuster } from "@/components/QuantityAdjuster";

describe("QuantityAdjuster", () => {
  it("'+' товч дарахад input-д бичсэн тоогоор эерэг delta илгээнэ", async () => {
    const onAdjust = vi.fn();
    const user = userEvent.setup();
    render(<QuantityAdjuster currentQuantity={10} onAdjust={onAdjust} />);

    const input = screen.getByLabelText("Дэлта тоо хэмжээ");
    await user.clear(input);
    await user.type(input, "5");
    await user.click(screen.getByRole("button", { name: "Нөөц нэмэх" }));

    expect(onAdjust).toHaveBeenCalledWith(5);
  });

  it("'−' товч дарахад input-д бичсэн тоогоор сөрөг delta илгээнэ", async () => {
    const onAdjust = vi.fn();
    const user = userEvent.setup();
    render(<QuantityAdjuster currentQuantity={10} onAdjust={onAdjust} />);

    const input = screen.getByLabelText("Дэлта тоо хэмжээ");
    await user.clear(input);
    await user.type(input, "3");
    await user.click(screen.getByRole("button", { name: "Нөөц хасах" }));

    expect(onAdjust).toHaveBeenCalledWith(-3);
  });

  it("одоогийн үлдэгдлийг харуулна", () => {
    render(<QuantityAdjuster currentQuantity={42} onAdjust={vi.fn()} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
