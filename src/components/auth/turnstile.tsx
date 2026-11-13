"use client";

import { useEffect, useRef } from "react";

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id?: string): void;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

/** Public site key. Unset = no challenge is shown and no token is sent (the Supabase CAPTCHA setting must then be off too). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

function load(): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="https://challenges.cloudflare.com/turnstile"]`);
    const s = existing ?? Object.assign(document.createElement("script"), { src: SRC, async: true });
    s.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile"))));
    s.addEventListener("error", () => reject(new Error("turnstile")));
    if (!existing) document.head.appendChild(s);
  });
}

/**
 * Cloudflare Turnstile challenge (Supabase Auth's CAPTCHA protection checks the token server-side).
 * `onToken(null)` is called when the token expires or the challenge fails; `resetKey` changes to ask for a fresh one
 * (a token works once, so reset after every attempt).
 */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let cancelled = false;
    load().then((api) => {
      if (cancelled || !box.current) return;
      widget.current = api.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(null),
        "error-callback": () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      cb.current(null);
      window.turnstile?.reset(widget.current);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="flex justify-center" aria-label="Human check" />;
}
