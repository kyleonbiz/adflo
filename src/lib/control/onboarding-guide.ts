import type { ChecklistStep } from "./types";

/**
 * The how-to for each onboarding step, in plain words. Staff work down the list: the next step is open, and each one is
 * ticked off when it is done. Some steps tick themselves (see `auto`); every step can also be ticked or unticked by hand.
 * `jump` goes to a section lower on the same page; `edit` opens the client's details; `link` goes to another screen.
 */
export interface GuideAction { label: string; kind: "edit" | "jump" | "link"; /** `#section` for jump; a path builder for link. */ to?: (clientId: string) => string }
export interface GuideStep { key: ChecklistStep; why: string; how: string[]; auto?: string; actions: GuideAction[] }

/** The page sections a `jump` can go to. */
export const GUIDE_SECTIONS = ["details", "onboarding", "account", "billing", "agreements", "support", "history"] as const;

export const GUIDE: Record<ChecklistStep, GuideStep> = {
  details: {
    key: "details",
    why: "Everything else starts from these details, and the invitation goes to the email you enter here.",
    how: [
      "Click Edit at the top of this page.",
      "Enter the owner's name and their email address. Check the spelling: the invitation only works for that exact email.",
      "Choose their plan and how many seats they get.",
      "If they have a special rate, enter their own price and a short note about why.",
      "Click Save.",
    ],
    actions: [{ label: "Edit details", kind: "edit" }],
  },
  workspace: {
    key: "workspace",
    why: "A workspace is where the client keeps their documents, folders and records.",
    how: [
      "If you left Create their workspace ticked when you added the client, this is already done.",
      "Otherwise find the AdFlo account card below.",
      "Click Create workspace and invite owner. This makes an empty workspace named after the client, with the standard folders. Nobody from your team is added to it.",
      "If the client already made their own workspace, use Connect instead and pick it from the list.",
    ],
    auto: "Ticks itself when you create or connect a workspace.",
    actions: [{ label: "Go to AdFlo account", kind: "jump", to: () => "#account" }],
  },
  owner_invited: {
    key: "owner_invited",
    why: "The invitation is what lets the owner sign up and puts them into their workspace as its owner. They have to confirm it first.",
    how: [
      "Creating the workspace already invites the owner and emails them the invitation. Nothing more to do if you used Create workspace and invite owner.",
      "If you connected an existing workspace, or the invitation ran out (they last 14 days), click Renew invitation in the AdFlo account card. It renews the invitation for another 14 days and emails the owner a new link.",
    ],
    auto: "Ticks itself when the invitation is made.",
    actions: [{ label: "Go to AdFlo account", kind: "jump", to: () => "#account" }],
  },
  welcome_sent: {
    key: "welcome_sent",
    why: "The owner needs to hear that their account is ready, and how to sign up with the right email.",
    how: [
      "Creating the workspace or renewing the invitation already emails the owner from onboarding@adflo.pro. If that did not go out, or you want to send it again, click Email welcome message in the AdFlo account card.",
      "If a message says the email was not sent, click Copy welcome message and send it from your own email.",
      "It carries a link. They open it and confirm the invitation, which is what lets them create their account. They must sign up with the exact email on this page, then confirm that email too. Then they land in their workspace as its owner.",
    ],
    auto: "Ticks itself when the welcome email goes out from here. Tick it by hand if you sent the copied message yourself.",
    actions: [{ label: "Go to AdFlo account", kind: "jump", to: () => "#account" }],
  },
  agreement_sent: {
    key: "agreement_sent",
    why: "Their acceptance of your terms is recorded, with who accepted and when.",
    how: [
      "Find Terms and agreements below.",
      "Choose the agreement and click to create a link for this client.",
      "Copy the link and send it in your own email. It works once and expires after 30 days.",
      "When they accept, it shows here with their name and the date.",
    ],
    auto: "Ticks itself when you create the link.",
    actions: [{ label: "Go to Terms and agreements", kind: "jump", to: () => "#agreements" }],
  },
  plan_set: {
    key: "plan_set",
    why: "Seats and price decide what they can add and what you bill.",
    how: [
      "Look at the tiles at the top: price per month and seats.",
      "If something is wrong, click Edit and fix the plan, seats or price.",
      "Tick this step when the plan and seats are what you agreed with the client.",
    ],
    actions: [{ label: "Edit details", kind: "edit" }, { label: "See plans and prices", kind: "link", to: () => "/control/plans" }],
  },
  first_login: {
    key: "first_login",
    why: "It proves the invitation worked and they can get in.",
    how: [
      "Wait for the owner to sign up with the invited email. Their Last sign-in appears in the details above once they do.",
      "If nothing happens after a few days, click Email welcome message to send it again, and Renew invitation if the invitation has run out.",
      "If they say they cannot get in, check Support for a ticket and use the password reset on this page.",
      "Tick this step once they have signed in.",
    ],
    actions: [{ label: "Go to AdFlo account", kind: "jump", to: () => "#account" }, { label: "Go to Support", kind: "jump", to: () => "#support" }],
  },
  live: {
    key: "live",
    why: "A client on trial is not billed. Making them active and sending the first invoice starts the paid relationship.",
    how: [
      "When the trial is over, click End trial: make active at the top of this page.",
      "Click New invoice in the Billing section. It fills in their monthly price.",
      "Review it, save it, send it yourself, then mark it sent.",
      "Tick this step when both are done.",
    ],
    actions: [{ label: "Go to Billing", kind: "jump", to: () => "#billing" }, { label: "New invoice", kind: "link", to: (id) => `/control/billing?client=${id}` }],
  },
};
