import type { Metadata } from "next";
import { FilesPage } from "@/components/files/files-page";

export const metadata: Metadata = { title: "Business File Reset" };

export default function DemoFileReset() {
  return (
    <FilesPage preview="Demo: files are read in your browser and never uploaded. Nothing on your computer is changed: you download a plan and scripts to run yourself." />
  );
}
