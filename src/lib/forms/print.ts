import { documentToPage } from "@/lib/documents/html";
import { currentLetterhead } from "@/lib/documents/letterhead";
import { textToDocument } from "@/lib/documents/text";
import type { DocumentSpec } from "@/lib/documents/types";

/** Opens the browser's print sheet for a page of HTML (which is also how to "Save as PDF" from the print dialog). */
function printPage(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.addEventListener("afterprint", () => frame.remove());
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 60_000);
}

/** Prints a laid-out document: letterhead, headings, tables and signature lines as they appear in the PDF. */
export function printDocument(d: DocumentSpec): void { printPage(documentToPage(d)); }

/** Prints plain text as a structured document (title, headings, tables, lists) on the business letterhead. */
export function printText(title: string, text: string): void { printDocument(textToDocument(text, currentLetterhead(), title)); }
