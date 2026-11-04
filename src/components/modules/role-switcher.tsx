"use client";

import { Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLES, ROLE_INFO, setViewAs, useViewAs, type Role } from "@/lib/roles";

/** Preview AdFlo as each role. A stand-in until sign-in carries real roles. */
export function RoleSwitcher() {
  const role = useViewAs();
  return (
    <div className="flex items-center gap-1.5">
      <Eye className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
      <Select value={role} onValueChange={(v) => setViewAs(v as Role)}>
        <SelectTrigger aria-label="View as" className="h-9 w-32 text-xs sm:w-36">
          <span className="text-muted-foreground">View as:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_INFO[r].label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
