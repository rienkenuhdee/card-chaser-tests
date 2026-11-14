// The browser, the sign-in, and the checks every scene leans on: waiting for a screen to be finished, finding things on
// the Wall's canvas by their words, and the privacy guard.
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { touchInput } from "./touch.mjs";
import { log, Fail } from "./log.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIGIN = "https://cardchaser.app";
export const VIEW = { width: 390, height: 844 };
export const DPR = 3;
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
// Coaching overlays the app shows a first-time visitor (the rooms tip and its glow). Hidden for filming only.
const FILM_CSS = "#maptip{display:none!important}#rooms.tipglow{animation:none!important;box-shadow:none!important}";
// A control that brings in the rest of a set's cards (custom sets load in two stages). Tapped before a scene starts.
export const LOAD_REST = /^(show|load|see|bring in|get)\s+(all|the rest|every|more|[\d,]+\s+more)\b/i;

// The only account changes the app may send while filming: the ones it sends by itself, with no tap behind them (its
// own list, SYNC_AUTO in wall/src/data/live/00-boot-queue.js: the day's value, the Dex's missing list, set opens).
const SAFE_OPS = new Set(["valueSnap", "dexMissing", "trophy", "trophyRemove", "setOpen", "milestone"]);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A pause after a tap: 400 to 700 ms, never the same twice in a row. */
export const beat = () => sleep(400 + Math.round(Math.random() * 300));

export async function openSession({ rehearse = null, email = "", password = "" } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEW, screen: VIEW, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, userAgent: IPHONE_UA,
    locale: "en-US", timezoneId: "America/Los_Angeles", colorScheme: "light", reducedMotion: "no-preference",
  });
  if (rehearse) await rehearse.install(context);
  // Sign in through the API, so the address is never typed into the page and never on screen. The token goes in the
  // session's storage before the app's scripts run, as the iPhone app's web view puts it there.
  let token = "u1.test.sig";
  if (!rehearse) {
    if (!email || !password) throw new Fail("DEMO_EMAIL and DEMO_PASSWORD must be set.");
    const r = await context.request.post(`${ORIGIN}/api/auth/login`, { data: { email, password }, headers: { "content-type": "application/json" } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok() || !body.token) throw new Fail(`Sign-in failed (HTTP ${r.status()}${body.error ? `: ${String(body.error).slice(0, 120)}` : ""}). Check DEMO_EMAIL and DEMO_PASSWORD.`);
    token = body.token;
    log("Signed in to the demo account");
  }
  // Read-only: the recorder never changes the demo account. A save the app sends is let through only when every
  // change in it is the app's own automatic bookkeeping (SAFE_OPS); anything else is refused and fails the run.
  const writes = { blocked: [] };
  await context.route(/\/api\/state(\?|$)/, async (route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.fallback();
    let ops = [];
    try { ops = JSON.parse(req.postData() || "{}").ops || []; } catch { /* unreadable */ }
    const bad = ops.filter((o) => !SAFE_OPS.has(o?.type));
    if (!bad.length && ops.length) return route.fallback();
    writes.blocked.push(...(bad.length ? bad : [{ type: "unreadable" }]).map((o) => o.type));
    return route.abort("blockedbyclient");
  });
  await context.addInitScript(([t]) => { try { if (!sessionStorage.getItem("__ccSeeded")) { sessionStorage.setItem("__ccSeeded", "1"); localStorage.setItem("cc-session", t); } } catch { /* storage off */ } }, [token]);
  await context.addInitScript({ path: path.join(HERE, "probe.js") });
  await context.addInitScript({ path: path.join(HERE, "ripple.js") });
  await context.addInitScript(([css]) => { const put = () => { const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); }; if (document.head) put(); else addEventListener("DOMContentLoaded", put); }, [FILM_CSS]);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const S = new Session(browser, context, page, email);
  S.writes = writes;
  S.touch = await touchInput(page);
  return S;
}

