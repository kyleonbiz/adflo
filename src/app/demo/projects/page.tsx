import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";

export const metadata: Metadata = { title: "Projects" };

export default function DemoProjects() {
  return (
    <ProjectsPage preview="Demo: sample data that lives only in this browser tab. Nothing is saved and no notifications are sent." />
  );
}
