import { addDays } from "@/lib/dates";
import { createRequest, decide, setStatus } from "@/lib/admin/logic";
import type { AdminRequest, Routine } from "@/lib/admin/types";

export function sampleRequests(today: string): AdminRequest[] {
  const make = (id: string, title: string, description: string, requester: string, category: AdminRequest["category"], priority: AdminRequest["priority"], dueOn: string | null, source: AdminRequest["source"] = "manual") =>
    createRequest({ title, description, requester, category, priority, dueOn, source }, addDays(today, -3), id);
  return [
    make("r-1", "Reschedule Thursday's vendor call", "Move the call with Globex to next week and send a new invite.", "Dana Whitfield", "Scheduling", "normal", addDays(today, -1)),
    setStatus(make("r-2", "Collect signed W-9 from Initech", "Chase Initech for the signed form and file it.", "Priya Shah", "Documents", "normal", addDays(today, 2)), "in_progress", today),
    make("r-3", "Wire $4,800 to Globex for the annual license", "Invoice 4471 attached. Pay by the end of the week.", "Hank Scorpio", "Finance & payments", "high", addDays(today, 3), "email"),
    make("r-4", "Give Sam access to the shared drive", "Sam starts Monday and needs the Finance folder.", "Marta Gill", "Accounts & access", "normal", addDays(today, 5)),
    make("r-5", "Order new toner for the front office printer", "Two black cartridges. No rush.", "Pat Lee", "IT & equipment", "low", null),
    decide(make("r-6", "Cancel the unused conference line subscription", "We have not used it since March.", "Kyle Fulwood", "Accounts & access", "normal", null), "approved", "Operations manager", today, "Go ahead."),
    setStatus(make("r-7", "Send the signed lease to the landlord", "Scan and email the countersigned copy.", "Kyle Fulwood", "Documents", "normal", addDays(today, -2)), "done", addDays(today, -1)),
  ];
}

export function sampleRoutines(today: string): Routine[] {
  return [
    { id: "t-1", title: "Reconcile bank statements", description: "Match last month's statements to the ledger.", category: "Finance & payments", every: "monthly", nextDueOn: addDays(today, -2) },
    { id: "t-2", title: "Send weekly team agenda", description: "", category: "Scheduling", every: "weekly", nextDueOn: addDays(today, 4) },
    { id: "t-3", title: "Review software subscriptions", description: "Cancel or renew anything unused.", category: "Vendors & purchasing", every: "quarterly", nextDueOn: addDays(today, 40) },
  ];
}
