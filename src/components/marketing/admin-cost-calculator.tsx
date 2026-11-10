"use client";

import { useId, useState } from "react";
import {
  DEFAULT_SAVED_PCT, DEFAULT_USED_PCT, LIMITS, WEEKS_PER_YEAR, clampNumber, estimateAdminCost, formatUsd, formatWeeks,
} from "@/lib/marketing/admin-cost";

type Who = "me" | "team";

const field = "mt-1.5 w-full rounded-lg border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:ring-2 focus-visible:ring-ring";
const gradientBtn = "bg-gradient-to-r from-brand-blue to-brand-purple text-white shadow-lg shadow-brand-purple/30 transition hover:brightness-110";

const COPY: Record<Who, { hours: string; hoursHint: string; rate: string; rateHint: string }> = {
  me: {
    hours: "Hours a week on admin",
    hoursHint: "Paperwork, renewals, invoicing, chasing documents, filing.",
    rate: "Your hourly value ($)",
    rateHint: "What you bill, or what an hour of selling and delivering earns you.",
  },
  team: {
    hours: "Team hours a week on admin",
    hoursHint: "Everyone’s admin hours added together: paperwork, renewals, invoicing, filing.",
    rate: "Hourly cost of that time ($)",
    rateHint: "Wages plus payroll costs. Typically 20–30% above the hourly wage.",
  },
};

