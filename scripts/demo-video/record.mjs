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
        while (n.parentElement && n.parentElement.tagName !== "MAIN" && !n.parentElement.querySelector("h1,input") && (n.parentElement.textContent ?? "").trim().length < t.length + 40) n = n.parentElement;
        if (n.textContent.trim().length < 400) n.style.display = "none";
      });
    };
    hide();
    new MutationObserver(hide).observe(document.body, { childList: true, subtree: true });
    // Spotlight: a ring around the area being explained, with the rest of the screen dimmed.
    const ring = document.createElement("div");
    ring.id = "demo-spot";
    ring.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;border-radius:16px;border:4px solid #3b82f6;box-shadow:0 0 0 9999px rgba(11,26,60,.38),0 0 28px 6px rgba(59,130,246,.55);opacity:0;transition:opacity .45s ease,left .45s ease,top .45s ease,width .45s ease,height .45s ease;left:0;top:0;width:0;height:0";
    document.body.appendChild(ring);
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
  let lastAt = 0, lastHold = 0;
  const h = {
    page,
    wait: (ms) => page.waitForTimeout(ms),
    /** A caption: a short headline plus one or two sentences. It stays up long enough to read; the next one waits for it. */
    async cap(title, body = "") {
      const since = (Date.now() - t0) / 1000 - lastAt;
      if (caps.length && since < lastHold) await page.waitForTimeout((lastHold - since) * 1000);
      lastAt = (Date.now() - t0) / 1000;
      const words = `${title} ${body}`.trim().split(/\s+/).length;
      lastHold = 2.2 + words / 3.2;
      caps.push({ at: lastAt, title, body });
    },
    /** Waits out whatever is left of the current caption. */
    async finish() {
      const since = (Date.now() - t0) / 1000 - lastAt;
      if (since < lastHold) await page.waitForTimeout((lastHold - since) * 1000 + 600);
    },
    /** Highlights an element (scrolling it clear of the caption panel first) and dims the rest. */
    async spot(locator, pad = 12) {
      try {
        await locator.first().scrollIntoViewIfNeeded({ timeout: 4000 });
        let box = await locator.first().boundingBox();
        if (box && box.y + box.height > 760) { await page.mouse.wheel(0, box.y + box.height - 720); await page.waitForTimeout(700); box = await locator.first().boundingBox(); }
        if (!box) return;
        if (caps.length) caps[caps.length - 1].ty = box.y + box.height / 2;
        await page.evaluate(({ x, y, w, hh }) => {
          const r = document.getElementById("demo-spot");
          Object.assign(r.style, { left: x + "px", top: y + "px", width: w + "px", height: hh + "px", opacity: "1" });
        }, { x: box.x - pad, y: box.y - pad, w: box.width + pad * 2, hh: box.height + pad * 2 });
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
      } catch { /* the highlight is a nicety; carry on without it */ }
    },
    /** Caption, then (once the previous caption has had its time) move the highlight to the new target, if any. */
    async step(title, body, target) { await h.cap(title, body); await h.unspot(); if (target) await h.spot(target); },
    async unspot() { await page.evaluate(() => { const r = document.getElementById("demo-spot"); if (r) r.style.opacity = "0"; }).catch(() => {}); await page.waitForTimeout(500); },
    async go(path, ms = 1500) { await page.goto(BASE + path, { waitUntil: "networkidle" }); await page.waitForTimeout(ms); },
    async scroll(px, ms = 1500) { await page.mouse.wheel(0, px); await page.waitForTimeout(ms); },
    async type(label, text) {
      const f = page.getByRole("dialog").getByLabel(label);
      await f.click();
      await f.pressSequentially(text, { delay: 55 });
    },
  };
  await mod.run(h);
  await h.finish();
  const duration = (Date.now() - t0) / 1000;
  await ctx.close();
  const file = readdirSync(tmp).find((f) => f.endsWith(".webm"));
  renameSync(join(tmp, file), join(OUT, `${mod.id}.webm`));
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(OUT, `${mod.id}.json`), JSON.stringify({ id: mod.id, title: mod.title, pain: mod.pain, duration, caps }, null, 2));
  console.log("recorded", mod.id, duration.toFixed(1) + "s");
}
await browser.close();
