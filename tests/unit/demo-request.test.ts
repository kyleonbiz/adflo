import { describe, expect, it } from "vitest";
import { parseDemoRequest } from "@/lib/leads/validation";

const good = { name: " Ada Lovelace ", email: "Ada@Example.com ", company: "Analytical Co", size: "11-50", message: "Hello" };

describe("demo request", () => {
  it("trims and lowercases a good request", () => {
    expect(parseDemoRequest(good)).toEqual({ ok: true, value: { name: "Ada Lovelace", email: "ada@example.com", company: "Analytical Co", size: "11-50", message: "Hello" } });
  });
  it("allows an empty message", () => {
    expect(parseDemoRequest({ ...good, message: "" }).ok).toBe(true);
  });
  it("names each bad field", () => {
    const r = parseDemoRequest({ name: "A", email: "nope", company: "", size: "huge", message: "x".repeat(2001) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["company", "email", "message", "name", "size"]);
  });
  it("rejects non-objects", () => {
    expect(parseDemoRequest(null).ok).toBe(false);
  });
});
