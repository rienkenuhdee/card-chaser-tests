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
    const size = text.length > 30 ? 66 : 74;
    const html = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${BAND}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:0 60px">
      <div style="font-weight:800;font-size:${size}px;line-height:1.08;letter-spacing:-0.01em;text-align:center;color:#fff;-webkit-text-stroke:10px ${C.ink};paint-order:stroke fill;text-wrap:balance">${esc(text)}</div>
      <div style="width:150px;height:12px;background:${accent}"></div>
    </div>`;
    return this.shot(html, path.join(this.dir, `caption-${i}.png`), { transparent: true });
  }

  /** The end card, 2 s at 30 fps: the colour blocks slide in, then "Card Chaser", "cardchaser.app" and "Free". */
  async endCard(frames = 2 * FPS) {
    const html = `<style>
      .b{position:absolute;animation:in .5s cubic-bezier(.2,.8,.2,1) both}
      @keyframes in{from{transform:translate(var(--dx),var(--dy))}to{transform:none}}
      .t{position:absolute;left:0;width:${W}px;text-align:center;color:${C.ink};animation:up .45s cubic-bezier(.2,.8,.2,1) both}
      @keyframes up{from{opacity:0;transform:translateY(40px) scale(.96)}to{opacity:1;transform:none}}
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
      <div class="t" style="top:730px;font-weight:900;font-size:150px;letter-spacing:-0.035em;animation-delay:.3s">Card Chaser</div>
      <div class="t" style="top:930px;font-weight:700;font-size:74px;animation-delay:.45s">cardchaser.app</div>
      <div class="t free" style="top:1110px;animation-delay:.65s"><span style="display:inline-block;background:${C.red};color:#fff;font-weight:900;font-size:92px;padding:6px 54px 12px;box-shadow:12px 12px 0 ${C.ink}">Free</span></div>
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
