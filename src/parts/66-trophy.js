// ---------- trophies: finished things leave the wall ----------
// When the last card of a set or a chase lands, the panel is minted: its tiles gather into a gold plaque that flies up
// onto a shelf along the top of the mosaic, and the rest of the wall flows into the space. A trophy stays on that
// shelf for a day; then it moves to the Trophies room (round 21; "the trophy room" in older notes), with the rest. Tapping a plaque opens its
// sealed album (the cards packed tight, the header reading when it was finished and what it's worth) with Back to
// the wall, which puts the panel back among the others; a finished group kept on the wall offers Put on the shelf.
// Before the finish, the progress bar on every panel and binder carries gold ticks for the missing cards you're
// chasing. The finished state lives in localStorage wall-done, per group key: { at, put }. A set is keyed with its
// view (set, master set, grand set), so the master set is its own trophy.

const DAY = 86400e3;
let done = {};
try { done = JSON.parse(localStorage.getItem("wall-done") || "{}") || {}; } catch { done = {}; }
const persistDone = () => { try { localStorage.setItem("wall-done", JSON.stringify(done)); } catch { /* private mode */ } };
const doneKey = (g) => (g.set ? `${g.set.id}|${scopeOf(g.set)}` : g.key);
const finishOf = (g) => (g.set || g.chase ? done[doneKey(g)] || null : null);
const isPut = (g) => Boolean(finishOf(g)?.put);
const onShelf = (g) => { const f = finishOf(g); return Boolean(f?.put && !f.moved && Date.now() - f.at < DAY); }; // the first day on the shelf at the top (unless moved on early); then the trophy room
const trophyName = (g) => { const s = g.set ? scopeOf(g.set) : "set"; return `${g.name}${s === "master" ? " master set" : s === "grand" ? " grand set" : ""}`; };

// ----- the bar: how far along, and gold ticks for the missing cards you're after (cached until a count changes) -----
function ticksOf(g) {
  const list = g.base || g.cards, n = list.length;
  let owned = 0, chased = 0;
  for (const c of list) { if (c.owned) owned++; else if (isChase(c)) chased++; }
  const key = `${owned}|${chased}|${n}`;
  if (g.tk?.key === key) return g.tk;
  const ticks = [];
  let k = 0;
  for (const c of list) { if (c.owned) continue; if (isChase(c)) ticks.push((owned + k + 0.5) / n); k++; }
  return (g.tk = { key, owned, n, chased, ticks });
}
function drawBar(g, x, y, w, h, now, k = 1) {
  const timed = state.time, t = ticksOf(g), f = finishOf(g);
  const owned = timed ? ownedNow(g.cards) : t.owned, n = timed ? g.cards.length : t.n;
  let frac = n ? owned / n : 0;
  if (f && g.finT && !reduced) { const p = clamp((now - g.finT) / 600, 0, 1); frac = g.finFrom + (1 - g.finFrom) * (1 - Math.pow(1 - p, 3)); }
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, y, w * frac, h);
  if (!timed && t.chased && owned < n && !picking()) {
    ctx.fillStyle = theme.gold;
    const th = h + 4 * k, ty = y - 2 * k;
    if (t.ticks.length > 8) ctx.fillRect(x + w * owned / n, ty, w * t.chased / n, th); // past a few, one gold stretch: this much of what's left is on your list
    else { const tw = Math.max(1, Math.min(2, (w / n) * 0.5)); for (const p of t.ticks) ctx.fillRect(x + w * p - tw / 2, ty, tw, th); }
  }
  if (f && g.finT && !reduced) { // a glint runs along the gold once
    const p = (now - g.finT - 350) / 900;
    if (p > 0 && p < 1) {
      const gx = x - w * 0.3 + p * w * 1.6, gr = ctx.createLinearGradient(gx, 0, gx + w * 0.3, 0);
      gr.addColorStop(0, "rgb(255 255 255 / 0)"); gr.addColorStop(0.5, "rgb(255 255 255 / .85)"); gr.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.fillStyle = gr; ctx.fillRect(x, y - 1 * k, w, h + 2 * k);
    }
    if (now - g.finT < 1400) kick();
  }
}

