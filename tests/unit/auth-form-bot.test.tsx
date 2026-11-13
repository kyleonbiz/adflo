// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
const signIn = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { signUp, signInWithPassword: signIn } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
// Pretend the human check is on and solved: the widget hands back a token as soon as it mounts.
vi.mock("@/components/auth/turnstile", async () => {
  const React = await import("react");
  return {
    TURNSTILE_SITE_KEY: "site-key",
    Turnstile: ({ onToken }: { onToken: (t: string | null) => void }) => {
      React.useEffect(() => onToken("tok-123"), [onToken]);
      return null;
    },
  };
});

import { AuthForm } from "@/components/auth/auth-form";

beforeEach(() => { signUp.mockClear(); signIn.mockClear(); });

async function fillSignup(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Full name"), "Pat Lee");
  await user.type(screen.getByLabelText("Email"), "pat@example.com");
  await user.type(screen.getByLabelText("Password"), "correct-horse-1");
}

describe("bot protection on the auth form", () => {
  it("sends the human-check token with sign-up", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);
    await fillSignup(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect((signUp.mock.calls[0] as unknown[])[0]).toMatchObject({ options: { captchaToken: "tok-123" } });
  });
  it("sends the token with sign-in too", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText("Email"), "pat@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse-1");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect((signIn.mock.calls[0] as unknown[])[0]).toMatchObject({ options: { captchaToken: "tok-123" } });
  });
  it("silently drops a sign-up that fills the hidden trap field", async () => {
    const user = userEvent.setup();
    const { container } = render(<AuthForm mode="signup" />);
    await fillSignup(user);
    await user.type(container.querySelector('input[tabindex="-1"]') as HTMLInputElement, "http://spam.example");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/check your email/i);
    expect(signUp).not.toHaveBeenCalled();
  });
});
