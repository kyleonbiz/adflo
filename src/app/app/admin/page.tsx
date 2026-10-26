import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Admin Support" };
export const dynamic = "force-dynamic";

export default function AdminRoute() {
  return renderAppShell("/app/admin", () => (
    <AdminPage preview="Sample data that lives only in this browser tab. Nothing is saved and nothing is emailed." />
  ));
}
