import type { Block, TextRun } from "./parse";
import type { DocumentSpec } from "./types";

/**
 * Lays a document out as a real PDF on Letter pages: a letterhead, the title, a panel of details, headings, wrapped
 * paragraphs with bold and italic, lists, tables, signature lines, and a footer with page numbers. Helvetica only, so
 * the file is small and opens anywhere. Characters outside Windows Latin-1 print as "?".
 */
const W = 612, H = 792, M = 56, TOP = H - 56, BOTTOM = 70, RIGHT = W - M, CONTENT = RIGHT - M;

// Helvetica widths (1/1000 em) for ASCII 32-126, regular and bold.
const REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

// Typographic characters mapped to their Windows Latin-1 byte values.
const WIN: Record<string, string> = { "‘": "\x91", "’": "\x92", "“": "\x93", "”": "\x94", "–": "\x96", "—": "\x97", "•": "\x95", "…": "\x85", "€": "\x80" };
const toWin = (s: string) => Array.from(s).map((c) => WIN[c] ?? (/[\x20-\x7e\xa0-\xff]/.test(c) ? c : "?")).join("");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function charW(c: string, bold: boolean): number {
  const code = c.charCodeAt(0);
  if (code >= 32 && code <= 126) return (bold ? BOLD : REG)[code - 32]!;
  if (c === "\x95") return 350;
  if (c === "\x97") return 1000;
  if (c === "\x93" || c === "\x94") return bold ? 500 : 333;
  if (c === "\x91" || c === "\x92") return 222;
  return 556;
}
const textW = (s: string, size: number, bold: boolean) => (Array.from(s).reduce((w, c) => w + charW(c, bold), 0) * size) / 1000;

type Color = [number, number, number];
const INK: Color = [0.07, 0.07, 0.07], NAVY: Color = [0.043, 0.106, 0.302], MUTED: Color = [0.42, 0.45, 0.5], BLUE: Color = [0.106, 0.4, 0.878], RULE: Color = [0.85, 0.88, 0.93], EDGE: Color = [0.72, 0.78, 0.88], TINT: Color = [0.933, 0.953, 0.98];

interface Chunk { text: string; bold: boolean; italic: boolean }
const font = (c: { bold?: boolean; italic?: boolean }) => (c.bold ? (c.italic ? "F4" : "F2") : c.italic ? "F3" : "F1");

class Page {
  ops: string[] = [];
  text(s: string, x: number, y: number, o: { size: number; bold?: boolean; italic?: boolean; color?: Color }) {
    this.ops.push(`BT /${font(o)} ${o.size} Tf ${(o.color ?? INK).join(" ")} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(s)}) Tj ET`);
  }
  line(x1: number, y: number, x2: number, color: Color = RULE, w = 0.75) { this.ops.push(`${color.join(" ")} RG ${w} w ${x1} ${y} m ${x2} ${y} l S`); }
  vline(x: number, y1: number, y2: number, color: Color) { this.ops.push(`${color.join(" ")} RG 0.75 w ${x} ${y1} m ${x} ${y2} l S`); }
  rect(x: number, y: number, w: number, h: number, color: Color) { this.ops.push(`${color.join(" ")} rg ${x} ${y} ${w} ${h} re f`); }
  frame(x: number, y: number, w: number, h: number, color: Color) { this.ops.push(`${color.join(" ")} RG 0.75 w ${x} ${y} ${w} ${h} re S`); }
}

/** Breaks styled text into lines no wider than `max`. A newline in the text always starts a new line. */
function wrap(runs: TextRun[], size: number, max: number, forceBold = false): Chunk[][] {
  const lines: Chunk[][] = [[]];
  let x = 0;
  const words: (Chunk | "\n")[] = [];
  for (const r of runs) {
    const t = toWin(r.text);
    t.split("\n").forEach((part, n) => {
      if (n > 0) words.push("\n");
      for (const w of part.split(/(?<= )/)) if (w) words.push({ text: w, bold: forceBold || !!r.bold, italic: !!r.italic });
    });
  }
  for (const w of words) {
    if (w === "\n") { lines.push([]); x = 0; continue; }
    const ww = textW(w.text, size, w.bold);
    const trimmed = textW(w.text.trimEnd(), size, w.bold);
    if (x + trimmed > max && x > 0) { lines.push([]); x = 0; }
    // A single word wider than the line is split by characters.
    if (trimmed > max) {
      let piece = "";
      for (const c of Array.from(w.text)) {
        if (textW(piece + c, size, w.bold) > max) { lines[lines.length - 1]!.push({ ...w, text: piece }); lines.push([]); piece = ""; }
        piece += c;
      }
      lines[lines.length - 1]!.push({ ...w, text: piece }); x = textW(piece, size, w.bold);
      continue;
    }
    lines[lines.length - 1]!.push(w); x += ww;
  }
  return lines;
}

