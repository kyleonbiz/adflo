import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3101);
// Use a pre-installed Chromium when present (e.g. cloud sandboxes); otherwise Playwright's own.
const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? ["/opt/pw-browsers/chromium"].find((p) => existsSync(p));

// Which browsers to run. Locally only Chromium runs, so `npm run test:e2e` stays fast and needs one browser.
// The nightly workflow (.github/workflows/e2e.yml) runs each browser as its own job with E2E_BROWSERS set.
// Locally: E2E_BROWSERS=all, or a comma list such as "webkit,ios-safari" (first run `npx playwright install webkit firefox`).
// WebKit is the engine Safari uses, and "ios-safari" is WebKit on an iPhone-sized screen with touch.
const ALL = {
  chromium: { use: { ...devices["Desktop Chrome"], launchOptions: chromium ? { executablePath: chromium } : {} } },
  firefox: { use: { ...devices["Desktop Firefox"] } },
  // On the CI runners WebKit draws in software, where the frosted-glass blur and the entrance animations make frames so slow
  // that Playwright's "has the button stopped moving" check never settles and clicks time out. So WebKit runs with reduced
  // motion (the app already switches its animations off for that) and, in tests/e2e/fixtures.ts, without backdrop blur.
  webkit: { use: { ...devices["Desktop Safari"], reducedMotion: "reduce" } },
  // Mobile Safari runs only the tests written for a phone: their titles mention a phone, mobile, touch or tablet. The rest
  // of the suite assumes a desktop layout (sidebar, hover menus), which an iPhone-sized screen does not have.
  "ios-safari": { grep: /phone|mobile|touch|tablet/i, use: { ...devices["iPhone 13"], reducedMotion: "reduce" } },
} as const;
const wanted = (process.env.E2E_BROWSERS ?? "chromium").trim();
const names = (wanted === "all" ? Object.keys(ALL) : wanted.split(",").map((n) => n.trim())).filter((n): n is keyof typeof ALL => n in ALL);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1, // dev mode keeps one in-memory workspace shared by all tests
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: (names.length ? names : (["chromium"] as const)).map((name) => ({ name, ...ALL[name] })),
  webServer: {
    // No Supabase variables => development mode with in-memory sample data.
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/dms/bootstrap`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_PUBLIC_E2E_SEED: "1", NEXT_PUBLIC_LIVE_INDUSTRIES: "all", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  },
});
