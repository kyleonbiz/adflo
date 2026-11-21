/** Formatting actions for the template editor. Pure: they take the text and the selection and return the new text and selection. */
export type FormatAction = "bold" | "italic" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "table" | "rule" | "signatures" | "pagebreak" | { field: string };
export interface Edit { value: string; start: number; end: number }

const lineStart = (v: string, i: number) => v.lastIndexOf("\n", i - 1) + 1;
const lineEnd = (v: string, i: number) => { const n = v.indexOf("\n", i); return n === -1 ? v.length : n; };

const PREFIX: Record<"h1" | "h2" | "h3" | "bullet", string> = { h1: "# ", h2: "## ", h3: "### ", bullet: "- " };

/** Puts `block` on its own lines at the cursor, with a blank line before and after. */
function insertBlock(v: string, start: number, end: number, block: string): Edit {
  const before = v.slice(0, start).replace(/[ \t]+$/, ""), after = v.slice(end).replace(/^[ \t]+/, "");
  const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const value = before + lead + block + trail + after;
  const pos = (before + lead + block).length;
  return { value, start: pos, end: pos };
}

export function applyFormat(value: string, start: number, end: number, action: FormatAction): Edit {
  if (typeof action === "object") {
    const t = `{{${action.field}}}`;
    return { value: value.slice(0, start) + t + value.slice(end), start: start + t.length, end: start + t.length };
  }
  switch (action) {
    case "bold": case "italic": {
      const mark = action === "bold" ? "**" : "*";
      const sel = value.slice(start, end) || (action === "bold" ? "bold text" : "italic text");
      const out = value.slice(0, start) + mark + sel + mark + value.slice(end);
      return { value: out, start: start + mark.length, end: start + mark.length + sel.length };
    }
    case "h1": case "h2": case "h3": case "bullet": {
      const prefix = PREFIX[action];
      const a = lineStart(value, start), b = lineEnd(value, Math.max(start, end > start ? end - 1 : end));
      const lines = value.slice(a, b).split("\n");
      const all = lines.every((l) => l.startsWith(prefix));
      const strip = (l: string) => l.replace(/^(#{1,3}\s+|[-*•]\s+|\d{1,3}[.)]\s+)/, "");
      const next = lines.map((l) => (all ? l.slice(prefix.length) : prefix + strip(l)));
      return { value: value.slice(0, a) + next.join("\n") + value.slice(b), start: a, end: a + next.join("\n").length };
    }
    case "numbered": {
      const a = lineStart(value, start), b = lineEnd(value, Math.max(start, end > start ? end - 1 : end));
      const lines = value.slice(a, b).split("\n");
      const all = lines.every((l) => /^\d{1,3}[.)]\s+/.test(l));
      const next = lines.map((l, n) => (all ? l.replace(/^\d{1,3}[.)]\s+/, "") : `${n + 1}. ${l.replace(/^(#{1,3}\s+|[-*•]\s+|\d{1,3}[.)]\s+)/, "")}`));
      return { value: value.slice(0, a) + next.join("\n") + value.slice(b), start: a, end: a + next.join("\n").length };
    }
    case "table": return insertBlock(value, start, end, "| Item | Details |\n| --- | --- |\n| First item | |\n| Second item | |");
    case "rule": return insertBlock(value, start, end, "---");
    case "signatures": return insertBlock(value, start, end, "[signatures: Signature | Date]");
    case "pagebreak": return insertBlock(value, start, end, "[page break]");
  }
}
