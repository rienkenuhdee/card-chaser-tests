// ---------- layout ----------
// Two layouts for the same cards. The mosaic: every group a panel, the panels tiling the screen, each packed with its
// cards. The binder: one group at a time, ten across (fewer when cards are bigger), read top to bottom.
const TW = 63, TH = 88, GAP = 10, COLS = 10, HEAD = 176;
const stepX = (g) => (tight(g) ? TW : TW + GAP) * g.sz, stepY = (g) => (tight(g) ? TH : TH + GAP) * g.sz; // a sealed album packs edge to edge
function binderLayout(g) {
  // As many across as stay readable: five on a phone, up to ten on a wide screen; bigger cards, fewer across.
  const base = clamp(Math.floor(frameW() / 74), 4, COLS);
  g.cols = Math.max(1, Math.floor(base / g.sz));
  g.x = 0; g.y = 0;
  g.w = g.cols * stepX(g) - (tight(g) ? 0 : GAP * g.sz);
  // The title block is a fixed height on screen, whatever the card size: 132px at the framed zoom (less on a phone on
  // its side, where height is what's short).
  if (g.set) popLayout(g); else if (g.natdex) dexLayout(g); else { g.popChips = null; g.popH = g.chase ? 30 : 0; g.hdrBtn = g.chase ? { x: frameW() - 118, y: 2, w: 118, h: 22 } : null; g.hdrBtn2 = null; } // a chase's header: a row with Remove chase
  albumHeader(g); // a finished group's header: Back to the wall, or Put on the shelf
  g.head = (headH() + (g.popH || 0)) / (frameW() / g.w); // the title block, plus the People chase row in a set
  g.h = g.head + Math.ceil(g.cards.length / g.cols) * stepY(g) - (tight(g) ? 0 : GAP * g.sz);
  g.cards.forEach((c, k) => { c.sz = g.sz; c.col = k % g.cols; c.row = Math.floor(k / g.cols); c.x = c.col * stepX(g); c.y = g.head + c.row * stepY(g); });
}
let vw = innerWidth, vh = innerHeight;
// A phone on its side (round 22): a short, wide screen. The chrome shares one row along the top (the strip, then the
// lens bar at its right), so the views below get the height; sheets that rise from the bottom in portrait stand at
// the right instead, beside what they're about. The same test is the stylesheet's
// @media (orientation: landscape) and (max-height: 559px).
const landPhone = () => vw > vh && vh < 560;
// The safe area (the notch and the home indicator), measured from a probe the stylesheet places at its edges. Left
// and right come from --sal and --sar (env(safe-area-inset-left/right), which the tests can stand in for).
const SAFE = { top: 0, bottom: 0, left: 0, right: 0 };
const safeProbe = document.createElement("div"); safeProbe.id = "safe-probe"; safeProbe.setAttribute("aria-hidden", "true"); document.body.append(safeProbe);
function readSafe() {
  const r = safeProbe.getBoundingClientRect();
  SAFE.top = Math.max(0, r.top || 0); SAFE.bottom = Math.max(0, vh - (r.bottom || vh));
  SAFE.left = Math.max(0, r.left || 0); SAFE.right = Math.max(0, vw - (r.right || vw));
}
const frameW = () => vw - 24 - SAFE.left - SAFE.right; // a framed binder's width on screen, clear of the notch
const headH = () => (landPhone() ? 100 : 132); // a binder's title block at the framed zoom
const topPad = () => (landPhone() ? SAFE.top + 62 : 70);
const botPad = () => { const b = document.body.classList; return landPhone() ? SAFE.bottom + (b.contains("timing") ? 104 : b.contains("marking") ? 74 : 18) : b.contains("timing") ? 160 : 72; };
const LABEL = 40, PG = 6;
// Ordered strip treemap: groups keep their order (oldest set first), rows fill the width, the rows fill the height.
// The mosaic scrolls when it needs to: every card gets at least a small tile, so a big collection grows downward
// rather than shrinking to dust. A collection that fits, fits the screen exactly.
let mScroll = 0, mMax = 0;
function stripTreemap(items, R) {
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

const W_FOLD = 50, NEW_H = 56;
let newPanel = null; // the New chase panel at the end of the wall, in mosaic coordinates
const wallW = (g) => g.weight || g.cards.length; // a panel's share of the wall: its cards (the Dex's empty pockets count for less)
function mosaicLayout() {
  const R0 = { x: 8 + SAFE.left, y: topPad(), w: vw - 16 - SAFE.left - SAFE.right }, top = R0.y + shelfLayout(R0); // the shelf first: trophies finished today
  const live = groups.filter((g) => !g.done);
  const newH = mode === "set" && !picking() ? NEW_H : 0;
  newPanel = null;
  const fitH = vh - top - botPad() - newH;
  // The sets you collect share the screen; the others fold to a line beneath (picked in the welcome, or in Settings).
  if (mode === "set" && pickedSets.size && pickedSets.size < sets.length) {
    const mine = live.filter((g) => g.chase || pickedSets.has(g.set.id)), rest = live.filter((g) => g.set && !pickedSets.has(g.set.id));
    const n = mine.reduce((a, g) => a + wallW(g), 0);
    const R = { x: R0.x, y: top, w: R0.w, h: mine.length ? Math.max(fitH - rest.length * W_FOLD, fitH * 0.62, (n * 340) / R0.w) : 0 };
    const items = mine.map((g) => ({ g, v: Math.max(wallW(g), 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    if (items.length) stripTreemap(items, R);
    let y = R.y + R.h;
    for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
    if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
    y += caseLayout(R0, y); // the trophies past their day: in the Medal room, a place of no size here
    mMax = Math.max(0, y + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    for (const g of mine) packPanel(g);
    for (const g of rest) packFolded(g);
    return;
  }
  const n = live.reduce((a, g) => a + wallW(g), 0);
  const R = { x: R0.x, y: top, w: R0.w, h: live.length ? Math.max(fitH, (n * 340) / R0.w) : 0 };
  let y = R.y + R.h;
  if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
  y += caseLayout(R0, y);
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  // Panel area follows card count, or, laid out by value, what the cards in the band are worth.
  const items = live.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(wallW(g), 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  if (items.length) stripTreemap(items, R);
  for (const g of live) packPanel(g);
}
// ---------- chase lead ----------
// With the Chase lens on the layout changes as well as the colour (rounds 7 and 9): every panel with something to
// chase goes full width, the chased cards sit in it as feed tiles (two across on a phone), live deals first, and the
// rest of the set packs in small below them. A panel with nothing to chase folds to one line. Any other lens flies it
// all home.
let lifted = false; // whether the current layout is the chase-first one
let shuffle = null; // the in-set reorder flight when the lens changes inside a binder: { g, t0, dur, end }
const FOLD = 54, TILE_GAP = 8, REST = 15;
const feedCols = (w) => clamp(Math.floor((w + TILE_GAP) / (150 + TILE_GAP)), 2, 4);
// Chased cards first (live deals, best discount first, then the most you'd pay); the rest keep the arrangement's order.
const chaseOrder = (a, b) => (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || (a.deal && b.deal ? b.price / b.deal - a.price / a.deal : 0) || b.price - a.price || a.i - b.i;
let liftKey = null; // which lens the current lift is for
function orderGroup(g) {
  g.base ||= g.cards;
  const lead = lifted ? g.base.filter(isChase).sort(chaseOrder) : [];
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !isChase(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}
// The height a lifted panel needs: its tiles, then its other cards as small cells.
function liftedH(g, w) {
  const inner = w - PG * 2 - 12, cols = feedCols(inner), tw = (inner - TILE_GAP * (cols - 1)) / cols, th = Math.round(tw * 0.64);
  const rows = Math.ceil(g.lead.length / cols), rest = g.cards.length - g.lead.length;
  const rc = Math.max(1, Math.floor(inner / REST)), rr = Math.ceil(rest / rc);
  return PG + LABEL + rows * (th + TILE_GAP) + (rest ? 6 + rr * (REST * TH / TW) : 0) + PG + 6;
}
function packLifted(g) {
  const inner = innerOf(g.m), cols = feedCols(inner.w), tw = (inner.w - TILE_GAP * (cols - 1)) / cols, th = Math.round(tw * 0.64);
  const n = g.lead.length, rows = Math.ceil(n / cols);
  g.cards.forEach((c, k) => {
    if (k < n) { c.m = { x: inner.x + (k % cols) * (tw + TILE_GAP), y: inner.y + Math.floor(k / cols) * (th + TILE_GAP), w: tw, h: th }; return; }
    const j = k - n, rc = Math.max(1, Math.floor(inner.w / REST)), cw = inner.w / rc, ch = REST * TH / TW;
    c.m = { x: inner.x + (j % rc) * cw, y: inner.y + rows * (th + TILE_GAP) + 6 + Math.floor(j / rc) * ch, w: cw * 0.86, h: ch - cw * 0.14 * TH / TW };
  });
}
// A folded panel keeps its cards as a hairline under the title, so opening it still grows them into the binder.
function packFolded(g) {
  const m = g.m, x = m.x + PG + 10, w = m.w - PG * 2 - 20, n = g.cards.length;
  g.cards.forEach((c, k) => { c.m = { x: x + (w * k) / n, y: m.y + PG + 30, w: Math.max(0.5, w / n), h: 2 }; });
}
function liftedLayout() {
  const R = { x: 8 + SAFE.left, y: topPad(), w: vw - 16 - SAFE.left - SAFE.right };
  let y = R.y + shelfLayout(R);
  const live = groups.filter((g) => !g.done && g.lead.length), folded = groups.filter((g) => !g.done && !g.lead.length);
  // On a wide screen two live panels sit side by side; on a phone they stack.
  const across = R.w >= 900 ? 2 : 1, pw = R.w / across;
  for (let i = 0; i < live.length; i += across) {
    const row = live.slice(i, i + across), h = Math.max(...row.map((g) => liftedH(g, pw)));
    row.forEach((g, j) => { g.m = { x: R.x + j * pw, y, w: pw, h }; });
    y += h;
  }
  for (const g of folded) { g.m = { x: R.x, y, w: R.w, h: FOLD }; y += FOLD; }
  y += caseLayout(R, y);
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  for (const g of groups) { if (g.done) continue; if (g.lead.length) packLifted(g); else packFolded(g); }
}
let wallVer = 0; // bumps whenever the wall takes a new shape (the map's picture of it is drawn again)
function layoutAll() {
  wallVer++;
  lifted = state.lens === "chase"; liftKey = lifted ? state.lens : null;
  for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); }
  groups.forEach(binderLayout);
  const keep = mScroll;
  if (lifted) { newPanel = null; liftedLayout(); } else mosaicLayout();
  if (room.on) { if (room.fan && !inCase(room.fan)) room.fan = null; mScroll = keep; roomLayout(); } // the Medal room opens empty too: it says how a trophy comes
  if (bnd.on) { bnd.L = tbGeom(bnd.show); bnd.vi = clamp(bnd.vi, 0, tbViews() - 1); } // the binder fits the new screen
}

// ---------- camera (inside a set) ----------
const cam = { x: 0, y: 0, s: 1 };
const fitCam = (g) => { const s = frameW() / g.w; return { s, x: -(12 + SAFE.left) / s, y: -(topPad() + 6) / s }; };
const maxS = () => Math.min(vw * 0.86 / TW, (vh - 120) / TH);
const toWorld = (sx, sy) => ({ x: cam.x + sx / cam.s, y: cam.y + sy / cam.s });
function clampCam(g) {
  if (!g || state.focus) return; // a card up close is composed by focusCam, not by the binder's edges
  const left = -(12 + SAFE.left) / cam.s, right = g.w + (12 + SAFE.right) / cam.s - vw / cam.s;
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
