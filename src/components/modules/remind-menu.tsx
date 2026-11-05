"use client";

import { AlarmClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { REMIND_CHOICES, clearReminder, reminderId, setReminder, type Reminder } from "@/lib/reminders/logic";
import { saveReminders, useReminders } from "@/lib/reminders/storage";
import { formatDayShort } from "@/lib/dates";

/** A small "Remind me" menu for one request or task. Picking a day puts it in the bell and on the home feed from then on. */
export function RemindMenu({ kind, id, text, area, href, today }: { kind: "request" | "task"; id: string; text: string; area: Reminder["area"]; href: string; today: string }) {
  const list = useReminders();
  const key = reminderId(kind, id);
  const current = list.find((r) => r.id === key);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={current ? `Reminder set for ${formatDayShort(current.on)}: ${text}` : `Remind me about ${text}`} title={current ? `Reminder ${formatDayShort(current.on)}` : "Remind me"} className={current ? "text-primary" : undefined}>
          <AlarmClock />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {REMIND_CHOICES.map((c) => (
          <DropdownMenuItem key={c.days} onSelect={() => saveReminders(setReminder(list, { id: key, text, area, href }, today, c.days))}>{c.label}</DropdownMenuItem>
        ))}
        {current && <DropdownMenuItem onSelect={() => saveReminders(clearReminder(list, key))}>Clear reminder</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
