import { describe, expect, it } from "vitest";
import { demoRequestText, parseDemoRequest } from "@/lib/marketing/demo-request";

const good = { name: "Pat Lee", email: "pat@example.com", company: "Lee Co", size: "1–10", message: "Hello" };

describe("parseDemoRequest", () => {
  it("accepts a complete request", () => {
    const r = parseDemoRequest(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(demoRequestText(r.value)).toContain("Company: Lee Co");
  });
  it("needs a name, a real email, a company and a listed size", () => {
    const r = parseDemoRequest({ name: " ", email: "nope", company: "", size: "9" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["company", "email", "name", "size"]);
  });
  it("keeps line breaks out of single-line fields", () => {
    const r = parseDemoRequest({ ...good, name: "Pat\nBcc: x@y.com" });
    expect(r.ok && r.value.name).toBe("Pat Bcc: x@y.com");
  });
  it("allows an empty message and trims a long one", () => {
    expect(parseDemoRequest({ ...good, message: "" }).ok).toBe(true);
    const r = parseDemoRequest({ ...good, message: "x".repeat(5000) });
    expect(r.ok && r.value.message.length).toBe(2000);
  });
  it("rejects non-objects", () => {
    expect(parseDemoRequest(null).ok).toBe(false);
  });
});
