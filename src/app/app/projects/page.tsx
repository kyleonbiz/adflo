import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import { draftFromParams } from "@/lib/assistant/guardrails";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";

export default async function ProjectsRoute({ searchParams }: PageProps<"/app/projects">) {
  const params = await searchParams;
  const { q } = params;
  const startNew = params.new === "1";
  const draft = startNew ? draftFromParams("projects", (k) => (typeof params[k] === "string" ? (params[k] as string) : undefined)) : undefined;
  return renderAppShell("/app/projects", () => (
    <ProjectsPage startNew={startNew} draft={draft} initialQuery={typeof q === "string" ? q : ""} preview="Records live only in this browser tab. Nothing is saved and no notifications are sent." />
  ));
}
