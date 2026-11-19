import { wrapLine } from "@/lib/forms/pdf";
import { formatMoney, invoiceTotals, lineCents } from "./logic";
import type { SharedInvoice } from "./share";

/**
 * The invoice as a laid-out PDF that mirrors the page behind its link: title and number, From and Bill to, an items
 * table, totals, payment and notes. Helvetica on Letter pages; characters outside Latin-1 become "?".
 */
const W = 612, H = 792, M = 54, RIGHT = W - M;
const STATUS = { draft: "Draft", sent: "Sent", paid: "Paid", void: "Void" } as const;

const latin1 = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
const esc = (s: string) => latin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
/** Helvetica widths in 1/1000 em, close enough to right-align money and dates. */
function width(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) w += /[0-9$#]/.test(ch) ? 556 : /[.,:;'|!ilj]/.test(ch) ? 250 : /[ ()\-/]/.test(ch) ? 300 : /[MW%@]/.test(ch) ? 850 : /[A-Z]/.test(ch) ? 670 : bold ? 580 : 520;
  return (w * size) / 1000;
}

type Color = [number, number, number];
const INK: Color = [0.07, 0.07, 0.07], MUTED: Color = [0.42, 0.45, 0.5], GREEN: Color = [0.09, 0.64, 0.29], RULE: Color = [0.83, 0.83, 0.85], FILL: Color = [0.95, 0.95, 0.96];

class Page {
  ops: string[] = [];
  text(s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: Color; right?: boolean } = {}) {
    const size = o.size ?? 10, c = o.color ?? INK;
    const px = o.right ? x - width(s, size, o.bold) : x;
    this.ops.push(`BT /${o.bold ? "F2" : "F1"} ${size} Tf ${c.join(" ")} rg ${px.toFixed(2)} ${y.toFixed(2)} Td (${esc(s)}) Tj ET`);
  }
  line(x1: number, y: number, x2: number, color: Color = RULE, w = 0.75) { this.ops.push(`${color.join(" ")} RG ${w} w ${x1} ${y} m ${x2} ${y} l S`); }
  rect(x: number, y: number, w: number, h: number, color: Color) { this.ops.push(`${color.join(" ")} rg ${x} ${y} ${w} ${h} re f`); }
}

export function invoiceToPdf(inv: SharedInvoice): Uint8Array {
  const { subtotalCents, taxCents, totalCents } = invoiceTotals(inv.items, inv.taxRate);
  const pages: Page[] = [new Page()];
  let p = pages[0]!, y = H - M;
  /** Starts a new page when `need` points do not fit above the bottom margin. */
  const room = (need: number) => { if (y - need < M) { p = new Page(); pages.push(p); y = H - M; } };
  const label = (s: string, x = M) => p.text(s.toUpperCase(), x, y, { size: 8, bold: true, color: MUTED });

  // Title block
  p.text("INVOICE", M, y - 22, { size: 26, bold: true });
  p.text(inv.sender.name, M, y - 40, { size: 10, color: MUTED });
  p.text(inv.number, RIGHT, y - 16, { size: 15, bold: true, color: GREEN, right: true });
  p.text(`Issue date: ${inv.issuedOn}`, RIGHT, y - 31, { size: 9, color: MUTED, right: true });
  p.text(`Due date: ${inv.dueOn}`, RIGHT, y - 43, { size: 9, color: MUTED, right: true });
  p.text(STATUS[inv.status], RIGHT, y - 56, { size: 9, bold: true, right: true });
  y -= 66; p.line(M, y, RIGHT); y -= 28;

  // From / Bill to
  const from = [inv.sender.name, inv.sender.address, inv.sender.phone, inv.sender.email].filter(Boolean);
  const to = [inv.client, inv.clientEmail].filter(Boolean);
  label("From"); label("Bill to", 320);
  from.forEach((l, i) => p.text(l, M, y - 14 - i * 13, { bold: i === 0 }));
  to.forEach((l, i) => p.text(l, 320, y - 14 - i * 13, { bold: i === 0 }));
  y -= 14 + Math.max(from.length, to.length) * 13 + 18;

  // Items table
  const COL = { qty: 370, rate: 460, amount: RIGHT };
  p.rect(M, y - 6, RIGHT - M, 20, FILL);
  p.text("Description", M + 6, y, { size: 9, bold: true });
  p.text("Qty", COL.qty, y, { size: 9, bold: true, right: true });
  p.text("Rate", COL.rate, y, { size: 9, bold: true, right: true });
  p.text("Amount", COL.amount - 6, y, { size: 9, bold: true, right: true });
  y -= 24;
  for (const i of inv.items) {
    const desc = wrapLine(latin1(i.description), 52);
    room(desc.length * 13 + 12);
    desc.forEach((l, n) => p.text(l, M + 6, y - n * 13));
    p.text(String(i.qty), COL.qty, y, { right: true });
    p.text(formatMoney(i.rateCents), COL.rate, y, { right: true });
    p.text(formatMoney(lineCents(i)), COL.amount - 6, y, { right: true });
    y -= desc.length * 13 + 4; p.line(M, y, RIGHT, [0.9, 0.91, 0.92]); y -= 16;
  }

  // Totals
  room(80);
  y -= 4;
  const tl = 372, tr = RIGHT - 6;
  p.text("Subtotal", tl, y); p.text(formatMoney(subtotalCents), tr, y, { right: true }); y -= 15;
  if (inv.taxRate > 0) { p.text(`Tax (${inv.taxRate}%)`, tl, y); p.text(formatMoney(taxCents), tr, y, { right: true }); y -= 15; }
  p.line(tl, y + 9, RIGHT, INK, 1.5); y -= 6;
  p.text("Total", tl, y, { size: 12, bold: true }); p.text(formatMoney(totalCents), tr, y, { size: 12, bold: true, right: true }); y -= 34;

  // Payment, paid, notes
  const block = (title: string, lines: string[]) => {
    room(30 + lines.length * 13);
    label(title); y -= 15;
    for (const l of lines) { p.text(l, M, y); y -= 13; }
    y -= 14;
  };
  if (inv.paymentMethods.length) block("Payment", [`Please pay by ${inv.dueOn}.`, ...inv.paymentMethods.map((m) => `- ${m}`)].flatMap((l) => wrapLine(latin1(l), 95)));
  if (inv.paidOn) block("Paid", [`Paid on ${inv.paidOn}.`]);
  if (inv.notes) block("Notes", inv.notes.split(/\r?\n/).flatMap((l) => wrapLine(latin1(l), 95)));

  // Assemble the file: catalog, page tree, two fonts, then a page and its content for each page.
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((pg, i) => {
    const body = pg.ops.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
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
