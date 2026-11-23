// Turns the recordings in out/ into finished videos:
//   out/final/<id>.mp4          one clip per module: intro card listing what you will learn, captions, closing card
//   out/final/adflo-tour.mp4    every module in one video
//   out/final/adflo-<id>.mp4    the campaign videos (explainer, ad)
// With DEMO_VERTICAL=1 it builds the 1080x1920 versions (out/final/<id>-v.mp4) from the recordings made with
// DEMO_VERTICAL=1, with captions kept clear of the areas social apps cover. There is no vertical tour.
// Needs ffmpeg and the Inter font. Run record.mjs first.   node scripts/demo-video/build.mjs [ids...]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { MODULES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const FINAL = join(OUT, "final");
const WORK = join(OUT, "work");
const CACHE = join(OUT, "cache"); // encoded footage, reused until its recording changes (delete out/cache after changing caption styling)
const LOGO = join(HERE, "../../public/logo-wordmark-light.png");
GlobalFonts.registerFromPath("/usr/share/fonts/opentype/inter/Inter-Bold.otf", "InterB");
GlobalFonts.registerFromPath("/usr/share/fonts/opentype/inter/Inter-Medium.otf", "InterM");
const NAVY = "#0b1a3c";
const FPS = 30;
const CTA = process.env.DEMO_CTA ?? "Start at AdFlo.com";
const V = process.env.DEMO_VERTICAL === "1";
const SFX = V ? "-v" : "";
const W = V ? 1080 : 1920, H = V ? 1920 : 1080;
const CX = W / 2;
// Social apps cover the top and bottom of a vertical video, so captions sit above the bottom band.
const VERTICAL_CAPTION_BOTTOM_MARGIN = 400;
const wanted = process.argv.slice(2);

rmSync(WORK, { recursive: true, force: true });
mkdirSync(FINAL, { recursive: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const ff = (args) => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
};
const dur = (f) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);

/** Breaks text into lines no wider than maxWidth. */
function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/** The caption panel for one step, as a PNG: step label, headline and an explanation. */
function captionPng(file, n, total, title, body, size = "medium") {
  const large = size === "large";
  const PW = V ? 960 : 1560, PAD = V ? 34 : 36, BODY_W = PW - PAD * 2;
  // large: campaign videos; medium: module videos
  const [HS, BS, LH] = V ? (large ? [60, 40, 52] : [52, 35, 47]) : (large ? [66, 40, 54] : [54, 34, 46]);
  const probe = createCanvas(10, 10).getContext("2d");
  probe.font = `${BS}px InterM`;
  const lines = body ? wrap(probe, body, BODY_W) : [];
  probe.font = `${HS}px InterB`;
  const titleLines = wrap(probe, title, BODY_W);
  const LABEL = large ? 0 : 40;
  const HEAD_LH = HS + 14;
  const H2 = PAD + LABEL + titleLines.length * HEAD_LH + (lines.length ? 8 + lines.length * LH : 0) + PAD - 6;
  const c = createCanvas(PW, H2), ctx = c.getContext("2d");
  roundRect(ctx, 0, 0, PW, H2, 24); ctx.fillStyle = "rgba(11,26,60,0.95)"; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(124,196,255,0.4)"; roundRect(ctx, 1, 1, PW - 2, H2 - 2, 24); ctx.stroke();
  ctx.textBaseline = "top";
  if (!large) { ctx.font = "22px InterB"; ctx.fillStyle = "#7cc4ff"; ctx.fillText(`STEP ${n} OF ${total}`, PAD, PAD); }
  ctx.font = `${HS}px InterB`; ctx.fillStyle = "#ffffff";
  titleLines.forEach((l, i) => ctx.fillText(l, PAD, PAD + LABEL + i * HEAD_LH));
  ctx.font = `${BS}px InterM`; ctx.fillStyle = "#d6e3ff";
  lines.forEach((l, i) => ctx.fillText(l, PAD, PAD + LABEL + titleLines.length * HEAD_LH + 8 + i * LH));
  writeFileSync(file, c.toBuffer("image/png"));
  return { w: PW, h: H2 };
}

