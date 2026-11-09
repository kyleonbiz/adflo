"use client";

import { useState } from "react";
import { COMPANY_SIZES, type DemoRequestField } from "@/lib/leads/validation";

type Errors = Partial<Record<DemoRequestField, string>>;
const input = "mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive";

export function DemoForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending"); setProblem(""); setErrors({});
    try {
      const res = await fetch("/api/demo-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) { setStatus("sent"); form.reset(); return; }
      setErrors(data?.error?.fields ?? {});
      setProblem(data?.error?.message ?? "Something went wrong. Try again in a moment.");
    } catch {
      setProblem("We could not reach the server. Check your connection and try again.");
    }
    setStatus("idle");
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl bg-card p-8 text-card-foreground shadow-float">
        <h3 className="text-xl font-semibold tracking-tight">Thank you. Your request is in.</h3>
        <p className="mt-2 text-sm text-muted-foreground">We will be in touch about a time for your AdFlo demo.</p>
      </div>
    );
  }

  const field = (id: DemoRequestField, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`demo-${id}`} className="text-sm font-medium">{label}</label>
      <input id={`demo-${id}`} name={id} required aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `demo-${id}-err` : undefined} className={input} {...props} />
      {errors[id] && <p id={`demo-${id}-err`} className="mt-1 text-xs text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-card p-6 text-card-foreground shadow-float sm:p-8" aria-label="Book a demo">
      {field("name", "Full name", { autoComplete: "name" })}
      {field("email", "Business email", { type: "email", autoComplete: "email" })}
      {field("company", "Company name", { autoComplete: "organization" })}
      <div>
        <label htmlFor="demo-size" className="text-sm font-medium">Company size</label>
        <select id="demo-size" name="size" required defaultValue="" aria-invalid={!!errors.size} className={input}>
          <option value="" disabled>Choose a size</option>
          {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} people</option>)}
        </select>
        {errors.size && <p className="mt-1 text-xs text-destructive">{errors.size}</p>}
      </div>
      <div>
        <label htmlFor="demo-message" className="text-sm font-medium">Message <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea id="demo-message" name="message" rows={3} maxLength={2000} className={input} />
      </div>
      {/* Only bots fill this in. */}
      <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <button type="submit" disabled={status === "sending"} className="w-full rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
        {status === "sending" ? "Sending…" : "Schedule your AdFlo demo"}
      </button>
    </form>
  );
}
