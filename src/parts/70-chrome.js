// ---------- toast, about ----------
const toastEl = document.getElementById("toast");
function toast(t, action = null, label = "Undo") {
  toastEl.textContent = t;
  if (action) {
    const b = document.createElement("button"); b.textContent = label; b.className = "toast-btn";
    b.onclick = () => { toastEl.classList.remove("show"); action(); };
    toastEl.append(" ", b);
  }
  toastEl.classList.toggle("act", Boolean(action));
  placeToast();
  toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), action ? 4500 : 2200);
}
// A message takes the top bar for a moment, from the search to the right end (in the trade binder, its title), in the
// bar's own colours: never a banner over the wall. A tap on the bar goes through to it, and the message steps aside.
function placeToast() {
  const R = (el) => el?.getBoundingClientRect(), wide = (r) => r && r.width >= 160 && r.top + r.height > 0;
  const cl = document.body.classList;
  let r = null;
  if (cl.contains("inbinder") && !cl.contains("trading")) {
    const b = R(document.getElementById("bbar")), s = R(document.getElementById("bb-show"));
    if (b && s) r = { left: b.left + 46, top: b.top + 2, width: s.left - 8 - (b.left + 46), height: b.height - 4 };
  }
  if (!wide(r)) {
    const q = R(document.getElementById("search")), t = R(document.querySelector(".top .strip"));
    if (q && q.width > 0 && t) r = { left: q.left, top: t.top + 3, width: t.right - 3 - q.left, height: t.height - 6 }; // filters, settings and about wait under it; Back and Mark stay in reach
  }
  if (!wide(r)) {
    const t = R(document.querySelector(".top .strip")), right = innerWidth - Math.max(10, SAFE.right || 0);
    r = t && t.width ? { left: t.right + 8, top: t.top + 5, width: right - t.right - 8, height: t.height - 10 } : null;
    if (!wide(r)) r = { left: 10, top: (t?.top ?? 10) + 5, width: innerWidth - 20, height: 40 };
  }
  Object.assign(toastEl.style, { left: `${Math.round(r.left)}px`, top: `${Math.round(r.top)}px`, width: `${Math.round(r.width)}px`, minHeight: `${Math.round(r.height)}px` });
}
// The bar changes under a message (a set opens and Back and Mark come in): it moves with the search it sits over.
if (window.ResizeObserver) new ResizeObserver(() => { if (toastEl.classList.contains("show")) placeToast(); }).observe(document.getElementById("search"));
// A message takes no taps but its button's: a tap on the bar reaches what's under it (Filters, settings, the search),
// and the message steps aside for it.
addEventListener("pointerdown", (e) => { if (toastEl.classList.contains("show") && e.target.closest?.(".top .strip, #bbar")) { toastEl.classList.remove("show"); clearTimeout(toast.t); } }, true);
// A sheet coming up takes focus for the keyboard without lighting a button for a tap: after a key, its button takes
// focus (with its ring); after a touch or a click, the sheet itself does (no ring), and Tab still reaches the button.
let keyed = false;
addEventListener("keydown", (e) => { if (!e.metaKey && !e.ctrlKey && !e.altKey) keyed = true; }, true);
for (const t of ["pointerdown", "touchstart"]) addEventListener(t, () => { keyed = false; }, { capture: true, passive: true });
function focusFor(el, box) {
  if (!el) return;
  if (keyed || !box) { el.focus({ preventScroll: true }); return; }
  if (!box.hasAttribute("tabindex")) box.tabIndex = -1;
  box.focus({ preventScroll: true });
}
const about = document.getElementById("about");
document.getElementById("info").onclick = () => about.showModal();
document.getElementById("about-close").onclick = () => about.close();
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases", "wall-scope", "wall-done", "wall-spares", "wall-copies", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value", "wall-show", "wall-order", "wall-corder", "wall-feed-view", "wall-medals", "wall-dated", "wall-arrival", "wall-feed-seen", "wall-sources-off", "wall-map-seen", "wall-checker", "wall-tb-hint", "wall-graded"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ---------- settings: appearance, the list, reset ----------
const prefs = document.getElementById("prefs");
document.getElementById("settings").onclick = () => prefs.showModal();
document.getElementById("prefs-close").onclick = () => prefs.close();
function setTheme(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  prefs.querySelectorAll("[data-theme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === t)));
  try { localStorage.setItem("wall-theme", t); } catch { /* fine */ }
  readTheme(); kick();
}
prefs.querySelectorAll("[data-theme]").forEach((b) => (b.onclick = () => setTheme(b.dataset.theme)));

// ---------- home: tap the count to see the whole wall (from any room) ----------
document.getElementById("count").addEventListener("click", (e) => { e.preventDefault(); if (view === "set") exitToMosaic(); else goRoom("chase"); });

// ---------- rearrange: Group by (Filters) and the order in a binder, every card flying to its new place ----------
const GROUP_SAY = { set: "Your sets and chases, oldest first", value: "Grouped by price: the more it's worth, the bigger", rarity: "Grouped by rarity, rarest first", type: "Grouped by type" };
// Where a tile is drawn right now: mid-flight, between its last place and its next (so a second change flies on from there).
function tileNow(c, T, now) {
  if (!c.pm || !c.m) return c.m;
  const k = ease(clamp((now - T.t0 - c.delay) / (T.dur - 520), 0, 1)), a = c.pm, b = c.m;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
}
// The mosaic takes a new shape (fn), every tile flying from where it is to its new place, a beat apart.
function morphTo(fn) {
  const T = state.trans, now = performance.now();
  const at = T?.kind === "morph" ? new Map(drawnCards.map((c) => [c, tileNow(c, T, now)])) : null;
  if (T) finishTransition();
  for (const c of drawnCards) c.pm = { ...((at && at.get(c)) || c.m) };
  const was = new Set(drawnCards);
  fn(); layoutAll(); markFilters();
  for (const c of drawnCards) { if (!was.has(c)) c.pm = { ...(c.base?.pm || c.m) }; }
  for (const c of drawnCards) c.delay = reduced ? 0 : Math.min(520, c.g * 60 + c.k * 0.7);
  for (const g of groups) { g.ripple = null; g.burst = 0; }
  state.trans = { kind: "morph", t0: performance.now(), dur: reduced ? 1 : 1300, done: () => kick() };
  tick(10);
}
// A morph or a fingers-free move can be overtaken; a transition under the fingers can't.
const busy = () => state.trans && !(state.trans.kind === "morph" || state.trans.anim || state.trans.t0);
function rearrange(m, { quiet = false } = {}) {
  if (m === mode || busy()) return;
  if (state.trans && state.trans.kind !== "morph") finishTransition();
  unfocus(); hideCaption(); if (bnd.on) closeBinder(true);
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  if (document.body.classList.contains("listmode")) { arrange(m); layoutAll(); markFilters(); }
  else morphTo(() => arrange(m));
  if (!quiet) say(GROUP_SAY[m]);
  drawList(); kick();
}
// The order in a binder changed: inside one, its cards travel from their old pockets to their new ones; on the
// mosaic, the tiles reshuffle in their panels.
function reorder(line) {
  hideCaption();
  const still = document.body.classList.contains("listmode") || bnd.on || tbl.on || busy() || (view === "mosaic" && room.on);
  if (still) { arrange(mode); layoutAll(); }
  else if (view === "set" && state.g) {
    const g = state.g, now = performance.now();
    if (state.focus) unfocus();
    if (state.trans) finishTransition();
    for (const c of g.cards) { c.px = c.x; c.py = c.y; }
    arrange(mode); layoutAll();
    if (!reduced && !g.natdex) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.4); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
    tick(8);
  } else morphTo(() => arrange(mode));
  say(line); drawList(); kick();
}

