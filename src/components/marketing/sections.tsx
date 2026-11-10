import Link from "next/link";
import {
  BadgeCheck, BarChart3, CalendarDays, Check, FileSignature, FolderKanban, Receipt, Sparkles, Store, Users, Layers, Eye,
  AlertTriangle,
} from "lucide-react";
import { AdminCostCalculator } from "@/components/marketing/admin-cost-calculator";
import { DemoRequestForm } from "@/components/marketing/demo-request-form";

const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const card = "rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm transition duration-200 hover:border-brand-violet/60 hover:bg-brand-purple/15";
const eyebrow = "text-sm font-medium text-[#b9a2ff]"
const gradientBtn = "bg-gradient-to-r from-brand-blue to-brand-purple text-white shadow-lg shadow-brand-purple/30 transition hover:brightness-110";
const h2 = "mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl";

const PROBLEMS = [
  "Important information scattered across different systems",
  "Repetitive administrative tasks consuming valuable time",
  "Hard to track documents, invoices and deadlines",
  "Manual processes slowing down operations",
  "Limited visibility into what is happening across the business",
];

const CAPABILITIES = [
  { icon: Layers, name: "Documents & records", text: "Keep important business documents in one organized place, with search." },
  { icon: Receipt, name: "Invoices", text: "Track what is open, overdue and paid, with due dates in view." },
  { icon: Store, name: "Vendors", text: "Payment terms, contract end alerts, tax-form checks and a dated notes log." },
  { icon: BadgeCheck, name: "Licenses & renewals", text: "Expiry dates, renewal fees and a compliance score, ahead of the deadline." },
  { icon: FolderKanban, name: "Projects & tasks", text: "Owners, milestones, progress and recurring tasks, with Remind me on every task." },
  { icon: FileSignature, name: "Forms & signing", text: "Ready-made paperwork forms, typed-name signatures and signed-copy PDFs." },
  { icon: Users, name: "Contacts", text: "People and vendors together, ready to drop into any form." },
  { icon: CalendarDays, name: "Calendar", text: "Due dates, expiries, renewals and reminders on one month grid." },
  { icon: BarChart3, name: "Reporting", text: "Headline numbers, scheduled reports, and CSV and Excel export." },
];

const APPROACH = [
  { icon: Layers, step: "Organize", text: "Bring business information and administrative responsibilities into one platform." },
  { icon: Sparkles, step: "Automate", text: "Let the built-in assistant take on repetitive work such as to-dos and reminders, and prepare drafts." },
  { icon: Eye, step: "Oversee", text: "Your people review, approve and decide. Drafts open for review and nothing is saved, sent or signed without you." },
];

