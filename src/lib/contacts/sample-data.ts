import { addDays } from "@/lib/dates";
import type { Contact } from "./types";

export function sampleContacts(today: string): Contact[] {
  const c = (id: string, name: string, email: string, phone: string, company: string, category: Contact["category"], ago: number, notes = ""): Contact =>
    ({ id, name, email, phone, company, category, notes, createdOn: addDays(today, -ago) });
  return [
    c("c-1", "Dana Whitfield", "dana@acme-office.example", "(555) 010-2200", "Acme Office Supply", "Vendor", 120),
    c("c-2", "Pat Lee", "pat@northwind.example", "(555) 010-7100", "Northwind Traders", "Customer", 90, "Prefers email."),
    c("c-3", "Priya Shah", "priya@contoso.example", "", "Contoso Ltd", "Customer", 60),
    c("c-4", "Marta Gill", "", "(555) 010-9900", "Fabrikam Inc", "Lead", 30),
    c("c-5", "Hank Scorpio", "hank@globex.example", "", "Globex Software", "Partner", 25),
    c("c-6", "Patrick Lee", "pat@northwind.example", "", "Northwind Traders", "Customer", 4, "Added from the website form."),
    c("c-7", "Sam Rivera", "", "", "", "Lead", 2),
  ];
}
