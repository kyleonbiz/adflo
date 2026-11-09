# Progress road map

Kyle's list, in the order it was given. `[x]` done, `[~]` partly done, `[ ]` not started.
Databases go last. Update this file in the same commit as the work.

- [x] Task reminders so admin work doesn't fall through cracks ("Remind me" on project tasks puts them in the bell and the home feed; Requests no longer exists on main)
- [x] "+" under Projects to add your own project types (in the new-project template dropdown; saved in this browser)
- [x] Sidebar minimizes to icons only
- [x] Home screen: more innovative (queue, day summary, where-to-begin cards while empty)
- [x] Make the app feel alive (pages rise into place in turn, the bell pulses for new items, progress bars animate, home suggests where to begin; all motion off for reduced-motion settings)
- [x] AI agent can complete tasks in any module, with per-module guardrails (prepares drafts in invoices, requests, contacts, vendors, projects and licenses that open prefilled for you to save; cannot save, delete, approve, pay, send or sign; refuses card numbers, SSNs, passwords and tax IDs; max 3 drafts a turn)
- [x] Addressed by your name in the app
- [x] Invoice tracking: frequency choice, stays open until paid (one-time to yearly, shown on each invoice; stays Sent or Overdue until marked paid)
- [x] Licenses & Renewals: templates by business (vehicle registration, tags, insurance, inspection, and 7 other business types)
- [x] Pages stop opening to bare home screens (each module explains itself with a first step when empty; home suggests where to begin)
- [x] Explore more of Licenses & Renewals (templates, certification and policy types, compliance score, add renewals to your calendar, renewal fees with what is coming up in 90 days)
- [x] Vendors: deeper dive (payment terms, how critical, contract end alerts, yearly spend with a 1099 and W-9 check, rating, reminders and notes log, CSV columns)
- [x] Queue on the home dashboard
- [~] Bridge Vendors -> Contacts (menu merged; records still separate, needs database)
- [x] Discuss: what the Projects module should include (built with defaults: owner, progress bar, milestones, dated updates log, link to a contact or vendor, project types; recurring tasks moved here from Requests)
- [x] Discuss: setup for different industries (built with defaults, 17 industries, tick-box bundles in setup, follows industry changes in Settings; every choice is written up in NOTES.md for Kyle to adjust)
- [x] Forms & Paperwork: pick paperwork by business type (28 forms, repeating ones flagged; print, PDF or download after filling in)
- [x] Reporting: dropdown with Reports, Scheduled reports, Materials (scheduled: due banner, print or PDF, no email yet; materials: summary plus per-service PDF and CSV)
- [x] Remove anything that looks AI-coded (Title Case labels now sentence case, blue-to-violet gradients and gradient buttons gone, flat navy sign-in)
- [ ] Approval chain (built, then removed: main dropped approvals from Forms and Vendors, so it was not carried over)
- [~] Fix for invisible admin bottlenecks (approvals unanswered for 5 days and unstarted work with no due date now flagged in the digest, bell and home feed; escalating to a named owner needs team data)
- [x] Document signing (in Forms: typed-name signatures with an explicit agreement, several signers, SHA-256 fingerprint and signed-copy PDF; not a certified e-signature service)
- [x] "Needs your attention" feed
- [x] OCR (photos and scans of licenses and certificates are read: license upload fills the form, and attaching a certificate to a vendor document reads its expiry date; scanned PDFs and the document index are not OCR'd yet)
- [x] Bridge gaps between Contacts and Forms (fill out a form for a contact with their details already in; add the person from a filled-in form to Contacts)
- [x] CRM renamed to Contacts
- [x] Notifications made very useful (bell respects the Settings choices, marks what is new, snoozes per item, lists what is waiting on you and for how long)
- [x] Certifications and compliance tracking for licenses and policies (Certification and Policy types with templates, review cycle = renewal term with reminders, document checklist, compliance score)
- [x] Onboarding packets (in Forms: new employee, vendor and client packets of forms, documents and signatures; progress bar, stale flag after 7 days, print or PDF checklist)
- [~] Ghosting fix: automated vendor compliance reminders + comments/notes log for updates and CYA (due-reminder rules, escalating wording, ghosted flag after 3 and a dated notes log done; sending opens your email app until a mail service exists)
- [ ] Contact / vendor profile with all their documents and notes in one place (needs database)
- [ ] Databases (last)

## Round 2 (your newer list, plus what did not survive the merge)

- [x] Licenses & Renewals gets its own tab on the dashboard (counts by state, what expires next, good-standing percent)
- [x] Audit trail: who did what and when (new Activity page: the person's name, what they did, the time; filter by area; saved in this browser)
- [x] Calendar page in the navigation menu (month grid and agenda; invoices due, license expiries and renewals, tasks, milestones, vendor documents, reminders; filter by kind)
- [x] Fix the Reporting page: it is just a bunch of boxes (overview now leads with headline numbers, a ranked where-to-look-first list, a records-by-service chart and a service-by-service table; each service report has one key-numbers panel)
- [x] Dropdowns on service tabs where they make sense (sidebar now opens Contacts, Tasks and Reporting to their sections; Add license, Add contact and New form each have an arrow with the other ways to add; Reporting has one Export menu for CSV or Excel)
- [x] Rename the AI assistant to Addy
- [x] Send a form after creating it (main already had a Send button on each form; now the Send dialog also opens right after you create a new form)
- [x] Make the app feel alive: pages ease in again
- [x] "Remind me" on the flat Tasks list too, not only inside Projects (the alarm-clock button on each open task; the reminder shows in the bell, on Home and on the calendar)
- [x] AI assistant completes a task in any service, within its limits (Addy now adds to your to-do list, sets reminders and ticks off to-dos by itself, each with Undo; everything else is still a draft you save)
- [x] OCR for scanned PDFs (a PDF with no text layer now has its first 3 pages drawn and read like photos, wherever the text reader is turned on; the document index still skips OCR)
- [ ] Sending email for vendor reminders and scheduled reports (needs a mail service)

## Audit Edit Revisions (from the 5 Nov demo audit)
- [x] Invoices, licenses, vendors, contacts and projects are saved in this browser and survive leaving the page or a reload
- [x] Home, the bell and Reporting read those saved records, so they agree with each service
- [x] Cheap fixes: casing leftovers, Documents h1, friendlier sign-in message, unused logo removed, wordmarks resized
- [~] More Title Case form labels remain (Issued On, Vendor Name and similar); only the ones the audit named were fixed
- [ ] Decide how the demo opens: empty, or with optional sample data (keep in mind AdFlo is not only for small businesses)
- [ ] Accessibility: sidebar chevron tap targets, contrast; Addy's live Claude mode untested
- [x] Landing page at / (hero, features, how it works, Addy, Core and Core + plans; flat styling, no prices because none are set)
