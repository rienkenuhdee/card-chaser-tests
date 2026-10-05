// ---------- welcome: the first 30 seconds ----------
// Round 11 shared rule: the seeded ownership is off. Every card starts unowned, the chase list and spares start empty
// (deals stay), and only the collector's own marks persist. Reset the demo returns to this fresh start.
for (const c of cards) { if (saved[c.id] == null) { c.owned = false; c.got = null; } c.chase0 = false; c.spare0 = false; }

// The welcome: a short glass sheet over the wall, like an app's first run. The wall under it keeps working: a pinch
// still opens a set, a drag still scrolls, and the sheet follows what you did.
//   0. Import from TCGplayer or Collectr (first and biggest), or pick your sets and mark by hand. The import is
//      simulated: pick the source, a second of "Looking for your collection", then the seeded demo ownership (the 541
//      cards the base wall ships with) floods into the wall set by set, and the welcome ends with one toast.
//   1. Which sets do you collect? The mosaic's panels become pickable (tap to tick). Continue folds the rest back.
//   2. Mark a few you have. The first picked set opens in Mark mode; the count ticks up as you mark.
//   3. Chase one. Press and hold a card you don't have; it goes on your chase list.
// Then the sheet goes, the lens bar comes up with one toast, and the wall remembers (wall-welcomed, wall-sets).
let welcomed = false;
try { welcomed = localStorage.getItem("wall-welcomed") === "1"; } catch { /* fresh */ }
const pickedSets = new Set();
try { for (const id of JSON.parse(localStorage.getItem("wall-sets") || "[]") || []) pickedSets.add(id); } catch { /* none */ }
const persistSets = () => { try { localStorage.setItem("wall-sets", JSON.stringify([...pickedSets])); } catch { /* private mode */ } };
const wel = { on: false, step: 0, imp: null, src: "", picks: new Set(), own0: 0, chased: false, only: false, key: "" };

// ----- the sheet -----
const welEl = document.createElement("section");
welEl.className = "welcome glass"; welEl.id = "welcome"; welEl.setAttribute("aria-label", "Welcome");
welEl.innerHTML = `<div class="w-top"><span class="w-dots" aria-hidden="true"><i></i><i></i><i></i></span><button type="button" class="w-skip" id="w-skip">Skip</button></div>
<div class="w-row"><div class="w-text"><b id="w-title"></b><span id="w-line" aria-live="polite"></span></div><div class="w-tally" id="w-tally"><b id="w-n">0</b><small id="w-what"></small></div></div>
<div class="w-prog" id="w-prog" hidden><i></i></div>
<div class="w-acts"><button type="button" class="mbtn primary w-next" id="w-next">Continue</button>
<div class="w-src" id="w-src" hidden><button type="button" class="mbtn primary" data-src="TCGplayer">TCGplayer</button><button type="button" class="mbtn primary" data-src="Collectr">Collectr</button></div>
<span class="w-or" id="w-or" hidden>or</span><button type="button" class="mbtn w-alt" id="w-alt" hidden>Pick your sets and mark by hand</button></div>`;
document.body.append(welEl);
const wTitle = welEl.querySelector("#w-title"), wLine = welEl.querySelector("#w-line"), wN = welEl.querySelector("#w-n"), wWhat = welEl.querySelector("#w-what"), wNext = welEl.querySelector("#w-next"), wSkip = welEl.querySelector("#w-skip"), wDots = [...welEl.querySelectorAll(".w-dots i")];
const wProg = welEl.querySelector("#w-prog"), wSrc = welEl.querySelector("#w-src"), wOr = welEl.querySelector("#w-or"), wAlt = welEl.querySelector("#w-alt"), wTally = welEl.querySelector("#w-tally");

