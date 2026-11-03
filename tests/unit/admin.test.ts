import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { parseEmailText } from "@/lib/admin/email";
import { foldLine, icsEscape, toIcs } from "@/lib/admin/ics";
import {
  calendarEvents, createRequest, decide, dueRoutines, isOverdue, notifications, runRoutines, setStatus, summarize,
} from "@/lib/admin/logic";
import { sampleRequests, sampleRoutines } from "../support/admin-sample-data";
import { approvalReasons, suggestCategory, suggestPriority } from "@/lib/admin/triage";
import { requestFormSchema, routineFormSchema } from "@/lib/admin/validation";

const TODAY = "2026-10-25";

describe("suggestCategory", () => {
  it.each([
    ["Reschedule Thursday's vendor call", "Scheduling", "high"],
    ["Wire $4,800 to Globex. Invoice 4471 attached, pay by Friday", "Finance & payments", "high"],
    ["Reset my password, I'm locked out of my account", "Accounts & access", "high"],
    ["Please install the new software on my laptop", "IT & equipment", "high"],
    ["Onboarding checklist for the new hire", "HR & people", "high"],
    ["Please send the report", "Documents", "medium"],
    ["Can you scan this pdf?", "Documents", "high"],
    ["Please tidy the kitchen", "General", "low"],
  ])("%s -> %s (%s)", (text, category, confidence) => {
    expect(suggestCategory(text)).toMatchObject({ category, confidence });
  });
  it("reports which words matched and calls ties low confidence", () => {
    expect(suggestCategory("Reschedule the vendor call").matched).toEqual(["reschedul", "call"]);
    expect(suggestCategory("Order a printer")).toMatchObject({ confidence: "low" });
  });
  it("matches word starts only, not the middle of words", () => {
    expect(suggestCategory("The countersigned copy").matched).toEqual(["copy"]);
    expect(suggestCategory("Bookkeeping").category).toBe("Scheduling"); // "book" starts the word
    expect(suggestCategory("Facebook post").category).toBe("General"); // but "book" inside "Facebook" does not
  });
});

describe("suggestPriority", () => {
  it("spots urgency and low-key requests", () => {
    expect(suggestPriority("URGENT: server is down")).toBe("high");
    expect(suggestPriority("Need this today please")).toBe("high");
    expect(suggestPriority("Order toner, no rush")).toBe("low");
    expect(suggestPriority("Order toner, no rush but needed asap")).toBe("low"); // the calmer signal wins
    expect(suggestPriority("Update the contact list")).toBe("normal");
    expect(suggestPriority("Saturday plans")).toBe("normal"); // "today" is not inside "Saturday"
  });
});

describe("approvalReasons", () => {
  it.each([
    ["Wire $4,800 to Globex", "", "Finance & payments", ["mentions a wire transfer"]],
    ["Process refund for order 12", "", "General", ["mentions a refund"]],
    ["Delete the old client folder", "", "Documents", ["deletes or removes something"]],
    ["Cancel the conference line", "", "General", ["cancels or terminates something"]],
    ["Give Sam access to the shared drive", "", "General", ["changes who has access"]],
    ["Reset the password for Dana", "", "General", ["touches login credentials"]],
    ["Please sign the new lease", "", "Documents", ["commits the business to a contract"]],
    ["Buy two monitors", "Budget is $600.", "IT & equipment", []],
    ["Buy two monitors for $600", "", "IT & equipment", ["spends money"]],
  ])("%s", (title, description, category, expected) => {
    expect(approvalReasons(title, description, category as never)).toEqual(expected);
  });
  it("is empty for routine work, but finance and access categories always need approval", () => {
    expect(approvalReasons("Send the weekly agenda", "", "Scheduling")).toEqual([]);
    expect(approvalReasons("Reconcile statements", "", "Finance & payments")).toEqual(["finance requests need approval"]);
    expect(approvalReasons("Add Sam to the team list", "", "Accounts & access")).toEqual(["access changes need approval"]);
  });
  it("does not trip on look-alike words", () => {
    expect(approvalReasons("Run payroll report", "", "HR & people")).toEqual([]);
    expect(approvalReasons("Remove lunch from the agenda", "", "Scheduling")).toEqual(["deletes or removes something"]);
    expect(approvalReasons("Signed contract received", "", "Documents")).toEqual([]);
  });
});

