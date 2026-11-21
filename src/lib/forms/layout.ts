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

/**
 * Keeps hand-written document wording in step when fields are renamed in the builder: every `{{Old label}}`
 * becomes `{{New label}}` for a field (matched by id) whose label changed.
 */
export function renameInTemplate(template: string, before: FormField[], after: FormField[]): string {
  const renames = new Map<string, string>();
  for (const b of before) {
    const a = after.find((x) => x.id === b.id);
    if (a && a.label.trim() && a.label.trim() !== b.label) renames.set(b.label.toLowerCase(), a.label.trim());
  }
  if (renames.size === 0) return template;
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, label: string) => (renames.has(label.toLowerCase()) ? `{{${renames.get(label.toLowerCase())}}}` : m));
}
