"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDayLong, isDay } from "@/lib/dates";
import { missingDocuments, plural, suggestedExpiry, type RenewalInput } from "@/lib/licenses/logic";
import type { License } from "@/lib/licenses/types";

type Props = {
  today: string;
  onCancel: () => void;
  onConfirm: (license: License, input: Required<RenewalInput>) => void;
};

/** Confirms a renewal with the issuer's real new expiry (and number) instead of guessing from the term. */
export function RenewDialog({ license, ...rest }: Props & { license: License | null }) {
  return (
    <Dialog open={!!license} onOpenChange={(o) => !o && rest.onCancel()}>
      <DialogContent variant="alert">
        {/* Keyed so each license opens with fresh, correctly suggested values. */}
        {license && <RenewForm key={license.id} license={license} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}

function RenewForm({ license, today, onCancel, onConfirm }: Props & { license: License }) {
  const [expiresOn, setExpiresOn] = useState(() => suggestedExpiry(license, today));
  const [number, setNumber] = useState(license.number);
  const [error, setError] = useState("");
  const missing = missingDocuments(license);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDay(expiresOn)) return setError("Enter a valid date");
    if (expiresOn <= today) return setError("The new expiry must be after today");
    onConfirm(license, { expiresOn, number: number.trim().slice(0, 60) });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <DialogTitle>Mark {license.name} renewed</DialogTitle>
        <DialogDescription className="mt-1">
          Enter what the issuer granted. We suggested one renewal term ({license.renewalTermMonths} months) from the old expiry.
        </DialogDescription>
      </div>
      {(license.stage !== "submitted" || missing > 0) && (
        <p role="note" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {license.stage !== "submitted" && `Renewal stage is "${license.stage === "in_progress" ? "In progress" : "Not started"}". `}
          {missing > 0 && `${plural(missing, "required document")} not ticked off. `}
          You can still continue.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="renew-expiry">New Expiry Date</Label>
        <Input id="renew-expiry" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "renew-error" : undefined} />
        {error ? <p id="renew-error" role="alert" className="text-xs text-destructive">{error}</p>
          : <p className="text-xs text-muted-foreground">Currently expires {formatDayLong(license.expiresOn)}.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="renew-number">License Number (Change It If The Issuer Gave A New One)</Label>
        <Input id="renew-number" autoComplete="off" maxLength={60} value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Confirm renewal</Button>
      </div>
    </form>
  );
}
