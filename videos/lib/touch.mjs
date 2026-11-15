// Real touch input through the Chrome DevTools Protocol: the Wall reads Touch Events (not pointer events), so taps
// and drags go in as touchStart / touchMove / touchEnd, the way a finger's do.
// A drag moves at once: the Wall takes a finger held still for 450 ms as a long press (it picks the set up to move it,
// and that would change the demo account's order), and a finger that moves 8 px first as a scroll. So the finger is
// past 8 px within 90 ms, and the rest eases in and out, timed by the clock so a slow page doesn't stretch it.
export async function touchInput(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), radiusX: 11, radiusY: 11, force: 1, id: 0 })) });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const easeOut = (t) => 1 - Math.pow(1 - t, 2.2);
  return {
    cdp,
    /** A tap: down, a short hold, up. */
    async tap(x, y, hold = 70) { await send("touchStart", [[x, y]]); await sleep(hold); await send("touchEnd", []); },
    /**
     * A drag from (x0,y0) to (x1,y1) over about ms: a gentle start that still clears the 8 px scroll threshold within
     * 90 ms (so it's never read as a long press), a quick rise to speed, then a long slowing, and a still moment before the
     * finger lifts so nothing flings. Timed by the clock, so a busy page can't stretch it.
     */
    async drag(x0, y0, x1, y1, ms = 900) {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len, kick = Math.min(12, len);
      // Speed rises over the first 12% and falls over the last 40%: a finger's flick, not a slow creep.
      const ease = (p) => { const a = 0.12, b = 0.4, v = 1 / (1 - a / 2 - b / 2); return p < a ? (v * p * p) / (2 * a) : p < 1 - b ? v * (p - a / 2) : 1 - (v * (1 - p) * (1 - p)) / (2 * b); };
      const at = (t) => { const k = kick * Math.min(1, t / 90); return Math.max(k, kick + (len - kick) * ease(Math.min(1, t / ms))); };
      await send("touchStart", [[x0, y0]]);
      const t0 = Date.now();
      for (;;) {
        await sleep(12);
        const t = Date.now() - t0, d = Math.min(len, at(t));
        await send("touchMove", [[x0 + ux * d, y0 + uy * d]]);
        if (t >= ms) break;
      }
      await sleep(160);
      await send("touchEnd", []);
    },
  };
}