describe("requests", () => {
  const input = { title: "Reschedule call", description: "", requester: "Dana", category: "Scheduling" as const, priority: "normal" as const, dueOn: null, source: "manual" as const };
  it("go straight to open unless an approval rule fires", () => {
    expect(createRequest(input, TODAY, "a")).toMatchObject({ status: "open", approvalReasons: [], createdOn: TODAY });
    const risky = createRequest({ ...input, title: "Wire $500 to Acme", category: "Finance & payments" }, TODAY, "b");
    expect(risky).toMatchObject({ status: "pending_approval", approvalReasons: ["mentions a wire transfer"] });
  });
  it("can be approved or declined once, with the decider recorded", () => {
    const pending = createRequest({ ...input, title: "Delete old files" }, TODAY, "c");
    expect(decide(pending, "approved", "Boss", TODAY, " ok ")).toMatchObject({ status: "open", decidedBy: "Boss", comment: "ok" });
    const declined = decide(pending, "declined", "Boss", TODAY);
    expect(declined.status).toBe("declined");
    expect(decide(declined, "approved", "Other", TODAY)).toBe(declined);
    const open = createRequest(input, TODAY, "d");
    expect(decide(open, "approved", "Boss", TODAY)).toBe(open);
  });
  it("moves between working states but cannot skip approval", () => {
    const open = createRequest(input, TODAY, "e");
    const started = setStatus(open, "in_progress", TODAY);
    expect(started.status).toBe("in_progress");
    const done = setStatus(started, "done", "2026-10-26");
    expect(done).toMatchObject({ status: "done", doneOn: "2026-10-26" });
    expect(setStatus(done, "open", TODAY)).toMatchObject({ status: "open", doneOn: null });
    const pending = createRequest({ ...input, title: "Delete old files" }, TODAY, "f");
    expect(setStatus(pending, "open", TODAY)).toBe(pending);
    expect(setStatus(pending, "done", TODAY)).toBe(pending);
  });
  it("is overdue only while active and past due", () => {
    const r = createRequest({ ...input, dueOn: addDays(TODAY, -1) }, TODAY, "g");
    expect(isOverdue(r, TODAY)).toBe(true);
    expect(isOverdue(setStatus(r, "done", TODAY), TODAY)).toBe(false);
    expect(isOverdue({ ...r, dueOn: TODAY }, TODAY)).toBe(false);
    expect(isOverdue({ ...r, dueOn: null }, TODAY)).toBe(false);
  });
});

describe("routines", () => {
  const routines = sampleRoutines(TODAY);
  it("finds the due ones", () => {
    expect(dueRoutines(routines, TODAY).map((r) => r.id)).toEqual(["t-1"]);
    expect(dueRoutines(routines, addDays(TODAY, 4)).map((r) => r.id)).toEqual(["t-1", "t-2"]);
  });
  it("creates one request per due routine and moves it past today", () => {
    let n = 0;
    const { routines: next, created } = runRoutines(routines, TODAY, () => `new-${++n}`);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ id: "new-1", title: "Reconcile bank statements", source: "recurring", dueOn: addDays(TODAY, -2), requester: "Recurring task" });
    expect(next[0].nextDueOn > TODAY).toBe(true);
    expect(next[1]).toBe(routines[1]);
    expect(dueRoutines(next, TODAY)).toEqual([]);
  });
  it("does not pile up requests for a routine that missed many runs", () => {
    const old = [{ ...routines[1], nextDueOn: addDays(TODAY, -20) }]; // weekly
    const { routines: next, created } = runRoutines(old, TODAY, () => "x");
    expect(created).toHaveLength(1);
    expect(next[0].nextDueOn).toBe(addDays(TODAY, 1));
  });
  it("treats today as due", () => {
    const { created } = runRoutines([{ ...routines[1], nextDueOn: TODAY }], TODAY, () => "x");
    expect(created).toHaveLength(1);
  });
});

describe("notifications and summary", () => {
  const requests = sampleRequests(TODAY);
  const routines = sampleRoutines(TODAY);
  it("lists the most urgent things first", () => {
    const n = notifications(requests, routines, TODAY);
    expect(n.map((x) => [x.severity, x.message])).toEqual([
      ["critical", `"Reschedule Thursday's vendor call" is 1 day overdue.`],
      ["warning", `"Wire $4,800 to Globex for the annual license" is waiting for approval.`],
      ["info", `"Give Sam access to the shared drive" is waiting for approval.`],
      ["info", "1 recurring task due: Reconcile bank statements."],
    ]);
  });
  it("announces requests due today", () => {
    const r = createRequest({ title: "Send report", description: "", requester: "", category: "Documents", priority: "normal", dueOn: TODAY, source: "manual" }, TODAY, "z");
    expect(notifications([r], [], TODAY)).toEqual([{ id: "d-z", severity: "warning", message: '"Send report" is due today.' }]);
  });
  it("summarizes the sample", () => {
    expect(summarize(requests, routines, TODAY)).toEqual({ open: 4, pendingApproval: 2, overdue: 1, routinesDue: 1 });
  });
});

