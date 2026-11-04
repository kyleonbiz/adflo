"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_INFO, canOpenPath, useViewAs } from "@/lib/roles";

/** Shows the page only when the role being viewed may open it. */
export function RoleGate({ base, children }: { base: "/app"; children: React.ReactNode }) {
  const role = useViewAs();
  const pathname = usePathname();
  if (canOpenPath(role, pathname)) return <>{children}</>;
  return (
    <div role="status" className="mx-auto mt-10 max-w-md space-y-3 rounded-2xl border bg-card p-8 text-center shadow-panel">
      <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
      <h1 className="text-lg font-semibold">Not available for {ROLE_INFO[role].label}s</h1>
      <p className="text-sm text-muted-foreground">{ROLE_INFO[role].detail} Ask an Owner if you need access to this.</p>
      <Button asChild><Link href={`${base}/overview`}>Go to Home</Link></Button>
    </div>
  );
}
