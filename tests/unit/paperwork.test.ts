import { describe, expect, it } from "vitest";
import { INDUSTRIES, PAPERWORK, paperworkFor, repeatingFor } from "@/lib/forms/paperwork";
import { createSubmission, generateDocument } from "@/lib/forms/logic";

describe("paperwork library", () => {
  it("has unique ids, unique field ids per form, and paperwork for every industry", () => {
    expect(new Set(PAPERWORK.map((p) => p.form.id)).size).toBe(PAPERWORK.length);
    for (const i of INDUSTRIES) expect(paperworkFor(i.id).length).toBeGreaterThan(0);
    for (const p of PAPERWORK) {
      expect(new Set(p.form.fields.map((x) => x.id)).size).toBe(p.form.fields.length);
      expect(new Set(p.form.fields.map((x) => x.label.toLowerCase())).size).toBe(p.form.fields.length);
      for (const fld of p.form.fields) if (fld.type === "select") expect(fld.options.length).toBeGreaterThan(0);
    }
  });

  it("marks repeating forms per industry and produces a document from a submission", () => {
    expect(repeatingFor("food").map((p) => p.form.name)).toContain("Temperature log");
    const form = paperworkFor("food")[0].form;
    const sub = createSubmission(form, { [form.fields[0].id]: "2026-10-26" }, "Sam", "2026-10-26", "s1");
    expect(generateDocument(form, sub)).toContain(form.name.toUpperCase());
  });
});
