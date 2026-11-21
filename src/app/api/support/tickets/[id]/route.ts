import { clientRoute, dbRefusal, refuse, reply } from "@/lib/support/client-route";
import { isUuid } from "@/lib/control/patterns";

export const dynamic = "force-dynamic";

/** The conversation on one of the caller's own requests: replies from AdFlo and their own follow-ups, never internal notes. */
export function GET(req: Request, ctx: RouteContext<"/api/support/tickets/[id]">) {
  return clientRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return refuse(404, "not_found", "Request not found.");
    const { data, error } = await supabase.rpc("workspace_ticket_messages", { p_ticket: id });
    if (error) return dbRefusal(error) ?? Promise.reject(error);
    const messages = ((data ?? []) as { id: string; from_client: boolean; author: string; body: string; created_at: string }[]).map((m) => ({ id: m.id, fromClient: m.from_client, author: m.author, body: m.body, createdAt: m.created_at }));
    return reply(200, { ok: true, messages });
  });
}
