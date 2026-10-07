// ---------- lenses: Collection and Chase ----------
// A lens recolors the wall rather than taking you somewhere else. Collection is the wall as it is: what you have in
// colour, what you're missing as empty pockets. Chase deals your chase list out of the wall: one tile per card you
// chase, its best deal leading. (Trade became a room in round 21, and every listing lives in the Feed. Need, the
// collection with what you have dimmed, is Show: Missing in Filters now; the lens value "have" is Collection.)
const lensBox = document.querySelector(".lens"), lensInk = lensBox.querySelector(".ink"), lensBtns = [...lensBox.querySelectorAll("[data-lens]")];
function placeInk() {
  const b = lensBox.querySelector('[data-lens][aria-pressed="true"]');
  lensInk.style.setProperty("--x", `${b.offsetLeft}px`); lensInk.style.setProperty("--w", `${b.offsetWidth}px`);
}
function setLens(lens) {
  if (lens === "need") { setShow("missing"); lens = "have"; } // the old Need lens
  if (lens === state.lens) return;
  lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "have") collectionToast();
  if (lens === "chase") chaseToast();
  if (was === "chase") closePop(true);
  markFilters(); // the sheet's rows and the chip follow the lens
  liftLayout(); drawList(); updateCount(); kick();
}
lensBtns.forEach((b) => (b.onclick = () => setLens(b.dataset.lens)));
function collectionToast() {
  const n = cards.filter((c) => c.owned).length, s = spareCount(), sh = state.show;
  toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection${s ? `, ${s} spare${s === 1 ? "" : "s"}` : ""}${sh === "missing" ? ". Showing what's missing" : sh === "have" ? ". Showing what you have" : ""}`);
}
// The Chase lens is your want list, one card each with its best deal; the Feed is every listing found. The toast says
// which is which, and opens the Feed when there's something in it.
function chaseToast() {
  const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length, L = feedList().length;
  if (!n) { toast("Nothing on your chase list yet. Open a card and choose Chase it."); return; }
  toast(`Your chase list: ${n.toLocaleString()} ${n === 1 ? "card" : "cards"}${d ? `, ${d} under market` : ""}`, L ? () => goRoom("feed") : null, "Feed"); // every listing: the Feed
}
// force: the chase list changed while it is out (Chase it, Got it, Undo), so the layout flies to its new shape.
function liftLayout(force = false) {
  const want = state.lens === "chase";
  const same = want === lifted && (!want || state.lens === liftKey); // Chase to Trade is a flight too
  if (same && !(force && lifted)) { layoutAll(); return; }
  if (tbl.on || bnd.on) { layoutAll(); kick(); return; } // nothing of the wall shows under the table or the binder: no flight to watch
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
  for (const c of drawnCards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  // The chased cards leave first, so the eye follows them to the front; the rest trail in a beat behind.
  for (const c of drawnCards) c.delay = reduced ? 0 : Math.min(400, (c.lift ? 0 : 90) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}


// ---------- Filters: what the wall shows, its colour, its groups, the order in a binder, and Time ----------
// One sheet under the Filters button, every choice kept on this device. Show dims what it leaves out the way search
// does; Group by flies every card to its new place; the order in a binder reshuffles each binder in place. While a
// filter is on (Show, Color by value, a grouping other than sets, Time) the button is lit and a chip beside the lenses
// names it, with an X that clears them. Orders aren't filters: a binder's header says its order, and the Chase lens is
// an order of its own.
const filterBtn = document.getElementById("filter"), filterMenu = document.getElementById("filter-menu");
const fchip = document.getElementById("fchip"), fchipOpen = document.getElementById("fchip-open");
const pref = (k, ok, d) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : d; } catch { return d; } };
const keepPref = (k, v, d) => { try { if (v === d) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* fine */ } };
state.show = pref("wall-show", ["all", "missing", "have"], "all");
state.order = pref("wall-order", ["number", "price", "name", "rarity"], "number");
state.corder = pref("wall-corder", ["deal", "dear", "cheap"], "deal");
if (pref("wall-lens", ["need"], "") === "need") { state.lens = "have"; state.show = "missing"; keepPref("wall-lens", "have", ""); keepPref("wall-show", "missing", "all"); } // the old Need lens, remembered
const GROUP_NAMES = { set: "set", value: "price", rarity: "rarity", type: "type" };
const ORDER_NAMES = { number: "In number order", price: "Dearest first", name: "By name", rarity: "Rarest first" };
// What's on, in words for the chip. Show doesn't apply in Chase (the lens is its own view), so it isn't named there.
function filtersOn() {
  const on = [];
  if (state.lens !== "chase" && state.show !== "all") on.push(state.show === "missing" ? "Missing" : "Have");
  if (state.value) on.push("Value");
  if (mode !== "set") on.push(`By ${GROUP_NAMES[mode]}`);
  if (state.time) on.push("Time");
  return on;
}
// While the sheet is open it shows what changed, so a change's line waits and is said when the sheet closes (a toast
// would sit behind the sheet).
let sheetSay = null;
const say = (t) => { if (filterMenu.hidden) toast(t); else sheetSay = t; };
function setFilterMenu(open) {
  filterMenu.hidden = !open; filterBtn.setAttribute("aria-expanded", String(open));
  if (open) { sheetSay = null; toastEl.classList.remove("show"); markFilters(); focusFor(filterMenu.querySelector('.fs-row:not([hidden]) [aria-pressed="true"]'), filterMenu); }
  else if (sheetSay) { toast(sheetSay); sheetSay = null; }
}
filterBtn.onclick = (e) => { e.stopPropagation(); setFilterMenu(filterMenu.hidden); };
addEventListener("pointerdown", (e) => { if (!filterMenu.hidden && !e.target.closest("#filter-menu, #filter, #fchip")) setFilterMenu(false); });
filterMenu.addEventListener("keydown", (e) => { if (e.key === "Escape") { setFilterMenu(false); filterBtn.focus(); } });
function markFilters() {
  const chase = state.lens === "chase";
  const seg = (k, v) => filterMenu.querySelectorAll(`[data-${k}]`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[k] === v)));
  seg("show", state.show); seg("corder", state.corder); seg("color", state.value ? "value" : "type"); seg("group", mode); seg("order", state.order);
  filterMenu.querySelector('[data-row="show"]').hidden = chase; filterMenu.querySelector('[data-row="corder"]').hidden = !chase;
  filterMenu.querySelector('[data-filter="time"]').setAttribute("aria-checked", String(state.time));
  const on = filtersOn();
  filterBtn.setAttribute("aria-pressed", String(on.length > 0));
  filterBtn.setAttribute("aria-label", on.length ? `Filters: ${on.join(", ")}` : "Filters");
  document.getElementById("f-clear").disabled = !on.length;
  fchip.hidden = !on.length;
  fchipOpen.textContent = on.length === 1 ? on[0] : `${on.length} filters`;
  fchipOpen.setAttribute("aria-label", `Filters on: ${on.join(", ")}. Change them`);
  placeInk();
}
// Show: everything, only what you're missing (what was the Need lens: what you have dims, the ones you chase are
// ringed), or only what you have. It dims the rest rather than hiding it, so the wall keeps its shape.
function setShow(s, { quiet = false } = {}) {
  if (s === state.show) return;
  state.show = s; keepPref("wall-show", s, "all"); markFilters(); tick(5);
  if (!quiet) {
    if (s === "missing") { const n = cards.filter((c) => !c.owned).length, k = cards.filter(isChase).length; say(`${n.toLocaleString()} to go${!k ? "" : k >= n ? ", all on your chase list" : `, the ${k.toLocaleString()} you chase ringed in gold`}`); }
    else if (s === "have") { const n = cards.filter((c) => c.owned).length; say(`Just what you have: ${n.toLocaleString()} of ${TOTAL.toLocaleString()}`); }
    else say("Showing every card");
  }
  wallVer++; drawList(); kick();
}
function setValue(on, { quiet = false } = {}) {
  if (on === state.value) return;
  state.value = on; markFilters(); tick(5);
  try { localStorage.setItem("wall-value", on ? "1" : ""); } catch { /* fine */ }
  if (on && !quiet) { const v = cards.reduce((a, c) => a + (c.owned ? c.price : 0), 0); say(`Your collection: about ${money(v)}`); }
  drawList(); kick();
}
function setTime(on) {
  state.time = on; markFilters(); tick(5); hideCaption();
  document.body.classList.toggle("timing", on);
  if (on) { drawSpark(); playTime(true); } else { stopTime(); state.t = Date.now(); }
  layoutAll(); updateCount(); drawList(); kick();
}
// The order in a binder: number (the group's own order), price (dearest first), name, or rarity (rarest first), the
// same four as production's binders. The Complete Dex keeps Dex order. Ties keep the group's own order.
const RANKERS = { price: (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name), rarity: (a, b) => b.tier - a.tier };
function binderSorted(list) {
  const f = RANKERS[state.order]; if (!f) return list;
  const at = new Map(list.map((c, i) => [c, i]));
  return [...list].sort((a, b) => f(a, b) || at.get(a) - at.get(b));
}
const orderNote = (g) => (state.order === "number" || g.natdex ? "" : `. ${ORDER_NAMES[state.order]}`); // after a group's line, in its binder's header
function setOrder(o) {
  if (o === state.order) return;
  state.order = o; keepPref("wall-order", o, "number"); markFilters(); tick(5);
  reorder(`Every binder: ${ORDER_NAMES[o].toLowerCase()}`);
}
// The chase list's order, in the Chase lens: best deal (live deals first, the biggest discount leading), dearest, or
// cheapest to get now (its best deal, else market). Closest to what you'd pay isn't offered: the most you'd pay is a
// flat 85% of market in this demo, so it would sort exactly as best deal does.
const nowPrice = (c) => c.deal ?? c.price;
function chaseCmp(a, b) {
  if (state.corder === "dear") return b.price - a.price;
  if (state.corder === "cheap") return nowPrice(a) - nowPrice(b);
  return (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || (a.deal && b.deal ? b.price / b.deal - a.price / a.deal : 0) || b.price - a.price;
}
function setChaseOrder(o) {
  if (o === state.corder) return;
  state.corder = o; keepPref("wall-corder", o, "deal"); markFilters(); tick(5);
  say(o === "dear" ? "Your chase list, dearest first" : o === "cheap" ? "Your chase list, cheapest to get first" : "Your chase list, best deals first");
  if (state.lens === "chase") liftLayout(true);
  drawList(); kick();
}
function clearFilters() {
  const was = filtersOn().length;
  setFilterMenu(false);
  if (state.time) setTime(false);
  if (state.lens !== "chase") setShow("all", { quiet: true });
  setValue(false, { quiet: true });
  if (mode !== "set") rearrange("set", { quiet: true });
  markFilters();
  if (was) toast("Filters cleared");
}
filterMenu.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.show) setShow(d.show);
  else if (d.corder) setChaseOrder(d.corder);
  else if (d.color) setValue(d.color === "value");
  else if (d.group) rearrange(d.group);
  else if (d.order) setOrder(d.order);
  else if (d.filter === "time") { setFilterMenu(false); setTime(!state.time); }
  else if (b.id === "f-clear") clearFilters();
  else if (b.id === "f-done") { setFilterMenu(false); if (keyed) filterBtn.focus({ preventScroll: true }); }
});
fchipOpen.onclick = (e) => { e.stopPropagation(); setFilterMenu(filterMenu.hidden); };
document.getElementById("fchip-clear").onclick = () => clearFilters();
// Debug builds only: the tests' hook sees the filters.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { setShow: { value: setShow }, setOrder: { value: setOrder }, setChaseOrder: { value: setChaseOrder }, rearrange: { value: rearrange }, clearFilters: { value: clearFilters }, filtersOn: { value: filtersOn }, shuffle: { get: () => shuffle }, panelStat: { value: panelStat }, emphasis: { value: emphasis }, nowPrice: { value: nowPrice }, orderNote: { value: orderNote } }); }, 0);
