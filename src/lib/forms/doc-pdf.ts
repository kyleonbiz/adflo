import { latin1, textWidth, wrapText, type FontKey } from "./doc-fonts";
import type { Doc, DocBlock, DocBusiness } from "./doc-model";

/**
 * Draws a Doc as a PDF in the style of a printed business form: a ruled frame, a title band, a letterhead,
 * labelled cells, boxed writing areas, small-print terms and signature lines. Letter pages, base-14 fonts
 * (Times for what people write, Helvetica for labels), so the file needs no embedded fonts.
 */
const W = 612, H = 792;
const FX = 30, FR = W - 30, FTOP = H - 30, FBOT = 30;
const IN = FR - FX, PAD = 10;

type Color = [number, number, number];
const INK: Color = [0.07, 0.07, 0.08], MUTED: Color = [0.38, 0.4, 0.43], HARD: Color = [0.1, 0.1, 0.11], SOFT: Color = [0.78, 0.79, 0.81];
const FONT_NAME: Record<FontKey, string> = { sans: "F1", sansBold: "F2", serif: "F3", serifBold: "F4" };

class Page {
  ops: string[] = [];
  text(s: string, x: number, y: number, font: FontKey, size: number, o: { color?: Color; align?: "left" | "center" | "right"; tracking?: number } = {}) {
    const t = latin1(s), tr = o.tracking ?? 0, w = textWidth(t, font, size, tr);
    const px = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
    const esc = t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    this.ops.push(`BT /${FONT_NAME[font]} ${size} Tf ${(o.color ?? INK).join(" ")} rg ${tr} Tc ${px.toFixed(2)} ${y.toFixed(2)} Td (${esc}) Tj ET`);
  }
  line(x1: number, y1: number, x2: number, y2: number, w = 0.75, color: Color = HARD) { this.ops.push(`${color.join(" ")} RG ${w} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`); }
  rect(x: number, y: number, w: number, h: number, lw: number, color: Color = HARD) { this.ops.push(`${color.join(" ")} RG ${lw} w ${x} ${y} ${w} ${h} re S`); }
}

/** A measured piece of the page. `draw` receives the page, the top of its slot and its (possibly grown) height. */
interface Item {
  h: number;
  draw: (p: Page, top: number, h: number) => void;
  grow?: boolean;
  keepNext?: boolean;
  /** Text items can be cut across pages: returns what fits in `avail` and the remainder, or null. */
  split?: (avail: number) => [Item, Item] | null;
}

const rule = (p: Page, y: number, hard = true) => p.line(FX, y, FR, y, hard ? 0.9 : 0.4, hard ? HARD : SOFT);

function textItem(lines: string[], o: { font: FontKey; size: number; lead: number; pad: number; min?: number; grow?: boolean; color?: Color }): Item {
  const h = Math.max(o.min ?? 0, lines.length * o.lead + o.pad * 2 - (o.lead - o.size));
  return {
    h, grow: o.grow,
    draw: (p, top, hh) => {
      lines.forEach((l, i) => p.text(l, FX + PAD, top - o.pad - o.size - i * o.lead + 1, o.font, o.size, { color: o.color }));
      rule(p, top - hh);
    },
    split: (avail) => {
      const fit = Math.floor((avail - o.pad * 2 + (o.lead - o.size)) / o.lead);
      if (fit < 2 || fit >= lines.length) return null;
      return [textItem(lines.slice(0, fit), { ...o, min: 0, grow: false }), textItem(lines.slice(fit), { ...o, min: 0 })];
    },
  };
}

