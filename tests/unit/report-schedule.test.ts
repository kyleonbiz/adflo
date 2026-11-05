import { describe, expect, it } from "vitest";
import { addSchedule, dueSchedules, markDelivered, overviewText, parseRecipients, parseSchedules, removeSchedule, reportText } from "@/lib/reporting/schedule";
import { buildReports } from "@/lib/reporting/logic";
import { emptySources } from "@/lib/reporting/logic";
import { sampleInvoices } from "../support/invoices-sample-data";

const T = "2026-10-26";
const one = () => addSchedule([], { reportId: "invoices", every: "monthly", nextOn: "2026-10-20", recipients: "" }, "s1");

describe("scheduled reports", () => {
  it("is due on or after its date and rolls forward past today once delivered", () => {
    const list = one();
    expect(dueSchedules(list, "2026-10-19")).toHaveLength(0);
    expect(dueSchedules(list, T)).toHaveLength(1);
    const next = markDelivered(list, "s1", T)[0];
    expect(next.nextOn).toBe("2026-11-20");
    expect(dueSchedules([next], T)).toHaveLength(0);
  });

  it("skips missed periods instead of replaying them", () => {
    const list = addSchedule([], { reportId: "overview", every: "weekly", nextOn: "2026-01-01", recipients: "" }, "s2");
    const next = markDelivered(list, "s2", T)[0];
    expect(next.nextOn > T).toBe(true);
    expect(next.nextOn <= "2026-11-02").toBe(true);
  });

  it("removes a schedule and reads saved ones defensively", () => {
    expect(removeSchedule(one(), "s1")).toEqual([]);
    expect(parseSchedules("not json")).toEqual([]);
    expect(parseSchedules(JSON.stringify([{ id: "x" }, ...one()]))).toHaveLength(1);
  });

  it("separates valid and invalid recipients", () => {
    expect(parseRecipients("a@b.co, nope, c@d.org")).toEqual({ valid: ["a@b.co", "c@d.org"], invalid: ["nope"] });
    expect(parseRecipients("")).toEqual({ valid: [], invalid: [] });
  });
});

describe("report text", () => {
  it("writes each report and the whole summary as plain text", () => {
    const reports = buildReports({ ...emptySources(), invoices: sampleInvoices(T) }, T);
    const inv = reports.find((r) => r.id === "invoices")!;
    expect(reportText(inv, T)).toContain("INVOICES REPORT");
    expect(reportText(inv, T)).toContain("Outstanding");
    const all = overviewText(reports, T);
    expect(all).toContain("BUSINESS SUMMARY");
    for (const r of reports) expect(all).toContain(`== ${r.name} ==`);
    expect(reportText(reports.find((r) => r.id === "vendors")!, T)).toContain("No records yet.");
  });
});
