import { docBusiness } from "./doc-business";
import { docToPdf } from "./doc-pdf";
import { plainDocument, type DocBusiness } from "./doc-model";

/**
 * Plain-text documents (reports, packets, signed copies) as a finished PDF, laid out by the same engine
 * as filled-in forms. Characters outside Latin-1 become "?".
 */
const MAX_CHARS = 92;

/** Breaks a line at spaces so none is wider than the page; a word longer than the line is split. */
export function wrapLine(line: string, max = MAX_CHARS): string[] {
  if (line.length <= max) return [line];
  const out: string[] = [];
  let cur = "";
  for (const word of line.split(" ")) {
    let w = word;
    while (w.length > max) {
      if (cur) { out.push(cur); cur = ""; }
      out.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= max) cur += ` ${w}`;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

export function textToPdf(text: string, business?: DocBusiness): Uint8Array {
  return docToPdf(plainDocument(text, business ?? docBusiness()));
}
