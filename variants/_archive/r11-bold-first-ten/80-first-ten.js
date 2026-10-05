// ---------- the first ten: the wall builds itself from the first ten cards in your hand ----------
// Shared rule this round: the seeded ownership is off. Every card starts unowned, spares and chases start empty, and
// only the marks you make yourself persist. Reset the demo returns to this fresh start.
for (const c of cards) { c.chase0 = false; c.spare0 = false; if (saved[c.id] == null) { c.owned = false; c.got = null; } }

// The opening. On first run the mosaic is there, grey and quiet, and a number pad sits at the bottom, in reach of a
// thumb: tap a set's code, type the number printed on a card you own, and the card flies out of the pad onto the
// wall, its set's panel brightening as it lands. After ten (or Done early) the pad folds away and the sets you own
// come to the front: your wall. The pad stays reachable as "Add cards" in the set header.
const ft = { up: false, h: 0, w: 0, si: -1, typed: "", n: 0, done: false, finishing: false, importing: false, step: "choose", added: [], flights: [], rings: [], scroll: null, order: null };
const FT_TEN = 10, FT_W = 68, FT_H = 95;
const listMode = () => document.body.classList.contains("listmode");
const wide = () => vw >= 900; // on a wide screen the pad is a column at the right and the wall makes room beside it
try { ft.done = localStorage.getItem("wall-first10") === "1"; } catch { ft.done = false; }
if (!ft.done && cards.some((c) => c.owned)) ft.done = true; // marks from before this opening existed: no opening
// Your wall: the sets you own first, the one with most cards leading; the rest keep their order, oldest first.
const yoursOrder = () => [...sets].sort((a, b) => ownedIn(b.cards) - ownedIn(a.cards) || a.si - b.si).map((s) => s.id);
if (ft.done) ft.order = yoursOrder();

// ----- chrome: the pad, the pill while the opening is on, Add cards in the set header and the list -----
const ftEl = document.createElement("section");
ftEl.className = "ft glass"; ftEl.id = "ft"; ftEl.setAttribute("aria-label", "Add cards"); ftEl.hidden = true;
ftEl.innerHTML = `
  <div class="ft-head">
    <div class="ft-t"><b id="ft-title">Ten cards you own</b><small id="ft-sub">Tap the set, then type the number</small></div>
    <span class="ft-count" id="ft-count" aria-live="polite">0 of 10</span>
    <button class="ft-done" id="ft-done" type="button">Done</button>
  </div>
  <div class="ft-start" id="ft-start">
    <button type="button" class="ft-big primary" id="ft-imp"><b>Import from TCGplayer or Collectr</b><small>Your whole collection in one go</small></button>
    <div class="ft-or" aria-hidden="true"><span>or</span></div>
    <button type="button" class="ft-big" id="ft-manual"><b>Type ten cards you own</b><small>Grab any ten from your hand</small></button>
  </div>
  <div class="ft-import" id="ft-import" hidden>
    <div class="ft-src" id="ft-src"><button type="button" data-src="TCGplayer"><b>TCGplayer</b><small>Collection export</small></button><button type="button" data-src="Collectr"><b>Collectr</b><small>Collection export</small></button></div>
    <div class="ft-prog" id="ft-prog" hidden role="status"><span>Looking for your collection</span><i></i></div>
    <button type="button" class="ft-link" id="ft-imp-back">Back</button>
  </div>
  <ul class="ft-log" id="ft-log" aria-label="Cards added"></ul>
  <div class="ft-sets" id="ft-sets" role="radiogroup" aria-label="Which set"></div>
  <div class="ft-show" id="ft-show"><span class="ft-num" id="ft-num"></span><span class="ft-match" id="ft-match" aria-live="polite"></span></div>
  <div class="ft-keys" id="ft-keys" aria-label="Card number">
    <button type="button" data-k="1">1</button><button type="button" data-k="2">2</button><button type="button" data-k="3">3</button>
    <button type="button" data-k="4">4</button><button type="button" data-k="5">5</button><button type="button" data-k="6">6</button>
    <button type="button" data-k="7">7</button><button type="button" data-k="8">8</button><button type="button" data-k="9">9</button>
    <button type="button" data-k="bs" aria-label="Backspace"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-5-6zM12 9.5l5 5M17 9.5l-5 5"/></svg></button><button type="button" data-k="0">0</button><button type="button" data-k="add" id="ft-add">Add</button>
  </div>`;
