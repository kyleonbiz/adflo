import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";

/** A file name that is safe inside a zip on every system: no slashes or control characters, no leading dots, a sensible length. */
export function safeSegment(name: string, fallback = "file"): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ")
    .replace(/(^|\s)\.+(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= 120) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 12 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 120 - ext.length).trimEnd() + ext;
}

/** `folder/name.ext`, made unique among the paths already `used` by adding " (2)", " (3)" before the extension. Records the result in `used`. */
export function uniquePath(used: Set<string>, folder: string, name: string): string {
  const dir = safeSegment(folder, "Unfiled");
  const base = safeSegment(name);
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let n = 1;
  let path = `${dir}/${base}`;
  while (used.has(path.toLowerCase())) path = `${dir}/${stem} (${++n})${ext}`;
  used.add(path.toLowerCase());
  return path;
}

export interface ZipDocument { path: string; key: string }
export interface ZipSource {
  /** Small files written first (README, record exports, indexes). */
  files: { path: string; text: string }[];
  /** Stored files, added one after another. */
  documents: ZipDocument[];
  /** Opens one stored file's bytes; null when it cannot be read. */
  open: (key: string) => Promise<ReadableStream<Uint8Array> | null>;
  /** Called with a skipped document's path so the caller can report it. */
  onSkip?: (path: string) => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Builds a zip as a stream, so a large workspace never has to fit in memory: each stored file is read and written through one
 * piece at a time. Stored files are not recompressed (PDFs and images are already compressed). Files that cannot be read are left
 * out and listed in NOT-INCLUDED.txt at the end.
 */
export function zipStream(src: ZipSource): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const skipped: string[] = [];
      const zip = new Zip((err, chunk, final) => {
        if (err) { controller.error(err); return; }
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      const settle = async () => {
        // Let the reader catch up before queueing more.
        while (controller.desiredSize !== null && controller.desiredSize < -(8 << 20)) await wait(5);
      };
      try {
        for (const f of src.files) {
          const entry = new ZipDeflate(f.path, { level: 6 });
          zip.add(entry);
          entry.push(strToU8(f.text), true);
        }
        for (const d of src.documents) {
          const body = await src.open(d.key).catch(() => null);
          if (!body) { skipped.push(d.path); src.onSkip?.(d.path); continue; }
          const entry = new ZipPassThrough(d.path);
          zip.add(entry);
          const reader = body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value?.length) { entry.push(value, false); await settle(); }
          }
          entry.push(new Uint8Array(0), true);
        }
        if (skipped.length) {
          const entry = new ZipDeflate("NOT-INCLUDED.txt");
          zip.add(entry);
          entry.push(strToU8(`These files could not be read when this export was made. Try the export again, or contact support.\r\n\r\n${skipped.join("\r\n")}\r\n`), true);
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  }, new ByteLengthQueuingStrategy({ highWaterMark: 1 << 20 }));
}
