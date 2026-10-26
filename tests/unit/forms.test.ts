import { describe, expect, it } from "vitest";
import {
  cleanValues, createSubmission, decide, generateDocument, submissionsToCsv, summarize, validateSubmission,
} from "@/lib/forms/logic";
import { sampleForms, sampleSubmissions } from "@/lib/forms/sample-data";
import type { FormTemplate } from "@/lib/forms/types";
import { formBuilderSchema } from "@/lib/forms/validation";

const TODAY = "2026-10-25";
const forms = sampleForms();
const vendor = forms.find((f) => f.id === "form-vendor")!;
const feedback = forms.find((f) => f.id === "form-feedback")!;

const goodVendor = { "v-name": "Acme", "v-contact": "a@b.co", "v-service": "Software", "v-spend": "", "v-w9": "false", "v-notes": "" };

describe("validateSubmission", () => {
  it("accepts a valid submission with optional fields blank", () => {
    expect(validateSubmission(vendor, goodVendor)).toEqual({});
  });
  it("flags required, email, number and dropdown problems per field", () => {
    const errors = validateSubmission(vendor, { ...goodVendor, "v-name": " ", "v-contact": "nope", "v-service": "Tools", "v-spend": "12k" });
    expect(errors).toEqual({
      "v-name": "This field is required", "v-contact": "Enter a valid email address",
      "v-service": "Choose one of the options", "v-spend": "Enter a number",
    });
  });
  it("checks dates, lengths and required checkboxes", () => {
    const leave = forms.find((x) => x.id === "form-leave")!;
    expect(validateSubmission(leave, { "l-name": "A", "l-from": "2026-02-30", "l-to": "2026-03-01", "l-type": "Sick" })["l-from"]).toBe("Enter a valid date");
    expect(validateSubmission(vendor, { ...goodVendor, "v-notes": "x".repeat(2001) })["v-notes"]).toMatch(/under 2000/);
    const consent: FormTemplate = { ...feedback, fields: [{ id: "c", label: "I agree", type: "checkbox", required: true, options: [] }] };
    expect(validateSubmission(consent, { c: "false" })).toEqual({ c: "This must be checked" });
    expect(validateSubmission(consent, { c: "true" })).toEqual({});
  });
  it("treats negative and decimal numbers as numbers but rejects junk", () => {
    const n: FormTemplate = { ...feedback, fields: [{ id: "n", label: "N", type: "number", required: true, options: [] }] };
    for (const ok of ["-3", "2.5", "0"]) expect(validateSubmission(n, { n: ok })).toEqual({});
    for (const bad of ["1e3", "NaN", "1,000", "--1", ".5"]) expect(validateSubmission(n, { n: bad })).toEqual({ n: "Enter a number" });
  });
});

describe("submissions and approval", () => {
  it("routes to approval only when the form requires it", () => {
    expect(createSubmission(vendor, goodVendor, "Dana", TODAY, "s").status).toBe("pending");
    expect(createSubmission(feedback, { "c-score": "8" }, "", TODAY, "s")).toMatchObject({ status: "received", submittedBy: "Anonymous" });
  });
  it("keeps only the form's own fields and fills checkboxes", () => {
    expect(cleanValues(vendor, { ...goodVendor, "v-w9": undefined as unknown as string, extra: "x", "v-name": "  Acme  " })).toMatchObject({ "v-name": "Acme", "v-w9": "false" });
    expect(cleanValues(vendor, { ...goodVendor, extra: "x" })).not.toHaveProperty("extra");
  });
  it("decides a pending submission once", () => {
    const s = createSubmission(vendor, goodVendor, "Dana", TODAY, "s");
    const approved = decide(s, "approved", "Boss", TODAY, "  fine  ");
    expect(approved).toMatchObject({ status: "approved", decidedBy: "Boss", decidedOn: TODAY, comment: "fine" });
    expect(decide(approved, "rejected", "Other", TODAY)).toBe(approved);
    const received = createSubmission(feedback, { "c-score": "8" }, "x", TODAY, "r");
    expect(decide(received, "approved", "Boss", TODAY)).toBe(received);
  });
});

describe("generateDocument", () => {
  const sub = sampleSubmissions(TODAY).find((s) => s.id === "s-2")!;
  it("fills the template and appends the decision", () => {
    const doc = generateDocument(vendor, sub);
    expect(doc).toContain("NEW VENDOR INTAKE\nSubmitted by Dana Whitfield on Oct 16, 2026");
    expect(doc).toContain("Vendor: Globex Software");
    expect(doc).toContain("W-9 on file: Yes");
    expect(doc).toContain("Status: Approved");
    expect(doc).toContain("Decision by Operations manager on Oct 18, 2026: Approved for FY26.");
  });
  it("uses a default layout without a template, with formatted dates", () => {
    const leave = forms.find((x) => x.id === "form-leave")!;
    const doc = generateDocument(leave, sampleSubmissions(TODAY).find((s) => s.id === "s-3")!);
    expect(doc).toContain("First day off: Nov 8, 2026");
    expect(doc).toContain("Status: Pending");
  });
  it("expands placeholders once, so submitted text cannot inject more", () => {
    const sneaky = { ...sub, values: { ...sub.values, "v-notes": "{{Contact email}}", "v-name": "{{Notes}}" } };
    const doc = generateDocument(vendor, sneaky);
    expect(doc).toContain("Vendor: {{Notes}}");
    expect(doc).toContain("Notes:\n{{Contact email}}");
  });
  it("blanks unknown placeholders and matches labels case-insensitively", () => {
    const t = { ...vendor, documentTemplate: "[{{ nothing here }}] {{company NAME}}" };
    expect(generateDocument(t, sub)).toContain("[] Globex Software");
  });
});

describe("csv and summary", () => {
  it("exports one column per field and neutralises formulas", () => {
    const sub = { ...sampleSubmissions(TODAY)[0], values: { ...sampleSubmissions(TODAY)[0].values, "v-name": "=CMD()" } };
    const [header, row] = submissionsToCsv(vendor, [sub]).trimEnd().split("\r\n");
    expect(header).toBe("Submitted on,Submitted by,Status,Decided by,Decided on,Comment,Company name,Contact email,Service category,Expected annual spend,W-9 on file,Notes");
    expect(row).toContain("'=CMD()");
  });
  it("summarizes forms, pending and this month's decisions", () => {
    expect(summarize(forms, sampleSubmissions(TODAY), TODAY)).toEqual({ forms: 3, submissions: 5, pending: 2, decidedThisMonth: 2 });
    expect(summarize([vendor], sampleSubmissions(TODAY), TODAY)).toEqual({ forms: 1, submissions: 2, pending: 1, decidedThisMonth: 1 });
  });
});

describe("formBuilderSchema", () => {
  const field = (label: string, over = {}) => ({ id: label, label, type: "text", required: false, options: [], ...over });
  const ok = { name: "Intake", description: "", fields: [field("Name")], requiresApproval: false, approver: "", documentTemplate: "" };
  it("accepts a minimal form", () => expect(formBuilderSchema.safeParse(ok).success).toBe(true));
  it.each([
    [{ fields: [] }, "at least one field"],
    [{ fields: [field("Name"), field("name")] }, "must be unique"],
    [{ fields: [field("Pick", { type: "select", options: ["Only"] })] }, "at least two options"],
    [{ fields: [field("  ")] }, "needs a label"],
    [{ requiresApproval: true, approver: " " }, "who approves"],
    [{ name: "x" }, "form name"],
  ])("rejects %j", (patch, text) => {
    const r = formBuilderSchema.safeParse({ ...ok, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain(text);
  });
});
