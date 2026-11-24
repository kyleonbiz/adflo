import { CANONICAL_ORIGIN } from "@/lib/site-url";

/**
 * AdFlo's email layout: a centered card on a soft background, a brand banner with the wordmark, a large headline, an
 * optional panel of key details, an optional button, and a quiet footer. Built from tables and inline styles because that
 * is what mail apps render consistently. Every piece of text is escaped here, so callers pass plain strings.
 */
export interface EmailContent {
  /** Short text some inboxes show beside the subject. */
  preheader?: string;
  headline: string;
  /** Paragraphs under the headline. */
  intro?: string[];
  /** Key details in a tinted panel: label on the left, value on the right. */
  panel?: [label: string, value: string][];
  /** A short code to type somewhere (shown large, centered). */
  code?: string;
  /** Numbered steps. */
  steps?: string[];
  /** Further agreements or links, each with its own button. */
  buttons?: { label: string; url: string; caption?: string }[];
  /** Quiet text under the buttons, such as when a link stops working. */
  fine?: string[];
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const NAVY = "#0b1b4d", BODY = "#4b5563", MUTED = "#8a94a6", BLUE = "#1b66e0", TINT = "#eef3fa", PAGE = "#eef2fb";

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** Only web links become buttons or link text, so a stray value can never become a `javascript:` link. */
const safeUrl = (u: string) => (/^https?:\/\/[^\s"'<>]+$/.test(u) ? u : "#");

const para = (s: string, color = BODY, size = 16) => `<p style="margin:0 0 16px;font:${size}px/1.55 ${FONT};color:${color};">${escapeHtml(s).replace(/\n/g, "<br>")}</p>`;

function button(b: { label: string; url: string; caption?: string }): string {
  const url = safeUrl(b.url);
  // Every button is the same width, and its label is centered across and down. The link below it uses the full card width.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
${b.caption ? `<tr><td style="padding:0 0 10px;font:600 15px/1.4 ${FONT};color:${NAVY};">${escapeHtml(b.caption)}</td></tr>` : ""}
<tr><td align="left"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" bgcolor="${BLUE}" width="260" height="48" style="width:260px;height:48px;border-radius:8px;text-align:center;"><a href="${url}" style="display:block;width:260px;line-height:48px;font:600 16px/48px ${FONT};color:#ffffff;text-align:center;text-decoration:none;border-radius:8px;">${escapeHtml(b.label)}</a></td></tr></table></td></tr>
<tr><td style="padding:12px 0 0;font:12px/1.5 ${FONT};color:${MUTED};word-break:break-all;">Or paste this link into your browser:<br><a href="${url}" style="color:${BLUE};">${escapeHtml(b.url)}</a></td></tr>
</table>`;
}

export function brandedEmail(c: EmailContent): string {
  const logo = `${CANONICAL_ORIGIN}/logo-wordmark-light.png`;
  const panel = c.panel?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TINT}" style="margin:4px 0 24px;background:${TINT};border-radius:8px;"><tr><td style="padding:18px 22px;">
${c.panel.map(([k, v]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:5px 0;font:600 12px/1.4 ${FONT};letter-spacing:.06em;text-transform:uppercase;color:${MUTED};vertical-align:top;" width="38%">${escapeHtml(k)}</td><td style="padding:5px 0;font:600 16px/1.4 ${FONT};color:${NAVY};vertical-align:top;">${escapeHtml(v)}</td></tr></table>`).join("\n")}
</td></tr></table>` : "";
  const code = c.code ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TINT}" style="margin:4px 0 24px;background:${TINT};border-radius:8px;"><tr><td align="center" style="padding:24px 16px;font:700 34px/1 ${FONT};letter-spacing:.3em;color:${NAVY};">${escapeHtml(c.code)}</td></tr></table>` : "";
  const steps = c.steps?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">${c.steps.map((s, i) => `<tr><td style="padding:0 14px 12px 0;vertical-align:top;"><div style="width:24px;height:24px;border-radius:12px;background:${BLUE};color:#ffffff;font:600 13px/24px ${FONT};text-align:center;">${i + 1}</div></td><td style="padding:0 0 12px;font:16px/24px ${FONT};color:${BODY};">${escapeHtml(s)}</td></tr>`).join("")}</table>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(c.headline)}</title></head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAGE};">${escapeHtml(c.preheader ?? c.headline)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background:${PAGE};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;">
<tr><td align="center" bgcolor="#0f2a7a" style="padding:30px 24px;background:#0f2a7a;background-image:linear-gradient(135deg,#1b66e0 0%,#0f2a7a 55%,#080d20 100%);"><img src="${logo}" width="150" alt="AdFlo" style="display:block;border:0;height:auto;"></td></tr>
<tr><td style="padding:34px 32px 12px;">
<h1 style="margin:0 0 20px;font:600 28px/1.25 ${FONT};color:${NAVY};">${escapeHtml(c.headline)}</h1>
${(c.intro ?? []).map((p) => para(p)).join("\n")}
${panel}${code}${steps}${(c.buttons ?? []).map(button).join("\n")}
${(c.fine ?? []).map((p) => para(p, MUTED, 13)).join("\n")}
</td></tr>
<tr><td style="padding:8px 32px 30px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e5e9f2;padding-top:18px;font:13px/1.6 ${FONT};color:${MUTED};">Questions? Just reply to this email.<br><strong style="color:${NAVY};">AdFlo</strong> &middot; The administrative management platform for contractors and property managers.<br><a href="${CANONICAL_ORIGIN}" style="color:${MUTED};">www.adflo.pro</a></td></tr></table></td></tr>
</table>
</td></tr></table>
</body></html>
`;
}
