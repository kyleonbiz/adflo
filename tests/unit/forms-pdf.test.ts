import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { textToPdf, wrapLine } from "@/lib/forms/pdf";

describe("textToPdf", () => {
  it("produces a PDF whose text can be read back, across several pages", async () => {
    const text = Array.from({ length: 120 }, (_, i) => `Line ${i + 1} (with) parentheses \\ and a backslash`).join("\n");
    const bytes = textToPdf(`TIME-OFF REQUEST\n${text}`);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain("%PDF-1.4");
    const pdf = await getDocumentProxy(bytes);
    expect(pdf.numPages).toBeGreaterThan(1);
    const { text: read } = await extractText(pdf, { mergePages: true });
    expect(read).toContain("TIME-OFF REQUEST");
    expect(read).toContain("Line 120");
  });

  it("handles empty text and characters outside Latin-1", async () => {
    const empty = await getDocumentProxy(textToPdf(""));
    expect(empty.numPages).toBe(1);
    const { text } = await extractText(await getDocumentProxy(textToPdf("Price €5 ✓")), { mergePages: true });
    expect(text).toContain("Price");
  });

  it("wraps long lines at spaces and splits very long words", () => {
    const wrapped = wrapLine(`${"word ".repeat(40)}`.trim(), 30);
    expect(wrapped.every((l) => l.length <= 30)).toBe(true);
    expect(wrapLine("x".repeat(70), 30)).toEqual(["x".repeat(30), "x".repeat(30), "x".repeat(10)]);
  });
});
