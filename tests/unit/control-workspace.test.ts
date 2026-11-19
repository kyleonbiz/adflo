import { describe, expect, it } from "vitest";
import { invitationMessage, isUuid, parseWorkspaceRequest, welcomeMessage, workspaceErrorMessage } from "@/lib/control/workspace";

const ID = "7a000000-0000-4000-8000-0000000000c1";

describe("parseWorkspaceRequest", () => {
  it("accepts the four actions", () => {
    expect(parseWorkspaceRequest({ action: "link", workspaceId: ID })).toEqual({ ok: true, action: "link", workspaceId: ID });
    for (const a of ["unlink", "provision", "invite"]) expect(parseWorkspaceRequest({ action: a })).toEqual({ ok: true, action: a });
  });
  it("refuses an unknown action, a missing or malformed workspace, and junk bodies", () => {
    expect(parseWorkspaceRequest({ action: "delete" }).ok).toBe(false);
    expect(parseWorkspaceRequest({ action: "link" }).ok).toBe(false);
    expect(parseWorkspaceRequest({ action: "link", workspaceId: "1; drop table" }).ok).toBe(false);
    for (const junk of [null, undefined, "link", 5, []]) expect(parseWorkspaceRequest(junk).ok).toBe(false);
  });
  it("checks ids strictly", () => { expect(isUuid(ID)).toBe(true); expect(isUuid(`${ID} `)).toBe(false); expect(isUuid(7)).toBe(false); });
});

describe("invitationMessage", () => {
  const base = { clientName: "Acme Roofing", ownerName: "Pat Example", ownerEmail: "pat@acme.test", inviteUrl: "https://app.test/invite/abc" };
  it("names the exact email to sign up with and the confirm link", () => {
    const m = invitationMessage({ ...base, expiresOn: "Dec 1, 2026" });
    expect(m).toContain("Hi Pat,");
    expect(m).toContain("You are invited to AdFlo for Acme Roofing");
    expect(m).toContain("https://app.test/invite/abc");
    expect(m).toContain("confirm your invitation");
    expect(m).toContain("pat@acme.test");
    expect(m).toContain("open until Dec 1, 2026");
  });
  it("copes with no owner name or expiry", () => {
    const m = invitationMessage({ ...base, ownerName: "  " });
    expect(m.startsWith("Hi,")).toBe(true);
    expect(m).not.toContain("open until");
  });
});

describe("welcomeMessage", () => {
  const base = { clientName: "Acme Roofing", ownerName: "Pat Example", loginUrl: "https://app.test/login" };
  it("is a welcome with first steps, not an invitation", () => {
    const m = welcomeMessage(base);
    expect(m).toContain("Hi Pat,");
    expect(m).toContain("Welcome to AdFlo");
    expect(m).toContain("https://app.test/login");
    expect(m).toContain("Guided setup");
    expect(m).toContain("administrative management platform");
    expect(m).not.toMatch(/confirm your invitation|\/invite\/|create your account/i);
  });
  it("copes with no owner name", () => expect(welcomeMessage({ ...base, ownerName: "" }).startsWith("Hi,")).toBe(true));
});

describe("workspaceErrorMessage", () => {
  it("shows our own database messages but hides anything unexpected", () => {
    expect(workspaceErrorMessage("23505", "That workspace belongs to another client.")).toEqual({ status: 409, message: "That workspace belongs to another client." });
    expect(workspaceErrorMessage("42501", "forbidden").status).toBe(403);
    expect(workspaceErrorMessage("XX000", "relation \"secret\" does not exist")).toEqual({ status: 500, message: "Something went wrong. Try again." });
  });
});
