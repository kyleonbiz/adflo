import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, BarChart3, ClipboardList, Eye, FileSignature, FileText, FolderKanban, Receipt, Sparkles, Store, Check } from "lucide-react";
import { Brand } from "@/components/brand";
import { DemoForm } from "@/components/marketing/demo-form";
import { HeroDashboard, Showcase } from "@/components/marketing/mockups";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: { absolute: "AdFlo · The smarter way to manage business operations" },
  description:
    "AdFlo brings administrative workflows, business information and AI-powered automation into one platform, with your people in control. Book a demo.",
  openGraph: {
    title: "AdFlo · The smarter way to manage business operations",
    description: "Administrative workflows, business information and AI-powered automation in one platform, with human oversight.",
    type: "website",
  },
};

const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const btnPrimary = "inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary/90";
const btnGhost = "inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3 font-medium text-white hover:bg-white/10";

const PROBLEMS = [
  "Important information scattered across different systems.",
  "Repetitive administrative tasks consuming valuable time.",
  "Difficulty tracking documents, invoices and deadlines.",
  "Manual processes slowing down operations.",
  "Limited visibility into what is happening across the business.",
];

const FEATURES = [
  { icon: ClipboardList, name: "Administrative management", text: "Organize and oversee everyday administrative responsibilities." },
  { icon: Sparkles, name: "AI-powered automation", text: "Let AI assist with repetitive tasks, information processing and workflows." },
  { icon: FileText, name: "Document management", text: "Centralize important business documents and maintain organized records." },
  { icon: Receipt, name: "Invoice management", text: "Manage invoices, payment information and administrative tracking." },
  { icon: Store, name: "Vendor management", text: "Organize vendor information, relationships and important records." },
  { icon: BadgeCheck, name: "License & compliance tracking", text: "Keep track of licenses, renewals, expiration dates and important deadlines." },
  { icon: FolderKanban, name: "Project management", text: "Organize projects, responsibilities, progress and deadlines." },
  { icon: FileSignature, name: "Forms & data management", text: "Collect, organize and manage important business information." },
  { icon: BarChart3, name: "Reporting & business insights", text: "Get a clearer view of administrative activity and operational progress." },
];

const HUMAN_AI = [
  { n: "Organize", text: "Bring business information and administrative responsibilities into one centralized platform." },
  { n: "Automate", text: "Use AI to assist with repetitive administrative tasks and streamline workflows." },
  { n: "Oversee", text: "Keep people involved in reviewing, approving, managing and controlling important processes." },
];

const STEPS = [
  { title: "Centralize", text: "Bring your administrative operations into one platform." },
  { title: "Streamline", text: "Manage workflows manually or use AI-powered automation to reduce repetitive work." },
  { title: "Stay in control", text: "Monitor activity, review results and maintain oversight of your operations." },
];

const AUDIENCE = [
  "Small and medium-sized businesses", "Growing companies", "Administrative departments", "Operations managers",
  "Business owners", "Professional service organizations", "Multi-department organizations",
];

const VALUE = [
  "Reduce repetitive administrative work.",
  "Improve operational visibility.",
  "Centralize important business information.",
  "Create more consistent workflows.",
  "Improve team productivity.",
  "Scale administrative operations without proportionally increasing workload.",
];

