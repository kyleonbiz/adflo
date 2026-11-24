import { route } from "@/lib/dms/server/respond";
import { uuid } from "@/lib/dms/validation";

export const dynamic = "force-dynamic";

/** Other documents that look like the same file (same size and name). Anyone who can open the document can ask. */
export async function GET(req: Request, ctx: RouteContext<"/api/dms/documents/[id]/duplicates">) {
  const { id } = await ctx.params;
  return route(req, ({ service }) => service.findDuplicates(uuid.parse(id)));
}
