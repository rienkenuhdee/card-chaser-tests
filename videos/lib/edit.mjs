// Cutting and encoding with ffmpeg: each clip's frames laid out at 30 fps and set into the frame (lib/art.mjs) with
// its caption, then every part joined with crossfades (a quick dissolve inside a scene, a slide between scenes) and the
// animated end card, and encoded as one H.264 file under 10 MB.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { W, H, FPS, APP_W, APP_H, APP_X, APP_Y } from "./art.mjs";
import { log, Fail } from "./log.mjs";

export const OUT_W = W, OUT_H = H;
export const XF = { within: { kind: "fade", d: 0.2 }, scene: { kind: "smoothleft", d: 0.4 }, end: { kind: "slideup", d: 0.45 } };

function ff(args, what) {
  try { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] }); }
  catch { throw new Fail(`ffmpeg failed while ${what}`); }
}
const q = (p) => p.replace(/'/g, "'\\''");
const HQ = ["-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(FPS)];

/**
 * One clip: its frames in the frame picture, its caption over the band (sliding and fading in when `fresh`, the first
 * clip of a scene; a later clip of the same scene has it already in place, so the dissolve between them is seamless).
 */
export function renderClip(frames, { frame, caption, fresh }, file, work, id) {
  const list = path.join(work, `clip-${id}.txt`);
  fs.writeFileSync(list, frames.map((f) => `file '${q(f.file)}'\nduration ${f.dur.toFixed(5)}`).join("\n") + `\nfile '${q(frames.at(-1).file)}'\n`);
  const total = frames.reduce((a, f) => a + f.dur, 0).toFixed(3);
  const capIn = fresh ? `,fade=t=in:st=0.18:d=0.4:alpha=1` : "";
  const capY = fresh ? `'-30*max(0,1-max(0,t-0.18)/0.4)'` : "0";
  const g = [
    `[0:v]fps=${FPS},scale=${APP_W}:${APP_H}:flags=lanczos,setsar=1[app]`,
    `[1:v]format=rgba[bg]`,
    `[2:v]format=rgba${capIn}[cap]`,
    `[bg][app]overlay=${APP_X}:${APP_Y}:shortest=1[b]`,
    `[b][cap]overlay=0:${capY}:shortest=1,format=yuv420p[v]`,
  ].join(";");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-loop", "1", "-framerate", String(FPS), "-i", frame, "-loop", "1", "-framerate", String(FPS), "-i", caption,
    "-filter_complex", g, "-map", "[v]", "-t", total, ...HQ, file], `cutting clip ${id}`);
  return file;
}

/** The end card's frames (lib/art.mjs) as a clip. */
export function renderEndCard(pattern, file) {
  ff(["-framerate", String(FPS), "-i", pattern, "-vf", "format=yuv420p", ...HQ, file], "making the end card");
  return file;
}

const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString());

/**
 * Joins the parts with crossfades (joins[i] is how part i+1 comes in: XF.within, XF.scene or XF.end) and encodes the
 * final file; encodes smaller until it's under maxBytes. Returns the length.
 */
export function finish(parts, joins, out, { maxBytes = 10 * 1024 * 1024 } = {}) {
  const L = parts.map(dur);
  const inputs = parts.flatMap((p) => ["-i", p]);
  const g = parts.map((_, i) => `[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p,setsar=1[p${i}]`);
  let prev = "p0", t = L[0];
  for (let i = 1; i < parts.length; i++) {
    const j = joins[i - 1], d = Math.min(j.d, L[i - 1] / 2, L[i] / 2);
    t -= d;
    g.push(`[${prev}][p${i}]xfade=transition=${j.kind}:duration=${d.toFixed(3)}:offset=${t.toFixed(3)}[x${i}]`);
    t += L[i];
    prev = `x${i}`;
  }
  for (const crf of [21, 24, 27, 30]) {
    const tmp = `${out}.part.mp4`;
    ff([...inputs, "-filter_complex", g.join(";"), "-map", `[${prev}]`, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-maxrate", "2800k", "-bufsize", "5600k",
      "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", tmp], "joining and encoding the video");
    const size = fs.statSync(tmp).size;
    if (size < maxBytes) { fs.renameSync(tmp, out); log(`Encoded ${path.basename(out)} at crf ${crf}: ${(size / 1048576).toFixed(2)} MB`); return t; }
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
