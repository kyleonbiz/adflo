"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, FileWarning, Hourglass, Plus, Search, ShieldCheck, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/modules/summary-tile";
import { useToday } from "@/components/modules/use-today";
import { formatDayLong } from "@/lib/dates";
import { expiryText, licenseStatus, missingDocuments, needsReview, renewalTasks, renewLicense, summarize, type RenewalInput } from "@/lib/licenses/logic";
import { sampleLicenses } from "@/lib/licenses/sample-data";
import { LICENSE_CATEGORIES, type License, type LicenseStatus, type RenewalStage } from "@/lib/licenses/types";
import type { LicenseFormValues } from "@/lib/licenses/validation";
import { useSetupConfig } from "@/lib/setup/storage";
import { installedLicenses } from "@/lib/setup/templates";
import { LicenseCard, type LicenseActions } from "./license-card";
import { LICENSE_UPLOAD_ACCEPT } from "@/lib/licenses/upload";
import { LicenseFormDialog } from "./license-form-dialog";
import { RenewDialog } from "./renew-dialog";
import { SEVERITY_BADGE, STAGE_LABEL, STATUS_LABEL } from "./status";

const newId = () => `lic-${Math.random().toString(36).slice(2, 10)}`;

type Filter = "all" | "attention" | "missing_docs" | "needs_review" | LicenseStatus;
type Sort = "expiry" | "name";
const NOTICE_MS = 8000;

/**
 * Licenses & Renewals. Records live in this component's state (seeded with sample data) until the
 * database is connected, so nothing here is saved between visits.
 */
