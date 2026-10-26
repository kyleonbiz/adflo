import { isDay } from "@/lib/dates";
import { parseDate } from "@/lib/datasets/parse";
import type { FileEntry, SkippedFile } from "./types";

export const MAX_FILES = 5000;
const CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * A safe relative path: `/` separators, no leading `./` or `/`, no `..`, no drive letters and no control
 * characters (so it can never escape the chosen folder or break a script). Null when unusable.
 */
export function normalizePath(input: string): string | null {
  if (CONTROL.test(input)) return null;
  let p = input.replace(/\\/g, "/").trim();
  p = p.replace(/^(\.\/)+/, "").replace(/^\/+/, "").replace(/\/{2,}/g, "/").replace(/\/$/, "");
  if (p === "" || /^[a-zA-Z]:/.test(p)) return null;
  const segments = p.split("/");
  return segments.some((s) => s === "" || s === "." || s === "..") ? null : p;
}

export function splitPath(path: string): { dir: string; name: string } {
  const i = path.lastIndexOf("/");
  return i < 0 ? { dir: "", name: path } : { dir: path.slice(0, i), name: path.slice(i + 1) };
}

/** `report.final.PDF` -> base `report.final`, ext `PDF`. A leading dot (`.gitignore`) is part of the base. */
export function splitName(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return { base: name, ext: "" };
  const ext = name.slice(i + 1);
  return /^[A-Za-z0-9]{1,10}$/.test(ext) ? { base: name.slice(0, i), ext } : { base: name, ext: "" };
}

/** Operating-system litter that is never worth organizing. */
export const isSystemFile = (name: string) => /^(\.ds_store|thumbs\.db|desktop\.ini|\._.*)$/i.test(name);

export const joinPath = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

/** Single-quotes a string for a POSIX shell, so nothing inside it is ever interpreted. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Reads a pasted list, one file per line: `path`, or `path | size in bytes | modified date`.
 * Unusable and repeated lines are skipped with a reason.
 */
export function parseFileList(text: string): { files: FileEntry[]; skipped: SkippedFile[]; truncated: boolean } {
  const files: FileEntry[] = [];
  const skipped: SkippedFile[] = [];
  const seen = new Set<string>();
  let truncated = false;
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (line.trim() === "") continue;
    if (files.length >= MAX_FILES) { truncated = true; break; }
    const [rawPath, rawSize = "", rawDate = ""] = line.split(" | ").map((s) => s.trim());
    const path = normalizePath(rawPath);
    if (!path) { skipped.push({ path: rawPath.slice(0, 80), reason: "Not a usable path inside the folder" }); continue; }
    if (seen.has(path)) { skipped.push({ path, reason: "Listed twice" }); continue; }
    if (rawSize !== "" && !/^\d{1,15}$/.test(rawSize)) { skipped.push({ path, reason: `"${rawSize.slice(0, 20)}" is not a size in bytes` }); continue; }
    const modified = rawDate === "" ? null : parseDate(rawDate);
    if (rawDate !== "" && (!modified || !isDay(modified))) { skipped.push({ path, reason: `"${rawDate.slice(0, 20)}" is not a date` }); continue; }
    seen.add(path);
    files.push({ path, size: rawSize === "" ? 0 : Number(rawSize), modified });
  }
  return { files, skipped, truncated };
}
