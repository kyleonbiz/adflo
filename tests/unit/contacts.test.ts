import { describe, expect, it } from "vitest";
import { mapRows, missingRequired, suggestMapping } from "@/lib/import/mapping";
import { parseCsv } from "@/lib/import/csv";
import { runImport } from "@/lib/import/run";
import {
  IMPORT_FIELDS, TEMPLATE_CSV, applyImport, contactDuplicates, contactKey, contactsToCsv, mergeContacts, parseContact, summarize,
} from "@/lib/contacts/logic";
import { sampleContacts } from "../support/contacts-sample-data";
import type { Contact } from "@/lib/contacts/types";

const TODAY = "2026-10-25";
const sample = sampleContacts(TODAY);

describe("parseContact", () => {
  it("normalizes case, whitespace and the category", () => {
    expect(parseContact({ name: "  Ann   Lee ", email: " ANN@X.CO ", phone: "+1 555 010 2200", company: " Acme  Inc ", category: "customer", notes: " hi " }))
      .toEqual({ ok: true, value: { name: "Ann Lee", email: "ann@x.co", phone: "+1 555 010 2200", company: "Acme Inc", category: "Customer", notes: "hi" } });
  });
  it("defaults a blank category to Other and allows a name-only contact", () => {
    expect(parseContact({ name: "Bo" })).toMatchObject({ ok: true, value: { category: "Other", email: "", phone: "" } });
  });
  it("collects every problem in a row", () => {
    const r = parseContact({ name: "", email: "nope", phone: "abc", category: "Boss" });
    expect(r).toEqual({ ok: false, errors: [
      "Name is required", '"nope" is not a valid email', '"abc" is not a valid phone number',
      'Unknown category "Boss" (use Customer, Lead, Partner, Vendor, Other)',
    ] });
  });
  it("enforces length limits", () => {
    const r = parseContact({ name: "x".repeat(121), company: "y".repeat(121), notes: "z".repeat(1001) });
    expect(r).toMatchObject({ ok: false, errors: ["Name is longer than 120 characters", "Company is longer than 120 characters", "Notes are longer than 1000 characters"] });
  });
});

describe("contactKey", () => {
  it("uses email, else name and company, else nothing", () => {
    expect(contactKey({ name: "A B", email: "A@x.co", company: "" })).toBe("e:a@x.co");
    expect(contactKey({ name: "Ann Lee", email: "", company: "Acme, Inc." })).toBe("n:annlee|acmeinc");
    expect(contactKey({ name: "Ann Lee", email: "", company: "" })).toBe("");
  });
});

function run(csv: string, existing: Contact[] = []) {
  const parsed = parseCsv(csv);
  const mapping = suggestMapping(parsed.headers, IMPORT_FIELDS);
  expect(missingRequired(mapping, IMPORT_FIELDS)).toEqual([]);
  return runImport(mapRows(parsed.rows, mapping), parsed.lines, parseContact, (v) => contactKey(v), new Set(existing.map(contactKey).filter(Boolean)));
}

describe("importing contacts end to end", () => {
  const csv = [
    "Full Name,E-mail,Mobile,Organization,Type,Comments",
    "Ann Lee,ann@x.co,555-010-1111,Acme,Lead,",           // 2 ok
    "Bad Email,nope,,,,",                                  // 3 rejected
    "ANN LEE,Ann@X.co,,,,",                                // 4 duplicate in file
    "Pat Lee,pat@northwind.example,,,Customer,Updated",    // 5 duplicate of existing c-2
    "Cy Young,,,Globex,,",                                 // 6 ok (name+company key)
    ",,,,,",                                               // blank row skipped by the parser
    "Dee,,,,Boss,",                                        // 8 rejected (category)
  ].join("\n");

  it("classifies every row with the right file line", () => {
    const out = run(csv, sample);
    expect(out.accepted.map((a) => [a.line, a.value.name])).toEqual([[2, "Ann Lee"], [6, "Cy Young"]]);
    expect(out.rejected.map((r) => r.line)).toEqual([3, 8]);
    expect(out.duplicates.map((d) => [d.line, d.of])).toEqual([[4, "file"], [5, "existing"]]);
  });
  it("skips duplicates by default", () => {
    const out = run(csv, sample);
    let n = 0;
    const r = applyImport(sample, out, "skip", TODAY, () => `new-${++n}`);
    expect(r).toMatchObject({ added: 2, updated: 0, skipped: 2 });
    expect(r.contacts).toHaveLength(sample.length + 2);
    expect(r.contacts.find((c) => c.id === "c-2")!.notes).toBe("Prefers email.");
  });
  it("updates matching contacts in update mode, only overwriting non-empty fields", () => {
    const out = run(csv, sample);
    const r = applyImport(sample, out, "update", TODAY, () => "n");
    expect(r).toMatchObject({ added: 2, updated: 1, skipped: 1 });
    const pat = r.contacts.find((c) => c.id === "c-2")!;
    expect(pat).toMatchObject({ notes: "Updated", phone: "(555) 010-7100", company: "Northwind Traders" });
  });
  it("does not mutate the existing contacts", () => {
    const before = JSON.stringify(sample);
    applyImport(sample, run(csv, sample), "update", TODAY, () => "n");
    expect(JSON.stringify(sample)).toBe(before);
  });
  it("round-trips the template and an export", () => {
    expect(TEMPLATE_CSV).toBe("Name,Email,Phone,Company,Category,Notes\r\n");
    const exported = contactsToCsv(sample);
    const out = run(exported);
    expect(out.rejected).toEqual([]);
    expect(out.accepted.length + out.duplicates.length).toBe(sample.length);
  });
});

