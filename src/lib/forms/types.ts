export const FIELD_TYPES = [
  { value: "text", label: "Short text" },
  { value: "longtext", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
] as const;
export type FieldType = (typeof FIELD_TYPES)[number]["value"];

export interface FormField {
  id: string;
  /** Unique within a form (case-insensitive); also the `{{placeholder}}` name in the document template. */
  label: string;
  type: FieldType;
  required: boolean;
  /** Choices for a dropdown; empty for other types. */
  options: string[];
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  /** How many times this form has been sent (a link copied or an email opened). */
  sentCount: number;
  /** Text with `{{Field label}}` placeholders. Empty means the default layout. */
  documentTemplate: string;
}

/** A response is "new" until someone has dealt with it, then "done". */
export type SubmissionStatus = "new" | "done";

export interface Submission {
  id: string;
  formId: string;
  submittedBy: string;
  submittedOn: string;
  /** Field id -> text. Checkboxes are "true" or "false". */
  values: Record<string, string>;
  status: SubmissionStatus;
}
