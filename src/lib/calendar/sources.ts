"use client";

import { useEffect, useMemo, useState } from "react";
import { createHttpApi } from "@/lib/dms/client/http-api";
import { e2eSeed } from "@/lib/e2e-seed";
import type { Equipment } from "@/lib/equipment/types";
import { useStoredRecords } from "@/lib/records/storage";
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
export function useCalendarSources(today: string | null, live = false): CalendarSources {
  const setup = useSetupConfig();
  const reminders = useReminders();
  const documents = useDocumentExpiries(live);
  const equipment = useStoredRecords<Equipment>("equipment");
  return useMemo(() => {
    if (!today) return { invoices: [], licenses: [], projects: [], vendors: [], reminders: [], documents: [] };
    const starters = installedLicenses(setup?.completedOn ? setup.templates : [], today);
    const industry = industryLicenses(setup, today).filter((l) => !starters.some((s) => s.name.toLowerCase() === l.name.toLowerCase()));
    return {
      invoices: e2eSeed<Invoice>("invoices") ?? [],
      licenses: [...(e2eSeed<License>("licenses") ?? []), ...starters, ...industry],
      projects: e2eSeed<Project>("projects") ?? [],
      vendors: e2eSeed<Vendor>("vendors") ?? [],
      reminders,
      documents,
      equipment: equipment ?? e2eSeed<Equipment>("equipment") ?? [],
    };
  }, [today, setup, reminders, documents, equipment]);
}

const emptyDocs: NonNullable<CalendarSources["documents"]> = [];

/** Documents that have an expiration date, read from the workspace when signed in. Quietly empty if they cannot be read. */
function useDocumentExpiries(live: boolean): NonNullable<CalendarSources["documents"]> {
  const [docs, setDocs] = useState(emptyDocs);
  useEffect(() => {
    if (!live) return;
    let off = false;
    (async () => {
      try {
        const api = createHttpApi("live");
        const found: typeof emptyDocs = [];
        for (let page = 1; page <= 10; page++) {
          const r = await api.listDocuments({ view: "all", folderId: null, search: "", category: null, fileType: null, tag: null, sort: "newest", page, pageSize: 100 });
          for (const d of r.items) if (d.expiresAt) found.push({ id: d.id, name: d.displayName, expiresOn: d.expiresAt.slice(0, 10) });
          if (page * r.pageSize >= r.total) break;
        }
        if (!off) setDocs(found);
      } catch { /* the calendar still shows everything else */ }
    })();
    return () => { off = true; };
  }, [live]);
  return docs;
}
