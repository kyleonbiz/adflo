import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Admin Support" };
export const dynamic = "force-dynamic";

export default function AdminRoute() {
  return renderAppShell("admin", "/app/admin", () => (
    <AdminPage preview="Preview data: requests and recurring tasks you add or change here are not saved yet, and nothing is emailed. Saving arrives when the database is connected." />
  ));
}
