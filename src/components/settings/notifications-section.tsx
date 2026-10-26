"use client";

import { BellRing } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { saveSettings, useSettings } from "@/lib/settings/storage";
import { LEAD_DAYS, NOTIFICATION_INFO, NOTIFICATION_KEYS } from "@/lib/settings/types";
import { cn } from "@/lib/utils";

export function NotificationsSection() {
  const settings = useSettings();
  const { enabled, leadDays } = settings.notifications;
  const update = (n: Partial<typeof settings.notifications>) => saveSettings({ ...settings, notifications: { ...settings.notifications, ...n } });

  return (
    <section aria-label="Notifications" className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel">
      <ul className="divide-y">
        {NOTIFICATION_KEYS.map((k) => (
          <li key={k} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <div>
              <p id={`n-${k}`} className="text-sm font-medium">{NOTIFICATION_INFO[k].label}</p>
              <p className="text-xs text-muted-foreground">{NOTIFICATION_INFO[k].detail}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled[k]}
              aria-labelledby={`n-${k}`}
              onClick={() => update({ enabled: { ...enabled, [k]: !enabled[k] } })}
              className={cn("relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", enabled[k] ? "bg-primary" : "bg-input")}
            >
              <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", enabled[k] && "translate-x-5")} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="lead-days">Start reminders</Label>
        <Select value={String(leadDays)} onValueChange={(v) => update({ leadDays: Number(v) as typeof leadDays })}>
          <SelectTrigger id="lead-days" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{LEAD_DAYS.map((d) => <SelectItem key={d} value={String(d)}>{d} days before</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <BellRing className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Your choices are saved in this browser. Emails start going out once email delivery is connected.
      </p>
    </section>
  );
}
