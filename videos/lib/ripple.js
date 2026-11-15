// Injected before the app's scripts: a tap mark at every tap, so a viewer sees each tap: a brand-yellow dot
// that swells and fades inside a black ring that opens out. Drawn in a layer that takes no events
// (pointer-events: none), so the app never sees it.
(() => {
  const css = "position:fixed;border-radius:50%;pointer-events:none;z-index:2147483647;will-change:transform,opacity;";
  const mark = (x, y) => {
    const dot = document.createElement("div"), ring = document.createElement("div");
    for (const d of [dot, ring]) d.setAttribute("aria-hidden", "true");
    dot.style.cssText = css + `left:${x - 22}px;top:${y - 22}px;width:44px;height:44px;background:rgba(242,195,0,.55);transform:scale(.4);opacity:1;transition:transform 380ms cubic-bezier(.2,.8,.2,1),opacity 520ms ease-out 180ms`;
    ring.style.cssText = css + `left:${x - 30}px;top:${y - 30}px;width:60px;height:60px;border:4px solid #121212;box-shadow:0 0 0 3px rgba(255,255,255,.85);transform:scale(.5);opacity:.95;transition:transform 620ms cubic-bezier(.15,.75,.25,1),opacity 620ms ease-out 80ms`;
    document.documentElement.append(dot, ring);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      dot.style.transform = "scale(1.15)"; dot.style.opacity = "0";
      ring.style.transform = "scale(1.6)"; ring.style.opacity = "0";
    }));
    setTimeout(() => { dot.remove(); ring.remove(); }, 900);
  };
  // Taps only: a finger that lifts within 10 px of where it came down (a scroll gets no mark).
  const down = new Map();
  addEventListener("touchstart", (e) => { for (const t of e.changedTouches) down.set(t.identifier, [t.clientX, t.clientY]); }, { capture: true, passive: true });
  addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) {
      const d = down.get(t.identifier); down.delete(t.identifier);
      if (d && Math.hypot(t.clientX - d[0], t.clientY - d[1]) < 10) mark(d[0], d[1]);
    }
  }, { capture: true, passive: true });
})();