// ---------- the list: the same wall, readable by a screen reader or a keyboard ----------
const listEl = document.getElementById("list");
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (!document.body.classList.contains("listmode")) return;
  const sh = showNow(), show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "chase" ? isChase(c) : sh === "missing" ? !c.owned : sh === "have" ? c.owned : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || chaseCmp(a, b) || a.i - b.i);
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to go, by set. ${state.corder === "dear" ? "Dearest first." : state.corder === "cheap" ? "Cheapest to get first." : "Live deals first."}</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to chase yet.</p>`}<p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
  }
  const row = (c) => {
    const st = sets[c.si];
    return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}${slabsOf(c).length ? ` <span class="lslab">${slabBadge(slabsOf(c))}</span>` : ""}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${lstateOf(c)}</span></button></li>`;
  };
  const rows = (items) => `<ul>${items.map(row).join("")}</ul>`;
  // The rooms read as sections: the Feed's listings first, then the wall (its lens, the trophies, the sets), then
  // Trade (the binder and who wants what) and Source (its switches work here too).
  listEl.querySelector("#list-body").innerHTML = feedListHTML() + top + trophyListHTML(show, rows) + (groups.map((g) => {
    if (g.done) return "";
    const items = g.cards.filter((c) => !c.ph && show(c)); // a Dex pocket with no card isn't a row
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}${orderNote(g)}</p><ul>${items.map(row).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens and these filters.</p>`) + tradeListHTML() + sourceListHTML();
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-got]"); if (b) gotIt(pool[Number(b.dataset.got)]); });
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const c = pool[Number(b.dataset.i)]; setOwned(c, !c.owned, { undo: () => setOwned(c, !c.owned, { quiet: true }) }); });
function setListMode(on) {
  if (on) leaveMark(); // the list has its own way to mark (tap a row)
  document.body.classList.toggle("listmode", on);
  try { localStorage.setItem("wall-list", on ? "1" : ""); } catch { /* fine */ }
  unfocus(); drawList();
  if (on) listEl.querySelector("h1")?.focus(); else { kick(); canvas.focus(); }
}
document.getElementById("to-list").onclick = () => { prefs.close(); setListMode(true); };
document.getElementById("to-wall").onclick = () => setListMode(false);
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { toast: { value: toast } }); }, 0);
