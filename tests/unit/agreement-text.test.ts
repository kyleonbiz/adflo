import { describe, expect, it } from "vitest";
import { parseAgreementText } from "@/lib/control/agreement-text";

describe("parseAgreementText", () => {
  it("builds headings, paragraphs and lists", () => {
    const out = parseAgreementText("# Terms\r\nFirst line\nsecond line\n\n## Fees\n- One\n* Two\n1. A\n2) B\n<b>x</b>");
    expect(out).toEqual([
      { kind: "heading", level: 1, text: "Terms" },
      { kind: "paragraph", text: "First line second line" },
      { kind: "heading", level: 2, text: "Fees" },
      { kind: "list", ordered: false, items: ["One", "Two"] },
      { kind: "list", ordered: true, items: ["A", "B"] },
      { kind: "paragraph", text: "<b>x</b>" },
    ]);
  });
  it("returns nothing for blank text", () => expect(parseAgreementText("  \n ")).toEqual([]));
});
