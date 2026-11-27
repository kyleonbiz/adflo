import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck, BarChart3, CalendarDays, Check, FileSignature, FolderKanban, Receipt, Sparkles, Store, Users, Layers, Eye,
  AlertTriangle, Clock, Target, Workflow,
} from "lucide-react";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";
import { ONBOARDING_MAX_CENTS, ONBOARDING_MIN_CENTS, PRICE_CENTS, SEAT_CENTS, TIERS } from "@/lib/control/tiers";
import { TRIAL_DAYS } from "@/lib/billing/trial";

const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const card = "rounded-xl border bg-white p-5 shadow-sm transition-colors duration-150 hover:border-brand-blue/40";
const eyebrow = "text-sm font-semibold text-primary"
const primaryBtn = "bg-primary text-white shadow-sm transition-colors hover:bg-[#1757c2]";
const h2 = "mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl";

const USE_CASES = [
  { title: "Contractors", tag: "Our focus", items: ["Contractor license and renewal tracking", "Insurance certificates and expiry alerts", "Subcontractor and vendor files", "Tools, vehicles and equipment records", "Forms and signed agreements", "Invoices and project tasks"] },
  { title: "Property managers", tag: "Also built for", items: ["Vendor contracts and renewals", "Appliance, HVAC and key tracking", "Leases, notices and forms", "Inspection and maintenance reminders", "Invoices and due dates", "Team tasks and reporting"] },
];

const PROBLEMS = [
  "Important information scattered across different systems",
  "Repetitive administrative tasks consuming valuable time",
  "Hard to track documents, invoices and deadlines",
  "Manual processes slowing down operations",
  "Limited visibility into what is happening across the business",
];

const CAPABILITIES = [
  { icon: Layers, name: "Documents & records", best: "Finding any contract, certificate or file in seconds.",
    time: "Search instead of digging through folders and inboxes.", money: "Fewer lost, duplicate and out-of-date files.", flow: "One organized home for every business record." },
  { icon: Receipt, name: "Invoices", best: "Knowing exactly what is open, overdue and paid.",
    time: "Due dates in view, so no more chasing spreadsheets.", money: "Overdue invoices get noticed sooner.", flow: "Everyone works from the same up-to-date status." },
  { icon: Store, name: "Vendors", best: "Keeping suppliers, terms and contracts under control.",
    time: "Payment terms and tax-form checks in one profile.", money: "Contract end dates are flagged before they renew.", flow: "A dated notes log keeps the whole team in the loop." },
  { icon: BadgeCheck, name: "Licenses & Renewals", best: "Staying aware of license and permit renewal dates.",
    time: "Expiry dates kept in one place, with reminders ahead of the deadline.", money: "Renewal dates are flagged ahead of time.", flow: "A summary shows which items need attention first." },
  { icon: FolderKanban, name: "Projects & tasks", best: "Getting work done with clear owners and deadlines.",
    time: "Recurring tasks and Remind me on every task.", money: "Clear owners mean fewer dropped tasks.", flow: "Milestones and progress visible without status meetings." },
  { icon: FileSignature, name: "Forms & signing", best: "Collecting paperwork and signatures without the back-and-forth.",
    time: "Ready-made forms replace printing, scanning and emailing.", money: "Less printing, scanning and emailing back and forth.", flow: "Typed-name signatures and signed-copy PDFs, filed automatically." },
  { icon: Users, name: "Contacts", best: "Having every person and vendor one click away.",
    time: "Drop a contact straight into any form.", money: "Less re-typing and fewer typos.", flow: "People and vendors together, one source of truth." },
  { icon: CalendarDays, name: "Calendar", best: "Seeing what is coming up before it is urgent.",
    time: "Due dates, expiries and reminders on one month grid.", money: "Deadlines are easier to see early.", flow: "One view replaces five separate calendars." },
  { icon: BarChart3, name: "Reporting", best: "Answering “how are we doing?” without building a report.",
    time: "Headline numbers ready, plus scheduled reports.", money: "Overdue and expiring items are easy to spot.", flow: "CSV and Excel export for your accountant or board." },
];

