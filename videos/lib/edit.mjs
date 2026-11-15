// Cutting and encoding with ffmpeg: each clip's frames laid out at 30 fps and set into the frame (lib/art.mjs) with
// its caption, then every part joined with crossfades (a quick dissolve inside a scene, a slide between scenes) and the
// animated end card, and encoded as one H.264 file under 10 MB.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { W, H, FPS, APP_W, APP_H, APP_X, APP_Y } from "./art.mjs";
import { log, Fail } from "./log.mjs";

export const OUT_W = W, OUT_H = H;
// How one part comes in after another: a straight cut (footage that runs on), a quick dissolve (a cut past loading),
// a slide (a new scene), and the end card's slide up.
export const XF = { cut: { kind: "fade", d: 1 / 30 }, within: { kind: "fade", d: 0.16 }, scene: { kind: "smoothleft", d: 0.32 }, end: { kind: "slideup", d: 0.4 } };

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
export function renderClip(frames, { frame, caption, fresh, speed = 1, sticker = null }, file, work, id) {
  // The clip as exactly 30 frames a second: for each output frame, the captured frame that was on screen at that moment
  // (hard links, so nothing is copied). Handing ffmpeg the captured frames with their own durations made it read them
  // as a 25 fps stream and repeat every sixth frame while things moved.
  const dir = path.join(work, `seq-${id}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const total = frames.reduce((a, f) => a + f.dur, 0), n = Math.max(1, Math.round((total / speed) * FPS));
  let i = 0, end = frames[0].dur;
  for (let k = 0; k < n; k++) {
    const t = ((k + 0.5) / FPS) * speed; // (the moment filmed that this frame of the video shows)
    while (t > end && i < frames.length - 1) end += frames[++i].dur;
    const to = path.join(dir, `${String(k).padStart(6, "0")}.jpg`);
    try { fs.linkSync(frames[i].file, to); } catch { fs.copyFileSync(frames[i].file, to); }
  }
  const capIn = fresh ? `,fade=t=in:st=0.18:d=0.4:alpha=1` : "";
  const capY = fresh ? `'-30*max(0,1-max(0,t-0.18)/0.4)'` : "0";
  const g = [
    `[0:v]scale=${APP_W}:${APP_H}:flags=lanczos,setsar=1[app]`,
    `[1:v]format=rgba[bg]`,
    `[2:v]format=rgba${capIn}[cap]`,
    `[bg][app]overlay=${APP_X}:${APP_Y}:shortest=1[b]`,
    `[b][cap]overlay=0:${capY}:shortest=1${sticker ? "[c]" : ",format=yuv420p[v]"}`,
  ];
  const inputs = ["-framerate", String(FPS), "-i", path.join(dir, "%06d.jpg"), "-loop", "1", "-framerate", String(FPS), "-i", frame, "-loop", "1", "-framerate", String(FPS), "-i", caption];
  if (sticker) {
    // The stamp slams in at its moment: from 1.9x to its size with a little overshoot in 0.22 s, then a small settle.
    // Drawn as a sequence of frames already scaled (lib/art.mjs stamp()), so the edit only places them.
    inputs.push("-framerate", String(FPS), "-i", sticker.pattern);
    g.push(`[3:v]format=rgba,setpts=PTS+${sticker.at.toFixed(3)}/TB[st]`, `[c][st]overlay=0:0:eof_action=repeat:enable='gte(t,${sticker.at.toFixed(3)})',format=yuv420p[v]`);
  }
  ff([...inputs, "-filter_complex", g.join(";"), "-map", "[v]", "-frames:v", String(n), ...HQ, file], `cutting clip ${id}`);
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
