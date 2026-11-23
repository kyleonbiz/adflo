// Turns the recordings in out/ into finished videos:
//   out/final/<id>.mp4        one clip per module: intro card listing what you will learn, captions, end card
//   out/final/adflo-tour.mp4  every module in one video
// Needs ffmpeg and the Inter font. Run record.mjs first.   node scripts/demo-video/build.mjs [ids...]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { MODULES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const FINAL = join(OUT, "final");
const WORK = join(OUT, "work");
const LOGO = join(HERE, "../../public/logo-wordmark-light.png");
GlobalFonts.registerFromPath("/usr/share/fonts/opentype/inter/Inter-Bold.otf", "InterB");
GlobalFonts.registerFromPath("/usr/share/fonts/opentype/inter/Inter-Medium.otf", "InterM");
const NAVY = "#0b1a3c";
const FPS = 30;
const CTA = process.env.DEMO_CTA ?? "Start free at adflo.com";
const wanted = process.argv.slice(2);

rmSync(WORK, { recursive: true, force: true });
mkdirSync(FINAL, { recursive: true });
mkdirSync(WORK, { recursive: true });

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
function captionPng(file, n, total, title, body) {
  const W = 1560, PAD = 36, BODY_W = W - PAD * 2;
  const probe = createCanvas(10, 10).getContext("2d");
  probe.font = "30px InterM";
  const lines = body ? wrap(probe, body, BODY_W) : [];
  const H = PAD + 26 + 14 + 52 + (lines.length ? 12 + lines.length * 42 : 0) + PAD - 4;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  roundRect(ctx, 0, 0, W, H, 24); ctx.fillStyle = "rgba(11,26,60,0.95)"; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(124,196,255,0.4)"; roundRect(ctx, 1, 1, W - 2, H - 2, 24); ctx.stroke();
  ctx.textBaseline = "top";
  ctx.font = "22px InterB"; ctx.fillStyle = "#7cc4ff"; ctx.fillText(`STEP ${n} OF ${total}`, PAD, PAD);
  ctx.font = "44px InterB"; ctx.fillStyle = "#ffffff"; ctx.fillText(title, PAD, PAD + 40);
  ctx.font = "30px InterM"; ctx.fillStyle = "#d6e3ff";
  lines.forEach((l, i) => ctx.fillText(l, PAD, PAD + 40 + 52 + 12 + i * 42));
  writeFileSync(file, c.toBuffer("image/png"));
  return { w: W, h: H };
}

