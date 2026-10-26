"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, addMonths } from "@/lib/dates";
import { LICENSE_CATEGORIES, type License } from "@/lib/licenses/types";
import { licenseFormSchema, type LicenseFormInput, type LicenseFormValues } from "@/lib/licenses/validation";
import { titleCase } from "@/lib/text";

function defaults(license: License | undefined, today: string): LicenseFormInput {
  if (license) {
    return {
      name: license.name, category: license.category, issuer: license.issuer, number: license.number,
      holder: license.holder, issuedOn: license.issuedOn, expiresOn: license.expiresOn,
      renewalTermMonths: String(license.renewalTermMonths), reminderDays: license.reminderDays.join(", "),
      notes: license.notes,
    };
  }
  return {
    name: "", category: "business", issuer: "", number: "", holder: "", issuedOn: today,
    expiresOn: addDays(addMonths(today, 12), 0), renewalTermMonths: "12", reminderDays: "60, 30, 7", notes: "",
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
  open, license, today, onOpenChange, onSubmit,
}: {
  open: boolean;
  license?: License;
  today: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LicenseFormValues) => void;
}) {
  const { register, control, handleSubmit, reset, formState } = useForm<LicenseFormInput, unknown, LicenseFormValues>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: defaults(license, today),
  });
  const { errors } = formState;

  useEffect(() => {
    if (open) reset(defaults(license, today));
  }, [open, license, today, reset]);

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
            <div className="sm:col-span-2">
              <Field id="lic-name" label="License Name" error={errors.name?.message}>
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
                      {LICENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{titleCase(c.label)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="lic-issuer" label="Issuing Authority" error={errors.issuer?.message}>
              <Input id="lic-issuer" autoComplete="off" {...invalid("issuer")} {...register("issuer")} />
            </Field>
            <Field id="lic-number" label="License Number" error={errors.number?.message}>
              <Input id="lic-number" autoComplete="off" {...invalid("number")} {...register("number")} />
            </Field>
            <Field id="lic-holder" label="Holder" error={errors.holder?.message}>
              <Input id="lic-holder" autoComplete="off" {...invalid("holder")} {...register("holder")} />
            </Field>
            <Field id="lic-issuedOn" label="Issued On" error={errors.issuedOn?.message}>
              <Input id="lic-issuedOn" type="date" {...invalid("issuedOn")} {...register("issuedOn")} />
            </Field>
            <Field id="lic-expiresOn" label="Expires On" error={errors.expiresOn?.message}>
              <Input id="lic-expiresOn" type="date" {...invalid("expiresOn")} {...register("expiresOn")} />
            </Field>
            <Field id="lic-renewalTermMonths" label="Renewal Term (Months)" error={errors.renewalTermMonths?.message}>
              <Input id="lic-renewalTermMonths" inputMode="numeric" {...invalid("renewalTermMonths")} {...register("renewalTermMonths")} />
            </Field>
            <Field id="lic-reminderDays" label="Remind Me (Days Before Expiry)" error={errors.reminderDays?.message}>
              <Input id="lic-reminderDays" placeholder="60, 30, 7" {...invalid("reminderDays")} {...register("reminderDays")} />
            </Field>
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
