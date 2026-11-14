// Real touch input through the Chrome DevTools Protocol: the Wall reads Touch Events (not pointer events), so taps
// and drags go in as touchStart / touchMove / touchEnd, the way a finger's do.
// A drag moves at once: the Wall takes a finger held still for 450 ms as a long press (it picks the set up to move it,
// and that would change the demo account's order), and a finger that moves 8 px first as a scroll. So the first move
// is a 14 px step right away, and the rest eases out, timed by the clock so a slow page doesn't stretch it.
export async function touchInput(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), radiusX: 11, radiusY: 11, force: 1, id: 0 })) });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const easeOut = (t) => 1 - Math.pow(1 - t, 2.2);
  return {
    cdp,
    /** A tap: down, a short hold, up. */
    async tap(x, y, hold = 70) { await send("touchStart", [[x, y]]); await sleep(hold); await send("touchEnd", []); },
    /** A drag from (x0,y0) to (x1,y1) over about ms, then still for a moment before lifting so it doesn't fling. */
    async drag(x0, y0, x1, y1, ms = 900) {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len, kick = Math.min(14, len);
      await send("touchStart", [[x0, y0]]);
      await send("touchMove", [[x0 + ux * kick, y0 + uy * kick]]);
      const t0 = Date.now();
      for (;;) {
        await sleep(16);
        const t = Math.min(1, (Date.now() - t0) / ms), d = kick + (len - kick) * easeOut(t);
        await send("touchMove", [[x0 + ux * d, y0 + uy * d]]);
        if (t >= 1) break;
      }
      await sleep(140);
      await send("touchEnd", []);
    },
  };
}
