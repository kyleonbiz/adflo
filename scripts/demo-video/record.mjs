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
// DEMO_VERTICAL=1 records at 1080x1920 for social media. Chromium is started at twice the page scale so the video is
// sharp while the app lays itself out as it does on a phone (540 CSS pixels wide). Output files get a "-v" suffix.
const VERTICAL = process.env.DEMO_VERTICAL === "1";
const VIEW = VERTICAL ? { width: 540, height: 960 } : { width: 1920, height: 1080 };
const VIDEO = VERTICAL ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const SFX = VERTICAL ? "-v" : "";
const wanted = process.argv.slice(2);
const mods = MODULES.filter((m) => wanted.length === 0 || wanted.includes(m.id));

/** Runs in the page: a visible cursor, and hides development-only notices so the footage looks like the product. */
function pageSetup() {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(37,99,235,.55);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)";
    document.body.appendChild(d);
    addEventListener("mousemove", (e) => { const off = document.documentElement.style.transform ? scrollY : 0; d.style.left = e.clientX + "px"; d.style.top = (e.clientY + off) + "px"; }, true);
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
const browser = await chromium.launch({ executablePath: exe, args: VERTICAL ? ["--force-device-scale-factor=2", "--hide-scrollbars"] : [] });
for (const mod of mods) {
  const tmp = join(OUT, `tmp-${mod.id}${SFX}`);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: tmp, size: VIDEO } });
  await ctx.addInitScript((s) => { window.__E2E_SEED__ = s; }, seed);
  await ctx.addInitScript(pageSetup);
  // Vertical: spare room below the page so any element can be scrolled up into the clear area above the captions.
  if (VERTICAL) await ctx.addInitScript(() => addEventListener("DOMContentLoaded", () => { const d = document.createElement("div"); d.style.cssText = "height:900px;pointer-events:none"; document.documentElement.appendChild(d); }));
  const page = await ctx.newPage();
  const t0 = Date.now();
  const caps = [];
  let lastAt = 0, lastHold = 0, trimStart = 0;
  const h = {
    page,
    wait: (ms) => page.waitForTimeout(ms),
    /** A caption: a short headline plus one or two sentences. It stays up long enough to read; the next one waits for it. */
    async cap(title, body = "", holdSeconds) {
      const since = (Date.now() - t0) / 1000 - lastAt;
      if (caps.length && since < lastHold) await page.waitForTimeout((lastHold - since) * 1000);
      lastAt = (Date.now() - t0) / 1000;
      const words = `${title} ${body}`.trim().split(/\s+/).length;
      lastHold = holdSeconds ?? 2.2 + words / 3.2;
      caps.push({ at: lastAt, title, body, hold: lastHold });
    },
    /** Waits out whatever is left of the current caption. */
    async finish(extra = 0.6) {
      const since = (Date.now() - t0) / 1000 - lastAt;
      if (caps.length && since < lastHold) await page.waitForTimeout((lastHold - since + extra) * 1000);
    },
    /** Highlights an element (scrolling it clear of the caption panel first) and dims the rest. */
    async spot(locator, pad = 12) {
      try {
        await locator.first().scrollIntoViewIfNeeded({ timeout: 4000 });
        let box = await locator.first().boundingBox({ timeout: 3000 });
        if (VERTICAL) {
          // Keep the target in the band above the caption panel (CSS pixels 150 to 560).
          if (box && (box.y > 220 || box.y + box.height > 580)) { await page.mouse.wheel(0, Math.max(0, box.y - 150)); await page.waitForTimeout(700); box = await locator.first().boundingBox({ timeout: 3000 }); }
        } else if (box && box.y + box.height > 760) { await page.mouse.wheel(0, box.y + box.height - 720); await page.waitForTimeout(700); box = await locator.first().boundingBox({ timeout: 3000 }); }
        if (!box) return;
        if (caps.length) caps[caps.length - 1].ty = box.y + box.height / 2;
        await page.evaluate(({ x, y, w, hh }) => {
          const r = document.getElementById("demo-spot");
          const off = document.documentElement.style.transform ? scrollY : 0; // fixed elements follow the zoomed page
          Object.assign(r.style, { left: x + "px", top: y + off + "px", width: w + "px", height: hh + "px", opacity: "1" });
        }, { x: box.x - pad, y: box.y - pad, w: box.width + pad * 2, hh: box.height + pad * 2 });
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
      } catch { /* the highlight is a nicety; carry on without it */ }
    },
    /** Caption, then (once the previous caption has had its time) move the highlight to the new target, if any. */
    async step(title, body, target, opts = {}) {
      await h.cap(title, body, opts.hold);
      await h.unspot();
      await h.unzoom(); // measure the next target on the un-zoomed page, then zoom again
      if (target) { await h.spot(target); const z = VERTICAL ? 0 : opts.zoom === undefined ? 1.15 : opts.zoom; if (z) await h.zoom(target, z); } // zoom in on what is being explained, unless a dialog is about to open
    },
    /** Magnifies the page around an element so it is easy to read on a phone. The highlight and cursor zoom with it. */
    async zoom(locator, scale = 1.3) {
      try {
        const box = await locator.first().boundingBox({ timeout: 3000 });
        if (!box) return;
        await page.evaluate(({ cx, cy, sc }) => {
          const el = document.documentElement;
          if (!el.style.transform) { // fixed elements now sit in the zoomed page, so shift them by the scroll position
            const r = document.getElementById("demo-spot"); if (r && r.style.top) r.style.top = parseFloat(r.style.top) + scrollY + "px";
          }
          el.style.transition = "transform .9s ease";
          el.style.transformOrigin = `${cx}px ${cy + scrollY}px`;
          el.style.transform = `scale(${sc})`;
        }, { cx: box.x + box.width / 2, cy: box.y + box.height / 2, sc: scale });
        await page.waitForTimeout(950);
      } catch { /* optional */ }
    },
    async unzoom() {
      const was = await page.evaluate(() => {
        const el = document.documentElement;
        if (!el.style.transform) return false;
        const r = document.getElementById("demo-spot"); if (r && r.style.top) r.style.top = parseFloat(r.style.top) - scrollY + "px";
        el.style.transform = "";
        return true;
      }).catch(() => false);
      if (was) await page.waitForTimeout(1000); // let the zoom-out finish before measuring
    },
    /** Marks the moment the real content starts. Everything recorded before it (set-up) is cut from the final video. */
    mark() { trimStart = (Date.now() - t0) / 1000; },
    async unspot() { await page.evaluate(() => { const r = document.getElementById("demo-spot"); if (r) r.style.opacity = "0"; }).catch(() => {}); await page.waitForTimeout(500); },
    async go(path, ms = 1500) {
      await h.finish(0);
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForFunction(() => !document.querySelector(".animate-pulse"), null, { timeout: 6000 }).catch(() => {}); // loading skeletons gone
      // Wait until the page stops changing, so no loading placeholders end up in the video.
      await page.evaluate(() => new Promise((done) => {
        let last = -1, still = 0;
        const t = setInterval(() => { const n = document.getElementsByTagName("*").length; still = n === last ? still + 1 : 0; last = n; if (still >= 4) { clearInterval(t); done(); } }, 150);
        setTimeout(() => { clearInterval(t); done(); }, 8000);
      })).catch(() => {});
      await page.waitForTimeout(ms);
      if (!trimStart) trimStart = (Date.now() - t0) / 1000; // the first page load is not part of the video
    },
    async scroll(px, ms = 1500) { await page.mouse.wheel(0, px); await page.waitForTimeout(ms); },
    async type(label, text) {
      const f = page.getByRole("dialog").getByLabel(label);
      await f.click();
      await f.pressSequentially(text, { delay: 55 });
    },
  };
  if (process.env.DEMO_DEBUG) for (const k of ["go", "step", "spot", "zoom", "unzoom", "unspot"]) { const f = h[k]; h[k] = async (...a) => { const t = Date.now(); const r = await f(...a); console.log(`  ${k} ${(Date.now() - t) / 1000}s`, typeof a[0] === "string" ? a[0].slice(0, 40) : ""); return r; }; }
  await mod.run(h);
  await h.finish();
  const duration = (Date.now() - t0) / 1000;
  await ctx.close();
  const file = readdirSync(tmp).find((f) => f.endsWith(".webm"));
  renameSync(join(tmp, file), join(OUT, `${mod.id}${SFX}.webm`));
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(OUT, `${mod.id}${SFX}.json`), JSON.stringify({ id: mod.id, title: mod.title, pain: mod.pain, duration, trimStart, vertical: VERTICAL, caps }, null, 2));
  console.log("recorded", mod.id + SFX, duration.toFixed(1) + "s");
}
await browser.close();