const ownedTotal = () => cards.filter((c) => c.owned).length;
const chaseTotal = () => cards.filter(isChase).length;
// What the sheet says depends on the step and on where you are, so a collector who goes ahead by themselves is never
// told to do something the wall can't do right now.
function welcomeSync() {
  if (!wel.on) return;
  const inSet = view === "set" && Boolean(state.g);
  const marked = wel.step === 2 ? Math.max(0, ownedTotal() - wel.own0) : 0, chasing = wel.step === 3 ? chaseTotal() : 0;
  const key = `${wel.step}|${wel.imp}|${inSet}|${marking}|${mode}|${wel.picks.size}|${marked}|${chasing}|${wel.chased}|${wel.only}`;
  if (key === wel.key) return;
  wel.key = key;
  wDots.forEach((d, i) => d.classList.toggle("on", i === wel.step - 1));
  welEl.classList.toggle("only", wel.only); welEl.classList.toggle("intro", wel.step === 0);
  wProg.hidden = wel.imp !== "busy"; wSrc.hidden = wel.imp !== "pick"; wOr.hidden = wel.step !== 0 || wel.imp === "busy"; wAlt.hidden = wel.step !== 0 || wel.imp === "busy";
  wNext.hidden = wel.step === 0 && wel.imp !== null; wSkip.hidden = wel.imp === "busy"; wSkip.textContent = wel.only ? "Cancel" : "Skip"; wTally.hidden = wel.step === 0;
  if (wel.step === 0) {
    if (wel.imp === "busy") { wTitle.textContent = "Looking for your collection"; wLine.textContent = `Reading your ${wel.src} collection. About a second.`; }
    else if (wel.imp === "pick") { wTitle.textContent = "Import your collection"; wLine.textContent = "Where do you keep it? The import is pretend in this demo."; wAlt.textContent = "Mark by hand instead"; }
    else { wTitle.textContent = "Welcome to your wall"; wLine.textContent = "Every card you collect, on one wall. Bring your collection in, or mark it by hand."; wNext.textContent = "Import from TCGplayer or Collectr"; wNext.disabled = false; wAlt.textContent = "Pick your sets and mark by hand"; }
  } else if (wel.step === 1) {
    wTitle.textContent = "Which sets do you collect?";
    wLine.textContent = mode !== "set" ? "Choose Set chase (top left) to pick sets." : wel.picks.size ? "Tap more, or continue. The others fold back." : "Tap the sets you collect. The others fold back.";
    wN.textContent = String(wel.picks.size); wWhat.textContent = wel.picks.size === 1 ? "set" : "sets";
    wNext.textContent = wel.only ? "Done" : "Continue"; wNext.disabled = !wel.only && !wel.picks.size;
  } else if (wel.step === 2) {
    wTitle.textContent = "Mark a few you have";
    wLine.textContent = !inSet ? "Open a set to mark what you have." : marking ? "Tap a card you have, or drag across a row." : "Press and hold a card you have, then sweep along the row.";
    wN.textContent = String(marked); wWhat.textContent = "marked";
    wNext.textContent = "Continue"; wNext.disabled = false;
  } else {
    wTitle.textContent = "Chase one";
    wLine.textContent = wel.chased ? "It's on your chase list. Chase, at the bottom, keeps everything you're after." : !inSet ? "Open a set, then press and hold a card you don't have." : "Press and hold a card you don't have to put it on your chase list.";
    wN.textContent = String(chasing); wWhat.textContent = "chasing";
    wNext.textContent = "Done"; wNext.disabled = false;
  }
  wN.classList.toggle("zero", wN.textContent === "0");
  // Steps 0 and 1 live on the mosaic: once a set is open you have gone ahead, so the sheet goes with you.
  if (wel.step <= 1 && inSet && !wel.only && wel.imp !== "busy") { if (state.g.set) wel.picks.add(state.g.set.id); wel.imp = null; gotoStep(2); }
  if (wel.step === 3 && chasing && !wel.chased) { wel.chased = true; welcomeSync(); }
  // Step 3 needs Mark mode (a hold outside it marks the card as yours): a set that opens during it enters Mark.
  if (wel.step === 3 && inSet && !marking && !state.trans && !state.focus) enterMark();
}
function gotoStep(n) {
  wel.step = n; wel.key = ""; wel.imp = null;
  tick(4); welcomeSync(); kick();
}
function startWelcome({ only = false } = {}) {
  wel.on = true; wel.step = only ? 1 : 0; wel.imp = null; wel.only = only; wel.chased = false; wel.key = "";
  wel.picks = new Set(only ? pickedSets : []);
  wel.own0 = ownedTotal();
  document.body.classList.add("welcoming");
  if (only && view === "set") exitToMosaic();
  welcomeSync();
  setTimeout(() => welEl.classList.add("on"), reduced ? 0 : 700);
  kick();
}
// Continue: step 1 folds the unpicked sets back and opens the first picked one in Mark mode; step 2 keeps Mark mode
// on for the chase; step 3 is Done.
wNext.onclick = () => {
  if (!wel.on || state.trans) return;
  if (wel.step === 0) { wel.imp = "pick"; wel.key = ""; tick(4); welcomeSync(); return; }
  if (wel.step === 1) {
    const changed = pickedSets.size !== wel.picks.size || [...wel.picks].some((id) => !pickedSets.has(id));
    pickedSets.clear(); for (const id of wel.picks) pickedSets.add(id); persistSets();
    const first = groups.find((g) => g.set && wel.picks.has(g.set.id));
    const after = () => { if (wel.only) finishWelcome(true); else { gotoStep(2); if (first) enterGroup(first, { then: () => { enterMark(); welcomeSync(); } }); } };
    if (changed && view === "mosaic" && mode === "set") foldFlight(after); else after();
    return;
  }
  if (wel.step === 2) { gotoStep(3); return; }
  finishWelcome(false);
};
wAlt.onclick = () => { if (!wel.on) return; if (wel.imp === "pick") { wel.imp = null; wel.key = ""; welcomeSync(); } else gotoStep(1); };
wSrc.querySelectorAll("[data-src]").forEach((b) => (b.onclick = () => startImport(b.dataset.src)));
wSkip.onclick = () => finishWelcome(true);
function finishWelcome(skipped) {
  if (!wel.on) return;
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); } // the marks stay; no summary toast on top of the lens one
  if (wel.only) { kick(); return; }
  if (!skipped && view === "set" && !state.trans) exitToMosaic();
  setTimeout(() => toast("Have, Need, Chase and Trade recolor the wall. Tap a set to open it."), skipped ? 300 : 700);
  kick();
}
// ----- the import (pretend): the seeded demo ownership, computed the way 10-model.js does, as if it came from the file -----
const SEED_START = Date.parse("2023-01-15"), SEED_BINDER = Date.parse("2024-03-09");
const seededOwned = (c) => h32(c.id + "o") < clamp(OWN_RATE[sets[c.si].id] * (c.tier <= 1 ? 1.3 : c.tier === 2 ? 1 : c.tier === 3 ? 0.66 : 0.32), 0, 0.97);
function seededGot(c) {
  const st = sets[c.si];
  if (st.year < 2003 && h32(c.id + "g") < 0.72) return SEED_BINDER + h32(c.id + "h") * 6 * 3600e3;
  const from = Math.max(SEED_START, st.released || SEED_START);
  return from + Math.pow(h32(c.id + "t"), 0.8) * Math.max(0, Date.now() - from - 86400e3);
}
function startImport(src) {
  if (!wel.on || wel.imp === "busy") return;
  wel.imp = "busy"; wel.src = src; wel.key = ""; tick(4); welcomeSync();
  setTimeout(() => finishImport(src), reduced ? 250 : 1100);
}
// The imported cards flood into the wall set by set (the marking flood, a beat apart), and the welcome is over.
function finishImport(src) {
  if (!wel.on) return;
  const now = performance.now();
  let n = 0;
  for (const c of cards) {
    if (c.owned || !seededOwned(c)) continue;
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; n++;
    if (!reduced) c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true };
  }
  persist();
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  updateCount(); drawList(); if (lifted) liftLayout(true);
  tick(14);
  setTimeout(() => toast(`${n.toLocaleString()} cards imported from ${src}.`), reduced ? 100 : 500);
  kick();
}

