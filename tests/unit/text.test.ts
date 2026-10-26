import { describe, expect, it } from "vitest";
import { titleCase } from "@/lib/text";

describe("titleCase", () => {
  it("capitalizes the first letter of every word", () => {
    expect(titleCase("license and permit renewal")).toBe("License And Permit Renewal");
    expect(titleCase("Due date (optional)")).toBe("Due Date (Optional)");
    expect(titleCase("one-time")).toBe("One-Time");
    expect(titleCase("1st of the month")).toBe("1st Of The Month");
  });
  it("changes nothing else", () => {
    expect(titleCase("Upload PDF to EIN")).toBe("Upload PDF To EIN");
    expect(titleCase("Don't import")).toBe("Don't Import");
    expect(titleCase("")).toBe("");
  });
});
