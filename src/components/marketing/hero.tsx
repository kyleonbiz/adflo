import Link from "next/link";
import { ArrowRight } from "lucide-react";

const FEATURES = ["Licenses & insurance", "Vendors, forms & signing", "Invoices & projects", "Tools, vehicles & equipment"];

export function Hero() {
  return (
    <section className="relative text-white" aria-labelledby="hero-title">
      <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-8 text-center sm:px-6 sm:pb-12 sm:pt-12">
        <p className="text-sm font-medium text-white/70">The administrative management platform</p>
        <h1 id="hero-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          Your business administration, finally organized.
        </h1>
        <p className="mt-3 text-xl font-medium text-white/90 sm:text-2xl">Less paperwork. More control.</p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
          Licenses, insurance, vendors, invoices and equipment, organized with reminders so nothing slips. Built for contractors and property managers, and it works alongside your accounting and payroll software.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-[#0b1530] transition-colors hover:bg-white/90"
          >
            Start your free trial <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href="#how-it-works"
            className="rounded-lg border border-white/30 px-6 py-3 text-base font-medium transition-colors hover:bg-white/10"
          >
            See how it works
          </a>
        </div>
        <p className="mt-3 text-sm text-white/80">Try AdFlo free for 3 days. No credit card needed.</p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-2.5" aria-label="What AdFlo covers">
          {FEATURES.map((label) => (
            <li key={label} className="rounded-md border border-white/20 px-3 py-1 text-sm font-medium">
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
