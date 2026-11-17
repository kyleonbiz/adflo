"use client";

import { useState, type FormEvent } from "react";
import { COMPANY_SIZES } from "@/lib/marketing/demo-request";

const field = "mt-1.5 w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Status = "idle" | "sending" | "sent" | "error";

/** Demo request. The page sends it to our server, which emails it to the sales inbox; nothing opens on the visitor's device. */
export function DemoRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/demo-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { setStatus("sent"); form.reset(); return; }
      setError(json?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    }
    setStatus("error");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-brand-violet/30 bg-brand-purple/10 p-5 backdrop-blur-sm sm:p-6" aria-label="Request a demo">
      <h3 className="text-lg font-semibold text-white">Book a demo</h3>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
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
            {COMPANY_SIZES.map((s) => <option key={s} value={s} className="text-black">{s}</option>)}
          </select>
        </label>
        <label className="text-sm text-white/90 sm:col-span-2">Message
          <textarea name="message" rows={3} className={field} />
        </label>
      </div>
      <button type="submit" disabled={status === "sending"} className="mt-5 w-full rounded-lg bg-gradient-to-r from-brand-blue to-brand-purple px-5 py-3 font-medium text-white shadow-lg shadow-brand-purple/30 transition hover:brightness-110 disabled:opacity-60">
        {status === "sending" ? "Sending…" : "Schedule your AdFlo demo"}
      </button>
      <p role="status" className={status === "error" ? "mt-3 text-xs text-red-200" : "mt-3 text-xs text-white/70"}>
        {status === "sent" ? "Thank you. We received your request and will email you soon." : status === "error" ? error : "We will reply by email, usually within one business day."}
      </p>
    </form>
  );
}
