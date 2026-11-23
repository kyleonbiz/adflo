// Turns the recordings in out/ into finished videos:
//   out/final/<id>.mp4        one clip per module: title card, captions, end card
//   out/final/adflo-tour.mp4  every module in one video
// Needs ffmpeg and the Inter font. Run record.mjs first.   node scripts/demo-video/build.mjs [ids...]
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MODULES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const FINAL = join(OUT, "final");
const WORK = join(OUT, "work");
const LOGO = join(HERE, "../../public/logo-wordmark-light.png");
const BOLD = "/usr/share/fonts/opentype/inter/Inter-Bold.otf";
const MED = "/usr/share/fonts/opentype/inter/Inter-Medium.otf";
const BG = "0x0b1a3c";
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
const textFile = (name, text) => { const p = join(WORK, name); writeFileSync(p, text); return p; };
const dur = (f) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);

/** Footage with captions fading in and out. */
function footage(id, withFades) {
  const meta = JSON.parse(readFileSync(join(OUT, `${id}.json`), "utf8"));
  const src = join(OUT, `${id}.webm`);
  const total = dur(src);
  const filters = [`fps=${FPS}`, "scale=1920:1080", "format=yuv420p"];
  meta.caps.forEach((c, i) => {
    const start = c.at + 0.2;
    const end = Math.min((meta.caps[i + 1]?.at ?? total) + 0.2, total - 0.2) - 0.1;
    const f = textFile(`${id}-${i}.txt`, c.text);
    filters.push(
      `drawtext=fontfile=${BOLD}:textfile=${f}:fontsize=46:fontcolor=white:box=1:boxcolor=${BG}d9:boxborderw=26:x=(w-text_w)/2:y=h-130:` +
      `enable='between(t,${start.toFixed(2)},${end.toFixed(2)})':alpha='if(lt(t,${(start + 0.35).toFixed(2)}),(t-${start.toFixed(2)})/0.35,if(gt(t,${(end - 0.35).toFixed(2)}),(${end.toFixed(2)}-t)/0.35,1))'`,
    );
  });
  if (withFades) filters.push(`fade=t=in:st=0:d=0.4:color=${BG}`, `fade=t=out:st=${(total - 0.4).toFixed(2)}:d=0.4:color=${BG}`);
  const out = join(WORK, `${id}-main${withFades ? "-f" : ""}.mp4`);
  ff(["-i", src, "-vf", filters.join(","), "-c:v", "libx264", "-crf", "18", "-an", out]);
  return out;
}

/** Title or closing card on the dark brand background. */
function card(name, seconds, lines) {
  const [l1, l2, l3] = lines.map((t, i) => (t ? textFile(`${name}-l${i}.txt`, t) : null));
  const dt = (file, font, size, color, y, at, extra = "") =>
    file ? `drawtext=fontfile=${font}:textfile=${file}:fontsize=${size}:fontcolor=${color}:x=(w-text_w)/2:y=${y}:alpha='min(1,max(0,(t-${at})/0.6))'${extra}` : null;
  const chain = [
    `[0:v][l]overlay=(W-w)/2:300:shortest=1`,
    dt(l1, BOLD, 64, "white", 520, 0.6),
    dt(l2, MED, 38, "0xb8c7ee", 620, 1.0),
    dt(l3, BOLD, 44, "0x0b1a3c", 780, 1.4, `:box=1:boxcolor=0x7cc4ff:boxborderw=24`),
    `fade=t=out:st=${(seconds - 0.4).toFixed(2)}:d=0.4`,
    "format=yuv420p",
  ].filter(Boolean).join(",");
  const out = join(WORK, `${name}.mp4`);
  ff(["-f", "lavfi", "-i", `color=c=${BG}:s=1920x1080:r=${FPS}:d=${seconds}`, "-loop", "1", "-i", LOGO,
    "-filter_complex", `[1:v]scale=560:-1,format=rgba,fade=t=in:st=0.2:d=0.6:alpha=1[l];${chain}`, "-c:v", "libx264", "-crf", "18", "-t", String(seconds), out]);
  return out;
}

const join2 = (parts, out) => {
  const list = textFile("list.txt", parts.map((p) => `file '${p}'`).join("\n"));
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
};

const mods = MODULES.filter((m) => existsSync(join(OUT, `${m.id}.webm`)));
const end = card("end", 4, ["Less paperwork. More control.", "Works alongside your accounting and project software", CTA]);

for (const m of mods.filter((m) => wanted.length === 0 || wanted.includes(m.id))) {
  const intro = card(`intro-${m.id}`, 3.5, [m.title, m.pain, null]);
  join2([intro, footage(m.id, true), end], join(FINAL, `${m.id}.mp4`));
  console.log("built", m.id);
}
if (wanted.length === 0) {
  const intro = card("intro-tour", 3.5, ["The administrative layer for contractors", "Compliance, records and equipment, organized", null]);
  join2([intro, ...mods.map((m) => footage(m.id, true)), end], join(FINAL, "adflo-tour.mp4"));
  console.log("built adflo-tour");
}
rmSync(WORK, { recursive: true, force: true });
