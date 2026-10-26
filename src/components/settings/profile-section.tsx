"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useToday } from "@/components/modules/use-today";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { saveConfig, useSetupConfig } from "@/lib/setup/storage";
import { INDUSTRIES, TEAM_SIZES, emptyConfig, type Industry, type TeamSize } from "@/lib/setup/types";
import { saveSettings, useSettings } from "@/lib/settings/storage";
import { TIMEZONES, type BusinessDetails } from "@/lib/settings/types";

type Draft = BusinessDetails & { name: string; industry: Industry | ""; teamSize: TeamSize | "" };

function Form({ initial }: { initial: Draft }) {
  const settings = useSettings();
  const setup = useSetupConfig();
  const [draft, setDraft] = useState<Draft>(initial);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); setSaved(false); };
  const emailBad = draft.email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(draft.email.trim());

  const save = () => {
    const { name, industry, teamSize, ...details } = draft;
    saveSettings({ ...settings, details: { ...details, email: details.email.trim(), phone: details.phone.trim(), address: details.address.trim() } });
    // Name, industry and team size are the same ones the guided setup uses.
    const config = setup ?? emptyConfig();
    saveConfig({ ...config, business: { name: name.trim(), industry, teamSize } });
    setSaved(true);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!emailBad) save(); }} className="space-y-4 rounded-2xl border bg-card p-5 shadow-panel" aria-label="Business profile">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="biz-name">Business name</Label>
          <Input id="biz-name" value={draft.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-industry">Industry</Label>
          <Select value={draft.industry} onValueChange={(v) => set("industry", v as Industry)}>
            <SelectTrigger id="biz-industry"><SelectValue placeholder="Choose one" /></SelectTrigger>
            <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-size">Team size</Label>
          <Select value={draft.teamSize} onValueChange={(v) => set("teamSize", v as TeamSize)}>
            <SelectTrigger id="biz-size"><SelectValue placeholder="Choose one" /></SelectTrigger>
            <SelectContent>{TEAM_SIZES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-email">Contact email</Label>
          <Input id="biz-email" type="email" value={draft.email} maxLength={120} aria-invalid={emailBad} onChange={(e) => set("email", e.target.value)} />
          {emailBad && <p role="alert" className="text-xs text-destructive">Enter a valid email address.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-phone">Phone</Label>
          <Input id="biz-phone" type="tel" value={draft.phone} maxLength={40} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="biz-address">Address</Label>
          <Input id="biz-address" value={draft.address} maxLength={200} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-tz">Time zone</Label>
          <Select value={draft.timezone} onValueChange={(v) => set("timezone", v)}>
            <SelectTrigger id="biz-tz"><SelectValue /></SelectTrigger>
            <SelectContent>{TIMEZONES.map((z) => <SelectItem key={z} value={z}>{z.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={emailBad}>Save profile</Button>
        {saved && <span role="status" className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check className="size-4" aria-hidden /> Saved</span>}
      </div>
      <p className="text-xs text-muted-foreground">Saved in this browser until the database is connected.</p>
    </form>
  );
}

/** Business profile. Waits for the browser so the form starts from what is saved, not from blanks. */
export function ProfileSection() {
  const ready = useToday();
  const settings = useSettings();
  const setup = useSetupConfig();
  if (!ready) return <Skeleton className="h-72 rounded-2xl" aria-busy="true" />;
  const b = setup?.business;
  return <Form initial={{ ...settings.details, name: b?.name ?? "", industry: b?.industry ?? "", teamSize: b?.teamSize ?? "" }} />;
}
