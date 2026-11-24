"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/components/modules/use-today";
import type { DmsApi } from "@/lib/dms/client/api";
import type { CertificateRead, DocumentRecord } from "@/lib/dms/types";
import { daysBetween, formatDayShort } from "@/lib/dates";
import { alreadyTracked, certificateExpiry, certificateToLicenses, renewalTarget, type Certificate } from "@/lib/licenses/certificate";
import { renewLicense } from "@/lib/licenses/logic";
import type { License } from "@/lib/licenses/types";
import { useRecordsLoading, useRecordsState } from "@/lib/records/storage";
import type { Vendor, VendorDocument } from "@/lib/vendors/types";
import { SectionLabel } from "./document-metadata";

const newId = () => `lic-${Math.random().toString(36).slice(2, 10)}`;

/** A company name for comparing: letters and digits only, without the usual endings. */
const plain = (s: string) => s.toLowerCase().replace(/\b(incorporated|inc|llc|l l c|ltd|limited|corp|corporation|co|company)\b/g, " ").replace(/[^a-z0-9]/g, "");

/** The vendor this certificate is for, when the insured name matches one. */
function matchingVendor(c: Certificate, vendors: Vendor[] | null): Vendor | null {
  if (!c.insured || !vendors) return null;
  const want = plain(c.insured);
  return want ? vendors.find((v) => plain(v.name) === want) ?? null : null;
}

/** The vendor's "Certificate of insurance" document, received today and good until the earliest policy expiry. */
function withCertificate(docs: VendorDocument[], today: string, expiresOn: string): VendorDocument[] {
  const i = docs.findIndex((d) => /certificate of insurance/i.test(d.type));
  if (i >= 0) return docs.map((d, k) => (k === i ? { ...d, receivedOn: today, expiresOn } : d));
  return [...docs, { id: `vd-${Math.random().toString(36).slice(2, 10)}`, type: "Certificate of insurance", required: true, receivedOn: today, expiresOn }];
}

/**
 * Shown for an insurance document: what the certificate says (insured, each policy and when it ends), and one click to track it,
 * either as the company's own policies in Licenses & Renewals or, when the insured is one of your vendors, as that vendor's current
 * certificate. Nothing is saved until the button is pressed, and tracked policies start flagged for a quick check against the paper.
 */
