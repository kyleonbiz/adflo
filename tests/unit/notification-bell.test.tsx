// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "@/components/notification-bell";
import type { AttentionItem, QueueItem } from "@/lib/dashboard/logic";
import { applyPrefs, parseSeen, rememberSeen, unseen } from "@/lib/dashboard/prefs";
import { defaultSettings } from "@/lib/settings/types";

const item = (id: string, severity: AttentionItem["severity"]): AttentionItem => ({
  id, area: "Invoices", severity, label: severity === "critical" ? "Overdue" : "Due soon", text: `Invoice ${id}`, href: "/app/invoices",
});

beforeEach(() => window.localStorage.clear());

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

  it("marks what is new until the bell has been opened and closed", async () => {
    const { rerender } = render(<NotificationBell items={[item("a", "critical")]} serverToday="2026-10-26" />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications, 1/ }));
    expect(screen.getByTestId("bell-new")).toBeInTheDocument();
    expect(screen.getByText("1 overdue · 1 new")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    rerender(<NotificationBell items={[item("a", "critical"), item("b", "warning")]} serverToday="2026-10-26" />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications, 2/ }));
    expect(screen.getAllByTestId("bell-new")).toHaveLength(1); // only b is new
  });

  it("snoozes one item from the bell", async () => {
    render(<NotificationBell items={[item("a", "critical"), item("b", "warning")]} serverToday="2026-10-26" />);
    await userEvent.click(screen.getByRole("button", { name: /Notifications, 2/ }));
    await userEvent.click(screen.getByRole("button", { name: "Snooze until tomorrow: Invoice a" }));
    expect(screen.queryByRole("link", { name: /Invoice a/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Invoice b/ })).toBeInTheDocument();
  });

  it("lists what is waiting on you, with how long", async () => {
    const queue: QueueItem[] = [{ id: "req-1", kind: "Request", title: "Wire the deposit", href: "/app/admin", waitingDays: 6, stale: true }];
    render(<NotificationBell items={[]} queue={queue} serverToday="2026-10-26" />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByTestId("bell-queue")).toHaveTextContent("Request · Wire the deposit");
    expect(screen.getByTestId("bell-queue")).toHaveTextContent("6d");
  });
});

describe("notification choices", () => {
  const mk = (id: string, area: AttentionItem["area"], text = "x"): AttentionItem => ({ id, area, severity: "warning", label: "L", text, href: "/app" });
  const all = [mk("inv-1", "Invoices"), mk("lic-1", "Licenses"), mk("adm-a-1", "Admin", '"Wire" is waiting for approval.'), mk("adm-o-1", "Admin", '"Toner" is 3 days overdue.'), mk("task-1", "Projects")];

  it("hides kinds switched off in Settings and keeps the rest", () => {
    const prefs = defaultSettings().notifications;
    expect(applyPrefs(all, prefs)).toHaveLength(5);
    const off = { ...prefs, enabled: { ...prefs.enabled, renewals: false, overdueInvoices: false, approvals: false } };
    expect(applyPrefs(all, off).map((i) => i.id)).toEqual(["adm-o-1", "task-1"]);
  });

  it("works out what is new and reads the saved list defensively", () => {
    expect([...unseen([{ id: "a" }, { id: "b" }], ["a"])]).toEqual(["b"]);
    expect(rememberSeen([{ id: "a" }])).toEqual(["a"]);
    expect(parseSeen("nope")).toEqual([]);
    expect(parseSeen(JSON.stringify(["a", 3]))).toEqual(["a"]);
  });
});
