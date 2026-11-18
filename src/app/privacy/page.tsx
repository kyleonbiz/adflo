import type { Metadata } from "next";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AdFlo collects, uses and shares personal information, and how it uses cookies and browser storage.",
};

const CONTACT = "support@adflo.pro";
const UPDATED = "November 18, 2026";

const H2 = "mt-10 text-lg font-semibold";
const P = "mt-3 leading-relaxed text-muted-foreground";
const UL = "mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6">
        <Brand wordmark className="w-28 sm:w-32" />
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>
        <p className={P}>
          This policy explains how AdFlo (&ldquo;AdFlo,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses and shares personal
          information when you use AdFlo, our administrative management platform for contractors and property managers, including
          records and documentation, compliance tracking, and equipment and asset tracking.
        </p>

        <h2 className={H2}>1. Information we collect</h2>
        <ul className={UL}>
          <li><strong>Account information.</strong> Name, email address, phone number, password (stored hashed, never in plain text), business name, industry and role.</li>
          <li><strong>Business and customer content.</strong> Information you or your team add to AdFlo: documents and files, forms, invoices, licenses, certifications and compliance deadlines, equipment and asset records, and notes. This may include personal information about your own clients, employees or tenants.</li>
          <li><strong>Billing information.</strong> Plan and subscription details.</li>
          <li><strong>Usage and device information.</strong> Basic technical logs needed to run and secure the service, such as IP address, browser type, timestamps and error data.</li>
          <li><strong>Communications.</strong> Messages you send us, and emails sent through AdFlo on your behalf, for example forms or invoices you send to your clients.</li>
        </ul>

        <h2 className={H2}>2. How we use information</h2>
        <ul className={UL}>
          <li>Provide, maintain and improve AdFlo.</li>
          <li>Create and secure your account, and authenticate you.</li>
          <li>Send service messages such as invites, password resets, reminders and agreements.</li>
          <li>Process documents you upload, including text extraction (OCR) and AI-assisted features you choose to use.</li>
          <li>Provide support and respond to requests.</li>
          <li>Detect fraud, abuse and security incidents.</li>
          <li>Meet legal obligations and enforce our terms.</li>
        </ul>
        <p className={P}>We don&rsquo;t sell your personal information, and we don&rsquo;t use your business content for advertising.</p>

        <h2 className={H2}>3. AI features</h2>
        <p className={P}>
          Some features use AI models to help with tasks like reading documents or answering questions about your records. When you
          use them, the relevant content is sent to our AI provider to generate a response. You can choose not to use AI features.
        </p>

        <h2 className={H2}>4. Who we share information with</h2>
        <p className={P}>We share information only as needed to run AdFlo:</p>
        <ul className={UL}>
          <li><strong>Service providers</strong> that process data on our behalf: hosting and infrastructure, database, authentication and file storage, email delivery, and AI processing. They may use data only to provide services to us.</li>
          <li><strong>People you choose.</strong> When you send a form, invoice or share link, the recipient can see that content.</li>
          <li><strong>Your organization.</strong> Other users in your AdFlo account can see content according to their permissions.</li>
          <li><strong>Legal and safety.</strong> Where required by law, or to protect rights, safety and security.</li>
          <li><strong>Business transfers.</strong> If we&rsquo;re involved in a merger, acquisition or sale of assets, information may transfer, with notice to you.</li>
        </ul>

        <h2 className={H2}>5. Cookies and local storage</h2>
        <p className={P}>
          <strong>Cookies we use.</strong> AdFlo uses a small number of cookies that are strictly necessary to run the service. These
          keep you signed in and protect your account and session. Without them, you couldn&rsquo;t log in or use AdFlo securely. You
          can block them in your browser settings, but that will prevent you from signing in.
        </p>
        <p className={P}>
          <strong>Browser storage.</strong> AdFlo also uses your browser&rsquo;s local storage to remember your preferences and work in
          progress, such as whether your sidebar is collapsed, your dashboard layout, and details you&rsquo;ve entered for convenience
          (like a reply-to address or invoice sender details). This information stays in your browser and isn&rsquo;t used to track you.
          You can clear it at any time through your browser settings.
        </p>
        <p className={P}>
          <strong>What we don&rsquo;t use.</strong> AdFlo does not use advertising cookies, third-party analytics or tracking cookies,
          or social media pixels. We don&rsquo;t sell or share your personal information for cross-context behavioral advertising.
        </p>
        <p className={P}>
          If we add analytics or other non-essential cookies in the future, we&rsquo;ll update this policy and ask for your consent
          where the law requires it.
        </p>

        <h2 className={H2}>6. Your content</h2>
        <p className={P}>
          You own the content you put into AdFlo. We process it only to provide the service as described here and in our Terms. If you
          add personal information about your clients, employees or tenants, you&rsquo;re responsible for having the right to do so. For
          those individuals, we act as your service provider, and they should contact you about their data.
        </p>

        <h2 className={H2}>7. Data retention</h2>
        <p className={P}>
          We keep information while your account is active and as needed to provide the service. After you close your account, we delete
          or anonymize your data within a reasonable period, except where we must retain it for legal, tax, security or dispute
          purposes. Backups are overwritten on a rolling schedule.
        </p>

        <h2 className={H2}>8. Security</h2>
        <p className={P}>
          We use measures such as encrypted connections (HTTPS), hashed passwords, row-level access controls so accounts can only see
          their own data, and access limits for our staff. No system is perfectly secure. If a breach affects you, we&rsquo;ll notify you
          as required by law.
        </p>

        <h2 className={H2}>9. Your rights and choices</h2>
        <ul className={UL}>
          <li>Access, correct or delete your information, and export your data, in your account or by contacting us.</li>
          <li>Close your account at any time.</li>
          <li>Opt out of marketing emails using the unsubscribe link. Service messages will continue.</li>
        </ul>
        <p className={P}>
          <strong>California and other US state residents</strong> may have additional rights to know, delete, correct, and opt out of
          the sale or sharing of personal information. We don&rsquo;t sell or share personal information for targeted advertising. To
          make a request, contact us at the address below. We won&rsquo;t discriminate against you for exercising these rights.
        </p>

        <h2 className={H2}>10. Children</h2>
        <p className={P}>AdFlo is for businesses and isn&rsquo;t directed to anyone under 18. We don&rsquo;t knowingly collect information from children.</p>

        <h2 className={H2}>11. International users</h2>
        <p className={P}>
          AdFlo is operated from the United States. If you use it from elsewhere, your information is processed in the United States and
          other countries where our providers operate.
        </p>

        <h2 className={H2}>12. Changes to this policy</h2>
        <p className={P}>
          We&rsquo;ll post updates here with a new &ldquo;Last updated&rdquo; date and notify you of material changes by email or in the app.
        </p>

        <h2 className={H2}>13. Contact</h2>
        <p className={P}>
          Questions or requests: <a className="font-medium text-foreground underline underline-offset-2" href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </main>
    </div>
  );
}
