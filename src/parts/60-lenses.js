// ---------- lenses: Have, Need, Chase, Trade ----------
// A lens recolors the wall rather than taking you somewhere else. Chase deals your chase list out of the wall.
const lensBox = document.querySelector(".lens"), lensInk = lensBox.querySelector(".ink");
function placeInk() {
  const b = lensBox.querySelector('[aria-pressed="true"]');
  lensInk.style.setProperty("--x", `${b.offsetLeft}px`); lensInk.style.setProperty("--w", `${b.offsetWidth}px`);
}
function setLens(lens) {
  if (lens === state.lens) return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "have") { const n = cards.filter((c) => c.owned).length; toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection`); }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  if (lens === "chase") { const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length; toast(n ? `${n} on your chase list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your chase list yet. Open a card and choose Chase it."); }
  if (lens === "trade") { const n = cards.filter(isSpare).length; toast(n ? `${n} spare${n === 1 ? "" : "s"} to trade` : "No spares yet. Open a card you own and choose Spare."); }
  if (was === "chase") closePop(true);
  liftLayout(); drawList(); updateCount(); kick();
}
lensBox.querySelectorAll("button").forEach((b) => (b.onclick = () => setLens(b.dataset.lens)));
// force: the chase list changed while it is out (Chase it, Got it, Undo), so the layout flies to its new shape.
function liftLayout(force = false) {
  const want = state.lens === "chase" || state.lens === "trade";
  const same = want === lifted && (!want || state.lens === liftKey); // Chase to Trade is a flight too
  if (same && !(force && lifted)) { layoutAll(); return; }
  const T = state.trans;
  if (T && !(T.anim || T.t0)) { layoutAll(); return; } // fingers are holding a transition: relayout under it
  if (T) finishTransition();
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
  // The chased cards leave first, so the eye follows them to the front; the rest trail in a beat behind.
  for (const c of cards) c.delay = reduced ? 0 : Math.min(400, (c.lift ? 0 : 90) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}

// ---------- filters: Value and Time, by the search box ----------
// They sit on top of any lens: Value colours every card by what it's worth; Time scrubs or plays through when you got
// each card. The button lights while one is on.
const filterBtn = document.getElementById("filter"), filterMenu = document.getElementById("filter-menu");
function setFilterMenu(open) { filterMenu.hidden = !open; filterBtn.setAttribute("aria-expanded", String(open)); if (open) filterMenu.querySelector("[data-filter]")?.focus(); }
filterBtn.onclick = (e) => { e.stopPropagation(); setMenu(false); setFilterMenu(filterMenu.hidden); };
addEventListener("pointerdown", (e) => { if (!filterMenu.hidden && !e.target.closest("#filter-menu, #filter")) setFilterMenu(false); });
filterMenu.addEventListener("keydown", (e) => { if (e.key === "Escape") { setFilterMenu(false); filterBtn.focus(); } });
function markFilters() {
  filterMenu.querySelector('[data-filter="value"]').setAttribute("aria-checked", String(state.value));
  filterMenu.querySelector('[data-filter="time"]').setAttribute("aria-checked", String(state.time));
  filterBtn.setAttribute("aria-pressed", String(state.value || state.time));
}
function setValue(on) {
  state.value = on; markFilters(); tick(5);
  try { localStorage.setItem("wall-value", on ? "1" : ""); } catch { /* fine */ }
  if (on) { const v = cards.reduce((a, c) => a + (c.owned ? c.price : 0), 0); toast(`Your collection: about ${money(v)}`); }
  drawList(); kick();
}
function setTime(on) {
  state.time = on; markFilters(); tick(5); hideCaption();
  document.body.classList.toggle("timing", on);
  if (on) { drawSpark(); playTime(true); } else { stopTime(); state.t = Date.now(); }
  layoutAll(); updateCount(); drawList(); kick();
}
filterMenu.querySelectorAll("[data-filter]").forEach((b) => (b.onclick = () => {
  setFilterMenu(false);
  if (b.dataset.filter === "value") setValue(!state.value); else setTime(!state.time);
}));
