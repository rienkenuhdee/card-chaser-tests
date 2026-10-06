// ---------- welcome: the first 30 seconds ----------
// The wall starts empty. A short glass sheet over it, like an app's first run; the wall under it keeps working (a
// pinch still opens a set, a drag still scrolls) and the sheet follows what you did.
//   0. Import from TCGplayer or Collectr (first and biggest), or pick your sets and mark by hand. The import is
//      simulated: pick the source, a second of "Looking for your collection", then the seeded demo collection (the
//      541 cards the demo used to ship with) floods into the wall set by set. "Chase every card I'm missing" puts the
//      rest on your chase list as it comes in.
//   1. Which sets do you collect? The mosaic's panels become pickable (tap to tick). Continue folds the rest back.
//   2. Mark a few you have. The first picked set opens in Mark mode; Select all takes the whole set.
//   3. Chase one. Press and hold a card you don't have; it goes on your chase list.
// Then the sheet goes, the lens bar comes up with one toast, and the wall remembers (wall-welcomed, wall-sets).
let welcomed = false;
try { welcomed = localStorage.getItem("wall-welcomed") === "1"; } catch { /* fresh */ }
const pickedSets = new Set();
try { for (const id of JSON.parse(localStorage.getItem("wall-sets") || "[]") || []) pickedSets.add(id); } catch { /* none */ }
const persistSets = () => { try { localStorage.setItem("wall-sets", JSON.stringify([...pickedSets])); } catch { /* private mode */ } };
const wel = { on: false, step: 0, imp: null, src: "", picks: new Set(), own0: 0, chased: false, only: false, key: "" };
const picking = () => wel.step === 1 && view === "mosaic" && mode === "set" && !lifted && !state.matches && !state.trans;

// ----- the sheet -----
const welEl = document.getElementById("welcome");
const wTitle = welEl.querySelector("#w-title"), wLine = welEl.querySelector("#w-line"), wN = welEl.querySelector("#w-n"), wWhat = welEl.querySelector("#w-what"), wNext = welEl.querySelector("#w-next"), wSkip = welEl.querySelector("#w-skip"), wDots = [...welEl.querySelectorAll(".w-dots i")];
const wProg = welEl.querySelector("#w-prog"), wSrc = welEl.querySelector("#w-src"), wOr = welEl.querySelector("#w-or"), wAlt = welEl.querySelector("#w-alt"), wTally = welEl.querySelector("#w-tally"), wOpt = welEl.querySelector("#w-opt"), wChase = welEl.querySelector("#w-chase"), wAll = welEl.querySelector("#w-all");

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
  wProg.hidden = wel.imp !== "busy"; wSrc.hidden = wel.imp !== "pick"; wOpt.hidden = wel.imp !== "pick"; wOr.hidden = wel.step !== 0 || wel.imp === "busy"; wAlt.hidden = wel.step !== 0 || wel.imp === "busy";
  wNext.hidden = wel.step === 0 && wel.imp !== null; wSkip.hidden = wel.imp === "busy"; wSkip.textContent = wel.only ? "Cancel" : "Skip"; wTally.hidden = wel.step === 0;
  wAll.hidden = !(wel.step === 2 && inSet && marking);
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
    wLine.textContent = !inSet ? "Open a set to mark what you have." : marking ? "Tap a card you have, drag across a row, or take the whole set." : "Press and hold a card you have, then sweep along the row.";
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
wAll.onclick = () => { markAllInSet(); wel.key = ""; welcomeSync(); };
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

// ----- the import (pretend): the seeded demo collection, as if it came from the file -----
const SEED_START = Date.parse("2023-01-15"), SEED_BINDER = Date.parse("2024-03-09");
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
  const now = performance.now(), chaseAll = wChase.checked;
  let n = 0, k = 0;
  for (const c of cards) {
    if (c.owned || !c.own0) { if (chaseAll && !c.owned) { chasing[c.id] = true; k++; } continue; }
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; n++;
    if (!reduced) c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true };
  }
  persist(); if (chaseAll) persistChase();
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  updateCount(); drawList(); if (lifted) liftLayout(true);
  tick(14);
  setTimeout(() => toast(`${n.toLocaleString()} cards imported from ${src}.${chaseAll ? ` ${k.toLocaleString()} on your chase list.` : ""}`), reduced ? 100 : 500);
  kick();
}

// Picked sets stay as panels; the rest fold to a line (every card flies to its new place, the way a lens does).
function foldFlight(then) {
  mScroll = 0;
  for (const c of drawnCards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  for (const c of drawnCards) c.delay = reduced ? 0 : Math.min(360, c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: performance.now(), dur: reduced ? 1 : 1100, done: () => { for (const g of groups) g.pm = null; kick(); then?.(); } };
  tick(10); kick();
}
function togglePick(g) {
  if (!g.set) return;
  if (wel.picks.has(g.set.id)) wel.picks.delete(g.set.id); else wel.picks.add(g.set.id);
  tick(6); wel.key = ""; welcomeSync(); kick();
}
// The ticks on the panels while you pick, drawn over the mosaic after everything else.
function drawPicks() {
  if (!picking()) return;
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
// Settings: choose your sets again.
document.getElementById("w-sets").onclick = () => { prefs.close(); if (wel.on) return; if (mode !== "set") rearrange("set"); if (state.lens !== "have") setLens("have"); startWelcome({ only: true }); };
