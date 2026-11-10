// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "@/components/modules/dashboard";
import { buildDashboard } from "@/lib/dashboard/logic";
import { sampleInvoices } from "../support/invoices-sample-data";
import { sampleLicenses } from "../support/licenses-sample-data";
import { sampleProjects } from "../support/projects-sample-data";
import { sampleVendors } from "../support/vendors-sample-data";
import { todayLocal } from "@/lib/dates";

const today = todayLocal();
const data = buildDashboard({
  invoices: sampleInvoices(today), licenses: sampleLicenses(today), projects: sampleProjects(today),
  vendors: sampleVendors(today),
}, today);

const show = () => render(<Dashboard base="/app" data={data} serverToday={today} name="Kyle" />);
const rows = () => screen.getAllByTestId("attention-item");

beforeEach(() => window.localStorage.clear());

describe("Dashboard", () => {
  it("shows three cards that link to their service, the charts and today's progress", () => {
    show();
    expect(screen.getByRole("link", { name: /Outstanding invoices/ }).getAttribute("href")).toBe("/app/invoices");
    expect(screen.getByRole("link", { name: /Open tasks/ }).getAttribute("href")).toBe("/app/projects");
    expect(screen.getByRole("img", { name: /^Open work by area/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /^Due in the next 7 days/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Today's to-dos done: 0%/ })).toBeTruthy();
    expect(screen.getByText("NEEDS ATTENTION")).toBeTruthy();
  });

  it("shows five attention items, expands to all, and filters by area", async () => {
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
    const add = within(first).getByRole("button", { name: /^Add to today/ });
    await user.click(add);
    expect(within(screen.getByTestId("today-todos")).getAllByTestId("todo-item")).toHaveLength(1);
    expect((within(rows()[0]).getByRole("button", { name: /^Add to today/ }) as HTMLButtonElement).disabled).toBe(true);

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
  });

  it("has a Licenses & renewals tab with the counts and what expires next", async () => {
    const user = userEvent.setup();
    show();
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("tab", { name: "Licenses & renewals" }));
    const tab = screen.getByTestId("licenses-tab");
    expect(within(tab).getAllByTestId("license-next")).toHaveLength(data.licenses.next.length);
    expect(within(tab).getByTestId("licenses-standing").textContent).toBe(`${data.licenses.inGoodStanding}%`);
    expect(screen.queryByTestId("workload")).toBeNull(); // the overview charts are not on this tab
  });

  it("invites you to add licenses when there are none", async () => {
    const user = userEvent.setup();
    render(<Dashboard base="/app" data={{ ...data, licenses: { ...data.licenses, total: 0, next: [] } }} serverToday={today} />);
    await user.click(screen.getByRole("tab", { name: "Licenses & renewals" }));
    expect(screen.getByText("No licenses tracked yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start from a template" }).getAttribute("href")).toBe("/app/licenses");
  });
});