const FOOTER_LINKS = [
  ["Platform", "#platform"], ["Features", "#features"], ["Solutions", "#solutions"], ["About", "#about"], ["Contact", "#demo"], ["Book a Demo", "#demo"],
] as const;

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      <header className="hero-gradient" id="platform">
        <div className={`${container} flex items-center justify-between py-5`}>
          <Brand wordmark light className="w-36 sm:w-40" />
          <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-2">
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white md:block">Features</a>
            <a href="#showcase" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white md:block">Product</a>
            <a href="#solutions" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white md:block">Solutions</a>
            <Link href="/login" className="rounded-lg px-3 py-2 text-white/90 hover:text-white">Sign in</Link>
            <Link href="/app" className="hidden rounded-lg border border-white/30 px-3.5 py-2 font-medium text-white hover:bg-white/10 sm:block">Open workspace</Link>
            <a href="#demo" className="rounded-lg bg-white px-3.5 py-2 font-medium text-brand-navy hover:bg-white/90">Book a Demo</a>
          </nav>
        </div>

        <div className={`${container} pb-6 pt-12 text-center sm:pt-20`}>
          <p className="text-sm font-medium text-brand-sky">The smarter way to manage business operations</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl">
            Your Business Operations. Under Control.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75">
            AdFlo brings your administrative workflows, business information, and AI-powered automation together in one intelligent
            platform. Manage the work manually, automate repetitive tasks, and keep your operations moving, all with human oversight.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#demo" className={btnPrimary}>Book a Demo</a>
            <a href="#showcase" className={btnGhost}>Explore the Platform</a>
          </div>
        </div>
        <div className={`${container} pb-16 pt-10 sm:pb-24`}>
          <div className="glass-frame rounded-[28px] p-2.5 sm:p-5">
            <HeroDashboard />
          </div>
        </div>
      </header>

      <main>
        <section className={`${container} py-16 sm:py-24`}>
          <Reveal>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Running a Business Shouldn’t Mean Managing Endless Administrative Work.</h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {PROBLEMS.map((t) => (
                <li key={t} className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{t}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="mt-14 rounded-2xl bg-brand-navy p-8 text-white sm:p-10" delay={80}>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">One Platform. Better-Controlled Operations.</h2>
            <p className="mt-3 max-w-2xl text-white/75">
              AdFlo gives your business one organized environment to manage administrative responsibilities and automate repetitive work,
              so information, deadlines and follow-ups stop living in separate places.
            </p>
          </Reveal>
        </section>

        <section id="features" className="scroll-mt-4 border-y bg-card">
          <div className={`${container} py-16 sm:py-24`}>
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight">Platform capabilities</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">Nine tools on one set of records, so Home, notifications and reporting always agree.</p>
            </Reveal>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, name, text }, i) => (
                <li key={name}>
                  <Reveal delay={(i % 3) * 70} className="h-full rounded-xl border bg-background p-6 transition-shadow hover:shadow-md">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-5" aria-hidden="true" /></span>
                    <h3 className="mt-4 font-semibold">{name}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="about" className="scroll-mt-4 bg-brand-navy text-white">
          <div className={`${container} py-16 sm:py-24`}>
            <Reveal>
              <p className="flex items-center gap-2 text-sm font-medium text-brand-sky"><Eye className="size-4" aria-hidden="true" /> Human + AI</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">AI Does the Repetitive Work. Your People Stay in Control.</h2>
              <p className="mt-4 max-w-2xl text-white/75">
                AdFlo is designed around people and AI working together. It doesn’t remove the need for people. It makes their work more efficient.
              </p>
            </Reveal>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {HUMAN_AI.map((s, i) => (
                <li key={s.n}>
                  <Reveal delay={i * 80} className="h-full rounded-xl border border-white/15 p-6">
                    <span className="text-xs font-medium text-brand-sky">0{i + 1}</span>
                    <h3 className="mt-2 text-lg font-semibold uppercase tracking-wide">{s.n}</h3>
                    <p className="mt-2 text-sm text-white/75">{s.text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="how" className={`${container} scroll-mt-4 py-16 sm:py-24`}>
          <Reveal><h2 className="text-3xl font-semibold tracking-tight">How it works</h2></Reveal>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 80} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                  <div><h3 className="font-semibold">{s.title}</h3><p className="mt-1 text-sm text-muted-foreground">{s.text}</p></div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section id="showcase" className="scroll-mt-4 bg-brand-navy-deep text-white">
          <div className={`${container} py-16 sm:py-24`}>
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See the platform</h2>
              <p className="mt-3 text-white/75">The screens your team works in every day.</p>
            </Reveal>
            <Reveal className="mt-10" delay={60}><Showcase /></Reveal>
          </div>
        </section>

        <section id="solutions" className={`${container} scroll-mt-4 py-16 sm:py-24`}>
          <Reveal>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Built for Businesses That Have Outgrown Disorganized Operations.</h2>
            <p className="mt-4 max-w-2xl text-muted-foreground">AdFlo is designed to support businesses that want more organized, efficient and scalable administrative operations.</p>
          </Reveal>
          <ul className="mt-8 flex flex-wrap gap-3">
            {AUDIENCE.map((a) => <li key={a} className="rounded-full border bg-card px-4 py-2 text-sm">{a}</li>)}
          </ul>
        </section>

        <section className="border-y bg-card">
          <div className={`${container} py-16 sm:py-24`}>
            <Reveal><h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">More Organization. Less Administrative Overhead.</h2></Reveal>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VALUE.map((v, i) => (
                <li key={v}>
                  <Reveal delay={(i % 3) * 70} className="flex h-full gap-3 rounded-xl border bg-background p-5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{v}
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="demo" className="hero-gradient scroll-mt-0">
          <div className={`${container} grid gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:items-start`}>
            <Reveal>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Take Control of Your Business Operations.</h2>
              <p className="mt-4 max-w-xl text-white/75">
                Discover how AdFlo can help your organization simplify administrative work, streamline workflows, and operate more efficiently.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#demo-form" className={btnPrimary}>Schedule Your AdFlo Demo</a>
                <a href="#demo-form" className={btnGhost}>Contact Sales</a>
              </div>
            </Reveal>
            <Reveal delay={80}><div id="demo-form" className="scroll-mt-6"><DemoForm /></div></Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-brand-navy-deep text-white/75">
        <div className={`${container} flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between`}>
          <Brand wordmark light className="w-32" />
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
            {FOOTER_LINKS.map(([l, h]) => <a key={l} href={h} className="hover:text-white">{l}</a>)}
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
          </nav>
        </div>
        <p className={`${container} border-t border-white/10 py-5 text-xs text-white/55`}>© {new Date().getFullYear()} Aurum Ventura Enterprise LLC. AdFlo is a product of Aurum Ventura Enterprise LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}
