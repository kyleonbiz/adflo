import type { Block, TextRun } from "./parse";
import type { DocumentSpec } from "./types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const runHtml = (rs: TextRun[]) => rs.map((r) => {
  let h = esc(r.text).replace(/\n/g, "<br>");
  if (r.bold) h = `<strong>${h}</strong>`;
  if (r.italic) h = `<em>${h}</em>`;
  return h;
}).join("");

/** Styles for a document page. Scoped under `.adoc` so the preview can sit inside the app. */
export const DOCUMENT_CSS = `
.adoc{font:10.5pt/1.55 Helvetica,Arial,sans-serif;color:#111;background:#fff}
.adoc .lh{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;padding-bottom:.6rem;border-bottom:2px solid #1b66e0;margin-bottom:1.2rem}
.adoc .lh-name{font-size:17pt;font-weight:700;color:#0b1b4d}
.adoc .lh-info{font-size:8.5pt;color:#6b7280;text-align:right;line-height:1.5}
.adoc h1.title{font-size:22pt;font-weight:700;margin:0 0 .7rem;color:#111}
.adoc .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.35rem 1.5rem;background:#eef3fa;border-radius:6px;padding:.7rem .9rem;margin-bottom:1.3rem}
.adoc .meta b{display:block;font-size:7.5pt;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;font-weight:700}
.adoc h2.h1{font-size:15pt;color:#0b1b4d;margin:1.3rem 0 .4rem}
.adoc h3.h2{font-size:12.5pt;color:#0b1b4d;margin:1.1rem 0 .35rem}
.adoc h4.h3{font-size:10.5pt;color:#0b1b4d;margin:.9rem 0 .3rem}
.adoc p{margin:0 0 .6rem}
.adoc ul,.adoc ol{margin:0 0 .7rem;padding-left:1.4rem}
.adoc ul{list-style:disc}
.adoc ol{list-style:decimal}
.adoc li{margin:.15rem 0}
.adoc table{width:100%;border-collapse:collapse;margin:.4rem 0 1rem;font-size:10pt}
.adoc th{background:#eef3fa;text-align:left;padding:.45rem .6rem;border:1px solid #d9e0ec}
.adoc td{padding:.45rem .6rem;border:1px solid #d9e0ec;vertical-align:top}
.adoc hr{border:0;border-top:1px solid #d9e0ec;margin:1rem 0}
.adoc .sigs{display:flex;gap:2rem;margin:2.2rem 0 1rem}
.adoc .sig{flex:1;border-top:1px solid #111;padding-top:.3rem;font-size:8.5pt;color:#6b7280}
.adoc .pb{break-after:page}
`;

function blockHtml(b: Block<TextRun>): string {
  switch (b.kind) {
    case "heading": return `<h${b.level + 1} class="h${b.level}">${runHtml(b.runs)}</h${b.level + 1}>`;
    case "paragraph": return `<p>${b.lines.map(runHtml).join("<br>")}</p>`;
    case "list": { const t = b.ordered ? "ol" : "ul"; return `<${t}>${b.items.map((i) => `<li>${runHtml(i)}</li>`).join("")}</${t}>`; }
    case "table": return `<table>${b.header ? `<thead><tr>${b.header.map((c) => `<th>${runHtml(c)}</th>`).join("")}</tr></thead>` : ""}<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${runHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    case "rule": return "<hr>";
    case "signatures": return `<div class="sigs">${b.labels.map((l) => `<div class="sig">${esc(l)}</div>`).join("")}</div>`;
    default: return '<div class="pb"></div>';
  }
}

/** The document as an HTML fragment (escaped throughout), for the live preview and for printing. */
export function documentToHtml(d: DocumentSpec): string {
  const lh = d.letterhead;
  const header = lh.name || lh.lines.length
    ? `<div class="lh"><div class="lh-name">${esc(lh.name)}</div><div class="lh-info">${lh.lines.map(esc).join("<br>")}</div></div>` : "";
  const meta = d.meta.length ? `<div class="meta">${d.meta.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join("")}</div>` : "";
  return `<div class="adoc">${header}<h1 class="title">${esc(d.title)}</h1>${meta}${d.blocks.map(blockHtml).join("\n")}</div>`;
}

/** A whole HTML page of the document, set up for printing on Letter paper with margins. */
export function documentToPage(d: DocumentSpec): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>@page{size:Letter;margin:0.7in}body{margin:0}${DOCUMENT_CSS}</style></head><body>${documentToHtml(d)}</body></html>`;
}
