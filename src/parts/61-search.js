// ---------- search ----------
const qIn = document.getElementById("q"), searchBox = document.getElementById("search");
const matchQ = (c, words) => { const hay = `${c.name} ${sets[c.si].name} ${c.num} ${c.rname} ${(TYPE[c.type] || TYPE.C)[0]}`.toLowerCase(); return words.every((w) => hay.includes(w)); };
function runSearch() {
  const q = qIn.value.trim().toLowerCase();
  searchBox.classList.toggle("has", Boolean(q));
  if (!q) { state.matches = null; drawList(); kick(); return; }
  const words = q.split(/\s+/);
  const m = cards.filter((c) => matchQ(c, words));
  state.matches = new Set(m);
  drawList();
  if (document.body.classList.contains("listmode")) return;
  if (state.focus) unfocus();
  if (!m.length) { kick(); return; }
  // One match: straight to it. Several in one group: open that group at the first. Otherwise the mosaic shows where they are.
  const gs = [...new Set(m.map((c) => groups[c.g]))];
  const go = (c) => { const s = fitCam(groups[c.g]).s * 2.2; flyTo({ s, x: c.x - (vw / 2) / s + TW * c.sz / 2, y: c.y - (vh / 2.4) / s }, 520); if (m.length === 1) setTimeout(() => focus(c), 540); };
  if (gs.length === 1) {
    if (view === "set" && state.g === gs[0]) return go(m[0]);
    if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
    return enterGroup(gs[0], { then: () => go(m[0]) });
  }
  if (view === "set") exitToMosaic();
  kick();
}
qIn.addEventListener("input", () => { clearTimeout(qIn.t); qIn.t = setTimeout(runSearch, 220); hideCaption(); });
qIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(qIn.t); runSearch(); qIn.blur(); } if (e.key === "Escape") { qIn.value = ""; runSearch(); qIn.blur(); } });
document.getElementById("clear").onclick = (e) => { e.preventDefault(); qIn.value = ""; runSearch(); };
function updateCount() {
  natdexSync(); // a Dex slot shows the best print you own: picked again when what you own changes
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  // A shorter placeholder where Mark shares the strip with the search box on a narrow screen.
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
  scheduleMedals(); // every count change: a beat later, any medal it earned
}
