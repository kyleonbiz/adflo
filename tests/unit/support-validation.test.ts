import { describe, expect, it } from "vitest";
import { parseClosed, parseReply, parseSupportRequest } from "@/lib/support/validation";
import { ticketKey } from "@/lib/control/types";

describe("support request", () => {
  it("accepts a normal request and tidies the subject", () => {
    expect(parseSupportRequest({ subject: "  Cannot   upload ", body: "The PDF fails", category: "problem" })).toEqual({ ok: true, value: { subject: "Cannot upload", body: "The PDF fails", category: "problem" } });
  });
  it("defaults the category to a question", () => {
    const r = parseSupportRequest({ subject: "Hi", body: "How do I add a seat?" });
    expect(r.ok && r.value.category).toBe("question");
  });
  it("needs a subject, details and a known category", () => {
    const r = parseSupportRequest({ subject: " ", body: "", category: "bug" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["body", "category", "subject"]);
  });
  it("caps lengths and strips control characters", () => {
    expect(parseSupportRequest({ subject: "x".repeat(201), body: "y" }).ok).toBe(false);
    expect(parseSupportRequest({ subject: "x", body: "y".repeat(5001) }).ok).toBe(false);
    const r = parseSupportRequest({ subject: "a\u0000b", body: "c\u0007d" });
    expect(r.ok && [r.value.subject, r.value.body]).toEqual(["ab", "cd"]);
  });
  it("copes with junk input", () => {
    expect(parseSupportRequest(null).ok).toBe(false);
    expect(parseSupportRequest("nope").ok).toBe(false);
  });
});

describe("support reply and close", () => {
  it("needs some text and keeps it short enough", () => {
    expect(parseReply({ body: "  ok  " })).toEqual({ ok: true, value: { body: "ok" } });
    expect(parseReply({ body: "  " }).ok).toBe(false);
    expect(parseReply(undefined).ok).toBe(false);
    expect(parseReply({ body: "z".repeat(5001) }).ok).toBe(false);
  });
  it("close takes a real boolean", () => {
    expect(parseClosed({ closed: true })).toEqual({ ok: true, value: { closed: true } });
    expect(parseClosed({ closed: "true" }).ok).toBe(false);
    expect(parseClosed(null).ok).toBe(false);
  });
  it("ticket keys read AF-n", () => expect(ticketKey(12)).toBe("AF-12"));
});
