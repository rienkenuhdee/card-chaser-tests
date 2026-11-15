// Injected before the app's scripts: records what the Wall draws on its main canvas (it has no DOM to select): each
// piece of text with where it is, so the recorder can find a set's panel or a card by its words, and each picture's
// box, so it can tell a card drawn with no picture (one the catalog has none for) and keep it off camera. Read-only:
// it wraps fillText and drawImage and calls the originals. Grouped by animation frame (the Wall draws a whole frame in
// one requestAnimationFrame callback).
//   window.__ccText(): the last frame's text, [{ t, x, y, w, h }]; window.__ccPics(): its pictures, [{ x, y, w, h }].
(() => {
  const C = CanvasRenderingContext2D.prototype, fillText = C.fillText, drawImage = C.drawImage;
  let tick = 0, at = -1, text = [], pics = [], lastText = [], lastPics = [];
  const loop = () => { tick++; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const begin = () => { if (at !== tick) { if (text.length || pics.length) { lastText = text; lastPics = pics; } text = []; pics = []; at = tick; } };
  const where = (ctx) => ({ m: ctx.getTransform(), d: ctx.canvas.width / (ctx.canvas.clientWidth || ctx.canvas.width) || 1 });
  C.fillText = function (t, x, y) {
    try {
      if (this.canvas?.id === "wall") {
        begin();
        const { m, d } = where(this), w = this.measureText(String(t)).width, size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] || "12");
        const x0 = this.textAlign === "center" ? x - w / 2 : this.textAlign === "right" || this.textAlign === "end" ? x - w : x;
        text.push({ t: String(t), x: (m.a * x0 + m.c * y + m.e) / d, y: (m.b * x0 + m.d * y + m.f) / d, w: (w * m.a) / d, h: (size * m.d) / d });
      }
    } catch { /* never in the app's way */ }
    return fillText.apply(this, arguments);
  };
  C.drawImage = function (img, ...a) {
    try {
      if (this.canvas?.id === "wall") {
        begin();
        const [dx, dy, dw, dh] = a.length >= 8 ? a.slice(4, 8) : a.length >= 4 ? a : [a[0], a[1], img.width, img.height];
        const { m, d } = where(this), w = (m.a * dw) / d, h = (m.d * dh) / d;
        if (w > 24 && h > 24) pics.push({ x: (m.a * dx + m.c * dy + m.e) / d, y: (m.b * dx + m.d * dy + m.f) / d, w, h });
      }
    } catch { /* never in the app's way */ }
    return drawImage.call(this, img, ...a);
  };
  const cur = () => at !== tick && (text.length || pics.length);
  window.__ccText = () => (cur() ? text : lastText).slice();
  window.__ccPics = () => (cur() ? pics : lastPics).slice();
})();
