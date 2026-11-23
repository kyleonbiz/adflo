import { chromium } from "playwright";
import { seed } from "./seed.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript((s) => { window.__E2E_SEED__ = s; }, seed);
const p = await ctx.newPage();
const D = process.argv[2];
for (const r of ["", "projects", "forms", "reporting", "activity", "assistant", "contacts", "vendors", "help"]) {
  await p.goto("http://localhost:3200/app/" + r, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${D}/s-${r || "docs"}.png` });
}
await b.close();
