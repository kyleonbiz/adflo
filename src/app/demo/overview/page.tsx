import type { Metadata } from "next";
import { ModuleNav } from "@/components/modules/module-nav";
import { ModuleOverview } from "@/components/modules/module-overview";

export const metadata: Metadata = { title: "Overview" };

export default function DemoOverview() {
  return (
    <>
      <ModuleNav base="/demo" active="overview" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6"><ModuleOverview base="/demo" /></main>
    </>
  );
}
