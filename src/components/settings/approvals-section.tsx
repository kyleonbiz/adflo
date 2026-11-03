"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHAIN_KINDS, MAX_NAME, MAX_STEPS, cleanSteps, type ChainKind } from "@/lib/approvals/chain";
import { saveChains, useChains } from "@/lib/approvals/storage";

function Chain({ kind }: { kind: (typeof CHAIN_KINDS)[number] }) {
  const chains = useChains();
  const steps = chains[kind.id];
  const [name, setName] = useState("");
  const set = (next: string[]) => saveChains({ ...chains, [kind.id as ChainKind]: cleanSteps(next) });
  const move = (i: number, by: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    set(next);
  };

  return (
    <section aria-label={`${kind.label} approval chain`} className="space-y-3 rounded-2xl border bg-card p-5 shadow-panel" data-testid={`chain-${kind.id}`}>
      <div>
        <h3 className="text-base font-semibold">{kind.label}</h3>
        <p className="text-sm text-muted-foreground">{kind.blurb}</p>
      </div>
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kind.fallback ? `No chain set. ${kind.fallback} approves on their own.` : "No chain set. Each form's own approver decides."}</p>
      ) : (
        <ol className="space-y-1.5">
          {steps.map((s, i) => (
            <li key={s} data-testid="chain-step" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{s}</span>
              <Button size="icon-sm" variant="ghost" aria-label={`Move ${s} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Move ${s} down`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${s}`} onClick={() => set(steps.filter((x) => x !== s))}><X /></Button>
            </li>
          ))}
        </ol>
      )}
      {steps.length < MAX_STEPS && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; set([...steps, name]); setName(""); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="Name or role, e.g. Finance manager" aria-label={`Add an approver for ${kind.label.toLowerCase()}`} className="max-w-xs" />
          <Button type="submit" variant="outline" disabled={!name.trim()}><Plus /> Add step</Button>
        </form>
      )}
    </section>
  );
}

/** Who signs off, and in what order, for the things that need approval. Saved in this browser. */
export function ApprovalsSection() {
  return (
    <div className="space-y-4">
      {CHAIN_KINDS.map((k) => <Chain key={k.id} kind={k} />)}
    </div>
  );
}