function measure(block: DocBlock): Item {
  switch (block.t) {
    case "heading": {
      return { h: 24, keepNext: true, draw: (p, top) => p.text(block.text.toUpperCase(), FX + PAD, top - 16, "sansBold", 9.5, { tracking: 0.2 }) };
    }
    case "box": return textItem(wrapText(block.text, "serif", 11, IN - PAD * 2), { font: "serif", size: 11, lead: 14.5, pad: 6, min: block.min, grow: block.grow });
    case "para": return textItem(wrapText(block.text, "serif", 11, IN - PAD * 2), { font: "serif", size: 11, lead: 14.5, pad: 8 });
    case "terms": return textItem(wrapText(block.text, "sans", 7.2, IN - PAD * 2), { font: "sans", size: 7.2, lead: 9.4, pad: 8, color: [0.2, 0.2, 0.22] });
    case "checks": {
      const rows = block.items.map((i) => wrapText(i.label, "sans", 10, IN - PAD * 2 - 20));
      const h = rows.reduce((n, r) => n + r.length * 12.5 + 5, 0) + 8;
      return {
        h, draw: (p, top, hh) => {
          let y = top - 8;
          block.items.forEach((it, i) => {
            const bx = FX + PAD, by = y - 9.5;
            p.rect(bx, by, 9, 9, 0.9);
            if (it.checked) { p.line(bx + 1.8, by + 4.5, bx + 3.8, by + 2, 1.5); p.line(bx + 3.8, by + 2, bx + 7.6, by + 7.4, 1.5); }
            rows[i]!.forEach((l, n) => p.text(l, bx + 18, y - 8 - n * 12.5, "sans", 10));
            y -= rows[i]!.length * 12.5 + 5;
          });
          rule(p, top - hh);
        },
      };
    }
    case "rows": {
      const LW = 175;
      const rows = block.rows.map(([k, v]) => ({ k: wrapText(k, "sans", 9, LW - PAD * 2), v: wrapText(v, "serif", 11, IN - LW - PAD * 2) }));
      const hs = rows.map((r) => Math.max(r.k.length * 11, r.v.length * 14) + 11);
      return {
        h: hs.reduce((a, b) => a + b, 0),
        draw: (p, top, hh) => {
          let y = top;
          rows.forEach((r, i) => {
            r.k.forEach((l, n) => p.text(l, FX + PAD, y - 15 - n * 11, "sans", 9, { color: MUTED }));
            r.v.forEach((l, n) => p.text(l, FX + LW, y - 15 - n * 14, "serif", 11));
            y -= hs[i]!;
            if (i < rows.length - 1) p.line(FX + PAD, y, FR - PAD, y, 0.4, SOFT);
          });
          rule(p, top - hh);
        },
      };
    }
    case "cells": {
      const total = block.cells.reduce((n, c) => n + (c.weight ?? 1), 0);
      const widths = block.cells.map((c) => (IN * (c.weight ?? 1)) / total);
      const prepared = block.cells.map((c, i) => ({
        label: wrapText(c.label.toUpperCase(), "sansBold", 6.6, widths[i]! - 10).slice(0, 2),
        value: block.sign ? [] : wrapText(c.value ?? "", "serif", 11, widths[i]! - 12),
      }));
      const h = block.sign ? 58 : Math.max(36, ...prepared.map((c) => 7 + c.label.length * 8 + Math.max(1, c.value.length) * 13.5 + 9));
      return {
        h, keepNext: block.sign ? false : undefined,
        draw: (p, top, hh) => {
          let x = FX;
          prepared.forEach((c, i) => {
            if (i > 0) p.line(x, top, x, top - hh, 0.9);
            c.label.forEach((l, n) => p.text(l, x + 5, top - 10 - n * 8, "sansBold", 6.6, { tracking: 0.25 }));
            c.value.forEach((l, n) => p.text(l, x + 6, top - 10 - c.label.length * 8 - 6 - n * 13.5 - 8, "serif", 11));
            if (block.sign) p.line(x + 6, top - hh + 17, x + widths[i]! - 8, top - hh + 17, 0.7);
            x += widths[i]!;
          });
          rule(p, top - hh);
        },
      };
    }
  }
}

function headerItems(doc: Doc): Item[] {
  const items: Item[] = [];
  const sub = doc.subtitle ? wrapText(doc.subtitle, "sans", 8, IN - 60) : [];
  items.push({
    h: 40 + sub.length * 10 + (sub.length ? 2 : 0),
    draw: (p, top, hh) => {
      const title = latin1(doc.title.toUpperCase());
      let size = 23;
      while (size > 11 && textWidth(title, "serifBold", size, 0.6) > IN - 40) size -= 1;
      p.text(title, (FX + FR) / 2, top - 29, "serifBold", size, { align: "center", tracking: 0.6 });
      sub.forEach((l, i) => p.text(l, (FX + FR) / 2, top - 42 - i * 10, "sans", 8, { align: "center", color: MUTED }));
      rule(p, top - hh);
    },
  });
  const b = doc.business;
  const lines = b ? [b.address, [b.phone, b.email].filter(Boolean).join("   |   ")].filter((x): x is string => !!x) : [];
  if (b?.name || lines.length || b?.license) {
    const h = 16 + (b?.name ? 20 : 0) + lines.length * 10.5 + (b?.license ? 8 : 0) + 8;
    items.push({
      h,
      draw: (p, top, hh) => {
        let y = top - 16;
        if (b?.name) { p.text(b.name.toUpperCase(), (FX + FR) / 2, y - 7, "serifBold", 15, { align: "center", tracking: 1.2 }); y -= 20; }
        lines.forEach((l, i) => p.text(l, (FX + FR) / 2, y - 2 - i * 10.5, "sans", 7.8, { align: "center", color: [0.2, 0.2, 0.22] }));
        if (b?.license) p.text(`LIC. #${b.license}`, FX + PAD, top - hh + 8, "sansBold", 7.2, { tracking: 0.3 });
        rule(p, top - hh);
      },
    });
  }
  return items;
}