const HOW = [
  { n: "1", title: "Centralize", text: "Bring your administrative operations into one platform." },
  { n: "2", title: "Streamline", text: "Manage workflows by hand, or let the assistant reduce the repetitive work." },
  { n: "3", title: "Stay in control", text: "Monitor activity, review results and keep oversight through the Dashboard, the bell and Reporting." },
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

/** The longer marketing story that sits under the hero and demo workspace on the landing page. */
export function LandingSections() {
  return (
    <div className="text-white">
      <section id="platform" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="problem-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <p className={eyebrow}>The problem</p>
            <h2 id="problem-title" className={h2}>Running a business shouldn’t mean managing endless administrative work.</h2>
            <ul className="mt-6 space-y-3 text-white/80">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3"><AlertTriangle className="mt-1 size-4 shrink-0 text-[#c4b0ff]" aria-hidden="true" />{p}</li>
              ))}
            </ul>
          </div>
          <div className={`${card} bg-gradient-to-br from-brand-purple/30 to-brand-blue/10 p-7`}>
            <p className={eyebrow}>The answer</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">One platform. Better-controlled operations.</h3>
            <p className="mt-3 text-white/80">
              AdFlo gives your business one organized environment for its administrative responsibilities, so repetitive work gets
              automated and what is about to slip gets flagged on the Dashboard and in the bell.
            </p>
          </div>
        </div>
      </section>

      <AdminCostCalculator />

      <section className={`${container} pb-14 sm:pb-20`} aria-labelledby="capabilities-title">
        <p className={eyebrow}>Platform capabilities</p>
        <h2 id="capabilities-title" className={h2}>Everything the admin side needs</h2>
        <p className="mt-2 max-w-2xl text-white/75">Tools that share one set of records, so the Dashboard, the bell and Reporting always agree.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, name, text }) => (
            <li key={name} className={card}>
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-purple/30 text-[#d2c4ff]"><Icon className="size-5" aria-hidden="true" /></span>
              <h3 className="mt-3 font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-white/70">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="approach" className="scroll-mt-4 border-y border-white/10 bg-gradient-to-b from-brand-purple-deep/30 to-black/20" aria-labelledby="approach-title">
        <div className={`${container} py-14 sm:py-20`}>
          <p className={eyebrow}>Human + AI</p>
          <h2 id="approach-title" className={`${h2} max-w-3xl`}>AI does the repetitive work. Your people stay in control.</h2>
          <p className="mt-3 max-w-2xl text-white/75">AdFlo doesn’t remove the need for people. It makes their work more efficient.</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {APPROACH.map(({ icon: Icon, step, text }, i) => (
              <li key={step} className={card}>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-violet text-sm font-semibold">{i + 1}</span>
                  <Icon className="size-5 text-[#c4b0ff]" aria-hidden="true" />
                </div>
                <h3 className="mt-3 text-sm font-semibold uppercase tracking-wider">{step}</h3>
                <p className="mt-1 text-sm text-white/75">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${container} py-14 sm:py-20`} aria-labelledby="how-title">
        <p className={eyebrow}>How it works</p>
        <h2 id="how-title" className={h2}>Three simple steps</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {HOW.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-violet/60 bg-brand-purple/20 text-sm font-semibold text-[#d2c4ff]">{s.n}</span>
              <div><h3 className="font-semibold">{s.title}</h3><p className="mt-1 text-sm text-white/75">{s.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section id="who" className={`${container} scroll-mt-4 pb-14 sm:pb-20`} aria-labelledby="who-title">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className={eyebrow}>Who it’s for</p>
            <h2 id="who-title" className={h2}>Built for businesses that have outgrown disorganized operations.</h2>
            <p className="mt-3 text-white/75">AdFlo supports businesses that want more organized, efficient and scalable administrative operations.</p>
          </div>
          <ul className="flex flex-wrap content-start gap-2.5" aria-label="Who AdFlo is for">
            {AUDIENCE.map((a) => (
              <li key={a} className="rounded-full border border-brand-violet/40 bg-brand-purple/20 px-4 py-2 text-sm">{a}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/20" aria-labelledby="value-title">
        <div className={`${container} py-14 sm:py-20`}>
          <p className={eyebrow}>Business value</p>
          <h2 id="value-title" className={h2}>More organization. Less administrative overhead.</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {VALUE.map((v) => (
              <li key={v} className="flex gap-3 rounded-xl border border-white/15 p-4 text-white/85">
                <Check className="mt-0.5 size-4 shrink-0 text-[#c4b0ff]" aria-hidden="true" />{v}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="demo" className={`${container} scroll-mt-4 py-14 sm:py-20`} aria-labelledby="cta-title">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 id="cta-title" className={h2}>Take control of your business operations.</h2>
            <p className="mt-3 text-white/80">
              Discover how AdFlo can help your organization simplify administrative work, streamline workflows and operate more efficiently.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#demo-form" className={`rounded-lg px-5 py-3 font-medium ${gradientBtn}`}>Schedule your AdFlo demo</a>
              <Link href="/app" className="rounded-lg border border-white/30 px-5 py-3 font-medium transition hover:bg-white/10">Open workspace</Link>
            </div>
          </div>
          <div id="demo-form" className="scroll-mt-4"><DemoRequestForm /></div>
        </div>
      </section>
    </div>
  );
}
