import type { Metadata } from "next";
import { ContactsPage } from "@/components/contacts/contacts-page";
import { personFromParams } from "@/lib/bridge";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Contacts" };
export const dynamic = "force-dynamic";

export default async function ContactsRoute({ searchParams }: PageProps<"/app/contacts">) {
  const params = await searchParams;
  const { q } = params;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : undefined);
  const person = params.add === "1" ? { ...personFromParams(one), ...draftFromParams("contacts", one) } : undefined;
  return renderAppShell("/app/contacts", () => (
    <ContactsPage initialAdd={person} initialQuery={typeof q === "string" ? q : ""} preview="Records live only in this browser tab. Nothing is saved, and imported files never leave your browser." />
  ));
}
