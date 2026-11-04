"use client";

import { useMemo } from "react";
import { e2eSeed } from "@/lib/e2e-seed";
import type { Invoice } from "@/lib/invoices/types";
import type { License } from "@/lib/licenses/types";
import type { Project } from "@/lib/projects/types";
import { useReminders } from "@/lib/reminders/storage";
import { industryLicenses } from "@/lib/setup/industries";
import { useSetupConfig } from "@/lib/setup/storage";
import { installedLicenses } from "@/lib/setup/templates";
import type { Vendor } from "@/lib/vendors/types";
import type { CalendarSources } from "./logic";

/**
 * The records the calendar shows, gathered the same way each service gathers its own starting records.
 * Until a database is connected, a service keeps what you add only while its page is open, so the calendar
 * shows the starter records from Settings, the industry's records, and your reminders.
 */
export function useCalendarSources(today: string | null): CalendarSources {
  const setup = useSetupConfig();
  const reminders = useReminders();
  return useMemo(() => {
    if (!today) return { invoices: [], licenses: [], projects: [], vendors: [], reminders: [] };
    const starters = installedLicenses(setup?.completedOn ? setup.templates : [], today);
    const industry = industryLicenses(setup, today).filter((l) => !starters.some((s) => s.name.toLowerCase() === l.name.toLowerCase()));
    return {
      invoices: e2eSeed<Invoice>("invoices") ?? [],
      licenses: [...(e2eSeed<License>("licenses") ?? []), ...starters, ...industry],
      projects: e2eSeed<Project>("projects") ?? [],
      vendors: e2eSeed<Vendor>("vendors") ?? [],
      reminders,
    };
  }, [today, setup, reminders]);
}
