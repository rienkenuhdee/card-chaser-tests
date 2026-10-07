// ---------- focus: the card is the screen ----------
const panel = document.getElementById("panel");
function panelH() { return Math.min(panel.offsetHeight || 230, vh * 0.5); }
function focus(c, dir = 0) {
  if (c.ph) { phSay(c); return; } // a Dex pocket with no card has no card to bring up
  state.focus = c;
  document.body.classList.add("focused");
  fillPanel(c, dir);
  focusCam(c, false, dir);
  lookedAt(c); // bringing a card up close is looking at its deal
  tick(6);
}
// Where a card up close sits: over the panel in portrait; on a phone on its side the panel stands at the right and the
// card fills the space beside it (round 22). now: straight there (the screen turned), else a flight.
function focusCam(c, now = false, dir = 0) {
  let top = 70, avail = vh - panelH() - top - 12, cx = vw / 2, wide = vw * 0.78;
  if (landPhone()) {
    const side = sideW(); top = topPad(); avail = vh - top - SAFE.bottom - 12;
    const L = SAFE.left + 10, R = vw - side; cx = (L + R) / 2; wide = (R - L) * 0.86;
  }
  const ch = Math.min(avail * 0.92, wide * TH / TW);
  const S = TH * c.sz, s = Math.min(ch / S, maxS() * 1.4);
  const cy = top + avail / 2, t = { s, x: c.x + TW * c.sz / 2 - cx / s, y: c.y + S / 2 - cy / s };
  if (now) { fly = null; Object.assign(cam, t); kick(); } else flyTo(t, dir ? 360 : 520);
}
// On a phone on its side, what a sheet standing at the right takes: its width and the gap beside it.
const sideW = () => Math.min(400, Math.max(320, vw * 0.44)) + 10 + SAFE.right;
function unfocus() {
  if (!state.focus) return;
  state.focus = null;
  document.body.classList.remove("focused");
  if (view === "set" && state.g) { const f = fitCam(state.g); if (cam.s > f.s * 1.02) flyTo(f, 380); }
  flushLayout();
  kick();
}
function step(d) {
  const c = state.focus; if (!c) return;
  let k = c.k + d, n = groups[c.g].cards[k];
  while (n?.ph) n = groups[c.g].cards[(k += d)]; // along the Dex, past the Pokémon your sets don't have
  if (!n) { bump(d); return; }
  tick(); focus(n, d);
}
function fillPanel(c, dir) {
  const st = sets[c.si];
  const swap = document.getElementById("swap");
  const put = () => {
    document.getElementById("p-name").textContent = c.name;
    document.getElementById("p-meta").textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. ${c.variant ? `${c.variant}. ` : ""}${c.rname}.${c.owned && c.got ? ` Yours since ${new Date(c.got).toLocaleDateString("en-US", { month: "short", year: "numeric" })}.` : ""}${!c.owned && isChase(c) ? ` Pay up to ${money(capOf(c))}.` : c.owned && isSpare(c) ? " You have a spare." : ""}`;
    document.getElementById("p-price").innerHTML = `${money(c.price)}<small>market</small>`;
    const dl = document.getElementById("p-deal");
    if (!c.owned && c.deal && isChase(c)) { dl.hidden = false; dl.textContent = `A copy on eBay for ${money(c.deal)} right now, ${Math.round((1 - c.deal / c.price) * 100)}% under.`; } else dl.hidden = true;
    const own = document.getElementById("p-own"), buy = document.getElementById("p-buy");
    own.textContent = c.owned ? "In your collection ✓" : "I have it";
    own.className = `act ${c.owned ? "owned" : "primary"}`;
    own.setAttribute("aria-pressed", String(c.owned));
    buy.textContent = c.owned ? "Back to the set" : c.deal && isChase(c) ? `Buy for ${money(c.deal)}` : "Find a copy";
    updateFlag(c);
    fillChips(panelMore, c);
  };
  if (dir && !reduced) { swap.classList.add("out"); setTimeout(() => { put(); swap.classList.remove("out"); }, 140); } else put();
}
document.getElementById("p-own").onclick = () => { const c = state.focus; if (c) toggleWithUndo(c); };
document.getElementById("p-buy").onclick = () => {
  const c = state.focus; if (!c) return;
  const st = sets[c.si];
  if (c.owned) { unfocus(); return flyTo(fitCam(groups[c.g]), 460); }
  window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`pokemon ${c.name} ${c.num}/${st.printed} ${st.name}`)}&_sop=15`, "_blank", "noopener");
};
let quietLayout = false; // a trade changes several cards at once: one relayout at the end, not one per card
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now(), b = c.base || c;
  if (on) mdCause = { c, t: now }; // a medal this tips rises from this card when it has no bar of its own
  b.owned = on; b.got = on ? Date.now() : null; saved[b.id] = { on, at: b.got }; persist();
  for (const t of [b, ...twinsOf(b)]) { t.anim = { t0: now, to: on }; const tg = groups[t.g]; if (tg && (t === c || tg.base?.includes(t) || tg.cards.includes(t))) tg.ripple = { t0: now, col: t.col, row: t.row }; }
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  let sync = null;
  if (quietLayout) doneDirty = true; else sync = syncDone(); // did that finish something, or undo a finish?
  if (sync?.minted.length) { tick(40); toast(finishedText(sync.minted), undo); }
  else if (sync?.freed.length) toast(`${c.name} taken out. ${sync.freed.map(trophyName).join(" and ")} ${sync.freed.length === 1 ? "is" : "are"} back on the wall.`, undo);
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  if (lifted && !quietLayout && !sync) liftLayout(true); // a chased card changed hands: the chase layout flies to its new shape
  updateCount(); drawList(); kick();
}