const SHOTS = [
  { file: "dashboard", title: "Dashboard", text: "Open invoices, tasks and what needs attention, in one view." },
  { file: "licenses", title: "Licenses & Renewals", text: "Expiry dates, follow-ups and renewal tasks, organized with reminders." },
  { file: "equipment", title: "Equipment", text: "Tools, vehicles and keys, with service dates that are flagged." },
  { file: "invoices", title: "Invoices", text: "What is open, overdue and paid, with reminders." },
];

const ADDY_DOES = [
  { icon: Sparkles, title: "Answers your questions", text: "Ask how something works, what is coming up or what is left to do. Addy answers from your own records. Addy will not set up your account for you." },
  { icon: Receipt, title: "Creates invoices", text: "“Invoice Acme $1,200 due Friday.” Addy fills it in, you review it and approve." },
  { icon: Layers, title: "Creates documents", text: "Drafts the letters, notices and records you need, filed in the right place." },
  { icon: FileSignature, title: "Prepares forms and paperwork", text: "Picks the right form, fills in what she knows and gets it ready for signing." },
  { icon: FolderKanban, title: "Creates tasks and projects", text: "Turns a sentence into a project with owners, milestones, recurring tasks and to-dos, and ticks them off with you." },
  { icon: CalendarDays, title: "Manages your calendar", text: "Sets reminders, adds due dates and renewals, and keeps events up to date. “Remind me to renew the permit in 3 days.”" },
  { icon: BarChart3, title: "Runs your reports", text: "“How are we doing?” Addy runs the report, explains the numbers and exports them to CSV or Excel." },
  { icon: Store, title: "Keeps records up to date", text: "Updates contacts, vendors and licenses as things change, and tells you what is left to do." },
];

const PLAN_INCLUDES = [
  "Every module: documents, licenses and insurance, vendors, forms and signing, invoices, projects, equipment, calendar and reporting",
  "Addy, the built-in assistant, and OCR for photos and scans of licenses and certificates",
  "Renewal and deadline emails, so an expiring license reaches your inbox instead of waiting in the app",
  "Your whole team: every extra seat is the same $10 a month, with no tiers to climb",
  "Priority support, and guided onboarding where we load your first records (a one-time fee, below)",
];

const ADDY_NEVER = ["Delete anything", "Approve or pay", "Send or sign for you", "Finalize anything without your say-so"];

const APPROACH = [
  { icon: Layers, step: "Organize", text: "Bring business information and administrative responsibilities into one platform." },
  { icon: Sparkles, step: "Automate", text: "Let the built-in assistant take on repetitive work such as to-dos and reminders, and prepare drafts." },
  { icon: Eye, step: "Oversee", text: "Your people review, approve and decide. Drafts open for review and nothing is saved, sent or signed without you." },
];

const HOW = [
  { n: "1", title: "Start your free trial", text: "Create your account and try AdFlo free. No credit card needed." },
  { n: "2", title: "Choose your industry", text: "Guided setup asks what you do and which services you use, then sets up templates and reminders for you." },
  { n: "3", title: "Add your records", text: "Upload documents, photos of licenses and certificates, vendors, invoices and equipment. Or ask Addy to prepare them for you to review." },
  { n: "4", title: "Stay ahead of what is due", text: "Renewal and deadline dates show up on the Dashboard, the calendar and in reminder emails, so you see what is coming up before it is urgent." },
  { n: "5", title: "Bring in your team", text: "Invite teammates by email and give each a role. Everyone works from the same records." },
];

const AUDIENCE = [
  "Small and medium-sized businesses", "Growing companies", "Administrative departments", "Operations managers",
  "Business owners", "Professional service organizations", "Multi-department organizations",
];

const VALUE = [
  "Reduce repetitive administrative work",
  "Improve operational visibility",
  "Centralize important business information",
  "Create more consistent workflows",
  "Improve team productivity",
  "Scale administrative operations without scaling the workload to match",
];

