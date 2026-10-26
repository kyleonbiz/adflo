import type { Metadata } from "next";
import { ContactsPage } from "@/components/contacts/contacts-page";
import { ModuleNav } from "@/components/modules/module-nav";

export const metadata: Metadata = { title: "CRM & Data" };

export default function DemoContacts() {
  return (
    <>
      <ModuleNav base="/demo" active="crm" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <ContactsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved, and imported files never leave your browser." />
      </main>
    </>
  );
}
