import type { Metadata } from "next";
import { LegalPage, LEGAL_CONTACT } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section><h2>Who we are</h2><p>AdFlo is operated by its owner as a sole proprietorship (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using AdFlo you agree to these terms on behalf of yourself and the business you represent.</p></section>
      <section><h2>The service</h2><p>AdFlo gives your team tools for documents, invoices, licenses, vendors, contacts, tasks and forms, plus an assistant named Addy. Some modules are previews and may change or be removed.</p></section>
      <section><h2>Not legal, tax or accounting advice</h2><p>Compliance percentages, renewal reminders, W-9 and 1099 checks, and Addy&rsquo;s answers are organizational aids. They are not legal, tax or accounting advice. Confirm filing rules and deadlines with a qualified professional.</p></section>
      <section><h2>Signatures</h2><p>A signature in AdFlo is a typed name with an agreement tick and a document fingerprint. It is not a certified electronic signature service and may not meet the requirements for every document type or jurisdiction. Use a dedicated e-signature provider where the law or your counterparty requires one.</p></section>
      <section><h2>Your account and data</h2><ul><li>Keep your sign-in details and authenticator device safe. You are responsible for activity under your account.</li><li>You own the content you upload. You give us permission to store and process it only to run AdFlo for you.</li><li>Do not upload card numbers, social security numbers, passwords or other secrets. Do not use AdFlo for unlawful content.</li></ul></section>
      <section><h2>The assistant</h2><p>Addy prepares drafts and suggestions. Its output can be wrong. You review and approve anything before it is relied on or sent.</p></section>
      <section><h2>Fees</h2><p>Plans, prices and billing terms are set out in your order or pilot agreement. Pilot and trial terms end as written there.</p></section>
      <section><h2>Availability and support</h2><p>We work to keep AdFlo available and to fix problems quickly, but we do not promise uninterrupted service. Support hours and response targets are published separately.</p></section>
      <section><h2>Cancelling and your data</h2><p>You can stop using AdFlo at any time. After cancellation we return your data on request, then delete it as described in our Privacy Policy.</p></section>
      <section><h2>Liability</h2><p>To the extent the law allows, AdFlo is provided &ldquo;as is&rdquo;, and our total liability for any claim is limited to the fees you paid in the three months before it arose. We are not liable for indirect or consequential losses.</p></section>
      <section><h2>Changes and contact</h2><p>We will tell you about material changes to these terms before they apply. Questions: {LEGAL_CONTACT}.</p></section>
      <p className="rounded-lg border bg-muted p-3 text-xs text-muted-foreground">Draft for attorney review before use with paying clients.</p>
    </LegalPage>
  );
}