document.body.append(ftEl);
const ftTitleEl = ftEl.querySelector("#ft-title"), ftSub = ftEl.querySelector("#ft-sub"), ftCountEl = ftEl.querySelector("#ft-count"), ftDone = ftEl.querySelector("#ft-done");
const ftLog = ftEl.querySelector("#ft-log"), ftSets = ftEl.querySelector("#ft-sets"), ftShowEl = ftEl.querySelector("#ft-show"), ftNum = ftEl.querySelector("#ft-num"), ftMatch = ftEl.querySelector("#ft-match"), ftKeys = ftEl.querySelector("#ft-keys"), ftAdd = ftEl.querySelector("#ft-add");
ftSets.innerHTML = sets.map((st) => `<button type="button" role="radio" aria-checked="false" data-si="${st.si}" style="--ci:${st.ink}" aria-label="${st.name}, ${st.year}, numbered out of ${st.printed}" title="${st.name}, ${st.year}"><b>${st.code}</b><small>/${st.printed}</small></button>`).join("");
const ftPill = document.createElement("button");
ftPill.type = "button"; ftPill.className = "ft-pill glass"; ftPill.id = "ft-pill";
document.body.append(ftPill);
const ftAddBtn = document.createElement("button");
ftAddBtn.type = "button"; ftAddBtn.className = "mark ft-addbtn"; ftAddBtn.id = "ft-open"; ftAddBtn.hidden = true;
ftAddBtn.setAttribute("aria-label", "Add cards"); ftAddBtn.innerHTML = '<span class="l">Add cards</span><span class="s" aria-hidden="true">+</span>';
markBtn.after(ftAddBtn);
const ftListBtn = document.createElement("button");
ftListBtn.type = "button"; ftListBtn.className = "pill-btn"; ftListBtn.textContent = "Add cards";
document.getElementById("to-wall").before(ftListBtn);
const ftStart = ftEl.querySelector("#ft-start"), ftImportEl = ftEl.querySelector("#ft-import"), ftProg = ftEl.querySelector("#ft-prog"), ftSrc = ftEl.querySelector("#ft-src");
function ftMeasure() { ft.h = ftEl.offsetHeight; ft.w = ftEl.offsetWidth; }
// The sheet's three steps: choose (import first, or the ten), import (which app, then a moment of looking), pad.
function ftStep(step) {
  ft.step = step;
  ftEl.dataset.step = step;
  ftStart.hidden = step !== "choose"; ftImportEl.hidden = step !== "import";
  for (const el of [ftLog, ftSets, ftShowEl, ftKeys]) el.hidden = step !== "pad";
  ftDone.hidden = step !== "pad"; ftCountEl.hidden = step !== "pad" || ft.done;
  ftProg.hidden = true; ftSrc.hidden = false;
  ftTitle();
  if (ft.up) { ftMeasure(); layoutAll(); if (view === "set" && state.g) clampCam(state.g); kick(); }
}

