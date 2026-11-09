import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Tasks" };
export const dynamic = "force-dynamic";

export default async function ProjectsRoute({ searchParams }: PageProps<"/app/projects">) {
  const params = await searchParams;
  const { q, view } = params;
  const startNew = params.new === "1";
  const draft = startNew ? draftFromParams("projects", (k) => (typeof params[k] === "string" ? (params[k] as string) : undefined)) : undefined;
  return renderAppShell("/app/projects", () => (
    <ProjectsPage key={view === "projects" ? "projects" : "tasks"} initialQuery={typeof q === "string" ? q : ""} initialView={view === "projects" || startNew ? "projects" : "tasks"} startNew={startNew} draft={draft} preview="Records are saved in this browser only, not shared with other people or devices. No notifications are sent." />
  ));
}
