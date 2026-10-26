import type { Metadata } from "next";
import { FormsPage } from "@/components/forms/forms-page";
import { ModuleNav } from "@/components/modules/module-nav";

export const metadata: Metadata = { title: "Forms & Paperwork" };

export default function DemoForms() {
  return (
    <>
      <ModuleNav base="/demo" active="forms" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <FormsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no notifications are sent." />
      </main>
    </>
  );
}
