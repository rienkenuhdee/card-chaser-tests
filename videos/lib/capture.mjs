// Filming: frames from the browser's own screencast (Chrome DevTools Protocol), at the page's device pixels
// (390x844 at deviceScaleFactor 3 = 1170x2532), each kept with the time it was painted. Clips are time ranges marked
// while the scenes run; only those ranges reach the video, so everything before a scene is ready is cut.
import fs from "node:fs";
import path from "node:path";
import { log } from "./log.mjs";

export class Film {
  constructor(session, dir) {
    this.S = session; this.dir = dir; this.frames = []; this.clips = []; this.open = null; this.n = 0;
    fs.mkdirSync(dir, { recursive: true });
  }
  async start() {
    const cdp = (this.cdp = await this.S.context.newCDPSession(this.S.page));
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      const file = path.join(this.dir, `f${String(++this.n).padStart(6, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(data, "base64"));
      this.frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000, w: metadata.deviceWidth, h: metadata.deviceHeight });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });
  }
  /**
   * Starts keeping a clip from now. The screen must already be finished (Session.settled). `speed`: how much faster it
   * plays than it was filmed; `join` "cut": it runs straight on from the clip before (no flash); `ramp`: a
   * speed ramp (lib/edit.mjs); `slam`: [words, field], the trailer's title slam just before it (a scroll filmed at half speed and played at 2x has a fresh frame for every frame of the
   * video, so it never judders).
   */
  async begin(scene, caption, { speed = 1, join, ramp = 0, slam = null } = {}) {
    if (this.open) throw new Error("clip already open");
    this.S.assertClean();
    await this.nudge();
    this.open = { scene, caption, speed, join, ramp, slam, start: Date.now() / 1000, marks: {}, overlays: [], captions: [{ text: caption, at: 0 }] };
    this.S.clipOn = true;
    log(`  clip starts: ${scene}`);
  }
  /** Seconds of video since the open clip began. */
  now() { return (Date.now() / 1000 - this.open.start) / this.open.speed; }
  /**
   * Something for the edit to put over the video from now: { kind: "sticker" | "counter" | "confetti" | "stamp", ... }
   * with its words and where on the page it belongs (x, y in the page's px; the edit maps them onto the frame).
   */
  overlay(o) { if (this.open) this.open.overlays.push({ ...o, at: this.now() }); }
  /** The punchline: the caption changes to `text` from now. */
  punch(text) { if (this.open) this.open.captions.push({ text, at: this.now() }); }
  /** Notes a moment inside the open clip (seconds of video from its start), for the edit: a sticker's entrance. */
  mark(name) { if (this.open) this.open.marks[name] = (Date.now() / 1000 - this.open.start) / this.open.speed; }
  async end() {
    if (!this.open) throw new Error("no clip open");
    await this.nudge();
    this.open.end = Date.now() / 1000;
    this.S.clipOn = false;
    this.S.assertClean();
    this.clips.push(this.open);
    log(`  clip ends: ${this.open.scene} (${(this.open.end - this.open.start).toFixed(2)}s)`);
    this.open = null;
  }
  /** Asks for a fresh frame (the screencast only sends one when something is painted). */
  async nudge() { await this.S.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {}); }
  async stop() { try { await this.cdp.send("Page.stopScreencast"); } catch { /* closed */ } await new Promise((r) => setTimeout(r, 300)); }
  /** For each clip: [{ file, dur }] covering exactly its time range, holding each frame until the next. */
  framesOf(clip) {
    const F = this.frames.filter((f) => f.w && f.h).sort((a, b) => a.t - b.t);
    let i = F.findLastIndex((f) => f.t <= clip.start);
    if (i < 0) i = 0;
    const out = [];
    for (; i < F.length && F[i].t < clip.end; i++) {
      const from = Math.max(F[i].t, clip.start), to = Math.min(F[i + 1]?.t ?? clip.end, clip.end);
      if (to > from) out.push({ file: F[i].file, dur: to - from });
    }
    if (!out.length) throw new Error(`no frames for ${clip.scene}`);
    return out;
  }
}
