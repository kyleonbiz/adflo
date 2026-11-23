import type { Metadata } from "next";
import { SupportCenter } from "@/components/support/support-center";
import { renderAppShell } from "@/lib/app-shell";
import { loadMyTickets } from "@/lib/support/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

async function MyRequests() {
  return <SupportCenter tickets={await loadMyTickets(await createServerSupabase())} />;
}

export default function SupportRoute() {
  return renderAppShell("/app/support", (mode) =>
    mode === "live" ? <MyRequests /> : (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-panel">
        <h1 className="text-xl font-semibold tracking-tight">Support</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your AdFlo workspace to send requests and follow replies. In the meantime, email support@adflo.pro.</p>
      </div>
    ),
  );
}
