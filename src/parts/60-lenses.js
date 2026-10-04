// ---------- lenses ----------
const lensBox = document.querySelector(".lens"), lensInk = lensBox.querySelector(".ink");
function placeInk() {
  const b = lensBox.querySelector('[aria-pressed="true"]');
  lensInk.style.setProperty("--x", `${b.offsetLeft}px`); lensInk.style.setProperty("--w", `${b.offsetWidth}px`);
}
lensBox.querySelectorAll("button").forEach((b) => (b.onclick = () => {
  if (b.getAttribute("aria-pressed") === "true") return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  const was = state.lens;
  state.lens = b.dataset.lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", state.lens); } catch { /* fine */ }
  if (state.lens === "wants") { const n = cards.filter(isWant).length, d = cards.filter((c) => isWant(c) && c.deal).length; toast(n ? `${n} on your want list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your want list yet. Open a card and choose Want it."); }
  if (state.lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  if (state.lens === "value") { const v = cards.reduce((a, c) => a + (c.owned ? c.price : 0), 0); toast(`Your collection: about ${money(v)}`); }
  document.body.classList.toggle("timing", state.lens === "time");
  if (was === "wants") exitWants();
  if (state.lens === "wants") enterWants();
  layoutAll(); drawList();
  if (state.lens === "time") { drawSpark(); playTime(true); } else { stopTime(); state.t = Date.now(); }
  updateCount(); kick();
}));
