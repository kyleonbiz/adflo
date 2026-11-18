import { describe, expect, it } from "vitest";
import { safeSenderName, shareEmail, shareFromHeader } from "@/lib/mail/share-email";
import { shareLinkSchema } from "@/lib/dms/validation";

describe("shareEmail", () => {
  const d = { senderName: "Pat Lee", fileName: "W-9 2026.pdf", url: "https://www.adflo.pro/share/abc", expiresAtLabel: "Nov 25, 2026, 3:00 PM UTC" };
  it("names the sender and file, carries the link and the expiry", () => {
    const m = shareEmail({ ...d, message: "Here is the form you asked for." });
    expect(m.subject).toBe('Pat Lee shared "W-9 2026.pdf" with you');
    expect(m.text).toContain("https://www.adflo.pro/share/abc");
    expect(m.text).toContain("Here is the form you asked for.");
    expect(m.text).toContain("Nov 25, 2026, 3:00 PM UTC");
  });
  it("leaves the note out when there is none", () => {
    expect(shareEmail(d).text).not.toContain("\n\n\n");
  });
  it("cannot add headers or lines through the file name or sender name", () => {
    const m = shareEmail({ ...d, senderName: "Pat\r\nBcc: x@y.z", fileName: "a\r\nBcc: x@y.z.pdf" });
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
});

describe("shareFromHeader", () => {
  it("sends as the person 'via AdFlo' from the documents alias", () => {
    expect(shareFromHeader("Pat Lee", {})).toBe('"Pat Lee via AdFlo" <documents@adflo.pro>');
    expect(shareFromHeader("Pat", { SHARE_FROM: "AdFlo <docs@adflo.pro>" })).toBe('"Pat via AdFlo" <docs@adflo.pro>');
    expect(shareFromHeader("Pat", { ONBOARDING_FROM: "x <hello@adflo.pro>" })).toBe('"Pat via AdFlo" <documents@adflo.pro>'); // onboarding mail has its own address
  });
  it("strips anything that could break the header", () => {
    expect(safeSenderName('Pat "<evil>"\r\nLee')).toBe("Pat evil Lee");
    expect(shareFromHeader("", {})).toBe("AdFlo <documents@adflo.pro>");
  });
});

describe("shareLinkSchema email option", () => {
  it("accepts one address and a short note, and rejects bad ones", () => {
    expect(shareLinkSchema.safeParse({ ttlMinutes: 60, emailTo: "pat@acme.com", message: "Hi" }).success).toBe(true);
    expect(shareLinkSchema.safeParse({ ttlMinutes: 60 }).success).toBe(true);
    expect(shareLinkSchema.safeParse({ ttlMinutes: 60, emailTo: "not-an-email" }).success).toBe(false);
    expect(shareLinkSchema.safeParse({ ttlMinutes: 60, emailTo: "a@b.co", message: "x".repeat(1001) }).success).toBe(false);
  });
});