export function CertificateCard({ doc, api }: { doc: DocumentRecord; api: DmsApi }) {
  const today = useToday() ?? "";
  const key = `${doc.id}:${doc.currentVersion}`;
  const [result, setResult] = useState<{ key: string; read: CertificateRead | null } | null>(null);
  const [done, setDone] = useState<{ key: string; text: string } | null>(null);
  const [licenses, setLicenses] = useRecordsState<License>("licenses");
  const [vendors, setVendors] = useRecordsState<Vendor>("vendors");
  const loadingRecords = useRecordsLoading(); // saved records are still arriving from the database

  useEffect(() => {
    let live = true;
    api.readCertificate(doc.id).then((read) => live && setResult({ key, read })).catch(() => live && setResult({ key, read: null }));
    return () => { live = false; };
  }, [api, doc.id, key]);

  if (doc.category !== "insurance") return null;
  const read = result?.key === key ? result.read : undefined; // undefined while it is being read
  const message = done?.key === key ? done.text : "";

  return (
    <section aria-labelledby="certificate-heading" data-testid="certificate-card">
      <SectionLabel id="certificate-heading">Certificate of insurance</SectionLabel>
      {read === undefined && <Skeleton className="h-16 w-full" aria-label="Reading the certificate" />}
      {read === null && <p className="text-xs text-muted-foreground">Could not read this document just now. Try again in a moment.</p>}
      {read && read.status === "unreadable" && (
        <p className="text-xs text-muted-foreground">
          This file has no readable text (a photo or scan). Upload the PDF version to read it automatically, or add the policy yourself in{" "}
          <Link href="/app/licenses" className="font-medium text-primary hover:underline">Licenses &amp; Renewals</Link>.
        </p>
      )}
      {read && read.status === "no_certificate" && <p className="text-xs text-muted-foreground">This does not look like a certificate of insurance, so no policies were read from it.</p>}
      {read && read.status === "found" && (() => {
        const c = read.certificate;
        const vendor = matchingVendor(c, vendors);
        const notTracked = c.policies.filter((p) => !alreadyTracked(p, licenses ?? []));
        // A policy that is already tracked with an earlier end date is a renewal of it, not a second record.
        const renewals = notTracked.flatMap((p) => { const l = renewalTarget(p, c.insured, licenses ?? []); return l ? [{ policy: p, license: l }] : []; });
        const fresh = notTracked.filter((p) => !renewals.some((r) => r.policy === p));
        const expiry = certificateExpiry(c);
        const say = (text: string) => setDone({ key, text });

        const trackOwn = () => {
          if (fresh.length === 0) return say("These policies are already tracked.");
          setLicenses((prev) => [...(prev ?? []), ...certificateToLicenses({ ...c, policies: fresh }, { newId, documentName: doc.displayName })]);
          say(`Tracking ${fresh.length} ${fresh.length === 1 ? "policy" : "policies"}. You will be reminded 60, 30 and 7 days before each ends.`);
        };
        const renewTracked = () => {
          // Each tracked policy gets the new end date and starts again from "not started"; it stays flagged for a quick check against the paper.
          setLicenses((prev) => (prev ?? []).map((l) => {
            const r = renewals.find((x) => x.license.id === l.id);
            return r ? { ...renewLicense(l, today, { expiresOn: r.policy.expiresOn, number: r.policy.policyNumber ?? undefined }), verifiedOn: undefined } : l;
          }));
          say(`Renewed ${renewals.length} tracked ${renewals.length === 1 ? "policy" : "policies"}. Their old alerts are cleared and the new end dates are on your calendar.`);
        };
        const updateVendor = () => {
          if (!vendor) return;
          setVendors((prev) => (prev ?? []).map((v) => (v.id === vendor.id ? { ...v, documents: withCertificate(v.documents, today, expiry) } : v)));
          say(`${vendor.name}'s certificate of insurance is now on file, good until ${formatDayShort(expiry)}.`);
        };

        return (
          <div className="space-y-3 rounded-xl border bg-card p-3">
            <p className="flex items-start gap-2 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                {c.insured ? <><span className="font-medium">{c.insured}</span> is insured</> : "Insurance certificate"}
                {c.holder ? <>, certificate for {c.holder}</> : null}.
              </span>
            </p>
            <ul className="divide-y rounded-lg border text-sm" aria-label="Policies on this certificate">
              {c.policies.map((p) => {
                const days = today ? daysBetween(today, p.expiresOn) : null;
                const tone = days === null ? "muted" : days < 0 ? "danger" : days <= 30 ? "warning" : "success";
                const label = days === null ? `Ends ${formatDayShort(p.expiresOn)}` : days < 0 ? `Expired ${formatDayShort(p.expiresOn)}` : days === 0 ? "Expires today" : days <= 30 ? `Expires in ${days} ${days === 1 ? "day" : "days"}` : `Good until ${formatDayShort(p.expiresOn)}`;
                return (
                  <li key={`${p.kind}-${p.expiresOn}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">{p.kind}</p>
                      <p className="break-words text-xs text-muted-foreground">{[p.insurer, p.policyNumber ? `Policy ${p.policyNumber}` : null].filter(Boolean).join(" · ") || "Insurer and number not found"}</p>
                    </div>
                    <Badge variant={tone}>{label}</Badge>
                  </li>
                );
              })}
            </ul>
            {message ? (
              <p role="status" className="text-xs text-emerald-700">
                {message} <Link href="/app/licenses" className="font-medium text-primary hover:underline">Open Licenses &amp; Renewals</Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {renewals.length > 0 && <Button size="sm" onClick={renewTracked} disabled={loadingRecords}>Renew {renewals.length === 1 ? `${renewals[0].license.name}` : `${renewals.length} tracked policies`}</Button>}
                {vendor && <Button size="sm" variant={renewals.length ? "outline" : "default"} onClick={updateVendor}>Update {vendor.name}&apos;s certificate</Button>}
                {(fresh.length > 0 || renewals.length === 0) && <Button size="sm" variant={vendor || renewals.length ? "outline" : "default"} onClick={trackOwn} disabled={loadingRecords}>{vendor ? "Track as our own policies" : fresh.length === 0 ? "Already tracked" : "Track these policies"}</Button>}
              </div>
            )}
            {!message && <p className="text-xs text-muted-foreground">Read from the document. Check it against the certificate: tracked policies are marked for review until you confirm them.</p>}
          </div>
        );
      })()}
    </section>
  );
}
