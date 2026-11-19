import { NextResponse } from "next/server";
import { fail, staffRoute } from "@/lib/control/api";
import { issueInviteLink } from "@/lib/control/invite";
import { isUuid } from "@/lib/control/workspace";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** Makes a fresh confirm link for the owner's open invitation, to put in a message staff send by hand. Nothing is emailed. */
export function POST(req: Request, ctx: RouteContext<"/api/control/clients/[id]/invite-link">) {
  return staffRoute(req, async ({ supabase }) => {
    const { id } = await ctx.params;
    if (!isUuid(id)) return fail(404, "not_found", "Client not found.");
    const r = await issueInviteLink(supabase, id, siteOrigin(req.url));
    if (!r.ok) return fail(r.status, "no_invite", r.message);
    return NextResponse.json({ ok: true, link: r.link, expiresAt: r.expiresAt });
  });
}
