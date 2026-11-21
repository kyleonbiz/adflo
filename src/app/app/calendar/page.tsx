import type { Metadata } from "next";
import { CalendarPage } from "@/components/calendar/calendar-page";
import { renderAppShell } from "@/lib/app-shell";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default function CalendarRoute() {
  return renderAppShell("/app/calendar", (mode) => (
    <CalendarPage live={mode === "live"} preview={mode === "preview" ? "Dates come from the records in this browser. They are not shared with other people or devices yet." : undefined} />
  ));
}
