import { addDays } from "@/lib/dates";
import type { Submission } from "@/lib/forms/types";

export { starterForms as sampleForms } from "@/lib/forms/starter-forms";

/** Sample submissions with dates relative to `today`. */
export function sampleSubmissions(today: string): Submission[] {
  return [
    { id: "s-1", formId: "form-vendor", submittedBy: "Dana Whitfield", submittedOn: addDays(today, -2), status: "new",
      values: { "v-name": "Acme Office Supply", "v-contact": "orders@acme.example", "v-service": "Supplies", "v-spend": "12000", "v-w9": "true", "v-notes": "Net 30 terms." } },
    { id: "s-2", formId: "form-vendor", submittedBy: "Dana Whitfield", submittedOn: addDays(today, -9), status: "done",
      values: { "v-name": "Globex Software", "v-contact": "sales@globex.example", "v-service": "Software", "v-spend": "4800", "v-w9": "true", "v-notes": "" } },
    { id: "s-3", formId: "form-leave", submittedBy: "Marta Gill", submittedOn: addDays(today, -1), status: "new",
      values: { "l-name": "Marta Gill", "l-from": addDays(today, 14), "l-to": addDays(today, 18), "l-type": "Vacation", "l-reason": "Family trip." } },
    { id: "s-4", formId: "form-leave", submittedBy: "Kyle Fulwood", submittedOn: addDays(today, -12), status: "done",
      values: { "l-name": "Kyle Fulwood", "l-from": addDays(today, -5), "l-to": addDays(today, -3), "l-type": "Personal", "l-reason": "" } },
    { id: "s-5", formId: "form-feedback", submittedBy: "Northwind Traders", submittedOn: addDays(today, -4), status: "new",
      values: { "c-name": "Pat Lee", "c-score": "9", "c-comments": "Fast and thorough." } },
  ];
}
