import type { Metadata } from "next";
import { ContactsPage } from "@/components/contacts/contacts-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "CRM & Data" };
export const dynamic = "force-dynamic";

export default async function ContactsRoute({ searchParams }: PageProps<"/app/contacts">) {
  const { q } = await searchParams;
  return renderAppShell("/app/contacts", () => (
    <ContactsPage initialQuery={typeof q === "string" ? q : ""} preview="Records live only in this browser tab. Nothing is saved, and imported files never leave your browser." />
  ));
}
