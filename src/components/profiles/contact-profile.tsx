"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { STATE_BADGE, STATE_LABEL } from "@/components/invoices/status";
import { useToday } from "@/components/modules/use-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContactCategory } from "@/lib/contacts/types";
import { daysBetween, formatDayLong } from "@/lib/dates";
import { formatMoney, invoiceState } from "@/lib/invoices/logic";
import { invoicesForContact, summarizeInvoices, vendorsForContact } from "@/lib/profiles/logic";
import { useDashboardSources } from "@/lib/records/sources";
import { useRecordsLoading } from "@/lib/records/storage";
import { BackLink, Facts, None, NotFoundProfile, ProfileSkeleton, Section, profileLink } from "./parts";

const CATEGORY_BADGE: Record<ContactCategory, "success" | "default" | "warning" | "muted" | "outline"> = {
  Customer: "success", Lead: "default", Partner: "warning", Vendor: "muted", Other: "outline",
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

/** Everything AdFlo holds about one contact, in one place: their details, notes, invoices and any vendor record that matches. */
export function ContactProfile({ id }: { id: string }) {
  const today = useToday();
  const loading = useRecordsLoading();
  const { contacts, invoices, vendors } = useDashboardSources(today);
  const contact = contacts.find((c) => c.id === id);
  const mine = useMemo(() => (contact ? invoicesForContact(contact, invoices) : []), [contact, invoices]);
  const totals = useMemo(() => (today ? summarizeInvoices(mine, today) : null), [mine, today]);
  const vendorMatches = useMemo(() => (contact ? vendorsForContact(contact, vendors) : []), [contact, vendors]);

  if (!today || loading) return <ProfileSkeleton />;
  if (!contact || !totals) return <NotFoundProfile what="contact" backHref="/app/contacts" backLabel="All contacts" />;

  const ago = contact.lastContacted ? daysBetween(contact.lastContacted, today) : null;
  return (
    <div className="space-y-4" data-testid="contact-profile">
      <BackLink href="/app/contacts">All contacts</BackLink>
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-panel">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">{initials(contact.name)}</span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{contact.name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={CATEGORY_BADGE[contact.category]}>{contact.category}</Badge>
              {contact.company && <span>{contact.company}</span>}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm"><Link href={`/app/contacts?q=${encodeURIComponent(contact.name)}`}><Pencil /> Edit in Contacts</Link></Button>
      </header>

      <Section title="Details">
        <Facts items={[
          { label: "Email", value: contact.email ? <a href={`mailto:${contact.email}`} className={`text-primary ${profileLink}`}>{contact.email}</a> : "None" },
          { label: "Phone", value: contact.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={`text-primary ${profileLink}`}>{contact.phone}</a> : "None" },
          { label: "Last contact", value: contact.lastContacted ? `${formatDayLong(contact.lastContacted)} (${ago === 0 ? "today" : `${ago} day${ago === 1 ? "" : "s"} ago`})` : "Never contacted" },
          { label: "Added", value: formatDayLong(contact.createdOn) },
        ]} />
      </Section>

      <Section title="Notes">
        {contact.notes ? <p className="whitespace-pre-line text-sm">{contact.notes}</p> : <None>No notes. Add some under Edit in Contacts.</None>}
      </Section>

      <Section title="Invoices" count={mine.length} testId="contact-invoices">
        {mine.length === 0 ? <None>No invoices for this contact yet. Invoices match by email address or by the client name.</None> : (
          <>
            <dl className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Billed</dt><dd className="font-medium">{formatMoney(totals.billedCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Paid</dt><dd className="font-medium">{formatMoney(totals.paidCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Outstanding</dt><dd className="font-medium">{formatMoney(totals.outstandingCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Overdue</dt><dd className="font-medium">{totals.overdue}</dd></div>
            </dl>
            <ul className="divide-y">
              {mine.map((i) => {
                const state = invoiceState(i, today);
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Link href={`/app/invoices?q=${encodeURIComponent(i.number)}`} className={`font-medium ${profileLink}`}>{i.number}</Link>
                      <Badge variant={STATE_BADGE[state]}>{STATE_LABEL[state]}</Badge>
                    </span>
                    <span className="text-muted-foreground">Due {formatDayLong(i.dueOn)}</span>
                    <span className="font-medium tabular-nums">{formatMoney(i.amountCents)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Section>

      {vendorMatches.length > 0 && (
        <Section title="Also a vendor" count={vendorMatches.length}>
          <ul className="space-y-1 text-sm">
            {vendorMatches.map((v) => <li key={v.id}><Link href={`/app/vendors/${v.id}`} className={`text-primary ${profileLink}`}>{v.name}</Link></li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}
