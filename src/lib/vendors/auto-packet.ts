import { daysBetween } from "@/lib/dates";
import { PACKETS, startPacket, type Assignment } from "@/lib/packets/logic";
import type { Vendor } from "./types";

/**
 * The automatic subcontractor packet: when a workspace has switched it on, a vendor added in the last couple of weeks that has an email
 * gets the "New subcontractor" packet started for it (and emailed, if the workspace chose that). Once per vendor: a note on the vendor's
 * file remembers it, so deleting the packet or finishing it never starts another.
 */
export const NEW_VENDOR_DAYS = 14;
export const MAX_PACKETS_PER_WORKSPACE = 10;
export const PACKET_NOTE_PREFIX = "auto-packet-";
export const AUTO_PACKET_BY = "AdFlo (automatic)";

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;
const TEMPLATE = PACKETS.find((p) => p.id === "pk-sub")!;

/** Vendors that should get a packet today: new, active, with an email, never handled before and with no packet to that address already. */
export function packetTargets(vendors: Vendor[], packets: Pick<Assignment, "email">[], today: string): Vendor[] {
  const have = new Set(packets.map((p) => p.email.trim().toLowerCase()).filter(Boolean));
  return vendors
    .filter((v) => v.status !== "inactive" && EMAIL.test(v.email.trim()) && !have.has(v.email.trim().toLowerCase())
      && daysBetween(v.createdOn, today) >= 0 && daysBetween(v.createdOn, today) <= NEW_VENDOR_DAYS
      && !(v.activity ?? []).some((n) => n.id.startsWith(PACKET_NOTE_PREFIX)))
    .slice(0, MAX_PACKETS_PER_WORKSPACE);
}

/** The packet for a vendor: named after the contact, else the company. Its id is made from the vendor, so it is only ever made once. */
export function vendorPacket(v: Vendor, today: string): Assignment {
  return startPacket(TEMPLATE, v.contactName.trim() || v.name, v.email, today, `pk-auto-${v.id}`.slice(0, 80));
}

export const packetNoteId = (v: Pick<Vendor, "id">) => `${PACKET_NOTE_PREFIX}${v.id}`.slice(0, 80);
