import { addDays } from "@/lib/dates";
import type { FormField, FormTemplate, Submission } from "./types";

const f = (id: string, label: string, type: FormField["type"], required = true, options: string[] = []): FormField => ({
  id, label, type, required, options,
});

export function sampleForms(): FormTemplate[] {
  return [
    {
      id: "form-vendor", name: "New vendor intake", description: "Collect the basics before a supplier is approved.",
      requiresApproval: true, approver: "Operations manager",
      fields: [
        f("v-name", "Company name", "text"), f("v-contact", "Contact email", "email"),
        f("v-service", "Service category", "select", true, ["Supplies", "Software", "Professional services", "Other"]),
        f("v-spend", "Expected annual spend", "number", false), f("v-w9", "W-9 on file", "checkbox", false),
        f("v-notes", "Notes", "longtext", false),
      ],
      documentTemplate: "Vendor: {{Company name}}\nContact: {{Contact email}}\nCategory: {{Service category}}\nExpected annual spend: {{Expected annual spend}}\nW-9 on file: {{W-9 on file}}\n\nNotes:\n{{Notes}}",
    },
    {
      id: "form-leave", name: "Time-off request", description: "Request leave for approval.",
      requiresApproval: true, approver: "Priya Shah",
      fields: [
        f("l-name", "Employee name", "text"), f("l-from", "First day off", "date"), f("l-to", "Last day off", "date"),
        f("l-type", "Type", "select", true, ["Vacation", "Sick", "Personal"]), f("l-reason", "Reason", "longtext", false),
      ],
      documentTemplate: "",
    },
    {
      id: "form-feedback", name: "Client feedback", description: "Short survey sent after a project closes.",
      requiresApproval: false, approver: "",
      fields: [f("c-name", "Your name", "text", false), f("c-score", "Score (1-10)", "number"), f("c-comments", "Comments", "longtext", false)],
      documentTemplate: "",
    },
  ];
}

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