describe("parseEmailText", () => {
  it("reads subject, sender and body, dropping quoted replies", () => {
    const email = [
      "From: Dana Whitfield <dana@acme.example>", "To: help@aurum.example", "Subject: Re: Fwd: Please reschedule Thursday", "Date: Mon, 5 Oct 2026", "",
      "Hi,", "", "Could you move the call to Friday?", "", "Thanks,", "Dana", "", "On Mon, Oct 5, 2026 at 9:00 AM Kyle wrote:", "> Thursday works for me", "> see you then",
    ].join("\r\n");
    expect(parseEmailText(email)).toEqual({
      title: "Please reschedule Thursday", requester: "Dana Whitfield",
      description: "Hi,\n\nCould you move the call to Friday?\n\nThanks,\nDana",
    });
  });
  it("handles a bare address, a missing sender and an Outlook-style divider", () => {
    expect(parseEmailText("From: ops@acme.example\nSubject: Invoice question\n\nWhere is it?\n\n-----Original Message-----\nFrom: x\nold text")).toEqual({
      title: "Invoice question", requester: "ops@acme.example", description: "Where is it?",
    });
    expect(parseEmailText("Subject: Only a subject")).toMatchObject({ title: "Only a subject", requester: "", description: "" });
  });
  it("uses the first line as the title when there are no headers", () => {
    expect(parseEmailText("\n\nOrder more toner\nTwo black cartridges please.\n> quoted")).toEqual({
      title: "Order more toner", requester: "", description: "Two black cartridges please.",
    });
  });
  it("does not mistake a first line like 'Note: ...' for headers, and trims long text", () => {
    expect(parseEmailText("Reminder: pay the rent\nsoon")).toMatchObject({ title: "Reminder: pay the rent", description: "soon" });
    const long = parseEmailText(`Subject: ${"A".repeat(300)}\n\n${"b".repeat(5000)}`);
    expect(long.title).toHaveLength(120);
    expect(long.description).toHaveLength(1000);
    expect(parseEmailText("")).toEqual({ title: "", requester: "", description: "" });
  });
});

