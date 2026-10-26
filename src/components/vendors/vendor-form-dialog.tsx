"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findDuplicates } from "@/lib/vendors/logic";
import { VENDOR_CATEGORIES, type Vendor } from "@/lib/vendors/types";
import { vendorFormSchema, type VendorFormInput, type VendorFormValues } from "@/lib/vendors/validation";

function defaults(vendor?: Vendor): VendorFormInput {
  if (!vendor) return { name: "", category: "Supplies", contactName: "", email: "", phone: "", taxId: "", notes: "" };
  return {
    name: vendor.name, category: vendor.category, contactName: vendor.contactName, email: vendor.email,
    phone: vendor.phone, taxId: vendor.taxId, notes: vendor.notes,
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

function VendorFormBody({
  vendor, existing, onOpenChange, onSubmit,
}: {
  vendor?: Vendor;
  existing: Vendor[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VendorFormValues) => void;
}) {
  const { register, control, handleSubmit, formState } = useForm<VendorFormInput, unknown, VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: defaults(vendor),
  });
  const { errors } = formState;
  const [matches, setMatches] = useState<ReturnType<typeof findDuplicates>>([]);

  const finish = (values: VendorFormValues) => { onSubmit(values); onOpenChange(false); };
  const submit = handleSubmit((values) => {
    // First submit with matches shows them; submitting again (the "anyway" button) goes through.
    const found = findDuplicates(existing, values, vendor?.id);
    if (found.length > 0 && matches.length === 0) { setMatches(found); return; }
    finish(values);
  });
  const invalid = (name: keyof VendorFormInput) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `vendor-${name}-error` : undefined,
  });

  return (
    <>
        <div className="border-b px-5 py-4 pr-14">
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
          <DialogDescription className="mt-1">
            {vendor ? "Update the vendor profile." : "Required documents are added automatically for the category you pick."}
          </DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field id="vendor-name" label="Vendor name" error={errors.name?.message}>
                <Input id="vendor-name" autoComplete="off" {...invalid("name")} {...register("name", { onChange: () => setMatches([]) })} />
              </Field>
            </div>
            <Field id="vendor-category" label="Category" error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="vendor-category"><SelectValue /></SelectTrigger>
                    <SelectContent>{VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="vendor-contactName" label="Contact name" error={errors.contactName?.message}>
              <Input id="vendor-contactName" autoComplete="off" {...invalid("contactName")} {...register("contactName")} />
            </Field>
            <Field id="vendor-email" label="Contact email" error={errors.email?.message}>
              <Input id="vendor-email" type="email" autoComplete="off" {...invalid("email")} {...register("email", { onChange: () => setMatches([]) })} />
            </Field>
            <Field id="vendor-phone" label="Phone" error={errors.phone?.message}>
              <Input id="vendor-phone" autoComplete="off" {...invalid("phone")} {...register("phone")} />
            </Field>
            <Field id="vendor-taxId" label="Tax ID (EIN, optional)" error={errors.taxId?.message}>
              <Input id="vendor-taxId" autoComplete="off" placeholder="12-3456789" {...invalid("taxId")} {...register("taxId", { onChange: () => setMatches([]) })} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="vendor-notes" label="Notes" error={errors.notes?.message}>
                <textarea
                  id="vendor-notes"
                  rows={3}
                  className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  {...invalid("notes")}
                  {...register("notes")}
                />
              </Field>
            </div>
            {matches.length > 0 && (
              <div role="alert" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2" data-testid="duplicate-warning">
                <p className="flex items-center gap-2 font-medium"><TriangleAlert className="size-4" aria-hidden /> This may already be in your vendor list</p>
                <ul className="list-disc pl-5">
                  {matches.map((m) => <li key={m.vendor.id}>{m.vendor.name}: {m.reasons.join(", ").toLowerCase()}</li>)}
                </ul>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{matches.length > 0 ? (vendor ? "Save anyway" : "Add anyway") : vendor ? "Save changes" : "Add vendor"}</Button>
          </div>
        </form>
    </>
  );
}

/** Vendor intake form. Matching vendors are shown before saving; the user can still save anyway. */
export function VendorFormDialog({
  open, vendor, existing, onOpenChange, onSubmit,
}: {
  open: boolean;
  vendor?: Vendor;
  existing: Vendor[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VendorFormValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && <VendorFormBody vendor={vendor} existing={existing} onOpenChange={onOpenChange} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}
