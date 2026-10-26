"use client";

import { useEffect } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "@/lib/dates";
import { formatMoney, generateInvoiceNumber, invoiceTotals } from "@/lib/invoices/logic";
import { RECURRENCES, type Invoice } from "@/lib/invoices/types";
import { invoiceFormSchema, parseDollars, type InvoiceFormInput, type InvoiceFormValues } from "@/lib/invoices/validation";
import { titleCase } from "@/lib/text";

const SENDER_KEY = "adflo.invoice.sender";
const emptyItem = { description: "", qty: "1", rate: "" };
const TEXTAREA =
  "flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground aria-invalid:border-destructive focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

type Remembered = Pick<InvoiceFormInput, "fromName" | "fromAddress" | "fromPhone" | "fromEmail" | "paymentMethods">;

/** The business details and payment methods last used in this browser, so each new invoice starts filled in. */
function remembered(existing: Invoice[]): Remembered {
  const last = [...existing].sort((a, b) => (a.issuedOn < b.issuedOn ? 1 : -1))[0];
  if (last) {
    return {
      fromName: last.sender.name, fromAddress: last.sender.address, fromPhone: last.sender.phone, fromEmail: last.sender.email,
      paymentMethods: last.paymentMethods.join("\n"),
    };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SENDER_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      return { fromName: str(saved.fromName), fromAddress: str(saved.fromAddress), fromPhone: str(saved.fromPhone), fromEmail: str(saved.fromEmail), paymentMethods: str(saved.paymentMethods) };
    }
  } catch { /* storage unavailable: start blank */ }
  return { fromName: "", fromAddress: "", fromPhone: "", fromEmail: "", paymentMethods: "" };
}

