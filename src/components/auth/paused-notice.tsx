import { LogOut } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { pausedText, type Standing } from "@/lib/dms/standing";

/** Shown in place of the app when the client's account is paused or closed in the Control Center. */
export function PausedNotice({ standing, email }: { standing: Exclude<Standing, "ok">; email: string }) {
  const { title, body } = pausedText(standing);
  return (
    <AuthCard title={title} subtitle={email ? `Signed in as ${email}` : "AdFlo"}>
      <p className="text-sm text-muted-foreground">{body}</p>
      <form action="/auth/signout" method="post" className="mt-5">
        <Button type="submit" variant="outline"><LogOut /> Sign out</Button>
      </form>
    </AuthCard>
  );
}