export function documentToPdf(d: DocumentSpec): Uint8Array {
  const pages: Page[] = [new Page()];
  let p = pages[0]!, y = TOP;
  const newPage = () => { p = new Page(); pages.push(p); y = TOP; };
  const room = (need: number) => { if (y - need < BOTTOM) newPage(); };

  /** Draws wrapped lines at x, moving down by `lead` each. Returns nothing; y is updated. */
  const drawLines = (lines: Chunk[][], x: number, size: number, lead: number, color: Color = INK) => {
    for (const line of lines) {
      room(lead);
      let cx = x;
      for (const c of line) { p.text(c.text, cx, y - size, { size, bold: c.bold, italic: c.italic, color }); cx += textW(c.text, size, c.bold); }
      y -= lead;
    }
  };
  const height = (lines: Chunk[][], lead: number) => Math.max(1, lines.length) * lead;

  // ---- Letterhead, title and details panel
  const lh = d.letterhead;
  if (lh.name || lh.lines.length) {
    p.text(lh.name, M, y - 18, { size: 17, bold: true, color: NAVY });
    lh.lines.slice(0, 3).forEach((l, i) => p.text(toWin(l), RIGHT - textW(toWin(l), 8.5, false), y - 8 - i * 11, { size: 8.5, color: MUTED }));
    y -= 40;
    p.line(M, y, RIGHT, BLUE, 2);
    y -= 26;
  }
  const titleLines = wrap([{ kind: "text", text: d.title, bold: true }], 22, CONTENT);
  drawLines(titleLines, M, 22, 27);
  y -= 8;
  if (d.meta.length) {
    const rows = Math.ceil(d.meta.length / 2), h = rows * 30 + 12;
    p.rect(M, y - h, CONTENT, h, TINT);
    p.frame(M, y - h, CONTENT, h, EDGE);
    d.meta.forEach(([k, v], i) => {
      const cx = M + 14 + (i % 2) * (CONTENT / 2), cy = y - 18 - Math.floor(i / 2) * 30;
      p.text(toWin(k).toUpperCase(), cx, cy, { size: 7, bold: true, color: MUTED });
      p.text(toWin(v), cx, cy - 12, { size: 10.5, bold: true, color: INK });
    });
    y -= h + 18;
  }

  // ---- Body
  const bullet = (ordered: boolean, n: number) => (ordered ? `${n}.` : "\x95");
  const drawBlock = (b: Block<TextRun>) => {
    switch (b.kind) {
      case "heading": {
        const size = b.level === 1 ? 15 : b.level === 2 ? 12.5 : 10.5;
        const lines = wrap(b.runs, size, CONTENT, true);
        room(height(lines, size + 5) + 48); // a heading never sits alone at the bottom of a page
        y -= b.level === 1 ? 10 : 6;
        drawLines(lines, M, size, size + 5, NAVY);
        if (b.level === 1) { p.line(M, y + 1, RIGHT, EDGE, 1); y -= 6; } else y -= 3;
        break;
      }
      case "paragraph": {
        const lines = b.lines.flatMap((l) => wrap(l, 10.5, CONTENT));
        drawLines(lines, M, 10.5, 15);
        y -= 7;
        break;
      }
      case "list": {
        b.items.forEach((it, n) => {
          const lines = wrap(it, 10.5, CONTENT - 20);
          room(15);
          p.text(bullet(b.ordered, n + 1), M + 4, y - 10.5, { size: 10.5, color: BLUE, bold: true });
          drawLines(lines, M + 20, 10.5, 15);
          y -= 2;
        });
        y -= 6;
        break;
      }
      case "table": {
        const all = [...(b.header ? [b.header] : []), ...b.rows];
        const cols = Math.max(1, ...all.map((r) => r.length));
        const PAD = 7;
        const natural = Array.from({ length: cols }, (_, c) => Math.max(40, ...all.map((r, ri) => {
          const t = toWin((r[c] ?? []).map((x) => x.text).join(""));
          return Math.min(textW(t, 10, !!b.header && ri === 0) + PAD * 2 + 4, CONTENT);
        })));
        const sum = natural.reduce((a, n) => a + n, 0);
        const widths = natural.map((n) => (n / sum) * CONTENT);
        const labelled = !b.header; // a details table: the first column holds the labels
        const drawRow = (r: TextRun[][], header: boolean) => {
          const wrapped = Array.from({ length: cols }, (_, c) => wrap(r[c] ?? [], 10, widths[c]! - PAD * 2, header || (labelled && c === 0)));
          const h = Math.max(...wrapped.map((l) => height(l, 13))) + PAD * 2 - 2;
          room(h);
          if (header) p.rect(M, y - h, CONTENT, h, TINT);
          else if (labelled) p.rect(M, y - h, widths[0]!, h, TINT);
          let cx = M;
          wrapped.forEach((lines, c) => {
            const save = y; y -= PAD - 2;
            drawLines(lines, cx + PAD, 10, 13);
            y = save; cx += widths[c]!;
            if (c < cols - 1) p.vline(cx, y, y - h, EDGE);
          });
          p.frame(M, y - h, CONTENT, h, EDGE);
          y -= h;
        };
        if (b.header) drawRow(b.header, true);
        b.rows.forEach((r) => drawRow(r, false));
        y -= 12;
        break;
      }
      case "rule": room(20); y -= 8; p.line(M, y, RIGHT); y -= 12; break;
      case "signatures": {
        room(70);
        y -= 38;
        const n = b.labels.length, gap = 28, w = (CONTENT - gap * (n - 1)) / n;
        b.labels.forEach((l, i) => {
          const x = M + i * (w + gap);
          p.line(x, y, x + w, INK, 0.75);
          p.text(toWin(l), x, y - 12, { size: 8.5, color: MUTED });
        });
        y -= 30;
        break;
      }
      default: newPage();
    }
  };
  d.blocks.forEach(drawBlock);

  // ---- Footer on every page: who it is from on the left, page numbers on the right
  const total = pages.length;
  pages.forEach((pg, i) => {
    pg.line(M, 52, RIGHT, RULE);
    const left = [lh.name, d.title].filter(Boolean).join("  ·  ");
    pg.text(toWin(left), M, 38, { size: 8, color: MUTED });
    const right = `Page ${i + 1} of ${total}`;
    pg.text(right, RIGHT - textW(right, 8, false), 38, { size: 8, color: MUTED });
  });

  // ---- Assemble the file: catalog, page tree, four fonts, then a page and its content for each page.
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${7 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  for (const f of ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"]) objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`);
  pages.forEach((pg, i) => {
    const body = pg.ops.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${8 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
