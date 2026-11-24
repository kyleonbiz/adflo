"use client";

import { useState, type FormEvent } from "react";
import { PARTNER_TYPES } from "@/lib/marketing/partner-request";

const field = "mt-1.5 w-full rounded-lg border border-input bg-white/80 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Status = "idle" | "sending" | "sent" | "error";

/** Partner inquiry. Sent to our server, which emails it to the sales inbox. */
export function PartnerRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/partner-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { setStatus("sent"); form.reset(); return; }
      setError(json?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    }
    setStatus("error");
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border bg-white p-5 shadow-sm sm:p-6" aria-label="Partner inquiry">
      <h2 className="text-lg font-semibold text-foreground">Start a conversation</h2>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-foreground">Full name
          <input name="name" required autoComplete="name" className={field} />
        </label>
        <label className="text-sm text-foreground">Email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className="text-sm text-foreground">Organization
          <input name="organization" required autoComplete="organization" className={field} />
        </label>
        <label className="text-sm text-foreground">What best describes you?
          <select name="type" required defaultValue="" className={field}>
            <option value="" disabled className="text-black">Select…</option>
            {PARTNER_TYPES.map((t) => <option key={t} value={t} className="text-black">{t}</option>)}
          </select>
        </label>
        <label className="text-sm text-foreground sm:col-span-2">Who do you serve, and how might you introduce AdFlo?
          <textarea name="message" rows={4} className={field} />
        </label>
      </div>
      <button type="submit" disabled={status === "sending"} className="mt-5 w-full rounded-lg bg-primary px-5 py-3 font-medium text-white shadow-sm transition-colors hover:bg-[#1757c2] disabled:opacity-60">
        {status === "sending" ? "Sending…" : "Send partner inquiry"}
      </button>
      <p role="status" className={status === "error" ? "mt-3 text-xs text-red-600" : "mt-3 text-xs text-muted-foreground"}>
        {status === "sent" ? "Thank you. We received your message and will email you soon." : status === "error" ? error : "We will reply by email, usually within one business day."}
      </p>
    </form>
  );
}
