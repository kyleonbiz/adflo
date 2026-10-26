import type { Metadata } from "next";
import { FormsPage } from "@/components/forms/forms-page";

export const metadata: Metadata = { title: "Forms & Paperwork" };

export default function DemoForms() {
  return (
    <FormsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no notifications are sent." />
  );
}