describe("column matching for contacts", () => {
  it("recognises common header spellings", () => {
    const m = suggestMapping(["Who", "Mail", "Cell", "Business", "Group", "Memo"], IMPORT_FIELDS);
    expect(m).toEqual({ name: null, email: 1, phone: 2, company: 3, category: 4, notes: 5 });
  });
});

describe("duplicates, merge and summary", () => {
  it("finds the sample duplicate pair by email", () => {
    const pairs = contactDuplicates(sample);
    expect(pairs).toHaveLength(1);
    expect([pairs[0].a.id, pairs[0].b.id]).toEqual(["c-2", "c-6"]);
    expect(pairs[0].reasons).toEqual(["Same email"]);
  });
  it("matches on phone digits (7+) and on name plus company", () => {
    const a: Contact = { ...sample[0], id: "a", email: "", phone: "(555) 010-2200" };
    const b: Contact = { ...sample[0], id: "b", email: "", phone: "555.010.2200", name: "Someone Else", company: "Other Co" };
    expect(contactDuplicates([a, b])[0].reasons).toEqual(["Same phone"]);
    expect(contactDuplicates([{ ...a, phone: "12345" }, { ...b, phone: "12345" }])).toEqual([]);
    expect(contactDuplicates([{ ...a, phone: "" }, { ...a, id: "z", phone: "", email: "" }])[0].reasons).toEqual(["Same name and company"]);
  });
  it("merges by filling blanks and combining differing notes", () => {
    const [, pat, , , , patrick] = sample;
    const merged = mergeContacts(pat, patrick);
    expect(merged.id).toBe("c-2");
    expect(merged.notes).toBe("Prefers email.\nAdded from the website form.");
    expect(mergeContacts(patrick, pat)).toMatchObject({ phone: "(555) 010-7100", name: "Patrick Lee" });
    expect(mergeContacts({ ...pat, category: "Other" }, { ...patrick, category: "Lead" }).category).toBe("Lead");
    expect(mergeContacts(pat, pat).notes).toBe("Prefers email.");
  });
  it("summarizes data quality", () => {
    expect(summarize(sample)).toEqual({ total: 7, duplicatePairs: 1, missingEmail: 2, missingPhone: 4 });
  });
  it("neutralises spreadsheet formulas in the export", () => {
    expect(contactsToCsv([{ ...sample[0], name: "=HYPERLINK(1)" }])).toContain("'=HYPERLINK(1)");
  });
});

describe("isPhone", () => {
  it.each(["(555) 010-2200", "555-010-2200", "+1 (555) 010-2200", "555.010.2200", "+44 20 7946 0958", "5550102"])("accepts %s", async (v) => {
    const { isPhone } = await import("@/lib/phone");
    expect(isPhone(v)).toBe(true);
  });
  it.each(["", "abc", "12345", "555-CALL-NOW", "(555", "+", "1".repeat(16), "555 010 2200 ext 5"])("rejects %j", async (v) => {
    const { isPhone } = await import("@/lib/phone");
    expect(isPhone(v)).toBe(false);
  });
});
