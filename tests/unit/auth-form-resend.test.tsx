// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
};
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

import { AuthForm } from "@/components/auth/auth-form";

beforeEach(() => {
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
  auth.resend.mockReset();
  auth.resend.mockResolvedValue({ error: null });
});

async function fill(email: string, name?: string) {
  if (name) await userEvent.type(screen.getByPlaceholderText("Full name"), name);
  await userEvent.type(screen.getByPlaceholderText("Email"), email);
  await userEvent.type(screen.getByPlaceholderText("Password"), "correct-horse-battery");
}

describe("signing up with an email that already has an account", () => {
  it("says so instead of promising a confirmation email that is never sent", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { identities: [] } }, error: null });
    render(<AuthForm mode="signup" />);
    await fill("pat@pizza.test", "Pat Lee");
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
    expect(await screen.findByText(/already an account for this email/)).toBeInTheDocument();
    expect(screen.queryByText(/Check your email to confirm/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Resend confirmation email" })).toBeNull();
  });
  it("a brand-new account still gets the confirmation notice", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: { identities: [{ id: "i1" }] } }, error: null });
    render(<AuthForm mode="signup" />);
    await fill("new@pizza.test", "New Person");
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
    expect(await screen.findByText(/Check your email to confirm/)).toBeInTheDocument();
  });
});

describe("resend confirmation email", () => {
  it("is offered after signing up when the email still has to be confirmed, and sends a new one to that address", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<AuthForm mode="signup" />);
    await fill("pat@pizza.test", "Pat Lee");
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));

    expect(await screen.findByText(/Check your email to confirm/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));

    expect(auth.resend).toHaveBeenCalledTimes(1);
    expect(auth.resend.mock.calls[0][0]).toMatchObject({ type: "signup", email: "pat@pizza.test" });
    expect(await screen.findByText(/sent another confirmation email to pat@pizza.test/)).toBeInTheDocument();
  });

  it("is offered on sign-in when the account exists but is not confirmed", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "email_not_confirmed", message: "Email not confirmed" } });
    render(<AuthForm mode="login" />);
    await fill("pat@pizza.test");
    await userEvent.click(screen.getByRole("button", { name: /Log in/ }));

    expect(await screen.findByText(/Confirm your email first/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect(auth.resend.mock.calls[0][0]).toMatchObject({ type: "signup", email: "pat@pizza.test" });
  });

  it("is not offered for a wrong password", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    render(<AuthForm mode="login" />);
    await fill("pat@pizza.test");
    await userEvent.click(screen.getByRole("button", { name: /Log in/ }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend confirmation email" })).toBeNull();
  });

  it("says to wait a minute when the new email cannot be sent yet, without showing the raw error", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    auth.resend.mockResolvedValue({ error: { message: "For security purposes, you can only request this after 49 seconds." } });
    render(<AuthForm mode="signup" />);
    await fill("pat@pizza.test", "Pat Lee");
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Resend confirmation email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wait a minute and try again");
    expect(screen.queryByText(/49 seconds/)).toBeNull();
  });
});

describe("a refused sign-up", () => {
  it("explains a refused sign-up instead of showing a database error", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { code: "unexpected_failure", message: "Database error saving new user" } });
    render(<AuthForm mode="signup" />);
    await fill("stranger@nowhere.test", "Sam Stranger");
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
    expect(await screen.findByText(/could not create an account for that email/)).toBeInTheDocument();
    expect(screen.queryByText(/Database error/)).toBeNull();
  });
});
