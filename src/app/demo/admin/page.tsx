import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";

export const metadata: Metadata = { title: "Admin Support" };

export default function DemoAdmin() {
  return (
    <AdminPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and nothing is emailed." />
  );
}
