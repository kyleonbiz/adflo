import { NextResponse } from "next/server";
import { getStatusReport } from "@/lib/status";

export const dynamic = "force-dynamic";

/** Public, no sign-in. Returns 503 when something is down so an uptime monitor can alert on the status code alone. */
export async function GET() {
  const report = await getStatusReport();
  return NextResponse.json(report, {
    status: report.level === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
