"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addMonths, isDay } from "@/lib/dates";
import { DEFAULT_DOCUMENTS, LICENSE_CATEGORIES, type License, type LicenseCategory } from "@/lib/licenses/types";
import { readLicenseFile, LICENSE_UPLOAD_ACCEPT } from "@/lib/licenses/upload";
import { cn } from "@/lib/utils";
import { licenseFormSchema, type LicenseFormInput, type LicenseFormValues } from "@/lib/licenses/validation";

const REMINDER_PRESETS = [90, 60, 30, 14, 7];

const parseDays = (value: string) => value.split(",").map((p) => p.trim()).filter(Boolean).map(Number);

function defaults(license: License | undefined, today: string): LicenseFormInput {
  if (license) {
    return {
      name: license.name, category: license.category, issuer: license.issuer, number: license.number,
      holder: license.holder, issuedOn: license.issuedOn, expiresOn: license.expiresOn,
      renewalTermMonths: String(license.renewalTermMonths), reminderDays: license.reminderDays.join(", "),
      notes: license.notes, documents: "",
    };
  }
  return {
    name: "", category: "business", issuer: "", number: "", holder: "", issuedOn: today,
    expiresOn: addMonths(today, 12), renewalTermMonths: "12", reminderDays: "60, 30, 7", notes: "",
    documents: DEFAULT_DOCUMENTS.business.join("\n"),
  };
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Add or edit a license. `license` present means edit. */
export function LicenseFormDialog({
  open, license, today, initialFile, onOpenChange, onSubmit,
}: {
  open: boolean;
  license?: License;
  /** A file chosen before the dialog opened; it is read as soon as the dialog shows. */
  initialFile?: File | null;
  today: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LicenseFormValues) => void;
}) {
  const { register, control, handleSubmit, reset, formState, setValue } = useForm<LicenseFormInput, unknown, LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: defaults(license, today),
  });
  const { errors, dirtyFields } = formState;
  const [issuedOn, term, category, reminderDays] = useWatch({ control, name: ["issuedOn", "renewalTermMonths", "category", "reminderDays"] });

  useEffect(() => {
    if (open) { reset(defaults(license, today)); }
  }, [open, license, today, reset]);

  // Adding: until the user types their own expiry, keep it one renewal term after the issue date.
  useEffect(() => {
    const months = Number(term);
    if (!open || license || dirtyFields.expiresOn || !isDay(issuedOn) || !Number.isInteger(months) || months < 1 || months > 120) return;
    setValue("expiresOn", addMonths(issuedOn, months));
  }, [open, license, issuedOn, term, dirtyFields.expiresOn, setValue]);

  // Adding: suggest the documents this kind of license usually needs, until the user edits the list.
  useEffect(() => {
    if (!open || license || dirtyFields.documents) return;
    setValue("documents", DEFAULT_DOCUMENTS[category as LicenseCategory]?.join("\n") ?? "");
  }, [open, license, category, dirtyFields.documents, setValue]);

  const chosen = new Set(parseDays(reminderDays ?? ""));
  const toggleReminder = (days: number) => {
    const next = new Set(chosen);
    if (next.has(days)) next.delete(days); else next.add(days);
    const text = [...next].filter((n) => Number.isFinite(n)).sort((a, b) => b - a).join(", ");
    setValue("reminderDays", text, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  };

  const [reading, setReading] = useState(false);
  const [fillNote, setFillNote] = useState("");
  const [fillError, setFillError] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  /** Reads a file and pre-fills the form with what it found; the user still checks and saves. */
  const fillFromFile = async (file: File) => {
    setReading(true); setFillNote(""); setFillError("");
    try {
      const { fields, found } = await readLicenseFile(file);
      if (found === 0) {
        setFillNote("We couldn't find license details in that file. Enter them below.");
        return;
      }
      const labels: Record<string, string> = { name: "name", category: "category", issuer: "issuer", number: "number", holder: "holder", issuedOn: "issue date", expiresOn: "expiry date" };
      for (const [key, value] of Object.entries(fields)) setValue(key as keyof LicenseFormInput, value as string, { shouldDirty: true, shouldValidate: true });
      setFillNote(`Filled from ${file.name}: ${Object.keys(fields).map((k) => labels[k]).join(", ")}. Please check them before saving.`);
    } catch (e) {
      setFillError(e instanceof Error ? e.message : "Something went wrong reading that file.");
    } finally {
      setReading(false);
    }
  };

  useEffect(() => {
    if (!open || license || !initialFile) return;
    // After the reset above has applied, so the found values are not wiped.
    const t = setTimeout(() => void fillFromFile(initialFile), 0);
    return () => clearTimeout(t);
    // fillFromFile only uses stable setters; run once per chosen file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFile]);

  const submit = handleSubmit((values) => {
    onSubmit(values);
    onOpenChange(false);
  });
  const invalid = (name: keyof LicenseFormInput) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `lic-${name}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <div className="border-b px-5 py-4 pr-14">
          <DialogTitle>{license ? "Edit license" : "Add license"}</DialogTitle>
          <DialogDescription className="mt-1">
            Reminders fire the listed number of days before the expiry date.
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            {!license && (
              <div className="space-y-1.5 rounded-xl border border-dashed bg-muted/40 p-3 sm:col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={picker}
                    type="file"
                    accept={LICENSE_UPLOAD_ACCEPT}
                    className="sr-only"
                    aria-label="Upload a license file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void fillFromFile(f);
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={reading} onClick={() => picker.current?.click()}>
                    {reading ? <Loader2 className="animate-spin" /> : <Upload />} {reading ? "Reading file…" : "Fill from a file"}
                  </Button>
                  <span className="text-xs text-muted-foreground">PDF, Word, text or CSV up to 10 MB. We read the number and dates for you; the file itself isn&apos;t saved.</span>
                </div>
                {fillNote && <p aria-live="polite" className="text-xs text-emerald-700">{fillNote}</p>}
                {fillError && <p role="alert" className="text-xs text-destructive">{fillError}</p>}
              </div>
            )}
            <div className="sm:col-span-2">
              <Field id="lic-name" label="License name" error={errors.name?.message}>
                <Input id="lic-name" autoComplete="off" placeholder="State business license" {...invalid("name")} {...register("name")} />
              </Field>
            </div>
            <Field id="lic-category" label="Category" error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="lic-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LICENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="lic-issuer" label="Issuing authority" error={errors.issuer?.message}>
              <Input id="lic-issuer" autoComplete="off" {...invalid("issuer")} {...register("issuer")} />
            </Field>
            <Field id="lic-number" label="License number" error={errors.number?.message}>
              <Input id="lic-number" autoComplete="off" {...invalid("number")} {...register("number")} />
            </Field>
            <Field id="lic-holder" label="Holder" error={errors.holder?.message}>
              <Input id="lic-holder" autoComplete="off" {...invalid("holder")} {...register("holder")} />
            </Field>
            <Field id="lic-issuedOn" label="Issued on" error={errors.issuedOn?.message}>
              <Input id="lic-issuedOn" type="date" {...invalid("issuedOn")} {...register("issuedOn")} />
            </Field>
            <Field id="lic-expiresOn" label="Expires on" error={errors.expiresOn?.message}>
              <Input id="lic-expiresOn" type="date" {...invalid("expiresOn")} {...register("expiresOn")} />
            </Field>
            <Field id="lic-renewalTermMonths" label="Renewal term (months)" error={errors.renewalTermMonths?.message}>
              <Input id="lic-renewalTermMonths" inputMode="numeric" {...invalid("renewalTermMonths")} {...register("renewalTermMonths")} />
            </Field>
            <Field id="lic-reminderDays" label="Remind me (days before expiry)" error={errors.reminderDays?.message}>
              <Input id="lic-reminderDays" placeholder="60, 30, 7" {...invalid("reminderDays")} {...register("reminderDays")} />
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Common reminder times">
                {REMINDER_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={chosen.has(d)}
                    onClick={() => toggleReminder(d)}
                    className={cn("rounded-full border px-2.5 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", chosen.has(d) ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </Field>
            {!license && (
              <div className="sm:col-span-2">
                <Field id="lic-documents" label="Required documents (one per line)" error={errors.documents?.message}>
                  <textarea
                    id="lic-documents"
                    rows={3}
                    placeholder="Annual report"
                    className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                    {...invalid("documents")}
                    {...register("documents")}
                  />
                </Field>
              </div>
            )}
            <div className="sm:col-span-2">
              <Field id="lic-notes" label="Notes" error={errors.notes?.message}>
                <textarea
                  id="lic-notes"
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  {...invalid("notes")}
                  {...register("notes")}
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{license ? "Save changes" : "Add license"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