// ----- what the pad says -----
const ftSet = () => (ft.si >= 0 ? sets[ft.si] : null);
const ftFind = (num) => ftSet()?.cards.find((c) => c.num === num) || null;
const ftOpenEnded = (num) => ftSet().cards.some((c) => c.num !== num && c.num.startsWith(num));
function ftTitle() {
  const t = ft.step === "choose" ? ["Your collection", "Bring it in, or start from the cards in your hand"] : ft.step === "import" ? ["Import", "Where is your collection kept?"] : [ft.done ? "Add cards" : "Ten cards you own", "Tap the set, then type the number"];
  ftTitleEl.textContent = t[0]; ftSub.textContent = t[1];
  ftCountEl.hidden = ft.done || ft.step !== "pad";
}
function ftCount() {
  ftCountEl.textContent = `${ft.n} of ${FT_TEN}`;
  ftCountEl.classList.toggle("some", ft.n > 0);
  ftPill.textContent = ft.n ? `Keep going, ${ft.n} of ${FT_TEN}` : ft.step === "pad" ? "Add your first ten cards" : "Import your collection, or add ten cards";
}
function ftChipState() {
  ftSets.querySelectorAll("button").forEach((b) => {
    const st = sets[Number(b.dataset.si)];
    b.setAttribute("aria-checked", String(st.si === ft.si));
    b.classList.toggle("has", ownedIn(st.cards) > 0);
    if (st.si === ft.si) { const l = b.offsetLeft - (ftSets.clientWidth - b.offsetWidth) / 2; if (Math.abs(ftSets.scrollLeft - l) > 4) ftSets.scrollTo({ left: l, behavior: reduced ? "auto" : "smooth" }); }
  });
  ftLog.innerHTML = ft.added.length ? ft.added.slice().reverse().map((c) => `<li><b>${c.name}</b><span>${sets[c.si].name} ${c.num}/${sets[c.si].printed}</span></li>`).join("") : `<li class="ft-empty">Each card you type lands on the wall.</li>`;
}
function ftShow(msg = "") {
  if (ft.step !== "pad") return;
  const st = ftSet(), t = ft.typed, c = t ? ftFind(t) : null;
  ftNum.textContent = t;
  let m = msg, cls = msg ? "no" : "";
  if (!msg) {
    if (!st) m = "Which set? Tap its code above";
    else if (!t) m = ft.added.length ? "Next number" : "Type the number";
    else if (c) { m = `${c.name}, ${c.rname}${c.owned ? ". Already on your wall" : ""}`; cls = c.owned ? "no" : "ok"; }
    else m = "Keep typing";
  }
  ftMatch.textContent = m; ftMatch.className = `ft-match ${cls}`;
  ftAdd.classList.toggle("ready", Boolean(c) && !msg && !c.owned);
  const owned = st ? ownedIn(st.cards) : 0;
  ftSub.textContent = st ? `${st.name}, ${st.year}${owned ? `. ${owned} of ${st.cards.length} yours` : ""}` : "Tap the set, then type the number";
}
function ftMiss(msg, el = ftShowEl) {
  ft.typed = ""; tick(20);
  if (!reduced) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
  ftShow(msg);
}
function ftKey(k) {
  if (!ft.up || ft.finishing || ft.step !== "pad") return;
  if (k === "bs") {
    if (ft.typed) { ft.typed = ft.typed.slice(0, -1); tick(3); ftShow(); }
    else ftBack();
    return;
  }
  const st = ftSet();
  if (!st) { ftMiss("Tap the set first", ftSets); return; }
  if (k === "add") { const c = ftFind(ft.typed); if (c) ftAddCard(c); else if (ft.typed) ftMiss(`No card ${ft.typed} in ${st.name}`); return; }
  const t = ft.typed + k;
  if (!st.cards.some((c) => c.num.startsWith(t))) { ft.typed = t; ftMiss(`No card ${t} in ${st.name}`); return; }
  ft.typed = t; tick(3);
  const c = ftFind(t);
  // Nothing else could follow (142 when there's no 1420): it's in, no Add needed.
  if (c && !ftOpenEnded(t)) { ftAddCard(c); return; }
  ftShow();
}
function ftPick(si) {
  if (ft.finishing) return;
  ft.si = si; ft.typed = ""; tick(4);
  ftChipState(); ftShow();
  const st = sets[si], g = groups.find((x) => x.set === st);
  if (!g || listMode()) return;
  if (view === "set") ftJump(g); else ftReveal(g, null);
}

