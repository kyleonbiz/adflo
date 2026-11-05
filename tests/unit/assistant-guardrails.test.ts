import { describe, expect, it } from "vitest";
import { DRAFT_SERVICES, MAX_DRAFTS_PER_TURN, NEVER, buildDraft, draftFromParams, guardrailPrompt, looksSensitive } from "@/lib/assistant/guardrails";
import { respond } from "@/lib/assistant/engine";
import { runTool, TOOL_DEFS, type ToolState } from "@/lib/assistant/tools";
import { emptyConfig } from "@/lib/setup/types";

const state = (): ToolState => ({ config: emptyConfig(), today: "2026-10-26", links: [], drafts: 0 });
const params = (href: string) => { const q = new URL(href, "http://x").searchParams; return (k: string) => q.get(k) ?? undefined; };

describe("assistant drafts", () => {
  it("builds a link that opens the service's form with the allowed details in", () => {
    const r = buildDraft("invoices", { client: "Acme Co", clientEmail: "ap@acme.example", amount: "250.50", dueOn: "2026-12-01", recurrence: "monthly" });
    if (!r.ok) throw new Error(r.error);
    expect(r.href.startsWith("/app/invoices?new=1&")).toBe(true);
    expect(r.used.sort()).toEqual(["amount", "client", "clientEmail", "dueOn", "recurrence"]);
    expect(draftFromParams("invoices", params(r.href))).toEqual({ client: "Acme Co", clientEmail: "ap@acme.example", amount: "250.50", dueOn: "2026-12-01", recurrence: "monthly" });
  });

  it("drops fields a service does not allow, such as a vendor's tax ID or an invoice's status", () => {
    const v = buildDraft("vendors", { name: "Acme", taxId: "12-3456789", status: "approved" });
    if (!v.ok) throw new Error(v.error);
    expect(v.dropped.sort()).toEqual(["status", "taxId"]);
    expect(v.href).not.toContain("taxId");
    const i = buildDraft("invoices", { client: "Acme", status: "paid", paidOn: "2026-10-01" });
    expect(i.ok && i.dropped.sort()).toEqual(["paidOn", "status"]);
  });

  it("refuses card numbers, Social Security numbers and passwords", () => {
    expect(looksSensitive("4111 1111 1111 1111")).toBe(true);
    expect(looksSensitive("123-45-6789")).toBe(true);
    expect(looksSensitive("my password is hunter2")).toBe(true);
    expect(looksSensitive("Invoice 4471 for 2026")).toBe(false);
    expect(looksSensitive("Call 555-010-2200")).toBe(false);
    expect(buildDraft("contacts", { name: "Sam", phone: "4111111111111111" }).ok).toBe(false);
    expect(buildDraft("admin", { title: "Pay it", description: "card 4111-1111-1111-1111" }).ok).toBe(false);
  });

  it("refuses bad emails, dates, amounts, choices and over-long text", () => {
    expect(buildDraft("contacts", { email: "nope" }).ok).toBe(false);
    expect(buildDraft("invoices", { dueOn: "2026-02-30" }).ok).toBe(false);
    expect(buildDraft("invoices", { amount: "-5" }).ok).toBe(false);
    expect(buildDraft("invoices", { recurrence: "hourly" }).ok).toBe(false);
    expect(buildDraft("admin", { category: "Whatever" }).ok).toBe(false);
    expect(buildDraft("admin", { title: "x".repeat(200) }).ok).toBe(false);
    expect(buildDraft("nope", {}).ok).toBe(false);
  });

  it("checks a typed link again, so a hand-made address cannot slip bad values in", () => {
    const get = params("/app/invoices?new=1&client=Acme&clientEmail=bad&amount=4111111111111111&dueOn=2026-13-01&recurrence=monthly");
    expect(draftFromParams("invoices", get)).toEqual({ client: "Acme", recurrence: "monthly" });
  });

  it("limits drafts per turn and records the link for the owner", () => {
    const s = state();
    for (let i = 0; i < MAX_DRAFTS_PER_TURN; i++) expect(JSON.parse(runTool(s, "prepare_draft", { service: "contacts", fields: { name: `P${i}` } }))).toHaveProperty("prepared");
    expect(s.links).toHaveLength(MAX_DRAFTS_PER_TURN);
    expect(JSON.parse(runTool(s, "prepare_draft", { service: "contacts", fields: { name: "One more" } }))).toHaveProperty("error");
    expect(JSON.parse(runTool(state(), "prepare_draft", { service: "invoices", fields: { client: "4111111111111111" } }))).toHaveProperty("error");
  });

  it("gives the model no tool that saves, deletes, approves, pays or sends", () => {
    const names = TOOL_DEFS.map((t) => t.name);
    expect(names).toContain("prepare_draft");
    for (const n of names) expect(n).not.toMatch(/delete|approve|pay|send|sign|save_record|update_record/);
  });

  it("states every limit in the model's instructions", () => {
    const prompt = guardrailPrompt();
    for (const s of DRAFT_SERVICES) { expect(prompt).toContain(s.id); expect(s.refuses.length).toBeGreaterThan(0); }
    for (const n of NEVER) expect(prompt).toContain(n);
  });

  it("without the AI model, plain requests open the blank form and nothing else", () => {
    const r = respond(emptyConfig(), null, "create a new invoice", "2026-10-26");
    const turn = r.turns[r.turns.length - 1];
    expect(turn.links?.[0].href).toBe("/app/invoices?new=1");
    expect(turn.text).toContain("nothing is changed until you");
    expect(respond(emptyConfig(), null, "add a contact", "2026-10-26").turns.at(-1)?.links?.[0].href).toBe("/app/contacts?add=1");
    expect(respond(emptyConfig(), null, "delete all invoices", "2026-10-26").turns.at(-1)?.links).toBeUndefined();
  });
});
