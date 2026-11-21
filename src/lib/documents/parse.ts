/**
 * The writing format for documents made from forms: plain text with a few marks, so a template stays easy to type
 * and safe to store. Headings (`#`, `##`, `###`), `**bold**`, `*italic*`, bullets (`-`) and numbered lines, tables
 * (`| a | b |`), a divider (`---`), signature lines (`[signatures: Signature | Date]`), `[page break]` and
 * `{{Field label}}` placeholders. Anything else is a paragraph, and line breaks inside a paragraph are kept.
 * Output is data only: renderers escape it, and values dropped into placeholders are never read as marks.
 */
export type Run = { kind: "text"; text: string; bold?: boolean; italic?: boolean } | { kind: "field"; label: string; bold?: boolean; italic?: boolean };
export type TextRun = Extract<Run, { kind: "text" }>;

export type Block<R = Run> =
  | { kind: "heading"; level: 1 | 2 | 3; runs: R[] }
  | { kind: "paragraph"; lines: R[][] }
  | { kind: "list"; ordered: boolean; items: R[][] }
  | { kind: "table"; header: R[][] | null; rows: R[][][] }
  | { kind: "rule" }
  | { kind: "signatures"; labels: string[] }
  | { kind: "pagebreak" };

const INLINE = /(\{\{\s*[^{}]+?\s*\}\})|(\*\*[^*]+?\*\*)|(\*[^*\s][^*]*?\*)/g;

/** Splits one line of text into runs: placeholders, bold and italic. */
export function parseInline(text: string, style: { bold?: boolean; italic?: boolean } = {}): Run[] {
  const out: Run[] = [];
  let last = 0;
  const push = (t: string) => { if (t) out.push({ kind: "text", text: t, ...style }); };
  for (const m of text.matchAll(INLINE)) {
    push(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) out.push({ kind: "field", label: m[1].slice(2, -2).trim(), ...style });
    else if (m[2]) out.push(...parseInline(m[2].slice(2, -2), { ...style, bold: true }));
    else out.push(...parseInline(m[3]!.slice(1, -1), { ...style, italic: true }));
  }
  push(text.slice(last));
  return out;
}

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isSeparator = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line.trim());

export function parseDocument(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ kind: "paragraph", lines: para.map((l) => parseInline(l)) }); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    let m: RegExpMatchArray | null;
    if (!line) { flush(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flush(); blocks.push({ kind: "rule" }); continue; }
    if (/^\[\s*page\s*break\s*\]$/i.test(line)) { flush(); blocks.push({ kind: "pagebreak" }); continue; }
    if ((m = line.match(/^\[\s*signatures?\s*(?::\s*(.*?))?\s*\]$/i))) {
      flush();
      const labels = (m[1] ?? "").split("|").map((l) => l.trim()).filter(Boolean).slice(0, 3);
      blocks.push({ kind: "signatures", labels: labels.length ? labels : ["Signature", "Date"] });
      continue;
    }
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) { flush(); blocks.push({ kind: "heading", level: m[1]!.length as 1 | 2 | 3, runs: parseInline(m[2]!) }); continue; }
    if (line.startsWith("|")) {
      flush();
      const rows: string[] = [line];
      while (i + 1 < lines.length && lines[i + 1]!.trim().startsWith("|")) rows.push(lines[++i]!.trim());
      const hasHeader = rows.length > 1 && isSeparator(rows[1]!);
      const body = rows.filter((r, n) => !(hasHeader && n === 1)).map((r) => cells(r).map((c) => parseInline(c)));
      blocks.push({ kind: "table", header: hasHeader ? body[0]! : null, rows: hasHeader ? body.slice(1) : body });
      continue;
    }
    const bullet = line.match(/^[-•]\s+(.+)$/) ?? line.match(/^\*\s+(.+)$/);
    const number = line.match(/^\d{1,3}[.)]\s+(.+)$/);
    if (bullet || number) {
      flush();
      const ordered = !bullet, last = blocks[blocks.length - 1];
      const item = parseInline((bullet ?? number)![1]!);
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(item); else blocks.push({ kind: "list", ordered, items: [item] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Fills every placeholder with the text `value(label)` returns, once, as plain text: marks inside a value are never read. */
export function resolveBlocks(blocks: Block[], value: (label: string) => string): Block<TextRun>[] {
  const runs = (rs: Run[]): TextRun[] => rs.map((r) => (r.kind === "text" ? r : { kind: "text", text: value(r.label), bold: r.bold, italic: r.italic }));
  return blocks.map((b): Block<TextRun> => {
    switch (b.kind) {
      case "heading": return { ...b, runs: runs(b.runs) };
      case "paragraph": return { ...b, lines: b.lines.map(runs) };
      case "list": return { ...b, items: b.items.map(runs) };
      case "table": return { ...b, header: b.header && b.header.map(runs), rows: b.rows.map((r) => r.map(runs)) };
      default: return b;
    }
  });
}

export const runsText = (rs: TextRun[]) => rs.map((r) => r.text).join("");

/** The same document as readable plain text (for a .txt download). */
export function blocksToText(blocks: Block<TextRun>[]): string {
  return blocks.map((b) => {
    switch (b.kind) {
      case "heading": return b.level === 1 ? runsText(b.runs).toUpperCase() : runsText(b.runs);
      case "paragraph": return b.lines.map(runsText).join("\n");
      case "list": return b.items.map((it, n) => `${b.ordered ? `${n + 1}.` : "-"} ${runsText(it)}`).join("\n");
      case "table": return [...(b.header ? [b.header] : []), ...b.rows].map((r) => r.map(runsText).join(": ")).join("\n");
      case "rule": return "------------------------------------------------------------";
      case "signatures": return b.labels.map((l) => `${l}: ______________________`).join("    ");
      default: return "";
    }
  }).filter((s, i, a) => !(s === "" && (i === 0 || a[i - 1] === ""))).join("\n\n");
}
