const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Opens the browser's print sheet for a document (which is also how to "Save as PDF" from the print dialog). */
export function printText(title: string, text: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.open();
  doc.write(`<!doctype html><title>${escapeHtml(title)}</title><style>body{font:12pt/1.5 Helvetica,Arial,sans-serif;margin:0.75in}pre{white-space:pre-wrap;font:inherit}</style><pre>${escapeHtml(text)}</pre>`);
  doc.close();
  frame.contentWindow?.addEventListener("afterprint", () => frame.remove());
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 60_000);
}
