import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default function ProjectsRoute() {
  return renderAppShell("/app/projects", () => (
    <ProjectsPage preview="Sample data that lives only in this browser tab. Nothing is saved and no notifications are sent." />
  ));
}