// ----- a card lands: it flies out of the pad to its tile, which floods in as it arrives -----
function ftAddCard(c) {
  if (c.owned) { ftMiss(`${c.name} is already on your wall`); return; }
  ft.typed = ""; ft.added.push(c);
  if (!ft.done) ft.n++;
  tick(10);
  const g = groups[c.g];
  if (reduced || listMode() || !ftVisible(c)) ftMark(c);
  else {
    ftReveal(g, c);
    ft.flights.push({ c, from: ftFrom(), t0: performance.now(), dur: 640, delay: state.trans?.kind === "slide" ? 380 : 0 });
  }
  ftShow(); ftCount(); kick();
}
function ftMark(c) {
  if (c.owned) return;
  setOwned(c, true, { quiet: true });
  if (!listMode()) ft.rings.push({ c, t0: performance.now() });
  ftChipState(); ftShow();
  if (!ft.done && ft.n >= FT_TEN && !ft.finishing) { ft.finishing = true; setTimeout(finishFirst, reduced ? 0 : 700); }
  kick();
}
// Backspace with nothing typed puts the last card back.
function ftBack() {
  const c = ft.added.pop(); if (!c) { tick(3); return; }
  const f = ft.flights.find((x) => x.c === c);
  if (f) ft.flights.splice(ft.flights.indexOf(f), 1); // never landed: nothing to unmark
  else if (c.owned) setOwned(c, false, { quiet: true });
  if (!ft.done) ft.n = Math.max(0, ft.n - 1);
  tick(6); toast(`${c.name} put back.`); ftChipState(); ftShow(); ftCount(); kick();
}
function ftSettle() { for (const f of ft.flights.splice(0)) ftMark(f.c); }
const ftVisible = (c) => !tbl.on && (view === "mosaic" ? true : view === "set" && state.g === groups[c.g]);
// Where the flying card starts: out from under the pad's top edge (a phone) or its left edge (a wide screen).
function ftFrom() {
  const b = ftEl.getBoundingClientRect();
  return wide() ? { x: b.left - FT_W / 2, y: b.top + 70, w: FT_W, h: FT_H } : { x: b.left + b.width / 2 - FT_W / 2, y: b.top - FT_H / 2, w: FT_W, h: FT_H };
}
const ftTarget = (c) => (view === "mosaic" ? mr(c.m) : view === "set" && state.g === groups[c.g] ? binderRect(c, cam) : null);
// The band of wall above the pad (beside it on a wide screen).
const ftBand = () => ({ top: topPad(), bot: vh - (ft.up && !wide() ? ft.h + 8 : botPad()) });
// Bring the panel (or the card's row of it) into the band so you see the card land. The mosaic scrolls to it; a binder pans.
function ftReveal(g, c) {
  if (listMode() || !g.m) return;
  if (view === "mosaic") {
    if (state.trans && state.trans.kind !== "morph") return;
    const m = g.m, { top, bot } = ftBand();
    let to = mScroll;
    if (m.h <= bot - top) { if (m.y - mScroll < top) to = m.y - top - 4; else if (m.y + m.h - mScroll > bot) to = m.y + m.h - bot + 4; }
    else if (c) to = c.m.y + c.m.h / 2 - (top + bot) / 2; else to = m.y - top - 4;
    to = clamp(to, 0, mMax);
    if (Math.abs(to - mScroll) < 2) return;
    inertia = false;
    if (reduced) { mScroll = to; kick(); return; }
    ft.scroll = { from: mScroll, to, t0: performance.now(), dur: 420 }; kick();
    return;
  }
  if (view !== "set" || state.g !== g || !c) return;
  const { top, bot } = ftBand(), r = binderRect(c, cam);
  if (r.y >= top + 10 && r.y + r.h <= bot - 10) return;
  const a = { ...cam };
  cam.y = c.y + TH * c.sz / 2 - ((top + bot) / 2) / cam.s;
  clampCam(state.g);
  const b = { ...cam }; Object.assign(cam, a);
  if (reduced) { Object.assign(cam, b); kick(); } else flyTo(b, 320);
}
// Inside a set, picking another set's code slides to it (any set, not only the next one).
function ftJump(g) {
  if (view !== "set" || state.g === g) return;
  if (state.trans) finishTransition();
  if (state.focus) unfocus();
  const d = groups.indexOf(g) > groups.indexOf(state.g) ? 1 : -1, fromCam = { ...cam }, prev = state.g;
  state.g = g; Object.assign(cam, fitCam(g)); clampCam(g);
  state.trans = { kind: "slide", from: prev, fromCam, g, dir: d, t0: performance.now(), dur: reduced ? 1 : 460, done: () => kick() };
  setChrome(); tick(6); kick();
}

