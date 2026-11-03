import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canExtract, extractText } from "@/lib/dms/extract";
import { looksLikeImage } from "@/lib/dms/extract/ocr";
import { foundCount, parseLicenseText, withIssueDate } from "@/lib/licenses/parse";

const scan = new Uint8Array(readFileSync("tests/support/license-scan.png"));

describe("reading photos and scans", () => {
  it("is off unless asked for, and recognises real images by their first bytes", () => {
    expect(canExtract("scan.png")).toBe(false);
    expect(canExtract("scan.PNG", true)).toBe(true);
    expect(canExtract("notes.txt", true)).toBe(true);
    expect(canExtract("movie.mp4", true)).toBe(false);
    expect(looksLikeImage(scan)).toBe(true);
    expect(looksLikeImage(new TextEncoder().encode("not an image"))).toBe(false);
  });

  it("reads a license photo and finds its details", async () => {
    const r = await extractText({ bytes: scan, fileName: "license.png", ocr: true });
    expect(r.status).toBe("indexed");
    expect(r.text).toContain("BL-20931");
    const fields = withIssueDate(parseLicenseText(r.text));
    expect(fields.number).toBe("BL-20931");
    expect(fields.expiresOn).toBe("2027-01-15");
    expect(foundCount(fields)).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it("leaves an image unread when OCR is not requested", async () => {
    expect(await extractText({ bytes: scan, fileName: "license.png" })).toMatchObject({ status: "unsupported", reason: "unsupported_type" });
  });

  it("does not index a file that only claims to be an image", async () => {
    const r = await extractText({ bytes: new TextEncoder().encode("not a real image"), fileName: "scan.png", ocr: true });
    expect(r.status).not.toBe("indexed");
  });
});
