import type { Metadata } from "next";
import { ContactsPage } from "@/components/contacts/contacts-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "CRM & Data" };
export const dynamic = "force-dynamic";

export default function ContactsRoute() {
  return renderAppShell("crm", "/app/contacts", () => (
    <ContactsPage preview="Preview data: contacts you add, import or change here are not saved yet. Saving arrives when the database is connected." />
  ));
}
