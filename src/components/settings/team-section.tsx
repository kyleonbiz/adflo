"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { TeamDialog, assignableRoles } from "@/components/dms/team-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DmsApi } from "@/lib/dms/client/api";
import { createHttpApi } from "@/lib/dms/client/http-api";
import { toDmsError } from "@/lib/dms/errors";
import type { Bootstrap, Team } from "@/lib/dms/types";

/** Who has access to the workspace. Managing the team reuses the Documents team dialog. */
export function TeamSection({ mode }: { mode: "live" | "preview" }) {
  if (mode === "preview") {
    return (
      <section aria-label="Team" className="rounded-2xl border bg-card p-5 shadow-panel">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
          Team access turns on once your database is connected. You will invite people by email and give each one a role: Viewer, Editor, Admin or Owner.
        </p>
      </section>
    );
  }
  return <LiveTeam />;
}

function LiveTeam() {
  const [api] = useState<DmsApi>(() => createHttpApi("live"));
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [b, t] = await Promise.all([api.bootstrap(), api.getTeam()]);
      setBoot(b); setTeam(t); setError("");
    } catch (e) { setError(toDmsError(e).message); }
  }, [api]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) return <p role="alert" className="rounded-2xl border bg-card p-5 text-sm text-destructive shadow-panel">{error}</p>;
  if (!boot || !team) return <Skeleton className="h-40 rounded-2xl" aria-busy="true" />;
  const canManage = assignableRoles(boot.role).length > 0 && (boot.role === "owner" || boot.role === "admin");

  return (
    <section aria-label="Team" className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{team.members.length} {team.members.length === 1 ? "person has" : "people have"} access{team.invites.length > 0 && `, ${team.invites.length} invited`}.</p>
        {canManage && <Button variant="outline" onClick={() => setOpen(true)}><Users /> Manage team</Button>}
      </div>
      <ul className="divide-y" data-testid="team-list">
        {team.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{m.displayName}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
            <Badge variant="muted" className="capitalize">{m.role}</Badge>
          </li>
        ))}
        {team.invites.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
            <p className="truncate text-sm text-muted-foreground">{i.email}</p>
            <Badge variant="outline">Invited · {i.role}</Badge>
          </li>
        ))}
      </ul>
      {!canManage && <p className="text-xs text-muted-foreground">Only owners and admins can invite or remove people.</p>}
      {note && <p role="status" className="text-sm text-muted-foreground">{note}</p>}
      {canManage && (
        <TeamDialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) void load(); }} api={api} myRole={boot.role} myUserId={boot.user.id} onNotify={(_, msg) => setNote(msg)} />
      )}
    </section>
  );
}
