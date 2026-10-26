import { addDays } from "@/lib/dates";
import type { Submission } from "@/lib/forms/types";

export { starterForms as sampleForms } from "@/lib/forms/starter-forms";

/** Sample submissions with dates relative to `today`. */
export function sampleSubmissions(today: string): Submission[] {
  const base = { decidedBy: null, decidedOn: null, comment: "" };
  return [
    { ...base, id: "s-1", formId: "form-vendor", submittedBy: "Dana Whitfield", submittedOn: addDays(today, -2), status: "pending",
      values: { "v-name": "Acme Office Supply", "v-contact": "orders@acme.example", "v-service": "Supplies", "v-spend": "12000", "v-w9": "true", "v-notes": "Net 30 terms." } },
    { ...base, id: "s-2", formId: "form-vendor", submittedBy: "Dana Whitfield", submittedOn: addDays(today, -9), status: "approved",
      decidedBy: "Operations manager", decidedOn: addDays(today, -7), comment: "Approved for FY26.",
      values: { "v-name": "Globex Software", "v-contact": "sales@globex.example", "v-service": "Software", "v-spend": "4800", "v-w9": "true", "v-notes": "" } },
    { ...base, id: "s-3", formId: "form-leave", submittedBy: "Marta Gill", submittedOn: addDays(today, -1), status: "pending",
      values: { "l-name": "Marta Gill", "l-from": addDays(today, 14), "l-to": addDays(today, 18), "l-type": "Vacation", "l-reason": "Family trip." } },
    { ...base, id: "s-4", formId: "form-leave", submittedBy: "Kyle Fulwood", submittedOn: addDays(today, -12), status: "rejected",
      decidedBy: "Priya Shah", decidedOn: addDays(today, -11), comment: "Overlaps the quarter-end close.",
      values: { "l-name": "Kyle Fulwood", "l-from": addDays(today, -5), "l-to": addDays(today, -3), "l-type": "Personal", "l-reason": "" } },
    { ...base, id: "s-5", formId: "form-feedback", submittedBy: "Northwind Traders", submittedOn: addDays(today, -4), status: "received",
      values: { "c-name": "Pat Lee", "c-score": "9", "c-comments": "Fast and thorough." } },
  ];
}
