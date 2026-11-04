export type AgreementBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

/**
 * Turns plain agreement text into blocks. Understands `#`/`##`/`###` headings, `-`/`*`/`•` bullets,
 * `1.` numbered items, and blank lines between paragraphs. Anything else is a paragraph.
 * Output is data only; the renderer escapes it.
 */
export function parseAgreementText(body: string): AgreementBlock[] {
  const blocks: AgreementBlock[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ kind: "paragraph", text: para.join(" ") }); para = []; } };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;
    if (!line) { flush(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) { flush(); blocks.push({ kind: "heading", level: m[1].length as 1 | 2 | 3, text: m[2] }); continue; }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const number = line.match(/^\d{1,3}[.)]\s+(.+)$/);
    if (bullet || number) {
      flush();
      const ordered = !!number, text = (bullet ?? number)![1], last = blocks[blocks.length - 1];
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(text); else blocks.push({ kind: "list", ordered, items: [text] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
