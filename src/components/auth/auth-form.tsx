"use client";

import { useState } from "react";
import { ChevronRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNext } from "@/lib/safe-redirect";
import { signInSchema } from "@/lib/dms/validation";
import { publicOrigin } from "@/lib/public-origin";

const signUpSchema = signInSchema.extend({ fullName: z.string().trim().min(2, "Enter your name").max(80) });
type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

/** `demo` (no database connected): nothing is checked or sent anywhere; submitting just opens the in-browser demo workspace. */
export function AuthForm({ mode, next, demo = false, invitedEmail }: { mode: "login" | "signup"; next?: string; demo?: boolean; /** The confirmed invitation's email: filled in and read-only. */ invitedEmail?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  /** Set when the account exists but its email is not confirmed yet, so a fresh confirmation email can be requested. */
  const [unconfirmed, setUnconfirmed] = useState("");
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";
  const form = useForm<SignUpValues>({
    // Demo mode checks nothing, so Log in can be pressed with the fields empty.
    resolver: demo ? undefined : zodResolver(isSignup ? signUpSchema : (signInSchema as unknown as typeof signUpSchema)),
    defaultValues: { email: invitedEmail ?? "", password: "", fullName: "" },
  });
  const { register, handleSubmit, formState } = form;

  const submit = handleSubmit(async (values: SignInValues & Partial<SignUpValues>) => {
    setFormError("");
    setInfo("");
    setUnconfirmed("");
    if (demo) {
      router.replace(safeNext(next));
      return;
    }
    const { createBrowserSupabase } = await import("@/lib/supabase/browser"); // loaded on submit, so the page itself stays light
    const supabase = createBrowserSupabase();
    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.fullName },
          emailRedirectTo: `${publicOrigin()}/auth/callback${invitedEmail ? "" : "?next=/start"}`,
        },
      });
      if (error) {
        // The database refuses an email AdFlo has not invited, and Supabase reports that as a generic "database error".
        const refused = error.code === "unexpected_failure" || /database error/i.test(error.message);
        return setFormError(refused ? "We could not create an account for that email. If you were invited, open the link in your invitation email and sign up with the email it was sent to. Need help? Contact support@adflo.pro." : error.message);
      }
      // Supabase answers a sign-up for an address that already has an account as if it worked, and sends nothing. Its
      // tell is a user with no identities. Say so, instead of promising an email that will never come.
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        return setFormError("There is already an account for this email, so no confirmation email was sent. Log in instead, or use Forgot password on the log-in screen if you do not remember it.");
      }
      if (!data.session) {
        setUnconfirmed(values.email);
        return setInfo("Check your email to confirm your account, then sign in. It can take a few minutes, and it may land in spam.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
      if (error) {
        if (error.code === "email_not_confirmed") {
          setUnconfirmed(values.email);
          return setFormError("Confirm your email first. We sent you a link when you signed up.");
        }
        return setFormError("Incorrect email or password.");
      }
    }
    router.replace(safeNext(next));
    router.refresh();
  });

  const resend = async () => {
    setResending(true);
    setFormError("");
    const { createBrowserSupabase } = await import("@/lib/supabase/browser");
    const { error } = await createBrowserSupabase().auth.resend({ type: "signup", email: unconfirmed, options: { emailRedirectTo: `${publicOrigin()}/auth/callback` } });
    setResending(false);
    if (error) return setFormError("We could not send another email just now. Wait a minute and try again.");
    setInfo(`We sent another confirmation email to ${unconfirmed}. Check your spam folder too.`);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {demo && (
        <p role="note" className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Demo mode: no real account is needed. Just press {isSignup ? "Create account" : "Log in"} to look around. Your work stays in this browser.
        </p>
      )}
      {isSignup && (
        <Field id="fullName" label="Full name" error={formState.errors.fullName?.message}>
          <IconInput icon={User}>
            <Input id="fullName" placeholder="Full name" autoComplete="name" className="auth-input" aria-invalid={!!formState.errors.fullName} {...register("fullName")} />
          </IconInput>
        </Field>
      )}
      <Field id="email" label="Email" error={formState.errors.email?.message}>
        <IconInput icon={Mail}>
          <Input id="email" type="email" placeholder="Email" autoComplete="email" readOnly={!!invitedEmail} className="auth-input" aria-invalid={!!formState.errors.email} {...register("email")} />
        </IconInput>
      </Field>
      <Field id="password" label="Password" error={formState.errors.password?.message}>
        <IconInput icon={Lock}>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="auth-input pr-11"
            aria-invalid={!!formState.errors.password}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide characters" : "Show characters"}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-700"
          >
            {showPassword ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
          </button>
        </IconInput>
        {!isSignup && (
          <Link href="/forgot-password" className="inline-block pt-1 text-sm font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
        )}
      </Field>
      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      {info && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {info}
        </p>
      )}
      {unconfirmed && (
        <Button type="button" variant="outline" className="w-full" onClick={resend} disabled={resending}>
          {resending ? "Sending…" : "Resend confirmation email"}
        </Button>
      )}
      <Button type="submit" size="lg" className="auth-submit w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
        {!formState.isSubmitting && <ChevronRight className="size-4" aria-hidden="true" />}
      </Button>
      {!isSignup && <TroubleHelp />}
      <p className="text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account? " : "New to AdFlo? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-primary hover:underline">
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

/** "Having trouble logging in?" opens a short checklist, like the help prompt on other sign-in screens. */
function TroubleHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-center text-sm">
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="login-help" className="text-muted-foreground transition-colors hover:text-foreground">
          Having trouble logging in?
        </button>
        <span className="h-px flex-1 bg-slate-300" aria-hidden="true" />
      </div>
      {open && (
        <ul id="login-help" className="mt-3 list-disc space-y-1.5 rounded-lg bg-muted px-4 py-3 pl-8 text-left text-muted-foreground">
          <li>Check that the email is the one your account was created with.</li>
          <li>
            Passwords are case sensitive. <Link href="/forgot-password" className="font-medium text-primary hover:underline">Reset your password</Link> if you are unsure.
          </li>
          <li>If you just signed up, confirm your email first using the link we sent you.</li>
          <li>
            Still stuck? Ask your company&apos;s AdFlo administrator to invite you, or email support@adflo.pro.
          </li>
        </ul>
      )}
    </div>
  );
}

/** Input with a leading icon; children are the input (and any trailing control). */
function IconInput({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
      {children}
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="sr-only">{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
