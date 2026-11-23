"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Proposal } from "@/lib/assistant/proposal";

export type ProposalState =
  | { status: "pending" }
  | { status: "approved"; text: string; undone: boolean }
  | { status: "rejected" }
  | { status: "failed"; error: string };

/**
 * A change Addy proposes, in plain words. Nothing is saved until Approve. Reject drops it; Edit opens the service's own
 * form with the details filled in. After Approve, Undo removes what was added.
 */
export function ProposalCard({ proposal, state, expired, onApprove, onReject, onUndo }: {
  proposal: Proposal; state: ProposalState; expired: boolean; onApprove: () => void; onReject: () => void; onUndo: () => void;
}) {
  return (
    <div role="group" aria-label={`Proposal: ${proposal.title}`} className="space-y-2 rounded-xl border bg-card p-3 text-foreground" data-testid="proposal-card">
      <p className="text-sm font-medium">{proposal.title}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {proposal.lines.map((l) => (<div key={l.label} className="contents"><dt className="text-muted-foreground">{l.label}</dt><dd>{l.value}</dd></div>))}
      </dl>
      {state.status === "pending" && (
        expired
          ? <p className="text-xs text-muted-foreground">This proposal expired. Ask Addy again.</p>
          : (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" className="h-8" onClick={onApprove}>Approve</Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={onReject}>Reject</Button>
              <Link href={proposal.href} className="inline-flex h-8 items-center rounded-lg border bg-card px-2.5 text-xs font-medium hover:bg-accent">Edit</Link>
              <span className="text-xs text-muted-foreground">Nothing is saved until you approve.</span>
            </div>
          )
      )}
      {state.status === "approved" && (
        <div className="flex items-center gap-2 text-xs" data-testid="proposal-approved">
          <span>{state.undone ? "Undone. Nothing was kept." : state.text}</span>
          {!state.undone && <Button type="button" size="sm" variant="outline" className="h-7" onClick={onUndo}>Undo</Button>}
        </div>
      )}
      {state.status === "rejected" && <p className="text-xs text-muted-foreground" data-testid="proposal-rejected">Rejected. Nothing was saved.</p>}
      {state.status === "failed" && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">{state.error}</p>
          <div className="flex gap-2">
            <Link href={proposal.href} className="inline-flex h-8 items-center rounded-lg border bg-card px-2.5 text-xs font-medium hover:bg-accent">Edit</Link>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={onReject}>Reject</Button>
          </div>
        </div>
      )}
    </div>
  );
}
