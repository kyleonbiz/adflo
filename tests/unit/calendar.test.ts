import { describe, expect, it } from "vitest";
import { agenda, buildEvents, byDay, monthGrid, monthLabel, monthOf, nextMonth, type CalendarSources } from "@/lib/calendar/logic";
import type { Invoice } from "@/lib/invoices/types";
import type { License } from "@/lib/licenses/types";
import type { Project } from "@/lib/projects/types";
import type { Vendor } from "@/lib/vendors/types";

const T = "2026-11-04";
const none: CalendarSources = { invoices: [], licenses: [], projects: [], vendors: [], reminders: [] };

const invoice = (over: Partial<Invoice>): Invoice => ({ id: "i1", number: "INV-1", client: "Acme", dueOn: "2026-11-10", status: "sent", ...over }) as Invoice;
const license = (over: Partial<License>): License => ({ id: "l1", name: "Food permit", issuer: "County", expiresOn: "2026-12-01", reminderDays: [30, 7], ...over }) as License;
const project = (over: Partial<Project> = {}): Project =>
  ({ id: "p1", name: "Office move", tasks: [{ id: "t1", title: "Book movers", dueOn: "2026-11-06", done: false }, { id: "t2", title: "Pack", dueOn: "2026-11-07", done: true }], milestones: [{ id: "m1", title: "Keys", dueOn: "2026-11-20", doneOn: null }], ...over }) as Project;
const vendor = (over: Partial<Vendor> = {}): Vendor =>
  ({ id: "v1", name: "Blue Ridge", status: "active", documents: [{ id: "d1", type: "COI", required: true, expiresOn: "2026-11-15", receivedOn: null }], contractEndsOn: "2026-12-31", ...over }) as Vendor;

describe("buildEvents", () => {
  it("includes what is still ahead or late, and leaves out what is finished", () => {
    const e = buildEvents({
      ...none,
      invoices: [invoice({}), invoice({ id: "i2", number: "INV-2", status: "paid" }), invoice({ id: "i3", number: "INV-3", status: "draft" })],
      projects: [project()],
    }, T);
    expect(e.map((x) => x.title)).toEqual(["Book movers", "INV-1 due", "Milestone: Keys"]);
  });

  it("marks anything past its day as late", () => {
    const e = buildEvents({ ...none, invoices: [invoice({ dueOn: "2026-10-30" })] }, T);
    expect(e[0].late).toBe(true);
    expect(buildEvents({ ...none, invoices: [invoice({ dueOn: T })] }, T)[0].late).toBe(false);
  });

  it("adds a license's expiry and the renewal reminders still to come", () => {
    const e = buildEvents({ ...none, licenses: [license({})] }, T);
    // The 30-day reminder (Nov 1) has already passed, so only the 7-day one and the expiry remain.
    expect(e.map((x) => [x.day, x.title])).toEqual([["2026-11-24", "Renew Food permit"], ["2026-12-01", "Food permit expires"]]);
  });

  it("adds vendor document expiries and contract ends, but not for inactive vendors", () => {
    expect(buildEvents({ ...none, vendors: [vendor()] }, T).map((x) => x.title)).toEqual(["COI expires", "Contract ends"]);
    expect(buildEvents({ ...none, vendors: [vendor({ status: "inactive" })] }, T)).toEqual([]);
  });

  it("includes reminders on their day and ignores bad dates", () => {
    const e = buildEvents({ ...none, reminders: [{ id: "rem-task-1", text: "Send the W-9", area: "Tasks", href: "/app/projects", on: "2026-11-05" }], invoices: [invoice({ dueOn: "soon" })] }, T);
    expect(e.map((x) => x.title)).toEqual(["Send the W-9"]);
  });

  it("is sorted by day and groups by day", () => {
    const e = buildEvents({ ...none, invoices: [invoice({ dueOn: "2026-11-12" }), invoice({ id: "i2", number: "INV-2", dueOn: "2026-11-08" })] }, T);
    expect(e.map((x) => x.day)).toEqual(["2026-11-08", "2026-11-12"]);
    expect([...byDay(e).keys()]).toEqual(["2026-11-08", "2026-11-12"]);
  });
});

describe("month grid", () => {
  it("fills whole weeks, Sunday first, with the month's own days marked", () => {
    const g = monthGrid("2026-11-01"); // November 2026 starts on a Sunday
    expect(g).toHaveLength(5);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0][0]).toEqual({ day: "2026-11-01", inMonth: true });
    expect(g[4][6]).toEqual({ day: "2026-12-05", inMonth: false });
    expect(g.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });

  it("pads the first week with the days before, and uses six weeks when needed", () => {
    const g = monthGrid("2026-08-01"); // August 2026 starts on a Saturday
    expect(g[0][0].day).toBe("2026-07-26");
    expect(g[0][6]).toEqual({ day: "2026-08-01", inMonth: true });
    expect(g).toHaveLength(6);
  });

  it("names the month", () => {
    expect(monthLabel("2026-11-01")).toBe("November 2026");
    expect(monthOf("2026-11-17")).toBe("2026-11-01");
  });
});

describe("agenda", () => {
  it("keeps late items and the next 60 days, and drops anything further out", () => {
    const e = buildEvents({ ...none, invoices: [invoice({ dueOn: "2026-10-01" }), invoice({ id: "i2", number: "INV-2", dueOn: "2026-12-30" }), invoice({ id: "i3", number: "INV-3", dueOn: "2027-03-01" })] }, T);
    expect(agenda(e, T).map((x) => x.title)).toEqual(["INV-1 due", "INV-2 due"]);
  });
});

describe("nextMonth", () => {
  const src = (): CalendarSources => ({
    ...none,
    invoices: [invoice({ id: "a", number: "INV-A", dueOn: "2026-12-02" }), invoice({ id: "b", number: "INV-B", dueOn: "2026-12-03" }), invoice({ id: "c", number: "INV-C", dueOn: "2026-12-20" }), invoice({ id: "z", number: "INV-Z", dueOn: "2026-11-10" }), invoice({ id: "y", number: "INV-Y", dueOn: "2027-01-05" })],
  });

  it("keeps only the calendar month after today's, whatever day of the month it is", () => {
    for (const today of ["2026-11-01", "2026-11-04", "2026-11-30"]) {
      const n = nextMonth(buildEvents(src(), today), today);
      expect(n.month).toBe("2026-12-01");
      expect(n.label).toBe("December 2026");
      expect(n.total).toBe(3);
    }
  });

  it("groups into Sunday-to-Saturday weeks and counts by kind", () => {
    const n = nextMonth(buildEvents(src(), "2026-11-04"), "2026-11-04");
    expect(n.weeks.map((w) => [w.start, w.events.length])).toEqual([["2026-11-29", 2], ["2026-12-20", 1]]);
    expect(n.weeks[0].end).toBe("2026-12-05");
    expect(n.byKind).toEqual({ Invoices: 3 });
  });

  it("rolls over the year, and is empty when nothing is due", () => {
    const dec = nextMonth(buildEvents(src(), "2026-12-15"), "2026-12-15");
    expect(dec.month).toBe("2027-01-01");
    expect(dec.total).toBe(1);
    const none_ = nextMonth([], "2026-11-04");
    expect(none_).toMatchObject({ total: 0, weeks: [] });
  });

  it("does not include late items, which belong to the month they were due", () => {
    const events = buildEvents({ ...none, invoices: [invoice({ dueOn: "2026-10-01" })] }, "2026-11-04");
    expect(nextMonth(events, "2026-11-04").total).toBe(0);
  });
});
