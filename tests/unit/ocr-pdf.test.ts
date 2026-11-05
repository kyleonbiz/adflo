import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText } from "@/lib/dms/extract";

const scanned = new Uint8Array(readFileSync("tests/support/license-scan.pdf"));

describe("reading scanned PDFs", () => {
  it("reports no text when the text reader is off", async () => {
    const r = await extractText({ bytes: scanned, fileName: "scan.pdf" });
    expect(r.status).toBe("unsupported");
    expect(r.reason).toBe("no_text_found");
  });

  it("reads the pages of a scan when the text reader is on", async () => {
    const r = await extractText({ bytes: scanned, fileName: "scan.pdf", ocr: true });
    expect(r.status).toBe("indexed");
    expect(r.text).toMatch(/48213/);
  }, 60000);
});
