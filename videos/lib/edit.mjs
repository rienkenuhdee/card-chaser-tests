// Cutting and encoding with ffmpeg: each clip's frames laid out at 30 fps, the phone's screen scaled into a
// 1080x1920 frame under a caption band, the caption burned in, the end card, and one H.264 file under 10 MB.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { log, Fail } from "./log.mjs";

export const OUT_W = 1080, OUT_H = 1920, FPS = 30;
const BAND = 270; // the caption band at the top (the top third), clear of the app's screen
const APP_H = OUT_H - BAND - 30, APP_W = Math.round((APP_H * 390) / 844 / 2) * 2; // the phone's screen, 390x844 in shape
const APP_X = Math.round((OUT_W - APP_W) / 2), APP_Y = BAND;
const BG = "0x141414"; // the brand's dark ground
// The brand's Mondrian colours (BRAND.md, light): cream, ink, red, yellow, blue.
const M = { cream: "0xF1EEE6", ink: "0x121212", red: "0xD1281D", yellow: "0xF2C300", blue: "0x1E4C9E" };

const FONT_CANDIDATES = [process.env.VIDEO_FONT, "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"];
export function font() {
  const f = FONT_CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!f) throw new Fail("No bold font for the captions: install fonts-dejavu-core or set VIDEO_FONT to a .ttf");
  return f;
}
function ff(args, what) {
  try { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] }); }
  catch (e) { throw new Fail(`ffmpeg failed while ${what}`); }
}
const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

/** Splits a caption into at most two lines that fit the band. */
function lines(text, size) {
  const max = Math.floor((OUT_W - 100) / (size * 0.6));
  if (text.length <= max) return [text];
  const words = text.split(" "); let best = null;
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(" "), b = words.slice(i).join(" "); const w = Math.max(a.length, b.length); if (!best || w < best.w) best = { w, l: [a, b] }; }
  return best.l;
}
function captionFilter(text, work, id) {
  const size = text.length > 30 ? 62 : 70, L = lines(text, size), lh = Math.round(size * 1.22);
  const top = Math.round((BAND - L.length * lh) / 2) + 6;
  return L.map((line, i) => {
    const f = path.join(work, `cap-${id}-${i}.txt`); fs.writeFileSync(f, line);
    return `drawtext=fontfile='${esc(font())}':textfile='${esc(f)}':fontsize=${size}:fontcolor=white:borderw=6:bordercolor=0x121212:x=(w-text_w)/2:y=${top + i * lh}`;
  }).join(",");
}

/** One clip to an intermediate file (high quality, exact 30 fps). */
export function renderClip(frames, caption, file, work, id, { fadeIn = true } = {}) {
  const list = path.join(work, `clip-${id}.txt`);
  const body = frames.map((f) => `file '${f.file.replace(/'/g, "'\\''")}'\nduration ${f.dur.toFixed(5)}`).join("\n") + `\nfile '${frames.at(-1).file.replace(/'/g, "'\\''")}'\n`;
  fs.writeFileSync(list, body);
  const total = frames.reduce((a, f) => a + f.dur, 0);
  const vf = [
    `fps=${FPS}`,
    `scale=${APP_W}:${APP_H}:flags=lanczos`,
    `pad=${OUT_W}:${OUT_H}:${APP_X}:${APP_Y}:color=${BG}`,
    captionFilter(caption, work, id),
    fadeIn ? "fade=t=in:st=0:d=0.18" : null,
    "format=yuv420p",
  ].filter(Boolean).join(",");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-vf", vf, "-t", total.toFixed(3), "-r", String(FPS), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", file], `cutting ${id}`);
  return file;
}