// ----- completion: computed when a card changes, never per frame -----
// Every set and chase is checked against its full card list (g.base: the set in its current view, or a chase's
// twins). Newly complete: a trophy, put on the shelf. No longer complete (a card taken out, a trade): the trophy is
// gone and the panel comes back. A finished group you chose to keep on the wall stays there (put: false).
let doneDirty = false; // a trade changes several cards with quietLayout on: one check at the end
function syncDone({ quiet = false } = {}) {
  natdexSync();
  const list = mode === "set" ? groups : [...(setGroups || []), ...chaseGroups.values()];
  const minted = [], freed = [], now = performance.now();
  for (const g of list) {
    if (!g.set && !g.chase || !g.base) continue;
    const key = doneKey(g), n = g.base.length, full = n > 0 && ownedIn(g.base) === n, e = done[key];
    if (full && !e) { done[key] = { at: Date.now(), put: true }; minted.push(g); g.finT = now; g.finFrom = (n - 1) / n; }
    else if (!full && e) { delete done[key]; g.finT = 0; if (e.put) freed.push(g); }
  }
  if (!minted.length && !freed.length) return null;
  persistDone();
  const cg = minted.length ? cerFor(minted, quiet) : null; // a whole set or chase finished by hand: the ceremony first (69-ceremony.js)
  if (cg) cerOpen(cg);
  cerLater(() => { if (cg) for (const g of minted) if (g.finT) g.finT = performance.now(); applyDone(minted, freed, quiet); }); // then the trophy flow, as before
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
  const R = { x: 8 + SAFE.left, w: vw - 16 - SAFE.left - SAFE.right }, n = groups.filter((x) => x.done && onShelf(x)).length + 1, cols = Math.min(n, R.w >= 700 ? 4 : 2);
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

// ----- the shelf along the top (the first day) and the trophy case at the end of the wall (after that) -----
const PLQ_H = 72; // a plaque row, margins included (the plate is 60)
let shelf = null, shelfTimer = 0; // in mosaic coordinates
const plateOf = (m) => ({ x: m.x + PG, y: m.y + PG, w: m.w - PG * 2, h: m.h - PG * 2 });
function plaqueRows(list, R, y) {
  const cols = Math.min(list.length, R.w >= 700 ? 4 : 2), rows = Math.ceil(list.length / cols);
  list.forEach((g, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, list.length - row * cols), cw = R.w / inRow; // a short last row shares the width
    g.m = { x: R.x + (i % cols) * cw, y: y + row * PLQ_H, w: cw, h: PLQ_H }; packPlaque(g); g.plq = plaqueInfo(g);
  });
  return rows * PLQ_H;
}
const byFinish = (a, b) => (finishOf(b)?.at || 0) - (finishOf(a)?.at || 0); // newest first
function shelfLayout(R) {
  const dn = groups.filter((g) => g.done && onShelf(g)).sort(byFinish);
  clearTimeout(shelfTimer);
  if (!dn.length) { shelf = null; syncShelfPad(); return 0; }
  const h = plaqueRows(dn, R, R.y) + 2;
  shelf = { y: R.y, h };
  const next = Math.min(...dn.map((g) => finishOf(g).at + DAY)) - Date.now() + 100;
  shelfTimer = setTimeout(() => { if (view === "mosaic" && !state.trans && !gesture && !tbl.on && !room.on && !bnd.on) shelfMorph(); else { layoutAll(); kick(); } }, clamp(next, 100, 2e9));
  syncShelfPad();
  return h;
}
// The toast lives where the shelf is: while it shows, it sits just under it.
function syncShelfPad() { document.body.style.setProperty("--shelf-h", view === "mosaic" && shelf && mode === "set" && !room.on ? `${shelf.h}px` : "0px"); }
// The engraving: the group's cards packed tight as a strip of colour along the bottom of the plate. The tiles live
// there (so opening the plaque grows them into the album, and the minting flight lands them there).
const ENGR_H = 10;
function packPlaque(g) {
  const p = plateOf(g.m), n = g.base.length, ew = p.w - 20, cw = Math.min(ew / n, ENGR_H * TW / TH), ex = p.x + 10, ey = p.y + p.h - 18;
  g.base.forEach((c, i) => { c.m = { x: ex + i * cw, y: ey, w: cw, h: ENGR_H }; });
}
const finDay = (at) => (new Date(at).toDateString() === new Date().toDateString() ? "today" : dayOf(at)); // "Finished today" on its first day
const plaqueInfo = (g) => { const f = finishOf(g), worth = worthOf(g.base), when = `Finished ${finDay(f?.at || Date.now())}`; return { title: trophyName(g), line: `${when} · ${short(worth)}`, when, worth }; };
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
  rr(p.x, p.y, p.w, p.h, 7); ctx.fillStyle = theme.plaque; ctx.fill(); // flat gold, a hairline inset: the same plate as in Trophies
  ctx.save(); rr(p.x, p.y, p.w, p.h, 7); ctx.clip();
  ctx.fillStyle = theme["plaque-hi"]; ctx.fillRect(p.x, p.y, p.w, 1);
  ctx.fillStyle = theme["plaque-lo"]; ctx.fillRect(p.x, p.y + p.h - 1, p.w, 1);
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
  ctx.lineWidth = 1; ctx.strokeStyle = theme["plaque-lo"]; rr(p.x + 4.5, p.y + 4.5, p.w - 9, p.h - 9, 4); ctx.stroke();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; rr(p.x, p.y, p.w, p.h, 7); ctx.stroke(); }
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

