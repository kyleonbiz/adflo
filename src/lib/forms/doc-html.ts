import type { Doc, DocBlock } from "./doc-model";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const br = (s: string) => esc(s).replace(/\n/g, "<br>");

const CSS = `
@page{size:letter;margin:.4in}
*{box-sizing:border-box}
body{margin:0;color:#111;font:11pt/1.35 "Times New Roman",Times,serif}
.frame{border:2.2pt solid #111;outline:.5pt solid #111;outline-offset:-4pt;min-height:10.1in;display:flex;flex-direction:column}
.band{border-bottom:1pt solid #111;text-align:center;padding:10pt 12pt 8pt}
.band h1{margin:0;font-size:22pt;letter-spacing:.6pt;text-transform:uppercase}
.band p{margin:3pt 0 0;font:8pt Helvetica,Arial,sans-serif;color:#555}
.letterhead{border-bottom:1pt solid #111;text-align:center;padding:10pt 12pt 8pt;position:relative}
.letterhead h2{margin:0 0 4pt;font-size:15pt;letter-spacing:1.2pt;text-transform:uppercase}
.letterhead p{margin:0;font:7.8pt/1.35 Helvetica,Arial,sans-serif;color:#333}
.letterhead .lic{position:absolute;left:10pt;bottom:6pt;font:700 7.2pt Helvetica,Arial,sans-serif;letter-spacing:.3pt}
.cells{display:flex;border-bottom:1pt solid #111}
.cell{padding:4pt 6pt 5pt;min-height:30pt;border-left:1pt solid #111}
.cell:first-child{border-left:0}
.cell b{display:block;font:700 6.6pt Helvetica,Arial,sans-serif;letter-spacing:.25pt;text-transform:uppercase}
.cell span{display:block;margin-top:3pt;white-space:pre-wrap}
.sign .cell{min-height:56pt;position:relative}
.sign .cell:after{content:"";position:absolute;left:6pt;right:8pt;bottom:16pt;border-top:.7pt solid #111}
.heading{padding:7pt 10pt 4pt;font:700 9.5pt Helvetica,Arial,sans-serif;letter-spacing:.2pt;text-transform:uppercase;break-after:avoid}
.box{padding:6pt 10pt;border-bottom:1pt solid #111;white-space:pre-wrap;overflow-wrap:anywhere}
.grow{flex:1}
.terms{padding:8pt 10pt;border-bottom:1pt solid #111;font:7.2pt/1.3 Helvetica,Arial,sans-serif;color:#333}
.checks{padding:5pt 10pt;border-bottom:1pt solid #111;font:10pt/1.25 Helvetica,Arial,sans-serif}
.checks div{display:flex;gap:8pt;align-items:flex-start;padding:2.5pt 0}
.checks i{flex:none;width:9pt;height:9pt;border:.9pt solid #111;margin-top:1pt;text-align:center;font:700 9pt/8pt Helvetica,Arial,sans-serif;font-style:normal}
.rows{border-bottom:1pt solid #111}
.rows div{display:flex;padding:5pt 10pt;border-top:.4pt solid #c7c9cc}
.rows div:first-child{border-top:0}
.rows em{flex:none;width:165pt;font:9pt Helvetica,Arial,sans-serif;font-style:normal;color:#555;padding-right:10pt}
.rows span{white-space:pre-wrap;overflow-wrap:anywhere}
.cells,.rows div,.checks div{break-inside:avoid}
`;

function block(b: DocBlock): string {
  switch (b.t) {
    case "heading": return `<div class="heading">${esc(b.text)}</div>`;
    case "box": return `<div class="box${b.grow ? " grow" : ""}" style="min-height:${Math.round((b.min ?? 0) * 0.9)}pt">${esc(b.text)}</div>`;
    case "para": return `<div class="box">${esc(b.text)}</div>`;
    case "terms": return `<div class="terms">${esc(b.text)}</div>`;
    case "checks": return `<div class="checks">${b.items.map((i) => `<div><i>${i.checked ? "&#10003;" : ""}</i><span>${esc(i.label)}</span></div>`).join("")}</div>`;
    case "rows": return `<div class="rows">${b.rows.map(([k, v]) => `<div><em>${esc(k)}</em><span>${esc(v)}</span></div>`).join("")}</div>`;
    case "cells":
      return `<div class="cells${b.sign ? " sign" : ""}">${b.cells.map((c) => `<div class="cell" style="flex:${c.weight ?? 1} 1 0"><b>${esc(c.label)}</b>${c.value ? `<span>${br(c.value)}</span>` : ""}</div>`).join("")}</div>`;
  }
}

/** The document as a complete HTML page that prints (or saves as a PDF) to match the downloaded PDF. */
export function docToHtml(doc: Doc): string {
  const b = doc.business;
  const lines = b ? [b.address, [b.phone, b.email].filter(Boolean).join("&nbsp;&nbsp;|&nbsp;&nbsp;")].filter(Boolean) : [];
  const head = b && (b.name || lines.length || b.license)
    ? `<div class="letterhead">${b.name ? `<h2>${esc(b.name)}</h2>` : ""}${lines.map((l, i) => `<p>${i === 0 ? esc(l!) : l}</p>`).join("")}${b.license ? `<span class="lic">LIC. #${esc(b.license)}</span>` : ""}</div>`
    : "";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${CSS}</style>`
    + `<body><div class="frame"><div class="band"><h1>${esc(doc.title)}</h1>${doc.subtitle ? `<p>${esc(doc.subtitle)}</p>` : ""}</div>${head}${doc.blocks.map(block).join("")}</div></body></html>`;
}

/** Opens the browser's print sheet for a document (which is also how to "Save as PDF" from the print dialog). */
export function printDoc(doc: Doc): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const d = frame.contentDocument;
  if (!d) { frame.remove(); return; }
  d.open();
  d.write(docToHtml(doc));
  d.close();
  frame.contentWindow?.addEventListener("afterprint", () => frame.remove());
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 60_000);
}
