// Injected before the app's scripts: records where the Wall draws each piece of text on its main canvas (the canvas
// has no DOM to select), so the recorder can find a set's panel or a card's name by its words. Read-only: it wraps
// fillText and calls the original. Text is grouped by animation frame (the Wall draws a whole frame in one
// requestAnimationFrame callback). window.__ccText(): the text of the last frame that drew any, [{ t, x, y, w, h }].
(() => {
  const P = CanvasRenderingContext2D.prototype, orig = P.fillText;
  let tick = 0, frame = [], frameTick = -1, last = [];
  const loop = () => { tick++; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  P.fillText = function (text, x, y, maxW) {
    try {
      const cv = this.canvas;
      if (cv && cv.id === "wall") {
        if (frameTick !== tick) { if (frame.length) last = frame; frame = []; frameTick = tick; }
        const m = this.getTransform(), dpr = cv.width / (cv.clientWidth || cv.width) || 1;
        const w = this.measureText(String(text)).width;
        const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] || "12");
        const align = this.textAlign;
        const x0 = align === "center" ? x - w / 2 : align === "right" || align === "end" ? x - w : x;
        frame.push({ t: String(text), x: (m.a * x0 + m.c * y + m.e) / dpr, y: (m.b * x0 + m.d * y + m.f) / dpr, w: (w * m.a) / dpr, h: (size * m.d) / dpr });
      }
    } catch { /* never in the app's way */ }
    return orig.apply(this, arguments);
  };
  // The frame in progress counts once its tick has passed; until then, the one before it.
  window.__ccText = () => (frameTick !== tick && frame.length ? frame : last).slice();
})();
