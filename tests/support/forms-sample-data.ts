import { addDays } from "@/lib/dates";
import type { Submission } from "@/lib/forms/types";

import { layoutTemplate } from "@/lib/forms/layout";
import { starterForms } from "@/lib/forms/starter-forms";
import type { FormField, FormTemplate } from "@/lib/forms/types";

const fld = (id: string, label: string, type: FormField["type"], required = true, options: string[] = []): FormField => ({ id, label, type, required, options });
const vendorFields = [
  fld("v-name", "Company name", "text"), fld("v-contact", "Contact email", "email"),
  fld("v-service", "Service category", "select", true, ["Supplies", "Software", "Professional services", "Other"]),
  fld("v-spend", "Expected annual spend", "number", false), fld("v-w9", "W-9 on file", "checkbox", false), fld("v-notes", "Notes", "longtext", false),
];
/** A general-purpose example form for the form logic tests. It is not offered in the app (vendors have their own section). */
export const exampleForm = (): FormTemplate => ({
  id: "form-vendor", name: "New vendor intake", description: "Collect the basics before you start working with a supplier.", sentCount: 0,
  fields: vendorFields, documentTemplate: layoutTemplate("Collect the basics before you start working with a supplier.", vendorFields),
});
/** The app's starter forms plus the example form. */
export const sampleForms = (): FormTemplate[] => [exampleForm(), ...starterForms()];

/** Sample submissions with dates relative to `today`. */
export function sampleSubmissions(today: string): Submission[] {
  return [
    { id: "s-1", formId: "form-vendor", submittedBy: "Dana Whitfield", submittedOn: addDays(today, -2), status: "new",
      values: { "v-name": "Acme Office Supply", "v-contact": "orders@acme.example", "v-service": "Supplies", "v-spend": "12000", "v-w9": "true", "v-notes": "Net 30 terms." } },
    { id: "s-2", formId: "form-vendor", submittedBy: "Dana Whitfield", submittedOn: addDays(today, -9), status: "done",
      values: { "v-name": "Globex Software", "v-contact": "sales@globex.example", "v-service": "Software", "v-spend": "4800", "v-w9": "true", "v-notes": "" } },
    { id: "s-3", formId: "form-visitor", submittedBy: "Marta Gill", submittedOn: addDays(today, -1), status: "new",
      values: { "vs-name": "Marta Gill", "vs-date": addDays(today, -1), "vs-host": "Dana Whitfield", "vs-purpose": "Meeting", "vs-notes": "Dropped off the signed forms." } },
    { id: "s-4", formId: "form-visitor", submittedBy: "Kyle Fulwood", submittedOn: addDays(today, -12), status: "done",
      values: { "vs-name": "Kyle Fulwood", "vs-date": addDays(today, -12), "vs-host": "Dana Whitfield", "vs-purpose": "Inspection", "vs-notes": "" } },
    { id: "s-5", formId: "form-feedback", submittedBy: "Northwind Traders", submittedOn: addDays(today, -4), status: "new",
      values: { "c-name": "Pat Lee", "c-score": "9", "c-comments": "Fast and thorough." } },
  ];
}
