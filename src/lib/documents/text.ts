import { parseInline, type Block, type TextRun } from "./parse";
import type { DocumentSpec, Letterhead } from "./types";

const plain = (t: string): TextRun[] => [{ kind: "text", text: t }];
const bold = (t: string): TextRun[] => [{ kind: "text", text: t, bold: true }];
const small = new Set(["and", "of", "the", "for", "to", "in", "on", "a", "an", "or"]);

/** "BUSINESS SUMMARY" -> "Business Summary"; short or numbered words (W-9, LLC) stay as they are. */
export function titleCase(s: string): string {
  return s.split(" ").map((w, i) => (/\d/.test(w) || (w.length <= 3 && w.length > 1 && !small.has(w.toLowerCase())) ? w : (small.has(w.toLowerCase()) && i > 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))).join(" ");
}

const isCaps = (l: string) => /[A-Z]{3}/.test(l) && !/[a-z]/.test(l) && l.length <= 70 && !/^[-=_\s]+$/.test(l);
const kv = (l: string) => { const m = l.match(/^([^:]{1,40}):\s+(\S.*)$/); return m && !/^https?$/i.test(m[1]!) ? [m[1]!.trim(), m[2]!.trim()] as const : null; };
const check = (l: string) => l.match(/^\[( |x|X)\]\s+(.*)$/);

/**
 * Gives plain text a real structure: a title and details panel from the first lines, headings from capitalised lines,
 * tables from "Label: value" runs, and lists and checklists from their marks. Text from anywhere in the app that was
 * written as plain lines comes out as a proper document, not a dump.
 */
export function textToDocument(text: string, letterhead: Letterhead, fallbackTitle = "Document"): DocumentSpec {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  let i = 0;
  while (i < lines.length && !lines[i]!.trim()) i++;
  let title = fallbackTitle;
  if (i < lines.length) { const first = lines[i]!.trim(); title = isCaps(first) ? titleCase(first) : first; i++; }
  const meta: [string, string][] = [];
  while (i < lines.length && lines[i]!.trim() && meta.length < 4) {
    const l = lines[i]!.trim();
    const pair = kv(l) ?? (() => { const m = l.match(/^(As of|Started|For|Submitted by)\s+(.+)$/i); return m ? ([m[1]!, m[2]!] as const) : null; })();
    if (!pair || /^(\[|-|\d+[.)])/.test(l)) break;
    meta.push([pair[0], pair[1]]); i++;
  }

  const blocks: Block<TextRun>[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ kind: "paragraph", lines: para.map((p) => parseInline(p).map((r) => (r.kind === "text" ? r : { kind: "text" as const, text: `{{${r.label}}}` }))) }); para = []; } };
  for (; i < lines.length; i++) {
    const raw = lines[i]!, l = raw.trim();
    if (!l) { flush(); continue; }
    let m: RegExpMatchArray | null;
    if (/^[-=_]{3,}$/.test(l)) { flush(); blocks.push({ kind: "rule" }); continue; }
    if ((m = l.match(/^==\s*(.+?)\s*==$/))) { flush(); blocks.push({ kind: "heading", level: 1, runs: plain(m[1]!) }); continue; }
    if (isCaps(l) && !kv(l)) { flush(); blocks.push({ kind: "heading", level: 2, runs: plain(titleCase(l)) }); continue; }
    if (check(l)) {
      flush();
      const rows: TextRun[][][] = [];
      for (; i < lines.length && check(lines[i]!.trim()); i++) { const c = check(lines[i]!.trim())!; rows.push([plain(c[1] === " " ? "To do" : "Done"), plain(c[2]!)]); }
      i--; blocks.push({ kind: "table", header: [bold("Status"), bold("Item")], rows });
      continue;
    }
    if (/^[-•*]\s+/.test(l) || /^\d{1,3}[.)]\s+/.test(l)) {
      flush();
      const ordered = /^\d/.test(l);
      const items: TextRun[][] = [];
      for (; i < lines.length && (ordered ? /^\d{1,3}[.)]\s+/ : /^[-•*]\s+/).test(lines[i]!.trim()); i++) items.push(plain(lines[i]!.trim().replace(ordered ? /^\d{1,3}[.)]\s+/ : /^[-•*]\s+/, "")));
      i--; blocks.push({ kind: "list", ordered, items });
      continue;
    }
    // A short line followed by indented "Label: value" lines is a heading with a labelled table.
    if (l.length <= 60 && !kv(l) && i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]!) && /^\s+[^:]{1,40}:/.test(lines[i + 1]!)) {
      flush();
      blocks.push({ kind: "heading", level: 3, runs: plain(l.replace(/:$/, "")) });
      const rows: TextRun[][][] = [];
      for (i++; i < lines.length && /^\s+\S/.test(lines[i]!); i++) { const p = kv(lines[i]!.trim()); rows.push(p ? [plain(p[0]), plain(p[1])] : [plain(lines[i]!.trim()), plain("")]); }
      i--; blocks.push({ kind: "table", header: null, rows });
      continue;
    }
    if (kv(l) && i + 1 < lines.length && kv(lines[i + 1]!.trim())) {
      flush();
      const rows: TextRun[][][] = [];
      for (; i < lines.length && kv(lines[i]!.trim()); i++) { const p = kv(lines[i]!.trim())!; rows.push([bold(p[0]), plain(p[1])]); }
      i--; blocks.push({ kind: "table", header: null, rows });
      continue;
    }
    para.push(l);
  }
  flush();
  return { title, letterhead, meta, blocks };
}