// ----- the pad up and down, the opening's end -----
// The wall makes room: on a phone the scroll range grows so any panel can rise above the pad; on a wide screen the
// panels fly into a column beside it.
function ftMorph(dur = 1100) {
  if (view !== "mosaic" || listMode() || tbl.on || reduced) { layoutAll(); if (view === "set" && state.g) clampCam(state.g); kick(); return; }
  if (state.trans) finishTransition();
  for (const c of cards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  const moved = groups.some((g) => Math.abs(g.pm.x - g.m.x) > 0.5 || Math.abs(g.pm.y - g.m.y) > 0.5 || Math.abs(g.pm.w - g.m.w) > 0.5 || Math.abs(g.pm.h - g.m.h) > 0.5);
  if (!moved) { for (const g of groups) g.pm = null; kick(); return; }
  for (const c of cards) c.delay = Math.min(520, c.g * 60 + c.k * 0.7);
  state.trans = { kind: "morph", t0: performance.now(), dur, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
function padShow(si = -1) {
  if (ft.up) { if (si >= 0) ftPick(si); return; }
  if (state.trans) finishTransition();
  if (state.focus) unfocus();
  leaveMark(); setMenu(false); hideCaption();
  ft.up = true; ft.typed = ""; ft.added = [];
  if (si >= 0) ft.si = si; else if (view === "set" && state.g?.set) ft.si = state.g.set.si;
  document.body.classList.add("ft-up");
  ftEl.hidden = false;
  ftStep(ft.done || ft.n ? "pad" : ft.step); ftMeasure();
  if (reduced) ftEl.classList.add("up"); else requestAnimationFrame(() => ftEl.classList.add("up"));
  ftChipState(); ftShow(); ftCount();
  ftMorph(700);
  if (view === "set" && state.g) { const a = { ...cam }; clampCam(state.g); const b = { ...cam }; Object.assign(cam, a); if (b.y !== a.y) flyTo(b, 360); }
  if (ft.si >= 0 && view === "mosaic") { const g = groups.find((x) => x.set === sets[ft.si]); if (g) ftReveal(g, null); }
  tick(8); kick();
}
function padHide({ morph = false } = {}) {
  if (!ft.up) return;
  ftSettle();
  ft.up = false; ft.typed = "";
  document.body.classList.remove("ft-up"); ftEl.classList.remove("up");
  clearTimeout(padHide.t); padHide.t = setTimeout(() => { if (!ft.up) ftEl.hidden = true; }, reduced ? 0 : 450);
  if (morph) ftMorph(); else { layoutAll(); if (view === "set" && state.g) clampCam(state.g); }
  kick();
}
// Ten cards, or Done early: the pad folds away, the sets you own come to the front, the lens bar slides in.
function finishFirst() {
  if (ft.done) return;
  ft.done = true; ft.finishing = false;
  try { localStorage.setItem("wall-first10", "1"); } catch { /* fine */ }
  document.body.classList.remove("ft-open");
  ftSettle();
  const n = cards.filter((c) => c.owned).length;
  ft.order = yoursOrder();
  if (view === "mosaic" && !listMode() && mScroll > 0) { inertia = false; if (reduced) mScroll = 0; else ft.scroll = { from: mScroll, to: 0, t0: performance.now(), dur: 900 }; }
  padHide({ morph: n > 0 });
  toast(n ? "Your wall. Tap a set to open it; Have, Need, Chase and Trade recolour it." : "Tap a set to open it. Add cards from its header.");
}
// Done after the opening: one toast for the session, with Undo, and a flight if a new set came forward.
function ftFinishSession() {
  const added = ft.added.slice(), before = ft.order ? ft.order.join() : "";
  ft.order = yoursOrder();
  padHide({ morph: before !== ft.order.join() });
  if (!added.length) return;
  const setsIn = new Set(added.map((c) => c.si)), one = setsIn.size === 1 ? sets[[...setsIn][0]] : null;
  toast(`${added.length} added.${one ? ` ${ownedIn(one.cards)} of ${one.cards.length} in ${one.name}.` : ` Across ${setsIn.size} sets.`}`, () => {
    for (const c of added) if (c.owned) setOwned(c, false, { quiet: true });
    const was = ft.order.join(); ft.order = yoursOrder();
    if (was !== ft.order.join()) ftMorph(); else kick();
  });
}

// ----- import: simulated. A moment of looking, then the demo's seeded collection (the 541 cards the base wall ships
// with, computed the way 10-model.js does) arrives as if it came from the file: every card floods in, set by set,
// while the sets you own come to the front. -----
function seededOwn(c) {
  const st = sets[c.si];
  return h32(c.id + "o") < clamp(OWN_RATE[st.id] * (c.tier <= 1 ? 1.3 : c.tier === 2 ? 1 : c.tier === 3 ? 0.66 : 0.32), 0, 0.97);
}
function seededGot(c) {
  const st = sets[c.si], START = Date.parse("2023-01-15"), NOW = Date.now(), BINDER = Date.parse("2024-03-09");
  if (st.year < 2003 && h32(c.id + "g") < 0.72) return BINDER + h32(c.id + "h") * 6 * 3600e3;
  const from = Math.max(START, st.released || START);
  return from + Math.pow(h32(c.id + "t"), 0.8) * Math.max(0, NOW - from - 86400e3);
}
function ftImport(src) {
  if (ft.importing) return;
  ft.importing = true; tick(5);
  ftSrc.hidden = true; ftProg.hidden = false; ftProg.querySelector("span").textContent = `Looking for your collection in ${src}`;
  ftMeasure(); layoutAll(); kick();
  setTimeout(() => ftImported(src), reduced ? 400 : 1200);
}
function ftImported(src) {
  ft.importing = false;
  const now = performance.now();
  let n = 0;
  const arrived = [];
  for (const c of cards) {
    if (c.owned || !seededOwn(c)) continue;
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got };
    arrived.push(c); n++;
  }
  persist();
  ft.done = true; ft.step = "pad";
  try { localStorage.setItem("wall-first10", "1"); localStorage.setItem("wall-import", src); } catch { /* fine */ }
  document.body.classList.remove("ft-open");
  ft.order = yoursOrder();
  if (view === "mosaic" && !listMode() && mScroll > 0) { inertia = false; if (reduced) mScroll = 0; else ft.scroll = { from: mScroll, to: 0, t0: now, dur: 900 }; }
  padHide({ morph: true }); // the sets you own fly to the front (this re-indexes c.g) ...
  for (const c of arrived) c.anim = { t0: now + (reduced ? 0 : 420 + c.g * 110 + c.k * 2.4), to: true }; // ... and the cards flood in, front first
  ftChipState(); updateCount(); drawList(); tick(14);
  toast(`${n.toLocaleString()} cards imported from ${src}.`);
}

// ----- the wall around it: layout, chrome, camera -----
// Laid out by set, once the opening is done, the sets you own lead and get more wall.
function layoutAll() {
  if (mode === "set" && ft.order) {
    const rank = new Map(ft.order.map((id, i) => [id, i]));
    groups.sort((a, b) => rank.get(a.key) - rank.get(b.key));
    groups.forEach((g, gi) => { g.gi = gi; for (const c of g.base || g.cards) c.g = gi; });
  }
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) orderGroup(g); groups.forEach(binderLayout); if (lifted) liftedLayout(); else mosaicLayout();
}
function mosaicLayout() {
  const side = ft.up && !listMode() && wide() ? ft.w + 16 : 0, bot = ft.up && !listMode() && !wide() ? ft.h + 8 : botPad();
  const fitH = vh - topPad() - bot, W = vw - 16 - side;
  const R = { x: 8, y: topPad(), w: W, h: Math.max(fitH, (cards.length * 340) / W) };
  mMax = Math.max(0, R.y + R.h + bot - vh);
  mScroll = clamp(mScroll, 0, mMax);
  const items = groups.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) * (mode === "set" && ft.order && ownedIn(g.cards) ? 1.5 : 1) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  stripTreemap(items, R);
  for (const g of groups) packPanel(g);
}
// A set you haven't touched is quiet; the first card to land brightens it.
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m);
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    const k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)), a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  const owned = ownedNow(g.cards), n = g.cards.length;
  if (owned && !g.wasOwned) { g.wasOwned = true; if (started) g.lit = now; } else if (!owned) g.wasOwned = false;
  let q = 1;
  if (state.lens === "have" && !state.matches && !state.time) {
    if (!owned) q = 0.5; else if (g.lit && now - g.lit < 700 && !reduced) q = 0.5 + 0.5 * ease((now - g.lit) / 700);
  }
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.globalAlpha = alpha * labelAlpha * q;
  const x = m.x + PG + 10, w = m.w - PG * 2 - 20;
  const size = clamp(m.w * 0.075, 12, 17);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(800, size, true);
  const stat = panelStat(g);
  font(600, size * 0.82); const sw = stat ? ctx.measureText(stat).width + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw), x, m.y + PG + 22);
  if (stat) { ctx.textAlign = "right"; font(600, size * 0.82); ctx.fillStyle = theme.muted; ctx.fillText(stat, x + w, m.y + PG + 22); }
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  ctx.globalAlpha = 1;
}
// The binder stops above the pad while it's up.
function clampCam(g) {
  if (!g) return;
  const left = -12 / cam.s, right = g.w + 12 / cam.s - vw / cam.s;
  cam.x = right < left ? (left + right) / 2 : clamp(cam.x, left, right);
  const pad = ft.up && !listMode() && !wide() ? ft.h + 24 : botPad();
  const top = -(topPad() + 6) / cam.s, bottom = g.h + (pad + 20) / cam.s - vh / cam.s;
  cam.y = bottom < top ? top : clamp(cam.y, top, bottom);
}
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on; arrBtn0.hidden = view === "set" || tbl.on;
  markBtn.hidden = view !== "set" || marking;
  ftAddBtn.hidden = view !== "set" || tbl.on;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : "";
  if (marking && view !== "set") leaveMark();
  updateCount();
}

