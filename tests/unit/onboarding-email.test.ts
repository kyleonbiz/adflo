import { describe, expect, it } from "vitest";
import { agreementEmail, agreementsEmail, ONBOARDING_FROM_DEFAULT } from "@/lib/mail/onboarding-email";
import { parseSendAllInput, parseSendInput } from "@/lib/control/validation";
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

describe("several agreements in one email", () => {
  const items = [{ title: "Terms and Conditions", link: "https://adflo.pro/agreement/aaa" }, { title: "Privacy Policy", link: "https://adflo.pro/agreement/bbb" }];
  it("lists every title and link in one message", () => {
    const m = agreementsEmail({ clientName: "Acme Roofing", ownerName: "Pat", items });
    expect(m.subject).toBe("Your AdFlo agreements");
    for (const i of items) { expect(m.text).toContain(i.title); expect(m.text).toContain(i.link); }
  });
  it("uses the single-agreement email for one link", () => {
    expect(agreementsEmail({ clientName: "A", ownerName: "P", items: [items[0]] }).subject).toBe("Your AdFlo agreement");
  });
  it("flattens a title so it cannot add lines", () => {
    const m = agreementsEmail({ clientName: "A", ownerName: "P", items: [{ title: "X\r\nBcc: a@b.c", link: "l1" }, items[1]] });
    expect(m.text).not.toMatch(/X\r?\nBcc/);
  });
});

describe("parseSendAllInput", () => {
  const other = "4a3b9d2f-6b5e-4f70-8c8b-2d3e4f5a6b7c";
  it("accepts a client and several different agreements", () => {
    expect(parseSendAllInput({ clientId: id, templateIds: [id, other], email: true })).toMatchObject({ ok: true, value: { templateIds: [id, other], email: true } });
  });
  it("drops repeats and refuses empty, oversized or malformed lists", () => {
    expect(parseSendAllInput({ clientId: id, templateIds: [id, id] })).toMatchObject({ ok: true, value: { templateIds: [id] } });
    expect(parseSendAllInput({ clientId: id, templateIds: [] }).ok).toBe(false);
    expect(parseSendAllInput({ clientId: id, templateIds: ["nope"] }).ok).toBe(false);
    expect(parseSendAllInput({ clientId: id, templateIds: Array.from({ length: 11 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`) }).ok).toBe(false);
    expect(parseSendAllInput({ clientId: "x", templateIds: [id] }).ok).toBe(false);
  });
});
