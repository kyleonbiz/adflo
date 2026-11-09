"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Product mockups drawn in markup, so they stay sharp and match the real screens. All figures are illustrative sample data. */

const NAV = ["Home", "Documents", "Contacts", "Invoices", "Licenses", "Vendors", "Forms", "Projects", "Tasks", "Calendar", "Reporting", "Activity"];

const tone = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  late: "bg-red-500/15 text-red-700 dark:text-red-300",
  info: "bg-primary/15 text-primary",
  quiet: "bg-muted text-muted-foreground",
} as const;
type Tone = keyof typeof tone;

const Pill = ({ t, children }: { t: Tone; children: React.ReactNode }) => (
  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tone[t])}>{children}</span>
);

function Chrome({ title, active, children, className }: { title: string; active: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card text-card-foreground shadow-float", className)}>
      <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400/70" /><span className="size-2.5 rounded-full bg-amber-400/70" /><span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 truncate text-[11px] text-muted-foreground">adflo · {title}</span>
      </div>
      <div className="flex">
        <ul className="hidden w-32 shrink-0 space-y-0.5 border-r bg-brand-navy p-2 sm:block" aria-hidden="true">
          {NAV.map((n) => (
            <li key={n} className={cn("rounded-md px-2 py-1 text-[11px]", n === active ? "bg-white/15 font-medium text-white" : "text-white/55")}>{n}</li>
          ))}
        </ul>
        <div className="min-w-0 flex-1 p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

const Kpi = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className="rounded-lg border bg-background p-2.5">
    <p className="truncate text-[10px] text-muted-foreground">{label}</p>
    <p className="mt-0.5 text-lg font-semibold leading-tight tracking-tight">{value}</p>
    <p className="truncate text-[10px] text-muted-foreground">{note}</p>
  </div>
);

const Row = ({ a, b, t, c }: { a: string; b: string; t: Tone; c: string }) => (
  <li className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0">
    <span className="min-w-0"><span className="block truncate text-[11px] font-medium">{a}</span><span className="block truncate text-[10px] text-muted-foreground">{b}</span></span>
    <Pill t={t}>{c}</Pill>
  </li>
);

/** The Home dashboard: headline numbers, what needs attention, and Addy beside them. */
export function HeroDashboard({ className }: { className?: string }) {
  return (
    <div role="img" aria-label="AdFlo Home dashboard showing open invoices, renewals, vendor documents and projects, a list of what needs attention, and the Addy assistant" className={className}>
      <Chrome title="Home" active="Home">
        <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">Dashboard</p><p className="text-[10px] text-muted-foreground">Illustrative sample data</p></div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Outstanding invoices" value="12" note="3 overdue" />
          <Kpi label="Renewals, next 90 days" value="7" note="2 this month" />
          <Kpi label="Vendor documents" value="5" note="expiring soon" />
          <Kpi label="Active projects" value="9" note="on track" />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <div className="rounded-lg border p-3 md:col-span-3">
            <p className="text-[11px] font-semibold">Needs your attention</p>
            <ul className="mt-1">
              <Row a="Invoice #1042 is overdue" b="Sent 18 days ago" t="late" c="Overdue" />
              <Row a="Business license renews in 14 days" b="Add the new document" t="warn" c="Due soon" />
              <Row a="Vendor insurance certificate" b="Expires next month" t="warn" c="Expiring" />
              <Row a="Quarterly review project" b="Milestone 3 of 5 done" t="ok" c="On track" />
            </ul>
          </div>
          <div className="rounded-lg border bg-accent/40 p-3 md:col-span-2">
            <p className="text-[11px] font-semibold">Addy · assistant</p>
            <p className="mt-2 rounded-md bg-card p-2 text-[10px]">Remind me to renew the vehicle registration next Friday.</p>
            <p className="mt-1.5 rounded-md bg-primary p-2 text-[10px] text-primary-foreground">Reminder set for Friday. <span className="underline">Undo</span></p>
          </div>
        </div>
      </Chrome>
    </div>
  );
}

interface Panel {
  id: string; tab: string; active: string; title: string; kpis: [string, string, string][];
  head: string; rows: [string, string, Tone, string][]; caption: string;
}

const PANELS: Panel[] = [
  { id: "dashboard", tab: "Dashboard", active: "Home", title: "Home", kpis: [["Queue", "6", "waiting on you"], ["Due this week", "4", "invoices and tasks"], ["Renewals", "7", "next 90 days"]],
    head: "Where to begin", rows: [["Send the overdue invoice reminder", "Invoices", "late", "Overdue"], ["Review the new vendor's W-9", "Vendors", "warn", "To check"], ["Confirm renewal paperwork", "Licenses", "info", "Open"]],
    caption: "One Home screen pulls what needs attention from every module." },
  { id: "workspace", tab: "Administrative workspace", active: "Tasks", title: "Tasks", kpis: [["Open tasks", "14", "across projects"], ["Recurring", "5", "set to repeat"], ["Reminders", "3", "in the bell"]],
    head: "Open tasks", rows: [["File quarterly paperwork", "Recurring · monthly", "info", "Remind me"], ["Collect signed onboarding forms", "Due Friday", "warn", "Due soon"], ["Update contact records", "No due date", "quiet", "Open"]],
    caption: "Tasks, reminders and recurring work, with a Remind me on each one." },
  { id: "automation", tab: "Automation", active: "Activity", title: "Activity", kpis: [["Reminder rules", "On", "escalating wording"], ["Needs review", "3", "waiting on a person"], ["Undone", "0", "every change has Undo"]],
    head: "Automation with oversight", rows: [["Vendor reminder drafted", "Wording escalates with each follow-up", "info", "Draft"], ["To-do added by Addy", "Shown with Undo", "ok", "Done"], ["Approval waiting 5 days", "Flagged in the bell", "warn", "Flagged"]],
    caption: "Addy and the reminder rules do the repetitive work. People review, approve and send." },
  { id: "documents", tab: "Document center", active: "Documents", title: "Documents", kpis: [["Documents", "128", "searchable"], ["Folders", "14", "with tags"], ["Versions", "on", "history kept"]],
    head: "Recent documents", rows: [["Vehicle insurance policy.pdf", "Insurance · v2", "ok", "Current"], ["Vendor agreement.docx", "Contracts · v1", "ok", "Current"], ["Scanned license.pdf", "Licenses · text read", "info", "Indexed"]],
    caption: "Organized records with search across the text inside documents." },
  { id: "invoices", tab: "Invoice tracking", active: "Invoices", title: "Invoices", kpis: [["Outstanding", "12", "open until paid"], ["Overdue", "3", "need a nudge"], ["Recurring", "6", "monthly to yearly"]],
    head: "Invoices", rows: [["#1042 · Monthly service", "Due 6 days ago", "late", "Overdue"], ["#1043 · Annual plan", "Due in 12 days", "info", "Sent"], ["#1041 · One-time", "Paid", "ok", "Paid"]],
    caption: "Invoices stay open, then overdue, until someone marks them paid." },
  { id: "vendors", tab: "Vendor management", active: "Vendors", title: "Vendors", kpis: [["Vendors", "23", "with documents"], ["Missing W-9", "2", "1099 check"], ["Contracts ending", "3", "alerts on"]],
    head: "Vendors", rows: [["Supplier one", "Net 30 · critical", "warn", "Contract ends soon"], ["Supplier two", "W-9 on file", "ok", "In good standing"], ["Supplier three", "3 reminders sent", "late", "Not responding"]],
    caption: "Payment terms, documents and a dated notes log for every vendor." },
  { id: "reporting", tab: "Reporting", active: "Reporting", title: "Reporting", kpis: [["Scheduled", "On", "due-date banner"], ["Look first", "4", "ranked"], ["Exports", "CSV · Excel", "and print or PDF"]],
    head: "Where to look first", rows: [["Overdue invoices", "Highest priority", "late", "1"], ["Licenses expiring", "Next 90 days", "warn", "2"], ["Stale onboarding packets", "Over 7 days", "info", "3"]],
    caption: "Headline numbers and a ranked list, with scheduled reports and exports." },
];

/** Tabbed product showcase: one large panel at a time, with a second panel peeking behind it. */
export function Showcase() {
  const [id, setId] = useState(PANELS[0].id);
  const i = Math.max(0, PANELS.findIndex((p) => p.id === id));
  const p = PANELS[i];
  const behind = PANELS[(i + 1) % PANELS.length];
  return (
    <div>
      <div role="tablist" aria-label="Product screens" className="flex flex-wrap justify-center gap-2">
        {PANELS.map((x) => (
          <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={x.id === id} aria-controls="showcase-panel" onClick={() => setId(x.id)}
            className={cn("rounded-full border px-4 py-2 text-sm font-medium transition-colors", x.id === id ? "border-primary bg-primary text-primary-foreground" : "border-white/20 text-white/75 hover:bg-white/10 hover:text-white")}>
            {x.tab}
          </button>
        ))}
      </div>
      <div className="relative mx-auto mt-10 max-w-4xl">
        <div aria-hidden="true" className="absolute -right-3 top-6 hidden w-[92%] scale-[0.97] opacity-40 md:block sm:-right-6">
          <Chrome title={behind.title} active={behind.active}><div className="h-56" /></Chrome>
        </div>
        <div id="showcase-panel" role="tabpanel" aria-labelledby={`tab-${p.id}`} key={p.id} className="relative animate-[rise_0.4s_ease_both]">
          <Chrome title={p.title} active={p.active}>
            <div className="flex items-baseline justify-between"><p className="text-sm font-semibold">{p.title}</p><p className="text-[10px] text-muted-foreground">Illustrative sample data</p></div>
            <div className="mt-3 grid grid-cols-3 gap-2">{p.kpis.map(([l, v, n]) => <Kpi key={l} label={l} value={v} note={n} />)}</div>
            <div className="mt-3 rounded-lg border p-3">
              <p className="text-[11px] font-semibold">{p.head}</p>
              <ul className="mt-1">{p.rows.map(([a, b, t, c]) => <Row key={a} a={a} b={b} t={t} c={c} />)}</ul>
            </div>
          </Chrome>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-white/70" aria-live="polite">{p.caption}</p>
    </div>
  );
}
