import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LEGAL_CONTACT } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section><h2>What we collect</h2><ul><li>Account details: name, email and workspace name.</li><li>Content you add: documents, invoices, licenses, vendors, contacts, tasks and forms.</li><li>Usage and security logs: sign-in events, access and audit records.</li><li>Messages you send to Addy and the demo request form.</li></ul></section>
      <section><h2>How we use it</h2><p>To run and secure AdFlo, support you, and improve the product. We do not sell your data or use your content to advertise to you.</p></section>
      <section><h2>Who processes it</h2><p>We use a small set of service providers to host and run AdFlo. They are listed on the <Link href="/subprocessors" className="underline">sub-processors page</Link>. When you use Addy in live mode, the text of your question and the context needed to answer it is sent to our AI provider.</p></section>
      <section><h2>Separation between clients</h2><p>Each workspace&rsquo;s data is separated at the database level. Staff access to the Control Center requires a second sign-in factor and is logged.</p></section>
      <section><h2>Retention and deletion</h2><ul><li>Active clients: we keep your content while your account is open.</li><li>Cancelled clients: we return your data on request, then delete it from live systems within 30 days and from backups as they roll off.</li><li>Share links and expired agreement links stop working once they expire and are cleaned up nightly.</li><li>We may keep billing records and audit logs as the law requires.</li></ul></section>
      <section><h2>Your choices</h2><p>You can ask to access, correct, export or delete your data at any time. Contact {LEGAL_CONTACT}.</p></section>
      <section><h2>Cookies</h2><p>We use only the cookies needed to keep you signed in. We do not run advertising or tracking cookies. If that changes we will add a notice and ask first.</p></section>
      <section><h2>Security</h2><p>Data is encrypted in transit and at rest by our providers. No system is perfectly secure, and we will tell affected clients promptly if a breach occurs.</p></section>
    </LegalPage>
  );
}