/** The "What is admin costing you?" calculator. Everything is worked out in the browser; nothing is sent or stored. */
export function AdminCostCalculator() {
  const id = useId();
  const [who, setWho] = useState<Who>("me");
  const [hours, setHours] = useState("10");
  const [rate, setRate] = useState("100");
  const [savedPct, setSavedPct] = useState(DEFAULT_SAVED_PCT);
  const [usedPct, setUsedPct] = useState(DEFAULT_USED_PCT);
  const copy = COPY[who];

  const estimate = estimateAdminCost({
    hoursPerWeek: clampNumber(hours, LIMITS.hoursPerWeek.min, LIMITS.hoursPerWeek.max),
    hourlyValue: clampNumber(rate, LIMITS.hourlyValue.min, LIMITS.hourlyValue.max),
    savedPct,
    usedPct,
  });
  const empty = estimate.annualCost === 0;

  return (
    <section id="admin-cost" className="scroll-mt-4 border-y border-white/10 bg-gradient-to-b from-brand-purple-deep/30 to-black/20" aria-labelledby="admin-cost-title">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-sm font-medium text-[#b9a2ff]">Admin cost calculator</p>
        <h2 id="admin-cost-title" className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">How much time are you losing to admin work?</h2>
        <p className="mt-3 max-w-2xl text-white/75">
          Every hour spent on paperwork is an hour not spent winning work, serving customers or growing the business. Put in your own numbers to see what that adds up to.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm sm:p-6" aria-label="Admin cost inputs" onSubmit={(e) => e.preventDefault()}>
            <fieldset>
              <legend className="text-sm font-medium text-white/90">Whose time is it?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([["me", "My time"], ["team", "My team’s time"]] as const).map(([value, label]) => (
                  <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${who === value ? "border-brand-violet bg-brand-purple/40 text-white" : "border-white/25 bg-white/10 text-white/80 hover:bg-white/15"}`}>
                    <input type="radio" name={`${id}-who`} value={value} checked={who === value} onChange={() => setWho(value)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-hours`} className="text-sm text-white/90">{copy.hours}</label>
                <input
                  id={`${id}-hours`} type="number" inputMode="decimal" min={LIMITS.hoursPerWeek.min} max={LIMITS.hoursPerWeek.max} step="0.5"
                  value={hours} onChange={(e) => setHours(e.target.value)} aria-describedby={`${id}-hours-hint`} className={field}
                />
                <p id={`${id}-hours-hint`} className="mt-1.5 text-xs text-white/65">{copy.hoursHint}</p>
              </div>
              <div>
                <label htmlFor={`${id}-rate`} className="text-sm text-white/90">{copy.rate}</label>
                <input
                  id={`${id}-rate`} type="number" inputMode="decimal" min={LIMITS.hourlyValue.min} max={LIMITS.hourlyValue.max} step="5"
                  value={rate} onChange={(e) => setRate(e.target.value)} aria-describedby={`${id}-rate-hint`} className={field}
                />
                <p id={`${id}-rate-hint`} className="mt-1.5 text-xs text-white/65">{copy.rateHint}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-sm font-medium text-white/90">Assumptions you can change</p>
              <div className="mt-3 space-y-4">
                <div>
                  <label htmlFor={`${id}-saved`} className="flex items-baseline justify-between gap-3 text-sm text-white/85">
                    <span>Share of admin time AdFlo could take over</span><output htmlFor={`${id}-saved`} className="font-semibold text-white">{savedPct}%</output>
                  </label>
                  <input id={`${id}-saved`} type="range" min={LIMITS.savedPct.min} max={LIMITS.savedPct.max} step="5" value={savedPct} onChange={(e) => setSavedPct(Number(e.target.value))} className="mt-2 w-full accent-[#9b7bff]" />
                </div>
                <div>
                  <label htmlFor={`${id}-used`} className="flex items-baseline justify-between gap-3 text-sm text-white/85">
                    <span>Share of freed time put to paying use</span><output htmlFor={`${id}-used`} className="font-semibold text-white">{usedPct}%</output>
                  </label>
                  <input id={`${id}-used`} type="range" min={LIMITS.usedPct.min} max={LIMITS.usedPct.max} step="5" value={usedPct} onChange={(e) => setUsedPct(Number(e.target.value))} className="mt-2 w-full accent-[#9b7bff]" />
                  <p className="mt-1.5 text-xs text-white/65">Not every freed hour becomes revenue or a saved hire, so we start at half.</p>
                </div>
              </div>
            </div>
          </form>

          <div className="flex flex-col rounded-2xl border border-brand-violet/30 bg-gradient-to-br from-brand-purple/30 to-brand-blue/10 p-5 sm:p-7" aria-live="polite" data-testid="admin-cost-result">
            {empty ? (
              <p className="my-auto text-white/80">Enter the hours a week and what an hour is worth, and your numbers will appear here.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-[#b9a2ff]">Admin work is costing you about</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight text-white sm:text-5xl" data-testid="admin-cost-annual">{formatUsd(estimate.annualCost)}<span className="text-lg font-medium text-white/70"> a year</span></p>
                <p className="mt-2 text-white/80">
                  That is {Math.round(estimate.hoursPerYear).toLocaleString("en-US")} hours a year, or {formatWeeks(estimate.workingWeeks)} of full-time work.
                </p>

                <div className="mt-6 rounded-xl border border-white/15 bg-black/20 p-4">
                  <p className="text-sm font-medium text-white/90">A realistic amount to win back</p>
                  <p className="mt-1 text-2xl font-semibold text-white" data-testid="admin-cost-recoverable">{formatUsd(estimate.recoverable)}<span className="text-base font-medium text-white/70"> a year</span></p>
                  <p className="mt-1 text-sm text-white/75">
                    {Math.round(estimate.hoursSaved).toLocaleString("en-US")} hours freed, with {usedPct}% of them put to paying use.
                  </p>
                </div>

                <p className="mt-5 text-xs text-white/65">
                  An estimate from the numbers you entered, based on {WEEKS_PER_YEAR} working weeks a year. It is not a quote or a guarantee, and your results will differ.
                </p>
              </>
            )}
            <a href="#demo-form" className={`mt-6 inline-block rounded-lg px-5 py-3 text-center font-medium ${gradientBtn}`}>See how AdFlo gets that time back</a>
          </div>
        </div>
      </div>
    </section>
  );
}
