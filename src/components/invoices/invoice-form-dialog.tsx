"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "@/lib/dates";
import { nextInvoiceNumber } from "@/lib/invoices/logic";
import { RECURRENCES, type Invoice } from "@/lib/invoices/types";
import { invoiceFormSchema, type InvoiceFormInput, type InvoiceFormValues } from "@/lib/invoices/validation";

function defaults(invoice: Invoice | undefined, today: string, existing: Invoice[]): InvoiceFormInput {
  if (invoice) {
    return {
      number: invoice.number, client: invoice.client, description: invoice.description,
      amount: (invoice.amountCents / 100).toFixed(2), issuedOn: invoice.issuedOn, dueOn: invoice.dueOn,
      recurrence: invoice.recurrence, reminderDays: invoice.reminderDays.join(", "), notes: invoice.notes,
    };
  }
  const last = [...existing].sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : -1))[0];
  return {
    number: last ? nextInvoiceNumber(last.number, existing.map((i) => i.number)) : "INV-0001",
    client: "", description: "", amount: "", issuedOn: today, dueOn: addDays(today, 30),
    recurrence: "none", reminderDays: "7, 1", notes: "",
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

/** Create or edit an invoice. `invoice` present means edit. */
export function InvoiceFormDialog({
  open, invoice, existing, today, onOpenChange, onSubmit,
}: {
  open: boolean;
  invoice?: Invoice;
  existing: Invoice[];
  today: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: InvoiceFormValues) => void;
}) {
  const { register, control, handleSubmit, reset, formState } = useForm<InvoiceFormInput, unknown, InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: defaults(invoice, today, existing),
  });
  const { errors } = formState;

  useEffect(() => {
    if (open) reset(defaults(invoice, today, existing));
    // `existing` only seeds the suggested number when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice, today, reset]);

  const submit = handleSubmit((values) => {
    onSubmit(values);
    onOpenChange(false);
  });
  const invalid = (name: keyof InvoiceFormInput) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `inv-${name}-error` : undefined,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <div className="border-b px-5 py-4 pr-14">
          <DialogTitle>{invoice ? "Edit invoice" : "New invoice"}</DialogTitle>
          <DialogDescription className="mt-1">Reminders go out the listed number of days before the due date.</DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            <Field id="inv-number" label="Invoice number" error={errors.number?.message}>
              <Input id="inv-number" autoComplete="off" {...invalid("number")} {...register("number")} />
            </Field>
            <Field id="inv-client" label="Client" error={errors.client?.message}>
              <Input id="inv-client" autoComplete="off" {...invalid("client")} {...register("client")} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="inv-description" label="Description" error={errors.description?.message}>
                <Input id="inv-description" autoComplete="off" {...invalid("description")} {...register("description")} />
              </Field>
            </div>
            <Field id="inv-amount" label="Amount (USD)" error={errors.amount?.message}>
              <Input id="inv-amount" inputMode="decimal" placeholder="1250.00" {...invalid("amount")} {...register("amount")} />
            </Field>
            <Field id="inv-recurrence" label="Repeats" error={errors.recurrence?.message}>
              <Controller
                control={control}
                name="recurrence"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="inv-recurrence"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECURRENCES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="inv-issuedOn" label="Issued on" error={errors.issuedOn?.message}>
              <Input id="inv-issuedOn" type="date" {...invalid("issuedOn")} {...register("issuedOn")} />
            </Field>
            <Field id="inv-dueOn" label="Due on" error={errors.dueOn?.message}>
              <Input id="inv-dueOn" type="date" {...invalid("dueOn")} {...register("dueOn")} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="inv-reminderDays" label="Remind client (days before due, optional)" error={errors.reminderDays?.message}>
                <Input id="inv-reminderDays" placeholder="7, 1" {...invalid("reminderDays")} {...register("reminderDays")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field id="inv-notes" label="Notes" error={errors.notes?.message}>
                <textarea
                  id="inv-notes"
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
            <Button type="submit">{invoice ? "Save changes" : "Create invoice"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
