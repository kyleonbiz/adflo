/** Limits that keep a hostile or accidental huge file from freezing the browser. */
export const MAX_ROWS = 5000;
export const MAX_COLUMNS = 50;
export const MAX_CELL_LENGTH = 2000;

export class CsvError extends Error {}

export interface ParsedCsv {
  headers: string[];
  /** Data rows, each padded with "" to the header count. */
  rows: string[][];
  /** 1-based line of the first character of each data row in the source text. */
  lines: number[];
  delimiter: "," | ";" | "\t";
  /** Rows that had more cells than headers; the extra cells are dropped. */
  extraCells: { line: number }[];
}

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** Picks the delimiter that appears most often in the first line, ignoring quoted text. */
function detectDelimiter(text: string): ParsedCsv["delimiter"] {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch as keyof typeof counts]++;
  }
  if (counts["\t"] > counts[","] && counts["\t"] >= counts[";"]) return "\t";
  return counts[";"] > counts[","] ? ";" : ",";
}

/**
 * Parses CSV text (RFC 4180 quoting, CRLF or LF, a leading BOM, comma, semicolon or tab separators).
 * Blank lines are skipped. Throws CsvError for unusable input.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  if (text.trim() === "") throw new CsvError("The file is empty.");
  const delimiter = detectDelimiter(text);

  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let quoteLine = 1;

  const endField = () => {
    if (field.length > MAX_CELL_LENGTH) throw new CsvError(`A cell on line ${recordLine} is longer than ${MAX_CELL_LENGTH} characters.`);
    cells.push(field.replace(CONTROL, ""));
    field = "";
  };
  const endRecord = () => {
    endField();
    if (cells.some((c) => c.trim() !== "")) records.push({ cells, line: recordLine });
    cells = [];
    if (records.length > MAX_ROWS + 1) throw new CsvError(`The file has more than ${MAX_ROWS} rows. Split it into smaller files.`);
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
      quoteLine = line;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new CsvError(`A quoted value starting on line ${quoteLine} is never closed.`);
  if (field !== "" || cells.length > 0) endRecord();

  if (records.length === 0) throw new CsvError("The file has no data.");
  const [head, ...body] = records;
  if (head.cells.length > MAX_COLUMNS) throw new CsvError(`The file has more than ${MAX_COLUMNS} columns.`);

  const seen = new Map<string, number>();
  const headers = head.cells.map((raw, i) => {
    const base = raw.trim() || `Column ${i + 1}`;
    const n = (seen.get(base.toLowerCase()) ?? 0) + 1;
    seen.set(base.toLowerCase(), n);
    return n === 1 ? base : `${base} (${n})`;
  });

  const extraCells: ParsedCsv["extraCells"] = [];
  const rows = body.map((r) => {
    if (r.cells.length > headers.length && r.cells.slice(headers.length).some((c) => c.trim() !== "")) extraCells.push({ line: r.line });
    return headers.map((_, i) => (r.cells[i] ?? "").trim());
  });
  return { headers, rows, lines: body.map((r) => r.line), delimiter, extraCells };
}
