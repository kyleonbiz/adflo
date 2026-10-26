import type { Metadata } from "next";
import { FormsPage } from "@/components/forms/forms-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Forms & Paperwork" };
export const dynamic = "force-dynamic";

export default function FormsRoute() {
  return renderAppShell("forms", "/app/forms", () => (
    <FormsPage preview="Preview data: forms and submissions you add or change here are not saved yet, and no notifications are sent. Saving arrives when the database is connected." />
  ));
}
