// Records one screen walkthrough per AdFlo module with a fictional contractor ("Summit Comfort HVAC LLC").
// Needs the app running in development mode with NEXT_PUBLIC_E2E_SEED=1 (see README.md).
//   node scripts/demo-video/record.mjs              -> every module
//   node scripts/demo-video/record.mjs licenses     -> only the named modules
// Writes out/<id>.webm and out/<id>.json (caption times measured during the recording).
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seed } from "./seed.mjs";
import { MODULES } from "./scenes.mjs";

const BASE = process.env.DEMO_URL ?? "http://localhost:3200";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const wanted = process.argv.slice(2);
const mods = MODULES.filter((m) => wanted.length === 0 || wanted.includes(m.id));

/** Runs in the page: a visible cursor, and hides development-only notices so the footage looks like the product. */
function pageSetup() {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(37,99,235,.55);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)";
    document.body.appendChild(d);
    addEventListener("mousemove", (e) => { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; }, true);
    const NOTICE = /^(Records are saved in this browser|Dates come from the records in this browser|Finish guided setup|Preview only|The log is kept in this browser|Reports read the records)/;
    const hide = () => {
      document.querySelectorAll("nextjs-portal").forEach((el) => { el.style.display = "none"; });
      document.querySelectorAll("div,span,p").forEach((el) => {
        const t = (el.textContent ?? "").trim();
        if (t.length > 200 || !(NOTICE.test(t) || t === "Preview")) return;
        let n = el;
        // Climb to the banner box, but never to a container that holds much more than the notice itself.
        while (n.parentElement && !n.parentElement.querySelector("h1,button,a,input") && (n.parentElement.textContent ?? "").trim().length < t.length + 40) n = n.parentElement;
        if (n.textContent.trim().length < 400) n.style.display = "none";
      });
    };
    hide();
    new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
  });
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
for (const mod of mods) {
  const tmp = join(OUT, `tmp-${mod.id}`);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } } });
  await ctx.addInitScript((s) => { window.__E2E_SEED__ = s; }, seed);
  await ctx.addInitScript(pageSetup);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const caps = [];
  const h = {
    page,
    wait: (ms) => page.waitForTimeout(ms),
    cap: (text) => caps.push({ at: (Date.now() - t0) / 1000, text }),
    async go(path, ms = 1500) { await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(ms); },
    async glide(locator, ms = 700) {
      const box = await locator.boundingBox().catch(() => null);
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
      await page.waitForTimeout(ms);
    },
    async scroll(px, ms = 1500) { await page.mouse.wheel(0, px); await page.waitForTimeout(ms); },
    async type(label, text) {
      const f = page.getByRole("dialog").getByLabel(label);
      await f.click();
      await f.pressSequentially(text, { delay: 55 });
    },
  };
  await mod.run(h);
  const duration = (Date.now() - t0) / 1000;
  await ctx.close();
  const file = readdirSync(tmp).find((f) => f.endsWith(".webm"));
  renameSync(join(tmp, file), join(OUT, `${mod.id}.webm`));
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(OUT, `${mod.id}.json`), JSON.stringify({ id: mod.id, title: mod.title, pain: mod.pain, duration, caps }, null, 2));
  console.log("recorded", mod.id, duration.toFixed(1) + "s");
}
await browser.close();
