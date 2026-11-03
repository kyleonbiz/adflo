"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findDuplicates } from "@/lib/vendors/logic";
import { PAYMENT_TERMS, RISK_TIERS, VENDOR_CATEGORIES, type Vendor } from "@/lib/vendors/types";
import { vendorFormSchema, type VendorFormInput, type VendorFormValues } from "@/lib/vendors/validation";

/** Details an assistant draft can start a vendor with. Never a tax ID. */
export interface VendorDraft { name?: string; contactName?: string; email?: string; phone?: string; category?: string }

function defaults(vendor?: Vendor, draft?: VendorDraft): VendorFormInput {
  if (!vendor) return { name: draft?.name ?? "", category: (draft?.category as VendorFormInput["category"]) ?? "Supplies", contactName: draft?.contactName ?? "", email: draft?.email ?? "", phone: draft?.phone ?? "", taxId: "", notes: "", riskTier: "standard", paymentTerms: "Net 30", contractEndsOn: "", annualSpend: "", rating: "" };
  return {
    name: vendor.name, category: vendor.category, contactName: vendor.contactName, email: vendor.email,
    phone: vendor.phone, taxId: vendor.taxId, notes: vendor.notes,
    riskTier: vendor.riskTier ?? "standard", paymentTerms: vendor.paymentTerms ?? "Net 30", contractEndsOn: vendor.contractEndsOn ?? "",
    annualSpend: vendor.annualSpend == null ? "" : String(vendor.annualSpend), rating: vendor.rating == null ? "" : String(vendor.rating),
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
  vendor, draft, existing, onOpenChange, onSubmit,
}: {
  vendor?: Vendor;
  draft?: VendorDraft;
  existing: Vendor[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VendorFormValues) => void;
}) {
  const { register, control, handleSubmit, formState } = useForm<VendorFormInput, unknown, VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: defaults(vendor, draft),
  });
  const { errors } = formState;
  const [matches, setMatches] = useState<ReturnType<typeof findDuplicates>>([]);

  const warning = useRef<HTMLDivElement>(null);
  // Move focus to the warning so keyboard and screen-reader users notice it and the changed button.
  useEffect(() => {
    if (matches.length > 0) warning.current?.focus();
  }, [matches.length]);

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
              <Field id="vendor-name" label="Vendor Name" error={errors.name?.message}>
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
            <Field id="vendor-contactName" label="Contact Name" error={errors.contactName?.message}>
              <Input id="vendor-contactName" autoComplete="off" {...invalid("contactName")} {...register("contactName")} />
            </Field>
            <Field id="vendor-email" label="Contact Email" error={errors.email?.message}>
              <Input id="vendor-email" type="email" autoComplete="off" {...invalid("email")} {...register("email", { onChange: () => setMatches([]) })} />
            </Field>
            <Field id="vendor-phone" label="Phone" error={errors.phone?.message}>
              <Input id="vendor-phone" autoComplete="off" {...invalid("phone")} {...register("phone")} />
            </Field>
            <Field id="vendor-taxId" label="Tax ID (EIN, Optional)" error={errors.taxId?.message}>
              <Input id="vendor-taxId" autoComplete="off" placeholder="12-3456789" {...invalid("taxId")} {...register("taxId", { onChange: () => setMatches([]) })} />
            </Field>
            <Field id="vendor-riskTier" label="How much you rely on them" error={errors.riskTier?.message}>
              <Controller control={control} name="riskTier" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="vendor-riskTier" aria-label="How much you rely on them"><SelectValue /></SelectTrigger>
                  <SelectContent>{RISK_TIERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field id="vendor-paymentTerms" label="Payment terms" error={errors.paymentTerms?.message}>
              <Controller control={control} name="paymentTerms" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="vendor-paymentTerms" aria-label="Payment terms"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field id="vendor-contractEndsOn" label="Contract ends (optional)" error={errors.contractEndsOn?.message}>
              <Input id="vendor-contractEndsOn" type="date" {...invalid("contractEndsOn")} {...register("contractEndsOn")} />
            </Field>
            <Field id="vendor-annualSpend" label="Spend per year in dollars (optional)" error={errors.annualSpend?.message}>
              <Input id="vendor-annualSpend" inputMode="numeric" autoComplete="off" placeholder="24000" {...invalid("annualSpend")} {...register("annualSpend")} />
            </Field>
            <Field id="vendor-rating" label="Your rating (optional)" error={errors.rating?.message}>
              <Controller control={control} name="rating" render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger id="vendor-rating" aria-label="Your rating"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not rated</SelectItem>
                    {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} of 5</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
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
              <div ref={warning} tabIndex={-1} role="alert" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2" data-testid="duplicate-warning">
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
  open, vendor, draft, existing, onOpenChange, onSubmit,
}: {
  open: boolean;
  vendor?: Vendor;
  draft?: VendorDraft;
  existing: Vendor[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: VendorFormValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && <VendorFormBody vendor={vendor} draft={draft} existing={existing} onOpenChange={onOpenChange} onSubmit={onSubmit} />}
      </DialogContent>
    </Dialog>
  );
}
