import Link from "next/link";

/** A slim bar across the top of the app during a free trial: days left, and the way to keep going. */
export function TrialBanner({ daysLeft, endsOn }: { daysLeft: number; endsOn: string }) {
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-2.5 text-sm">
      <p>
        <span className="font-semibold">Free trial:</span> {daysLeft <= 1 ? "last day" : `${daysLeft} days left`} (ends {endsOn}). You are looking at sample data. Subscribe to set up your own workspace.
      </p>
      <Link href="/trial/continue" className="rounded-md bg-primary px-4 py-1.5 font-medium text-white shadow-sm hover:bg-[#1757c2]">Continue for $99/month</Link>
    </div>
  );
}
