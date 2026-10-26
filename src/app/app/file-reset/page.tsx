import type { Metadata } from "next";
import { FilesPage } from "@/components/files/files-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Tidy up files" };
export const dynamic = "force-dynamic";

export default function FileResetRoute() {
  return renderAppShell("/app/file-reset", () => (
    <FilesPage preview="Files are read in your browser and never uploaded. Nothing on your computer is changed: you download a plan and scripts to run yourself." />
  ));
}
