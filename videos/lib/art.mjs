// The video's own artwork, drawn as HTML in the browser and saved as pictures for ffmpeg: the frame around the phone's
// screen, each scene's caption, and the end card's frames. In the brand (Card-Chaser's BRAND.md): cream and ink, flat
// red, yellow and blue held in black rules, square corners, no soft shadows (a hard offset block shadow, as Find's
// search box has), Archivo (the brand's served font, fetched from cardchaser.app; a bold system sans if that fails).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { log } from "./log.mjs";

export const W = 1080, H = 1920, FPS = 30;
export const BAND = 250, RULE = 12;
// The phone's screen: 390x844 in shape, as large as the space under the band allows.
export const APP_H = 1560, APP_W = Math.round((APP_H * 390) / 844 / 2) * 2; // 720x1560
export const APP_X = Math.round((W - APP_W) / 2), APP_Y = BAND + RULE + Math.round((H - BAND - RULE - APP_H) / 2) - 6;
export const C = { cream: "#F1EEE6", ink: "#121212", red: "#D1281D", yellow: "#F2C300", blue: "#1E4C9E", panel: "#FBFAF6" };
export const ACCENTS = [C.red, C.yellow, C.blue];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export class Art {
  static async open(dir) {
    const a = new Art(); a.dir = dir; fs.mkdirSync(dir, { recursive: true });
    a.browser = await chromium.launch();
    const ctx = await a.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    a.page = await ctx.newPage();
    let font = "";
    try {
      const r = await ctx.request.get("https://cardchaser.app/fonts/archivo.woff2", { timeout: 15000 });
      if (r.ok()) font = `@font-face{font-family:Archivo;font-weight:500 900;src:url(data:font/woff2;base64,${(await r.body()).toString("base64")}) format("woff2")}`;
    } catch { /* the system's bold sans instead */ }
    if (!font) log("Archivo couldn't be fetched; the captions use the system's bold sans");
    a.css = `${font}*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden;background:transparent}
      body{font-family:Archivo,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}`;
    return a;
  }
  async shot(html, file, { transparent = false } = {}) {
    await this.page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${this.css}</style></head><body>${html}</body></html>`);
    await this.page.evaluate(() => document.fonts.ready);
    await this.page.screenshot({ path: file, omitBackground: transparent });
    return file;
  }

  /** The still frame every clip sits in: the band, the rules, the colour blocks, the screen's border and shadow. */
  async frame() {
    const m = APP_X, b = 14, y0 = BAND + RULE;
    const html = `<div style="position:absolute;inset:0;background:${C.cream}">
      <div style="position:absolute;left:0;top:0;width:${W}px;height:${BAND}px;background:${C.ink}"></div>
      <div style="position:absolute;left:0;top:${BAND}px;width:${W}px;height:${RULE}px;background:${C.ink}"></div>
      <!-- the left margin: red over cream over yellow -->
      <div style="position:absolute;left:0;top:${y0}px;width:${m - b - 30}px;height:520px;background:${C.red}"></div>
      <div style="position:absolute;left:0;top:${y0 + 520}px;width:${m - b - 30}px;height:${RULE}px;background:${C.ink}"></div>
      <div style="position:absolute;left:0;top:${H - 330}px;width:${m - b - 30}px;height:${RULE}px;background:${C.ink}"></div>
      <div style="position:absolute;left:0;top:${H - 330 + RULE}px;width:${m - b - 30}px;height:330px;background:${C.yellow}"></div>
      <div style="position:absolute;left:${m - b - 30}px;top:${y0}px;width:${RULE}px;height:${H - y0}px;background:${C.ink}"></div>
      <!-- the right margin: cream over blue -->
      <div style="position:absolute;right:0;top:${y0 + 760}px;width:${m - b - 30}px;height:${RULE}px;background:${C.ink}"></div>
      <div style="position:absolute;right:0;top:${y0 + 760 + RULE}px;width:${m - b - 30}px;height:${H - y0 - 760 - RULE}px;background:${C.blue}"></div>
      <div style="position:absolute;right:${m - b - 30}px;top:${y0}px;width:${RULE}px;height:${H - y0}px;background:${C.ink}"></div>
      <!-- the screen: a hard block shadow, then the black border round it -->
      <div style="position:absolute;left:${APP_X - b + 22}px;top:${APP_Y - b + 22}px;width:${APP_W + 2 * b}px;height:${APP_H + 2 * b}px;background:${C.ink}"></div>
      <div style="position:absolute;left:${APP_X - b}px;top:${APP_Y - b}px;width:${APP_W + 2 * b}px;height:${APP_H + 2 * b}px;background:${C.ink}"></div>
      <div style="position:absolute;left:${APP_X}px;top:${APP_Y}px;width:${APP_W}px;height:${APP_H}px;background:${C.panel}"></div>
    </div>`;
    return this.shot(html, path.join(this.dir, "frame.png"));
  }

  /** A caption: white, a dark outline, in the band, with the scene's colour stripe under it. Transparent elsewhere. */
  async caption(text, i, accent) {
    const lines = String(text).split("\n"), long = Math.max(...lines.map((l) => l.length));
    const size = lines.length > 1 ? 58 : long > 30 ? 66 : 74;
    const line = (l, k) => `<div style="font-weight:800;font-size:${lines.length > 1 && k === 0 ? Math.round(size * 0.8) : size}px;line-height:1.08;letter-spacing:-0.01em;text-align:center;color:#fff;-webkit-text-stroke:10px ${C.ink};paint-order:stroke fill;text-wrap:balance">${esc(l)}</div>`;
    const html = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${BAND}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${lines.length > 1 ? 4 : 22}px;padding:0 60px">
      ${lines.map(line).join("")}
      <div style="width:150px;height:12px;background:${accent};margin-top:${lines.length > 1 ? 14 : 0}px"></div>
    </div>`;
    return this.shot(html, path.join(this.dir, `caption-${i}.png`), { transparent: true });
  }

  /** Frames of an animated picture (its CSS animations stepped by hand), `seconds` long at 30 fps. Returns the pattern. */
  async seq(name, html, seconds, { transparent = true } = {}) {
    await this.page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${this.css}</style></head><body>${html}</body></html>`);
    await this.page.evaluate(() => document.fonts.ready);
    const frames = Math.round(seconds * FPS);
    for (let f = 0; f < frames; f++) {
      await this.page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, (f * 1000) / FPS);
      await this.page.screenshot({ path: path.join(this.dir, `${name}-${String(f).padStart(3, "0")}.png`), omitBackground: transparent });
    }
    return path.join(this.dir, `${name}-%03d.png`);
  }

  /** The hook: the meme line on black, words punching in one by one, then held (opaque, `seconds` long). */
  async hook(text, seconds = 1.25) {
    const words = String(text).split(" ");
    const html = `<style>.w{display:inline-block;animation:p .2s cubic-bezier(.3,1.6,.5,1) both}@keyframes p{from{opacity:0;transform:scale(1.8)}to{opacity:1;transform:none}}</style>
      <div style="position:absolute;inset:0;background:${C.ink};display:flex;align-items:center;justify-content:center;padding:0 80px">
        <div style="font-weight:900;font-size:96px;line-height:1.1;letter-spacing:-0.02em;text-align:center;color:#fff;text-wrap:balance">
          ${words.map((w, k) => `<span class="w" style="animation-delay:${(k * 0.07).toFixed(2)}s;${/^POV:?$/i.test(w) ? `color:${C.yellow}` : ""}">${esc(w)}</span>`).join(" ")}
        </div>
      </div>`;
    return this.seq("hook", html, seconds, { transparent: false });
  }

  /**
   * A reaction sticker, slammed in from nearly twice its size and tipped: `big` over an optional `small`, centred at
   * (cx, cy) on the video's frame, yellow (or red with white words) in a black rule with a hard shadow. 0.6 s.
   */
  async sticker(name, big, small, { cx, cy, color = "yellow", rot = -7, size = 84 } = {}) {
    const bg = color === "red" ? C.red : C.yellow, ink = color === "red" ? "#fff" : C.ink;
    const html = `<style>
      .s{position:absolute;left:${Math.round(cx)}px;top:${Math.round(cy)}px;white-space:nowrap;padding:18px 32px 24px;background:${bg};border:8px solid ${C.ink};box-shadow:16px 16px 0 ${C.ink};
         text-align:center;color:${ink};animation:slam .6s linear both}
      @keyframes slam{0%{transform:translate(-50%,-50%) rotate(${rot - 7}deg) scale(1.9);opacity:0}12%{opacity:1}36%{transform:translate(-50%,-50%) rotate(${rot + 1}deg) scale(.94)}52%{transform:translate(-50%,-50%) rotate(${rot - 1}deg) scale(1.04)}70%,100%{transform:translate(-50%,-50%) rotate(${rot}deg) scale(1)}}
    </style><div class="s"><div style="font-weight:900;font-size:${size}px;line-height:1;letter-spacing:-0.02em">${esc(big)}</div>${small ? `<div style="margin-top:8px;font-weight:800;font-size:${Math.round(size * 0.4)}px">${esc(small)}</div>` : ""}</div>`;
    return this.seq(name, html, 0.6);
  }

  /** A counter sticker that ticks up from 0 to `to` (then holds), with `label` beside it. 1.1 s. */
  async counter(name, to, label, { cx, cy, rot = -5 } = {}) {
    const frames = Math.round(1.1 * FPS), files = [];
    for (let f = 0; f < frames; f++) {
      const p = Math.min(1, f / (0.8 * FPS)), e = 1 - Math.pow(1 - p, 3), n = Math.round(to * e), pop = f < 6 ? 1.6 - f * 0.1 : 1;
      const html = `<div style="position:absolute;left:${Math.round(cx)}px;top:${Math.round(cy)}px;transform:translate(-50%,-50%) rotate(${rot}deg) scale(${pop});white-space:nowrap;padding:16px 30px 20px;background:${C.yellow};border:8px solid ${C.ink};box-shadow:16px 16px 0 ${C.ink};text-align:center;color:${C.ink}">
        <div style="font-weight:900;font-size:96px;line-height:1;font-variant-numeric:tabular-nums">${n.toLocaleString("en-US")}</div><div style="margin-top:6px;font-weight:800;font-size:36px">${esc(label)}</div></div>`;
      const file = path.join(this.dir, `${name}-${String(f).padStart(3, "0")}.png`);
      await this.shot(html, file, { transparent: true });
      files.push(file);
    }
    return path.join(this.dir, `${name}-%03d.png`);
  }

  /** Confetti in the brand's squares (red, yellow, blue, ink, cream) bursting from (cx, cy) and falling. 1.4 s. */
  async confetti(name, { cx, cy, n = 72 } = {}) {
    const cols = [C.red, C.yellow, C.blue, C.ink, C.panel];
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bits = Array.from({ length: n }, (_, i) => {
      // (mostly upward and outward, then falling: a pop, not a drip)
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.5, v = 520 + rnd() * 700, dx = Math.cos(a) * v, dy = Math.sin(a) * v, sz = 24 + rnd() * 34, spin = (rnd() - 0.5) * 1100;
      return `<div style="position:absolute;left:${Math.round(cx - sz / 2)}px;top:${Math.round(cy - sz / 2)}px;width:${Math.round(sz)}px;height:${Math.round(sz * (0.6 + rnd() * 0.8))}px;background:${cols[i % cols.length]};border:3px solid ${C.ink};
        animation:b${i} 1.4s linear both"></div><style>@keyframes b${i}{0%{transform:translate(0,0) rotate(0) scale(.3);opacity:1}35%{transform:translate(${Math.round(dx * 0.75)}px,${Math.round(dy * 0.8)}px) rotate(${Math.round(spin * 0.4)}deg) scale(1)}75%{opacity:1}100%{transform:translate(${Math.round(dx)}px,${Math.round(dy * 0.6 + 760)}px) rotate(${Math.round(spin)}deg) scale(1);opacity:0}}</style>`;
    }).join("");
    return this.seq(name, bits, 1.4);
  }

  /**
   * The deal's stamp, "SAVE $234" over "26% under market": yellow, a black rule, a hard shadow, tipped, slammed in from
   * nearly twice its size with a little overshoot. Frames of a transparent full picture (0.6 s; the last one holds),
   * placed at the right with its foot at `bottom` (just above the deal's own row, never over it). Returns the frames' pattern.
   */
  async stamp(big, small, { bottom = H - 120 } = {}) {
    const html = `<style>
      .s{position:absolute;right:46px;bottom:${Math.round(H - bottom)}px;white-space:nowrap;padding:20px 34px 26px;background:${C.yellow};border:8px solid ${C.ink};box-shadow:16px 16px 0 ${C.ink};
         text-align:center;color:${C.ink};transform-origin:50% 50%;animation:slam .6s linear both}
      .b{font-weight:900;font-size:84px;line-height:1;letter-spacing:-0.02em}
      .m{margin-top:8px;font-weight:800;font-size:34px}
      @keyframes slam{0%{transform:rotate(-14deg) scale(1.9);opacity:0}12%{opacity:1}36%{transform:rotate(-6deg) scale(.94)}52%{transform:rotate(-8deg) scale(1.04)}70%,100%{transform:rotate(-7deg) scale(1)}}
    </style><div class="s"><div class="b">${esc(big)}</div>${small ? `<div class="m">${esc(small)}</div>` : ""}</div>`;
    await this.page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${this.css}</style></head><body>${html}</body></html>`);
    await this.page.evaluate(() => document.fonts.ready);
    const frames = Math.round(0.6 * FPS) + 1;
    for (let f = 0; f < frames; f++) {
      await this.page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, Math.min(599, (f * 1000) / FPS));
      await this.page.screenshot({ path: path.join(this.dir, `stamp-${String(f).padStart(3, "0")}.png`), omitBackground: true });
    }
    return path.join(this.dir, "stamp-%03d.png");
  }

  /** The end card, 2 s at 30 fps: the colour blocks slide in, then "Card Chaser", "cardchaser.app" and "Free". */
  async endCard(frames = 2 * FPS) {
    const html = `<style>
      .b{position:absolute;animation:in .32s cubic-bezier(.2,.9,.25,1) both}
      @keyframes in{from{transform:translate(var(--dx),var(--dy))}to{transform:none}}
      .t{position:absolute;left:0;width:${W}px;text-align:center;color:${C.ink};animation:up .4s cubic-bezier(.3,1.5,.5,1) both}
      @keyframes up{from{opacity:0;transform:scale(1.5)}30%{opacity:1}to{opacity:1;transform:none}}
      .free{animation:pop .5s cubic-bezier(.3,1.6,.5,1) both}
      @keyframes pop{from{opacity:0;transform:scale(.4) rotate(-6deg)}to{opacity:1;transform:rotate(-3deg)}}
    </style>
    <div style="position:absolute;inset:0;background:${C.cream};overflow:hidden">
      <div class="b" style="left:0;top:0;width:430px;height:560px;background:${C.red};--dx:-440px;--dy:0"></div>
      <div class="b" style="left:430px;top:0;width:${RULE + 4}px;height:560px;background:${C.ink};--dx:0;--dy:-570px;animation-delay:.05s"></div>
      <div class="b" style="left:0;top:560px;width:${W}px;height:${RULE + 4}px;background:${C.ink};--dx:-${W}px;--dy:0;animation-delay:.08s"></div>
      <div class="b" style="left:860px;top:0;width:${W - 860}px;height:300px;background:${C.yellow};--dx:240px;--dy:0;animation-delay:.1s"></div>
      <div class="b" style="left:844px;top:0;width:${RULE + 4}px;height:560px;background:${C.ink};--dx:0;--dy:-570px;animation-delay:.12s"></div>
      <div class="b" style="left:860px;top:300px;width:${W - 860}px;height:${RULE + 4}px;background:${C.ink};--dx:240px;--dy:0;animation-delay:.12s"></div>
      <div class="b" style="left:0;top:1440px;width:${W}px;height:${RULE + 4}px;background:${C.ink};--dx:${W}px;--dy:0;animation-delay:.1s"></div>
      <div class="b" style="left:716px;top:1456px;width:${W - 716}px;height:${H - 1456}px;background:${C.blue};--dx:0;--dy:480px;animation-delay:.06s"></div>
      <div class="b" style="left:700px;top:1456px;width:${RULE + 4}px;height:${H - 1456}px;background:${C.ink};--dx:0;--dy:480px;animation-delay:.06s"></div>
      <div class="b" style="left:0;top:1456px;width:180px;height:${H - 1456}px;background:${C.yellow};--dx:-200px;--dy:0;animation-delay:.14s"></div>
      <div class="b" style="left:180px;top:1456px;width:${RULE + 4}px;height:${H - 1456}px;background:${C.ink};--dx:-200px;--dy:0;animation-delay:.14s"></div>
      <div class="t" style="top:730px;font-weight:900;font-size:150px;letter-spacing:-0.035em;animation-delay:.22s">Card Chaser</div>
      <div class="t" style="top:930px;font-weight:700;font-size:74px;animation-delay:.42s">cardchaser.app</div>
      <div class="t free" style="top:1110px;animation-delay:.62s"><span style="display:inline-block;background:${C.red};color:#fff;font-weight:900;font-size:92px;padding:6px 54px 12px;box-shadow:12px 12px 0 ${C.ink}">Free</span></div>
    </div>`;
    await this.page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${this.css}</style></head><body>${html}</body></html>`);
    await this.page.evaluate(() => document.fonts.ready);
    const files = [];
    for (let f = 0; f < frames; f++) {
      await this.page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, (f * 1000) / FPS);
      const file = path.join(this.dir, `end-${String(f).padStart(3, "0")}.png`);
      await this.page.screenshot({ path: file });
      files.push(file);
    }
    return path.join(this.dir, "end-%03d.png");
  }
  async close() { await this.browser.close().catch(() => {}); }
}
