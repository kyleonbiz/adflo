import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestThread } from "@/components/support/request-thread";
import { renderAppShell } from "@/lib/app-shell";
import { isUuid } from "@/lib/control/patterns";
import { loadMyTicket } from "@/lib/support/data";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support request" };
export const dynamic = "force-dynamic";

async function Thread({ id }: { id: string }) {
  const ticket = isUuid(id) ? await loadMyTicket(await createServerSupabase(), id) : null;
  if (!ticket) notFound();
  return <RequestThread ticket={ticket} />;
}

export default async function SupportRequestRoute({ params }: PageProps<"/app/support/[id]">) {
  const { id } = await params;
  return renderAppShell(`/app/support/${id}`, (mode) => (mode === "live" ? <Thread id={id} /> : notFound()));
}
