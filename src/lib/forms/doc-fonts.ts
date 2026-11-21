/**
 * Advance widths (1/1000 em) of the PDF base-14 fonts for ASCII 32..126, so text can be wrapped and
 * centred exactly the way a PDF viewer will draw it. Anything outside that range is measured as an average letter.
 */
export type FontKey = "sans" | "sansBold" | "serif" | "serifBold";

const T = {
  sans: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
    667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
  sansBold: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975,
    722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333,
    556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584],
  serif: [250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444, 921,
    722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500, 333,
    444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541],
  serifBold: [250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500, 930,
    722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500, 333,
    500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520],
} satisfies Record<FontKey, number[]>;

const AVERAGE: Record<FontKey, number> = { sans: 520, sansBold: 580, serif: 460, serifBold: 500 };

/** Smart punctuation and symbols become plain characters; whatever else Latin-1 cannot hold becomes "?". */
export function latin1(s: string): string {
  return s
    .replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"')
    .replace(/[–—−]/g, "-").replace(/•/g, "*").replace(/…/g, "...")
    .replace(/€/g, "EUR").replace(/\t/g, "    ")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

export function textWidth(s: string, font: FontKey, size: number, tracking = 0): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? T[font][c - 32]! : AVERAGE[font];
  }
  return (w * size) / 1000 + s.length * tracking;
}

/** Wraps text to `maxWidth` points. Explicit line breaks are kept; a word wider than the line is split. */
export function wrapText(text: string, font: FontKey, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const para = latin1(raw);
    if (para.trim() === "") { out.push(""); continue; }
    const indent = /^ +/.exec(para)?.[0] ?? "";
    let cur = "";
    for (const word of para.trim().split(/ +/)) {
      let w = word;
      while (textWidth(w, font, size) > maxWidth) {
        let cut = w.length - 1;
        while (cut > 1 && textWidth(w.slice(0, cut), font, size) > maxWidth) cut--;
        if (cur) { out.push(indent + cur); cur = ""; }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const next = cur ? `${cur} ${w}` : w;
      if (cur && textWidth(indent + next, font, size) > maxWidth) { out.push(indent + cur); cur = w; } else cur = next;
    }
    if (cur) out.push(indent + cur);
  }
  return out;
}
