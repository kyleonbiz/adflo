"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_REPEATS } from "@/lib/projects/types";
import { taskFormSchema, type TaskFormValues } from "@/lib/projects/validation";

const CADENCES = TASK_REPEATS.filter((r) => r.value !== "none");

/** Adds a task that comes round again to the Recurring work project. Finishing it schedules the next one. */
export function RecurringTaskDialog({ open, today, onOpenChange, onSave }: { open: boolean; today: string; onOpenChange: (open: boolean) => void; onSave: (values: TaskFormValues) => void }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [repeat, setRepeat] = useState("monthly");
  const [dueOn, setDueOn] = useState(today);
  const [error, setError] = useState("");
  const close = (o: boolean) => { if (!o) { setTitle(""); setAssignee(""); setRepeat("monthly"); setDueOn(today); setError(""); } onOpenChange(o); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogTitle>Add a recurring task</DialogTitle>
        <DialogDescription className="mt-1">It goes in the Recurring work project. When you finish it, the next one is scheduled for you.</DialogDescription>
        <form
          noValidate
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = taskFormSchema.safeParse({ title, assignee, dueOn, repeat });
            if (!parsed.success) return setError(parsed.error.issues[0].message);
            onSave(parsed.data);
            close(false);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="rec-title">Task</Label>
            <Input id="rec-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoComplete="off" placeholder="Reconcile bank statements" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-repeat">How often</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger id="rec-repeat" aria-label="How often"><SelectValue /></SelectTrigger>
                <SelectContent>{CADENCES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-due">First due</Label>
              <Input id="rec-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-who">Who does it (optional)</Label>
            <Input id="rec-who" value={assignee} onChange={(e) => setAssignee(e.target.value)} maxLength={80} autoComplete="off" />
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit">Add recurring task</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