function defaults(invoice: Invoice | undefined, today: string, existing: Invoice[]): InvoiceFormInput {
  if (invoice) {
    return {
      number: invoice.number,
      fromName: invoice.sender.name, fromAddress: invoice.sender.address, fromPhone: invoice.sender.phone, fromEmail: invoice.sender.email,
      client: invoice.client, clientEmail: invoice.clientEmail,
      items: invoice.items.map((i) => ({ description: i.description, qty: String(i.qty), rate: (i.rateCents / 100).toFixed(2) })),
      taxRate: invoice.taxRate ? String(invoice.taxRate) : "",
      issuedOn: invoice.issuedOn, dueOn: invoice.dueOn,
      paymentMethods: invoice.paymentMethods.join("\n"),
      recurrence: invoice.recurrence, reminderDays: invoice.reminderDays.join(", "), notes: invoice.notes,
    };
  }
  return {
    number: generateInvoiceNumber(today, existing.map((i) => i.number)),
    ...remembered(existing),
    client: "", clientEmail: "", items: [{ ...emptyItem }], taxRate: "", issuedOn: today, dueOn: addDays(today, 30),
    recurrence: "none", reminderDays: "7, 1", notes: "Thank you for choosing our services! If you have any questions about this invoice, please contact us.",
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-3 sm:col-span-2">
    <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</legend>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </fieldset>
);

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
  const { register, control, handleSubmit, reset, setError, formState } = useForm<InvoiceFormInput, unknown, InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: defaults(invoice, today, existing),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const { errors } = formState;
  const watched = useWatch({ control, name: ["items", "taxRate"] });

  useEffect(() => {
    if (open) reset(defaults(invoice, today, existing));
    // `existing` only seeds the suggested number and sender when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice, today, reset]);

  const [items = [], taxText = ""] = watched;
  const totals = invoiceTotals(
    items.map((i) => ({ description: "", qty: /^\d+(\.\d{1,2})?$/.test(i?.qty ?? "") ? Number(i.qty) : 0, rateCents: parseDollars(i?.rate ?? "") ?? 0 })),
    /^\d+(\.\d{1,3})?$/.test(taxText.trim().replace(/%$/, "")) ? Number(taxText.trim().replace(/%$/, "")) : 0,
  );

  const submit = handleSubmit((values) => {
    const number = values.number.toLowerCase();
    if (existing.some((i) => i.id !== invoice?.id && i.number.toLowerCase() === number)) {
      setError("number", { message: "That invoice number is already in use" });
      return;
    }
    try {
      localStorage.setItem(SENDER_KEY, JSON.stringify({
        fromName: values.fromName, fromAddress: values.fromAddress, fromPhone: values.fromPhone, fromEmail: values.fromEmail,
        paymentMethods: values.paymentMethods.join("\n"),
      }));
    } catch { /* storage unavailable: nothing remembered */ }
    onSubmit(values);
    onOpenChange(false);
  });
  const invalid = (name: string, message?: string) => ({
    "aria-invalid": !!message,
    "aria-describedby": message ? `${name}-error` : undefined,
  });
  const itemsError = typeof errors.items?.message === "string" ? errors.items.message : errors.items?.root?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <div className="border-b px-5 py-4 pr-14">
          <DialogTitle>{invoice ? "Edit invoice" : "New invoice"}</DialogTitle>
          <DialogDescription className="mt-1">Fill in the details. You can view, download and send it once it is created.</DialogDescription>
        </div>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            <Field id="inv-number" label="Invoice Number" error={errors.number?.message}>
              <Input id="inv-number" autoComplete="off" {...invalid("inv-number", errors.number?.message)} {...register("number")} />
            </Field>
            <div className="hidden sm:block" />
            <Field id="inv-issuedOn" label="Issued On" error={errors.issuedOn?.message}>
              <Input id="inv-issuedOn" type="date" {...invalid("inv-issuedOn", errors.issuedOn?.message)} {...register("issuedOn")} />
            </Field>
            <Field id="inv-dueOn" label="Due On" error={errors.dueOn?.message}>
              <Input id="inv-dueOn" type="date" {...invalid("inv-dueOn", errors.dueOn?.message)} {...register("dueOn")} />
            </Field>

            <Section title="From">
              <Field id="inv-fromName" label="Business Name" error={errors.fromName?.message}>
                <Input id="inv-fromName" autoComplete="organization" {...invalid("inv-fromName", errors.fromName?.message)} {...register("fromName")} />
              </Field>
              <Field id="inv-fromAddress" label="Address" error={errors.fromAddress?.message}>
                <Input id="inv-fromAddress" autoComplete="off" placeholder="City, ST 00000" {...invalid("inv-fromAddress", errors.fromAddress?.message)} {...register("fromAddress")} />
              </Field>
              <Field id="inv-fromPhone" label="Phone" error={errors.fromPhone?.message}>
                <Input id="inv-fromPhone" type="tel" autoComplete="off" {...invalid("inv-fromPhone", errors.fromPhone?.message)} {...register("fromPhone")} />
              </Field>
              <Field id="inv-fromEmail" label="Business Email" error={errors.fromEmail?.message}>
                <Input id="inv-fromEmail" type="email" autoComplete="off" {...invalid("inv-fromEmail", errors.fromEmail?.message)} {...register("fromEmail")} />
              </Field>
            </Section>

            <Section title="Bill to">
              <Field id="inv-client" label="Client" error={errors.client?.message}>
                <Input id="inv-client" autoComplete="off" {...invalid("inv-client", errors.client?.message)} {...register("client")} />
              </Field>
              <Field id="inv-clientEmail" label="Client Email (Used When Sending)" error={errors.clientEmail?.message}>
                <Input id="inv-clientEmail" type="email" autoComplete="off" placeholder="billing@client.com" {...invalid("inv-clientEmail", errors.clientEmail?.message)} {...register("clientEmail")} />
              </Field>
            </Section>

            <fieldset className="space-y-3 sm:col-span-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service details</legend>
              {fields.map((f, n) => (
                <div key={f.id} className="grid grid-cols-[1fr_4.5rem_6rem_auto] items-start gap-2" data-testid="invoice-line">
                  <Field id={`inv-item-${n}-description`} label={n === 0 ? "Description" : "Description"} error={errors.items?.[n]?.description?.message}>
                    <Input id={`inv-item-${n}-description`} autoComplete="off" {...invalid(`inv-item-${n}-description`, errors.items?.[n]?.description?.message)} {...register(`items.${n}.description`)} />
                  </Field>
                  <Field id={`inv-item-${n}-qty`} label="Qty" error={errors.items?.[n]?.qty?.message}>
                    <Input id={`inv-item-${n}-qty`} inputMode="decimal" {...invalid(`inv-item-${n}-qty`, errors.items?.[n]?.qty?.message)} {...register(`items.${n}.qty`)} />
                  </Field>
                  <Field id={`inv-item-${n}-rate`} label="Rate" error={errors.items?.[n]?.rate?.message}>
                    <Input id={`inv-item-${n}-rate`} inputMode="decimal" placeholder="45.00" {...invalid(`inv-item-${n}-rate`, errors.items?.[n]?.rate?.message)} {...register(`items.${n}.rate`)} />
                  </Field>
                  <Button type="button" size="icon-sm" variant="ghost" className="mt-6" aria-label={`Remove line ${n + 1}`} disabled={fields.length === 1} onClick={() => remove(n)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {itemsError && <p id="inv-items-error" role="alert" className="text-xs text-destructive">{itemsError}</p>}
              <Button type="button" size="sm" variant="outline" onClick={() => append({ ...emptyItem })}><Plus /> Add line</Button>
              <div className="grid gap-4 sm:grid-cols-[1fr_16rem] sm:items-start">
                <Field id="inv-taxRate" label="Tax Rate (%)" error={errors.taxRate?.message}>
                  <Input id="inv-taxRate" inputMode="decimal" placeholder="0.925" className="sm:max-w-40" {...invalid("inv-taxRate", errors.taxRate?.message)} {...register("taxRate")} />
                </Field>
                <dl className="space-y-1 text-sm tabular-nums" aria-label="Totals">
                  <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(totals.subtotalCents)}</dd></div>
                  <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(totals.taxCents)}</dd></div>
                  <div className="flex justify-between font-semibold"><dt>Total due</dt><dd>{formatMoney(totals.totalCents)}</dd></div>
                </dl>
              </div>
            </fieldset>

            <Section title="Payment and reminders">
              <div className="sm:col-span-2">
                <Field id="inv-paymentMethods" label="Payment Methods (One Per Line)" error={errors.paymentMethods?.message}>
                  <textarea id="inv-paymentMethods" rows={3} placeholder={"Cash\nCheck payable to Your Business LLC"} className={TEXTAREA} {...invalid("inv-paymentMethods", errors.paymentMethods?.message)} {...register("paymentMethods")} />
                </Field>
              </div>
              <Field id="inv-recurrence" label="Repeats" error={errors.recurrence?.message}>
                <Controller
                  control={control}
                  name="recurrence"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="inv-recurrence"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RECURRENCES.map((r) => <SelectItem key={r.value} value={r.value}>{titleCase(r.label)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field id="inv-reminderDays" label="Remind Client (Days Before Due, Optional)" error={errors.reminderDays?.message}>
                <Input id="inv-reminderDays" placeholder="7, 1" {...invalid("inv-reminderDays", errors.reminderDays?.message)} {...register("reminderDays")} />
              </Field>
              <div className="sm:col-span-2">
                <Field id="inv-notes" label="Notes" error={errors.notes?.message}>
                  <textarea id="inv-notes" rows={3} className={TEXTAREA} {...invalid("inv-notes", errors.notes?.message)} {...register("notes")} />
                </Field>
              </div>
            </Section>
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
