// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "@/components/notification-bell";
import type { AttentionItem } from "@/lib/dashboard/logic";

const item = (id: string, severity: AttentionItem["severity"]): AttentionItem => ({
  id, area: "Invoices", severity, label: severity === "critical" ? "Overdue" : "Due soon", text: `Invoice ${id}`, href: "/app/invoices",
});

describe("NotificationBell", () => {
  it("says everything is handled when there is nothing to do", async () => {
    render(<NotificationBell items={[]} serverToday="2026-10-26" />);
    expect(screen.queryByTestId("notification-count")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it("shows a count and lists each item with a link to its service", async () => {
    render(<NotificationBell items={[item("a", "critical"), item("b", "warning")]} serverToday="2026-10-26" />);
    expect(screen.getByTestId("notification-count")).toHaveTextContent("2");
    await userEvent.click(screen.getByRole("button", { name: "Notifications, 2 need attention" }));
    expect(screen.getByRole("link", { name: /Invoice a/ })).toHaveAttribute("href", "/app/invoices");
    expect(screen.getByRole("link", { name: /Invoice b/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open dashboard" })).toHaveAttribute("href", "/app/overview");
  });

  it("caps the list and points to the dashboard for the rest", async () => {
    const many = Array.from({ length: 12 }, (_, i) => item(`n${i}`, "warning"));
    render(<NotificationBell items={many} serverToday="2026-10-26" />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications, 12/ }));
    expect(screen.getAllByRole("link", { name: /Invoice n/ })).toHaveLength(8);
    expect(screen.getByRole("link", { name: "View all 12 on the dashboard" })).toBeInTheDocument();
  });
});
