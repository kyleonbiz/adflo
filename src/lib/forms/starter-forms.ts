import type { FormField, FormTemplate } from "./types";

const f = (id: string, label: string, type: FormField["type"], required = true, options: string[] = []): FormField => ({
  id, label, type, required, options,
});

/** The built-in form templates every workspace starts with. */
export function starterForms(): FormTemplate[] {
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
