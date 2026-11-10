import { describe, expect, it } from "vitest";
import { composeMailto, contactDraft, licenseDraft, parseRecipients, projectDraft } from "@/lib/send";
import { sampleLicenses } from "../support/licenses-sample-data";
import { sampleProjects } from "../support/projects-sample-data";

const TODAY = "2026-10-25";

describe("composeMailto", () => {
  it("joins recipients and encodes the subject and message", () => {
    const link = composeMailto(["a@x.com", "b@y.com"], "Hi & bye", "Line one\nLine two");
    expect(link.startsWith("mailto:a%40x.com,b%40y.com?subject=Hi%20%26%20bye&body=")).toBe(true);
    expect(decodeURIComponent(link.split("body=")[1])).toBe("Line one\r\nLine two");
  });
});

describe("recipients", () => {
  it("separates valid addresses from text that is not one", () => {
    expect(parseRecipients("a@x.com; nope, b@y.com")).toEqual({ emails: ["a@x.com", "b@y.com"], invalid: ["nope"] });
  });
});

describe("drafts", () => {
  it("describes a license with its expiry", () => {
    const l = { ...sampleLicenses(TODAY)[0], name: "City permit", number: "P-9", holder: "Acme", issuer: "City", expiresOn: "2026-11-24" };
    const d = licenseDraft(l, TODAY, "ins@x.com");
    expect(d.to).toBe("ins@x.com");
    expect(d.subject).toContain("City permit");
    expect(d.body).toContain("Number: P-9");
    expect(d.body).toContain("Held by: Acme");
    expect(d.body).toContain("30 days left");
  });
  it("leaves out license details that are blank", () => {
    const l = { ...sampleLicenses(TODAY)[0], issuer: "", number: "", holder: "" };
    const body = licenseDraft(l, TODAY).body;
    expect(body).not.toContain("Issued by");
    expect(body).not.toContain("Number:");
  });
  it("turns a project into a status update for the client", () => {
    const p = { ...sampleProjects(TODAY)[0], name: "Kitchen remodel", client: "Dana" };
    const d = projectDraft(p, TODAY);
    expect(d.subject).toBe("Status update: Kitchen remodel");
    expect(d.body.startsWith("Hi Dana,")).toBe(true);
    expect(d.body).toContain("KITCHEN REMODEL");
  });
  it("greets a contact by first name and uses their email", () => {
    expect(contactDraft({ name: "Ann Lee", email: "ann@x.com" })).toEqual({ to: "ann@x.com", subject: "", body: "Hi Ann,\n\n" });
    expect(contactDraft({ name: "", email: "" }).body).toBe("Hi,\n\n");
  });
});

import { documentDraft } from "@/lib/send";
describe("documentDraft", () => {
  it("puts the link and its expiry in the message", () => {
    const d = documentDraft("W-9.pdf", { url: "https://x.test/s/abc", expires: "Nov 12, 3:00 PM" }, "a@x.com");
    expect(d).toMatchObject({ to: "a@x.com", subject: "W-9.pdf" });
    expect(d.body).toContain("https://x.test/s/abc");
    expect(d.body).toContain("stops working on Nov 12, 3:00 PM");
  });
  it("asks the sender to attach the file when there is no link", () => {
    expect(documentDraft("W-9.pdf").body).toContain("attached");
  });
});
