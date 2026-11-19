/** Connecting a client record to its AdFlo workspace, and getting the owner in. Pure helpers; the database does the work. */
const WORKSPACE_ACTIONS = ["link", "unlink", "provision", "invite"] as const;
type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

import { isUuid } from "./patterns";

type ParsedWorkspaceRequest =
  | { ok: true; action: "link"; workspaceId: string }
  | { ok: true; action: "unlink" | "provision" | "invite" }
  | { ok: false; message: string };

export function parseWorkspaceRequest(raw: unknown): ParsedWorkspaceRequest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (!WORKSPACE_ACTIONS.includes(r.action as WorkspaceAction)) return { ok: false, message: "Choose what to do." };
  if (r.action === "link") return isUuid(r.workspaceId) ? { ok: true, action: "link", workspaceId: r.workspaceId } : { ok: false, message: "Choose a workspace." };
  return { ok: true, action: r.action as "unlink" | "provision" | "invite" };
}

const oneLine = (v: string) => v.replace(/[\r\n\u0000-\u001f]+/g, " ").trim();
const firstName = (name: string) => (name.trim() ? `Hi ${name.trim().split(/\s+/)[0]},` : "Hi,");

/** Subject line for the invitation email. The name is flattened to one line so it cannot add headers. */
export const invitationEmailSubject = (clientName: string) => `You are invited to AdFlo${oneLine(clientName) ? ` for ${oneLine(clientName)}` : ""}`;

/**
 * The invitation: emailed when the owner is invited, or copied and sent by hand. Its link confirms the invitation; only after
 * that can the owner create their account, and it must be with the exact email the invitation was made for.
 */
export function invitationMessage(o: { clientName: string; ownerName: string; ownerEmail: string; inviteUrl: string; expiresOn?: string | null }): string {
  return [
    firstName(o.ownerName), "",
    `You are invited to AdFlo for ${o.clientName}.`, "",
    `1. Open this link and confirm your invitation: ${o.inviteUrl}`,
    `2. Create your account using this email address: ${o.ownerEmail}`,
    "3. Confirm your email when AdFlo asks, then sign in.", "",
    `You will land in the ${o.clientName} workspace as its owner. From there you can invite your team.`,
    ...(o.expiresOn ? ["", `This invitation is open until ${o.expiresOn}.`] : []),
    "", "Thank you,", "AdFlo",
  ].join("\n");
}

/** Subject line for the welcome email, sent once the owner is in. */
export const welcomeEmailSubject = (clientName: string) => `Welcome to AdFlo${oneLine(clientName) ? `, ${oneLine(clientName)}` : ""}`;

/** The welcome: sent after the owner has signed in, by email or copied. It says what to do first. It has no sign-up link. */
export function welcomeMessage(o: { clientName: string; ownerName: string; loginUrl: string }): string {
  return [
    firstName(o.ownerName), "",
    `Welcome to AdFlo. The ${o.clientName} workspace is ready. Here is how to get started:`, "",
    `1. Sign in any time at ${o.loginUrl}`,
    "2. Open Settings, then Guided setup. A few short questions pick the right services and templates for your business.",
    "3. Add your business details under Business profile, and invite your team under Team.",
    "4. Add your first records: licenses, vendors, projects, equipment and documents.", "",
    "AdFlo is your administrative management platform. Records, deadlines, compliance and equipment live in one place, so the paperwork takes less of your time.", "",
    "If anything is unclear, just reply to this email.",
    "", "Thank you,", "AdFlo",
  ].join("\n");
}

/** Database messages written for staff (SQLSTATE 23505, P0002, 22023) are safe to show; anything else is not. */
export function workspaceErrorMessage(code: string | undefined, message: string | undefined): { status: number; message: string } {
  if (code === "42501") return { status: 403, message: "Your role cannot do this, or you have not entered your two-factor code." };
  if (code === "23505" || code === "22023") return { status: 409, message: message || "That cannot be done right now." };
  if (code === "P0002") return { status: 404, message: message || "Not found." };
  return { status: 500, message: "Something went wrong. Try again." };
}