/** The end card: "Card Chaser", "cardchaser.app", "Free", on the Mondrian colours, 2 seconds. */
export function renderEndCard(file, work) {
  const F = esc(font()), t = (name, text) => { const f = path.join(work, `end-${name}.txt`); fs.writeFileSync(f, text); return esc(f); };
  const R = 16; // the black rules
  const boxes = [
    `drawbox=x=0:y=0:w=430:h=560:color=${M.red}:t=fill`,
    `drawbox=x=430:y=0:w=${R}:h=560:color=${M.ink}:t=fill`,
    `drawbox=x=0:y=560:w=${OUT_W}:h=${R}:color=${M.ink}:t=fill`,
    `drawbox=x=860:y=0:w=${R}:h=560:color=${M.ink}:t=fill`,
    `drawbox=x=${860 + R}:y=0:w=${OUT_W - 860 - R}:h=300:color=${M.yellow}:t=fill`,
    `drawbox=x=${860 + R}:y=300:w=${OUT_W - 860 - R}:h=${R}:color=${M.ink}:t=fill`,
    `drawbox=x=0:y=1440:w=${OUT_W}:h=${R}:color=${M.ink}:t=fill`,
    `drawbox=x=700:y=${1440 + R}:w=${R}:h=${OUT_H - 1440 - R}:color=${M.ink}:t=fill`,
    `drawbox=x=${700 + R}:y=${1440 + R}:w=${OUT_W - 700 - R}:h=${OUT_H - 1440 - R}:color=${M.blue}:t=fill`,
    `drawbox=x=0:y=${1440 + R}:w=180:h=${OUT_H - 1440 - R}:color=${M.yellow}:t=fill`,
    `drawbox=x=180:y=${1440 + R}:w=${R}:h=${OUT_H - 1440 - R}:color=${M.ink}:t=fill`,
  ];
  const words = [
    `drawtext=fontfile='${F}':textfile='${t("a", "Card Chaser")}':fontsize=132:fontcolor=${M.ink}:x=(w-text_w)/2:y=760`,
    `drawtext=fontfile='${F}':textfile='${t("b", "cardchaser.app")}':fontsize=76:fontcolor=${M.ink}:x=(w-text_w)/2:y=960`,
    `drawbox=x=(iw-300)/2:y=1110:w=300:h=130:color=${M.red}:t=fill`,
    `drawtext=fontfile='${F}':textfile='${t("c", "Free")}':fontsize=84:fontcolor=white:x=(w-text_w)/2:y=1130`,
  ];
  ff(["-f", "lavfi", "-i", `color=c=${M.cream}:s=${OUT_W}x${OUT_H}:r=${FPS}:d=2`, "-vf", [...boxes, ...words, "fade=t=in:st=0:d=0.25", "format=yuv420p"].join(","), "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-t", "2", file], "drawing the end card");
  return file;
}

/** Joins the parts and encodes the final file; re-encodes smaller until it's under maxBytes. */
export function finish(parts, out, work, { maxBytes = 10 * 1024 * 1024 } = {}) {
  const list = path.join(work, "parts.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  for (const crf of [23, 26, 29, 32]) {
    const tmp = `${out}.part.mp4`;
    ff(["-f", "concat", "-safe", "0", "-i", list, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-maxrate", "2800k", "-bufsize", "5600k", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", tmp], "encoding the video");
    const size = fs.statSync(tmp).size;
    if (size < maxBytes) { fs.renameSync(tmp, out); log(`Encoded ${path.basename(out)} at crf ${crf}: ${(size / 1048576).toFixed(2)} MB`); return; }
    log(`${path.basename(out)} was ${(size / 1048576).toFixed(2)} MB at crf ${crf}; encoding smaller`);
    fs.rmSync(tmp, { force: true });
  }
  throw new Fail("Couldn't get the video under 10 MB");
}

/** Reads back what was made: { width, height, fps, codec, duration, bytes, audio }. */
export function probe(file) {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]).toString());
  const v = j.streams.find((s) => s.codec_type === "video");
  const [a, b] = String(v.r_frame_rate).split("/").map(Number);
  return { width: v.width, height: v.height, fps: a / (b || 1), codec: v.codec_name, duration: Number(j.format.duration), bytes: Number(j.format.size), audio: j.streams.some((s) => s.codec_type === "audio") };
}
