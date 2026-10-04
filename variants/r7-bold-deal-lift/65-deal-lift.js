// ---------- deal lift: the Deals lens changes the layout, not just the colour ----------
// With the Deals lens on, every deal card (not owned, with a live copy) flies to the top left of its panel and grows
// with the discount: the further under market, the bigger the tile. The rest of the set packs in around them, dimmed.
// A panel with nothing on offer folds to one line. Inside an open set the deals lead. Any other lens flies it all home.
let lifted = state.lens === "deals";
let shuffle = null; // the in-set reorder flight: { g, t0, dur, end }
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
function layoutAll() { for (const g of groups) orderGroup(g); groups.forEach(binderLayout); mosaicLayout(); }

// The base strip treemap, pulled out so the lifted mosaic can run it on a run of panels at a time.
// (tidy: a last panel left alone in a wide, short strip joins the row above, so its deal tiles stay readable.)
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
// The base packing: a uniform grid, as big as it goes.
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
// Lifted packing: deal tiles take a square of cells each, first fit from the top left; the rest fill in around them.
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
    const items = groups.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    stripTreemap(items, R);
    for (const g of groups) packPanel(g);
    return;
  }
  // Lifted: panel area follows how many cells it needs (every deal is a square of them), with a floor so a panel with
  // one deal still shows it at a readable size. Panels without a deal fold to a line and drop below the live ones.
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

// Panels travel too: during a lens flight each panel slides and resizes from where it was to where it's going.
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m);
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    const k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)), a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.globalAlpha = alpha * labelAlpha;
  const x = m.x + PG + 10, w = m.w - PG * 2 - 20;
  const size = clamp(m.w * 0.075, 12, 17);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(800, size, true);
  const stat = panelStat(g);
  font(600, size * 0.82); const sw = stat ? ctx.measureText(stat).width + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw), x, m.y + PG + 22);
  if (stat) { ctx.textAlign = "right"; font(600, size * 0.82); ctx.fillStyle = state.lens === "deals" && /^\d/.test(stat) ? theme.deal : theme.muted; ctx.fillText(stat, x + w, m.y + PG + 22); }
  const owned = ownedNow(g.cards), n = g.cards.length;
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  ctx.globalAlpha = 1;
}

// A lifted deal tile: the asking price leads, how far under market it is, and the card's name.
let tintKey = "", tintVal = "";
function dealTint() { const k = theme.slot + theme.deal; if (k !== tintKey) { tintKey = k; tintVal = mix(theme.slot, theme.deal, theme.dark ? 0.16 : 0.09); } return tintVal; }
function emptyPocket(c, sx, sy, w, h, value) {
  const r = w * 0.045;
  const dealOn = c.deal && state.lens !== "need" && state.lens !== "time";
  if (lifted && c.lift && dealOn && !value) {
    rr(sx, sy, w, h, r); ctx.fillStyle = dealTint(); ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.014); ctx.strokeStyle = theme.deal;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke();
    if (w < 30) return;
    const pad = w * 0.08, pct = Math.round(discount(c) * 100);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.deal;
    font(800, w * 0.16); ctx.fillText(short(c.deal), sx + pad, sy + pad + w * 0.14);
    if (pct > 0) { ctx.fillStyle = theme.muted; font(500, w * 0.072); ctx.fillText(`was ${short(c.price)}`, sx + pad, sy + pad + w * 0.23); }
    ctx.textAlign = "right"; ctx.fillStyle = theme.deal;
    font(800, w * 0.22); ctx.fillText(pct > 0 ? `${pct}%` : "live", sx + w - pad, sy + h * 0.62);
    ctx.fillStyle = theme.muted; font(600, w * 0.07); ctx.fillText(pct > 0 ? "under market" : "right now", sx + w - pad, sy + h * 0.62 + w * 0.085);
    ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
    font(700, w * 0.095, true); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - w * 0.08);
    ctx.fillStyle = theme.muted; font(500, w * 0.064); ctx.fillText(`${sets[c.si].code} ${c.num}/${sets[c.si].printed}`, sx + pad, sy + h - pad);
    return;
  }
  rr(sx, sy, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.strokeStyle = value ? heat(c.price) : dealOn ? theme.deal : theme["slot-line"];
  rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke();
  if (w < 44) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
  if (dealOn) { ctx.fillStyle = theme.deal; font(700, w * 0.085); ctx.fillText(short(c.deal), sx + w - pad, sy + pad + w * 0.07); font(500, w * 0.06); ctx.fillText("live", sx + w - pad, sy + pad + w * 0.15); }
  else { ctx.fillStyle = value ? heat(c.price) : theme.muted; font(600, w * 0.08); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, w * 0.088, true); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - w * 0.075);
  font(500, w * 0.064); ctx.fillText(`${sets[c.si].code} ${c.num}/${sets[c.si].printed}`, sx + pad, sy + h - pad);
}

