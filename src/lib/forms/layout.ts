import type { FormField } from "./types";

const RULE = "-".repeat(60);

/**
 * A ready-made document layout for a form: purpose, one line per field (long answers get their own
 * block), then a signature line. `{{Field label}}` placeholders are filled in from each response.
 */
export function layoutTemplate(description: string, fields: FormField[]): string {
  const body = fields.map((f) => (f.type === "longtext" ? `${f.label}:\n{{${f.label}}}\n` : `${f.label}: {{${f.label}}}`));
  return [...(description ? [description, ""] : []), RULE, ...body, RULE, "Signature: ______________________________    Date: ______________"].join("\n");
}

/** The same layout with every answer left blank, to print or save as a PDF and fill in by hand. */
export function blankDocument(name: string, template: string): string {
  return `${name.toUpperCase()}\n\n${template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, "______________________________")}\n`;
}
