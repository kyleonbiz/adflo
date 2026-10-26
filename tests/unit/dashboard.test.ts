import { describe, expect, it } from "vitest";
import { loadDashboardSources } from "@/lib/dashboard/data";
import { buildDashboard, dayInZone } from "@/lib/dashboard/logic";
import { isSnoozed, parseSnoozed, pruneSnoozed, snooze } from "@/lib/dashboard/snooze";
import { addTodo, hasOpenTodo, laterCount, parseTodos } from "@/lib/todos/logic";

const T = "2026-10-26";

describe("buildDashboard", () => {
  it("groups the tiles, links each to its service and orders the action list by severity", async () => {
    const d = buildDashboard(await loadDashboardSources(T), T);
    expect(d.groups.map((g) => g.title)).toEqual(["Money", "Compliance", "Work"]);
    const tiles = d.groups.flatMap((g) => g.tiles);
    expect(tiles).toHaveLength(8);
    expect(tiles.every((t) => t.href.startsWith("/app/"))).toBe(true);
    expect(tiles.find((t) => t.id === "overdue-invoices")?.tone).toBe("danger");
    const rank = { critical: 0, warning: 1, info: 2 };
    const ranks = d.items.map((i) => rank[i.severity]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(d.items.map((i) => i.id)).size).toBe(d.items.length);
    expect(d.items.some((i) => i.area === "Invoices" && i.label === "Overdue")).toBe(true);
  });
  it("is plain JSON, so it can cross from server to client", async () => {
    const d = buildDashboard(await loadDashboardSources(T), T);
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
