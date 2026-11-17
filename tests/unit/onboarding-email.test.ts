import { describe, expect, it } from "vitest";
import { agreementEmail, ONBOARDING_FROM_DEFAULT } from "@/lib/mail/onboarding-email";
import { parseSendInput } from "@/lib/control/validation";
import { welcomeEmailSubject } from "@/lib/control/workspace";

const id = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";

describe("onboarding email", () => {
  it("sends from the onboarding alias by default", () => {
    expect(ONBOARDING_FROM_DEFAULT).toBe("AdFlo Onboarding <onboarding@adflo.pro>");
  });

  it("puts the link and the names in the message", () => {
    const m = agreementEmail({ clientName: "Acme Roofing", ownerName: "Pat", link: "https://adflo.pro/agreement/abc" });
    expect(m.subject).toBe("Your AdFlo agreement");
    expect(m.text).toContain("Hi Pat,");
    expect(m.text).toContain("Acme Roofing");
    expect(m.text).toContain("https://adflo.pro/agreement/abc");
  });

  it("flattens names to one line so they cannot add lines or headers", () => {
    const m = agreementEmail({ clientName: "Evil\r\nBcc: x@y.com", ownerName: "Pat\nSubject: hi", link: "https://adflo.pro/agreement/abc" });
    expect(m.text).not.toMatch(/Evil\r?\n/);
    expect(m.text.split("\n")[0]).toBe("Hi Pat Subject: hi,");
  });

  it("falls back to a plain greeting when there is no name", () => {
    expect(agreementEmail({ clientName: "", ownerName: "", link: "l" }).text.startsWith("Hi there,")).toBe(true);
  });
});

describe("parseSendInput email option", () => {
  it("is off unless it is exactly true", () => {
    expect(parseSendInput({ clientId: id, templateId: id })).toMatchObject({ ok: true, value: { email: false } });
    expect(parseSendInput({ clientId: id, templateId: id, email: "yes" })).toMatchObject({ ok: true, value: { email: false } });
    expect(parseSendInput({ clientId: id, templateId: id, email: true })).toMatchObject({ ok: true, value: { email: true } });
  });
});

describe("welcome email subject", () => {
  it("names the client", () => expect(welcomeEmailSubject("Acme Roofing")).toBe("Your AdFlo account for Acme Roofing is ready"));
  it("has no name gap when the name is blank", () => expect(welcomeEmailSubject("  ")).toBe("Your AdFlo account is ready"));
  it("cannot carry a line break", () => expect(welcomeEmailSubject("Acme\r\nBcc: x@y.com")).not.toMatch(/[\r\n]/));
});
