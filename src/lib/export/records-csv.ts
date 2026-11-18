import { toCsv } from "@/lib/csv";

/** One CSV from saved records of any kind: every top-level field becomes a column (id first), and nested values are written as JSON. */
export function recordsToCsv(records: Record<string, unknown>[]): string {
  const columns: string[] = [];
  for (const r of records) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k);
  columns.sort((a, b) => (a === "id" ? -1 : b === "id" ? 1 : 0));
  const cell = (v: unknown): string | number =>
    v === null || v === undefined ? "" : typeof v === "string" || typeof v === "number" ? v : typeof v === "boolean" ? String(v) : JSON.stringify(v);
  return toCsv([columns, ...records.map((r) => columns.map((c) => cell(r[c])))]);
}
