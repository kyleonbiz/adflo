// @vitest-environment jsdom
// An account with an authenticator app cannot change its password from the reset link alone: the database answers
// "insufficient_aal". The reset page must ask for the 6-digit code, check it, and only then change the password.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Aal = { currentLevel: string; nextLevel: string };
const state = {
  aal: { currentLevel: "aal1", nextLevel: "aal1" } as Aal,
  factors: [{ id: "f1", status: "verified" }] as { id: string; status: string }[],
  codeOk: true,
  updateError: null as null | { code?: string; message: string },
  calls: [] as string[],
};
let authListener: ((event: string) => void) | null = null;

vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://example.supabase.co", anonKey: "anon" }) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => { authListener = cb; return { data: { subscription: { unsubscribe() { /* none */ } } } }; },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: state.aal, error: null }),
        listFactors: async () => ({ data: { totp: state.factors }, error: null }),
        challengeAndVerify: async ({ code }: { factorId: string; code: string }) => {
          state.calls.push(`verify:${code}`);
          if (!state.codeOk) return { data: null, error: { message: "Invalid TOTP code" } };
          state.aal = { currentLevel: "aal2", nextLevel: "aal2" };
          return { data: {}, error: null };
        },
      },
      updateUser: async (attrs: { password: string }) => {
        state.calls.push(`update:${attrs.password}`);
        // The real service refuses until the session has the second factor.
        if (state.aal.nextLevel === "aal2" && state.aal.currentLevel !== "aal2") return { data: null, error: { code: "insufficient_aal", message: "AAL2 session is required to update email or password when MFA is enabled." } };
        return state.updateError ? { data: null, error: state.updateError } : { data: {}, error: null };
      },
      signOut: async () => { state.calls.push("signOut"); return { error: null }; },
    },
  }),
}));

import { ResetPasswordForm } from "@/components/control/reset-password-form";

async function openFromLink() {
  render(<ResetPasswordForm />);
  await act(async () => { authListener!("PASSWORD_RECOVERY"); await new Promise((r) => setTimeout(r, 0)); });
}

beforeEach(() => {
  state.aal = { currentLevel: "aal1", nextLevel: "aal1" };
  state.factors = [{ id: "f1", status: "verified" }];
  state.codeOk = true;
  state.updateError = null;
  state.calls = [];
  authListener = null;
});

describe("choosing a new password from the reset link", () => {
  it("an account without two-factor just sets the password", async () => {
    await openFromLink();
    expect(screen.queryByLabelText(/6-digit code/)).toBeNull();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText(/Your password is changed/)).toBeTruthy();
    expect(state.calls).toEqual(["update:a-new-password", "signOut"]);
  });

  it("an account with an authenticator is asked for the code up front", async () => {
    state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    await openFromLink();
    expect(await screen.findByLabelText(/6-digit code/)).toBeTruthy();
    expect(screen.getByText(/Lost your authenticator/)).toBeTruthy();
  });

  it("checks the code first, then changes the password, so it succeeds", async () => {
    state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    await openFromLink();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.type(await screen.findByLabelText(/6-digit code/), "123456");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText(/Your password is changed/)).toBeTruthy();
    expect(state.calls).toEqual(["verify:123456", "update:a-new-password", "signOut"]);
  });

  it("a wrong code changes nothing and says so", async () => {
    state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    state.codeOk = false;
    await openFromLink();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.type(await screen.findByLabelText(/6-digit code/), "000000");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("That code did not work");
    expect(state.calls).toEqual(["verify:000000"]); // the password was never touched
  });

  it("asks for a full 6-digit code before trying anything", async () => {
    state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    await openFromLink();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.type(await screen.findByLabelText(/6-digit code/), "12");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Enter the 6-digit code");
    expect(state.calls).toEqual([]);
  });

  it("if the service still says a code is needed, it shows the code field instead of a vague error", async () => {
    // The check at the start could not tell (for example it was slow): the service's answer decides.
    await openFromLink();
    state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Enter the 6-digit code from your authenticator app, then try again.");
    expect(await screen.findByLabelText(/6-digit code/)).toBeTruthy();
  });

  it("an account whose authenticator is gone is told to ask for help, not left guessing", async () => {
    state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    state.factors = [];
    await openFromLink();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.type(await screen.findByLabelText(/6-digit code/), "123456");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("no working authenticator");
  });

  it("a password that is too short is refused before anything is sent", async () => {
    await openFromLink();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "short");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("at least 8 characters");
    expect(state.calls).toEqual([]);
  });

  it("an unrelated failure still gets the general message", async () => {
    state.updateError = { message: "Something else went wrong" };
    await openFromLink();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not change the password");
  });
});
