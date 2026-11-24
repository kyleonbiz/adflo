import { route } from "@/lib/dms/server/respond";
import { uuid } from "@/lib/dms/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reads an invoice or receipt (who it is from, number, dates, total). Anyone who can open the document can ask. */
export async function GET(req: Request, ctx: RouteContext<"/api/dms/documents/[id]/bill">) {
  const { id } = await ctx.params;
  return route(req, ({ service }) => service.readBill(uuid.parse(id)));
}
