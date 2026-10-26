import { toCsv } from "@/lib/csv";
import { addDays, advanceDay, formatDayLong } from "@/lib/dates";
import type { ParsedCsv } from "@/lib/import/csv";
import { runImport, type ImportOutcome } from "@/lib/import/run";
import { inferColumnType, parseCell } from "./parse";
import type { Cell, Column, Dataset } from "./types";

/** Starting column definitions for a parsed file: types guessed from the data, nothing required. */
export function suggestColumns(parsed: ParsedCsv): Column[] {
  return parsed.headers.map((name, i) => ({ name, type: inferColumnType(parsed.rows.map((r) => r[i])), required: false }));
}

/** 1200 -> "1,200", 1200.5 -> "1,200.50". With `fixed`, whole amounts also get two decimals ("1,200.00"). */
export const money = (n: number, fixed = false) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: fixed || !Number.isInteger(n) ? 2 : 0 });
const round2 = (n: number) => Math.round(n * 100) / 100;

/** True when any value in a number column has cents, so the whole column should show two decimals. */
export function needsDecimals(dataset: Dataset, index: number): boolean {
  return dataset.columns[index].type === "number" && dataset.rows.some((r) => typeof r[index] === "number" && !Number.isInteger(r[index]));
}

export function displayCell(c: Cell, type: Column["type"], fixed = false): string {
  if (c === null) return "";
  if (type === "number" && typeof c === "number") return money(c, fixed);
  if (type === "date" && typeof c === "string") return formatDayLong(c);
  return String(c);
}

/** Validates every row against the column rules; with `dedupe`, exact repeats of an earlier row are set aside. */
export function validateDataset(parsed: ParsedCsv, columns: Column[], dedupe: boolean): ImportOutcome<Cell[]> {
  const records = parsed.rows.map((row) => Object.fromEntries(row.map((v, i) => [String(i), v])));
  return runImport(
    records, parsed.lines,
    (rec) => {
      const cells: Cell[] = [];
      const errors: string[] = [];
      columns.forEach((col, i) => {
        const r = parseCell(col, rec[String(i)] ?? "");
        if (r.ok) cells.push(r.value);
        else errors.push(r.error);
      });
      return errors.length > 0 ? { ok: false, errors } : { ok: true, value: cells };
    },
    (cells) => (dedupe ? JSON.stringify(cells) : ""),
  );
}

export interface ColumnStats {
  filled: number;
  blank: number;
  distinct: number;
  sum?: number;
  avg?: number;
  min?: Cell;
  max?: Cell;
}

export function columnStats(dataset: Dataset, index: number): ColumnStats {
  const col = dataset.columns[index];
  const values = dataset.rows.map((r) => r[index]).filter((v): v is string | number => v !== null);
  const stats: ColumnStats = { filled: values.length, blank: dataset.rows.length - values.length, distinct: new Set(values).size };
  if (values.length === 0) return stats;
  if (col.type === "number") {
    const nums = values as number[];
    // A loop, not Math.min(...nums): spreading a very large column overflows the call stack.
    let sum = 0, min = nums[0], max = nums[0];
    for (const n of nums) { sum += n; if (n < min) min = n; if (n > max) max = n; }
    Object.assign(stats, { sum: round2(sum), avg: round2(sum / nums.length), min, max });
  } else if (col.type === "date") {
    const sorted = [...(values as string[])].sort();
    Object.assign(stats, { min: sorted[0], max: sorted[sorted.length - 1] });
  }
  return stats;
}

export type Aggregate = "sum" | "avg" | "count";
/** `group` is the display label ("March 2026"); `key` is the sortable value ("2026-03") used in exports. */
export interface GroupRow { group: string; key: string; rows: number; value: number }

const BLANK = "(blank)";
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** What the report's value column holds: "Rows", "Total Amount", "Average Amount" or "Count of Amount". */
export function aggregateLabel(dataset: Dataset, measure: number | null, aggregate: Aggregate): string {
  if (measure === null) return "Rows";
  const name = dataset.columns[measure].name;
  return aggregate === "sum" ? `Total ${name}` : aggregate === "avg" ? `Average ${name}` : `Count of ${name}`;
}

/**
 * Groups rows by a column (dates are grouped by month) and totals a number column, or just counts rows.
 * "Count" with a measure counts the filled values in that column. Biggest value first, except date groups,
 * which run oldest to newest; blank groups are labelled "(blank)" and sort last for dates.
 */
