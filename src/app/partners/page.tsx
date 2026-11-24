import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Brand } from "@/components/brand";
import { PartnerRequestForm } from "@/components/marketing/partner-request-form";

export const metadata: Metadata = {
  title: "Partners",
  description: "Work with AdFlo, the administrative management platform for contractors and property managers. For associations, trade schools, insurance agencies, consultants and suppliers who serve them.",
};

const PARTNERS = [
  "Contractor associations and trade groups",
  "Trade schools and industry educators",
  "Insurance agencies and contractor consultants",
  "Bookkeeping and business consulting firms",
  "Suppliers serving contractors",
  "Business formation and small-business support organizations",
];

const HELPS = [
  "Licenses, insurance certificates and their renewal dates",
  "Business documents, vendor and subcontractor records",
  "Forms, signed agreements and invoices",
  "Tools, vehicles and equipment records",
  "Recurring administrative tasks and reminders",
];

const h2 = "mt-12 text-2xl font-semibold tracking-tight";

export default function PartnersPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" aria-label="AdFlo home"><Brand wordmark className="w-28 sm:w-32" /></Link>
        <Link href="/signup" className="text-sm font-medium text-primary hover:underline">Start free trial</Link>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6">
        <p className="text-sm font-semibold text-primary">Partners</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">Help the businesses you serve get their administration organized.</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          AdFlo is the administrative management platform for contractors and property managers. It sits alongside their accounting,
          payroll and project software and organizes the paperwork those tools do not specialize in. If your members, students,
          clients or customers run small businesses, AdFlo may be a useful introduction.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-start">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Who we work with</h2>
            <ul className="mt-4 space-y-2.5 text-foreground/85">
              {PARTNERS.map((p) => <li key={p} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />{p}</li>)}
            </ul>

            <h2 className={h2}>What AdFlo helps organize</h2>
            <ul className="mt-4 space-y-2.5 text-foreground/85">
              {HELPS.map((p) => <li key={p} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />{p}</li>)}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              AdFlo is not a CRM, not an ERP, and not accounting, bookkeeping or payroll software. It does not replace the systems
              your audience already uses. It helps them stay organized and aware of important dates. It does not guarantee compliance.
            </p>

            <h2 className={h2}>How a partnership works</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Tell us who you serve and how you would like to introduce AdFlo, whether that is a mention to your members, a short
              demonstration or a one-to-one introduction. We will walk you through the product and agree what makes sense for your
              audience. Any referral arrangement is discussed with you and put in writing, never assumed.
            </p>
          </div>
          <PartnerRequestForm />
        </div>
      </main>
    </div>
  );
}
