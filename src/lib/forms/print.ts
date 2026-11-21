import { docBusiness } from "./doc-business";
import { printDoc } from "./doc-html";
import { plainDocument, type DocBusiness } from "./doc-model";

/** Opens the browser's print sheet for a text document (which is also how to "Save as PDF" from the print dialog). */
export function printText(_title: string, text: string, business?: DocBusiness): void {
  printDoc(plainDocument(text, business ?? docBusiness()));
}
