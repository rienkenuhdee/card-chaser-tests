// ---------- trophies: finished things leave the wall ----------
// The wall only holds unfinished work. When the last card of a set or a chase lands, the panel is minted: its tiles
// gather into a gold plaque that flies up onto a shelf along the top of the mosaic, and the rest of the wall flows
// into the space. The shelf shows in every lens, and only when something is finished. Tapping a plaque opens its
// sealed album (the cards packed tight, the header reading when it was finished and what it is worth) with Back to
// the wall, which puts the panel back among the others. Before the finish, every panel's title carries a ring gauge:
// owned over total, gold when something in it is chased. The finished state lives in localStorage wall-done, per
// group key: { at, put }. A set is keyed with its view (set, master set, grand set), so the master set is its own trophy.

let done = {};
try { done = JSON.parse(localStorage.getItem("wall-done") || "{}") || {}; } catch { done = {}; }
const persistDone = () => { try { localStorage.setItem("wall-done", JSON.stringify(done)); } catch { /* private mode */ } };
const doneKey = (g) => (g.set ? `${g.set.id}|${scopeOf(g.set)}` : g.key);
const finishOf = (g) => (g.set || g.chase ? done[doneKey(g)] || null : null);
const isPut = (g) => Boolean(finishOf(g)?.put);
const trophyName = (g) => { const s = g.set ? scopeOf(g.set) : "set"; return `${g.name}${s === "master" ? " master set" : s === "grand" ? " grand set" : ""}`; };

// ----- completion: computed when a card changes, never per frame -----
// Every set and chase is checked against its full card list (g.base: the set in its current view, or a chase's
// twins). Newly complete: a trophy, put on the shelf. No longer complete (a card taken out, a trade): the trophy is
// gone and the panel comes back. A finished group you chose to keep on the wall stays there (put: false).
let doneDirty = false; // a trade changes several cards with quietLayout on: one check at the end
function syncDone({ quiet = false } = {}) {
  const list = mode === "set" ? groups : [...(setGroups || []), ...chaseGroups.values()];
  const minted = [], freed = [];
  for (const g of list) {
    if (!g.set && !g.chase || !g.base) continue;
    const key = doneKey(g), n = g.base.length, full = n > 0 && ownedIn(g.base) === n, e = done[key];
    if (full && !e) { done[key] = { at: Date.now(), put: true }; minted.push(g); }
    else if (!full && e) { delete done[key]; if (e.put) freed.push(g); }
  }
  if (!minted.length && !freed.length) return null;
  persistDone();
  applyDone(minted, freed, quiet);
  return { minted, freed };
}
function applyDone(minted, freed, quiet) {
  if (mode !== "set") { layoutAll(); kick(); return; }
  const held = state.trans && !(state.trans.anim || state.trans.t0); // fingers are holding a transition
  const still = quiet || held || document.body.classList.contains("listmode") || tbl.on || wel.on;
  if (view === "set" && state.g) {
    // Inside a binder: the album seals (or loosens) in place; the mosaic underneath takes its new shape.
    if (minted.includes(state.g) || freed.includes(state.g)) sealInPlace(state.g); else { layoutAll(); kick(); }
    return;
  }
  if (still || view !== "mosaic") { layoutAll(); kick(); return; }
  if (state.trans) finishTransition();
  if (minted.length === 1 && !freed.length && !reduced) { mintFlight(minted[0]); return; }
  for (const g of freed) g.unmint = true;
  shelfMorph(minted[0] || null);
}
// The binder you are in just finished (or came undone): its cards slide tight (or apart), the header changes.
function sealInPlace(g) {
  const now = performance.now();
  for (const c of g.cards) { c.px = c.x; c.py = c.y; }
  layoutAll(); clampCam(g);
  if (state.focus) focus(state.focus); // the card up close keeps its place on screen
  else if (!reduced && !state.trans) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.2); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
  if (finishOf(g)) g.burst = now;
  kick();
}

