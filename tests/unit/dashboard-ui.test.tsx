// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "@/components/modules/dashboard";
import { buildDashboard } from "@/lib/dashboard/logic";
import { sampleRequests, sampleRoutines } from "../support/admin-sample-data";
import { sampleInvoices } from "../support/invoices-sample-data";
import { sampleLicenses } from "../support/licenses-sample-data";
import { sampleProjects } from "../support/projects-sample-data";
import { sampleVendors } from "../support/vendors-sample-data";
import { todayLocal } from "@/lib/dates";

const today = todayLocal();
const data = buildDashboard({
  invoices: sampleInvoices(today), licenses: sampleLicenses(today), projects: sampleProjects(today),
  vendors: sampleVendors(today), requests: sampleRequests(today), routines: sampleRoutines(today),
}, today);

const show = () => render(<Dashboard base="/app" data={data} serverToday={today} name="Kyle" />);
const rows = () => screen.getAllByTestId("attention-item");

beforeEach(() => window.localStorage.clear());

describe("Dashboard", () => {
  it("greets by name, shows grouped tiles that link to their service, and the quick actions", () => {
    show();
    expect(screen.getByTestId("greeting").textContent).toMatch(/Kyle$/);
    for (const g of ["Money", "Compliance", "Work"]) expect(screen.getByRole("heading", { name: g })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Overdue invoices/ }).getAttribute("href")).toBe("/app/invoices");
    expect(screen.getByRole("link", { name: "New invoice" }).getAttribute("href")).toBe("/app/invoices?new=1");
    expect(screen.getByRole("link", { name: "Upload document" }).getAttribute("href")).toBe("/app?upload=1");
    expect(screen.getByRole("link", { name: "New request" }).getAttribute("href")).toBe("/app/admin?new=1");
  });

  it("shows five attention items, expands to all, and filters by service", async () => {
    const user = userEvent.setup();
    show();
    expect(rows()).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: /^View all \(\d+\)/ }));
    expect(rows().length).toBeGreaterThan(5);
    await user.click(screen.getByRole("button", { name: /^Invoices \(/ }));
    for (const r of rows()) expect(r.textContent).toContain("Invoices");
  });

  it("adds an item to Today (once) and snoozes it until tomorrow, with a way to restore", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: /^Invoices \(/ }));
    const first = rows()[0];
    const add = within(first).getByRole("button", { name: /^Add to Today/ });
    await user.click(add);
    expect(within(screen.getByTestId("today-todos")).getAllByTestId("todo-item")).toHaveLength(1);
    expect((within(rows()[0]).getByRole("button", { name: /^Add to Today/ }) as HTMLButtonElement).disabled).toBe(true);

    const before = rows().length;
    await user.click(within(rows()[0]).getByRole("button", { name: /^Snooze/ }));
    expect(rows()).toHaveLength(before - 1);
    expect(screen.getByText(/snoozed until tomorrow/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(rows()).toHaveLength(before);
  });

  it("says so when nothing needs attention", () => {
    render(<Dashboard base="/app" data={{ ...data, items: [] }} serverToday={today} />);
    expect(screen.getByText("You are all caught up.")).toBeTruthy();
    expect(screen.getByTestId("greeting").textContent).not.toContain(",");
  });
});
