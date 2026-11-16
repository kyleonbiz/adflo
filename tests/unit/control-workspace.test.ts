import { describe, expect, it } from "vitest";
import { isUuid, parseWorkspaceRequest, welcomeMessage, workspaceErrorMessage } from "@/lib/control/workspace";

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

describe("welcomeMessage", () => {
  const base = { clientName: "Acme Roofing", ownerName: "Pat Example", ownerEmail: "pat@acme.test", signupUrl: "https://app.test/signup" };
  it("names the exact email to sign up with and the link", () => {
    const m = welcomeMessage({ ...base, expiresOn: "Dec 1, 2026" });
    expect(m).toContain("Hi Pat,");
    expect(m).toContain("https://app.test/signup");
    expect(m).toContain("pat@acme.test");
    expect(m).toContain("open until Dec 1, 2026");
  });
  it("copes with no owner name or expiry", () => {
    const m = welcomeMessage({ ...base, ownerName: "  " });
    expect(m.startsWith("Hi,")).toBe(true);
    expect(m).not.toContain("open until");
  });
});

describe("workspaceErrorMessage", () => {
  it("shows our own database messages but hides anything unexpected", () => {
    expect(workspaceErrorMessage("23505", "That workspace belongs to another client.")).toEqual({ status: 409, message: "That workspace belongs to another client." });
    expect(workspaceErrorMessage("42501", "forbidden").status).toBe(403);
    expect(workspaceErrorMessage("XX000", "relation \"secret\" does not exist")).toEqual({ status: 500, message: "Something went wrong. Try again." });
  });
});
