"use client";

import { useState, type FormEvent } from "react";

const SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,000+"];
const field = "mt-1.5 w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Demo request. It opens the visitor's email app with the details filled in, addressed to NEXT_PUBLIC_SALES_EMAIL. */
export function DemoRequestForm() {
  const to = process.env.NEXT_PUBLIC_SALES_EMAIL ?? "";
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const get = (k: string) => String(d.get(k) ?? "").trim();
    const body = [
      `Name: ${get("name")}`, `Business email: ${get("email")}`, `Company: ${get("company")}`, `Company size: ${get("size")}`, "", get("message"),
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent("AdFlo demo request")}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-white/20 bg-white/[0.08] p-5 backdrop-blur-sm sm:p-6" aria-label="Request a demo">
      <h3 className="text-lg font-semibold text-white">Book a demo</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/90">Full name
          <input name="name" required autoComplete="name" className={field} />
        </label>
        <label className="text-sm text-white/90">Business email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="text-sm text-white/90">Company name
          <input name="company" required autoComplete="organization" className={field} />
        </label>
        <label className="text-sm text-white/90">Company size
          <select name="size" required defaultValue="" className={field}>
            <option value="" disabled className="text-black">Select…</option>
            {SIZES.map((s) => <option key={s} value={s} className="text-black">{s}</option>)}
          </select>
        </label>
        <label className="text-sm text-white/90 sm:col-span-2">Message
          <textarea name="message" rows={3} className={field} />
        </label>
      </div>
      <button type="submit" disabled={!to} className="mt-5 w-full rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
        Schedule your AdFlo demo
      </button>
      <p role="status" className="mt-3 text-xs text-white/70">
        {!to ? "Demo requests are not switched on yet: set NEXT_PUBLIC_SALES_EMAIL." : sent ? "Your email app should open with the request ready to send." : "This opens your email app with your details filled in."}
      </p>
    </form>
  );
}
