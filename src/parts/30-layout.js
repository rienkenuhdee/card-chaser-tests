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
function stripTreemap(items, R, tidy = false) {
  const total = items.reduce((a, i) => a + i.v, 0);
  const k = (R.w * R.h) / total;
  const worst = (strip) => { const area = strip.reduce((a, s) => a + s.v * k, 0), h = area / R.w; return Math.max(...strip.map((s) => { const w = (s.v * k) / h; return Math.max(w / h, h / w); })); };
  const strips = [];
  let i = 0;
  while (i < items.length) {
    let strip = [items[i]], best = worst(strip), j = i + 1;
    while (j < items.length) { const cand = [...strip, items[j]], w = worst(cand); if (w <= best) { strip = cand; best = w; j++; } else break; }
    strips.push(strip); i = j;
  }
  // A last panel left alone in a wide, short strip joins the row above, so its tiles stay readable.
  if (tidy && strips.length > 1) { const last = strips[strips.length - 1]; if (worst(last) > 3.5) { strips.pop(); strips[strips.length - 1].push(...last); } }
  let y = R.y;
  for (const strip of strips) {
    const area = strip.reduce((a, s) => a + s.v * k, 0), h = area / R.w;
    let x = R.x;
    for (const s of strip) { const w = (s.v * k / area) * R.w; s.g.m = { x, y, w, h }; x += w; }
    y += h;
  }
}
const innerOf = (m) => ({ x: m.x + PG + 6, y: m.y + PG + LABEL, w: m.w - PG * 2 - 12, h: m.h - PG * 2 - LABEL - 6 });
// Pack a group's cards into its panel as big as they'll go: a uniform grid.
function packPanel(g) {
  const inner = innerOf(g.m), n = g.cards.length;
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

// ---------- deals lead ----------
// With the Deals lens on, the layout changes as well as the colour (round 7): every live deal flies to the top left
// of its panel and grows with its discount, the rest of the set packs in around it, and a panel with nothing on offer
// folds to one line below the live ones. Any other lens flies everything home.
let lifted = false; // whether the current layout is the deals-first one
let shuffle = null; // the in-set reorder flight when the lens changes inside a binder: { g, t0, dur, end }
const FOLD = 54; // height of a folded panel ("Base Set   No deals")
const isDeal = (c) => !c.owned && Boolean(c.deal);
const discount = (c) => clamp(1 - c.deal / c.price, 0, 1);
const liftSize = (c) => 5 + Math.round(clamp((discount(c) - 0.15) / 0.3, 0, 1) * 3); // 5 to 8 cells across
// Deals first, best discount first; the rest keep the arrangement's own order.
function orderGroup(g) {
  g.base ||= g.cards;
  const deals = lifted ? g.base.filter(isDeal).sort((a, b) => discount(b) - discount(a) || a.i - b.i) : [];
  g.deals = deals;
  g.cards = deals.length ? [...deals, ...g.base.filter((c) => !isDeal(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of deals) c.lift = liftSize(c);
}
// Deal tiles take a square of cells each, first fit from the top left; the rest fill in around them.
function placeCells(cols, deals, rest) {
  const occ = [], row = (r) => occ[r] || (occ[r] = new Uint8Array(cols));
  let rows = 0;
  for (const d of deals) {
    const s = Math.min(d.lift, cols);
    for (let r = 0, done = false; !done; r++) for (let c = 0; c + s <= cols && !done; c++) {
      let ok = true;
      for (let i = 0; i < s && ok; i++) { const R = row(r + i); for (let j = 0; j < s; j++) if (R[c + j]) { ok = false; break; } }
      if (!ok) continue;
      for (let i = 0; i < s; i++) { const R = row(r + i); for (let j = 0; j < s; j++) R[c + j] = 1; }
      d.cr = r; d.cc = c; d.cs = s; rows = Math.max(rows, r + s); done = true;
    }
  }
  let r = 0, c = 0;
  for (const x of rest) {
    while (row(r)[c]) { if (++c >= cols) { c = 0; r++; } }
    row(r)[c] = 1; x.cr = r; x.cc = c; x.cs = 1; rows = Math.max(rows, r + 1);
    if (++c >= cols) { c = 0; r++; }
  }
  return Math.max(1, rows);
}
function packLifted(g) {
  const inner = innerOf(g.m), deals = g.deals, rest = g.cards.slice(deals.length);
  let best = { t: 0, cols: 1 };
  const maxCols = clamp(Math.floor(inner.w / 5), 1, 72);
  for (let cols = 1; cols <= maxCols; cols++) {
    const rows = placeCells(cols, deals, rest);
    const t = Math.min(inner.w / cols, (inner.h / rows) * (TW / TH));
    if (t > best.t) best = { t, cols };
  }
  const rows = placeCells(best.cols, deals, rest);
  const cw = best.t, ch = cw * TH / TW, gx = cw * 0.14, gy = gx * TH / TW;
  const gh = rows * ch;
  const ox = inner.x, oy = inner.y + Math.max(0, (inner.h - gh) / 2) * 0.5; // left-aligned: the deals sit in the corner
  for (const c of g.cards) c.m = { x: ox + c.cc * cw, y: oy + c.cr * ch, w: c.cs * cw - gx, h: c.cs * ch - gy };
}
// A folded panel keeps its cards as a hairline under the title, so opening it still grows them into the binder.
function packFolded(g) {
  const m = g.m, x = m.x + PG + 10, w = m.w - PG * 2 - 20, n = g.cards.length;
  g.cards.forEach((c, k) => { c.m = { x: x + (w * k) / n, y: m.y + PG + 30, w: Math.max(0.5, w / n), h: 2 }; });
}
function mosaicLayout() {
  const fitH = vh - topPad() - botPad();
  if (!lifted) {
    const R = { x: 8, y: topPad(), w: vw - 16, h: Math.max(fitH, (cards.length * 340) / (vw - 16)) };
    mMax = Math.max(0, R.y + R.h + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    // Panel area follows card count, or, laid out by value, what the cards in the band are worth.
    const items = groups.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    stripTreemap(items, R);
    for (const g of groups) packPanel(g);
    return;
  }
  // Deals lead: panel area follows how many cells it needs (every deal is a square of them), with a floor so a panel
  // with one deal still shows it at a readable size. Panels without a deal fold to a line below the live ones.
  const live = groups.filter((g) => g.deals.length), folded = groups.filter((g) => !g.deals.length);
  for (const g of live) g.v = g.cards.length - g.deals.length + g.deals.reduce((t, c) => t + c.lift * c.lift, 0);
  const floor = Math.max(40, live.reduce((t, g) => t + g.v, 0) * 0.1);
  for (const g of live) g.v = Math.max(g.v, floor);
  const total = live.reduce((t, g) => t + g.v, 0);
  const liveH = Math.max(fitH - folded.length * FOLD, (total * 230) / (vw - 16));
  const R = { x: 8, y: topPad(), w: vw - 16, h: liveH + folded.length * FOLD };
  mMax = Math.max(0, R.y + R.h + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  if (live.length) stripTreemap(live.map((g) => ({ g, v: g.v })), { x: R.x, y: R.y, w: R.w, h: liveH }, true);
  let y = R.y + (live.length ? liveH : 0);
  for (const g of folded) { g.m = { x: R.x, y, w: R.w, h: FOLD }; y += FOLD; }
  for (const g of groups) if (g.deals.length) packLifted(g); else packFolded(g);
}
function layoutAll() { lifted = state.lens === "deals"; for (const g of groups) orderGroup(g); groups.forEach(binderLayout); mosaicLayout(); }

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
