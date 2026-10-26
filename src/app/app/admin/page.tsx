import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Admin Support" };
export const dynamic = "force-dynamic";

export default async function AdminRoute({ searchParams }: PageProps<"/app/admin">) {
  const { new: startNew } = await searchParams;
  return renderAppShell("/app/admin", () => (
    <AdminPage startNew={startNew === "1"} preview="Sample data that lives only in this browser tab. Nothing is saved and nothing is emailed." />
  ));
}
