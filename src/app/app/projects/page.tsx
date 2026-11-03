import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function ProjectsRoute({ searchParams }: PageProps<"/app/projects">) {
  const { q, view } = await searchParams;
  return renderAppShell("/app/projects", () => (
    <ProjectsPage initialQuery={typeof q === "string" ? q : ""} initialView={view === "projects" ? "projects" : "tasks"} preview="Records live only in this browser tab. Nothing is saved and no notifications are sent." />
  ));
}
