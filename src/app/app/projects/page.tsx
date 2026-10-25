import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default function ProjectsRoute() {
  return renderAppShell("projects", "/app/projects", () => (
    <ProjectsPage preview="Preview data: projects and tasks you add or change here are not saved yet, and no notifications are sent. Saving arrives when the database is connected." />
  ));
}
