export const CONTACT_CATEGORIES = ["Customer", "Lead", "Partner", "Vendor", "Other"] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  company: string;
  category: ContactCategory;
  notes: string;
}

export interface Contact extends ContactInput {
  id: string;
  createdOn: string;
}
