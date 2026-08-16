import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverrideField } from "@/components/OverrideField";

function Harness() {
  const [enabled, setEnabled] = useState(false);
  return (
    <OverrideField
      label="Салбарын тусгай үнэ"
      hint="Унтраасан бол үндсэн үнэ ашиглана."
      enabled={enabled}
      onEnabledChange={setEnabled}
    >
      <input aria-label="branch-price-input" />
    </OverrideField>
  );
}

describe("OverrideField", () => {
  it("унтраасан үед дотоод input харагдахгүй, асаахад гарч ирж, дахин унтраахад алга болно", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(
      screen.queryByLabelText("branch-price-input"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch"));
    expect(screen.getByLabelText("branch-price-input")).toBeInTheDocument();

    await user.click(screen.getByRole("switch"));
    expect(
      screen.queryByLabelText("branch-price-input"),
    ).not.toBeInTheDocument();
  });
});
