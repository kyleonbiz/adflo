import type { Metadata } from "next";
import { ModuleNav } from "@/components/modules/module-nav";
import { SetupPage } from "@/components/setup/setup-page";

export const metadata: Metadata = { title: "Back Office Setup" };

export default function DemoSetup() {
  return (
    <>
      <ModuleNav base="/demo" active="setup" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <SetupPage base="/demo" preview="Demo: your choices are saved in this browser only and never leave it." />
      </main>
    </>
  );
}
