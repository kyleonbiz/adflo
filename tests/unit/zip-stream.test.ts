import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { safeSegment, uniquePath, zipStream } from "@/lib/export/zip-stream";

const bytes = (s: string) => new TextEncoder().encode(s);
const streamOf = (...parts: string[]) => new ReadableStream<Uint8Array>({ start(c) { parts.forEach((p) => c.enqueue(bytes(p))); c.close(); } });
async function collect(s: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const r = s.getReader();
  for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

describe("safeSegment", () => {
  it("removes path separators, control characters and leading dots", () => {
    expect(safeSegment("../../etc/passwd")).toBe("etc passwd");
    expect(safeSegment("a\\b:c*d?.pdf")).toBe("a b c d .pdf");
    expect(safeSegment(".hidden")).toBe("hidden");
    expect(safeSegment("   ")).toBe("file");
    expect(safeSegment("\u0000\u0001")).toBe("file");
  });
  it("shortens a long name but keeps its extension", () => {
    const s = safeSegment(`${"x".repeat(300)}.pdf`);
    expect(s.length).toBeLessThanOrEqual(120);
    expect(s.endsWith(".pdf")).toBe(true);
  });
});

describe("uniquePath", () => {
  it("numbers duplicates before the extension, ignoring case", () => {
    const used = new Set<string>();
    expect(uniquePath(used, "Taxes", "W-9.pdf")).toBe("Taxes/W-9.pdf");
    expect(uniquePath(used, "Taxes", "w-9.PDF")).toBe("Taxes/w-9 (2).PDF");
    expect(uniquePath(used, "Taxes", "W-9.pdf")).toBe("Taxes/W-9 (3).pdf");
    expect(uniquePath(used, "Other", "W-9.pdf")).toBe("Other/W-9.pdf");
  });
  it("uses Unfiled when a folder has no usable name", () => {
    expect(uniquePath(new Set(), "", "a.txt")).toBe("Unfiled/a.txt");
  });
});

describe("zipStream", () => {
  it("writes text files and streamed documents that unzip to the same bytes", async () => {
    const out = unzipSync(await collect(zipStream({
      files: [{ path: "README.txt", text: "hello" }, { path: "records/contacts.json", text: "[{\"a\":1}]" }],
      documents: [{ path: "documents/A/one.txt", key: "k1" }, { path: "documents/A/two.bin", key: "k2" }],
      open: async (key) => (key === "k1" ? streamOf("first ", "second") : streamOf("\u0000\u0001")),
    })));
    expect(strFromU8(out["README.txt"])).toBe("hello");
    expect(strFromU8(out["records/contacts.json"])).toBe("[{\"a\":1}]");
    expect(strFromU8(out["documents/A/one.txt"])).toBe("first second");
    expect([...out["documents/A/two.bin"]]).toEqual([0, 1]);
  });
  it("leaves out files it cannot read and says so", async () => {
    const skipped: string[] = [];
    const out = unzipSync(await collect(zipStream({
      files: [], documents: [{ path: "documents/A/ok.txt", key: "ok" }, { path: "documents/A/gone.txt", key: "gone" }, { path: "documents/A/boom.txt", key: "boom" }],
      open: async (key) => { if (key === "boom") throw new Error("x"); return key === "ok" ? streamOf("fine") : null; },
      onSkip: (p) => skipped.push(p),
    })));
    expect(Object.keys(out).sort()).toEqual(["NOT-INCLUDED.txt", "documents/A/ok.txt"]);
    expect(strFromU8(out["NOT-INCLUDED.txt"])).toContain("documents/A/gone.txt");
    expect(strFromU8(out["NOT-INCLUDED.txt"])).toContain("documents/A/boom.txt");
    expect(skipped).toHaveLength(2);
  });
  it("handles a large file in many chunks", async () => {
    const big = Array.from({ length: 200 }, (_, i) => String(i).padStart(5, "0").repeat(2000));
    const out = unzipSync(await collect(zipStream({ files: [], documents: [{ path: "big.txt", key: "b" }], open: async () => streamOf(...big) })));
    expect(strFromU8(out["big.txt"])).toBe(big.join(""));
  });
});
