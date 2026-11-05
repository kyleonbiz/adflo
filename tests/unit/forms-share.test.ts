import { describe, expect, it } from "vitest";
import { createSubmission } from "@/lib/forms/logic";
import {
  decodeForm, encodeForm, formPath, isEmail, parseRecipients, parseResponses, responseMailto, responseMessage, sendMailto,
} from "@/lib/forms/share";
import { sampleForms } from "../support/forms-sample-data";

const forms = sampleForms();
const vendor = forms.find((f) => f.id === "form-vendor")!;
const good = { "v-name": "Acme", "v-contact": "a@b.co", "v-service": "Software", "v-spend": "", "v-w9": "true", "v-notes": "Net 30" };

describe("sending a form", () => {
  it("packs a form into a link and reads it back, keeping only what a recipient needs", () => {
    const token = encodeForm({ ...vendor, documentTemplate: "SECRET TEMPLATE", sentCount: 7 }, "me@biz.com");
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    const shared = decodeForm(token)!;
    expect(shared).toMatchObject({ v: 1, id: "form-vendor", name: "New vendor intake", replyTo: "me@biz.com" });
    expect(shared.fields).toHaveLength(vendor.fields.length);
    expect(JSON.stringify(shared)).not.toContain("SECRET TEMPLATE");
    expect(formPath(vendor, "me@biz.com")).toBe(`/form/${token}`);
  });
  it("refuses tokens that are not a form", () => {
    for (const bad of ["", "not base64!", "e30", "x".repeat(20_000), encodeForm({ ...vendor, fields: [] }, "a@b.co")]) expect(decodeForm(bad)).toBeNull();
  });
  it("builds a ready-to-send email with the link", () => {
    const m = sendMailto(vendor, "https://app.test/form/abc", ["a@x.com", "b@y.com"]);
    expect(m.startsWith("mailto:a%40x.com,b%40y.com?subject=")).toBe(true);
    expect(decodeURIComponent(m)).toContain("https://app.test/form/abc");
  });
  it("splits recipients and reports what is not an address", () => {
    expect(parseRecipients("a@x.com, b@y.com; nope  a@x.com")).toEqual({ emails: ["a@x.com", "b@y.com"], invalid: ["nope"] });
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
  });
});

describe("answers coming back", () => {
  const shared = decodeForm(encodeForm(vendor, "me@biz.com"))!;

  it("writes answers a person can read, plus a line AdFlo can read back", () => {
    const text = responseMessage(shared, "Dana", good);
    expect(text).toContain("Company name: Acme");
    expect(text).toContain("W-9 on file: Yes");
    expect(text).toMatch(/ADFLO-RESPONSE:[A-Za-z0-9_-]+$/);
    expect(responseMailto(shared, "Dana", good).startsWith("mailto:me%40biz.com?subject=")).toBe(true);
  });
  it("reads one or several answers out of pasted email text", () => {
    const a = responseMessage(shared, "Dana", good);
    const b = responseMessage(shared, "Hank", { ...good, "v-name": "Globex" });
    const parsed = parseResponses(`> forwarded\n${a}\n\nLater:\n${b}\n-- sig`, vendor);
    expect(parsed.problems).toEqual([]);
    expect(parsed.responses.map((r) => [r.submittedBy, r.values["v-name"]])).toEqual([["Dana", "Acme"], ["Hank", "Globex"]]);
    // and they become ordinary new responses
    expect(createSubmission(vendor, parsed.responses[0].values, parsed.responses[0].submittedBy, "2026-10-26", "s")).toMatchObject({ status: "new", submittedBy: "Dana" });
  });
  it("explains what went wrong instead of adding bad answers", () => {
    expect(parseResponses("hello", vendor).problems[0]).toMatch(/No AdFlo answers/);
    expect(parseResponses("ADFLO-RESPONSE:abc", vendor).problems[0]).toMatch(/Could not read/);
    const other = sampleForms().find((f) => f.id === "form-leave")!;
    expect(parseResponses(responseMessage(shared, "Dana", good), other).problems[0]).toMatch(/different form/);
    const edited = { ...vendor, fields: vendor.fields.map((f) => (f.id === "v-notes" ? { ...f, required: true } : f)) };
    const blank = responseMessage(shared, "Dana", { ...good, "v-notes": "" });
    expect(parseResponses(blank, edited).problems[0]).toMatch(/do not fit/);
  });
});
