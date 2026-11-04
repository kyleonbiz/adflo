import { describe, expect, it } from "vitest";
import { agreementState } from "@/lib/control/types";
import { parseAcceptInput, parseAgreementInput, parseSendInput, isAgreementToken, describeAudit, isUuid, parseNote, parseResetEmail, parseTicketInput, parseTicketPatch, parseChecklistInput, parseClientInput, parseDollars, parsePlanInput, parseStaffInput } from "@/lib/control/validation";
import { effectivePriceCents, formatMoney } from "@/lib/control/types";

describe("parseClientInput", () => {
  it("accepts a minimal client and fills defaults", () => {
    const r = parseClientInput({ name: "  Acme Roofing " });
    expect(r).toEqual({ ok: true, value: { name: "Acme Roofing", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "", ownerEmail: "", notes: "", priceOverrideCents: null, priceNote: "" } });
  });
  it("rejects short names, bad status, negative or fractional seats and bad email", () => {
    const r = parseClientInput({ name: "A", status: "gone", seatsLimit: -1, ownerEmail: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["name", "ownerEmail", "seatsLimit", "status"]);
    expect(parseClientInput({ name: "Ok Co", seatsLimit: 2.5 }).ok).toBe(false);
  });
  it("takes seats typed into a form field", () => {
    const r = parseClientInput({ name: "Ok Co", seatsLimit: "12" });
    expect(r.ok && r.value.seatsLimit).toBe(12);
  });
  it("lower-cases the owner's email and strips control characters", () => {
    const r = parseClientInput({ name: "Ok\u0000 Co", ownerEmail: "Pat@Example.COM" });
    expect(r.ok && r.value.name).toBe("Ok Co");
    expect(r.ok && r.value.ownerEmail).toBe("pat@example.com");
  });
  it("only checks fields that were sent when partial", () => {
    expect(parseClientInput({ status: "suspended" }, true)).toEqual({ ok: true, value: { status: "suspended" } });
    expect(parseClientInput({ status: "x" }, true).ok).toBe(false);
  });
});

describe("describeAudit", () => {
  it("reads a status change", () => {
    expect(describeAudit("client.status_changed", { status: ["trial", "active"] })).toBe("Status: trial → active");
  });
});

describe("money", () => {
  it("parses dollars into cents and refuses everything else", () => {
    expect(parseDollars("79")).toBe(7900);
    expect(parseDollars("79.5")).toBe(7950);
    expect(parseDollars("$1,200.05")).toBe(120005);
    for (const bad of ["-5", "1.234", "abc", "", "1e3"]) expect(parseDollars(bad)).toBeNull();
  });
  it("formats cents", () => {
    expect(formatMoney(4900)).toBe("$49");
    expect(formatMoney(4950)).toBe("$49.50");
  });
  it("uses the client's own price before the plan's", () => {
    const plans = [{ id: "1", name: "Standard", priceCents: 9900, seatsIncluded: 3, active: true }];
    expect(effectivePriceCents({ plan: "standard", priceOverrideCents: null }, plans)).toBe(9900);
    expect(effectivePriceCents({ plan: "standard", priceOverrideCents: 0 }, plans)).toBe(0);
    expect(effectivePriceCents({ plan: "gone", priceOverrideCents: null }, plans)).toBeNull();
  });
  it("reads a client price from the form", () => {
    const r = parseClientInput({ name: "Ok Co", priceOverrideCents: "79.50" });
    expect(r.ok && r.value.priceOverrideCents).toBe(7950);
    expect(parseClientInput({ name: "Ok Co", priceOverrideCents: "free" }).ok).toBe(false);
  });
});

describe("plans, staff and checklist input", () => {
  it("checks a plan", () => {
    expect(parsePlanInput({ name: "Pro", price: "99", seatsIncluded: "10" })).toEqual({ ok: true, value: { name: "Pro", priceCents: 9900, seatsIncluded: 10 } });
    expect(parsePlanInput({ name: "", price: "x" }).ok).toBe(false);
    expect(parsePlanInput({ active: false }, true)).toEqual({ ok: true, value: { active: false } });
  });
  it("checks a teammate", () => {
    expect(parseStaffInput({ email: "A@B.co", role: "support", name: "Al" })).toEqual({ ok: true, value: { email: "a@b.co", role: "support", name: "Al" } });
    expect(parseStaffInput({ email: "nope", role: "admin" }).ok).toBe(false);
  });
  it("checks a checklist step", () => {
    expect(parseChecklistInput({ step: "workspace", done: true }).ok).toBe(true);
    expect(parseChecklistInput({ step: "bogus", done: true }).ok).toBe(false);
    expect(parseChecklistInput({ step: "workspace", done: "yes" }).ok).toBe(false);
  });
  it("describes a plan or team change in words", () => {
    expect(describeAudit("staff.insert", { email: "a@b.co", role: "support", active: true })).toContain("Staff added");
  });
});

describe("support input", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("checks a new ticket", () => {
    expect(parseTicketInput({ subject: " Upload fails ", clientId: id })).toEqual({ ok: true, value: { subject: "Upload fails", body: "", clientId: id, priority: "normal" } });
    expect(parseTicketInput({ subject: "", clientId: "nope", priority: "urgent" }).ok).toBe(false);
    expect(parseTicketInput({ subject: "No client" })).toMatchObject({ ok: true, value: { clientId: null } });
  });
  it("checks a ticket change", () => {
    expect(parseTicketPatch({ status: "closed" })).toEqual({ ok: true, value: { status: "closed" } });
    expect(parseTicketPatch({ assignee: "" })).toEqual({ ok: true, value: { assignee: null } });
    expect(parseTicketPatch({ assignee: "bob" }).ok).toBe(false);
    expect(parseTicketPatch({}).ok).toBe(false);
  });
  it("checks notes and reset emails", () => {
    expect(parseNote({ body: "  hi " })).toEqual({ ok: true, value: { body: "hi" } });
    expect(parseNote({ body: "   " }).ok).toBe(false);
    expect(parseResetEmail({ email: "Pat@X.com" })).toEqual({ ok: true, value: { email: "pat@x.com" } });
    expect(parseResetEmail({ email: "x" }).ok).toBe(false);
    expect(isUuid(id)).toBe(true);
    expect(isUuid("1; drop table")).toBe(false);
  });
});

