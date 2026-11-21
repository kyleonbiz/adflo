# Screen audit (2026-11-21)

Method: README read in full for intent and "choices made on purpose" (those are not flagged as gaps), then the screen
components read for each module. The app was **not run or screenshotted** (no `node_modules` installed), so these are
code-level findings: visual and runtime issues may be missing. Priority: **H** high value, **M** medium, **L** polish.

## Cross-cutting

| # | Finding | Pri |
|---|---|---|
| 1 | **Naming drift: "AI Assistant" vs "Addy".** README and positioning say Addy; the sidebar (`modules/sidebar-nav.tsx:124`) and the page `<h1>` (`assistant/assistant-page.tsx:166`) say "AI Assistant". Use "Addy" (subtitle can say "your back-office assistant"). | M |
| 2 | **Delete/void dialogs are copy-pasted** in invoices, licenses, vendors, projects, forms (5 near-identical `Dialog variant="alert"` blocks), while Control center clients uses `window.confirm` (`control/clients-page.tsx:132,163`). Extract a shared `ConfirmDialog` and drop `window.confirm`. | M |
| 3 | **Preview banner duplicated.** The same amber `role="note"` markup is repeated in 14 places. One `PreviewNote` component keeps wording and contrast consistent. | L |
| 4 | **No bulk actions** outside Contacts, Files and Documents. Invoices, Licenses, Vendors, Forms and Tasks cannot multi-select (mark paid, send reminders, export selection, delete). For an "admin burden" product this is the biggest workflow gap. | H |
| 5 | **Inconsistent list controls.** Search + filter everywhere, but sort exists on Licenses, Vendors, Contacts, Tasks and Documents and is absent on **Invoices** (fixed grouping only) and **Forms**. Vendors persists filters in the URL; the others lose them on navigation. Align on: search, status filter, sort, filters in the URL. | M |
| 6 | **No print/PDF outside Forms and Reporting.** Invoices (a printable invoice/statement), Licenses (compliance summary for an auditor or insurer) and Vendors (compliance packet) would be natural. README lists "one-click audit ZIP" as not built; a printable compliance summary is a cheap first step toward it. | M |
| 7 | **Tiny text.** 21 uses of `text-[10px]`/`text-[11px]` (e.g. calendar pills). Below comfortable reading size on phones; raise to 12px where it carries information. | L |
| 8 | **Activity log is shallow** (see Activity). | M |
| 9 | Chasing reminders for licenses and forms are listed as not built (README); vendors and invoices have them. Biggest remaining "automation" gap and the clearest fit with "lower the burden". | H |

## Home / Dashboard (`modules/dashboard.tsx`)
- "Needs your attention" works well (filter chips, snooze, add to today). **Snooze is "until tomorrow" only**; offer 3 days / 1 week, and a one-click "snooze all low severity".
- Shows 5 items then "View all"; sort order is not visible to the user. Add a short "ordered by urgency" hint or severity grouping.
- KPI cards: only two (`money`, `tasks`) have a distinct icon; others fall back to a mini bar chart. Inconsistent card anatomy. Because AdFlo holds no money, the `DollarSign` tile reads as accounting; consider "Outstanding invoices" wording/icon that makes clear it is tracking, not payments.
- Add an equipment/asset widget once assets exist (positioning calls it core; see Modules below).

## Documents (`dms/`)
- Most mature module (60 aria labels, search, versioning, sharing, audit). Gaps from README: expiration dates are **informational only** (no notification, no entry on the Calendar, no "expiring soon" filter). Feeding document expiry into the bell and Calendar is high value and small.
- Previews limited to PDF, images, CSV, text; DOCX/XLSX fall back to download. Acceptable, but say so in the panel.
- No "revoke all share links for this document" button.
- No bulk move/tag/share (selection exists; check what actions it offers).