// ----- drawing: the scroll to the landing, the flight, the ring where it lands -----
function kick() {
  if (raf) return;
  raf = requestAnimationFrame(ftFrameAll);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; ftFrameAll(performance.now()); } }, 120);
}
function ftFrameAll(now) {
  if (ft.scroll) {
    const s = ft.scroll, p = clamp((now - s.t0) / s.dur, 0, 1);
    mScroll = clamp(s.from + (s.to - s.from) * ease(p), 0, mMax);
    if (p >= 1) ft.scroll = null;
  }
  frame(now);
  ftFrame(now);
  if (ft.scroll) kick();
}
function ftFrame(now) {
  if (!ft.flights.length && !ft.rings.length) return;
  if (listMode() || tbl.on) { ftSettle(); ft.rings.length = 0; return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let busy = false;
  const in0 = inertia; inertia = true; // no foil on a card in flight (the base's own switch)
  for (const f of ft.flights.slice()) {
    const B = ftTarget(f.c);
    if (!B) { ft.flights.splice(ft.flights.indexOf(f), 1); ftMark(f.c); continue; }
    const p = clamp((now - f.t0 - f.delay) / f.dur, 0, 1), e = ease(p), A = f.from;
    const r = { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e - Math.sin(Math.PI * p) * 44, w: A.w + (B.w - A.w) * e, h: A.h + (B.h - A.h) * e };
    if (p < 1) { ftDrawCard(f.c, r, p, now); busy = true; }
    else { ft.flights.splice(ft.flights.indexOf(f), 1); ftMark(f.c); }
  }
  inertia = in0;
  for (const g of ft.rings.slice()) {
    const p = (now - g.t0) / 640, B = ftTarget(g.c);
    if (p >= 1 || !B) { ft.rings.splice(ft.rings.indexOf(g), 1); continue; }
    const cx = B.x + B.w / 2, cy = B.y + B.h / 2, rad = Math.max(8, B.h * 0.7) + p * Math.max(24, B.h * 1.6);
    ctx.globalAlpha = (1 - p) * 0.9; ctx.lineWidth = 2; ctx.strokeStyle = sets[g.c.si].ink;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    busy = true;
  }
  ctx.globalAlpha = 1;
  if (busy) kick();
}
// The card in flight: a pocket that flips to its face on the way, shrinking to its tile.
function ftDrawCard(c, r, p, now) {
  const flip = reduced ? -1 : Math.cos(Math.PI * clamp(p / 0.7, 0, 1));
  const w = r.w * Math.max(0.06, Math.abs(flip)), h = r.h, rad = w * 0.045;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h);
  ctx.globalAlpha = 1;
  ctx.shadowColor = "rgb(0 0 0 / .3)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  rr(-w / 2, -h, w, h, rad); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (flip <= 0) cardFace(c, -w / 2, -h, w, h, now, false); else emptyPocket(c, -w / 2, -h, w, h, false);
  ctx.restore();
}

