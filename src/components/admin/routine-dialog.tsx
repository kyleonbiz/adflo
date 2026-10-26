"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "@/lib/dates";
import { suggestCategory } from "@/lib/admin/triage";
import { CATEGORIES, EVERY, type Category, type Routine } from "@/lib/admin/types";
import { routineFormSchema } from "@/lib/admin/validation";

function Body({ today, onClose, onSave }: { today: string; onClose: () => void; onSave: (r: Omit<Routine, "id">) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [every, setEvery] = useState("monthly");
  const [nextDueOn, setNextDueOn] = useState(addDays(today, 7));
  const [category, setCategory] = useState<Category | "auto">("auto");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const suggested = suggestCategory(`${title}\n${description}`).category;

  return (
    <>
      <div className="border-b px-5 py-4 pr-14">
        <DialogTitle>New recurring task</DialogTitle>
        <DialogDescription className="mt-1">A request is created automatically each time it comes due.</DialogDescription>
      </div>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = routineFormSchema.safeParse({ title, description, category: category === "auto" ? suggested : category, every, nextDueOn });
          if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
          onSave({ ...parsed.data, every: parsed.data.every as Routine["every"] });
          onClose();
        }}
      >
        <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="routine-title">Title</Label>
            <Input id="routine-title" autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
            {errors.title && <p role="alert" className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="routine-every">Repeats</Label>
            <Select value={every} onValueChange={setEvery}>
              <SelectTrigger id="routine-every"><SelectValue /></SelectTrigger>
              <SelectContent>{EVERY.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="routine-next">First due</Label>
            <Input id="routine-next" type="date" value={nextDueOn} onChange={(e) => setNextDueOn(e.target.value)} aria-invalid={!!errors.nextDueOn} />
            {errors.nextDueOn && <p role="alert" className="text-xs text-destructive">{errors.nextDueOn}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="routine-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category | "auto")}>
              <SelectTrigger id="routine-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Suggested: {suggested}</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="routine-description">Details (optional)</Label>
            <Input id="routine-description" autoComplete="off" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add recurring task</Button>
        </div>
      </form>
    </>
  );
}

export function RoutineDialog({ open, today, onOpenChange, onSave }: { open: boolean; today: string; onOpenChange: (open: boolean) => void; onSave: (r: Omit<Routine, "id">) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">{open && <Body today={today} onClose={() => onOpenChange(false)} onSave={onSave} />}</DialogContent>
    </Dialog>
  );
}
