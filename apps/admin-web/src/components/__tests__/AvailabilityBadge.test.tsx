import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";

describe("AvailabilityBadge", () => {
  it("IN_STOCK төлөвийг 'Бэлэн' гэж харуулна", () => {
    render(<AvailabilityBadge status="IN_STOCK" leadDays={null} />);
    expect(screen.getByText("Бэлэн")).toBeInTheDocument();
  });

  it("PRE_ORDER төлөвийг leadDays-тай хамт харуулна", () => {
    render(<AvailabilityBadge status="PRE_ORDER" leadDays={3} />);
    expect(screen.getByText("Захиалгаар · 3 хоног")).toBeInTheDocument();
  });

  it("OUT_OF_STOCK төлөвийг 'Дууссан' гэж харуулна", () => {
    render(<AvailabilityBadge status="OUT_OF_STOCK" leadDays={null} />);
    expect(screen.getByText("Дууссан")).toBeInTheDocument();
  });
});
