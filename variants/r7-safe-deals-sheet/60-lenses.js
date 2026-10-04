// ---------- lenses ----------
// Same as the base, except Deals: picking it recolors the wall and pulls up the deals sheet; tapping it again puts the
// sheet away (and back); any other lens closes it. The deals toast is gone, the sheet's header says it instead.
const lensBox = document.querySelector(".lens"), lensInk = lensBox.querySelector(".ink");
function placeInk() {
  const b = lensBox.querySelector('[aria-pressed="true"]');
  lensInk.style.setProperty("--x", `${b.offsetLeft}px`); lensInk.style.setProperty("--w", `${b.offsetWidth}px`);
}
lensBox.querySelectorAll("button").forEach((b) => (b.onclick = () => {
  if (b.getAttribute("aria-pressed") === "true") { if (b.dataset.lens === "deals") toggleDeals(); return; }
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  state.lens = b.dataset.lens; placeInk(); tick(5); hideCaption(); drawList();
  try { localStorage.setItem("wall-lens", state.lens); } catch { /* fine */ }
  if (state.lens === "deals") openDeals(); else closeDeals();
  if (state.lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  if (state.lens === "value") { const v = cards.reduce((a, c) => a + (c.owned ? c.price : 0), 0); toast(`Your collection: about ${money(v)}`); }
  document.body.classList.toggle("timing", state.lens === "time");
  layoutAll();
  if (state.lens === "time") { drawSpark(); playTime(true); } else { stopTime(); state.t = Date.now(); }
  updateCount(); kick();
}));
