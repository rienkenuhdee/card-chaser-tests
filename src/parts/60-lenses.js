// ---------- lenses ----------
const lensBox = document.querySelector(".lens"), lensInk = lensBox.querySelector(".ink");
function placeInk() {
  const b = lensBox.querySelector('[aria-pressed="true"]');
  lensInk.style.setProperty("--x", `${b.offsetLeft}px`); lensInk.style.setProperty("--w", `${b.offsetWidth}px`);
}
// Switching the lens: if the layout changes (Deals on or off), everything flies rather than cuts.
function liftLayout() {
  const want = state.lens === "deals";
  if (want === lifted) { layoutAll(); return; }
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