// Inside a set: while the deals move to the front, every card travels from its old slot to its new one.
function drawSet(g, now, C = cam, ox = 0, alpha = 1) {
  drawHeader(g, now, C, ox, alpha);
  if (shuffle && shuffle.g === g) {
    for (const c of g.cards) {
      if (c === state.focus) continue;
      const k = ease(clamp((now - shuffle.t0 - c.delay) / shuffle.dur, 0, 1));
      const x = c.px + (c.x - c.px) * k, y = c.py + (c.y - c.py) * k;
      const r = { x: (x - C.x) * C.s + ox, y: (y - C.y) * C.s, w: TW * c.sz * C.s, h: TH * c.sz * C.s };
      if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
      drawTile(c, r.x, r.y, r.w, r.h, now, alpha);
    }
    return;
  }
  const y0 = C.y, y1 = C.y + vh / C.s;
  const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
  for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
    const c = g.cards[k];
    if (c === state.focus) continue;
    const r = binderRect(c, C, ox);
    if (r.x > vw || r.x + r.w < 0) continue;
    drawTile(c, r.x, r.y, r.w, r.h, now, alpha);
  }
}
// The frame keeps running while the in-set flight plays (this is the per-frame "is anything moving" hook).
function stepInertia(dt) {
  let moving = false;
  if (shuffle) { if (performance.now() >= shuffle.end) shuffle = null; else moving = true; }
  if (!inertia || state.trans) return moving;
  if (view === "mosaic") {
    mScroll = clamp(mScroll - vel.y * dt, 0, mMax);
    vel.y *= Math.pow(0.95, dt / 16);
    if (Math.abs(vel.y) < 0.02 || mScroll <= 0 || mScroll >= mMax) inertia = false;
    return true;
  }
  cam.x -= vel.x * dt / cam.s; cam.y -= vel.y * dt / cam.s;
  const k = Math.pow(0.94, dt / 16);
  vel.x *= k; vel.y *= k;
  if (Math.hypot(vel.x, vel.y) < 0.02) inertia = false;
  return true;
}

// Switching the lens: if the layout changes, everything flies rather than cuts.
function liftLayout() {
  const want = state.lens === "deals";
  if (want === lifted) { layoutAll(); return; }
  const T = state.trans;
  if (T && !(T.anim || T.t0)) { lifted = want; layoutAll(); return; } // fingers are holding a transition: relayout under it
  if (T) finishTransition();
  lifted = want;
  const now = performance.now();
  if (view === "set" && state.g) {
    const g = state.g;
    if (state.focus) unfocus();
    for (const c of g.cards) { c.px = c.x; c.py = c.y; }
    layoutAll();
    if (!reduced) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.4); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
    tick(8); kick(); return;
  }
  for (const c of cards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  // Deals leave first, so the eye follows them to the front; the rest trail in a beat behind.
  for (const c of cards) c.delay = reduced ? 0 : Math.min(400, (c.lift ? 0 : 90) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
lensBox.querySelectorAll("button").forEach((b) => (b.onclick = () => {
  if (b.getAttribute("aria-pressed") === "true") return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  state.lens = b.dataset.lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", state.lens); } catch { /* fine */ }
  if (state.lens === "deals") { const n = cards.filter(isDeal).length; toast(n ? `${n} live deals, out in front` : "No live deals right now"); }
  if (state.lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  if (state.lens === "value") { const v = cards.reduce((a, c) => a + (c.owned ? c.price : 0), 0); toast(`Your collection: about ${money(v)}`); }
  document.body.classList.toggle("timing", state.lens === "time");
  liftLayout(); drawList();
  if (state.lens === "time") { drawSpark(); playTime(true); } else { stopTime(); state.t = Date.now(); }
  updateCount(); kick();
}));
