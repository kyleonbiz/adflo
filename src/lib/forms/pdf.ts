/**
 * A small PDF writer for plain documents: Helvetica text on Letter pages, wrapped to the page.
 * Enough for a filled-in form; characters outside Latin-1 become "?".
 */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const SIZE = 11;
const LEADING = 15;
const MAX_CHARS = 92;
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN) / LEADING);

const latin1 = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
const escapePdf = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Breaks a line at spaces so none is wider than the page; a word longer than the line is split. */
export function wrapLine(line: string, max = MAX_CHARS): string[] {
  if (line.length <= max) return [line];
  const out: string[] = [];
  let cur = "";
  for (const word of line.split(" ")) {
    let w = word;
    while (w.length > max) {
      if (cur) { out.push(cur); cur = ""; }
      out.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= max) cur += ` ${w}`;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

export function textToPdf(text: string): Uint8Array {
  const lines = latin1(text).split(/\r?\n/).flatMap((l) => wrapLine(l));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) pages.push(lines.slice(i, i + LINES_PER_PAGE));
  if (pages.length === 0) pages.push([""]);

  // Objects: 1 catalog, 2 pages, 3 font, then a page + content pair for each page.
  const objects: string[] = [];
  const kids = pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  pages.forEach((page, i) => {
    const body = ["BT", `/F1 ${SIZE} Tf`, `${LEADING} TL`, `${MARGIN} ${PAGE_H - MARGIN - SIZE} Td`, ...page.map((l) => `(${escapePdf(l)}) '`), "ET"].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length); // every character is single-byte, so offsets match
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
