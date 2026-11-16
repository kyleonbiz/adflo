/**
 * Whether a client's workspace is switched off. The database is what actually locks it (see the suspend-lock
 * migration); this only decides what to tell the person. A lookup that fails counts as "ok" here, because the
 * database refuses the data either way and a hiccup should not show a paused screen to a paying client.
 */
export type Standing = "ok" | "suspended" | "cancelled";

export const parseStanding = (v: unknown): Standing => (v === "suspended" || v === "cancelled" ? v : "ok");

export const isPaused = (s: Standing): s is Exclude<Standing, "ok"> => s !== "ok";

export function pausedText(s: Exclude<Standing, "ok">): { title: string; body: string } {
  return s === "cancelled"
    ? { title: "Your account is closed", body: "Your AdFlo account has been closed. Your files are kept. Contact AdFlo if you would like to come back." }
    : { title: "Your account is paused", body: "Your AdFlo account has been paused, so your workspace is closed for now. Nothing has been deleted. Contact AdFlo to turn it back on." };
}
