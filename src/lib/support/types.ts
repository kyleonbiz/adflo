import type { TicketCategory, TicketStatus } from "@/lib/control/types";

/** What a client calls each status. The same three states staff see, in the client's voice. */
export const CLIENT_STATUS_LABEL: Record<TicketStatus, string> = { open: "Open", pending: "Waiting on you", closed: "Closed" };
export const CLIENT_CATEGORY_HINT: Record<TicketCategory, string> = {
  question: "How do I do something in AdFlo?",
  problem: "Something is broken or not behaving.",
  request: "Add a seat, change a plan, or anything else.",
};

/** One row in a workspace's list of requests. */
export interface MyTicket { id: string; ticketNo: number; subject: string; category: TicketCategory; status: TicketStatus; createdAt: string; lastActivity: string; requesterName: string }
/** One reply in the conversation. */
export interface MyMessage { id: string; authorKind: "client" | "staff"; authorName: string; body: string; createdAt: string }
/** One request with its conversation. The first message is the request itself (`body`). */
export interface MyTicketDetail { id: string; ticketNo: number; subject: string; body: string; category: TicketCategory; status: TicketStatus; createdAt: string; requesterName: string; messages: MyMessage[] }