/** Footage with a caption panel for each step, fading in and out. Cached so the clip and the tour share it. */
function footage(id) {
  const out = join(CACHE, `${id}-main.mp4`);
  const fresh = (f) => existsSync(f) && statSync(f).mtimeMs > Math.max(statSync(join(OUT, `${id}.webm`)).mtimeMs, statSync(join(OUT, `${id}.json`)).mtimeMs);
  if (fresh(out)) return out;
  const meta = JSON.parse(readFileSync(join(OUT, `${id}.json`), "utf8"));
  const src = join(OUT, `${id}.webm`);
  const trim = meta.trimStart ?? 0; // set-up recorded before the camera "starts" is cut
  const large = MODULES.find((m) => m.id === id.replace(/-v$/, ""))?.large ?? false;
  const total = dur(src) - trim;
  const inputs = ["-ss", trim.toFixed(2), "-i", src];
  meta.caps = meta.caps.map((c) => ({ ...c, at: Math.max(0, c.at - trim) }));
  const chain = [`[0:v]fps=${FPS},scale=${W}:${H},format=yuv420p[b0]`];
  meta.caps.forEach((c, i) => {
    const png = join(WORK, `${id}-cap${i}.png`);
    captionPng(png, i + 1, meta.caps.length, c.title, c.body, large ? "large" : "medium");
    const start = c.at + 0.15;
    const shownUntil = Math.min(meta.caps[i + 1]?.at ?? total, c.at + (c.hold ?? Infinity) + 0.3); // a caption leaves when its time is up
    const end = Math.min(shownUntil + 0.15, total - 0.1) - 0.05;
    const len = end - start;
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", (len + 0.5).toFixed(2), "-i", png);
    const y = V ? `H-h-${VERTICAL_CAPTION_BOTTOM_MARGIN}` : (c.ty > 560 ? "70" : "H-h-40");
    chain.push(
      `[${i + 1}:v]format=rgba,fade=t=in:st=0:d=0.4:alpha=1,fade=t=out:st=${(len - 0.4).toFixed(2)}:d=0.4:alpha=1,setpts=PTS+${start.toFixed(2)}/TB[o${i}]`,
      `[b${i}][o${i}]overlay=x=(W-w)/2:y=${y}:eof_action=pass[b${i + 1}]`,
    );
  });
  chain.push(`[b${meta.caps.length}]fade=t=in:st=0:d=0.4:color=${NAVY},fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4:color=${NAVY}[v]`);
  ff([...inputs, "-filter_complex", chain.join(";"), "-map", "[v]", "-t", total.toFixed(2), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-an", out]);
  return out;
}

/** A still card (intro or closing) turned into a short video with fades. */
async function card(name, seconds, draw) {
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b1a3c"); g.addColorStop(1, "#13306b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top"; ctx.textAlign = "center";
  const logo = await loadImage(LOGO);
  await draw(ctx, logo);
  const png = join(WORK, `${name}${SFX}.png`);
  writeFileSync(png, c.toBuffer("image/png"));
  const out = join(WORK, `${name}${SFX}.mp4`);
  ff(["-loop", "1", "-framerate", String(FPS), "-t", String(seconds), "-i", png,
    "-vf", `fade=t=in:st=0:d=0.5,fade=t=out:st=${(seconds - 0.5).toFixed(2)}:d=0.5,format=yuv420p`, "-c:v", "libx264", "-crf", "18", out]);
  return out;
}

const drawLogo = (ctx, logo, y, w = 520) => ctx.drawImage(logo, (W - w) / 2, y, w, (logo.height / logo.width) * w);
/** Centered text wrapped to a width; returns the y just below it. */
function para(ctx, text, y, lineHeight, maxWidth) {
  const lines = wrap(ctx, text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, CX, y + i * lineHeight));
  return y + lines.length * lineHeight;
}
function button(ctx, y) {
  const w = V ? 740 : 640, h = V ? 108 : 96, x = (W - w) / 2;
  roundRect(ctx, x, y, w, h, 20); ctx.fillStyle = "#7cc4ff"; ctx.fill();
  ctx.fillStyle = NAVY; ctx.font = `${V ? 50 : 44}px InterB`; ctx.fillText(CTA, CX, y + (V ? 26 : 24));
}

/** Module intro: the problem first, then the promise, then what the video covers. */
function introCard(m) {
  const meta = JSON.parse(readFileSync(join(OUT, `${m.id}${SFX}.json`), "utf8"));
  const steps = meta.caps.map((c) => c.title);
  const seconds = 4 + steps.length * 0.7;
  return card(`intro-${m.id}`, seconds, (ctx, logo) => {
    if (V) {
      drawLogo(ctx, logo, 250, 300);
      ctx.fillStyle = "#fff"; ctx.font = "78px InterB";
      let y = para(ctx, m.problem, 430, 96, 920) + 24;
      ctx.fillStyle = "#7cc4ff"; ctx.font = "42px InterM";
      y = para(ctx, m.pain, y, 54, 900) + 70;
      ctx.textAlign = "left";
      ctx.fillStyle = "#b8c7ee"; ctx.font = "26px InterB"; ctx.fillText("WHAT YOU WILL LEARN", 110, y);
      ctx.font = "36px InterM";
      steps.forEach((s, i) => {
        const yy = y + 58 + i * 60;
        ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.arc(124, yy + 22, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(s, 150, yy);
      });
      return;
    }
    drawLogo(ctx, logo, 70, 300);
    ctx.font = "78px InterB";
    const lines = wrap(ctx, m.problem, 1500);
    ctx.fillStyle = "#fff";
    lines.forEach((l, i) => ctx.fillText(l, 960, 210 + i * 94));
    const y1 = 210 + lines.length * 94 + 14;
    ctx.fillStyle = "#7cc4ff"; ctx.font = "42px InterM"; ctx.fillText(m.pain, 960, y1);
    ctx.textAlign = "left";
    const y2 = Math.max(y1 + 110, 520);
    ctx.fillStyle = "#b8c7ee"; ctx.font = "24px InterB"; ctx.fillText("WHAT YOU WILL LEARN", 480, y2);
    ctx.font = "34px InterM";
    steps.forEach((s, i) => {
      const y = y2 + 52 + i * 50;
      ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.arc(494, y + 20, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(s, 520, y);
    });
  });
}

/** The closing card every video ends with. */
function closing(seconds) {
  return card(`closing-${seconds}`, seconds, (ctx, logo) => {
    if (V) {
      drawLogo(ctx, logo, 560, 460);
      ctx.fillStyle = "#fff"; ctx.font = "64px InterB";
      let y = para(ctx, "Your business administration, finally organized.", 800, 80, 900) + 30;
      ctx.fillStyle = "#b8c7ee"; ctx.font = "42px InterM"; ctx.fillText("Less paperwork. More control.", CX, y);
      button(ctx, y + 120);
      return;
    }
    drawLogo(ctx, logo, 230, 520);
    ctx.fillStyle = "#fff"; ctx.font = "66px InterB"; ctx.fillText("Your business administration,", 960, 470);
    ctx.fillText("finally organized.", 960, 550);
    ctx.fillStyle = "#b8c7ee"; ctx.font = "42px InterM"; ctx.fillText("Less paperwork. More control.", 960, 660);
    button(ctx, 790);
  });
}

const concat = (parts, out) => {
  const list = join(WORK, "list.txt");
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
};

const have = (m) => existsSync(join(OUT, `${m.id}${SFX}.webm`));
const wants = (m) => wanted.length === 0 || wanted.includes(m.id);
const mods = MODULES.filter((m) => !m.campaign && have(m));
const end = await closing(5);
for (const m of mods.filter(wants)) {
  concat([await introCard(m), footage(`${m.id}${SFX}`), end], join(FINAL, `${m.id}${SFX}.mp4`));
  console.log("built", m.id + SFX);
}
if (wanted.length === 0 && !V) {
  const intro = await card("intro-tour", 5, (ctx, logo) => {
    drawLogo(ctx, logo, 260, 560);
    ctx.fillStyle = "#fff"; ctx.font = "68px InterB"; ctx.fillText("The administrative layer for contractors", 960, 500);
    ctx.fillStyle = "#b8c7ee"; ctx.font = "38px InterM"; ctx.fillText("A full walkthrough: compliance, records, equipment and more", 960, 610);
  });
  concat([intro, ...mods.map((m) => footage(m.id)), end], join(FINAL, "adflo-tour.mp4"));
  console.log("built adflo-tour");
}

// Campaign videos: the 60-second explainer and the short companion ad.
const campaignIntro = {
  explainer: () => card("intro-explainer", 5, (ctx, logo) => {
    if (V) {
      drawLogo(ctx, logo, 520, 520);
      ctx.fillStyle = "#fff"; ctx.font = "72px InterB";
      const y = para(ctx, "The administrative layer for contractors", 760, 90, 920) + 24;
      ctx.fillStyle = "#b8c7ee"; ctx.font = "42px InterM"; para(ctx, "Compliance, records, equipment and deadlines, organized", y, 56, 900);
      return;
    }
    drawLogo(ctx, logo, 250, 600);
    ctx.fillStyle = "#fff"; ctx.font = "70px InterB"; ctx.fillText("The administrative layer for contractors", 960, 500);
    ctx.fillStyle = "#b8c7ee"; ctx.font = "40px InterM"; ctx.fillText("Compliance, records, equipment and deadlines, organized", 960, 610);
  }),
  ad: () => card("intro-ad", 3.5, (ctx, logo) => {
    if (V) {
      drawLogo(ctx, logo, 400, 380);
      ctx.fillStyle = "#fff"; ctx.font = "84px InterB";
      const y = para(ctx, "Running a business takes more than the work.", 620, 104, 920) + 36;
      ctx.fillStyle = "#7cc4ff"; ctx.font = "44px InterM"; para(ctx, "Three questions every contractor should be able to answer", y, 58, 900);
      return;
    }
    drawLogo(ctx, logo, 140, 360);
    ctx.fillStyle = "#fff"; ctx.font = "76px InterB";
    ctx.fillText("Running a business takes", 960, 400); ctx.fillText("more than the work.", 960, 490);
    ctx.fillStyle = "#7cc4ff"; ctx.font = "44px InterM"; ctx.fillText("Three questions every contractor should be able to answer", 960, 640);
  }),
};
for (const m of MODULES.filter((m) => m.campaign && have(m) && wants(m))) {
  concat([await campaignIntro[m.id](), footage(`${m.id}${SFX}`), await closing(m.id === "ad" ? 4.5 : 5)], join(FINAL, `adflo-${m.id}${SFX}.mp4`));
  console.log("built", `adflo-${m.id}${SFX}`);
}
rmSync(WORK, { recursive: true, force: true });