// ----- input -----
// Keys answer on the way down (a number pad should feel instant); keyboard activation still comes through click.
ftKeys.addEventListener("pointerdown", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; e.preventDefault(); ftKey(b.dataset.k); });
ftKeys.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b && e.detail === 0) ftKey(b.dataset.k); });
ftSets.addEventListener("click", (e) => { const b = e.target.closest("[data-si]"); if (b) ftPick(Number(b.dataset.si)); });
ftDone.onclick = () => { if (!ft.done) finishFirst(); else ftFinishSession(); };
ftEl.querySelector("#ft-imp").onclick = () => { ftStep("import"); tick(4); };
ftEl.querySelector("#ft-manual").onclick = () => { ftStep("pad"); ftChipState(); ftShow(); ftCount(); tick(4); };
ftEl.querySelector("#ft-imp-back").onclick = () => { if (!ft.importing) ftStep("choose"); };
ftSrc.addEventListener("click", (e) => { const b = e.target.closest("[data-src]"); if (b) ftImport(b.dataset.src); });
ftPill.onclick = () => padShow();
ftAddBtn.onclick = () => padShow();
ftListBtn.onclick = () => padShow();
// A touch on the wall itself folds the pad away rather than being swallowed; the pill (or Add cards) brings it back.
const onWall = () => { if (ft.up) padHide(); };
canvas.addEventListener("touchstart", onWall, { passive: true });
canvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") onWall(); });
// A physical keyboard types into the pad while it's up (unless you're in the search field).
addEventListener("keydown", (e) => {
  if (!ft.up || document.activeElement === qIn || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (ft.step !== "pad") { if (k === "Escape" && !ft.importing) padHide(); else return; }
  else if (/^\d$/.test(k)) ftKey(k); else if (k === "Backspace") ftKey("bs"); else if (k === "Enter") ftKey("add"); else if (k === "Escape") ftDone.click(); else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
arrMenu.addEventListener("click", (e) => { if (ft.up && e.target.closest("[data-mode]")) padHide(); }, true);
qIn.addEventListener("focus", () => { if (ft.up && !listMode()) padHide(); });
document.getElementById("to-list").addEventListener("click", () => ftSettle(), true);
addEventListener("resize", () => { if (ft.up) { ftMeasure(); layoutAll(); kick(); } });
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-spares", "wall-paid", "wall-trades", "wall-first10", "wall-import"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ----- the opening -----
ftStep(ft.done ? "pad" : "choose"); ftCount();
if (!ft.done) {
  document.body.classList.add("ft-open");
  document.getElementById("caption").classList.add("gone");
  // The mosaic inks in first, grey and quiet; then the pad rises.
  setTimeout(() => { if (!ft.done && !ft.up) padShow(); }, reduced ? 60 : 1100);
}
