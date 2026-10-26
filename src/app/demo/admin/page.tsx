import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { ModuleNav } from "@/components/modules/module-nav";

export const metadata: Metadata = { title: "Admin Support" };

export default function DemoAdmin() {
  return (
    <>
      <ModuleNav base="/demo" active="admin" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <AdminPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and nothing is emailed." />
      </main>
    </>
  );
}
