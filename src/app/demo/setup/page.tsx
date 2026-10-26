import type { Metadata } from "next";
import { SetupPage } from "@/components/setup/setup-page";

export const metadata: Metadata = { title: "Back Office Setup" };

export default function DemoSetup() {
  return (
    <SetupPage base="/demo" preview="Demo: your choices are saved in this browser only and never leave it." />
  );
}
