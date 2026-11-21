import { layoutTemplate } from "./layout";
import type { FormField, FormTemplate } from "./types";

const f = (id: string, label: string, type: FormField["type"], required = true, options: string[] = []): FormField => ({
  id, label, type, required, options,
});

/** The built-in form templates every workspace starts with. */
export function starterForms(): FormTemplate[] {
  const forms: FormTemplate[] = [
    {
      id: "form-visitor", name: "Visitor sign-in", description: "Record who visited, who they saw and why.",
      sentCount: 0,
      fields: [
        f("vs-name", "Visitor name", "text"), f("vs-date", "Visit date", "date"), f("vs-host", "Visiting", "text"),
        f("vs-purpose", "Purpose", "select", true, ["Meeting", "Delivery", "Inspection", "Other"]), f("vs-notes", "Notes", "longtext", false),
      ],
      documentTemplate: "",
    },
    {
      id: "form-feedback", name: "Client feedback", description: "Short survey sent after a project closes.",
      sentCount: 0,
      fields: [f("c-name", "Your name", "text", false), f("c-score", "Score (1-10)", "number"), f("c-comments", "Comments", "longtext", false)],
      documentTemplate: "",
    },
  ];
  // Forms without a layout of their own get the standard one, so every form makes a finished document.
  return forms.map((x) => (x.documentTemplate ? x : { ...x, documentTemplate: layoutTemplate(x.description, x.fields) }));
}
