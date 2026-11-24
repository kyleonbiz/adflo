import { route } from "@/lib/dms/server/respond";
import { uuid } from "@/lib/dms/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reads an insurance document as a certificate of insurance (who is insured, each policy and its dates). Anyone who can open the document can ask. */
export async function GET(req: Request, ctx: RouteContext<"/api/dms/documents/[id]/certificate">) {
  const { id } = await ctx.params;
  return route(req, ({ service }) => service.readCertificate(uuid.parse(id)));
}