describe("ics", () => {
  it("escapes special characters", () => {
    expect(icsEscape("a,b;c\\d\ne\r\nf\u0000g")).toBe("a\\,b\;c\\\\d\\ne\\nfg");
  });
  it("folds long lines at 75 octets without splitting characters", () => {
    expect(foldLine("short")).toBe("short");
    const long = "SUMMARY:" + "é".repeat(100); // 2 bytes each
    const folded = foldLine(long).split("\r\n");
    expect(folded.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    folded.forEach((l, i) => expect(enc.encode(i === 0 ? l : l).length).toBeLessThanOrEqual(75));
    expect(folded.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(folded.map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe(long);
  });
  it("writes all-day events with the end on the next day, and CRLF line endings", () => {
    const ics = toIcs([{ uid: "request 1/a", day: "2026-10-31", summary: "Pay, then file; done", description: "Line1\nLine2" }], "2026-10-25");
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("UID:request-1-a@adflo");
    expect(lines).toContain("DTSTAMP:20261025T000000Z");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261031");
    expect(lines).toContain("DTEND;VALUE=DATE:20261101");
    expect(lines).toContain("SUMMARY:Pay\\, then file\; done");
    expect(lines).toContain("DESCRIPTION:Line1\\nLine2");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
  it("ends the year correctly and handles an empty list", () => {
    expect(toIcs([{ uid: "x", day: "2026-12-31", summary: "s" }], "2026-10-25")).toContain("DTEND;VALUE=DATE:20270101");
    expect(toIcs([], "2026-10-25")).toBe("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//AdFlo//Requests//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nEND:VCALENDAR\r\n");
  });
  it("includes active dated requests and every routine, skipping done and undated ones", () => {
    const events = calendarEvents(sampleRequests(TODAY), sampleRoutines(TODAY));
    expect(events.map((e) => e.uid)).toEqual(["request-r-1", "request-r-2", "routine-t-1", "routine-t-2", "routine-t-3"].filter((u) => u !== "request-r-3"));
    expect(events.find((e) => e.uid === "routine-t-2")!.summary).toBe("Recurring: Send weekly team agenda");
  });
});

describe("forms", () => {
  const ok = { title: "Order toner", description: "", requester: "", category: "IT & equipment", priority: "low", dueOn: "" };
  it("accepts a request and turns a blank date into null", () => {
    expect(requestFormSchema.parse(ok).dueOn).toBeNull();
    expect(requestFormSchema.parse({ ...ok, dueOn: "2026-11-02" }).dueOn).toBe("2026-11-02");
  });
  it.each([[{ title: "ab" }], [{ dueOn: "2026-02-30" }], [{ category: "Lunch" }], [{ priority: "urgent" }], [{ description: "x".repeat(1001) }]])("rejects %j", (patch) => {
    expect(requestFormSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
  it("validates routines", () => {
    const r = { title: "Weekly agenda", description: "", category: "Scheduling", every: "weekly", nextDueOn: "2026-11-02" };
    expect(routineFormSchema.safeParse(r).success).toBe(true);
    expect(routineFormSchema.safeParse({ ...r, every: "daily" }).success).toBe(false);
    expect(routineFormSchema.safeParse({ ...r, nextDueOn: "" }).success).toBe(false);
  });
});

import { STALE_APPROVAL_DAYS, STALE_OPEN_DAYS, stuckRequests } from "@/lib/admin/logic";
import type { AdminRequest } from "@/lib/admin/types";

describe("invisible bottlenecks", () => {
  const make = (id: string, over: Partial<AdminRequest>): AdminRequest => ({
    ...createRequest({ title: id, description: "", requester: "A", category: "General", priority: "normal", dueOn: null, source: "manual" }, addDays(TODAY, -10), id), ...over,
  });

  it("flags approvals nobody answered and open work nobody started, longest first", () => {
    const stale = make("wire", { status: "pending_approval" });
    const fresh = { ...make("new", { status: "pending_approval" }), createdOn: addDays(TODAY, -(STALE_APPROVAL_DAYS - 1)) };
    const unstarted = { ...make("toner", { status: "open" }), createdOn: addDays(TODAY, -STALE_OPEN_DAYS) };
    const dated = { ...make("dated", { status: "open", dueOn: addDays(TODAY, 3) }), createdOn: addDays(TODAY, -30) };
    const stuck = stuckRequests([fresh, unstarted, stale, dated], TODAY);
    expect(stuck.map((s) => [s.request.id, s.reason])).toEqual([["wire", "approval"], ["toner", "unstarted"]]);
  });

  it("says how long an approval has waited, and warns about it", () => {
    const n = notifications([make("wire", { status: "pending_approval" })], [], TODAY);
    expect(n).toEqual([{ id: "a-wire", severity: "warning", message: '"wire" is waiting for approval (10 days so far).' }]);
  });

  it("notes unstarted work in the digest", () => {
    const n = notifications([make("toner", { status: "open" })], [], TODAY);
    expect(n[0].message).toContain("has not been started in 10 days");
  });
});

import { createSubmission as makeSub, decide as decideSub } from "@/lib/forms/logic";
import { starterForms } from "@/lib/forms/starter-forms";

describe("approval chains on requests and form submissions", () => {
  const input = { title: "Wire the deposit", description: "wire transfer", requester: "A", category: "Finance & payments" as const, priority: "normal" as const, dueOn: null, source: "manual" as const };

  it("moves a request through each approver, opening it only after the last", () => {
    let r = createRequest(input, TODAY, "r1", ["Department head", "Finance manager"]);
    expect(r.status).toBe("pending_approval");
    r = decide(r, "approved", "x", TODAY, "fine");
    expect(r.status).toBe("pending_approval");
    expect(r.approval?.log.map((e) => e.by)).toEqual(["Department head"]);
    r = decide(r, "approved", "x", TODAY);
    expect(r.status).toBe("open");
    expect(r.decidedBy).toBe("Finance manager");
  });

  it("declines a request at the first step, and behaves as before with no chain", () => {
    const declined = decide(createRequest(input, TODAY, "r2", ["A", "B"]), "declined", "x", TODAY, "no");
    expect(declined.status).toBe("declined");
    expect(declined.approval?.log).toHaveLength(1);
    const plain = createRequest(input, TODAY, "r3");
    expect(plain.approval).toBeUndefined();
    expect(decide(plain, "approved", "Boss", TODAY).decidedBy).toBe("Boss");
  });

  it("applies the same chain to a form submission", () => {
    const form = starterForms().find((f) => f.requiresApproval)!;
    let s = makeSub(form, {}, "Sam", TODAY, "s1", ["Lead", "Director"]);
    expect(s.status).toBe("pending");
    s = decideSub(s, "approved", "x", TODAY);
    expect(s.status).toBe("pending");
    s = decideSub(s, "approved", "x", TODAY);
    expect(s.status).toBe("approved");
    expect(makeSub(form, {}, "Sam", TODAY, "s2").approval).toBeUndefined();
    const rejected = decideSub(makeSub(form, {}, "Sam", TODAY, "s3", ["Lead", "Director"]), "rejected", "x", TODAY);
    expect(rejected.status).toBe("rejected");
  });
});
