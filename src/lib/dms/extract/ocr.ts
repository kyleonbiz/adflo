import path from "node:path";
import { ExtractError } from "./errors";

/** Image types the text reader (OCR) accepts. */
export const OCR_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp"] as const;

export const isOcrFile = (fileName: string): boolean => {
  const i = fileName.lastIndexOf(".");
  return i > 0 && (OCR_EXTENSIONS as readonly string[]).includes(fileName.slice(i + 1).toLowerCase());
};

/** True when the bytes start like a real PNG, JPEG, WebP or BMP, whatever the file is called. */
export function looksLikeImage(b: Uint8Array): boolean {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  return at(0, 0x89, 0x50, 0x4e, 0x47) || at(0, 0xff, 0xd8, 0xff) || (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) || at(0, 0x42, 0x4d);
}

/** Where the English language data lives. It ships with the app, so reading an image never needs the network. */
const langPath = () => path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0");

/** Reads the text out of a photo or scan. Throws an `ExtractError` for anything that is not a readable image. */
export async function ocrImage(bytes: Uint8Array, check: () => void): Promise<string> {
  if (!looksLikeImage(bytes)) throw new ExtractError("unsupported", "parse_error");
  check();
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { langPath: langPath(), gzip: true, cacheMethod: "none" });
  try {
    check();
    const { data } = await worker.recognize(Buffer.from(bytes));
    return data.text;
  } catch {
    throw new ExtractError("failed", "parse_error");
  } finally {
    await worker.terminate();
  }
}
