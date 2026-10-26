import { todayLocal } from "@/lib/dates";
import { MAX_FILES, isSystemFile, normalizePath } from "./paths";
import type { FileEntry, SkippedFile } from "./types";

/** Files bigger than this are compared by size and name only. */
export const MAX_HASH_BYTES = 50 * 1024 * 1024;
/** After this many bytes have been read, the rest are compared by size and name only. */
export const HASH_BUDGET_BYTES = 500 * 1024 * 1024;

export interface ScanResult {
  files: FileEntry[];
  skipped: SkippedFile[];
  /** Files that were not read, so duplicates among them are only "likely". */
  unhashed: number;
  truncated: boolean;
}

async function sha256(file: File): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;
  const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Reads a folder chosen in the browser. Every file is hashed here, on this computer, so identical files can
 * be found without uploading anything. The chosen folder's own name is dropped from each path.
 */
export async function scanBrowserFiles(list: File[], onProgress?: (done: number, total: number) => void): Promise<ScanResult> {
  const files: FileEntry[] = [];
  const skipped: SkippedFile[] = [];
  let unhashed = 0;
  let readBytes = 0;
  const total = Math.min(list.length, MAX_FILES);

  for (let i = 0; i < total; i++) {
    const f = list[i];
    const raw = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const relative = raw.includes("/") ? raw.slice(raw.indexOf("/") + 1) : raw;
    const path = normalizePath(relative);
    const name = relative.slice(relative.lastIndexOf("/") + 1);
    if (!path) skipped.push({ path: relative.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 80), reason: "Unusual characters in the path" });
    else if (isSystemFile(name)) skipped.push({ path, reason: "System file" });
    else {
      let hash: string | undefined;
      if (f.size > 0 && f.size <= MAX_HASH_BYTES && readBytes + f.size <= HASH_BUDGET_BYTES) {
        try { hash = await sha256(f); readBytes += f.size; } catch { hash = undefined; }
      }
      if (!hash && f.size > 0) unhashed++;
      files.push({ path, size: f.size, modified: todayLocal(new Date(f.lastModified)), hash });
    }
    onProgress?.(i + 1, total);
  }
  return { files, skipped, unhashed, truncated: list.length > MAX_FILES };
}
