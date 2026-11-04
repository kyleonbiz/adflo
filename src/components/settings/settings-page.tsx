import { Appearance } from "./appearance";
import { SettingsNav, SettingsTabGate } from "./settings-access";
import { InvoiceChecksSection } from "./invoice-checks-section";
import { NotificationsSection } from "./notifications-section";
import { ProfileSection } from "./profile-section";
import { TeamSection } from "./team-section";
import { SetupPage } from "@/components/setup/setup-page";

export const SETTINGS_TABS = [
  { id: "profile", label: "Business profile", blurb: "Your business details, used across AdFlo." },
  { id: "team", label: "Team", blurb: "Who can open this workspace, and what they can do." },
  { id: "notifications", label: "Notifications", blurb: "Which reminders you want, and how early." },
  { id: "invoice-checks", label: "Invoice options", blurb: "Optional invoice checks and shortcuts. Everything here is off until you switch it on." },
  { id: "appearance", label: "Appearance", blurb: "Choose a bright Day view or a darker Night view." },
  { id: "setup", label: "Guided setup", blurb: "Five short steps to get your services, templates and checks in place." },
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export const parseTab = (v: unknown): SettingsTab => SETTINGS_TABS.find((t) => t.id === v)?.id ?? "profile";

export function SettingsPage({ tab, mode, base, preview }: { tab: SettingsTab; mode: "live" | "preview"; base: "/app"; preview?: string }) {
  const current = SETTINGS_TABS.find((t) => t.id === tab)!;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsNav tabs={SETTINGS_TABS} current={tab} base={base} />
      <div>
        <h2 className="text-lg font-semibold">{current.label}</h2>
        <p className="text-sm text-muted-foreground">{current.blurb}</p>
      </div>
      <SettingsTabGate tab={tab}>
        {tab === "profile" && <ProfileSection />}
        {tab === "team" && <TeamSection mode={mode} />}
        {tab === "notifications" && <NotificationsSection />}
        {tab === "invoice-checks" && <InvoiceChecksSection />}
        {tab === "appearance" && <Appearance />}
        {tab === "setup" && <SetupPage base={base} preview={preview} />}
      </SettingsTabGate>
    </div>
  );
}
