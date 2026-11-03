import { describe, expect, it } from "vitest";
import { loadDashboardSources } from "@/lib/dashboard/data";
import type { DashboardSources } from "@/lib/dashboard/logic";
import { sampleInvoices } from "../support/invoices-sample-data";
import { sampleLicenses } from "../support/licenses-sample-data";
import { sampleProjects } from "../support/projects-sample-data";
import { sampleVendors } from "../support/vendors-sample-data";
import { buildDashboard, dayInZone, upcomingLoad } from "@/lib/dashboard/logic";
import { isSnoozed, parseSnoozed, pruneSnoozed, snooze } from "@/lib/dashboard/snooze";
import { addTodo, hasOpenTodo, laterCount, parseTodos } from "@/lib/todos/logic";

const T = "2026-10-26";

const sources = (): DashboardSources => ({
  invoices: sampleInvoices(T), licenses: sampleLicenses(T), projects: sampleProjects(T),
  vendors: sampleVendors(T),
});

describe("buildDashboard", () => {
  it("starts empty: zeros, nothing needing attention, a quiet week and an all-clear status", async () => {
    const d = buildDashboard(await loadDashboardSources(), T);
    expect(d.items).toEqual([]);
    expect(d.status).toBe("clear");
    expect(d.kpis[0].value).toBe("$0.00");
    expect(d.kpis.every((k) => k.note.tone === "good")).toBe(true);
    expect(d.workload.every((w) => w.open === 0 && w.attention === 0)).toBe(true);
    expect(d.upcoming.map((u) => u.count)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
  it("has three cards that link to their service, a workload row per service, and orders the action list by severity", () => {
    const d = buildDashboard(sources(), T);
    expect(d.kpis.map((k) => k.id)).toEqual(["money", "tasks", "attention"]);
    expect(d.kpis.every((k) => k.href.startsWith("/app"))).toBe(true);
    expect(d.kpis[0].note).toEqual({ tone: "bad", text: "2 overdue" });
    expect(d.workload.map((w) => w.label)).toEqual(["Invoices", "Licenses", "Vendors", "Projects"]);
    expect(d.workload[0]).toEqual({ label: "Invoices", open: 4, attention: 3 });
    expect(d.status).toBe("attention");
    expect(d.kpis[2].value).toBe(String(d.items.length));
    const rank = { critical: 0, warning: 1, info: 2 };
    const ranks = d.items.map((i) => rank[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(d.items.map((i) => i.id)).size).toBe(d.items.length);
    expect(d.items.some((i) => i.area === "Invoices" && i.label === "Overdue")).toBe(true);
  });
  it("counts what falls due over the next seven days, with anything late on today", () => {
    const up = upcomingLoad(sources(), T);
    expect(up).toHaveLength(7);
    expect(up[0].day).toBe(T);
    expect(up.map((u) => u.label).join("")).toBe("MTWTFSS"); // 2026-10-26 is a Monday
    expect(up[0].count).toBeGreaterThanOrEqual(2); // the two overdue invoices land on today
    expect(up.reduce((n, u) => n + u.count, 0)).toBeGreaterThan(up[0].count);
  });
  it("is plain JSON, so it can cross from server to client", () => {
    const d = buildDashboard(sources(), T);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });
});

describe("dayInZone", () => {
  it("uses the visitor's zone, and UTC when it is missing or invalid", () => {
    const now = new Date("2026-10-26T02:00:00Z");
    expect(dayInZone("America/Los_Angeles", now)).toBe("2026-10-25");
    expect(dayInZone("Asia/Tokyo", now)).toBe("2026-10-26");
    expect(dayInZone(null, now)).toBe("2026-10-26");
    expect(dayInZone("Not/AZone", now)).toBe("2026-10-26");
  });
});

describe("snooze", () => {
  it("hides an item until tomorrow, then forgets it", () => {
    const s = snooze({}, "inv-1", T);
    expect(isSnoozed(s, "inv-1", T)).toBe(true);
    expect(isSnoozed(s, "inv-1", "2026-10-27")).toBe(false);
    expect(pruneSnoozed(s, "2026-10-27")).toEqual({});
  });
  it("parses saved data defensively", () => {
    expect(parseSnoozed("nope")).toEqual({});
    expect(parseSnoozed("[1]")).toEqual({});
    expect(parseSnoozed(JSON.stringify({ a: "2026-10-27", b: 5, c: "x" }))).toEqual({ a: "2026-10-27" });
  });
});

describe("todos from the dashboard", () => {
  it("keeps only in-app links and avoids duplicates", () => {
    const l = addTodo([], "Pay it", T, "1", { href: "/app/invoices", area: "Invoices" });
    expect(l[0]).toMatchObject({ href: "/app/invoices", area: "Invoices" });
    expect(addTodo([], "x", T, "2", { href: "https://evil.example", area: "A" })[0].href).toBeUndefined();
    expect(addTodo([], "x", T, "2", { href: "//evil.example", area: "A" })[0].href).toBeUndefined();
    expect(parseTodos(JSON.stringify([{ id: "1", title: "t", day: T, href: "javascript:alert(1)" }]))[0].href).toBeUndefined();
    expect(hasOpenTodo(l, " Pay it ", T)).toBe(true);
    expect(hasOpenTodo(l, "Other", T)).toBe(false);
  });
  it("counts tasks planned for later", () => {
    const l = [...addTodo([], "a", "2026-10-30", "1"), ...addTodo([], "b", T, "2")];
    expect(laterCount(l, T)).toBe(1);
  });
});