const TRUST = [
  { title: "Roles and permissions", text: "Invite your team and give each person a role: Viewer, Editor, Admin or Owner. Only owners can close the workspace." },
  { title: "Activity you can review", text: "An activity log and audit trail show what changed in your records." },
  { title: "You approve what Addy prepares", text: "Drafts open for review. Nothing is saved, sent or signed without you." },
  { title: "Your data stays yours", text: "Admins and owners can export your workspace data at any time. Read how we handle it in our privacy policy." },
];

const FAQS = [
  { q: "Who is AdFlo for?", a: "Contractors and skilled trades are our initial focus, and AdFlo is also built for property managers and other businesses that carry a lot of paperwork. It is not limited to one trade or industry." },
  { q: "What does it help me organize?", a: "Documents and records, licenses, insurance and renewal dates, vendors, forms and signing, invoices, and equipment and asset records such as tools, vehicles and keys." },
  { q: "Does it replace my accounting or project software?", a: "No. AdFlo is the administrative layer alongside your accounting, payroll and construction or property management software. It is not a CRM, an ERP or accounting software." },
  { q: "How do seats work?", a: "The base subscription includes your seat. Each additional teammate is one extra seat at the same flat monthly price. See pricing below." },
  { q: "How do I get started?", a: "Choose Get Started and try AdFlo free. If you would rather talk first, schedule a demo and we will walk you through it." },
];

