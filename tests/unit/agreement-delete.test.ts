import { describe, expect, it } from "vitest";
import { agreementDeleteError } from "@/lib/control/agreements";

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
