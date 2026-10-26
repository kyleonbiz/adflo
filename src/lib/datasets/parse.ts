import { isDay } from "@/lib/dates";
import type { Cell, Column, ColumnType } from "./types";

/**
 * "1,200.50", "$1,200.50", "(1,200.50)" (negative), "-3", "12%" -> number. Anything else -> null.
 * Percentages stay as written (12% is 12), not 0.12.
 */
export function parseNumber(input: string): number | null {
  let s = input.trim();
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim(); }
  s = s.replace(/^([-+])?\s*\$/, "$1").replace(/%$/, "");
  if (!/^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/.test(s) || !/\d/.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isFinite(n) || Math.abs(n) > 1e15) return null;
  return negative ? -n : n;
}

/** `2026-03-14`, `3/14/2026` or `3-14-2026` (month first) -> ISO day, or null when not a real date. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  if (isDay(s)) return s;
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (!m) return null;
  const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return isDay(iso) ? iso : null;
}

/** Guesses a column's type from its values: date or number when at least 90% of the filled values fit. */
export function inferColumnType(values: string[]): ColumnType {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (filled.length === 0) return "text";
  const fits = (parse: (v: string) => unknown) => filled.filter((v) => parse(v) !== null).length / filled.length >= 0.9;
  if (fits(parseDate)) return "date";
  if (fits(parseNumber)) return "number";
  return "text";
}

/** Converts one source cell for a column, or explains why it cannot be. */
export function parseCell(column: Column, raw: string): { ok: true; value: Cell } | { ok: false; error: string } {
  const text = raw.trim();
  if (text === "") {
    return column.required ? { ok: false, error: `${column.name} is required` } : { ok: true, value: null };
  }
  if (column.type === "number") {
    const n = parseNumber(text);
    return n === null ? { ok: false, error: `${column.name}: "${text.slice(0, 30)}" is not a number` } : { ok: true, value: n };
  }
  if (column.type === "date") {
    const d = parseDate(text);
    return d === null ? { ok: false, error: `${column.name}: "${text.slice(0, 30)}" is not a valid date` } : { ok: true, value: d };
  }
  return { ok: true, value: text };
}
