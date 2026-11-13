import type { Metadata } from "next";
import { getStatusReport, type ServiceLevel } from "@/lib/status";

export const metadata: Metadata = { title: "Status · AdFlo" };
export const dynamic = "force-dynamic";

const HEADLINE: Record<ServiceLevel, string> = {
  operational: "All systems operational",
  degraded: "Some systems are slow",
  down: "We are having a problem",
};
const LABEL: Record<ServiceLevel, string> = { operational: "Operational", degraded: "Slow", down: "Down" };

export default async function StatusPage() {
  const report = await getStatusReport();
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">AdFlo status</h1>
      <p role="status" className="mt-4 rounded-lg border p-4 text-lg font-medium">{HEADLINE[report.level]}</p>
      <ul className="mt-6 divide-y rounded-lg border">
        {report.services.map((s) => (
          <li key={s.name} className="flex items-start justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-muted-foreground">{s.detail}</p>
            </div>
            <span className="text-sm font-medium">{LABEL[s.level]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Checked {new Date(report.checkedAt).toUTCString()}. Reload to check again. Support: weekdays, 9am to 5pm Eastern, kyleonbiz@gmail.com.
      </p>
    </main>
  );
}
