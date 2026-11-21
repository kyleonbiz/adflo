import type { FormField } from "./types";

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

/**
 * A ready-made document layout for a form, in the document writing format: the purpose, a table of short answers, each
 * long answer under its own heading, then signature lines. `{{Field label}}` placeholders are filled in from each response.
 */
export function layoutTemplate(description: string, fields: FormField[]): string {
  const short = fields.filter((f) => f.type !== "longtext");
  const long = fields.filter((f) => f.type === "longtext");
  return [
    ...(description ? [description, ""] : []),
    ...(short.length ? ["## Details", "", "| Item | Response |", "| --- | --- |", ...short.map((f) => `| ${cell(f.label)} | {{${f.label}}} |`), ""] : []),
    ...long.flatMap((f) => [`### ${cell(f.label)}`, "", `{{${f.label}}}`, ""]),
    "[signatures: Signature | Date]",
  ].join("\n");
}
