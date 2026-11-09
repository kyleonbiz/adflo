import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck, CalendarDays, FileSignature, FolderKanban, Receipt, ScanText, ShieldCheck, Sparkles, Store, Users, BarChart3, Check,
} from "lucide-react";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: { absolute: "AdFlo · Your back office in one place" },
  description:
    "Invoices, licenses and renewals, vendors, forms and signatures, projects and reporting in one place, with an assistant that does the follow-up.",
};

const MODULES = [
  { icon: Receipt, name: "Invoices", text: "One-time to yearly billing. An invoice stays open, then overdue, until you mark it paid." },
  { icon: BadgeCheck, name: "Licenses & renewals", text: "Templates by business type, certifications, a compliance score and renewal fees coming up in 90 days." },
  { icon: Store, name: "Vendors", text: "Payment terms, contract end alerts, a 1099 and W-9 check, and a dated notes log for every follow-up." },
  { icon: FileSignature, name: "Forms & signing", text: "28 ready paperwork forms, typed-name signatures with a signed-copy PDF, and onboarding packets." },
  { icon: FolderKanban, name: "Projects & tasks", text: "Owners, milestones, progress, recurring tasks, and a Remind me on every task." },
  { icon: Users, name: "Contacts", text: "People and vendors together, with their details ready to drop into any form." },
  { icon: CalendarDays, name: "Calendar", text: "Invoices due, expiries, renewals, tasks and reminders on one month grid." },
  { icon: BarChart3, name: "Reporting", text: "Headline numbers, a where-to-look-first list, scheduled reports, CSV and Excel export." },
];

const STEPS = [
  { n: "1", title: "Pick your industry", text: "Choose from 17 industries. AdFlo suggests the licenses, paperwork, project templates and vendor documents that fit." },
  { n: "2", title: "Tick what you want", text: "Every suggestion is a tick box. Untick anything you do not need; change industry later and it follows." },
  { n: "3", title: "Let the follow-up run", text: "Reminders, renewal dates and stuck-work flags show up in the bell and on Home, so nothing slips." },
];

const CORE = [
  "Every module: invoices, licenses, vendors, forms, projects, contacts and reporting",
  "Scheduled reports and the activity log",
  "Guided setup for 17 industries",
  "Addy, the built-in assistant that adds to-dos and sets reminders",
];
const CORE_PLUS = [
  "Everything in Core",
  "Addy backed by Claude for drafting records",
  "OCR: photos, scans and scanned PDFs read for you",
  "Priority support",
];

const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="hero-gradient">
        <div className={`${container} flex items-center justify-between py-5`}>
          <Brand wordmark light className="w-36 sm:w-40" />
          <nav aria-label="Site" className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white sm:block">Features</a>
            <a href="#how" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white sm:block">How it works</a>
            <a href="#plans" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white sm:block">Plans</a>
            <Link href="/login" className="rounded-lg px-3 py-2 text-white/90 hover:text-white">Sign in</Link>
            <Link href="/app/overview" className="rounded-lg bg-white px-3.5 py-2 font-medium text-brand-navy hover:bg-white/90">Open the app</Link>
          </nav>
        </div>

        <div className={`${container} pb-20 pt-12 sm:pb-28 sm:pt-20`}>
          <p className="text-sm font-medium text-brand-sky">The back office, handled</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl">
            Your back office, in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Invoices, licenses and renewals, vendors, forms and signatures, projects and reporting. AdFlo keeps the admin
            work you used to hand off in one tool your team runs itself, and flags what is about to fall through the cracks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app/overview" className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary/90">
              Open the app
            </Link>
            <a href="#features" className="rounded-lg border border-white/30 px-5 py-3 font-medium text-white hover:bg-white/10">
              See what is inside
            </a>
          </div>
          <p className="mt-4 text-sm text-white/60">No card needed to look around. Your work is saved in your own browser until you connect a workspace.</p>
        </div>
      </header>

      <main>
        <section className={`${container} py-16 sm:py-24`}>
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              ["Nothing expires unnoticed", "Licenses, policies, contracts and invoices all feed one bell and one Needs your attention feed."],
              ["Follow-ups without chasing", "Vendor reminders escalate their wording, flag a vendor who has gone quiet and keep a dated record."],
              ["Set up for your kind of business", "Industry bundles put the right licenses, forms and project templates in place on day one."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-xl border bg-card p-5">
                <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-3 font-semibold tracking-tight">{t}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="features" className="scroll-mt-4 border-y bg-card">
          <div className={`${container} py-16 sm:py-24`}>
            <h2 className="text-3xl font-semibold tracking-tight">Everything the admin side needs</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Eight tools that share one set of records, so Home, the bell and Reporting always agree.</p>
            <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map(({ icon: Icon, name, text }) => (
                <li key={name}>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 font-semibold">{name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className={`${container} scroll-mt-4 py-16 sm:py-24`}>
          <h2 className="text-3xl font-semibold tracking-tight">Up and running in three steps</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{s.n}</span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-brand-navy text-white">
          <div className={`${container} grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:items-center`}>
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-brand-sky"><Sparkles className="size-4" aria-hidden="true" /> Meet Addy</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">An assistant that does the small stuff</h2>
              <p className="mt-3 text-white/75">
                Ask Addy to add a to-do, set a reminder or tick one off and it is done, with Undo. For bigger jobs it prepares a draft
                invoice, contact, vendor, project or license that opens ready for you to review and save.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                "Never saves, deletes, approves, pays, sends or signs on its own",
                "Refuses card numbers, SSNs, passwords and tax IDs",
                "At most three drafts a turn, always shown before anything is saved",
              ].map((t) => (
                <li key={t} className="flex gap-3 rounded-xl border border-white/15 p-4 text-white/85">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-sky" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="plans" className={`${container} scroll-mt-4 py-16 sm:py-24`}>
          <h2 className="text-3xl font-semibold tracking-tight">Two plans</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Core has the whole back office. Core + adds the Claude assistant, OCR and priority support.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {[
              { name: "Core", note: "Every module and the automations", items: CORE, icon: ShieldCheck },
              { name: "Core +", note: "Core, plus reading and drafting for you", items: CORE_PLUS, icon: ScanText },
            ].map(({ name, note, items, icon: Icon }) => (
              <div key={name} className="rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-2"><Icon className="size-5 text-primary" aria-hidden="true" /><h3 className="text-xl font-semibold">{name}</h3></div>
                <p className="mt-1 text-sm text-muted-foreground">{note}</p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {items.map((i) => (
                    <li key={i} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="hero-gradient">
          <div className={`${container} py-16 text-center sm:py-20`}>
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white">Stop letting admin work slip.</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/75">Open AdFlo and pick your industry. Your first reminders can be set in a few minutes.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/app/overview" className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary/90">Open the app</Link>
              <Link href="/signup" className="rounded-lg border border-white/30 px-5 py-3 font-medium text-white hover:bg-white/10">Create an account</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className={`${container} flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-muted-foreground`}>
          <span>© {new Date().getFullYear()} Aurum Ventura Enterprise LLC</span>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="hover:text-foreground">Create an account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
