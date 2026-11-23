import { describe, expect, it } from "vitest";
import { applyProposal, buildProposal, PROPOSAL_TTL_MS, type ApplyContext, type Proposal } from "@/lib/assistant/proposal";
import { runTool, TOOL_DEFS, type ToolState } from "@/lib/assistant/tools";
import { emptyConfig } from "@/lib/setup/types";
import type { Invoice } from "@/lib/invoices/types";

const NOW = Date.UTC(2026, 10, 23, 12);
let n = 0;
const ctx = (over: Partial<ApplyContext> = {}): ApplyContext => ({ today: "2026-11-23", now: NOW, contacts: [], vendors: [], invoices: [], newId: (p) => `${p}-${++n}`, ...over });
const propose = (service: string, fields: Record<string, string>): Proposal => {
  const r = buildProposal(service, fields, NOW, "p-1");
  if (!r.ok) throw new Error(r.error);
  return r.proposal;
};
const prior: Invoice = {
  id: "i0", number: "INV-1", client: "Old Co", clientEmail: "", description: "x", items: [{ description: "x", qty: 1, rateCents: 100 }], taxRate: 0,
  sender: { name: "Blue Roofing", address: "1 Main St", phone: "", email: "bill@blue.test" }, paymentMethods: ["Check"], amountCents: 100,
  issuedOn: "2026-10-01", dueOn: "2026-10-31", status: "sent", paidOn: null, recurrence: "none", reminderDays: [], notes: "",
};

describe("buildProposal", () => {
  it("builds a card in plain words and expires it after 24 hours", () => {
    const p = propose("invoices", { client: "Acme Co", amount: "1200", description: "Roof repair", dueOn: "2026-12-15", sneaky: "x" });
    expect(p.title).toBe("Create a draft invoice for Acme Co");
    expect(p.lines).toContainEqual({ label: "Amount", value: "$1,200.00" });
    expect(p.fields).not.toHaveProperty("sneaky");
    expect(p.expiresAt - NOW).toBe(PROPOSAL_TTL_MS);
    expect(p.href).toContain("/app/invoices?new=1");
  });
  it("asks for what is required instead of guessing", () => {
    expect(buildProposal("contacts", {}, NOW, "p").ok).toBe(false);
    const v = buildProposal("vendors", { name: "Blue Ridge" }, NOW, "p");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/Email/);
    expect(buildProposal("invoices", { client: "Acme" }, NOW, "p").ok).toBe(false);
  });
  it("refuses services that cannot be proposed and values that look sensitive", () => {
    expect(buildProposal("projects", { name: "X" }, NOW, "p").ok).toBe(false);
    expect(buildProposal("invoices", { client: "4111111111111111", amount: "5" }, NOW, "p").ok).toBe(false);
  });
});

describe("applyProposal", () => {
  it("saves a contact through the form's own validation", () => {
    const r = applyProposal(propose("contacts", { name: "jane roe", email: "Jane@Roe.test", phone: "5551234567", category: "Lead" }), ctx());
    expect(r.ok).toBe(true);
    if (r.ok && r.kind === "contacts") {
      expect(r.record).toMatchObject({ name: "Jane Roe", email: "jane@roe.test", phone: "(555) 123-4567", category: "Lead", createdOn: "2026-11-23" });
      expect(r.audit.area).toBe("Contacts");
    }
  });
  it("will not add a duplicate contact", () => {
    const first = applyProposal(propose("contacts", { name: "Jane Roe", email: "jane@roe.test" }), ctx());
    if (!first.ok || first.kind !== "contacts") throw new Error("setup");
    const again = applyProposal(propose("contacts", { name: "Jane R", email: "jane@roe.test" }), ctx({ contacts: [first.record] }));
    expect(again.ok).toBe(false);
  });
  it("adds a vendor in onboarding with its required documents", () => {
    const r = applyProposal(propose("vendors", { name: "Blue Ridge Supply", email: "orders@blueridge.test", category: "Supplies" }), ctx());
    expect(r.ok).toBe(true);
    if (r.ok && r.kind === "vendors") { expect(r.record.status).toBe("onboarding"); expect(r.record.taxId).toBe(""); expect(r.record.documents.length).toBeGreaterThan(0); }
  });
  it("creates an invoice as a draft from the last invoice's business details, never sent", () => {
    const r = applyProposal(propose("invoices", { client: "Acme Co", amount: "1200", description: "Roof repair" }), ctx({ invoices: [prior] }));
    expect(r.ok).toBe(true);
    if (r.ok && r.kind === "invoices") {
      expect(r.record).toMatchObject({ client: "Acme Co", amountCents: 120000, status: "draft", paidOn: null, issuedOn: "2026-11-23", dueOn: "2026-12-23", sender: { name: "Blue Roofing" } });
      expect(r.record.number).toMatch(/^INV-261123-\d{4}$/);
    }
  });
  it("sends the owner to the form when there is no earlier invoice to copy the sender from", () => {
    const r = applyProposal(propose("invoices", { client: "Acme Co", amount: "50" }), ctx());
    expect(r.ok).toBe(false);
  });
  it("refuses an expired proposal and a due date before today", () => {
    const p = propose("contacts", { name: "Jane Roe" });
    const late = applyProposal(p, ctx({ now: p.expiresAt + 1 }));
    expect(late).toEqual({ ok: false, error: expect.stringMatching(/expired/i) });
    expect(applyProposal(propose("invoices", { client: "Acme", amount: "9", dueOn: "2026-01-01" }), ctx({ invoices: [prior] })).ok).toBe(false);
  });
});

describe("propose_action tool", () => {
  const state = (): ToolState => ({ config: emptyConfig(), today: "2026-11-23", links: [], drafts: 0, proposals: [], now: NOW });
  it("is offered next to prepare_draft, and nothing in it saves", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toEqual(["propose_action", "prepare_draft"]);
  });
  it("records a proposal without saving, and stops at three a turn", () => {
    const s = state();
    for (let i = 0; i < 3; i++) expect(JSON.parse(runTool(s, "propose_action", { service: "contacts", fields: { name: `P${i}` } }))).toHaveProperty("proposed");
    expect(s.proposals).toHaveLength(3);
    expect(JSON.parse(runTool(s, "propose_action", { service: "contacts", fields: { name: "Four" } }))).toHaveProperty("error");
    expect(JSON.parse(runTool(state(), "propose_action", { service: "licenses", fields: { name: "x" } }))).toHaveProperty("error");
  });
});
