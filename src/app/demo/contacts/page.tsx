import type { Metadata } from "next";
import { ContactsPage } from "@/components/contacts/contacts-page";

export const metadata: Metadata = { title: "CRM & Data" };

export default function DemoContacts() {
  return (
    <ContactsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved, and imported files never leave your browser." />
  );
}
