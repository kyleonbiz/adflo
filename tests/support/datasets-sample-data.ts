import type { Column } from "@/lib/datasets/types";

/** A deliberately messy expense export: mixed money and date formats, a blank vendor, a bad amount, a repeated row. */
export const SAMPLE_NAME = "Q3 expenses";
export const SAMPLE_CSV = [
  "Date,Vendor,Category,Amount,Notes",
  "07/03/2026,Acme Office Supply,Supplies,\"$1,240.50\",Printer paper",
  "2026-07-15,Globex Software,Software,899,Annual license",
  "07/21/2026,Hooli Logistics,Shipping,(150.25),Refund",
  "08/02/2026,Acme Office Supply,Supplies,310.00,",
  "08/09/2026,,Travel,420.75,Missing vendor",
  "08/14/2026,Initech Staffing,Services,\"2,500.00\",Contract work",
  "08/14/2026,Initech Staffing,Services,\"2,500.00\",Contract work",
  "08/30/2026,Globex Software,Software,n/a,Amount to be confirmed",
  "09/05/2026,Hooli Logistics,Shipping,212.40,",
  "09/18/2026,Acme Office Supply,Supplies,95.99,Toner",
  "09/27/2026,Initech Staffing,Services,\"1,800.00\",Contract work",
].join("\n");

/** The sample's column rules: types are guessed from the data; the vendor is required. */
export function sampleColumnRules(columns: Column[]): Column[] {
  return columns.map((c) => (c.name === "Vendor" ? { ...c, required: true } : c));
}
