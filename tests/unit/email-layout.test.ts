import { describe, expect, it } from "vitest";
import { brandedEmail, escapeHtml } from "@/lib/mail/layout";
import { agreementEmail, agreementsEmail, acceptanceNoticeEmail } from "@/lib/mail/onboarding-email";
import { shareEmail } from "@/lib/mail/share-email";
import { invitationHtml, welcomeHtml } from "@/lib/control/workspace";
import { signupReminderEmail } from "@/lib/control/reminder-emails";

describe("branded email layout", () => {
  it("has the AdFlo banner, headline, details panel, button and footer", () => {
    const html = brandedEmail({ headline: "Hello there", intro: ["Body text"], panel: [["Client", "Acme"]], buttons: [{ label: "Go", url: "https://www.adflo.pro/x" }] });
    for (const part of ["logo-wordmark-light.png", "Hello there", "Body text", "Acme", ">Go<", "https://www.adflo.pro/x", "administrative management platform"]) expect(html).toContain(part);
  });
  it("escapes everything it is given and never makes a non-web link", () => {
    const html = brandedEmail({ headline: "<script>x</script>", intro: ['a "quote" & <b>'], panel: [["<k>", "<v>"]], buttons: [{ label: "<go>", url: "javascript:alert(1)" }] });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("javascript:alert(1)\"");
    expect(html).toContain('href="#"');
    expect(escapeHtml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
  });
});

describe("every outgoing email has a branded HTML version beside its plain text", () => {
  const link = "https://www.adflo.pro/agreement/" + "A".repeat(43);
  it("agreements, notices, shares, invitations, welcome and reminders", () => {
    const mails = [
      agreementEmail({ clientName: "Acme", ownerName: "Pat", link }),
      agreementsEmail({ clientName: "Acme", ownerName: "Pat", items: [{ title: "Terms", link }, { title: "Privacy Policy", link }] }),
      acceptanceNoticeEmail({ clientName: "Acme", title: "Terms", version: 1, acceptedName: "Pat", acceptedEmail: "p@a.co", acceptedAt: "now", controlUrl: "https://www.adflo.pro/control/agreements" }),
      shareEmail({ senderName: "Pat", fileName: "Plan.pdf", url: "https://www.adflo.pro/share/t", expiresAtLabel: "Dec 1" }),
      signupReminderEmail({ clientName: "Acme", ownerName: "Pat", ownerEmail: "p@a.co", inviteUrl: "https://www.adflo.pro/invite/t" }),
    ];
    for (const m of mails) { expect(m.text.length).toBeGreaterThan(20); expect(m.html).toContain("<!doctype html>"); expect(m.html).toContain("logo-wordmark-light.png"); }
    expect(invitationHtml({ clientName: "Acme", ownerName: "Pat", ownerEmail: "p@a.co", inviteUrl: "https://www.adflo.pro/invite/t" })).toContain("Confirm your invitation");
    expect(welcomeHtml({ clientName: "Acme", ownerName: "Pat", loginUrl: "https://www.adflo.pro/login" })).toContain("Sign in to AdFlo");
  });
  it("puts a client's own words in the email as text, not markup", () => {
    const m = agreementEmail({ clientName: "<img src=x onerror=1>", ownerName: "<b>Pat</b>", link });
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).not.toContain("<b>Pat");
  });
});
