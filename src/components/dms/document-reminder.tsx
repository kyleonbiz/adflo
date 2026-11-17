"use client";

import { useState } from "react";
import { AlarmClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayShort, isDay } from "@/lib/dates";
import { clearReminder, reminderId, setReminderOn } from "@/lib/reminders/logic";
import { saveReminders, useReminders } from "@/lib/reminders/storage";
import { useToday } from "@/components/modules/use-today";
import { SectionLabel } from "./document-metadata";

/** A reminder about one document, on any day and with any note. It shows in the bell from that day. */
export function DocumentReminder({ docId, docName }: { docId: string; docName: string }) {
  const today = useToday() ?? "";
  const list = useReminders();
  const key = reminderId("document", docId);
  const current = list.find((r) => r.id === key);
  const [on, setOn] = useState("");
  const [note, setNote] = useState("");
  const valid = isDay(on) && on >= today;
  return (
    <section aria-labelledby="reminder-heading">
      <SectionLabel id="reminder-heading">Reminder</SectionLabel>
      {current && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="document-reminder-current">
          <AlarmClock className="size-3.5 text-primary" aria-hidden /> {formatDayShort(current.on)}: {current.text}
        </p>
      )}
      <div className="space-y-2">
        <Input type="date" aria-label="Reminder date" min={today} value={on} onChange={(e) => setOn(e.target.value)} className="h-9 text-xs" />
        <Input aria-label="Reminder note" placeholder="What should you be reminded of?" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-xs" />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!valid}
            onClick={() => {
              saveReminders(setReminderOn(list, { id: key, text: note.trim() ? `${docName}: ${note.trim()}` : `Check ${docName}`, area: "Documents", href: "/app" }, on));
              setOn("");
              setNote("");
            }}
          >
            {current ? "Change reminder" : "Set reminder"}
          </Button>
          {current && <Button size="sm" variant="outline" onClick={() => saveReminders(clearReminder(list, key))}>Clear</Button>}
        </div>
      </div>
    </section>
  );
}
