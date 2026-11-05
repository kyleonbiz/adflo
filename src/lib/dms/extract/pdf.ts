import { ExtractError } from "./errors";
import type { ExtractLimits } from "./limits";
import { ocrImage } from "./ocr";

/** Scanned PDFs are read page by page, so only the first few are tried. */
const MAX_OCR_PAGES = 3;

/**
 * Reads the text layer. A scan has none, so with `ocr` on its first pages are
 * drawn and read like photos; with it off the file is reported as having no text. PDF.js is loaded lazily and run with script evaluation,
 * XFA forms and font loading switched off.
 */
export async function extractPdf(
  bytes: Uint8Array,
  limits: ExtractLimits,
  check: () => void,
  ocr = false,
): Promise<{ text: string; truncatedPages: boolean }> {
  const { getDocumentProxy } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // PDF.js takes ownership of the buffer, so hand it a copy.
    pdf = await getDocumentProxy(new Uint8Array(bytes), {
      enableXfa: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
      stopAtErrors: false,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "PasswordException") throw new ExtractError("unsupported", "encrypted");
    throw new ExtractError("unsupported", "parse_error");
  }
  try {
    const pages = Math.min(pdf.numPages, limits.maxPdfPages);
    let out = "";
    for (let i = 1; i <= pages; i++) {
      check();
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) out += item.str + (item.hasEOL ? "\n" : "");
      }
      out += "\n";
      page.cleanup();
      if (out.length > limits.maxTextChars * 2) break;
    }
    if (ocr && !/[\p{L}\p{N}]/u.test(out)) {
      // No text layer: this is a scan. Draw the first pages and read them like photos.
      const { renderPageAsImage } = await import("unpdf");
      const scanned = Math.min(pdf.numPages, MAX_OCR_PAGES);
      let read = "";
      for (let i = 1; i <= scanned; i++) {
        check();
        const png = await renderPageAsImage(pdf, i, { canvasImport: () => import("@napi-rs/canvas"), scale: 2 });
        read += (await ocrImage(new Uint8Array(png), check)) + "\n";
      }
      return { text: read, truncatedPages: pdf.numPages > scanned };
    }
    return { text: out, truncatedPages: pdf.numPages > pages };
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    throw new ExtractError("unsupported", "parse_error");
  } finally {
    await pdf.loadingTask.destroy().catch(() => undefined);
  }
}
