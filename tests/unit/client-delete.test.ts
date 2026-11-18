import { describe, expect, it } from "vitest";
import { clientDeleteError, deleteConfirmationMatches } from "@/lib/control/client-delete";

describe("deleteConfirmationMatches", () => {
  it("needs the client's name, ignoring case and extra spaces", () => {
    expect(deleteConfirmationMatches("Acme Roofing", "acme roofing")).toBe(true);
    expect(deleteConfirmationMatches("Acme Roofing", "  Acme   Roofing ")).toBe(true);
  });
  it("does not match a partial or different name, or an empty one", () => {
    expect(deleteConfirmationMatches("Acme Roofing", "Acme")).toBe(false);
    expect(deleteConfirmationMatches("Acme Roofing", "")).toBe(false);
    expect(deleteConfirmationMatches("", "")).toBe(false);
  });
});

describe("clientDeleteError", () => {
  it("shows the database's own messages for the cases written for people", () => {
    expect(clientDeleteError("22023", "Disconnect this client's workspace first.")).toEqual({ status: 409, message: "Disconnect this client's workspace first." });
    expect(clientDeleteError("P0002", undefined)).toEqual({ status: 404, message: "That client no longer exists." });
  });
  it("refuses non-owners and hides anything unexpected", () => {
    expect(clientDeleteError("42501", "row-level security").status).toBe(403);
    const other = clientDeleteError("XX000", "relation \"clients\" does not exist");
    expect(other.status).toBe(500);
    expect(other.message).not.toMatch(/relation/);
  });
});
