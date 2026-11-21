import { describe, expect, it } from "vitest";
import { actorLabel, isQuiet, agreementState } from "@/lib/control/types";
import { isUuid } from "@/lib/control/patterns";
import { parseAcceptInput, parseAgreementEdit, parseAgreementInput, parseSendInput, isAgreementToken, describeAudit, parseNote, parseResetEmail, parseTicketInput, parseTicketPatch, parseChecklistInput, parseClientInput, parseDollars, parsePlanInput, parseStaffInput } from "@/lib/control/validation";
import { effectivePriceCents, formatMoney } from "@/lib/control/types";

const OWNER = { ownerName: "Pat Lee", ownerEmail: "pat@acme.com" };

describe("parseClientInput", () => {
  it("accepts a minimal client and fills defaults", () => {
    const r = parseClientInput({ name: "  Acme Roofing ", ...OWNER });
    expect(r).toEqual({ ok: true, value: { name: "Acme Roofing", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "Pat Lee", ownerEmail: "pat@acme.com", notes: "", priceOverrideCents: null, priceNote: "" } });
  });
  it("requires the name, the owner's name and the owner's email on a new client", () => {
    const r = parseClientInput({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["name", "ownerEmail", "ownerName"]);
    expect(parseClientInput({ name: "Ok Co", ownerName: "Pat Lee", ownerEmail: "  " }).ok).toBe(false);
    expect(parseClientInput({ name: "Ok Co", ownerName: " ", ownerEmail: "pat@acme.com" }).ok).toBe(false);
  });
  it("rejects short names, bad status, negative or fractional seats and bad email", () => {
    const r = parseClientInput({ name: "A", status: "gone", seatsLimit: -1, ownerEmail: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["name", "ownerEmail", "ownerName", "seatsLimit", "status"]);
    expect(parseClientInput({ name: "Ok Co", ...OWNER, seatsLimit: 2.5 }).ok).toBe(false);
  });
  it("takes seats typed into a form field", () => {
    const r = parseClientInput({ name: "Ok Co", ...OWNER, seatsLimit: "12" });
    expect(r.ok && r.value.seatsLimit).toBe(12);
  });
  it("lower-cases the owner's email and strips control characters", () => {
    const r = parseClientInput({ name: "Ok\u0000 Co", ownerName: "Pat", ownerEmail: "Pat@Example.COM" });
    expect(r.ok && r.value.name).toBe("Ok Co");
    expect(r.ok && r.value.ownerEmail).toBe("pat@example.com");
  });
  it("lets an edit leave the owner fields alone", () => {
    expect(parseClientInput({ ownerEmail: "bad" }, true).ok).toBe(false);
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
    const r = parseClientInput({ name: "Ok Co", ...OWNER, priceOverrideCents: "79.50" });
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
    expect(parseNote({ body: "  hi " })).toEqual({ ok: true, value: { body: "hi", toClient: false } });
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
  it("checks an edit to a published version: text and effective date only", () => {
    expect(parseAgreementEdit({ body: "New text", effectiveDate: "2026-12-01" })).toEqual({ ok: true, value: { body: "New text", effectiveDate: "2026-12-01" } });
    expect(parseAgreementEdit({ body: "", effectiveDate: "2026-12-01" }).ok).toBe(false);
    expect(parseAgreementEdit({ body: "Text", effectiveDate: "nope" }).ok).toBe(false);
  });
  it("checks a published agreement and a send request", () => {
    expect(parseAgreementInput({ title: " Terms ", body: "Text", effectiveDate: "2026-12-01" })).toEqual({ ok: true, value: { title: "Terms", body: "Text", effectiveDate: "2026-12-01" } });
    expect(parseAgreementInput({ title: "Terms", body: "Text" }).ok).toBe(false);
    expect(parseAgreementInput({ title: "Terms", body: "Text", effectiveDate: "2026-02-31" }).ok).toBe(false);
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

describe("quiet clients", () => {
  const now = Date.parse("2026-11-04T00:00:00Z");
  it("flags active clients with no recent sign-in", () => {
    expect(isQuiet({ status: "active", workspaceId: "w", lastActive: "2026-09-01T00:00:00Z" }, now)).toBe(true);
    expect(isQuiet({ status: "active", workspaceId: "w", lastActive: null }, now)).toBe(true);
    expect(isQuiet({ status: "active", workspaceId: "w", lastActive: "2026-10-30T00:00:00Z" }, now)).toBe(false);
  });
  it("leaves out trials, suspended clients and clients without a workspace yet", () => {
    expect(isQuiet({ status: "trial", workspaceId: "w", lastActive: null }, now)).toBe(false);
    expect(isQuiet({ status: "suspended", workspaceId: "w", lastActive: null }, now)).toBe(false);
    expect(isQuiet({ status: "active", workspaceId: null, lastActive: null }, now)).toBe(false);
  });
  it("reads the workspace steps", () => {
    expect(describeAudit("client.workspace_linked", { client_id: "x", workspace: "Acme" })).toBe("Connected workspace Acme");
    expect(describeAudit("client.workspace_unlinked", { client_id: "x" })).toBe("Disconnected the workspace");
    expect(describeAudit("client.owner_invited", { client_id: "x", email: "pat@acme.test" })).toBe("Invited pat@acme.test as workspace owner");
  });
});

describe("workspace deletion in the audit log", () => {
  it("reads in plain words", () => {
    expect(describeAudit("workspace.delete_requested", { name: "Lingering Co" })).toBe("Deleted the workspace Lingering Co and its data");
  });
});

describe("client deletion in the audit log", () => {
  it("says whether the workspace goes too", () => {
    expect(describeAudit("client.delete_requested", { name: "Acme", workspace_id: "w1" })).toBe("Deleting Acme and its workspace");
    expect(describeAudit("client.delete_requested", { name: "Acme", workspace_id: null })).toBe("Deleting Acme");
  });
});

describe("account removal in the audit log", () => {
  it("lists who was removed", () => {
    expect(describeAudit("client.accounts_removed", { emails: ["a@x.test", "b@x.test"] })).toBe("Removed 2 sign-in accounts: a@x.test, b@x.test");
    expect(describeAudit("client.accounts_removed", { emails: ["a@x.test"] })).toBe("Removed 1 sign-in account: a@x.test");
  });
});

describe("actorLabel", () => {
  it("shows the staff member's name, then their email, then System", () => {
    expect(actorLabel({ staffName: "Kyle Fulwood Jr", staffEmail: "kyleonbiz@gmail.com" })).toBe("Kyle Fulwood Jr");
    expect(actorLabel({ staffName: "  ", staffEmail: "kyleonbiz@gmail.com" })).toBe("kyleonbiz@gmail.com");
    expect(actorLabel({ staffName: "", staffEmail: "" })).toBe("System");
  });
});
