import type { SupabaseClient } from "@supabase/supabase-js";
import type { TicketCategory, TicketStatus } from "@/lib/control/types";
import type { MyMessage, MyTicket, MyTicketDetail } from "./types";

/** The signed-in member's workspace requests, newest first. Reads go through database functions that return only what a client may see. */
export async function loadMyTickets(supabase: SupabaseClient): Promise<MyTicket[]> {
  const { data, error } = await supabase.rpc("support_my_tickets");
  if (error) throw new Error("Could not load your requests.");
  type Row = { id: string; ticket_no: number; subject: string; category: TicketCategory; status: TicketStatus; created_at: string; last_activity: string; requester_name: string };
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id, ticketNo: r.ticket_no, subject: r.subject, category: r.category, status: r.status, createdAt: r.created_at, lastActivity: r.last_activity, requesterName: r.requester_name }));
}

export async function loadMyTicket(supabase: SupabaseClient, id: string): Promise<MyTicketDetail | null> {
  const { data, error } = await supabase.rpc("support_ticket", { p_id: id });
  if (error) throw new Error("Could not load that request.");
  if (!data) return null;
  const t = data as { id: string; ticket_no: number; subject: string; body: string; category: TicketCategory; status: TicketStatus; created_at: string; requester_name: string; messages: { id: string; author_kind: MyMessage["authorKind"]; author_name: string; body: string; created_at: string }[] };
  return {
    id: t.id, ticketNo: t.ticket_no, subject: t.subject, body: t.body, category: t.category, status: t.status, createdAt: t.created_at, requesterName: t.requester_name,
    messages: t.messages.map((m) => ({ id: m.id, authorKind: m.author_kind, authorName: m.author_name, body: m.body, createdAt: m.created_at })),
  };
}
