import { describe, expect, it } from "vitest";
import { parseDate, parseLicenseText, withIssueDate } from "@/lib/licenses/parse";

describe("parseDate", () => {
  it.each([
    ["2027-03-05", "2027-03-05"],
    ["3/5/2027", "2027-03-05"],
    ["03-05-27", "2027-03-05"],
    ["25/12/2026", "2026-12-25"],
    ["March 5, 2027", "2027-03-05"],
    ["Sept. 9th, 2027", "2027-09-09"],
    ["5 March 2027", "2027-03-05"],
  ])("reads %s", (input, expected) => expect(parseDate(input)).toBe(expected));
  it.each(["2027-02-30", "13/13/2027", "soon", "Marchh 5 2027x"])("rejects %s", (input) => expect(parseDate(input)).toBeNull());
});

describe("parseLicenseText", () => {
  it("reads a typical business license", () => {
    const text = [
      "STATE BUSINESS LICENSE",
      "Secretary of State",
      "License No: BL-2024-88213",
      "Issued to: Aurum Ventura Enterprise LLC",
      "Issued by: Secretary of State, Business Division",
      "Date Issued: 03/05/2026",
      "Expiration Date: March 5, 2027",
    ].join("\n");
    expect(parseLicenseText(text)).toEqual({
      name: "STATE BUSINESS LICENSE",
      category: "business",
      number: "BL-2024-88213",
      holder: "Aurum Ventura Enterprise LLC",
      issuer: "Secretary of State, Business Division",
      issuedOn: "2026-03-05",
      expiresOn: "2027-03-05",
    });
  });

  it("reads an insurance certificate", () => {
    const r = parseLicenseText("Certificate of Insurance\nPolicy Number: GL-77-140992\nInsured: Acme LLC\nInsurer: Northfield Mutual\nPolicy period end: 2027-01-15");
    expect(r).toMatchObject({ category: "insurance", number: "GL-77-140992", holder: "Acme LLC", issuer: "Northfield Mutual", expiresOn: "2027-01-15" });
  });

  it("only reports what it finds and never invents values", () => {
    expect(parseLicenseText("Meeting notes for Tuesday. Bring snacks.")).toEqual({});
  });

  it("does not take a word as the license number", () => {
    expect(parseLicenseText("License number is valid in this state").number).toBeUndefined();
  });

  it("ignores an issue date that is not before the expiry", () => {
    const r = parseLicenseText("Issued: 2028-01-01\nExpires: 2027-01-01");
    expect(r.issuedOn).toBeUndefined();
    expect(r.expiresOn).toBe("2027-01-01");
  });
});

describe("withIssueDate", () => {
  it("backs the issue date off one term from the expiry when it was not found", () => {
    expect(withIssueDate({ expiresOn: "2027-03-05" }).issuedOn).toBe("2026-03-05");
    expect(withIssueDate({ expiresOn: "2027-03-05" }, 24).issuedOn).toBe("2025-03-05");
  });
  it("leaves a found issue date alone", () => {
    expect(withIssueDate({ issuedOn: "2026-06-01", expiresOn: "2027-03-05" }).issuedOn).toBe("2026-06-01");
  });
});
