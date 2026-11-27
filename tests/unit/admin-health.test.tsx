// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdminHealth } from "@/components/modules/admin-health";
import type { Health } from "@/lib/dashboard/health";

const health = (o: Partial<Health> = {}): Health => ({
  tiles: [
    { id: "documents", label: "Documents stored", value: 42, href: "/app", note: "In your workspace" },
    { id: "assets", label: "Assets tracked", value: 18, href: "/app/equipment", note: "Tools, vehicles and equipment" },
    { id: "renewals", label: "Upcoming renewals", value: 3, href: "/app/licenses", note: "Next 60 days" },
    { id: "tasks", label: "Tasks completed", value: 12, href: "/app/projects", note: "Last 30 days" },
  ],
  rows: [
    { id: "a", label: "Old permit", detail: "License", days: -5, tone: "danger", href: "/app/licenses" },
    { id: "b", label: "W-9 missing", detail: "Vendor: Blue Ridge", days: null, tone: "neutral", href: "/app/vendors" },
    { id: "c", label: "General liability insurance", detail: "Insurance", days: 18, tone: "warning", href: "/app/licenses" },
  ],
  total: 3, status: "attention", ...o,
});

describe("AdminHealth", () => {
  it("shows the overview counts as links", () => {
    render(<AdminHealth health={health()} />);
    expect(screen.getByTestId("health-documents")).toHaveTextContent("42");
    expect(screen.getByTestId("health-assets")).toHaveAttribute("href", "/app/equipment");
    expect(within(screen.getByTestId("health-renewals")).getByText("3")).toBeInTheDocument();
  });

  it("lists what needs attention with plain days, late and missing included", () => {
    render(<AdminHealth health={health()} />);
    const rows = screen.getAllByTestId("health-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Old permit");
    expect(rows[0]).toHaveTextContent("5 days late");
    expect(rows[1]).toHaveTextContent("Missing");
    expect(rows[2]).toHaveTextContent("18 days");
    expect(screen.getByText("Something is late.")).toBeInTheDocument();
  });

  it("says so when nothing needs attention, and how many more there are when the list is cut", () => {
    const { unmount } = render(<AdminHealth health={health({ rows: [], total: 0, status: "clear" })} />);
    expect(screen.getByText(/No renewals, missing records or inspections need attention/)).toBeInTheDocument();
    expect(screen.getByText("Everything is in order.")).toBeInTheDocument();
    unmount();
    render(<AdminHealth health={health({ total: 11 })} />);
    expect(screen.getByText(/And 8 more/)).toBeInTheDocument();
  });
});