## Invoices (`invoices/invoices-page.tsx`)
- Good: summary tiles, status filter, void/reopen, mark-paid with date validation, CSV export.
- **No sort, no date-range or client filter.** "Export CSV" exports only what the current filters show, which is not stated on the button; label it "Export CSV (N shown)".
- Grouping is fixed; add "Group by: status / client / month".
- No client-level view ("everything for this client"): the Contacts profile pages should list invoices.
- Printable invoice view is missing (see cross-cutting #6).
- Deleting asks for confirmation but offers no Undo, whereas Vendors and Contacts do (`say(..., before)` pattern). Reuse that undo.
- Summary tile colours (`text-red-600`, `text-amber-600`) are hard-coded rather than tokens; verify dark-mode contrast.

## Licenses & Renewals (`licenses/`)
- Good: risk tiers, compliance score, templates, OCR prefill, renewal flow.
- No **reminder emailing** (known); add "Remind me to renew" via the existing Remind menu and a Send-reminder email dialog like Vendors.
- No bulk renew, no "expiring in next 30/60/90 days" quick chips next to the sort (the data exists for the 90-day fee panel).
- No printable compliance summary (cross-cutting #6). This is the most useful single export for contractors (license/insurance proof for a bid or client).
- Attachments: a license has required documents but the link to a Documents-module file is not obvious; a "Pick from Documents" action would unify the two.

## Vendors (`vendors/`)
- Best-covered list (sort, URL filters, merge, notes log, undo, 31 aria labels). Remaining: "Needs documents" is surfaced as `issues` toggle; make the count visible on the toggle. Vendor profile page exists (`vendors/[id]`); README road map still lists "contact/vendor profile with all documents and notes" as open, so verify and tick or finish it.
- Merge and delete dialogs duplicate the confirm pattern (cross-cutting #2).

## Contacts (`contacts/`)
- Strong: import, duplicate cleanup, bulk, export.
- Profile page (`contacts/[id]`): add related **invoices, projects, forms and documents** in one timeline; this is the "records in one place" promise and closes the road-map item.
- Positioning check: the module summary says "Customers, leads and vendors"; "leads" pushes toward CRM. Consider "Customers, vendors and other contacts".

## Tasks & projects (`projects/`)
- Largest page (497 lines) with tasks view, projects, milestones, updates log. Consider splitting `projects-page.tsx` (state + dialogs + list) for maintainability.
- Tasks: no "My tasks / assigned to" filter without team data; add owner filter and a "Due this week" quick chip.
- Slug helper duplicated in `projects-page.tsx` and `forms-page.tsx`; move to `lib/utils`.

## Forms & Paperwork (`forms/`)
- Returns by email only (known); manual "Add responses" paste is the weakest step in the product. Until the database lands, show a clearer checklist ("1 send, 2 wait for email, 3 paste") and a paste counter.
- No sort; no search match on response content.
- Signatures and packets are good. Add reminder chasing for unsigned requests (cross-cutting #9).

## Reporting (`reporting/`)
- Tabs on desktop and a dropdown on phones (`Reporting section`): fine. Dual navigation means two a11y trees; check focus management when the viewport changes.
- Scheduled reports show "nothing is emailed" until a mail service exists; surface that once at the top of the tab, not per report.
- Custom data import duplicates the Contacts import UI patterns; the shared import engine exists, so make `data-import-dialog` and `contacts/import-dialog` share the stepper component.

## Calendar (`calendar/calendar-page.tsx`)
- Month, Agenda, Next-month views; accessible day buttons. Gaps:
  - **No week view** and no add-from-calendar ("+" on a day to add a task/reminder).
  - Filter list lacks **Documents** (expirations) and Forms (unsigned/overdue).
  - 2 pills/day then "+N more" opens nothing but selects the day, fine, but pills are `text-[11px]`.
  - **ICS**: `lib/ics.ts` exists; expose "Subscribe/Download .ics" on this page if not already.
  - Agenda window is fixed at 60 days; add 30/60/90 selector.

## Activity (`audit/activity-page.tsx`, 57 lines)
- Only an area filter. Add **person filter, date range, search, and CSV export**, plus pagination or "Load more" (renders the entire list). This is the audit trail the product sells; it is currently the thinnest screen. Linked records that were deleted still link to dead pages: show the entry as plain text when the target no longer exists.

## Addy (`assistant/assistant-page.tsx`)
- Input capped at 200 characters (`maxLength={200}`): too short for describing a business or pasting a request. Raise to ~1,000.
- No conversation reset/"New chat" button, no history; a long chat grows without bound in state.
- Only the assistant bubble announces nothing to screen readers (`role="status"` only on "Thinking…"). Add `aria-live="polite"` to the log.
- Header icon and "AI Assistant" title (naming, cross-cutting #1). Show which mode is active (Claude vs built-in rules) so a user knows why answers differ.
- Chips "Suggested replies" are good; add 3 starter prompts on an empty conversation ("Add a license renewal", "What's due this week?", "Draft an invoice").

## Tidy up files (`files/`)
- Safe by design (never moves files). Hidden from the menu: reachable via Documents and Guided setup only. Add a link in Settings and in the Documents empty state so it is discoverable. Clearly flag the 500 MB/50 MB limits before the user picks a folder, not after.

## Settings / Guided setup (`setup/`, `settings/`)
- Two overlapping entry points (Guided setup wizard and Settings tabs). Make "Finish setup" progress visible on Home until done.
- Choices are per browser until the database is connected; make that obvious in the Appearance/profile tabs for non-database previews.
- Team tab: "No workspace switcher" and "no leave workspace" remain (README limitations). A user in two workspaces cannot reach the second.

## Control center (`control/`)
- Wide surface (2,359 lines). Replace the two `window.confirm` calls with the shared dialog (cross-cutting #2).
- Billing invoices live only in the staff member's browser (README); a staff member clearing storage loses them. At minimum add an export-all/backup button and a warning banner, or move to a table.
- Client directory: add saved filters (Trial, Quiet 30d, Unpaid) and bulk remind for onboarding.

## Public screens (landing, login/signup, form, invoice, agreement, invite)
- Landing: "Log in / Sign up" copy is in; make sure hero and sections state the "alongside accounting, payroll and construction software" boundary plainly (CLAUDE.md requires it).
- Auth: add password visibility toggle and password-strength hint if missing; confirm "Confirm email" waiting state has a resend button.
- Public form page: shows answers by emailing them back; consider a "copy my answers" button with the `ADFLO-RESPONSE:` line to reduce errors.

## Positioning gap: equipment and asset tracking
CLAUDE.md and the README describe equipment and asset tracking (tools, vehicles, appliances, HVAC units, keys) as built
in. The module registry (`lib/modules/registry.ts`) has **no assets/equipment module**; the closest pieces are vehicle
registration license templates and Documents. This is the largest gap between the positioning and the screens. Suggested
v1: an **Equipment** module (item, type, location/assigned to, serial, purchase date, warranty and inspection dates,
linked documents/vendor, status), with warranty and service dates feeding Calendar, Home and Reporting, and Addy drafts.

## Suggested order
1. Shared `ConfirmDialog` + `PreviewNote`; rename to Addy; Addy input length + aria-live. (small, safe)
2. Document expiry into Calendar/bell; Activity filters/search/export. (small, high value)
3. Chasing reminders for licenses and forms. (README's biggest open automation item)
4. Bulk actions on Invoices, Licenses, Vendors, Tasks; sort on Invoices/Forms.
5. Printable compliance summary (Licenses + Vendors), the first step toward the audit export.
6. Contact/vendor profile timelines.
7. Equipment & assets module.

## Status after "do them all" (2026-11-21)

**Done:** Addy naming, input length, aria-live, New chat, starter prompts and mode line; shared `ConfirmDialog` and `PreviewNote`
(Control center `window.confirm` removed); readable small text; bulk actions on Invoices, Licenses, Vendors, Tasks and Equipment;
Invoices sort, group by, labelled export and undo on delete; Forms sort and response search; Tasks assignee filter;
chasing reminders for licenses and unsigned signers; Activity search, person, date range, CSV and Show more; Calendar document
expiries (signed in), equipment, `.ics` download and agenda length; print compliance summaries for Licenses and Vendors;
linked projects and document search on contact and vendor profiles; Home snooze for a week and finish-setup nudge; receipt icon
on the invoice KPI; Contacts wording; Tidy up limits shown before choosing; Billing back up and restore; the new Equipment
module (also on Calendar and Home); fixed `.ics` semicolon escaping.

**Also done in the follow-up:** bulk actions on Forms; Calendar week view and add-a-reminder on a day; Control center "Quiet 30d" and "Invitation pending" client filters.

**Third round (Documents and the rest):** Documents bulk move, tag and trash (checkbox in each card's bottom-left corner);
"Expiring documents" panel at the top of Documents; Revoke all share links; clearer preview note for Word and Excel; filters kept in
the address bar on Invoices, Licenses and Forms (Vendors already did this); "Find files for this license in Documents" link on
licenses; Equipment report in Reporting; Addy can open an equipment draft; Control center "Remind all" on Onboarding.

**Still not done:** a combined timeline on profiles; a document picker that attaches a real file to a license requirement; filters in
the address bar for Tasks; Equipment on the dashboard workload chart; a bell alert for document expiry (the Documents panel and
Calendar show it); Activity dead-link handling (entries link to module pages, not single records, so there is little to break);
splitting `projects-page.tsx`; sharing the stepper between the two CSV importers; the Reporting tabs/dropdown focus check.
Nothing was run against a hosted Supabase project, so the `equipment` migration is untested there.
