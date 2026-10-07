// Starts a headless Chrome for the tests. Uses the full `puppeteer` package (npm install) and falls back to
// puppeteer-core with @sparticuz/chromium where that's what's available.
// The canvas is forced onto the software path: headless GPU emulation is slow and crash-prone, and the software path
// matches what the tests measure (logic and frame budget), not a particular GPU.
const EXTRA = ["--no-sandbox", "--disable-accelerated-2d-canvas", "--disable-gpu-compositing"];
export async function launch() {
  try {
    const { default: puppeteer } = await import("puppeteer");
    return await puppeteer.launch({ headless: true, args: EXTRA });
  } catch (e) {
    if (e.code !== "ERR_MODULE_NOT_FOUND") throw e;
    const { default: pc } = await import("puppeteer-core");
    const { default: chromium } = await import("@sparticuz/chromium");
    return pc.launch({ args: [...chromium.args, ...EXTRA], executablePath: await chromium.executablePath(), headless: "shell" });
  }
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A phone-sized page on a debug build, offline (Google Fonts are skipped; the fallback font is fine for tests). */
export async function phone(browser, file, { dark = false, motion = true, dpr = 1, width = 390, height = 844 } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: width < 700, hasTouch: true });
  await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: motion ? "no-preference" : "reduce" }, { name: "prefers-color-scheme", value: dark ? "dark" : "light" }]);
  await p.setRequestInterception(true);
  p.on("request", (r) => (r.url().startsWith("file:") ? r.continue() : r.abort()));
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`file://${file}`);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await wait(motion ? 3200 : 800);
  return p;
}

/** Touch simulation inside the page: one event every 16ms, like a phone, so speed-based snapping behaves as it does on a device. */
export async function installTouch(p) {
  await p.evaluate(() => {
    const cv = document.querySelector("canvas");
    const T = (id, x, y) => new Touch({ identifier: id, target: cv, clientX: x, clientY: y });
    const fire = (type, touches, changed) => cv.dispatchEvent(new TouchEvent(type, { touches, changedTouches: changed, cancelable: true, bubbles: true }));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__pinch = async (cx, cy, d0, d1, ms, hold = 0) => {
      const n = Math.max(3, Math.round(ms / 16)); let pts = [T(0, cx - d0 / 2, cy), T(1, cx + d0 / 2, cy)];
      fire("touchstart", pts, pts);
      for (let i = 1; i <= n; i++) { const d = d0 + (d1 - d0) * i / n; pts = [T(0, cx - d / 2, cy), T(1, cx + d / 2, cy)]; fire("touchmove", pts, pts); await sleep(16); }
      if (hold) await sleep(hold);
      fire("touchend", [], pts);
    };
    window.__drag = async (x, y0, y1, ms, dx = 0) => {
      const n = Math.max(3, Math.round(ms / 16)); let pts = [T(0, x, y0)]; fire("touchstart", pts, pts);
      for (let i = 1; i <= n; i++) { pts = [T(0, x + dx * i / n, y0 + (y1 - y0) * i / n)]; fire("touchmove", pts, pts); await sleep(16); }
      fire("touchend", [], pts);
    };
    window.__tap = (x, y) => { const pts = [T(0, x, y)]; fire("touchstart", pts, pts); fire("touchend", [], pts); };
    window.__ghost = (x, y) => { const pts = [T(5, x, y)]; fire("touchstart", pts, pts); fire("touchcancel", [], pts); };
    // On a page (Feed, Trade, Source), the touch goes to whatever is under the finger, as on a phone.
    const PT = (el, id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    const pfire = (el, type, touches, changed) => el.dispatchEvent(new TouchEvent(type, { touches, changedTouches: changed, cancelable: true, bubbles: true }));
    window.__pdrag = async (x, y0, y1, ms, dx = 0) => {
      const el = document.elementFromPoint(x, y0), n = Math.max(3, Math.round(ms / 16)); let pts = [PT(el, 0, x, y0)]; pfire(el, "touchstart", pts, pts);
      for (let i = 1; i <= n; i++) { pts = [PT(el, 0, x + dx * i / n, y0 + (y1 - y0) * i / n)]; pfire(el, "touchmove", pts, pts); await sleep(16); }
      pfire(el, "touchend", [], pts);
    };
    window.__ppinch = async (cx, cy, d0, d1, ms, hold = 0) => {
      const el = document.elementFromPoint(cx, cy), n = Math.max(3, Math.round(ms / 16)); let pts = [PT(el, 0, cx - d0 / 2, cy), PT(el, 1, cx + d0 / 2, cy)];
      pfire(el, "touchstart", pts, pts);
      for (let i = 1; i <= n; i++) { const d = d0 + (d1 - d0) * i / n; pts = [PT(el, 0, cx - d / 2, cy), PT(el, 1, cx + d / 2, cy)]; pfire(el, "touchmove", pts, pts); await sleep(16); }
      if (hold) await sleep(hold);
      pfire(el, "touchend", [], pts);
    };
  });
  return {
    pinch: (...a) => p.evaluate((a) => __pinch(...a), a),
    drag: (...a) => p.evaluate((a) => __drag(...a), a),
    tap: (x, y) => p.evaluate((a) => __tap(...a), [x, y]),
    ghost: (x, y) => p.evaluate((a) => __ghost(...a), [x, y]),
    pageDrag: (...a) => p.evaluate((a) => __pdrag(...a), a),
    pagePinch: (...a) => p.evaluate((a) => __ppinch(...a), a),
  };
}

export function report(results, label = "") {
  let bad = 0;
  for (const [name, ok] of results) { console.log(`${ok ? "PASS" : "FAIL"} ${label}${name}`); if (!ok) bad++; }
  return bad;
}
