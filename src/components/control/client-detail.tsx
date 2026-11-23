"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ClientRecord, Plan, UnlinkedWorkspace } from "@/lib/control/types";
import { ClientTiles } from "./client-billing";
import { ClientUsage } from "./client-usage";
import { WorkspaceCard } from "./workspace-card";
import { OnboardingGuide } from "./onboarding-guide";
import { ClientDialog } from "./clients-page";
import { Badge } from "@/components/ui/badge";
import { isNewClient } from "@/lib/control/onboarding";
import { StatusBadge } from "./status-badge";

const SECTIONS = [["account", "Account"], ["onboarding", "Onboarding"], ["billing", "Billing"], ["agreements", "Agreements"], ["support", "Support"], ["history", "History"]] as const;

/** One client's profile: summary, quick actions, then every part of their account in one place. */
export function ClientDetail({ client, plans, canEdit, isOwner, today, sample, openTickets, unlinked = [], children }: { client: ClientRecord; plans: Plan[]; canEdit: boolean; isOwner: boolean; today: string; sample: boolean; openTickets: number; unlinked?: UnlinkedWorkspace[]; children?: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  
  return (
    <div className="space-y-5">
      <Link href="/control/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden /> Clients</Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={client.status} />
          {isNewClient(client, today) && <Badge variant="warning">New · needs onboarding</Badge>}
        </div>
      </div>

      <ClientTiles client={client} plans={plans} today={today} sample={sample} openTickets={openTickets} />

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`} className="h-8 rounded-full border bg-card px-3 text-xs font-medium leading-8 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">{label}</a>)}
      </nav>

      <ClientUsage client={client} />

      <div id="account" className="scroll-mt-4"><WorkspaceCard client={client} plans={plans} unlinked={unlinked} canEdit={canEdit} isOwner={isOwner} onEdit={() => setEditing(true)} /></div>

      <OnboardingGuide client={client} canEdit={canEdit} onEdit={() => setEditing(true)} />

      {children}
      {editing && <ClientDialog client={client} plans={plans} isOwner={isOwner} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); router.refresh(); }} />}
    </div>
  );
}