describe("agreements", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const token = "A".repeat(43);
  it("checks a published agreement and a send request", () => {
    expect(parseAgreementInput({ title: " Terms ", body: "Text" })).toEqual({ ok: true, value: { title: "Terms", body: "Text" } });
    expect(parseAgreementInput({ title: "", body: "" }).ok).toBe(false);
    expect(parseSendInput({ clientId: id, templateId: id }).ok).toBe(true);
    expect(parseSendInput({ clientId: id }).ok).toBe(false);
  });
  it("accepts only a well-formed link secret", () => {
    expect(isAgreementToken(token)).toBe(true);
    expect(isAgreementToken("short")).toBe(false);
    expect(isAgreementToken(`${token}/..`)).toBe(false);
  });
  it("requires a name, an email and the tick box to accept", () => {
    expect(parseAcceptInput({ token, name: "Pat Lee", email: "PAT@e.co", agree: true })).toEqual({ ok: true, value: { token, name: "Pat Lee", email: "pat@e.co" } });
    const bad = parseAcceptInput({ token: "x", name: "P", email: "no", agree: false });
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(["agree", "email", "name", "token"]);
  });
  it("reports where a sent agreement stands", () => {
    const now = Date.parse("2026-11-04T00:00:00Z");
    expect(agreementState({ acceptedAt: "2026-11-01T00:00:00Z", expiresAt: "2026-10-01T00:00:00Z" }, now)).toBe("accepted");
    expect(agreementState({ acceptedAt: null, expiresAt: "2026-10-01T00:00:00Z" }, now)).toBe("expired");
    expect(agreementState({ acceptedAt: null, expiresAt: "2026-12-01T00:00:00Z" }, now)).toBe("waiting");
  });
});
