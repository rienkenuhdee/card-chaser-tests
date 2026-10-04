// ---------- deals: a sheet over the wall ----------
// The Deals lens recolors the wall as before, and also pulls up a half-height sheet: every live deal on a card you
// need, best discount first, with what it costs and what it's worth. Tap a row and the sheet drops while the camera
// flies into that set and onto the card, so the list is a way in, not a way out. Pull the grip up for more rows, down
// to put it away; tap outside, the close button or Deals again does the same. Like Maps with a place list on top.
const dscrim = document.createElement("div");
dscrim.className = "dscrim"; dscrim.id = "deals-scrim";
const dsheet = document.createElement("section");
dsheet.className = "dsheet glass"; dsheet.id = "deals"; dsheet.setAttribute("role", "dialog"); dsheet.setAttribute("aria-label", "Live deals");
dsheet.innerHTML = `<div class="dgrip" aria-hidden="true"><span></span></div>
<div class="dhead"><div><h2 id="deals-h"></h2><p id="deals-sub"></p></div><button class="ib" id="deals-close" aria-label="Close deals"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
<div class="drows" id="deals-rows"></div>`;
document.body.append(dscrim, dsheet);
const drows = dsheet.querySelector("#deals-rows");
let dealsOpen = false, detent = "half";
dsheet.inert = true;

// Best discount first; at the same percent, the bigger saving in dollars.
const pctUnder = (c) => Math.round((1 - c.deal / c.price) * 100);
const liveDeals = () => cards.filter((c) => !c.owned && c.deal).sort((a, b) => pctUnder(b) - pctUnder(a) || (b.price - b.deal) - (a.price - a.deal));
function fillDeals() {
  const list = liveDeals(), n = list.length;
  const cost = list.reduce((a, c) => a + c.deal, 0), saving = list.reduce((a, c) => a + c.price - c.deal, 0);
  dsheet.querySelector("#deals-h").textContent = n ? `${n} live deal${n === 1 ? "" : "s"} on cards you need` : "No live deals right now";
  dsheet.querySelector("#deals-sub").textContent = n ? `All of them: ${money(cost)}, ${money(saving)} under market.` : "When a copy of a card you need is listed under market, it shows up here.";
  drows.innerHTML = list.map((c) => {
    const st = sets[c.si], pct = pctUnder(c);
    return `<button class="drow" data-i="${c.i}"><i class="dchip" style="background:${typeColor(c)}"></i><span class="dname">${c.name}</span><span class="dnow">${money(c.deal)}</span><span class="dmeta">${st.name} ${c.num}/${st.printed}</span><span class="dwas"><em>${pct}% under</em><s>${money(c.price)}</s></span></button>`;
  }).join("");
  drows.scrollTop = 0;
}

// Two resting heights: half the screen, or nearly all of it (the top strip stays).
const dealsHalf = () => Math.round(Math.min(vh * 0.5, 520));
const dealsTall = () => Math.round(vh - (parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0) - 76);
function setDetent(d) { detent = d; dsheet.style.height = `${d === "tall" ? dealsTall() : dealsHalf()}px`; dsheet.style.transform = ""; }
function openDeals() {
  if (document.body.classList.contains("listmode") || dealsOpen) return;
  fillDeals(); hideCaption();
  dealsOpen = true; dsheet.inert = false; dsheet.style.transition = "";
  setDetent("half");
  document.body.classList.add("dealing");
  tick(5);
}
function closeDeals() {
  if (!dealsOpen) return;
  dealsOpen = false; dsheet.inert = true; dsheet.style.transition = ""; dsheet.style.transform = "";
  document.body.classList.remove("dealing");
}
function toggleDeals() { if (dealsOpen) closeDeals(); else openDeals(); }

// A row is a way in: the sheet drops, the card's set grows out of its panel, and the camera lands on the card.
function goToDeal(c) {
  closeDeals();
  const g = groups[c.g];
  finishTransition(); fly = null; inertia = false;
  if (state.focus) unfocus();
  if (view === "set" && state.g === g) { focus(c); return; }
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  const m = g.m; if (m.y - mScroll < topPad() || m.y + m.h - mScroll > vh - botPad()) mScroll = clamp(m.y - topPad() - 10, 0, mMax);
  enterGroup(g, { then: () => focus(c) });
}
drows.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; goToDeal(cards[Number(b.dataset.i)]); });
dsheet.querySelector("#deals-close").onclick = () => closeDeals();
dscrim.addEventListener("click", () => closeDeals());
addEventListener("keydown", (e) => { if (e.key === "Escape" && dealsOpen) { e.preventDefault(); closeDeals(); } });
addEventListener("resize", () => { if (dealsOpen) setDetent(detent); });
qIn.addEventListener("focus", () => closeDeals());
document.getElementById("to-list").addEventListener("click", () => closeDeals());

// Dragging the sheet: up grows it, down shrinks it and then slides it away. In the rows, a pull down from the top or
// a push up while there's room to grow moves the sheet; anything else is the rows' own scroll.
let ddrag = null;
dsheet.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) { ddrag = null; return; }
  ddrag = { y0: e.touches[0].clientY, h0: dsheet.offsetHeight, inRows: drows.contains(e.target), native: false, moved: false, ty: 0, samples: [] };
}, { passive: true });
dsheet.addEventListener("touchmove", (e) => {
  if (!ddrag || ddrag.native || e.touches.length !== 1) return;
  const t = e.touches[0], dy = t.clientY - ddrag.y0;
  if (!ddrag.moved) {
    if (ddrag.inRows && !((dy > 0 && drows.scrollTop <= 0) || (dy < 0 && ddrag.h0 < dealsTall() - 2))) { ddrag.native = true; return; }
    ddrag.moved = true;
  }
  e.preventDefault();
  const half = dealsHalf(), want = ddrag.h0 - dy;
  const h = clamp(want, half, dealsTall()), ty = Math.max(0, half - want);
  ddrag.ty = ty;
  dsheet.style.transition = "none"; dsheet.style.height = `${h}px`; dsheet.style.transform = `translateY(${ty}px)`;
  ddrag.samples.push({ y: t.clientY, t: e.timeStamp }); if (ddrag.samples.length > 6) ddrag.samples.shift();
}, { passive: false });
const dealsRelease = (e) => {
  const d = ddrag; ddrag = null;
  if (!d || !d.moved) return;
  dsheet.style.transition = "";
  const s = d.samples, last = s[s.length - 1], first = s.find((x) => last && last.t - x.t < 120) || s[0];
  const v = first && last && first !== last ? (last.y - first.y) / Math.max(8, last.t - first.t) : 0; // px per ms, down is positive
  if (d.ty > 90 || (v > 0.45 && d.ty > 6)) return closeDeals();
  const h = dsheet.offsetHeight, half = dealsHalf(), tall = dealsTall();
  if (v > 0.45) setDetent("half");
  else if (v < -0.45) setDetent("tall");
  else setDetent(h - half > (tall - half) / 2 ? "tall" : "half");
  if (e.type !== "touchcancel") tick(4);
};
dsheet.addEventListener("touchend", dealsRelease);
dsheet.addEventListener("touchcancel", dealsRelease);
