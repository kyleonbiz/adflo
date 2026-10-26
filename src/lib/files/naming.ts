import { isDay } from "@/lib/dates";
import { splitName } from "./paths";

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const US_DATE = /(?<!\d)(0?[1-9]|1[0-2])[-._](0?[1-9]|[12]\d|3[01])[-._](\d{4})(?!\d)/g;

/**
 * The house style for file names: US dates (`03-14-2026`) become `2026-03-14`, underscores and runs of
 * spaces become single spaces, characters Windows forbids are removed, trailing dots and spaces go, and
 * the extension is lower case. Words keep their own capitalization. Applying it twice changes nothing more.
 */
export function standardizeName(name: string): string {
  const { base, ext } = splitName(name);
  let b = base
    .replace(US_DATE, (m, mo: string, d: string, y: string) => {
      const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      return isDay(iso) ? iso : m;
    })
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .trim();
  if (b === "") b = "file";
  if (RESERVED.test(b)) b = `${b} file`;
  b = b.slice(0, 120).trim();
  return ext ? `${b}.${ext.toLowerCase()}` : b;
}

/** `Report (1)`, `Report - Copy`, `Report copy 2` or `Copy of Report` -> the name it was copied from. */
export function stripCopyMarker(base: string): { base: string; isCopy: boolean } {
  const trimmed = base.trim();
  // The word "copy" (with its separator and optional number) is checked before a bare "(1)", so that
  // "Report - Copy (2)" gives "Report" and not "Report - Copy".
  const patterns = [
    /^(.*?\S)(?:\s*[-_]\s*|\s+)copy(?:\s*\(?\d+\)?)?$/i,
    /^(.*\S)\s*\(\d+\)$/,
    /^copy of (.+)$/i,
  ];
  for (const re of patterns) {
    const m = re.exec(trimmed);
    if (m) return { base: m[1].trim(), isCopy: true };
  }
  return { base: trimmed, isCopy: false };
}
