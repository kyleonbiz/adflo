import { formatDayLong } from "@/lib/dates";

/** One person who has to sign. A typed name plus an explicit "I agree" counts as their signature. */
export interface Signer {
  id: string;
  name: string;
  email: string;
  /** ISO timestamp, set when they sign. */
  signedAt?: string;
  /** What they typed as their signature. */
  signature?: string;
  /** Days a reminder email was prepared for this signer, oldest first. */
  remindedOn?: string[];
}

export interface SigningRequest {
  id: string;
  title: string;
  /** Where the document came from. */
  source: "submission" | "file" | "text";
  /** The words signed, for a form submission or pasted text. Empty for a file. */
  text: string;
  /** The file's name, for a file. */
  fileName?: string;
  /** SHA-256 of the document as it was when signing was requested, in hex. Proves it was not changed afterwards. */
  hash: string;
  signers: Signer[];
  createdOn: string;
  createdBy: string;
}

type SigningStatus = "waiting" | "partly" | "signed";

export const MAX_SIGNERS = 10;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function status(r: SigningRequest): SigningStatus {
  const signed = r.signers.filter((s) => s.signedAt).length;
  return signed === 0 ? "waiting" : signed === r.signers.length ? "signed" : "partly";
}

/** Parses "Name <email>" or "Name, email" lines. Returns the signers or what is wrong. */
export function parseSigners(text: string, newId: () => string): { signers: Signer[] } | { error: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: "Add at least one signer." };
  if (lines.length > MAX_SIGNERS) return { error: `Add at most ${MAX_SIGNERS} signers.` };
  const signers: Signer[] = [];
  for (const line of lines) {
    const m = line.match(/^(.*?)\s*[<,]\s*([^<>,\s]+@[^<>,\s]+)\s*>?$/);
    if (!m && /[<>@]/.test(line)) return { error: `"${line}" should look like Name <name@company.com>.` };
    const name = (m ? m[1] : line).trim();
    const email = m ? m[2] : "";
    if (name.length < 2) return { error: `"${line}" needs a name.` };
    if (email && !EMAIL.test(email)) return { error: `"${email}" is not an email address.` };
    if (signers.some((s) => s.name.toLowerCase() === name.toLowerCase())) return { error: `${name} is listed twice.` };
    signers.push({ id: newId(), name, email });
  }
  return { signers };
}

/** Records a signature. The typed name must match the signer's name, so nobody signs for someone else by accident. */
export function sign(r: SigningRequest, signerId: string, typed: string, agreed: boolean, nowIso: string): { request: SigningRequest } | { error: string } {
  const signer = r.signers.find((s) => s.id === signerId);
  if (!signer) return { error: "That signer is not on this request." };
  if (signer.signedAt) return { error: `${signer.name} has already signed.` };
  if (!agreed) return { error: "Confirm that you agree to sign." };
  if (typed.trim().toLowerCase() !== signer.name.toLowerCase()) return { error: `Type ${signer.name} exactly as it is listed.` };
  return { request: { ...r, signers: r.signers.map((s) => (s.id === signerId ? { ...s, signedAt: nowIso, signature: typed.trim() } : s)) } };
}

const when = (iso: string) => `${formatDayLong(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;

/** The signed copy as plain text: the document (when it is text), every signature, and the fingerprint. */
export function signedCopyText(r: SigningRequest): string {
  const lines = [r.title.toUpperCase(), r.source === "file" ? `Document: ${r.fileName ?? "attached file"}` : "", ""];
  if (r.text) lines.push(r.text.trim(), "");
  lines.push("SIGNATURES");
  for (const s of r.signers) {
    lines.push(s.signedAt ? `  ${s.signature}  (${s.name}${s.email ? `, ${s.email}` : ""}) signed ${when(s.signedAt)}` : `  ${s.name}${s.email ? ` (${s.email})` : ""}: not signed yet`);
  }
  lines.push("", `Requested by ${r.createdBy} on ${formatDayLong(r.createdOn)}`, `Document fingerprint (SHA-256): ${r.hash}`, "",
    "A typed name with an explicit agreement was recorded as each signature. Keep this page with the original document.");
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n") + "\n";
}

/** Days between reminders to the same signer. */
export const SIGNER_REMINDER_GAP_DAYS = 7;

const dayGap = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** True for a signer who has not signed, has an email, and was not reminded in the last week (a request needs to be at least 2 days old). */
export function signerDueReminder(r: SigningRequest, s: Signer, today: string): boolean {
  if (s.signedAt || !s.email) return false;
  const last = (s.remindedOn ?? []).at(-1);
  return last ? dayGap(last, today) >= SIGNER_REMINDER_GAP_DAYS : dayGap(r.createdOn, today) >= 2;
}

/** The reminder to a signer who has not signed yet. */
export function signerReminderEmail(r: SigningRequest, s: Signer): { to: string; subject: string; body: string } {
  const n = (s.remindedOn ?? []).length;
  return {
    to: s.email,
    subject: `${n === 0 ? "Please sign" : "Reminder: please sign"} ${r.title}`,
    body: [`Hi ${s.name.split(" ")[0] || "there"},`, "", n === 0 ? `A quick reminder that "${r.title}" is waiting for your signature.` : `Following up: "${r.title}" is still waiting for your signature.`, "", "Please reply when it is done, or let me know if you have questions.", "", "Thank you"].join("\n"),
  };
}

export function logSignerReminder(r: SigningRequest, signerId: string, today: string): SigningRequest {
  return { ...r, signers: r.signers.map((s) => (s.id === signerId ? { ...s, remindedOn: [...(s.remindedOn ?? []), today].slice(-20) } : s)) };
}
