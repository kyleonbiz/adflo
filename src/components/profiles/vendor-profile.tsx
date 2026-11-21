"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Paperclip, Pencil } from "lucide-react";
import { DOC_BADGE, DOC_LABEL, SEVERITY_BADGE, STATUS_BADGE, STATUS_LABEL } from "@/components/vendors/status";
import { useToday } from "@/components/modules/use-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLong } from "@/lib/dates";
import { contactsForVendor, projectsLinkedTo } from "@/lib/profiles/logic";
import { useDashboardSources } from "@/lib/records/sources";
import { useRecordsLoading } from "@/lib/records/storage";
import { followUpState, notesOf, unansweredReminders } from "@/lib/vendors/follow-up";
import { docState, onboardingProgress, vendorAlerts } from "@/lib/vendors/logic";
import { BackLink, Facts, None, NotFoundProfile, ProfileSkeleton, Section, profileLink } from "./parts";

const RISK_LABEL = { standard: "Standard", critical: "Critical to the business" } as const;

/** Everything AdFlo holds about one vendor in one place: details and terms, compliance documents, the activity log and notes. */
export function VendorProfile({ id }: { id: string }) {
  const today = useToday();
  const loading = useRecordsLoading();
  const { vendors, contacts, projects } = useDashboardSources(today);
  const vendor = vendors.find((v) => v.id === id);
  const linkedProjects = useMemo(() => (vendor ? projectsLinkedTo("vendor", vendor.name, projects) : []), [vendor, projects]);
  const people = useMemo(() => (vendor ? contactsForVendor(vendor, contacts) : []), [vendor, contacts]);

  if (!today || loading) return <ProfileSkeleton />;
  if (!vendor) return <NotFoundProfile what="vendor" backHref="/app/vendors" backLabel="All vendors" />;

  const alerts = vendorAlerts(vendor, today);
  const { done, total } = onboardingProgress(vendor, today);
  const follow = followUpState(vendor, today);
  const log = [...notesOf(vendor)].reverse();
  // Only the last four digits of a tax ID are shown on screen.
  const taxId = vendor.taxId ? `•••••${vendor.taxId.slice(-4)}` : "None";

  return (
    <div className="space-y-4" data-testid="vendor-profile">
      <BackLink href="/app/vendors">All vendors</BackLink>
      <header className="space-y-2 rounded-2xl border bg-card p-4 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{vendor.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={STATUS_BADGE[vendor.status]}>{STATUS_LABEL[vendor.status]}</Badge>
              <Badge variant="muted">{vendor.category}</Badge>
              {vendor.riskTier === "critical" && <Badge variant="warning">Critical</Badge>}
            </p>
          </div>
          <Button asChild variant="outline" size="sm"><Link href={`/app/vendors?q=${encodeURIComponent(vendor.name)}`}><Pencil /> Edit in Vendors</Link></Button>
        </div>
        {alerts.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Alerts">
            {alerts.map((a) => <li key={a.message}><Badge variant={SEVERITY_BADGE[a.severity]}>{a.message}</Badge></li>)}
          </ul>
        )}
        {follow === "ghosted" && <Badge variant="danger">No reply after {unansweredReminders(vendor).length} reminders</Badge>}
        {follow === "waiting" && <Badge variant="muted">Reminder sent, waiting for a reply</Badge>}
      </header>

      <Section title="Details and terms">
        <Facts items={[
          { label: "Contact", value: vendor.contactName || "None" },
          { label: "Email", value: vendor.email ? <a href={`mailto:${vendor.email}`} className={`text-primary ${profileLink}`}>{vendor.email}</a> : "None" },
          { label: "Phone", value: vendor.phone ? <a href={`tel:${vendor.phone.replace(/[^\d+]/g, "")}`} className={`text-primary ${profileLink}`}>{vendor.phone}</a> : "None" },
          { label: "Tax ID", value: taxId },
          { label: "Payment terms", value: vendor.paymentTerms ?? "Not set" },
          { label: "Risk", value: RISK_LABEL[vendor.riskTier ?? "standard"] },
          { label: "Contract ends", value: vendor.contractEndsOn ? formatDayLong(vendor.contractEndsOn) : "Not set" },
          { label: "Spend a year", value: vendor.annualSpend ? `$${vendor.annualSpend.toLocaleString("en-US")}` : "Not set" },
          { label: "Your rating", value: vendor.rating ? `${vendor.rating} of 5` : "Not rated" },
          { label: "Added", value: formatDayLong(vendor.createdOn) },
        ]} />
      </Section>

      <Section title="Compliance documents" count={vendor.documents.length} testId="vendor-profile-docs">
        {vendor.documents.length === 0 ? <None>No documents tracked for this vendor.</None> : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">{total === 0 ? "No required documents." : `${done} of ${total} required documents in.`}</p>
            <ul className="divide-y">
              {vendor.documents.map((d) => {
                const state = docState(d, today);
                return (
                  <li key={d.id} className="grid gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-medium">{d.type}</span>
                      {!d.required && <Badge variant="outline">Optional</Badge>}
                      {d.file && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3" aria-hidden />{d.file.name}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.receivedOn ? `Received ${formatDayLong(d.receivedOn)}` : "Not received"}
                      {d.expiresOn ? ` · expires ${formatDayLong(d.expiresOn)}` : ""}
                    </span>
                    <Badge variant={DOC_BADGE[state]}>{DOC_LABEL[state]}</Badge>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Section>

      <Section title="Activity" count={log.length} testId="vendor-profile-activity">
        {log.length === 0 ? <None>Nothing logged yet. Add notes and reminders under Edit in Vendors.</None> : (
          <ol className="space-y-1.5">
            {log.map((n) => (
              <li key={n.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-xs text-muted-foreground">{formatDayLong(n.on)}</span>
                <Badge variant={n.kind === "reminder" ? "warning" : n.kind === "reply" ? "success" : "muted"}>{n.kind === "reminder" ? "Reminder" : n.kind === "reply" ? "Replied" : "Note"}</Badge>
                <span className="min-w-0 flex-1 break-words">{n.text}</span>
                <span className="text-xs text-muted-foreground">{n.by}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Notes">
        {vendor.notes ? <p className="whitespace-pre-line text-sm">{vendor.notes}</p> : <None>No notes.</None>}
      </Section>

      <Section title="Projects" count={linkedProjects.length} testId="vendor-projects">
        {linkedProjects.length === 0 ? <None>No projects linked to this vendor. Link one from the project's form.</None> : (
          <ul className="divide-y text-sm">
            {linkedProjects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href="/app/projects?view=projects" className={`font-medium ${profileLink}`}>{p.name}</Link>
                <span className="text-muted-foreground">{p.tasks.filter((t) => t.done).length} of {p.tasks.length} tasks done</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents">
        <p className="text-sm"><Link href={`/app?q=${encodeURIComponent(vendor.name)}`} className={`text-primary ${profileLink}`}>Find documents that mention {vendor.name}</Link></p>
      </Section>

      {people.length > 0 && (
        <Section title="People at this vendor" count={people.length}>
          <ul className="space-y-1 text-sm">
            {people.map((c) => <li key={c.id}><Link href={`/app/contacts/${c.id}`} className={`text-primary ${profileLink}`}>{c.name}</Link></li>)}
          </ul>
        </Section>
      )}
    </div>
  );
}
