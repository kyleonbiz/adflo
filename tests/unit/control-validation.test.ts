import { describe, expect, it } from "vitest";
import { describeAudit, parseClientInput } from "@/lib/control/validation";

describe("parseClientInput", () => {
  it("accepts a minimal client and fills defaults", () => {
    const r = parseClientInput({ name: "  Acme Roofing " });
    expect(r).toEqual({ ok: true, value: { name: "Acme Roofing", status: "trial", plan: "standard", seatsLimit: 3, ownerName: "", ownerEmail: "", notes: "" } });
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