export function groupReport(dataset: Dataset, groupBy: number, measure: number | null, aggregate: Aggregate): GroupRow[] {
  const groupCol = dataset.columns[groupBy];
  const buckets = new Map<string, { rows: number; sum: number; n: number }>();
  for (const row of dataset.rows) {
    const raw = row[groupBy];
    const key = raw === null ? BLANK : groupCol.type === "date" ? String(raw).slice(0, 7) : String(raw);
    const b = buckets.get(key) ?? { rows: 0, sum: 0, n: 0 };
    b.rows++;
    const m = measure === null ? null : row[measure];
    if (typeof m === "number") { b.sum += m; b.n++; }
    buckets.set(key, b);
  }
  const byDate = groupCol.type === "date";
  const rows = [...buckets.entries()].map(([key, b]): GroupRow => ({
    key, rows: b.rows,
    group: byDate && key !== BLANK ? monthLabel(key) : key,
    value: round2(
      measure === null ? b.rows : aggregate === "count" ? b.n : aggregate === "avg" ? (b.n ? b.sum / b.n : 0) : b.sum,
    ),
  }));
  if (byDate) return rows.sort((a, b) => (a.key === BLANK ? 1 : b.key === BLANK ? -1 : a.key.localeCompare(b.key)));
  return rows.sort((a, b) => b.value - a.value || a.group.localeCompare(b.group));
}

export function datasetToCsv(dataset: Dataset): string {
  return toCsv([
    dataset.columns.map((c) => c.name),
    ...dataset.rows.map((r) => r.map((c) => (c === null ? "" : c))),
  ]);
}

export function reportToCsv(dataset: Dataset, groupBy: number, measure: number | null, aggregate: Aggregate): string {
  const label = aggregateLabel(dataset, measure, aggregate);
  return toCsv([
    [dataset.columns[groupBy].name, "Rows", label === "Rows" ? "Value" : label],
    ...groupReport(dataset, groupBy, measure, aggregate).map((g) => [g.key, g.rows, g.value]),
  ]);
}

/** The rows that did not load, as a CSV (line number and problems first, then the original values) to fix and re-import. */
export function rejectedToCsv(parsed: ParsedCsv, rejected: ImportOutcome<Cell[]>["rejected"]): string {
  const rowAt = new Map(parsed.lines.map((line, i) => [line, parsed.rows[i]]));
  return toCsv([
    ["Line", "Problems", ...parsed.headers],
    ...rejected.map((r) => [r.line, r.errors.join("; "), ...(rowAt.get(r.line) ?? [])]),
  ]);
}

export interface RecordSort { column: number; direction: "asc" | "desc" }

/** Rows matching `query` (any cell, as shown or as stored), ordered by `sort`; blanks always last. */
export function viewRecords(dataset: Dataset, query: string, sort: RecordSort | null): Cell[][] {
  const q = query.trim().toLowerCase();
  const fixed = dataset.columns.map((_c, i) => needsDecimals(dataset, i));
  let rows = q === ""
    ? dataset.rows
    : dataset.rows.filter((row) => row.some((c, i) => c !== null && (String(c).toLowerCase().includes(q) || displayCell(c, dataset.columns[i].type, fixed[i]).toLowerCase().includes(q))));
  if (sort) {
    const { column, direction } = sort;
    const sign = direction === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const x = a[column], y = b[column];
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return sign * (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)));
    });
  }
  return rows;
}

/** Plain-text summary: row count and, per column, the totals that make sense for its type. */
export function summaryText(dataset: Dataset, today: string): string {
  const lines = [`DATA SUMMARY: ${dataset.name}`, `As of ${formatDayLong(today)}`, `${dataset.rows.length} rows, ${dataset.columns.length} columns`, ""];
  dataset.columns.forEach((c, i) => {
    const s = columnStats(dataset, i);
    const parts = [`${s.filled} filled`, ...(s.blank ? [`${s.blank} blank`] : [])];
    if (c.type === "number" && s.sum !== undefined) parts.push(`total ${money(s.sum)}`, `average ${money(s.avg!)}`, `range ${money(s.min as number)} to ${money(s.max as number)}`);
    else if (c.type === "date" && s.min) parts.push(`${formatDayLong(s.min as string)} to ${formatDayLong(s.max as string)}`);
    else parts.push(`${s.distinct} distinct`);
    lines.push(`${c.name} (${c.type}): ${parts.join(", ")}`);
  });
  return lines.join("\n") + "\n";
}

export type Frequency = "weekly" | "monthly";

/** The next scheduled summary after `today`: the coming Monday, or the 1st of next month. */
export function nextSummaryDate(today: string, frequency: Frequency): string {
  if (frequency === "monthly") return `${advanceDay(today.slice(0, 7) + "-01", "monthly")}`;
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, ((8 - dow) % 7) || 7);
}
