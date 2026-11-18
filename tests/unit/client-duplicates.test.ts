import { describe, expect, it } from "vitest";
import { findDuplicateClient, normalizeClientName } from "@/lib/control/duplicates";

const existing = [
  { id: "1", name: "Acme Roofing, LLC", owner_email: "pat@acme.com" },
  { id: "2", name: "Birch & Co", owner_email: null },
];

describe("normalizeClientName", () => {
  it("ignores case, punctuation, spacing and company suffixes", () => {
    expect(normalizeClientName("  ACME   roofing, Inc. ")).toBe("acme roofing");
    expect(normalizeClientName("Birch and Co.")).toBe(normalizeClientName("Birch & Company"));
    expect(normalizeClientName("Café Béni")).toBe("cafe beni");
  });
});

describe("findDuplicateClient", () => {
  it("finds the same name written differently", () => {
    expect(findDuplicateClient(existing, { name: "acme roofing inc" })).toMatchObject({ field: "name", clientName: "Acme Roofing, LLC" });
  });
  it("finds the same owner email in any case", () => {
    expect(findDuplicateClient(existing, { name: "Other", ownerEmail: "PAT@acme.com " })).toMatchObject({ field: "ownerEmail" });
  });
  it("does not match a different client, or the client being edited", () => {
    expect(findDuplicateClient(existing, { name: "Acme Plumbing", ownerEmail: "new@acme.com" })).toBeNull();
    expect(findDuplicateClient(existing, { name: "Acme Roofing", ownerEmail: "pat@acme.com" }, "1")).toBeNull();
  });
  it("ignores fields that were not sent", () => {
    expect(findDuplicateClient(existing, {})).toBeNull();
  });
});
