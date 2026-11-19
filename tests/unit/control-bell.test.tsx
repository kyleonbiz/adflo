// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ControlBell } from "@/components/control/control-bell";
import type { ControlAlert } from "@/lib/control/alerts";

const item = (o: Partial<ControlAlert>): ControlAlert => ({ id: "x", severity: "warning", area: "Support", label: "Open ticket", text: "Acme: Cannot upload", href: "/control/support/t1", ...o });

describe("ControlBell", () => {
  it("says all caught up when there is nothing, with no count", async () => {
    render(<ControlBell items={[]} />);
    expect(screen.queryByTestId("control-bell-count")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
  it("shows the count, and each row links to where it is dealt with", async () => {
    render(<ControlBell items={[item({ id: "a", severity: "critical" }), item({ id: "b", text: "Birch: stalled", href: "/control/clients/c2#onboarding", area: "Onboarding", label: "Setup stalled" })]} />);
    expect(screen.getByTestId("control-bell-count")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Notifications, 2 to look at" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.getByText("1 urgent")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Birch: stalled/ })).toHaveAttribute("href", "/control/clients/c2#onboarding");
    expect(screen.getByRole("link", { name: /Acme: Cannot upload/ })).toHaveAttribute("href", "/control/support/t1");
  });
  it("lists a handful and says how many more there are", async () => {
    render(<ControlBell items={Array.from({ length: 11 }, (_, i) => item({ id: `i${i}`, text: `Item ${i}` }))} />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByText(/3 more not shown/)).toBeInTheDocument();
  });
});