function runningHeader(doc: Doc, business?: DocBusiness): Item {
  return {
    h: 26,
    draw: (p, top, hh) => {
      p.text(doc.title.toUpperCase(), FX + PAD, top - 17, "serifBold", 11, { tracking: 0.4 });
      if (business?.name) p.text(business.name, FR - PAD, top - 17, "sans", 8, { align: "right", color: MUTED });
      rule(p, top - hh);
    },
  };
}

interface Laid { items: Item[]; used: number }

function paginate(doc: Doc): Laid[] {
  const CAP = FTOP - FBOT - 4;
  const make = (first: boolean): Laid => { const items = first ? headerItems(doc) : [runningHeader(doc, doc.business)]; return { items, used: items.reduce((n, i) => n + i.h, 0) }; };
  const pages: Laid[] = [make(true)];
  const queue = doc.blocks.map(measure);
  const bodyCount = (pg: Laid, first: boolean) => pg.items.length - (first ? headerItems(doc).length : 1);
  while (queue.length) {
    const pg = pages.at(-1)!, it = queue.shift()!, first = pages.length === 1;
    const avail = CAP - pg.used, need = it.h + (it.keepNext ? Math.min(queue[0]?.h ?? 0, 56) : 0);
    if (need <= avail) { pg.items.push(it); pg.used += it.h; continue; }
    const parts = it.split?.(avail);
    if (parts) { pg.items.push(parts[0]); pg.used += parts[0].h; queue.unshift(parts[1]); pages.push(make(false)); continue; }
    if (bodyCount(pg, first) === 0) { pg.items.push(it); pg.used += it.h; pages.push(make(false)); continue; } // taller than a page and cannot be cut
    queue.unshift(it);
    pages.push(make(false));
  }
  // A trailing empty page can only come from a forced break; drop it.
  if (pages.length > 1 && bodyCount(pages.at(-1)!, false) === 0) pages.pop();
  return pages;
}

export function docToPdf(doc: Doc): Uint8Array {
  const laid = paginate(doc);
  const CAP = FTOP - FBOT - 4;
  const pages = laid.map((pg, idx) => {
    const p = new Page();
    const last = idx === laid.length - 1;
    const slack = CAP - pg.used;
    const growIdx = pg.items.reduce((g, it, i) => (it.grow ? i : g), -1);
    if (growIdx >= 0 && slack > 0) pg.items[growIdx] = { ...pg.items[growIdx]!, h: pg.items[growIdx]!.h + slack };
    const height = last && growIdx < 0 ? pg.items.reduce((n, i) => n + i.h, 0) : CAP;
    const bottom = FTOP - height - 2;
    p.rect(FX, bottom, IN, FTOP - bottom, 1.8);
    p.rect(FX + 2.6, bottom + 2.6, IN - 5.2, FTOP - bottom - 5.2, 0.4);
    let top = FTOP;
    for (const it of pg.items) { it.draw(p, top, it.h); top -= it.h; }
    if (laid.length > 1) p.text(`Page ${idx + 1} of ${laid.length}`, FR, bottom - 12, "sans", 7.5, { align: "right", color: MUTED });
    return p.ops.join("\n");
  });

  // Objects: 1 catalog, 2 pages, 3-6 fonts, then a page and its content stream for each page.
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${7 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  for (const f of ["Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Bold"]) objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`);
  pages.forEach((body, i) => {
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

  const bytes = new Uint8Array(out.length); // every character is single-byte, so offsets match
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