// ----- the minting flight -----
// Two beats. First the panel's tiles gather into a plaque shape where the panel is and it turns gold; then the plaque
// flies up onto the shelf, the wall scrolls to the top to meet it, and the other panels flow into the space.
function mintFlight(g) {
  const now = performance.now();
  for (const c of drawnCards) { c.pm = { ...c.m }; c.delay = 0; }
  for (const x of groups) { x.pm = { ...x.m }; x.ripple = null; x.burst = 0; }
  const R = { x: 8, w: vw - 16 }, n = groups.filter((x) => x.done).length + 1, cols = Math.min(n, R.w >= 700 ? 4 : 2);
  const m = g.m, pw = Math.min(m.w, R.w / cols);
  g.minting = true; g.plq = plaqueInfo(g);
  g.m = { x: m.x + (m.w - pw) / 2, y: m.y + (m.h - PLQ_H) / 2, w: pw, h: PLQ_H };
  packPlaque(g);
  for (const c of g.cards) c.delay = Math.min(200, c.k * 1.5);
  state.trans = { kind: "morph", t0: now, dur: 1000, done: () => { g.minting = false; shelfMorph(g); } };
  tick(10); kick();
}
// Every tile and panel travels to its place in the new wall. landing: the plaque on its way up; the wall scrolls to
// the top under the flight so it can be seen arriving.
function shelfMorph(landing = null) {
  const now = performance.now();
  const dy = landing && !gesture ? mScroll : 0;
  for (const c of drawnCards) c.pm = { x: c.m.x, y: c.m.y - dy, w: c.m.w, h: c.m.h };
  for (const x of groups) { x.pm = { x: x.m.x, y: x.m.y - dy, w: x.m.w, h: x.m.h }; x.ripple = null; x.burst = 0; }
  if (dy) mScroll = 0;
  layoutAll();
  for (const c of drawnCards) c.delay = reduced ? 0 : Math.min(400, (groups[c.g] === landing ? 0 : 120) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : 1300, done: () => { for (const x of groups) { x.pm = null; x.unmint = false; } if (landing && !reduced) landing.gleam = performance.now(); kick(); } };
  tick(10); kick();
}

