"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { effectivePriceCents, formatMoney, type ClientRecord, type Plan } from "@/lib/control/types";
import { ClientTiles } from "./client-billing";
import { OnboardingGuide } from "./onboarding-guide";
import { ClientDialog } from "./clients-page";
import { StatusBadge } from "./status-badge";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "Never");

const SECTIONS = [["details", "Details"], ["account", "Account"], ["onboarding", "Onboarding"], ["billing", "Billing"], ["agreements", "Agreements"], ["support", "Support"], ["history", "History"]] as const;

/** One client's profile: summary, quick actions, then every part of their account in one place. */
export function ClientDetail({ client, plans, canEdit, isOwner, today, sample, openTickets, account, children }: { client: ClientRecord; plans: Plan[]; canEdit: boolean; isOwner: boolean; today: string; sample: boolean; openTickets: number; account?: React.ReactNode; children?: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const price = effectivePriceCents(client, plans);
  
  const facts: [string, React.ReactNode][] = [
    ["Plan", <span key="p" className="capitalize">{client.plan}</span>],
    ["Price per month", price == null ? "Not set" : <>{formatMoney(price)}{client.priceOverrideCents != null && <span className="ml-1 text-xs text-muted-foreground">own price{client.priceNote ? `: ${client.priceNote}` : ""}</span>}</>],
    ["Seats", `${client.seatsUsed ?? "—"} used of ${client.seatsLimit}`],
    ["Last sign-in", day(client.lastActive)],
    ["Owner", client.ownerName ? `${client.ownerName}${client.ownerEmail ? ` · ${client.ownerEmail}` : ""}` : client.ownerEmail || "—"],
    ["Client since", day(client.startedOn)],
  ];

  return (
    <div className="space-y-5">
      <Link href="/control/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Clients</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <StatusBadge status={client.status} />
        </div>
        {canEdit && <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>}
      </div>

      <ClientTiles client={client} plans={plans} today={today} sample={sample} openTickets={openTickets} />

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="h-8 rounded-full border bg-card px-3 text-xs font-medium leading-8 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{label}</a>)}
      </nav>

      <section id="details" className="scroll-mt-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Details">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map(([k, v]) => (<div key={k} className="min-w-0"><dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words text-sm font-medium">{v}</dd></div>))}
        </dl>
        {client.notes && <p className="mt-4 whitespace-pre-wrap border-t pt-4 text-sm text-muted-foreground">{client.notes}</p>}
      </section>

      {account}

      <OnboardingGuide client={client} canEdit={canEdit} onEdit={() => setEditing(true)} />

      {children}
      {editing && <ClientDialog client={client} plans={plans} isOwner={isOwner} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); router.refresh(); }} />}
    </div>
  );
}
