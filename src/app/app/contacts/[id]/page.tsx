import type { Metadata } from "next";
import { ContactProfile } from "@/components/profiles/contact-profile";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

export default async function ContactProfileRoute({ params }: PageProps<"/app/contacts/[id]">) {
  const { id } = await params;
  return renderAppShell(`/app/contacts/${id}`, () => <ContactProfile id={id} />);
}
