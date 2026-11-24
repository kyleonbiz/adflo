import type { Ticket, TicketPriority } from "./types";

/** What a support request is about, worked out from its words. */
export type TicketTopic = "sign_in" | "billing" | "data" | "documents" | "invoices" | "licenses" | "vendors" | "other";

export interface Triage {
  priority: TicketPriority;
  topic: TicketTopic;
  /** Why it was rated high, in a few words; empty otherwise. */
  reason: string;
  /** A draft first reply for staff to read, change and send. Never sent by itself. */
  reply: string;
}

/** Things that should not wait: someone cannot get in, may have lost data, or has been charged wrongly, or says it is urgent. */
const URGENT: [RegExp, string][] = [
  [/\b(can'?t|cannot|unable to|won'?t|not able to)\b.{0,25}\b(sign|log)\s?-?in\b|locked out|forgot(ten)? (my )?password|reset (my )?password/i, "cannot sign in"],
  [/\b(lost|missing|deleted|disappeared|vanished|gone)\b.{0,30}\b(files?|documents?|data|records?|invoices?)\b|\b(files?|documents?|data|records?|invoices?)\b.{0,30}\b(lost|missing|deleted|disappeared|vanished|gone)\b/i, "may have lost data"],
  [/\b(charged|billed)\b.{0,20}\b(twice|two times|again|wrong|incorrect|too much)\b|double charge|unauthori[sz]ed charge|refund/i, "billing problem"],
  [/\b(urgent|asap|emergency|immediately|right away)\b|\bdown\b|\bnot working\b|\bbroken\b/i, "marked urgent or not working"],
];

const TOPICS: [TicketTopic, RegExp][] = [
  ["sign_in", /sign\s?-?in|log\s?-?in|password|locked out|two[- ]factor|2fa|verification code/i],
  ["billing", /billing|charge[ds]?|payment|subscription|invoice from adflo|refund|cancel|plan|price|pricing|receipt/i],
  ["documents", /document|upload|folder|file|pdf|storage|download|share link/i],
  ["invoices", /invoice|payment reminder|recurring/i],
  ["licenses", /licen[sc]e|permit|insurance|certificate|renewal|expir/i],
  ["vendors", /vendor|subcontractor|w-?9|supplier/i],
  ["data", /export|import|csv|spreadsheet|backup/i],
];

const SIGN = "Thanks for reaching out to AdFlo support.";
const REPLIES: Record<TicketTopic, (who: string) => string> = {
  sign_in: (who) => `Hi ${who},\n\n${SIGN} Sorry you are having trouble getting in. Please try "Forgot your password?" on the sign-in page; the email comes from AdFlo and may take a few minutes (check spam too). If it still does not work, reply with the email address you sign in with and what you see on screen, and we will look into it right away.\n\nThank you`,
  billing: (who) => `Hi ${who},\n\n${SIGN} We are looking at your billing question now. To make sure we look at the right thing, could you reply with the date and amount of the charge in question? We will come back to you as soon as we have checked.\n\nThank you`,
  data: (who) => `Hi ${who},\n\n${SIGN} Could you tell us which page you were on and what you expected to see? We will take a look and come back to you.\n\nThank you`,
  documents: (who) => `Hi ${who},\n\n${SIGN} To help with your documents question, could you tell us the name of the file or folder and what happened (an error message, or something that did not appear)? A screenshot is welcome.\n\nThank you`,
  invoices: (who) => `Hi ${who},\n\n${SIGN} To help with your invoice question, could you tell us the invoice number and what you expected to happen? We will take a look and come back to you.\n\nThank you`,
  licenses: (who) => `Hi ${who},\n\n${SIGN} To help with your licenses question, could you tell us which license or policy it is and what you are seeing? We will take a look and come back to you.\n\nThank you`,
  vendors: (who) => `Hi ${who},\n\n${SIGN} To help with your vendor question, could you tell us which vendor it is and what you are seeing? We will take a look and come back to you.\n\nThank you`,
  other: (who) => `Hi ${who},\n\n${SIGN} We have your message and are looking into it. Could you tell us a little more about what you were trying to do and what happened? A screenshot is welcome. We will come back to you as soon as we can.\n\nThank you`,
};

/**
 * Sorts a support request by what it says: how urgent it is, what it is about, and a draft first reply. Rule based and
 * deterministic: it never changes a ticket or sends anything, it only suggests, and staff stay in charge of both.
 */
export function triageTicket(t: Pick<Ticket, "subject" | "body" | "requesterName" | "priority">): Triage {
  const text = `${t.subject}\n${t.body}`;
  const hit = URGENT.find(([re]) => re.test(text));
  const topic = TOPICS.find(([, re]) => re.test(text))?.[0] ?? "other";
  const who = t.requesterName.trim().split(/\s+/)[0] || "there";
  const priority: TicketPriority = t.priority === "high" ? "high" : hit ? "high" : t.priority;
  return { priority, topic, reason: hit && t.priority !== "high" ? hit[1] : "", reply: REPLIES[hit && topic === "other" ? urgentTopic(hit[1]) : topic](who) };
}

function urgentTopic(reason: string): TicketTopic {
  return reason === "cannot sign in" ? "sign_in" : reason === "billing problem" ? "billing" : "other";
}

export const TOPIC_LABEL: Record<TicketTopic, string> = { sign_in: "Signing in", billing: "Billing", data: "Import and export", documents: "Documents", invoices: "Invoices", licenses: "Licenses", vendors: "Vendors", other: "General" };
