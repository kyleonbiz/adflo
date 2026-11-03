import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { GHOSTED_AFTER, REMINDER_GAP_DAYS, addNote, dueFollowUps, followUpState, logReminder, mailtoLink, owed, reminderEmail, unansweredReminders } from "@/lib/vendors/follow-up";
import { sampleVendors } from "../support/vendors-sample-data";
import type { Vendor } from "@/lib/vendors/types";

const T = "2026-10-26";
const initech = () => sampleVendors(T).find((v) => v.id === "v-3")!; // owes W-9 and insurance
const remind = (v: Vendor, ago: number, i: number) => logReminder({ ...v }, addDays(T, -ago), `n${i}`, "Kyle");

describe("vendor follow-up", () => {
  it("lists what a vendor still owes, and nothing for rejected or inactive vendors", () => {
    expect(owed(initech(), T).map((d) => d.type)).toEqual(["W-9", "Certificate of insurance"]);
    const vs = sampleVendors(T);
    expect(owed(vs.find((v) => v.id === "v-6")!, T)).toEqual([]); // inactive
    expect(owed(vs.find((v) => v.id === "v-4")!, T)).toEqual([]); // everything in
  });

  it("is due when never chased, waiting for a week after a reminder, then due again", () => {
    let v = initech();
    expect(followUpState(v, T)).toBe("due");
    v = remind(v, 2, 1);
    expect(followUpState(v, T)).toBe("waiting");
    v = remind(initech(), REMINDER_GAP_DAYS, 1);
    expect(followUpState(v, T)).toBe("due");
  });

  it("counts a vendor as ghosted after three unanswered reminders, and a reply restarts the count", () => {
    let v = initech();
    for (let i = 0; i < GHOSTED_AFTER; i++) v = logReminder(v, addDays(T, -30 + i * 8), `r${i}`, "Kyle");
    expect(unansweredReminders(v)).toHaveLength(GHOSTED_AFTER);
    expect(followUpState(v, T)).toBe("ghosted");
    v = addNote(v, { id: "x", on: addDays(T, -3), kind: "reply", text: "Will send Friday", by: "Kyle" });
    expect(unansweredReminders(v)).toHaveLength(0);
    expect(followUpState(v, T)).toBe("due");
  });

  it("puts ghosted vendors first in the due list", () => {
    const vs = sampleVendors(T);
    let ghost = vs.find((v) => v.id === "v-5")!;
    for (let i = 0; i < GHOSTED_AFTER; i++) ghost = logReminder(ghost, addDays(T, -40 + i * 8), `g${i}`, "Kyle");
    const due = dueFollowUps(vs.map((v) => (v.id === "v-5" ? ghost : v)), T);
    expect(due[0].vendor.id).toBe("v-5");
    expect(due[0].state).toBe("ghosted");
    expect(due.map((d) => d.vendor.id)).toContain("v-3");
  });

  it("words each reminder a little firmer and builds a mailto link", () => {
    const v = initech();
    const first = reminderEmail(v, T);
    expect(first.to).toBe("ap@initech.example");
    expect(first.body).toContain("Hi Peter Gibbons");
    expect(first.body).toContain("- W-9");
    const third = reminderEmail(logReminder(logReminder(v, addDays(T, -20), "a", "K"), addDays(T, -10), "b", "K"), T);
    expect(third.body).toContain("third request");
    expect(mailtoLink(first)).toMatch(/^mailto:ap%40initech\.example\?subject=/);
  });

  it("ignores blank notes", () => {
    const v = initech();
    expect(addNote(v, { id: "n", on: T, kind: "note", text: "   ", by: "K" })).toBe(v);
  });
});
