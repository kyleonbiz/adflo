import type { Metadata } from "next";
import { FormsPage } from "@/components/forms/forms-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Forms & Paperwork" };
export const dynamic = "force-dynamic";

export default async function FormsRoute({ searchParams }: PageProps<"/app/forms">) {
  const { q } = await searchParams;
  return renderAppShell("/app/forms", () => (
    <FormsPage initialQuery={typeof q === "string" ? q : ""} preview="Records live only in this browser tab. Nothing is saved and no notifications are sent." />
  ));
}
