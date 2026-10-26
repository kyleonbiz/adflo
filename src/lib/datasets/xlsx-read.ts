import { strFromU8, unzipSync } from "fflate";
import { CsvError } from "@/lib/import/csv";

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Text of a shared or inline string: every <t> run joined, phonetic hints dropped. */
function stringText(xml: string): string {
  const runs = [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)];
  return unescapeXml(runs.map((m) => m[1]).join(""));
}

/** Built-in number formats that Excel shows as dates or times. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

/** Which cell styles (by index) hold dates, read from styles.xml. */
function dateStyles(styles: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!styles) return out;
  const custom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\b[^>]*>/g)) {
    const id = attr(m[0], "numFmtId"), code = attr(m[0], "formatCode");
    if (id && code) custom.set(Number(id), unescapeXml(code));
  }
  const xfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  [...xfs.matchAll(/<xf\b[^>]*>/g)].forEach((m, index) => {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    const code = custom.get(id)?.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
    if (BUILTIN_DATE_FORMATS.has(id) || (code !== undefined && /[yd]/i.test(code))) out.add(index);
  });
  return out;
}

/** Excel's day counter (1900 system, with its leap-year quirk) -> ISO day. */
function serialToIso(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const plainNumber = (v: string) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return String(n).includes("e") ? n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 15 }) : String(n);
};

const columnIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const quote = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Reads the first worksheet of an .xlsx file as CSV text so it can go through the same import steps as a CSV.
 * Dates become ISO days, formulas keep their last calculated value, and nothing is evaluated or uploaded.
 */
export function xlsxToCsv(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(f.name) });
  } catch {
    throw new CsvError("That file is not a valid Excel workbook.");
  }
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : undefined);

  // The first sheet listed in the workbook, falling back to the lowest-numbered worksheet file.
  let sheetPath: string | undefined;
  const firstSheet = /<sheet\b[^>]*>/.exec(text("xl/workbook.xml") ?? "")?.[0];
  const relId = firstSheet && attr(firstSheet, "r:id");
  if (relId) {
    for (const m of (text("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*>/g)) {
      const target = attr(m[0], "Target");
      if (attr(m[0], "Id") === relId && target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    }
  }
  sheetPath = sheetPath && files[sheetPath] ? sheetPath : Object.keys(files).filter((n) => n.startsWith("xl/worksheets/")).sort()[0];
  const sheet = sheetPath && text(sheetPath);
  if (!sheet) throw new CsvError("That workbook has no data.");

  const shared = [...(text("xl/sharedStrings.xml") ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => stringText(m[1]));
  const dates = dateStyles(text("xl/styles.xml"));

  const grid: string[][] = [];
  for (const m of sheet.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /^([A-Z]+)(\d+)$/.exec(attr(m[1], "r") ?? "");
    if (!ref || !m[2]) continue;
    const type = attr(m[1], "t");
    const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(m[2])?.[1];
    let value = "";
    if (type === "inlineStr") value = stringText(m[2]);
    else if (raw === undefined) value = "";
    else if (type === "s") value = shared[Number(raw)] ?? "";
    else if (type === "str") value = unescapeXml(raw);
    else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
    else if (type === "e") value = "";
    else value = dates.has(Number(attr(m[1], "s") ?? -1)) && Number.isFinite(Number(raw)) ? serialToIso(Number(raw)) : plainNumber(raw);
    (grid[Number(ref[2]) - 1] ??= [])[columnIndex(ref[1])] = value;
  }

  const width = Math.max(0, ...grid.map((r) => (r ? r.length : 0)));
  if (width === 0) throw new CsvError("That workbook has no data.");
  return Array.from(grid, (r) => Array.from({ length: width }, (_x, i) => quote(r?.[i] ?? "")).join(",")).join("\r\n") + "\r\n";
}
