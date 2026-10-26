import type { Metadata } from "next";
import { ModuleOverview } from "@/components/modules/module-overview";

export const metadata: Metadata = { title: "Overview" };

export default function DemoOverview() {
  return <ModuleOverview base="/demo" />;
}