/** The longer marketing story that sits under the hero and demo workspace on the landing page. */
export function LandingSections() {
  return (
    <div className="text-foreground">
      <section className={`${container} pt-12 sm:pt-16`} aria-labelledby="usecase-title">
        <p className={eyebrow}>Ready for your business</p>
        <h2 id="usecase-title" className={h2}>Set up for the paperwork your business actually has</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Start from what is already built for your line of work, then make it yours.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {USE_CASES.map((u) => (
            <div key={u.title} className={card}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{u.title}</h3>
                <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">{u.tag}</span>
              </div>
              <ul className="mt-3 grid gap-2 text-sm text-foreground/85 sm:grid-cols-2">
                {u.items.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-foreground/70">AdFlo is not a CRM, not an ERP, and not accounting, bookkeeping or payroll software. It is the administrative layer alongside them and does not replace them. AdFlo helps you stay organized and aware of important dates. You remain responsible for verifying requirements and completing renewals.</p>
        <Link href="/signup" className={`mt-5 inline-block rounded-lg px-5 py-3 font-medium ${primaryBtn}`}>Start your free trial</Link>
      </section>

      <section id="platform" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="problem-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <p className={eyebrow}>The problem</p>
            <h2 id="problem-title" className={h2}>Running a business shouldn’t mean managing endless administrative work.</h2>
            <ul className="mt-6 space-y-3 text-foreground/80">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3"><AlertTriangle className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />{p}</li>
              ))}
            </ul>
          </div>
          <div className={`${card} bg-muted p-7`}>
            <p className={eyebrow}>The answer</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">One platform. Better-controlled operations.</h3>
            <p className="mt-3 text-foreground/80">
              AdFlo gives your business one organized environment for its administrative responsibilities, so repetitive work gets
              automated and what is about to slip gets flagged on the Dashboard and in the bell.
            </p>
          </div>
        </div>
      </section>

      <section id="screens" className={`${container} scroll-mt-4 pb-14 sm:pb-20`} aria-labelledby="screens-title">
        <p className={eyebrow}>The product</p>
        <h2 id="screens-title" className={h2}>See AdFlo in use</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Screens from the app, shown with sample data.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {SHOTS.map((sh) => (
            <figure key={sh.file}>
              <Image src={`/screenshots/${sh.file}.png`} alt={`The ${sh.title} screen in AdFlo, with sample data`} width={1440} height={900} sizes="(min-width: 768px) 560px, 100vw" className="w-full rounded-lg border shadow-sm" />
              <figcaption className="mt-3 text-sm"><span className="font-semibold">{sh.title}.</span> <span className="text-muted-foreground">{sh.text}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={`${container} pb-14 sm:pb-20`} aria-labelledby="capabilities-title">
        <p className={eyebrow}>Platform</p>
        <h2 id="capabilities-title" className={h2}>Every module earns its place: saving time, money and effort</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Tools that share one set of records, so the Dashboard, the bell and Reporting always agree. Here is what each one is best at.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, name, best, time, money, flow }) => (
            <li key={name} className={card}>
              <span className="flex size-10 items-center justify-center text-primary"><Icon className="size-5" aria-hidden="true" /></span>
              <h3 className="mt-3 font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-foreground/85"><span className="font-medium text-primary">Best for:</span> {best}</p>
              <dl className="mt-3 space-y-2 border-t border-brand-blue/10 pt-3 text-sm text-muted-foreground">
                {[{ Ic: Clock, label: "Saves time", v: time }, { Ic: Target, label: "Why it helps", v: money }, { Ic: Workflow, label: "Smoother workflow", v: flow }].map(({ Ic, label, v }) => (
                  <div key={label} className="flex gap-2.5">
                    <Ic className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div><dt className="font-medium text-foreground">{label}</dt><dd>{v}</dd></div>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section id="addy" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="addy-title">
        <p className={eyebrow}>Meet Addy, your AdFlo assistant</p>
        <h2 id="addy-title" className={`${h2} max-w-3xl`}>Tell Addy what you need. She takes care of the busywork.</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">Ask in plain language. Addy does the work across every module, and every important step stays in your hands.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADDY_DOES.map(({ icon: Icon, title, text }) => (
            <li key={title} className={card}>
              <span className="flex size-10 items-center justify-center text-primary"><Icon className="size-5" aria-hidden="true" /></span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
          <li className={`${card} bg-muted`}>
            <span className="flex size-10 items-center justify-center text-primary"><Eye className="size-5" aria-hidden="true" /></span>
            <h3 className="mt-3 font-semibold">You stay in control</h3>
            <p className="mt-1 text-sm text-muted-foreground">Addy will never:</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground/80">
              {ADDY_NEVER.map((n) => <li key={n} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{n}</li>)}
            </ul>
          </li>
        </ul>
      </section>

      <section id="approach" className="scroll-mt-4 border-y border-brand-blue/10 bg-white/40" aria-labelledby="approach-title">
        <div className={`${container} py-14 sm:py-20`}>
          <p className={eyebrow}>Tech-led, human-managed</p>
          <h2 id="approach-title" className={`${h2} max-w-3xl`}>Automation and AI lead. Your people manage.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">AdFlo doesn’t remove the need for people. It makes their work more efficient.</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {APPROACH.map(({ icon: Icon, step, text }, i) => (
              <li key={step} className={card}>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">{i + 1}</span>
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider">{step}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="how-it-works" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="how-title">
        <p className={eyebrow}>How it works</p>
        <h2 id="how-title" className={h2}>From sign-up to organized in five steps</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {HOW.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/40 text-sm font-semibold text-primary">{s.n}</span>
              <div><h3 className="font-semibold">{s.title}</h3><p className="mt-1 text-sm text-muted-foreground">{s.text}</p></div>
            </li>
          ))}
        </ol>
        <Link href="/signup" className={`mt-8 inline-block rounded-lg px-5 py-3 font-medium ${primaryBtn}`}>Get Started</Link>
      </section>

      <section id="who" className={`${container} scroll-mt-4 pb-14 sm:pb-20`} aria-labelledby="who-title">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className={eyebrow}>Who it’s for</p>
            <h2 id="who-title" className={h2}>Built for businesses that have outgrown disorganized operations.</h2>
            <p className="mt-3 text-muted-foreground">AdFlo supports businesses that want more organized, efficient and scalable administrative operations.</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2.5" aria-label="Who AdFlo is for">
            {AUDIENCE.map((a) => (
              <li key={a} className="rounded-md border bg-white px-3 py-1.5 text-sm text-foreground">{a}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-brand-blue/10 bg-white/40" aria-labelledby="value-title">
        <div className={`${container} py-14 sm:py-20`}>
          <p className={eyebrow}>Business value</p>
          <h2 id="value-title" className={h2}>More organization. Less administrative overhead.</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {VALUE.map((v) => (
              <li key={v} className="flex gap-3 rounded-xl border border-white/80 bg-white/70 p-4 text-foreground/85 shadow-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{v}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="trust" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="trust-title">
        <p className={eyebrow}>Trust and control</p>
        <h2 id="trust-title" className={h2}>Clear controls over who sees and changes your records</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <li key={t.title} className={card}>
              <h3 className="font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="pricing" className="scroll-mt-4 border-y border-brand-blue/10 bg-white/40" aria-labelledby="pricing-title">
        <div className={`${container} py-14 sm:py-20`}>
          <p className={eyebrow}>Pricing</p>
          <h2 id="pricing-title" className={h2}>One plan. Everything included.</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
            <div className={card}>
              <p className="text-sm font-medium text-muted-foreground">AdFlo</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-5xl font-semibold tracking-tight text-foreground">${PRICE_CENTS / 100}</span>
                <span className="text-muted-foreground">per month</span>
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Includes your seat. Add teammates for ${SEAT_CENTS / 100} a month each.</p>
              <p className="mt-1 text-sm text-foreground/80">Or ${TIERS[0].limits.annualCents / 100} a year, plus ${TIERS[0].limits.seatAnnualCents / 100} a year per extra seat: two months free.</p>
              <p className="mt-1 text-sm text-foreground/80">A team of 5 pays ${(PRICE_CENTS + 4 * SEAT_CENTS) / 100} a month.</p>
              <p className="mt-3 text-sm text-foreground/80">One-time onboarding: ${ONBOARDING_MIN_CENTS / 100} to ${ONBOARDING_MAX_CENTS / 100}, depending on how much we load for you.</p>
              <Link href="/signup" className={`mt-5 block rounded-lg px-5 py-3 text-center font-medium ${primaryBtn}`}>Start your free {TRIAL_DAYS}-day trial</Link>
            </div>
            <ul className="grid gap-3" aria-label="What the plan includes">
              {PLAN_INCLUDES.map((v) => (
                <li key={v} className="flex gap-3 rounded-xl border border-white/80 bg-white/70 p-4 text-foreground/85 shadow-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{v}
                </li>
              ))}
            </ul>
          </div>
          <div id="custom-package" className={`${card} mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <h3 className="text-lg font-semibold">Custom package</h3>
              <p className="mt-1 max-w-2xl text-sm text-foreground/80">Larger teams, several locations, property portfolios or special requirements. Tell us what you need and we will quote a package for your business.</p>
            </div>
            <a href="#demo-form" className="shrink-0 rounded-lg border border-brand-blue/30 bg-white/80 px-5 py-3 text-center font-medium text-foreground transition hover:bg-white">Request a custom quote</a>
          </div>
          <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
            AdFlo is not a CRM, not an ERP, and not accounting, bookkeeping or payroll software. It is the administrative layer that sits alongside your accounting, payroll and construction or property management software. It does not replace them, so it does not price like them.
          </p>
        </div>
      </section>

      <section id="faq" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="faq-title">
        <p className={eyebrow}>Resources</p>
        <h2 id="faq-title" className={h2}>Frequently asked questions</h2>
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {FAQS.map((f) => (
            <details key={f.q} className={`${card} group`}>
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-foreground/80">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="demo" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="cta-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 id="cta-title" className={h2}>Keep the administrative side organized.</h2>
            <p className="mt-3 text-foreground/80">
              Discover how AdFlo can help your organization simplify administrative work, streamline workflows and operate more efficiently.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className={`rounded-lg px-5 py-3 font-medium ${primaryBtn}`}>Get Started</Link>
              <a href="#demo-form" className="rounded-lg border border-brand-blue/30 bg-white/70 px-5 py-3 font-medium text-foreground transition hover:bg-white">Schedule a demo</a>
              <Link href="/login" className="rounded-lg border border-brand-blue/30 bg-white/70 px-5 py-3 font-medium text-foreground transition hover:bg-white">Log in</Link>
            </div>
          </div>
          <div id="demo-form" className="scroll-mt-4"><DemoRequestForm /></div>
        </div>
      </section>
    </div>
  );
}
