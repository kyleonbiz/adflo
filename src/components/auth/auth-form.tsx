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

const signUpSchema = signInSchema.extend({ fullName: z.string().trim().min(2, "Enter your name").max(80) });
type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

/** `demo` (no database connected): nothing is checked or sent anywhere; submitting just opens the in-browser demo workspace. */
export function AuthForm({ mode, next, demo = false }: { mode: "login" | "signup"; next?: string; demo?: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";
  const form = useForm<SignUpValues>({
    // Demo mode checks nothing, so Log in can be pressed with the fields empty.
    resolver: demo ? undefined : zodResolver(isSignup ? signUpSchema : (signInSchema as unknown as typeof signUpSchema)),
    defaultValues: { email: "", password: "", fullName: "" },
  });
  const { register, handleSubmit, formState } = form;

  const submit = handleSubmit(async (values: SignInValues & Partial<SignUpValues>) => {
    setFormError("");
    setInfo("");
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
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) return setFormError(error.message);
      if (!data.session) return setInfo("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
      if (error) return setFormError("Incorrect email or password.");
    }
    router.replace(safeNext(next));
    router.refresh();
  });

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
          <Input id="email" type="email" placeholder="Email" autoComplete="email" className="auth-input" aria-invalid={!!formState.errors.email} {...register("email")} />
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
            Still stuck? <Link href="/signup" className="font-medium text-primary hover:underline">Create an account</Link> or ask your workspace owner to invite you.
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
