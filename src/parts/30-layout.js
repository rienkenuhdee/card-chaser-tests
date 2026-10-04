// ---------- layout ----------
// Two layouts for the same cards. The mosaic: every group a panel, the panels tiling the screen, each packed with its
// cards. The binder: one group at a time, ten across (fewer when cards are bigger), read top to bottom.
const TW = 63, TH = 88, GAP = 10, COLS = 10, HEAD = 176;
const stepX = (g) => (TW + GAP) * g.sz, stepY = (g) => (TH + GAP) * g.sz;
function binderLayout(g) {
  // As many across as stay readable: five on a phone, up to ten on a wide screen; bigger cards, fewer across.
  const base = clamp(Math.floor((vw - 24) / 74), 4, COLS);
  g.cols = Math.max(1, Math.floor(base / g.sz));
  g.x = 0; g.y = 0;
  g.w = g.cols * stepX(g) - GAP * g.sz;
  // The title block is a fixed height on screen, whatever the card size: 132px at the framed zoom.
  g.head = 132 / ((vw - 24) / g.w);
  g.h = g.head + Math.ceil(g.cards.length / g.cols) * stepY(g) - GAP * g.sz;
  g.cards.forEach((c, k) => { c.sz = g.sz; c.col = k % g.cols; c.row = Math.floor(k / g.cols); c.x = c.col * stepX(g); c.y = g.head + c.row * stepY(g); });
}
let vw = innerWidth, vh = innerHeight;
const topPad = () => 70, botPad = () => (document.body.classList.contains("timing") ? 160 : 72);
const LABEL = 40, PG = 6;
// Ordered strip treemap: groups keep their order (oldest set first), rows fill the width, the rows fill the height.
// The mosaic scrolls when it needs to: every card gets at least a small tile, so a big collection grows downward
// rather than shrinking to dust. A collection that fits, fits the screen exactly.
let mScroll = 0, mMax = 0;
function mosaicLayout() {
  const fitH = vh - topPad() - botPad();
  const R = { x: 8, y: topPad(), w: vw - 16, h: Math.max(fitH, (cards.length * 340) / (vw - 16)) };
  mMax = Math.max(0, R.y + R.h + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  // Panel area follows card count, or, laid out by value, what the cards in the band are worth.
  const items = groups.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  const total = items.reduce((a, i) => a + i.v, 0);
  const k = (R.w * R.h) / total;
  const worst = (strip) => { const area = strip.reduce((a, s) => a + s.v * k, 0), h = area / R.w; return Math.max(...strip.map((s) => { const w = (s.v * k) / h; return Math.max(w / h, h / w); })); };
  let y = R.y, i = 0;
  while (i < items.length) {
    let strip = [items[i]], best = worst(strip), j = i + 1;
    while (j < items.length) { const cand = [...strip, items[j]], w = worst(cand); if (w <= best) { strip = cand; best = w; j++; } else break; }
    const area = strip.reduce((a, s) => a + s.v * k, 0), h = area / R.w;
    let x = R.x;
    for (const s of strip) { const w = (s.v * k / area) * R.w; s.g.m = { x, y, w, h }; x += w; }
    y += h; i = j;
  }
  // Pack each group's cards into its panel as big as they'll go.
  for (const g of groups) {
    const m = g.m, inner = { x: m.x + PG + 6, y: m.y + PG + LABEL, w: m.w - PG * 2 - 12, h: m.h - PG * 2 - LABEL - 6 };
    const n = g.cards.length;
    let best = { t: 0, cols: 1, rows: n };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const t = Math.min(inner.w / cols, (inner.h / rows) * (TW / TH));
      if (t > best.t) best = { t, cols, rows };
    }
    const cw = best.t, ch = cw * TH / TW, tw = cw * 0.86, th = ch - (cw - tw) * TH / TW;
    const gw = best.cols * cw, gh = best.rows * ch;
    const ox = inner.x + (inner.w - gw) / 2, oy = inner.y + Math.max(0, (inner.h - gh) / 2) * 0.5;
    g.cards.forEach((c, k) => { c.m = { x: ox + (k % best.cols) * cw, y: oy + Math.floor(k / best.cols) * ch, w: tw, h: th }; });
  }
}
function layoutAll() { groups.forEach(binderLayout); mosaicLayout(); }

// ---------- camera (inside a set) ----------
const cam = { x: 0, y: 0, s: 1 };
const fitCam = (g) => { const s = (vw - 24) / g.w; return { s, x: -12 / s, y: -(topPad() + 6) / s }; };
const maxS = () => Math.min(vw * 0.86 / TW, (vh - 120) / TH);
const toWorld = (sx, sy) => ({ x: cam.x + sx / cam.s, y: cam.y + sy / cam.s });
function clampCam(g) {
  if (!g) return;
  const left = -12 / cam.s, right = g.w + 12 / cam.s - vw / cam.s;
  cam.x = right < left ? (left + right) / 2 : clamp(cam.x, left, right);
  const top = -(topPad() + 6) / cam.s, bottom = g.h + (botPad() + 20) / cam.s - vh / cam.s;
  cam.y = bottom < top ? top : clamp(cam.y, top, bottom);
}
let fly = null;
function flyTo(t, dur = 560) {
  if (reduced) { Object.assign(cam, t); fly = null; kick(); return; }
  fly = { a: { ...cam }, b: t, t0: performance.now(), dur };
  kick();
}
function stepFly(now) {
  if (!fly) return false;
  const p = clamp((now - fly.t0) / fly.dur, 0, 1);
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const s = Math.exp(Math.log(fly.a.s) + (Math.log(fly.b.s) - Math.log(fly.a.s)) * e);
  const ca = { x: fly.a.x + vw / 2 / fly.a.s, y: fly.a.y + vh / 2 / fly.a.s }, cb = { x: fly.b.x + vw / 2 / fly.b.s, y: fly.b.y + vh / 2 / fly.b.s };
  cam.s = s; cam.x = ca.x + (cb.x - ca.x) * e - vw / 2 / s; cam.y = ca.y + (cb.y - ca.y) * e - vh / 2 / s;
  if (p >= 1) { Object.assign(cam, fly.b); fly = null; }
  return true;
}
