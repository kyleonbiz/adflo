import type { Metadata } from "next";
import { FilesPage } from "@/components/files/files-page";
import { ModuleNav } from "@/components/modules/module-nav";

export const metadata: Metadata = { title: "Business File Reset" };

export default function DemoFileReset() {
  return (
    <>
      <ModuleNav base="/demo" active="file-reset" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <FilesPage preview="Demo: files are read in your browser and never uploaded. Nothing on your computer is changed: you download a plan and scripts to run yourself." />
      </main>
    </>
  );
}
