import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Sub-processors" };

const ROWS = [
  ["Supabase", "Database, sign-in and file storage", "All workspace content and account details"],
  ["Vercel", "Application hosting and delivery", "Requests and logs; content in transit"],
  ["Anthropic", "Addy assistant (live mode only)", "Questions you ask Addy and the context sent with them"],
];

export default function SubprocessorsPage() {
  return (
    <LegalPage title="Sub-processors">
      <p>These providers process client data on our behalf. We will update this list before adding a new one.</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Provider</th><th className="p-3">Purpose</th><th className="p-3">Data involved</th></tr></thead>
          <tbody>{ROWS.map((r) => <tr key={r[0]} className="border-t">{r.map((c, i) => <td key={i} className={i === 0 ? "p-3 font-medium" : "p-3"}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Add your email provider and error tracker here when you choose them.</p>
    </LegalPage>
  );
}
