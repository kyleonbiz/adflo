import { formatDayLong } from "@/lib/dates";
import { displayValue } from "@/lib/forms/logic";
import { layoutTemplate } from "@/lib/forms/layout";
import type { FormTemplate, Submission } from "@/lib/forms/types";
import { parseDocument, resolveBlocks } from "./parse";
import type { DocumentSpec, Letterhead } from "./types";

/** Shown where an answer would go on a blank copy, to fill in by hand. */
const BLANK = "______________________________";
const BLANK_LONG = "________________________________________________________";

/**
 * A form's document: its template (or the default layout) with the answers filled in, under the business letterhead.
 * With no submission it is a blank copy to print and fill in by hand.
 */
export function formDocument(form: FormTemplate, sub: Submission | null, letterhead: Letterhead): DocumentSpec {
  const byLabel = new Map(form.fields.map((f) => [f.label.toLowerCase(), f]));
  const value = (label: string) => {
    if (!sub) { const f = byLabel.get(label.toLowerCase()); return !f ? "" : f.type === "longtext" ? [BLANK_LONG, BLANK_LONG, BLANK_LONG].join("\n") : BLANK; }
    const f = byLabel.get(label.toLowerCase());
    return f ? displayValue(f, sub.values[f.id]) : "";
  };
  const source = form.documentTemplate.trim() ? form.documentTemplate : layoutTemplate(form.description, form.fields);
  return {
    title: form.name,
    letterhead,
    meta: sub
      ? [["Submitted by", sub.submittedBy], ["Date", formatDayLong(sub.submittedOn)]]
      : [["Name", BLANK.slice(0, 18)], ["Date", BLANK.slice(0, 18)]],
    blocks: resolveBlocks(parseDocument(source), value),
  };
}

/** A document made from plain lines of text (a packet checklist, a signed copy): same letterhead, footer and page numbers. */
export function textDocument(title: string, text: string, letterhead: Letterhead): DocumentSpec {
  return { title, letterhead, meta: [], blocks: resolveBlocks(parseDocument(text.split("\n").map((l) => l.trimEnd()).join("\n")), () => ""), };
}
