import { describe, expect, it } from "vitest";
import { billFileName, extractBill } from "@/lib/dms/bill";

const INVOICE = `Acme Supply Co
123 Main Street
INVOICE
Invoice Number: INV-1042
Invoice Date: 11/04/2026
Due Date: December 4, 2026
Bill To: Northwind Roofing
Roofing nails        10   $12.00   $120.00
Subtotal $120.00
Tax $9.60
Total $129.60
Amount Due: $1,129.60`;

describe("extractBill", () => {
  it("reads who it is from, number, dates and the amount due", () => {
    expect(extractBill(INVOICE)).toEqual({ from: "Acme Supply Co", number: "INV-1042", issuedOn: "2026-11-04", dueOn: "2026-12-04", totalCents: 112960 });
  });

  it("uses the labelled sender, and a plain total on a receipt", () => {
    const b = extractBill("Receipt #88231\nFrom: Home Depot\nDate: 2026-11-10\nSubtotal $40.00\nTotal $43.20\nPaid in full");
    expect(b).toMatchObject({ from: "Home Depot", number: "88231", issuedOn: "2026-11-10", totalCents: 4320, dueOn: null });
  });

  it("never mistakes a subtotal for the total, or a plain word for a number", () => {
    expect(extractBill("Subtotal $50.00\nsome notes about the invoice")).toBeNull();
    expect(extractBill("Invoice number: pending\nAmount due $75.00")).toMatchObject({ number: null, totalCents: 7500 });
  });

  it("returns null for text that is not a bill", () => {
    expect(extractBill("Remember to call the supplier next week about the delivery.")).toBeNull();
    expect(extractBill("")).toBeNull();
  });
});

describe("billFileName", () => {
  it("names the file from what it says, with no characters a file name cannot hold", () => {
    expect(billFileName({ from: "Acme/Supply: Co", number: "INV-1042", issuedOn: "2026-11-04", dueOn: null, totalCents: 1 }, "invoice")).toBe("Acme Supply Co - Invoice INV-1042 - 2026-11-04");
    expect(billFileName({ from: null, number: "9", issuedOn: null, dueOn: null, totalCents: 1 }, "receipt")).toBeNull();
  });
});
