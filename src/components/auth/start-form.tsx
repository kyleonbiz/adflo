"use client";

import { useActionState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startTrial, type StartState } from "@/app/start/actions";

/** Two questions between confirming an email and starting the trial: the company's name and the owner's. */
export function StartForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startTrial, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="company" className="sr-only">Company name</Label>
        <Input id="company" name="company" placeholder="Company name" autoComplete="organization" required minLength={2} maxLength={80} className="auth-input" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name" className="sr-only">Your name</Label>
        <Input id="name" name="name" placeholder="Your name" autoComplete="name" required minLength={2} maxLength={120} defaultValue={defaultName} className="auth-input" />
      </div>
      {state.error && <p role="alert" className="py-1 pl-3 text-sm border-l-2 border-red-500 text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" className="auth-submit w-full" disabled={pending}>
        {pending ? "Please wait…" : "Continue"}{!pending && <ChevronRight className="size-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}
