/** Connecting a client record to its AdFlo workspace, and getting the owner in. Pure helpers; the database does the work. */
export const WORKSPACE_ACTIONS = ["link", "unlink", "provision", "invite"] as const;
export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export type ParsedWorkspaceRequest =
  | { ok: true; action: "link"; workspaceId: string }
  | { ok: true; action: "unlink" | "provision" | "invite" }
  | { ok: false; message: string };

export function parseWorkspaceRequest(raw: unknown): ParsedWorkspaceRequest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (!WORKSPACE_ACTIONS.includes(r.action as WorkspaceAction)) return { ok: false, message: "Choose what to do." };
  if (r.action === "link") return isUuid(r.workspaceId) ? { ok: true, action: "link", workspaceId: r.workspaceId } : { ok: false, message: "Choose a workspace." };
  return { ok: true, action: r.action as "unlink" | "provision" | "invite" };
}

/**
 * The note staff paste into their own email (AdFlo does not send email yet). It tells the owner to sign up with the
 * exact email the invite was made for, because that is what joins them to the workspace.
 */
export function welcomeMessage(o: { clientName: string; ownerName: string; ownerEmail: string; signupUrl: string; expiresOn?: string | null }): string {
  const hello = o.ownerName.trim() ? `Hi ${o.ownerName.trim().split(/\s+/)[0]},` : "Hi,";
  return [
    hello, "",
    `Your AdFlo account for ${o.clientName} is ready.`, "",
    `1. Open ${o.signupUrl}`,
    `2. Create your account using this email address: ${o.ownerEmail}`,
    "3. Confirm your email when AdFlo asks, then sign in.", "",
    `You will land in the ${o.clientName} workspace as its owner. From there you can invite your team.`,
    ...(o.expiresOn ? ["", `This invitation is open until ${o.expiresOn}.`] : []),
    "", "Thank you,", "Aurum Ventura",
  ].join("\n");
}

/** Database messages written for staff (SQLSTATE 23505, P0002, 22023) are safe to show; anything else is not. */
export function workspaceErrorMessage(code: string | undefined, message: string | undefined): { status: number; message: string } {
  if (code === "42501") return { status: 403, message: "Your role cannot do this, or you have not entered your two-factor code." };
  if (code === "23505" || code === "22023") return { status: 409, message: message || "That cannot be done right now." };
  if (code === "P0002") return { status: 404, message: message || "Not found." };
  return { status: 500, message: "Something went wrong. Try again." };
}