export class Session {
  constructor(browser, context, page, email) {
    this.browser = browser; this.context = context; this.page = page;
    this.email = String(email || "").trim().toLowerCase();
    this.inflight = new Map(); this.lastNet = Date.now();
    this.errors = [];
    this.feed = [];
    this.clipOn = false; this.violation = null;
    const done = (r) => { if (this.inflight.delete(r)) this.lastNet = Date.now(); };
    page.on("request", (r) => { if (!/^(data|blob):/.test(r.url())) { this.inflight.set(r, Date.now()); this.lastNet = Date.now(); } });
    page.on("requestfinished", done); page.on("requestfailed", done);
    page.on("pageerror", (e) => this.errors.push(e.message));
    // Find's deals, as the app is sent them: used to pick a missing card that has an offer.
    page.on("response", async (r) => { if (/\/api\/feed(\?|$)/.test(r.url()) && r.ok()) { try { const j = await r.json(); if (Array.isArray(j.listings)) this.feed = j.listings; } catch { /* not JSON */ } } });
  }
  get T() { return this.touch; }

  /** Requests still open, not counting ones open for over 15 s (a long poll is not loading). */
  netBusy() { const now = Date.now(); for (const t of this.inflight.values()) if (now - t < 15000) return true; return false; }

  /** Opens the app at an address (never the rooms map: under automation it starts in Collection). */
  async open(hash) {
    // A fresh load every time (a new hash alone would be a same-page move, carrying whatever the last scene left open).
    if (this.page.url().startsWith(ORIGIN)) await this.page.goto("about:blank");
    await this.page.goto(`${ORIGIN}/${hash}`, { waitUntil: "domcontentloaded" });
    await this.page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 45000 }).catch(() => { throw new Fail(`The app didn't finish loading at /${hash}`); });
  }

  /** The text the Wall drew on its canvas in its last frame, each once. */
  async labels() {
    const L = await this.page.evaluate(() => (window.__ccText ? window.__ccText() : []));
    const seen = new Set();
    return L.filter((e) => { const k = `${e.t}|${Math.round(e.x)}|${Math.round(e.y)}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  async label(re, { inView = true } = {}) {
    const L = await this.labels();
    return L.find((e) => re.test(e.t) && (!inView || (e.y > 70 && e.y < VIEW.height - 40))) || null;
  }

  /** A tap on an element's middle, with the ripple, then a human pause. */
  async tapEl(selector, { pause = true } = {}) {
    const loc = typeof selector === "string" ? this.page.locator(selector).first() : selector;
    await loc.waitFor({ state: "visible", timeout: 15000 }).catch(() => { throw new Fail(`Missing on screen: ${selector}`); });
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) throw new Fail(`No box for ${selector}`);
    await this.T.tap(b.x + b.width / 2, b.y + b.height / 2);
    if (pause) await beat();
  }
  async tapAt(x, y, { pause = true } = {}) { await this.T.tap(x, y); if (pause) await beat(); }
  /** A slow scroll of what's under (x, y): a finger dragging up by dy (down the page) over ms. */
  async scroll(dy, { x = VIEW.width / 2, y = VIEW.height * 0.72, ms = 1100 } = {}) {
    const y1 = Math.max(90, y - dy);
    await this.T.drag(x, y, x, y1, ms);
    await sleep(350);
  }

  /** Scrolls the wall until a panel titled by `re` is in view; returns its label. */
  async findOnWall(re, { maxScrolls = 14 } = {}) {
    for (let dir of [1, -1]) {
      for (let i = 0; i <= maxScrolls; i++) {
        const l = await this.label(re);
        if (l && l.y > 110 && l.y < VIEW.height - 200) return l;
        await this.T.drag(VIEW.width / 2, dir > 0 ? 700 : 250, VIEW.width / 2, dir > 0 ? 300 : 650, 500);
        await sleep(450);
      }
    }
    throw new Fail(`Couldn't find "${re.source}" on the wall`);
  }

  /** A hash of what's on screen now (small and fast: for "has it stopped changing"). */
  async look() {
    const buf = await this.page.screenshot({ type: "jpeg", quality: 40, scale: "css", animations: "allow", caret: "hide" });
    return createHash("sha1").update(buf).digest("hex");
  }

  /**
   * Waits until the screen is finished: nothing loading on the network, any "load the rest" control tapped, fonts and
   * pictures in, and the screen unchanged for `quiet` ms. Throws (and the run fails) after `timeout`.
   */
  async settled(label, { timeout = 30000, quiet = 1000, loadRest = false } = {}) {
    const t0 = Date.now();
    let same = 0, prev = "", tappedRest = 0;
    while (Date.now() - t0 < timeout) {
      if (loadRest && tappedRest < 3) {
        const hit = await this.restControl();
        if (hit) { log(`${label}: tapping "${hit.t}" to load the rest`); await this.T.tap(hit.x, hit.y); tappedRest++; same = 0; await sleep(600); continue; }
      }
      const ready = await this.page.evaluate(() => document.fonts.status === "loaded" && [...document.images].every((i) => { const r = i.getBoundingClientRect(); return i.complete || r.bottom < 0 || r.top > innerHeight || !r.width; })).catch(() => false);
      const net = this.netBusy() || Date.now() - this.lastNet < 400;
      const h = await this.look();
      same = h === prev && ready && !net ? same + 1 : 0;
      prev = h;
      if (same * 250 >= quiet) { log(`${label}: loaded and settled (${((Date.now() - t0) / 1000).toFixed(1)}s to settle)`); return; }
      await sleep(250);
    }
    throw new Fail(`${label}: still loading or moving after ${timeout / 1000}s`);
  }
  /** A visible "Show all" / "Load the rest" style control, in the page or drawn on the canvas. */
  async restControl() {
    const src = LOAD_REST.source, flags = LOAD_REST.flags;
    const dom = await this.page.evaluate(([src, flags]) => {
      const re = new RegExp(src, flags);
      for (const b of document.querySelectorAll("button, [role=button], a")) {
        const t = (b.textContent || "").trim().replace(/\s+/g, " "), r = b.getBoundingClientRect();
        if (re.test(t) && r.width && r.bottom > 0 && r.top < innerHeight && getComputedStyle(b).visibility !== "hidden" && !b.closest("[hidden],[inert],#srp,#filter-menu")) return { t, x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    }, [src, flags]);
    if (dom) return dom;
    const c = (await this.labels()).find((e) => LOAD_REST.test(e.t) && e.y > 70 && e.y < VIEW.height);
    return c ? { t: c.t, x: c.x + c.w / 2, y: c.y - c.h / 3 } : null;
  }

  /**
   * The privacy guard, run every 300 ms for the whole run: the demo account's email anywhere on screen fails the run;
   * while a clip is being kept, so do the rooms map (the home screen, whose Trade tile names other collectors) and the
   * Trade room.
   */
  startGuard() {
    const check = async () => {
      if (this.stopped) return;
      try {
        const r = await this.page.evaluate((email) => {
          const text = (document.body?.innerText || "") + " " + [...document.querySelectorAll("input,textarea")].map((i) => i.value).join(" ") + " " + (window.__ccText ? window.__ccText().map((e) => e.t).join(" ") : "");
          const map = Boolean(document.getElementById("rooms-nav") && !document.getElementById("rooms-nav").hidden) || document.body.hasAttribute("data-step");
          const trade = Boolean(document.getElementById("pg-people") && !document.getElementById("pg-people").hidden);
          return { email: Boolean(email) && text.toLowerCase().includes(email), map, trade };
        }, this.email);
        if (r.email) this.violation ||= "The demo account's email appeared on screen";
        if (this.clipOn && r.map) this.violation ||= "The home screen (the rooms map) was on screen during a scene";
        if (this.clipOn && r.trade) this.violation ||= "The Trade room (other collectors) was on screen during a scene";
      } catch { /* a navigation in between */ }
      if (!this.stopped) this.guardT = setTimeout(check, 300);
    };
    check();
  }
  assertClean() {
    if (this.violation) throw new Fail(this.violation);
    if (this.writes?.blocked.length) throw new Fail(`The app tried to change the demo account (${[...new Set(this.writes.blocked)].join(", ")}); refused`);
  }

  async failShot(file) { try { await this.page.screenshot({ path: file, scale: "device" }); return file; } catch { return null; } }
  async close() { this.stopped = true; clearTimeout(this.guardT); await this.browser.close().catch(() => {}); }
}
