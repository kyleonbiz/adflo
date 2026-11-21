import { currentLetterhead } from "@/lib/documents/letterhead";
import { documentToPdf } from "@/lib/documents/pdf";
import { textToDocument } from "@/lib/documents/text";

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

/**
 * Plain text as a laid-out PDF: the text is given a structure (title, headings, tables, lists) and set on the business
 * letterhead with page numbers. Use a structured document where the data is already structured (see lib/documents).
 */
export function textToPdf(text: string, title?: string): Uint8Array {
  return documentToPdf(textToDocument(text, currentLetterhead(), title));
}
