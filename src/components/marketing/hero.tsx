import Link from "next/link";
import { ArrowRight } from "lucide-react";

const FEATURES = ["Licenses & insurance", "Vendors, forms & signing", "Invoices & projects", "Tools, vehicles & equipment"];

export function Hero() {
  return (
    <section className="relative text-white" aria-labelledby="hero-title">
      <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-8 text-center sm:px-6 sm:pb-12 sm:pt-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-white/80">The administrative management platform</p>
        <h1 id="hero-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          Stop chasing paperwork. Run your business from one place.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
          Licenses, insurance, vendors, invoices and equipment, organized with reminders so nothing slips. Built for contractors and property managers, and it works alongside your accounting and payroll software.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-semibold text-brand-indigo shadow-lg shadow-black/20 transition hover:bg-white/90"
          >
            Start your free trial <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <a
            href="#how-it-works"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-base font-medium backdrop-blur-sm transition hover:bg-white/20"
          >
            See how it works
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-2.5" aria-label="What AdFlo covers">
          {FEATURES.map((label) => (
            <li key={label} className="rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