/** Footage with a caption panel for each step, fading in and out. Cached so the clip and the tour share it. */
function footage(id) {
  const out = join(WORK, `${id}-main.mp4`);
  if (existsSync(out)) return out;
  const meta = JSON.parse(readFileSync(join(OUT, `${id}.json`), "utf8"));
  const src = join(OUT, `${id}.webm`);
  const total = dur(src);
  const inputs = ["-i", src];
  const chain = [`[0:v]fps=${FPS},scale=1920:1080,format=yuv420p[b0]`];
  meta.caps.forEach((c, i) => {
    const png = join(WORK, `${id}-cap${i}.png`);
    const { h } = captionPng(png, i + 1, meta.caps.length, c.title, c.body);
    const start = c.at + 0.15;
    const end = Math.min((meta.caps[i + 1]?.at ?? total) + 0.15, total - 0.1) - 0.05;
    const len = end - start;
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", (len + 0.5).toFixed(2), "-i", png);
    chain.push(
      `[${i + 1}:v]format=rgba,fade=t=in:st=0:d=0.4:alpha=1,fade=t=out:st=${(len - 0.4).toFixed(2)}:d=0.4:alpha=1,setpts=PTS+${start.toFixed(2)}/TB[o${i}]`,
      `[b${i}][o${i}]overlay=x=(W-w)/2:y=${c.ty > 560 ? 70 : `H-h-40`}:eof_action=pass[b${i + 1}]`,
    );
  });
  chain.push(`[b${meta.caps.length}]fade=t=in:st=0:d=0.4:color=${NAVY},fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4:color=${NAVY}[v]`);
  ff([...inputs, "-filter_complex", chain.join(";"), "-map", "[v]", "-t", total.toFixed(2), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-an", out]);
  return out;
}

/** A still card (intro or end) turned into a short video with fades. */
async function card(name, seconds, draw) {
  const c = createCanvas(1920, 1080), ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 1920, 1080);
  g.addColorStop(0, "#0b1a3c"); g.addColorStop(1, "#13306b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  ctx.textBaseline = "top"; ctx.textAlign = "center";
  const logo = await loadImage(LOGO);
  await draw(ctx, logo);
  const png = join(WORK, `${name}.png`);
  writeFileSync(png, c.toBuffer("image/png"));
  const out = join(WORK, `${name}.mp4`);
  ff(["-loop", "1", "-framerate", String(FPS), "-t", String(seconds), "-i", png,
    "-vf", `fade=t=in:st=0:d=0.5,fade=t=out:st=${(seconds - 0.5).toFixed(2)}:d=0.5,format=yuv420p`, "-c:v", "libx264", "-crf", "18", out]);
  return out;
}

const drawLogo = (ctx, logo, y, w = 520) => ctx.drawImage(logo, (1920 - w) / 2, y, w, (logo.height / logo.width) * w);

function introCard(m) {
  const meta = JSON.parse(readFileSync(join(OUT, `${m.id}.json`), "utf8"));
  const steps = meta.caps.map((c) => c.title);
  const seconds = 3.5 + steps.length * 0.8;
  return card(`intro-${m.id}`, seconds, (ctx, logo) => {
    drawLogo(ctx, logo, 110, 380);
    ctx.fillStyle = "#fff"; ctx.font = "72px InterB"; ctx.fillText(m.title, 960, 270);
    ctx.fillStyle = "#b8c7ee"; ctx.font = "36px InterM"; ctx.fillText(m.pain, 960, 370);
    ctx.textAlign = "left";
    ctx.fillStyle = "#7cc4ff"; ctx.font = "24px InterB"; ctx.fillText("WHAT YOU WILL LEARN", 480, 500);
    ctx.fillStyle = "#fff"; ctx.font = "34px InterM";
    steps.forEach((s, i) => {
      const y = 552 + i * 56;
      ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.arc(494, y + 20, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.fillText(s, 520, y);
    });
  });
}

function endCard(next) {
  return card("end", 4.5, (ctx, logo) => {
    drawLogo(ctx, logo, 280, 520);
    ctx.fillStyle = "#fff"; ctx.font = "64px InterB"; ctx.fillText("Less paperwork. More control.", 960, 520);
    ctx.fillStyle = "#b8c7ee"; ctx.font = "38px InterM"; ctx.fillText("Works alongside your accounting and project software", 960, 620);
    const w = 640, h = 96, x = (1920 - w) / 2, y = 760;
    roundRect(ctx, x, y, w, h, 20); ctx.fillStyle = "#7cc4ff"; ctx.fill();
    ctx.fillStyle = NAVY; ctx.font = "44px InterB"; ctx.fillText(CTA, 960, y + 24);
  });
}

const concat = (parts, out) => {
  const list = join(WORK, "list.txt");
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
};

const mods = MODULES.filter((m) => existsSync(join(OUT, `${m.id}.webm`)));
const end = await endCard();
for (const m of mods.filter((m) => wanted.length === 0 || wanted.includes(m.id))) {
  concat([await introCard(m), footage(m.id), end], join(FINAL, `${m.id}.mp4`));
  console.log("built", m.id);
}
if (wanted.length === 0) {
  const intro = await card("intro-tour", 5, (ctx, logo) => {
    drawLogo(ctx, logo, 260, 560);
    ctx.fillStyle = "#fff"; ctx.font = "68px InterB"; ctx.fillText("The administrative layer for contractors", 960, 500);
    ctx.fillStyle = "#b8c7ee"; ctx.font = "38px InterM"; ctx.fillText("A full walkthrough: compliance, records, equipment and more", 960, 610);
  });
  concat([intro, ...mods.map((m) => footage(m.id)), end], join(FINAL, "adflo-tour.mp4"));
  console.log("built adflo-tour");
}
rmSync(WORK, { recursive: true, force: true });