// ----- the shelf: plaques along the top of the mosaic, in mosaic coordinates, reserving height in every layout -----
const PLQ_H = 72; // a plaque row, margins included (the plate is 60)
let shelf = null; // { y, h, rows, cols }
const plateOf = (m) => ({ x: m.x + PG, y: m.y + PG, w: m.w - PG * 2, h: m.h - PG * 2 });
function shelfLayout(R) {
  const dn = groups.filter((g) => g.done).sort((a, b) => (finishOf(b)?.at || 0) - (finishOf(a)?.at || 0)); // newest first
  if (!dn.length) { shelf = null; syncShelfPad(); return 0; }
  const cols = Math.min(dn.length, R.w >= 700 ? 4 : 2), rows = Math.ceil(dn.length / cols);
  dn.forEach((g, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, dn.length - row * cols), cw = R.w / inRow; // a short last row shares the width
    g.m = { x: R.x + (i % cols) * cw, y: R.y + row * PLQ_H, w: cw, h: PLQ_H }; packPlaque(g); g.plq = plaqueInfo(g);
  });
  shelf = { y: R.y, h: rows * PLQ_H + 2, rows, cols };
  syncShelfPad();
  return shelf.h;
}
// The toast and the deal bar live where the shelf is: while it shows, they sit just under it.
function syncShelfPad() { document.body.style.setProperty("--shelf-h", view === "mosaic" && shelf && mode === "set" ? `${shelf.h}px` : "0px"); }
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on;
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : "";
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); updateCount();
}
// The engraving: the group's cards packed tight as a strip of colour along the bottom of the plate. The tiles live
// there (so opening the plaque grows them into the album, and the minting flight lands them there).
const ENGR_H = 10;
function packPlaque(g) {
  const p = plateOf(g.m), n = g.base.length, ew = p.w - 20, cw = Math.min(ew / n, ENGR_H * TW / TH), ex = p.x + 10, ey = p.y + p.h - 18;
  g.base.forEach((c, i) => { c.m = { x: ex + i * cw, y: ey, w: cw, h: ENGR_H }; });
}
const plaqueInfo = (g) => { const f = finishOf(g), worth = worthOf(g.base); return { title: trophyName(g), line: `Finished ${dayOf(f?.at || Date.now())} · ${short(worth)}`, worth }; };
// The strip of colour, drawn once per plaque size and kept.
function engravingOf(g, w, h) {
  const key = `${g.base.length}|${Math.round(w)}|${Math.round(h)}|${dpr}`;
  if (g.engr?.key === key) return g.engr.img;
  const cv = document.createElement("canvas"); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  const x = cv.getContext("2d"); x.scale(dpr, dpr);
  const n = g.base.length, cw = Math.min(w / n, h * TW / TH);
  g.base.forEach((c, i) => { x.fillStyle = typeColor(c); x.fillRect(i * cw, 0, cw, h); });
  g.engr = { key, img: cv };
  return cv;
}
function drawPlaque(g, m, now, alpha, labelAlpha) {
  const p = plateOf(m);
  ctx.globalAlpha = alpha;
  if (!g.minting && !g.unmint) { ctx.fillStyle = theme["slot-line"]; rr(m.x, p.y + p.h + 2, m.w, 3, 1.5); ctx.fill(); } // the board it sits on
  rr(p.x, p.y, p.w, p.h, 8); ctx.fillStyle = theme.plaque; ctx.fill();
  ctx.save(); rr(p.x, p.y, p.w, p.h, 8); ctx.clip();
  ctx.fillStyle = theme["plaque-hi"]; ctx.fillRect(p.x, p.y, p.w, 1.5);
  ctx.fillStyle = theme["plaque-lo"]; ctx.fillRect(p.x, p.y + p.h - 1.5, p.w, 1.5);
  if (g.gleam) { // a gleam crosses the plaque as it lands
    const t = (now - g.gleam) / 1200;
    if (t >= 1) g.gleam = 0;
    else {
      const fx = p.x - p.w + t * p.w * 3, gr = ctx.createLinearGradient(fx, p.y, fx + p.w * 0.6, p.y + p.h);
      gr.addColorStop(0, "rgb(255 255 255 / 0)"); gr.addColorStop(0.5, "rgb(255 250 225 / .6)"); gr.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.fillStyle = gr; ctx.fillRect(p.x, p.y, p.w, p.h); kick();
    }
  }
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["plaque-lo"]; rr(p.x + 4.5, p.y + 4.5, p.w - 9, p.h - 9, 5); ctx.stroke();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; rr(p.x, p.y, p.w, p.h, 8); ctx.stroke(); }
  if (labelAlpha < 0.01 || p.w < 60 || p.h < 40) { ctx.globalAlpha = 1; return; }
  const x = p.x + 10, w = p.w - 20, info = g.plq || (g.plq = plaqueInfo(g));
  ctx.globalAlpha = alpha * labelAlpha;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["plaque-ink"];
  font(800, 15, true); ctx.fillText(fitText(info.title, w), x, p.y + 21);
  ctx.globalAlpha = alpha * labelAlpha * 0.78; font(600, 11); ctx.fillText(fitText(info.line, w), x, p.y + 36);
  ctx.globalAlpha = alpha * labelAlpha;
  const n = g.base.length, sw = Math.min(w, n * ENGR_H * TW / TH), ey = p.y + p.h - 18;
  ctx.fillStyle = "rgb(0 0 0 / .22)"; ctx.fillRect(x - 1, ey - 1, sw + 2, ENGR_H + 2);
  ctx.drawImage(engravingOf(g, w, ENGR_H), x, ey, w, ENGR_H);
  ctx.globalAlpha = 1;
}