// ----- the sealed album: a finished group's binder packs its cards edge to edge -----
const tight = (g) => Boolean(g.done || g.tight);
// A finished group's header: sealed, it has one button, Back to the wall; kept on the wall, Put on the shelf joins
// the usual row (in place of Chase these on a set: there is nothing left to chase).
function albumHeader(g) {
  const f = finishOf(g); if (!f) return;
  const W = frameW(), btn = { x: W - 128, y: 2, w: 128, h: 22, shelf: true };
  if (f.put) { g.popChips = null; g.seg = null; g.popH = 30; g.hdrBtn = btn; g.hdrBtn2 = onShelf(g) ? { x: W - 128 - 8 - 112, y: 2, w: 112, h: 22, away: true } : null; } // on its first day: skip the wait
  else if (g.set) { g.hdrBtn = { ...btn, y: landPhone() ? g.hdrBtn.y : 4 }; if (g.hdrBtn2?.y === g.hdrBtn.y) g.hdrBtn2.x = g.hdrBtn.x - 8 - g.hdrBtn2.w; } // on its side, on the title's line beside Remove set
  else g.hdrBtn2 = { ...btn, x: W - 118 - 8 - 128 };
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
    e.put = true; delete e.moved; persistDone(); drawList();
    if (view === "mosaic" && !state.trans && !reduced) mintFlight(g); else { if (view === "mosaic") mScroll = 0; layoutAll(); kick(); }
    toast(`${trophyName(g)} is on the shelf.`, () => { const x = finishOf(g); if (!x) return; x.put = false; g.unmint = true; persistDone(); if (view === "mosaic") { if (state.trans) finishTransition(); shelfMorph(); } else { layoutAll(); kick(); } drawList(); });
  });
}
// To the case now: a trophy on its first day goes into the trophy room without waiting for the day to end.
function putAway(g) {
  const f = finishOf(g); if (!f?.put) return;
  tick(6);
  leaveBinderThen(g, () => {
    f.moved = true; persistDone(); drawList();
    if (view === "mosaic" && !state.trans && !reduced) shelfMorph(); else { layoutAll(); kick(); }
    toast(`${trophyName(g)} is in Trophies.`);
  });
}
const finishedText = (gs) => (gs.length === 1 ? `${trophyName(gs[0])} finished. It's on the shelf, worth ${money(worthOf(gs[0].base))}.` : `${gs.map(trophyName).join(" and ")} finished. They're on the shelf.`);
// The list's Trophies section: the Showcase and Next up, then a shelf per set or chase as in the trophy room, a
// finished one's plaque (with Back to the wall and its cards) together with its medals; locked ones fold away.
function trophyListHTML(show, rows) {
  const fin = groups.filter((g) => g.done).sort(byFinish), L = mode === "set" ? medalList() : null;
  if (!fin.length && !L?.earned.length) return "";
  const plaque = (g) => { const f = finishOf(g), s = seriesOf(g); return `<p class="lsub lfin-line"><span>Finished ${finDay(f.at)}, worth ${money(worthOf(g.base))}, ${deltaText(s.delta).toLowerCase()}.${onShelf(g) ? " On the shelf at the top of the wall today." : ""}</span><button type="button" class="pill-btn" data-shelf="${esc(doneKey(g))}">Back to the wall</button></p>`; };
  const shelf = (sh) => {
    const won = sh.all.filter((t) => t.earned), locked = sh.all.filter((t) => !t.earned), g = sh.plaque, items = g ? g.cards.filter(show) : [];
    return `<h3 class="lfin">${esc(sh.name)} <span class="lm-of">${won.length} of ${sh.all.length}</span></h3>${g ? plaque(g) : ""}${won.length ? `<ul class="lmed">${won.map((t) => mdListRow(t)).join("")}</ul>` : ""}${locked.length ? `<details class="lmed-more"><summary>${locked.length} more to earn</summary><ul class="lmed">${locked.map((t) => mdListRow(t)).join("")}</ul></details>` : ""}${items.length ? rows(items) : ""}`;
  };
  if (!L) return `<section class="lshelf" data-sec="medal"><h2>Trophies</h2>${fin.map((g) => `<h3 class="lfin">${esc(trophyName(g))}</h3>${plaque(g)}${g.cards.filter(show).length ? rows(g.cards.filter(show)) : ""}`).join("")}</section>`;
  const { started, notYet } = mdShelves(fin);
  const next = L.list.filter((t) => !t.earned && t.goal > 1 && t.have < t.goal).sort((a, b) => b.have / b.goal - a.have / a.goal || (a.goal - a.have) - (b.goal - b.have)).slice(0, 4);
  return `<section class="lshelf lmedals" data-sec="medal"><h2>Trophies</h2><p class="lsub">${L.earned.length} of ${L.list.length} earned${L.hiddenLeft ? `, ${L.hiddenLeft} hidden still to find` : ""}.</p>
    ${L.earned.length ? `<h3 class="lfin">Showcase</h3><ul class="lmed">${L.earned.slice(0, 6).map((t) => mdListRow(t, true)).join("")}</ul>` : ""}
    ${next.length ? `<h3 class="lfin">Next up</h3><ul class="lmed">${next.map((t) => mdListRow(t, true)).join("")}</ul>` : ""}
    ${started.map(shelf).join("")}
    ${notYet.length ? `<details class="lmed-later"${mdListOpen ? " open" : ""}><summary>Not started yet · ${notYet.length} ${notYet.length === 1 ? "chase" : "chases"}</summary>${notYet.map(shelf).join("")}</details>` : ""}</section>`;
}
document.getElementById("list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-shelf]"); if (!b) return;
  const g = groups.find((x) => x.done && doneKey(x) === b.dataset.shelf), f = g && finishOf(g); if (!f) return;
  f.put = false; persistDone(); layoutAll(); drawList(); tick(5);
  toast(`${trophyName(g)} is back on the wall.`, () => { const x = finishOf(g); if (!x) return; x.put = true; persistDone(); layoutAll(); drawList(); kick(); });
});
// Debug builds only: the tests' hook sees the shelf.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { done: { get: () => done }, shelf: { get: () => shelf }, room: { get: () => room }, openRoom: { value: openRoom }, closeRoom: { value: closeRoom }, caseList: { value: caseList }, toggleFan: { value: toggleFan }, seriesOf: { value: seriesOf }, shelfMorph: { value: shelfMorph }, syncDone: { value: syncDone }, toggleShelf: { value: toggleShelf }, markAllInSet: { value: markAllInSet }, enterGroup: { value: enterGroup }, enterMark: { value: enterMark }, leaveMark: { value: leaveMark }, setOwned: { value: setOwned }, layoutAll: { value: layoutAll } }); }, 0);
