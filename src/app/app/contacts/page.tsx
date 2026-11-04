import type { Metadata } from "next";
import { ContactsPage } from "@/components/contacts/contacts-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "CRM & Data" };
export const dynamic = "force-dynamic";

export default async function ContactsRoute({ searchParams }: PageProps<"/app/contacts">) {
  const { q, new: startNew, name, email } = await searchParams;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const prefill = startNew === "1" ? { name: text(name, 120), email: text(email, 254), category: "Customer" as const } : undefined;
  return renderAppShell("/app/contacts", () => (
    <ContactsPage initialQuery={typeof q === "string" ? q : ""} prefill={prefill} preview="Records live only in this browser tab. Nothing is saved, and imported files never leave your browser." />
  ));
}
