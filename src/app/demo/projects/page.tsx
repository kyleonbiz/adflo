import type { Metadata } from "next";
import { ModuleNav } from "@/components/modules/module-nav";
import { ProjectsPage } from "@/components/projects/projects-page";

export const metadata: Metadata = { title: "Projects" };

export default function DemoProjects() {
  return (
    <>
      <ModuleNav base="/demo" active="projects" />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">
        <ProjectsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no notifications are sent." />
      </main>
    </>
  );
}
