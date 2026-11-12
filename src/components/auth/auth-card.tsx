import { Brand } from "@/components/brand";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="auth-scope relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10 text-white">
      <AuthBackdrop />
      <div className="auth-enter flex flex-col items-center">
        <Brand wordmark light className="w-52 sm:w-60" />
        <p className="mb-8 mt-3 text-center text-[0.65rem] font-medium uppercase tracking-[0.35em] text-white/60 sm:text-xs sm:tracking-[0.4em]">
          Work smarter. Get more done.
        </p>
      </div>
      <main className="auth-panel auth-enter-card w-full max-w-lg p-6 sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {children}
      </main>
    </div>
  );
}
