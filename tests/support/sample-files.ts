/** Generates small but genuine files for the demo's sample records. */

const enc = new TextEncoder();

function escapePdf(s: string) {
  return s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, "?");
}

/** A minimal, valid single-page PDF with a title and a few lines of text. */
export function makePdf(title: string, lines: string[]): Uint8Array {
  const content = [
    "BT /F1 22 Tf 56 760 Td (" + escapePdf(title) + ") Tj ET",
    ...lines.map(
      (l, i) => `BT /F1 12 Tf 56 ${720 - i * 20} Td (${escapePdf(l)}) Tj ET`,
    ),
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return enc.encode(out);
}

export function makeCsv(rows: string[][]): Uint8Array {
  return enc.encode(
    rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n"),
  );
}
