# Spec: Asset tracking (first version)

Status: agreed in discussion, not built. Positioning: see `CLAUDE.md`.

## Purpose

AdFlo is an administrative management platform with compliance and individual equipment and asset tracking built in.
Asset tracking answers three questions for a business owner:

1. **What do we own, and where is it?** (tools, vehicles, appliances, HVAC units, keys)
2. **Who has it right now?**
3. **What is coming due?** (warranty ending, service or inspection, registration or insurance renewal, a key that should be back)

It is an administrative record, not an inventory system. It must not grow into stock counts, purchasing or accounting.

## Scope

In the first version:

- One list page, **Assets**, with search and filters for type, status and assigned person.
- One add and edit form.
- Dated items that raise reminders, using the same rules and surfaces as licenses.
- Attached documents and a dated notes log on each record.
- Duplicate and add-several actions.
- Switched on for every industry. Type lists and labels are data, so other industries can add their own.

Out of scope for the first version (do not build): quantities or stock counts, barcodes or QR scanning, depreciation or accounting values,
purchasing or reordering, check-in and check-out workflows, parent and child (grouping) relationships, maintenance scheduling beyond dated reminders.

## The record

One record per individual item. Ten identical drills are ten records. Each key is its own record
(for a property manager that can be one record per key per unit).

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | "Milwaukee drill", "Truck 2", "Unit 4B front door key" |
| `type` | choice, required | Tool, Vehicle, Appliance, HVAC unit, Key, Other. A short editable list kept as data. |
| `identifier` | text | Serial number, VIN, key tag or unit number. One free-text field. |
| `status` | choice | In use, In storage, In repair, Retired. Default In use. |
| `location` | text | Free text, such as "Truck 2", "Unit 4B", "Shop". Also how items are loosely grouped (no parent and child links). |
| `assignedTo` | one of: team member, contact, vendor, or free text | Who has it now. Team members cover tools, vehicles and keys; contacts cover lent or rented items; vendors cover items out for repair or on loan. Free text covers "left at the job site". Stores only the current holder, no history. |
| `purchasedOn` | date | |
| `purchasePrice` | money, optional | Information only. No depreciation or totals. |
| `vendor` | link to a Vendor, optional | Where it was bought or who services it. |
| `dates` | list of dated items | See below. |
| `notes` | dated log | Same shape as the vendor activity log: date, text, who. Doubles as simple service history. |
| `documents` | attachments | Receipt, manual, warranty, registration, inspection report. Uses the existing document handling. |
| `createdOn` | date | |

### Dated items

A record can carry a few dated items, each with a label, a due date and an optional reminder lead time.
Suggested labels (editable): Warranty ends, Next service, Inspection due, Registration renews, Insurance renews, Key due back.

Dated items behave like license dates:

- State: upcoming, due soon, overdue (same thresholds and wording as licenses).
- They appear in the dashboard "Needs your attention" list, under a new Assets area with its own filter chip.
- They appear in the 7-day "due" chart and on the calendar.
- A retired asset raises no reminders.

## Behaviour

- **Duplicate:** copies a record, clears `identifier`, `assignedTo` and notes, and opens it for editing.
- **Add several:** creates N copies of a record at once, each with a blank identifier to fill in.
- **Assign:** changing `assignedTo` adds a dated line to the notes ("Assigned to Sam, 2026-11-20"), so there is a trail without a check-out workflow.
- **Delete vs retire:** retiring keeps the record and its history; delete is separate and confirmed.
- **Search:** by name, identifier, location and assigned person.
- **Audit trail:** create, edit, assign, retire and delete are recorded in the existing activity trail.

## Fit with the existing app

- New module **Assets** alongside the others (`src/lib/assets/`, `src/components/assets/`, `/app/assets`), registered in the module registry
  and the plan feature list. It follows the Licenses module's structure (types, logic, validation, list page, card, form dialog).
- Records are stored the same way as other modules: in the browser in preview mode, and in the workspace records tables when a database is connected.
  No new table should be needed for the first version.
- Plan gating: a new `assets` feature in `src/lib/control/tiers.ts`, included in the same plans as Licenses.
- Industry setup: the Construction & trades preset suggests starter types (Tool, Vehicle, Key). Other industries get their own starter types later.
- Dashboard: asset dates join `buildDashboard` as a new item area, with the same severity and snooze behaviour.
- Contacts and Vendors are linked by id, not copied.

## Acceptance checks (when built)

- A user can add, edit, duplicate, retire and delete an asset, and the list filters by type, status and assigned person.
- An asset with an overdue dated item appears under "Needs your attention" with the right label; a retired one does not.
- Reassigning an asset adds a dated note.
- Unit tests cover the dated-item states, duplicate and add-several, and the dashboard items.
- An e2e spec covers add, assign and a reminder showing on the dashboard.

## Open decisions (not blocking the spec)

- Exact starter type lists per industry beyond Construction & trades.
- Whether the property-manager tailoring (one key per unit, unit as a location) needs its own template when that vertical opens.
