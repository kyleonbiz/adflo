"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, FileWarning, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { licenseStatus, renewalTasks, renewLicense, summarize } from "@/lib/licenses/logic";
import { e2eSeed } from "@/lib/e2e-seed";
import { LICENSE_CATEGORIES, type License, type LicenseStatus, type RenewalStage } from "@/lib/licenses/types";
import type { LicenseFormValues } from "@/lib/licenses/validation";
import { useSetupConfig } from "@/lib/setup/storage";
import { installedLicenses } from "@/lib/setup/templates";
import { LicenseCard, type LicenseActions } from "./license-card";
import { LicenseFormDialog } from "./license-form-dialog";
import { SEVERITY_BADGE, STAGE_LABEL, STATUS_LABEL } from "./status";

const newId = () => `lic-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Licenses & Renewals. Records live in this component's state (starting empty) until the
 * database is connected, so nothing here is saved between visits.
 */
export function LicensesPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [edited, setEdited] = useState<License[] | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LicenseStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formFor, setFormFor] = useState<License | "new" | null>(null);
  const [deleting, setDeleting] = useState<License | null>(null);
  const [notice, setNotice] = useState("");

  const setup = useSetupConfig();
  // Starter records installed by Back Office Setup (only once setup is finished) sit alongside your own records.
  const licenses = useMemo(
    () => edited ?? (today ? [...(e2eSeed<License>("licenses") ?? []), ...installedLicenses(setup?.completedOn ? setup.templates : [], today)] : []),
    [edited, today, setup],
  );

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const update = (fn: (all: License[]) => License[]) => setEdited(fn(licenses));
  const patch = (id: string, change: (l: License) => License) => update((all) => all.map((l) => (l.id === id ? change(l) : l)));

  const actions: LicenseActions = {
    onEdit: (l) => setFormFor(l),
    onDelete: (l) => setDeleting(l),
    onRenew: (l) => {
      const renewed = renewLicense(l, today);
      patch(l.id, () => renewed);
      setNotice(`${l.name} renewed. New expiry ${formatDayLong(renewed.expiresOn)}.`);
    },
    onStage: (l, stage: RenewalStage) => {
      patch(l.id, (x) => ({ ...x, stage }));
      setNotice(`${l.name}: renewal ${STAGE_LABEL[stage].toLowerCase()}.`);
    },
    onToggleDocument: (l, id) =>
      patch(l.id, (x) => ({ ...x, requiredDocuments: x.requiredDocuments.map((d) => (d.id === id ? { ...d, received: !d.received } : d)) })),
    onAddDocument: (l, label) =>
      patch(l.id, (x) => ({ ...x, requiredDocuments: [...x.requiredDocuments, { id: `${x.id}-d${Math.random().toString(36).slice(2, 8)}`, label, received: false }] })),
    onRemoveDocument: (l, id) =>
      patch(l.id, (x) => ({ ...x, requiredDocuments: x.requiredDocuments.filter((d) => d.id !== id) })),
  };

  const saveForm = (values: LicenseFormValues) => {
    const category = values.category as License["category"];
    if (formFor && formFor !== "new") {
      patch(formFor.id, (x) => ({ ...x, ...values, category }));
      setNotice(`${values.name} updated.`);
    } else {
      update((all) => [...all, { ...values, category, id: newId(), stage: "not_started", requiredDocuments: [] }]);
      setNotice(`${values.name} added.`);
    }
  };

  const summary = summarize(licenses, today);
  const tasks = renewalTasks(licenses, today);
  const q = query.trim().toLowerCase();
  const visible = licenses
    .filter((l) => statusFilter === "all" || licenseStatus(l, today) === statusFilter)
    .filter((l) => categoryFilter === "all" || l.category === categoryFilter)
    .filter((l) => !q || [l.name, l.issuer, l.number, l.holder].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => (a.expiresOn < b.expiresOn ? -1 : a.expiresOn > b.expiresOn ? 1 : 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licenses &amp; Renewals</h1>
          <p className="text-sm text-muted-foreground">Track expiry dates, collect required documents and stay ahead of every renewal.</p>
        </div>
        <Button onClick={() => setFormFor("new")}><Plus /> Add license</Button>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <p role="status" aria-live="polite" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile icon={ShieldCheck} label="Active" value={summary.active} tone="text-emerald-600" />
        <SummaryTile icon={CalendarClock} label="Expiring in 30 days" value={summary.expiring} tone="text-amber-600" />
        <SummaryTile icon={AlertTriangle} label="Expired" value={summary.expired} tone="text-red-600" />
        <SummaryTile icon={FileWarning} label="Documents missing" value={summary.missingDocuments} tone="text-primary" />
      </section>

      <section aria-labelledby="tasks-heading" className="rounded-2xl border bg-card p-4 shadow-panel">
        <h2 id="tasks-heading" className="text-base font-semibold">Renewal tasks</h2>
        {tasks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing to renew right now. Tasks appear automatically when a license enters its renewal window.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {tasks.map((t) => (
              <li key={t.licenseId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{t.title}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{STAGE_LABEL[t.stage]}</Badge>
                  <Badge variant={SEVERITY_BADGE[t.severity]}>
                    {t.daysLeft < 0 ? `${-t.daysLeft} days overdue` : `due ${formatDayLong(t.dueOn)}`}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Licenses" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, issuer, number or holder"
              aria-label="Search licenses"
              className="pl-9"
            />
          </div>
          <div className="sm:w-48">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as LicenseStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-52">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Filter by category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {LICENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {licenses.length === 0 ? "No licenses yet. Add your first one to start tracking renewals." : "No licenses match these filters."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((l) => <LicenseCard key={l.id} license={l} today={today} actions={actions} />)}
          </ul>
        )}
      </section>

      <LicenseFormDialog
        open={formFor !== null}
        license={formFor && formFor !== "new" ? formFor : undefined}
        today={today}
        onOpenChange={(o) => !o && setFormFor(null)}
        onSubmit={saveForm}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent variant="alert">
          <DialogTitle>Delete license?</DialogTitle>
          <DialogDescription className="mt-1">
            {deleting?.name} and its reminders will be removed.
          </DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) {
                  update((all) => all.filter((l) => l.id !== deleting.id));
                  setNotice(`${deleting.name} deleted.`);
                }
                setDeleting(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