export function LicensesPage({ preview }: { preview?: string }) {
  const today = useToday();
  const [edited, setEdited] = useState<License[] | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("expiry");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formFor, setFormFor] = useState<License | "new" | null>(null);
  const [deleting, setDeleting] = useState<License | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formSession, setFormSession] = useState(0); // new key per opening, so notes from a previous upload never linger
  const [renewing, setRenewing] = useState<License | null>(null);
  const [focus, setFocus] = useState<{ id: string; token: number }>({ id: "", token: 0 });
  const [notice, setNotice] = useState<{ id: number; text: string; undo?: () => void } | null>(null);

  const setup = useSetupConfig();
  // Starter records installed by Back Office Setup (only once setup is finished) sit after the samples.
  const licenses = useMemo(
    () => edited ?? (today ? [...sampleLicenses(today), ...installedLicenses(setup?.completedOn ? setup.templates : [], today)] : []),
    [edited, today, setup],
  );

  // The confirmation fades on its own so it never lingers as stale text.
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);
  const say = useCallback((text: string, undo?: () => void) => setNotice({ id: Date.now(), text, undo }), []);

  if (!today) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  const openForm = (target: License | "new", file: File | null = null) => {
    setUploadFile(file);
    setFormSession((n) => n + 1);
    setFormFor(target);
  };
  const patch = (id: string, change: (l: License) => License) => setEdited(licenses.map((l) => (l.id === id ? change(l) : l)));
  /** Applies a change that can be undone from the confirmation. */
  const commit = (next: License[], text: string) => {
    const before = licenses;
    setEdited(next);
    say(text, () => { setEdited(before); setNotice(null); });
  };

  const confirmRenewal = (l: License, input: Required<RenewalInput>) => {
    const renewed = renewLicense(l, today, input);
    commit(licenses.map((x) => (x.id === l.id ? renewed : x)), `${l.name} renewed. New expiry ${formatDayLong(renewed.expiresOn)}.`);
    setRenewing(null);
  };

  const actions: LicenseActions = {
    onEdit: (l) => openForm(l),
    onDelete: (l) => setDeleting(l),
    onRenew: (l) => setRenewing(l),
    onStage: (l, stage: RenewalStage) =>
      commit(licenses.map((x) => (x.id === l.id ? { ...x, stage } : x)), `${l.name}: renewal ${STAGE_LABEL[stage].toLowerCase()}.`),
    onToggleDocument: (l, id) =>
      patch(l.id, (x) => ({ ...x, requiredDocuments: x.requiredDocuments.map((d) => (d.id === id ? { ...d, received: !d.received } : d)) })),
    onAddDocument: (l, label) =>
      patch(l.id, (x) => ({ ...x, requiredDocuments: [...x.requiredDocuments, { id: `${x.id}-d${Math.random().toString(36).slice(2, 8)}`, label, received: false }] })),
    onRemoveDocument: (l, id) =>
      patch(l.id, (x) => ({ ...x, requiredDocuments: x.requiredDocuments.filter((d) => d.id !== id) })),
  };

  const saveForm = (values: LicenseFormValues) => {
    const { documents, reviewed, ...fields } = values;
    if (!reviewed) return; // the form already refuses this; never save a license nobody checked
    const category = values.category as License["category"];
    if (formFor && formFor !== "new") {
      patch(formFor.id, (x) => ({ ...x, ...fields, category, verifiedOn: today }));
      say(`${values.name} updated.`);
    } else {
      const id = newId();
      const requiredDocuments = documents.map((label, i) => ({ id: `${id}-d${i}`, label, received: false }));
      setEdited([...licenses, { ...fields, category, id, stage: "not_started", requiredDocuments, verifiedOn: today }]);
      say(`${values.name} added.`);
    }
  };

  /** Clears the filters, then reveals a license's card (the renewal task list uses this). */
  const reveal = (id: string) => {
    setQuery(""); setStatusFilter("all"); setCategoryFilter("all");
    setFocus((f) => ({ id, token: f.token + 1 }));
  };
  const toggleFilter = (f: Filter) => setStatusFilter((cur) => (cur === f ? "all" : f));

  const summary = summarize(licenses, today);
  const tasks = renewalTasks(licenses, today);
  const q = query.trim().toLowerCase();
  const matchesFilter = (l: License) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "attention") return licenseStatus(l, today) !== "active";
    if (statusFilter === "missing_docs") return missingDocuments(l) > 0;
    if (statusFilter === "needs_review") return needsReview(l);
    return licenseStatus(l, today) === statusFilter;
  };
  const visible = licenses
    .filter(matchesFilter)
    .filter((l) => categoryFilter === "all" || l.category === categoryFilter)
    .filter((l) => !q || [l.name, l.issuer, l.number, l.holder].some((f) => f.toLowerCase().includes(q)))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.expiresOn < b.expiresOn ? -1 : a.expiresOn > b.expiresOn ? 1 : 0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licenses &amp; Renewals</h1>
          <p className="text-sm text-muted-foreground">Track expiry dates, collect required documents and stay ahead of every renewal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload /> Upload license
              <input
                type="file"
                accept={LICENSE_UPLOAD_ACCEPT}
                className="sr-only"
                aria-label="Upload a license file to add"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) openForm("new", f);
                }}
              />
            </label>
          </Button>
          <Button onClick={() => openForm("new")}><Plus /> Add license</Button>
        </div>
      </div>

      {preview && (
        <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{preview}</p>
      )}
      <div
        role="status"
        aria-live="polite"
        className={notice ? "fixed inset-x-4 bottom-4 z-40 flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-float sm:left-auto sm:max-w-md" : "sr-only"}
      >
        {notice && (
          <>
            <span>{notice.text}</span>
            <span className="flex shrink-0 items-center gap-1">
              {notice.undo && <Button size="sm" variant="outline" onClick={notice.undo}>Undo</Button>}
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>Dismiss</Button>
            </span>
          </>
        )}
      </div>

      {summary.needsReview > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" data-testid="review-banner">
          <span>
            {summary.needsReview === 1 ? "1 license still needs" : `${summary.needsReview} licenses still need`} review. Every license must be checked against its document before you rely on it.
          </span>
          <button type="button" className="font-medium underline" onClick={() => setStatusFilter("needs_review")}>Show them</button>
        </p>
      )}

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryTile icon={ShieldCheck} label="Active" value={summary.active} tone="text-emerald-600" pressed={statusFilter === "active"} onClick={() => toggleFilter("active")} />
        <SummaryTile icon={Hourglass} label="Renewal window" value={summary.renewalWindow} tone="text-sky-600" pressed={statusFilter === "renewal_window"} onClick={() => toggleFilter("renewal_window")} />
        <SummaryTile icon={CalendarClock} label="Expiring in 30 days" value={summary.expiring} tone="text-amber-600" pressed={statusFilter === "expiring"} onClick={() => toggleFilter("expiring")} />
        <SummaryTile icon={AlertTriangle} label="Expired" value={summary.expired} tone="text-red-600" pressed={statusFilter === "expired"} onClick={() => toggleFilter("expired")} />
        <SummaryTile icon={FileWarning} label="Documents missing" value={summary.missingDocuments} tone="text-primary" pressed={statusFilter === "missing_docs"} onClick={() => toggleFilter("missing_docs")} />
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
                    {t.daysLeft < 0 ? expiryText(t.daysLeft) : `due ${formatDayLong(t.dueOn)} · ${expiryText(t.daysLeft)}`}
                  </Badge>
                  {t.stage === "not_started" && (
                    <Button size="sm" variant="outline" aria-label={`Start renewal: ${t.title}`} onClick={() => {
                      const l = licenses.find((x) => x.id === t.licenseId);
                      if (l) actions.onStage(l, "in_progress");
                      reveal(t.licenseId);
                    }}>Start renewal</Button>
                  )}
                  <Button size="sm" variant="ghost" aria-label={`View ${t.title}`} onClick={() => reveal(t.licenseId)}>View</Button>
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
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Filter)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="attention">Needs attention</SelectItem>
                <SelectItem value="missing_docs">Documents missing</SelectItem>
                <SelectItem value="needs_review">Needs review</SelectItem>
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
          <div className="sm:w-44">
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label="Sort licenses"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expiry">Soonest expiry</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-sm text-muted-foreground">
            {licenses.length === 0 ? "No licenses yet. Add your first one to start tracking renewals." : (
              <>
                No licenses match these filters.{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setQuery(""); setStatusFilter("all"); setCategoryFilter("all"); }}>Clear filters</button>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((l) => <LicenseCard key={l.id} license={l} today={today} actions={actions} focusToken={focus.id === l.id ? focus.token : 0} />)}
          </ul>
        )}
      </section>

      <LicenseFormDialog
        key={formSession}
        open={formFor !== null}
        license={formFor && formFor !== "new" ? formFor : undefined}
        today={today}
        initialFile={uploadFile}
        onOpenChange={(o) => { if (!o) { setFormFor(null); setUploadFile(null); } }}
        onSubmit={saveForm}
      />

      <RenewDialog license={renewing} today={today} onCancel={() => setRenewing(null)} onConfirm={confirmRenewal} />

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
                  commit(licenses.filter((l) => l.id !== deleting.id), `${deleting.name} deleted.`);
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

