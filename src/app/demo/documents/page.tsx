import type { Metadata } from "next";
import { DemoWorkspace } from "@/components/marketing/demo-workspace";

export const metadata: Metadata = { title: "Documents" };

export default function DemoDocuments() {
  return <DemoWorkspace />;
}
