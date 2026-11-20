import { describe, expect, it } from "vitest";
import { agreementDeleteError, agreementEditError } from "@/lib/control/agreements";

describe("agreementDeleteError", () => {
  it("shows the database's own messages for the two cases written for people", () => {
    expect(agreementDeleteError("22023", "A client has accepted this agreement, so it is kept.")).toEqual({ status: 409, message: "A client has accepted this agreement, so it is kept." });
    expect(agreementDeleteError("P0002", "That agreement no longer exists.")).toEqual({ status: 404, message: "That agreement no longer exists." });
  });
  it("refuses non-owners and hides anything unexpected", () => {
    expect(agreementDeleteError("42501", "row-level security").status).toBe(403);
    const other = agreementDeleteError("XX000", "relation \"agreements_sent\" does not exist");
    expect(other.status).toBe(500);
    expect(other.message).not.toMatch(/relation/);
  });
});

import { sentAgreementDeleteError } from "@/lib/control/agreements";

describe("sentAgreementDeleteError", () => {
  it("shows the messages written for staff and hides anything unexpected", () => {
    expect(sentAgreementDeleteError("22023", "The client has accepted this agreement.").status).toBe(409);
    expect(sentAgreementDeleteError("P0002", undefined)).toEqual({ status: 404, message: "That agreement is no longer on this client." });
    expect(sentAgreementDeleteError("42501", "x").status).toBe(403);
    expect(sentAgreementDeleteError("XX000", "secret detail").message).not.toMatch(/secret/);
  });
});

describe("agreementEditError", () => {
  it("shows the messages written for the Owner and hides anything unexpected", () => {
    expect(agreementEditError("22023", "A client has accepted this version, so it is locked.")).toEqual({ status: 409, message: "A client has accepted this version, so it is locked." });
    expect(agreementEditError("P0002", undefined).status).toBe(404);
    expect(agreementEditError("42501", "x").status).toBe(403);
    expect(agreementEditError("XX000", "secret detail").message).not.toMatch(/secret/);
  });
});