// Picked sets stay as panels; the rest fold to a line (every card flies to its new place, the way a lens does).
function foldFlight(then) {
  mScroll = 0;
  for (const c of cards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  for (const c of cards) c.delay = reduced ? 0 : Math.min(360, c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: performance.now(), dur: reduced ? 1 : 1100, done: () => { for (const g of groups) g.pm = null; kick(); then?.(); } };
  tick(10); kick();
}
function togglePick(g) {
  if (!g.set) return;
  if (wel.picks.has(g.set.id)) wel.picks.delete(g.set.id); else wel.picks.add(g.set.id);
  tick(6); wel.key = ""; welcomeSync(); kick();
}

// ----- the mosaic with your sets in front: picked sets share the screen, the others fold to a line beneath -----
const W_FOLD = 50;
function mosaicLayout() {
  const picking = mode === "set" && pickedSets.size && pickedSets.size < groups.length && groups.every((g) => g.set);
  const fitH = vh - topPad() - botPad();
  if (!picking) {
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
  const mine = groups.filter((g) => pickedSets.has(g.set.id)), rest = groups.filter((g) => !pickedSets.has(g.set.id));
  const n = mine.reduce((a, g) => a + g.cards.length, 0);
  const R = { x: 8, y: topPad(), w: vw - 16, h: Math.max(fitH - rest.length * W_FOLD, fitH * 0.62, (n * 340) / (vw - 16)) };
  const items = mine.map((g) => ({ g, v: Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  stripTreemap(items, R);
  let y = R.y + R.h;
  for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  for (const g of mine) packPanel(g);
  for (const g of rest) packFolded(g);
}

// ----- picking: a tap on a panel ticks it (step 1 only); everything else taps as before -----
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (wel.step === 1 && view === "mosaic" && mode === "set" && !lifted && !state.focus && h?.block) return togglePick(h.block);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return openTable(ch.t, ch); // a trader: the table
    if (h?.block && lifted) {
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") { // a spare: the table with whoever wants it
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return openTable(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m)); // a chased card: every offer online
    }
    if (h?.block) enterGroup(h.block);
    return;
  }
  if (!h?.card) return;
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned); // in mark mode a tap toggles the card
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}
// While picking, the panel's count gives way to its tick (two em spaces keep the name clear of it).
function panelStat(g) {
  if (wel.step === 1 && mode === "set" && !lifted && !state.matches) return "\u2003\u2003";
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(c)).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
// While picking, the sets you haven't ticked sit back a little once you've ticked one.
function drawMosaic(now, alpha = 1, except = null) {
  const picking = wel.step === 1 && mode === "set" && !lifted && wel.picks.size > 0;
  let settling = false;
  for (const g of groups) {
    const t = picking && g.set && !wel.picks.has(g.set.id) ? 0.42 : 1;
    g.pe ??= 1;
    if (Math.abs(g.pe - t) > 0.01) { g.pe += (t - g.pe) * (reduced ? 1 : 0.16); settling = true; } else g.pe = t;
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    const a = alpha * g.pe;
    drawPanel(g, now, a);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, a);
  }
  if (settling) kick();
}
// The ticks, drawn over the mosaic after everything else (this is the base drawMarks with the picks added).
function drawMarks() {
  drawPicks();
  if (!marking || view !== "set" || !state.g || state.trans || !session.size) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [c, was] of session) {
    if (c.owned === was || groups[c.g] !== state.g) continue;
    const r = binderRect(c, cam);
    if (r.y > vh || r.y + r.h < 0 || r.x > vw || r.x + r.w < 0) continue;
    const R = clamp(r.w * 0.11, 5, 12), x = r.x + R + r.w * 0.07, y = r.y + R + r.w * 0.07;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = c.owned ? theme.deal : theme.muted; ctx.fill();
    ctx.lineWidth = Math.max(1.5, R * 0.24); ctx.strokeStyle = "#fff"; ctx.beginPath();
    if (c.owned) { ctx.moveTo(x - R * 0.45, y + R * 0.02); ctx.lineTo(x - R * 0.12, y + R * 0.36); ctx.lineTo(x + R * 0.48, y - R * 0.36); }
    else { ctx.moveTo(x - R * 0.42, y); ctx.lineTo(x + R * 0.42, y); }
    ctx.stroke();
  }
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}
function drawPicks() {
  if (wel.step !== 1 || view !== "mosaic" || mode !== "set" || lifted || state.trans) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const g of groups) {
    if (!g.set || !g.m) continue;
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
// The sheet follows every change on the wall: kick is what every change calls.
function kick() {
  welcomeSync();
  if (raf) return;
  raf = requestAnimationFrame(frame);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; frame(performance.now()); } }, 120);
}

// ----- settings: choose your sets again; reset returns to the fresh start -----
const wSetsBtn = document.createElement("button");
wSetsBtn.type = "button"; wSetsBtn.className = "btn"; wSetsBtn.id = "w-sets"; wSetsBtn.textContent = "Choose your sets";
document.getElementById("reset").before(wSetsBtn);
wSetsBtn.onclick = () => { prefs.close(); if (wel.on) return; if (mode !== "set") rearrange("set"); if (state.lens !== "have") setLens("have"); startWelcome({ only: true }); };
document.getElementById("reset").onclick = () => {
  saved = {}; persist();
  try { for (const k of ["wall-chase", "wall-spares", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value"]) localStorage.removeItem(k); } catch { /* fine */ }
  location.reload();
};
// A first run: the sheet comes up once the wall has inked in. (Start runs after this part; the timeout runs after start.)
if (!welcomed) { document.body.classList.add("welcoming"); setTimeout(() => startWelcome(), 0); }