// ----- layout: the shelf first, then the wall below it (redefined from 30-layout; done groups go on the shelf) -----
function layoutAll() {
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); }
  groups.forEach(binderLayout);
  if (lifted) { newPanel = null; liftedLayout(); } else mosaicLayout();
}
function mosaicLayout() {
  const R0 = { x: 8, y: topPad(), w: vw - 16 }, top = R0.y + shelfLayout(R0);
  const live = groups.filter((g) => !g.done);
  const newH = mode === "set" && !picking() ? NEW_H : 0;
  newPanel = null;
  const fitH = vh - top - botPad() - newH;
  if (mode === "set" && pickedSets.size && pickedSets.size < sets.length) {
    const mine = live.filter((g) => g.chase || pickedSets.has(g.set.id)), rest = live.filter((g) => g.set && !pickedSets.has(g.set.id));
    const n = mine.reduce((a, g) => a + g.cards.length, 0);
    const R = { x: R0.x, y: top, w: R0.w, h: mine.length ? Math.max(fitH - rest.length * W_FOLD, fitH * 0.62, (n * 340) / (vw - 16)) : 0 };
    const items = mine.map((g) => ({ g, v: Math.max(g.cards.length, 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    if (items.length) stripTreemap(items, R);
    let y = R.y + R.h;
    for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
    if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
    mMax = Math.max(0, y + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    for (const g of mine) packPanel(g);
    for (const g of rest) packFolded(g);
    return;
  }
  const n = live.reduce((a, g) => a + g.cards.length, 0);
  const R = { x: R0.x, y: top, w: R0.w, h: live.length ? Math.max(fitH, (n * 340) / (vw - 16)) : 0 };
  if (newH) newPanel = { x: R.x, y: R.y + R.h, w: R.w, h: newH };
  mMax = Math.max(0, R.y + R.h + newH + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  const items = live.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  if (items.length) stripTreemap(items, R);
  for (const g of live) packPanel(g);
}
function liftedLayout() {
  const R = { x: 8, y: topPad(), w: vw - 16 };
  let y = R.y + shelfLayout(R);
  const live = groups.filter((g) => !g.done && g.lead.length), folded = groups.filter((g) => !g.done && !g.lead.length);
  if (state.lens === "trade") y += stripLayout({ x: R.x, y, w: R.w }); else strip = null; // the traders along the top
  const across = R.w >= 900 ? 2 : 1, pw = R.w / across;
  for (let i = 0; i < live.length; i += across) {
    const row = live.slice(i, i + across), h = Math.max(...row.map((g) => liftedH(g, pw)));
    row.forEach((g, j) => { g.m = { x: R.x + j * pw, y, w: pw, h }; });
    y += h;
  }
  for (const g of folded) { g.m = { x: R.x, y, w: R.w, h: FOLD }; y += FOLD; }
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  for (const g of groups) { if (g.done) continue; if (g.lead.length) packLifted(g); else packFolded(g); }
}

// ----- the sealed album: a finished group's binder packs its cards edge to edge -----
const tight = (g) => Boolean(g.done || g.tight);
const stepXg = (g) => (tight(g) ? TW : TW + GAP) * g.sz, stepYg = (g) => (tight(g) ? TH : TH + GAP) * g.sz;
function binderLayout(g) {
  const base = clamp(Math.floor((vw - 24) / 74), 4, COLS);
  g.cols = Math.max(1, Math.floor(base / g.sz));
  g.x = 0; g.y = 0;
  g.w = g.cols * stepXg(g) - (tight(g) ? 0 : GAP * g.sz);
  if (g.set) popLayout(g); else { g.popChips = null; g.popH = g.chase ? 30 : 0; g.hdrBtn = g.chase ? { x: vw - 24 - 118, y: 2, w: 118, h: 22 } : null; g.hdrBtn2 = null; }
  albumHeader(g);
  g.head = (132 + (g.popH || 0)) / ((vw - 24) / g.w);
  g.h = g.head + Math.ceil(g.cards.length / g.cols) * stepYg(g) - (tight(g) ? 0 : GAP * g.sz);
  g.cards.forEach((c, k) => { c.sz = g.sz; c.col = k % g.cols; c.row = Math.floor(k / g.cols); c.x = c.col * stepXg(g); c.y = g.head + c.row * stepYg(g); });
}
// A finished group's header: sealed, it has one button, Back to the wall; kept on the wall, Put on the shelf joins
// the usual row (in place of Chase these on a set: there is nothing left to chase).
function albumHeader(g) {
  const f = finishOf(g); if (!f) return;
  const W = vw - 24, btn = { x: W - 128, y: 2, w: 128, h: 22, shelf: true };
  if (f.put) { g.popChips = null; g.seg = null; g.popH = 30; g.hdrBtn = btn; g.hdrBtn2 = null; }
  else if (g.set) g.hdrBtn = { ...btn, y: 4 };
  else g.hdrBtn2 = { ...btn, x: W - 118 - 8 - 128 };
}
function hit(sx, sy, nearest = false) {
  if (state.trans) return null;
  if (view === "mosaic") {
    const y = sy + mScroll;
    for (const g of groups) if (g.m && sx >= g.m.x && sx <= g.m.x + g.m.w && y >= g.m.y && y <= g.m.y + g.m.h) return { block: g };
    if (!nearest) return null;
    let best = null, bd = Infinity;
    for (const g of groups) { if (!g.m) continue; const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
    return best && bd < 60 ? { block: best } : null;
  }
  const g = state.g; if (!g) return null;
  const p = toWorld(sx, sy);
  if (p.x < g.x || p.x > g.x + g.w || p.y < g.y || p.y > g.y + g.h) return null;
  if (p.y < g.y + g.head) return { block: g };
  const col = Math.floor((p.x - g.x) / stepXg(g)), row = Math.floor((p.y - g.y - g.head) / stepYg(g));
  const inX = (p.x - g.x) - col * stepXg(g) <= TW * g.sz, inY = (p.y - g.y - g.head) - row * stepYg(g) <= TH * g.sz;
  const card = col < g.cols ? g.cards[row * g.cols + col] : null;
  return card && inX && inY ? { card, block: g } : { block: g };
}
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
  const r0 = Math.max(0, Math.floor((y0 - g.head) / stepYg(g))), r1 = Math.floor((y1 - g.head) / stepYg(g));
  for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
    const c = g.cards[k];
    if (c === state.focus) continue;
    const r = binderRect(c, C, ox);
    if (r.x > vw || r.x + r.w < 0) continue;
    drawTile(c, r.x, r.y, r.w, r.h, now, alpha);
  }
}
// The album's title block: "Finished Oct 6, worth $1,240.49." under the name, a full gold bar, and the shelf button.
function drawHeader(st, now, C = cam, ox = 0, alpha = 1) {
  const sx = (st.x - C.x) * C.s + ox, sy = (st.y - C.y) * C.s, sw = st.w * C.s;
  const k = (st.head * C.s) / (132 + (st.popH || 0)), hh = 132 * k;
  const owned = ownedNow(st.cards), n = st.cards.length, f = finishOf(st);
  ctx.globalAlpha = alpha * (state.focus ? 1 - state.dimAll * 0.7 : 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = clamp(34 * k, 16, 64), sub = clamp(14 * k, 10, 24);
  ctx.fillStyle = theme.ink; font(800, title, true);
  ctx.fillText(fitText(f ? trophyName(st) : st.name, sw), sx, sy + hh * 0.5);
  const pct = `${Math.floor((owned / n) * 100)}%`;
  font(700, sub); const pw = ctx.measureText(pct).width;
  ctx.textAlign = "right"; ctx.fillStyle = f ? theme.gold : theme.ink; ctx.fillText(pct, sx + sw, sy + hh * 0.72);
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(500, sub);
  const line = state.time ? `${owned} of ${n} by ${monthOf(state.t)}` : f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(st.base || st.cards))}.${f.put ? "" : " On the wall."}` : st.sub();
  ctx.fillText(fitText(line, sw - pw - 12), sx, sy + hh * 0.72);
  const by = sy + hh * 0.82, bh = Math.max(1.5, 3 * k);
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(sx, by, sw, bh);
  ctx.fillStyle = owned === n ? theme.gold : st.ink; ctx.fillRect(sx, by, sw * (owned / n), bh);
  if (st.popChips) drawPopRow(st, sx, sy + hh, k, ctx.globalAlpha);
  else if ((st.chase || f) && k >= 0.3) { for (const b of [st.hdrBtn, st.hdrBtn2]) if (b) drawHdrBtn(st, b, sx, sy + hh + b.y * k, k, ctx.globalAlpha); ctx.textBaseline = "alphabetic"; }
  if (st.burst) {
    const p = (now - st.burst) / 1400;
    if (p < 1) {
      const fx = sx - sw + p * sw * 3;
      const g = ctx.createLinearGradient(fx, sy, fx + sw * 0.6, sy + st.h * C.s);
      g.addColorStop(0, "rgb(255 255 255 / 0)"); g.addColorStop(0.5, "rgb(255 220 140 / .4)"); g.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.globalCompositeOperation = theme.dark ? "screen" : "multiply"; ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, st.h * C.s); ctx.globalCompositeOperation = "source-over";
    } else st.burst = 0;
  }
  ctx.globalAlpha = 1;
}
function drawHdrBtn(g, b, sx, by, k, alpha) {
  const on = b.shelf || (b.pop && Boolean(popularRule(g.set))), bx = sx + b.x * k, bw = b.w * k, bh = b.h * k;
  rr(bx, by, bw, bh, 6 * k);
  if (on) { ctx.fillStyle = theme.gold; ctx.globalAlpha = alpha * 0.18; ctx.fill(); ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  else if (b.pop) { ctx.fillStyle = theme.ink; ctx.fill(); }
  else { ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  ctx.fillStyle = on || !b.pop ? theme.ink : theme.bg; font(700, 11 * k); ctx.textAlign = "center";
  const label = b.shelf ? (finishOf(g)?.put ? "Back to the wall" : "Put on the shelf") : b.pop ? (on ? "Chasing these ✓" : "Chase these") : b.remove ? "Remove set" : "Remove chase";
  ctx.fillText(label, bx + bw / 2, by + bh * 0.68);
  ctx.textAlign = "left";
}
// Back to the wall: the album closes into a panel among the others (the binder stays packed for the flight). Put on
// the shelf: the binder closes, then the panel is minted.
function toggleShelf(g) {
  const f = finishOf(g); if (!f) return;
  tick(6);
  if (f.put) {
    f.put = false; persistDone();
    g.tight = true; layoutAll();
    const after = () => { g.tight = false; layoutAll(); kick(); };
    exitToMosaic();
    const T = state.trans;
    if (T) { const d = T.done; T.done = (x) => { d?.(x); after(); }; } else after();
    drawList();
    toast(`${trophyName(g)} is back on the wall.`, () => { if (!finishOf(g)) return; finishOf(g).put = true; persistDone(); if (view === "mosaic" && !state.trans && !reduced) mintFlight(g); else { layoutAll(); kick(); } drawList(); });
    return;
  }
  leaveBinderThen(g, () => {
    const e = finishOf(g); if (!e) return;
    e.put = true; persistDone(); drawList();
    if (view === "mosaic" && !state.trans && !reduced) mintFlight(g); else { if (view === "mosaic") mScroll = 0; layoutAll(); kick(); }
    toast(`${trophyName(g)} is on the shelf.`, () => { const x = finishOf(g); if (!x) return; x.put = false; g.unmint = true; persistDone(); if (view === "mosaic") { if (state.trans) finishTransition(); shelfMorph(); } else { layoutAll(); kick(); } drawList(); });
  });
}
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch);
    if (h?.block && lifted && !h.block.done) { // a plaque is sealed: a tap opens the album, never a tile in its engraving
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") {
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m));
    }
    if (h?.block) enterGroup(h.block);
    else if (newPanelAt(sx, sy)) { tick(4); openSheet(); }
    return;
  }
  if (!h?.card) {
    if (h?.block && !marking && !fly && !shuffle) { const p = headAt(h.block, sx, sy); if (p) { tick(4); if (p.seg) setScope(h.block.set, p.seg); else if (p.btn) { if (p.btn.shelf) toggleShelf(h.block); else if (p.btn.pop) chasePopular(h.block.set); else if (p.btn.remove) removeSet(h.block.set); else removeChase(h.block.chase); } else focus(p.c); } }
    return;
  }
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}

// ----- the panel: a plaque when finished; otherwise the usual panel with a ring gauge beside the stat -----
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m), k = 1;
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)); const a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  if (g.done || g.minting) { drawPlaque(g, m, now, alpha, labelAlpha); return; }
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  if (g.unmint && k < 1) drawPlaque(g, m, now, alpha * (1 - k), 0); // a plaque coming back to the wall fades into its panel
  ctx.globalAlpha = alpha * labelAlpha;
  const x = m.x + PG + 10, w = m.w - PG * 2 - 20;
  const size = clamp(m.w * 0.075, 12, 17);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  let beat = null;
  if (g.beat) { const p = (now - g.beat.t0) / 3000; if (p < 1) beat = { text: g.beat.text, col: g.beat.col || theme.deal, a: Math.min(1, p * 10, (1 - p) * 4) }; else g.beat = null; }
  const ring = !picking(), rw = ring ? 17 : 0; // the gauge's place at the right
  font(beat ? 700 : 600, size * 0.82);
  const stat = beat ? fitText(beat.text, w * 0.72) : panelStat(g), sw = stat ? textW(stat) + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw - rw), x, m.y + PG + 22);
  if (stat) {
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? beat.col : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, x + w - rw, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha;
  }
  const owned = ownedNow(g.cards), n = g.cards.length;
  if (ring) { // how far along: a thin arc, owned over total; gold once something in it is chased, or when it's all here
    const r = 5.5, cx = x + w - r - 1, cy = m.y + PG + 17;
    ctx.lineWidth = 2; ctx.strokeStyle = theme["slot-line"]; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (owned) { ctx.strokeStyle = owned === n || g.cards.some(isChase) ? theme.gold : g.ink; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * owned / n); ctx.stroke(); }
  }
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? theme.gold : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  ctx.globalAlpha = 1;
}
function drawPicks() {
  if (!picking()) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const g of groups) {
    if (!g.set || !g.m || g.done) continue;
    const m = mr(g.m); if (m.y > vh || m.y + m.h < 0) continue;
    const on = wel.picks.has(g.set.id), R = 10, x = m.x + m.w - PG - 10 - R, y = m.y + PG + 16;
    if (on) { ctx.lineWidth = 2; ctx.strokeStyle = g.ink; rr(m.x + PG + 1, m.y + PG + 1, m.w - PG * 2 - 2, m.h - PG * 2 - 2, 11); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    if (on) {
      ctx.fillStyle = g.ink; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = "#fff"; ctx.beginPath();
      ctx.moveTo(x - R * 0.45, y + R * 0.02); ctx.lineTo(x - R * 0.12, y + R * 0.38); ctx.lineTo(x + R * 0.48, y - R * 0.36); ctx.stroke();
    } else { ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  }
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "slot", "slot-line", "ink", "muted", "deal", "gold", "panel", "panel-solid", "paper", "paper-ink", "plaque", "plaque-ink", "plaque-hi", "plaque-lo"]) theme[k] = cs.getPropertyValue(`--${k}`).trim();
  theme.panelFill = cs.getPropertyValue("--panel-fill").trim();
  if (typeof heatCache !== "undefined") heatCache.clear();
  theme.dark = cs.colorScheme === "dark" || matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
}

// ----- where cards change hands: the check runs once per change -----
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now(), b = c.base || c;
  b.owned = on; b.got = on ? Date.now() : null; saved[b.id] = { on, at: b.got }; persist();
  for (const t of [b, ...twinsOf(b)]) { t.anim = { t0: now, to: on }; const tg = groups[t.g]; if (tg && (t === c || tg.base?.includes(t) || tg.cards.includes(t))) tg.ripple = { t0: now, col: t.col, row: t.row }; }
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  let sync = null;
  if (quietLayout) doneDirty = true; else sync = syncDone();
  if (sync?.minted.length) { tick(40); toast(finishedText(sync.minted), undo); }
  else if (sync?.freed.length) toast(`${c.name} taken out. ${sync.freed.map(trophyName).join(" and ")} ${sync.freed.length === 1 ? "is" : "are"} back on the wall.`, undo);
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  if (lifted && !quietLayout && !sync) liftLayout(true);
  updateCount(); drawList(); kick();
}
const finishedText = (gs) => (gs.length === 1 ? `${trophyName(gs[0])} finished. It's on the shelf, worth ${money(worthOf(gs[0].base))}.` : `${gs.map(trophyName).join(" and ")} finished. They're on the shelf.`);
function markAllInSet() {
  const g = state.g; if (!g || !marking) return;
  const todo = g.cards.filter((c) => !c.owned); if (!todo.length) { toast("You have all of them already."); return; }
  const now = performance.now();
  todo.forEach((c, i) => { if (!session.has(c)) session.set(c, c.owned); c.owned = true; c.got = Date.now(); saved[c.id] = { on: true, at: c.got }; if (!reduced) c.anim = { t0: now + i * 5, to: true }; });
  persist(); updateBar(); updateCount(); drawList(); tick(14);
  const sync = syncDone();
  if (lifted && !sync) liftLayout(true);
  if (view === "set") g.burst = now;
  if (sync?.minted.length) { tick(40); toast(finishedText(sync.minted)); }
  kick();
}
function finishImport(src) {
  if (!wel.on) return;
  const now = performance.now(), chaseAll = wChase.checked;
  let n = 0, k = 0;
  for (const c of pool) {
    if (c.owned || !c.own0) { if (chaseAll && !c.owned) { chasing[c.id] = true; k++; } continue; }
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; n++;
    if (!reduced) c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true };
  }
  persist(); if (chaseAll) persistChase();
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  updateCount(); drawList();
  const sync = syncDone({ quiet: true }); // anything the import completes goes straight to the shelf, under the flood
  if (lifted && !sync) liftLayout(true);
  tick(14);
  setTimeout(() => toast(`${n.toLocaleString()} cards imported from ${src}.${chaseAll ? ` ${k.toLocaleString()} on your chase list.` : ""}`), reduced ? 100 : 500);
  kick();
}
// A new chase that you already have every card of is a trophy the moment it's made: its twins fly straight to the
// shelf (the check after the reflow retargets the flight).
function chasesChanged(lit = []) {
  persistChases(); reflow(); syncDone({ quiet: true }); flashLit(lit);
  syncBadge(); refreshChips(); updateCount(); drawList(); kick();
}

// ----- the list: a Finished section, with Back to the wall -----
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}<p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
  }
  if (state.lens === "trade") top = tradeListHTML();
  const rows = (items) => `<ul>${items.map((c) => {
    const st = sets[c.si];
    return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
  }).join("")}</ul>`;
  const fin = groups.filter((g) => g.done);
  const shelfHTML = fin.length ? `<section class="lshelf"><h2>Finished</h2><p class="lsub">On the shelf, sealed. Back to the wall puts one among the others again.</p>${fin.map((g) => {
    const f = finishOf(g), items = g.cards.filter(show);
    return `<h3 class="lfin">${esc(trophyName(g))}</h3><p class="lsub lfin-line"><span>Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}.</span><button type="button" class="pill-btn" data-shelf="${esc(doneKey(g))}">Back to the wall</button></p>${items.length ? rows(items) : ""}`;
  }).join("")}</section>` : "";
  const body = groups.filter((g) => !g.done).map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}</p>${rows(items)}</section>`;
  }).join("");
  listEl.querySelector("#list-body").innerHTML = top + shelfHTML + (body || (fin.length ? "" : `<p class="lsub">Nothing here with this lens.</p>`));
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-shelf]"); if (!b) return;
  const g = groups.find((x) => x.done && doneKey(x) === b.dataset.shelf), f = g && finishOf(g); if (!f) return;
  f.put = false; persistDone(); layoutAll(); drawList(); tick(5);
  toast(`${trophyName(g)} is back on the wall.`, () => { const x = finishOf(g); if (!x) return; x.put = true; persistDone(); layoutAll(); drawList(); kick(); });
});
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases", "wall-scope", "wall-spares", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value", "wall-done"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };
// Debug builds only: the tests' hook sees the shelf.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { done: { get: () => done }, shelf: { get: () => shelf }, syncDone: { value: syncDone }, toggleShelf: { value: toggleShelf }, markAllInSet: { value: markAllInSet }, enterGroup: { value: enterGroup }, enterMark: { value: enterMark }, leaveMark: { value: leaveMark }, setOwned: { value: setOwned } }); }, 0);
