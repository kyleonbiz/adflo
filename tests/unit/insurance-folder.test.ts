import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/dms/types";
import { categoryForFolderName } from "@/lib/dms/validation";
import { createWorkspaceStore } from "@/lib/dms/memory/workspace";

describe("the Insurance folder", () => {
  it("is a document category with its own label, before Other", () => {
    expect(CATEGORIES).toContain("insurance");
    expect(CATEGORY_LABELS.insurance).toBe("Insurance");
    expect(CATEGORIES.indexOf("insurance")).toBeLessThan(CATEGORIES.indexOf("other"));
  });

  it("is one of the standard folders of a new workspace, and its documents default to the insurance category", () => {
    const folders = [...createWorkspaceStore().folders.values()];
    const insurance = folders.find((f) => f.name === "Insurance");
    expect(insurance).toMatchObject({ isSystem: true, defaultCategory: "insurance", color: "sky" });
    expect(folders.filter((f) => f.isSystem).map((f) => f.name)).toEqual(["Invoices", "Receipts", "Tax documents", "Contracts", "HR Documents", "Insurance"]);
  });

  it("is what a folder named for insurance holds", () => {
    expect(categoryForFolderName("Insurance")).toBe("insurance");
    expect(categoryForFolderName("Business insurance policies")).toBe("insurance");
    expect(categoryForFolderName("HR Documents")).toBe("hr");
    expect(categoryForFolderName("Holiday photos")).toBe("other");
  });
});
