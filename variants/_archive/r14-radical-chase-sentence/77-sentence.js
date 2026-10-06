// ---------- the chase sentence (round 14, radical) ----------
// A chase is a sentence you type in the search box: "tangela", "arita full art", "151 holo", "base set charizard".
// The search knows a few plain words and card facts: a set's name or code, a Pokémon's name (suffixes like ex, V,
// VMAX, GX and prefixes like Dark and Mega ignored), an artist's name or surname, full art, holo, rare, secret, ex,
// a type like fire, a card number. Facts of one kind OR together ("charizard blastoise" is either), kinds AND
// together ("base set charizard" is both). Anything else is matched the way the search always has.
// Chase these keeps the sentence: it stays as a chip under the search box, every matching card you don't have is
// chased, and the wall flies to its Chase shape with those cards first. Saved sentences live in localStorage
// wall-chases and are parsed again on load. A card is chased when a sentence matches it or you chased it by hand;
// turning a card off by hand wins over a sentence (the base's chasing[id] ?? c.chase0, with chase0 set here).

const ROW = 44, PC = 18; // the row under the search box; the "People chase" line in a set's panel

// ----- facts -----
const SUFFIX = /\s+(ex|v|vmax|vstar|gx|v-union)$/i, PREFIX = /^(dark|light|mega|m|alolan|galarian|hisuian|paldean|radiant|shining|team rocket's)\s+/i;
const norm = (s) => s.toLowerCase().replace(/[,.!?:;()"“”]/g, " ").replace(/\s+/g, " ").trim();
const speciesName = (c) => c.name.replace(SUFFIX, "").replace(PREFIX, "");
const speciesKey = (c) => norm(speciesName(c));
const STOP = new Set(["the", "a", "an", "and", "or", "of", "in", "from", "all", "every", "card", "cards", "any", "with", "my", "i", "chase", "want", "by", "that", "to", "for", "set"]);
const STARTERS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 152, 153, 154, 155, 156, 157, 158, 159, 160, 252, 253, 254, 255, 256, 257, 258, 259, 260, 387, 388, 389, 390, 391, 392, 393, 394, 395, 495, 496, 497, 498, 499, 500, 501, 502, 503, 650, 651, 652, 653, 654, 655, 656, 657, 658, 722, 723, 724, 725, 726, 727, 728, 729, 730, 810, 811, 812, 813, 814, 815, 816, 817, 818, 906, 907, 908, 909, 910, 911, 912, 913, 914]);
// kind: facts of one kind OR together; different kinds AND together.
const VOCAB = new Map();
const learn = (phrase, kind, test) => { const k = norm(phrase); if (k && !VOCAB.has(k)) VOCAB.set(k, { kind, test }); };
const mods = {
  "full art": (c) => c.tier >= 4, fullart: (c) => c.tier >= 4, "alt art": (c) => c.tier >= 4, illustration: (c) => c.tier >= 4, "illustration rare": (c) => c.tier >= 4,
  holo: (c) => c.tier >= 3, holos: (c) => c.tier >= 3, foil: (c) => c.tier >= 3, foils: (c) => c.tier >= 3,
  rare: (c) => c.tier >= 2, rares: (c) => c.tier >= 2, secret: (c) => c.tier >= 5, "secret rare": (c) => c.tier >= 5, secrets: (c) => c.tier >= 5, hyper: (c) => c.tier >= 5, rainbow: (c) => c.tier >= 5,
  common: (c) => c.tier === 0, commons: (c) => c.tier === 0, uncommon: (c) => c.tier === 1, uncommons: (c) => c.tier === 1,
  ex: (c) => /\sex$/i.test(c.name), v: (c) => /\sV$/.test(c.name), vmax: (c) => /\sVMAX$/i.test(c.name), vstar: (c) => /\sVSTAR$/i.test(c.name), gx: (c) => /\sGX$/i.test(c.name),
  mega: (c) => /^(mega|m)\s/i.test(c.name), dark: (c) => /^dark\s/i.test(c.name), alolan: (c) => /^alolan\s/i.test(c.name),
  trainer: (c) => c.type === "t", trainers: (c) => c.type === "t", supporter: (c) => c.type === "t", energy: (c) => c.type === "e", energies: (c) => c.type === "e",
  pokemon: (c) => c.dex > 0, "pokémon": (c) => c.dex > 0, starter: (c) => STARTERS.has(c.dex), starters: (c) => STARTERS.has(c.dex),
  missing: (c) => !c.owned, need: (c) => !c.owned, have: (c) => c.owned, owned: (c) => c.owned,
  vintage: (c) => sets[c.si].year < 2003, modern: (c) => sets[c.si].year >= 2003,
  deal: (c) => Boolean(c.deal), deals: (c) => Boolean(c.deal), cheap: (c) => c.price < 5, expensive: (c) => c.price >= 50, pricey: (c) => c.price >= 50,
};
for (const [p, t] of Object.entries(mods)) learn(p, `mod:${t}`, t);
for (const [k, [name]] of Object.entries(TYPE)) if (k !== "t" && k !== "e") { learn(name, "type", (c) => c.type === k); learn(`${name} type`, "type", (c) => c.type === k); }
learn("electric", "type", (c) => c.type === "L"); learn("steel", "type", (c) => c.type === "M"); learn("normal", "type", (c) => c.type === "C"); learn("ghost", "type", (c) => c.type === "P"); learn("dark type", "type", (c) => c.type === "D");
for (const st of sets) {
  const t = (c) => c.si === st.si;
  learn(st.name, "set", t);
  for (const w of norm(st.name).split(" ")) if (w.length >= 3 && !STOP.has(w)) learn(w, "set", t);
}
for (const c of cards) {
  if (c.dex > 0) { const d = c.dex; learn(speciesKey(c), "poke", (x) => x.dex === d); }
  else { const k = speciesKey(c); learn(k, "poke", (x) => speciesKey(x) === k); }
}
for (const a of ARTISTS) {
  const t = (c) => c.artist === a, parts = norm(a).split(" ");
  learn(a, "artist", t);
  for (const w of parts) if (w.length >= 3) learn(w, "artist", t);
}
for (const st of sets) learn(st.code, "set", (c) => c.si === st.si); // codes last: "mew" is the Pokémon first
const hayOf = (c) => `${c.name} ${sets[c.si].name} ${c.num} ${c.rname} ${(TYPE[c.type] || TYPE.C)[0]} ${c.artist}`.toLowerCase();
// A sentence, parsed once and remembered: { key, facts, cards }.
const parsed = new Map();
function sentence(q) {
  const key = norm(q);
  let s = parsed.get(key); if (s) return s;
  const words = key.split(" ").filter((w) => w && !STOP.has(w)), facts = new Map(), parts = [];
  const add = (kind, test, text) => { if (!facts.has(kind)) facts.set(kind, []); facts.get(kind).push(test); parts.push(text); };
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = 3; n >= 1 && !hit; n--) { if (i + n > words.length) continue; const p = words.slice(i, i + n).join(" "); const f = VOCAB.get(p); if (f) hit = { f, n, p }; }
    if (hit) { add(hit.f.kind, hit.f.test, hit.p); i += hit.n; continue; }
    const w = words[i];
    if (/^\d+[a-z]?(\/\d+)?$/.test(w)) { const num = w.split("/")[0]; add("num", (c) => c.num.toLowerCase() === num, w); }
    else add(`text:${w}`, (c) => hayOf(c).includes(w), w);
    i++;
  }
  const kinds = [...facts.values()];
  const set = new Set(kinds.length ? cards.filter((c) => kinds.every((fs) => fs.some((f) => f(c)))) : []);
  s = { key, cards: set, kinds: facts.size };
  if (parsed.size > 80) parsed.clear();
  parsed.set(key, s); return s;
}

// ----- saved chases -----
let chases = [];
try { chases = (JSON.parse(localStorage.getItem("wall-chases-sentence") || "[]") || []).filter((q) => typeof q === "string"); } catch { chases = []; }
const persistChases = () => { try { localStorage.setItem("wall-chases-sentence", JSON.stringify(chases)); } catch { /* private mode */ } };
let fresh = new Set(); // the newest sentence's cards lead their sets in the Chase lens
function applyChases() {
  for (const c of cards) c.chase0 = false;
  for (const q of chases) for (const c of sentence(q).cards) c.chase0 = true;
}
applyChases();
const toFind = (q) => { let n = 0; for (const c of sentence(q).cards) if (isChase(c) || (!c.owned && chasing[c.id] == null)) n++; return n; };
const isSaved = (q) => chases.includes(norm(q));
function saveChase(q) {
  const s = sentence(q); if (!s.cards.size || isSaved(q)) return;
  chases.push(s.key); persistChases(); applyChases();
  fresh = new Set([...s.cards].filter((c) => !c.owned));
  const n = [...s.cards].filter(isChase).length;
  qIn.value = ""; qIn.blur(); runSearch();
  if (view === "mosaic") mScroll = 0; // the flight starts from the top of the wall
  if (state.lens !== "chase") setLens("chase"); else liftLayout(true);
  drawList(); syncMenu(); syncRow(); tick(10);
  toast(n ? `Chasing ${n} card${n === 1 ? "" : "s"}: ${s.key}.` : `Saved: ${s.key}. You have them all.`, () => removeChase(s.key, true));
}
function removeChase(q, quiet = false) {
  const key = norm(q), i = chases.indexOf(key); if (i < 0) return;
  chases.splice(i, 1); persistChases(); applyChases(); fresh = new Set();
  if (lifted) liftLayout(true);
  drawList(); syncMenu(); syncRow(); tick(5); kick();
  if (!quiet) toast(`No longer chasing: ${key}.`, () => { chases.push(key); persistChases(); applyChases(); if (lifted) liftLayout(true); drawList(); syncMenu(); syncRow(); kick(); });
}
// Run a sentence: it goes in the box and the wall rings its cards, one tap from Chase these.
function runSentence(q) {
  qIn.value = norm(q); clearTimeout(qIn.t); qIn.blur(); hideCaption(); tick(4); runSearch();
}

// ----- popular cards: what people typically chase in a set (one rule shared by every variant) -----
const popScore = (c) => c.tier * 2 + Math.log10(c.price + 1) * 1.5 + h32(c.id + "p");
for (const c of cards) c.pop = false;
for (const st of sets) {
  const top = [...st.cards].sort((a, b) => popScore(b) - popScore(a)).slice(0, Math.max(3, Math.round(0.06 * st.cards.length)));
  for (const c of top) c.pop = true;
  const names = [...new Set(top.map(speciesName))];
  st.pcNames = names; st.pcLine = names.join(", "); st.pcq = `${st.name} ${names.join(", ")}`;
}
const popular = (c) => c.pop;
const pcOn = (g, w, h) => Boolean(g.set) && w >= 150 && h >= 70;

// ----- the search: sentences instead of substrings -----
function runSearch() {
  const q = qIn.value.trim();
  searchBox.classList.toggle("has", Boolean(q)); document.body.classList.toggle("qon", Boolean(q));
  state.q = q;
  if (!q) { state.matches = null; drawList(); syncRow(); kick(); return; }
  const m = [...sentence(q).cards];
  state.matches = new Set(m);
  drawList(); syncRow();
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

// ----- the row under the search box -----
const srow = document.createElement("div");
srow.className = "srow glass"; srow.id = "srow"; srow.setAttribute("role", "group"); srow.setAttribute("aria-label", "Chases");
document.querySelector(".top").after(srow);
const surname = (a) => norm(a).split(" ").pop();
// A few sentences from the wall itself: the most popular cards you don't have, the artists with the most cards you
// don't have, and the set with the most full arts to find.
function suggest() {
  const out = [], seen = new Set(chases), push = (q) => { if (q && !seen.has(q) && out.length < 6) { seen.add(q); out.push(q); } };
  const pops = cards.filter((c) => c.pop && !c.owned).sort((a, b) => popScore(b) - popScore(a));
  const art = new Map(); for (const c of cards) if (!c.owned) art.set(c.artist, (art.get(c.artist) || 0) + 1);
  const artists = [...art].sort((a, b) => b[1] - a[1]).map((a) => a[0]);
  const fa = sets.map((st) => [st, st.cards.filter((c) => !c.owned && c.tier >= 4).length]).sort((a, b) => b[1] - a[1])[0];
  const ho = sets.filter((st) => st.year < 2003).map((st) => [st, st.cards.filter((c) => !c.owned && c.tier >= 3).length]).sort((a, b) => b[1] - a[1])[0];
  if (pops[0]) push(speciesKey(pops[0]));
  if (fa && fa[1]) push(`full art ${norm(fa[0].name).replace(/ set$/, "")}`);
  if (artists[0]) push(surname(artists[0]));
  if (pops[1]) push(speciesKey(pops[1]));
  if (ho && ho[1]) push(`${norm(ho[0].name)} holo`);
  if (artists[1]) push(`${surname(artists[1])} full art`);
  if (pops[2]) push(speciesKey(pops[2]));
  return out;
}
let rowKey = "";
function syncRow() {
  const q = qIn.value.trim(), focused = document.activeElement === qIn;
  let html = "", key;
  if (q) {
    const s = sentence(q), n = s.cards.size, k = toFind(q), saved = isSaved(q);
    key = `q|${s.key}|${n}|${k}|${saved}`;
    if (key === rowKey) return;
    const count = !n ? "No cards match. Try a Pokémon, a set, an artist, full art or holo." : `${n} card${n === 1 ? "" : "s"}, ${k ? `${k} to find` : "you have them all"}`;
    html = `<span class="sr-n">${esc(count)}</span>${n ? `<button type="button" class="sr-go${saved ? "" : " primary"}" id="sr-go" data-go="${esc(s.key)}">${saved ? "Stop chasing" : "Chase these"}</button>` : ""}`;
  } else if (focused || !chases.length) {
    const sug = suggest();
    key = `s|${sug.join("|")}|${chases.length}`;
    if (key === rowKey) return;
    html = `<span class="sr-lbl">Try</span>${sug.map((x) => `<button type="button" class="sr-chip" data-run="${esc(x)}">${esc(x)}</button>`).join("")}`;
  } else {
    key = `c|${chases.map((x) => `${x}:${toFind(x)}`).join("|")}`;
    if (key === rowKey) return;
    html = chases.map((x) => `<span class="sr-chip sr-saved"><button type="button" class="sr-run" data-run="${esc(x)}">${esc(x)}<small>${toFind(x)} to find</small></button><button type="button" class="sr-x" data-x="${esc(x)}" aria-label="Remove ${esc(x)}">×</button></span>`).join("") + `<button type="button" class="sr-chip sr-new" data-new="1">+ New chase</button>`;
  }
  rowKey = key; srow.innerHTML = html; srow.scrollLeft = 0;
}
srow.addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  e.preventDefault();
  if (b.dataset.run) return runSentence(b.dataset.run);
  if (b.dataset.x) return removeChase(b.dataset.x);
  if (b.dataset.go) return isSaved(b.dataset.go) ? removeChase(b.dataset.go) : saveChase(b.dataset.go);
  if (b.dataset.new) { qIn.focus(); syncRow(); }
});
srow.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { srow.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
qIn.addEventListener("focus", () => syncRow());
qIn.addEventListener("blur", () => setTimeout(syncRow, 200)); // a tap on a chip lands before the row changes
qIn.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && qIn.value.trim()) { e.preventDefault(); saveChase(qIn.value); } });
function updateCount() {
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? "Search, or say what you chase" : "Search";
  syncRow(); // the counts on the chips and the suggestions follow what you own
}

// ----- the chase menu (top left): your sentences under the layouts -----
let menuBits = [];
function syncMenu() {
  for (const el of menuBits) el.remove(); menuBits = [];
  if (!chases.length) return;
  const head = document.createElement("p"); head.className = "sr-mh"; head.textContent = "Your chases"; menuBits.push(head);
  for (const q of chases) {
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.dataset.chase = q;
    b.innerHTML = `<span><b></b><small></small></span><span class="tick sr-tick" aria-hidden="true">›</span>`;
    b.querySelector("b").textContent = q; b.querySelector("small").textContent = `${toFind(q)} to find`;
    b.onclick = () => { setMenu(false); runSentence(q); };
    menuBits.push(b);
  }
  arrMenu.append(...menuBits);
}
syncMenu();
arrBtn.addEventListener("click", () => syncMenu()); // counts change as you find cards

// ----- Reset the demo forgets the sentences too -----
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases-sentence", "wall-spares", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ----- layout: room for the row above the mosaic, and for the "People chase" line in a set's panel -----
const innerOf2 = (g) => { const m = g.m, pc = pcOn(g, m.w, m.h) ? PC : 0; return { x: m.x + PG + 6, y: m.y + PG + LABEL + pc, w: m.w - PG * 2 - 12, h: m.h - PG * 2 - LABEL - pc - 6 }; };
function packPanel(g) {
  const inner = innerOf2(g), n = g.cards.length;
  let best = { t: 0, cols: 1, rows: n };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const t = Math.min(inner.w / cols, (inner.h / rows) * (TW / TH));
    if (t > best.t) best = { t, cols, rows };
  }
  const cw = best.t, ch = cw * TH / TW, tw = cw * 0.86, th = ch - (cw - tw) * TH / TW;
  const gw = best.cols * cw, gh = best.rows * ch;
  const ox = inner.x + (inner.w - gw) / 2, oy = inner.y + Math.max(0, (inner.h - gh) / 2) * 0.5;
  g.cards.forEach((c, k) => { c.m = { x: ox + (k % best.cols) * cw, y: oy + Math.floor(k / best.cols) * ch, w: tw, h: th }; });
}
function liftedH(g, w) {
  const inner = w - PG * 2 - 12, cols = feedCols(inner), tw = (inner - TILE_GAP * (cols - 1)) / cols, th = Math.round(tw * 0.64);
  const rows = Math.ceil(g.lead.length / cols), rest = g.cards.length - g.lead.length;
  const rc = Math.max(1, Math.floor(inner / REST)), rr = Math.ceil(rest / rc);
  return PG + LABEL + (pcOn(g, w, 999) ? PC : 0) + rows * (th + TILE_GAP) + (rest ? 6 + rr * (REST * TH / TW) : 0) + PG + 6;
}
function packLifted(g) {
  const inner = innerOf2(g), cols = feedCols(inner.w), tw = (inner.w - TILE_GAP * (cols - 1)) / cols, th = Math.round(tw * 0.64);
  const n = g.lead.length, rows = Math.ceil(n / cols);
  g.cards.forEach((c, k) => {
    if (k < n) { c.m = { x: inner.x + (k % cols) * (tw + TILE_GAP), y: inner.y + Math.floor(k / cols) * (th + TILE_GAP), w: tw, h: th }; return; }
    const j = k - n, rc = Math.max(1, Math.floor(inner.w / REST)), cw = inner.w / rc, ch = REST * TH / TW;
    c.m = { x: inner.x + (j % rc) * cw, y: inner.y + rows * (th + TILE_GAP) + 6 + Math.floor(j / rc) * ch, w: cw * 0.86, h: ch - cw * 0.14 * TH / TW };
  });
}
function mosaicLayout() {
  const top = topPad() + ROW, fitH = vh - top - botPad();
  if (mode === "set" && pickedSets.size && pickedSets.size < groups.length && groups.every((g) => g.set)) {
    const mine = groups.filter((g) => pickedSets.has(g.set.id)), rest = groups.filter((g) => !pickedSets.has(g.set.id));
    const n = mine.reduce((a, g) => a + g.cards.length, 0);
    const R = { x: 8, y: top, w: vw - 16, h: Math.max(fitH - rest.length * W_FOLD, fitH * 0.62, (n * 340) / (vw - 16)) };
    const items = mine.map((g) => ({ g, v: Math.max(g.cards.length, 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    stripTreemap(items, R);
    let y = R.y + R.h;
    for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
    mMax = Math.max(0, y + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    for (const g of mine) packPanel(g);
    for (const g of rest) packFolded(g);
    return;
  }
  const R = { x: 8, y: top, w: vw - 16, h: Math.max(fitH, (cards.length * 340) / (vw - 16)) };
  mMax = Math.max(0, R.y + R.h + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  const items = groups.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  stripTreemap(items, R);
  for (const g of groups) packPanel(g);
}
function liftedLayout() {
  const R = { x: 8, y: topPad() + ROW, w: vw - 16 };
  const live = groups.filter((g) => g.lead.length), folded = groups.filter((g) => !g.lead.length);
  let y = R.y;
  if (state.lens === "trade") y += stripLayout(R); else strip = null;
  const across = R.w >= 900 ? 2 : 1, pw = R.w / across;
  for (let i = 0; i < live.length; i += across) {
    const row = live.slice(i, i + across), h = Math.max(...row.map((g) => liftedH(g, pw)));
    row.forEach((g, j) => { g.m = { x: R.x + j * pw, y, w: pw, h }; });
    y += h;
  }
  for (const g of folded) { g.m = { x: R.x, y, w: R.w, h: FOLD }; y += FOLD; }
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  for (const g of groups) if (g.lead.length) packLifted(g); else packFolded(g);
}
// In the Chase lens the newest sentence's cards lead their sets; live deals, then the most you'd pay, after.
function orderGroup(g) {
  g.base ||= g.cards;
  const key = state.lens === "trade" ? isSpare : isChase, ord = state.lens === "trade" ? spareOrder : chaseOrder;
  const lead = lifted ? g.base.filter(key).sort(ord) : [];
  if (lead.length && state.lens === "chase" && fresh.size) lead.sort((a, b) => (fresh.has(b) ? 1 : 0) - (fresh.has(a) ? 1 : 0) || ord(a, b));
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !key(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}

// ----- the panel: "People chase: Charizard, Blastoise, Venusaur" under the set's name, tappable -----
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m);
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    const k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)), a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.globalAlpha = alpha * labelAlpha;
  const x = m.x + PG + 10, w = m.w - PG * 2 - 20;
  const size = clamp(m.w * 0.075, 12, 17);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  let beat = null;
  if (g.beat) { const p = (now - g.beat.t0) / 3000; if (p < 1) beat = { text: g.beat.text, col: g.beat.col || theme.deal, a: Math.min(1, p * 10, (1 - p) * 4) }; else g.beat = null; }
  font(beat ? 700 : 600, size * 0.82);
  const stat = beat ? fitText(beat.text, w * 0.72) : panelStat(g), sw = stat ? textW(stat) + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw), x, m.y + PG + 22);
  if (stat) {
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? beat.col : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, x + w, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha;
  }
  const owned = ownedNow(g.cards), n = g.cards.length;
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  if (pcOn(g, m.w, m.h) && !picking()) {
    ctx.textAlign = "left"; font(600, 11.5);
    const lbl = "People chase", lw = textW(lbl) + 5, y = m.y + PG + 46;
    ctx.fillStyle = theme.gold; ctx.fillText(lbl, x, y);
    ctx.fillStyle = theme.ink; font(700, 11.5, true); ctx.fillText(fitText(g.set.pcLine, w - lw), x + lw, y);
  }
  ctx.globalAlpha = 1;
}
// The line under a panel's name, if the point is on it.
function pcAt(g, sx, sy) {
  if (!g?.m || !pcOn(g, g.m.w, g.m.h)) return false;
  const y = sy + mScroll;
  return y >= g.m.y + PG + 33 && y <= g.m.y + PG + LABEL + PC && sx >= g.m.x + PG + 6 && sx <= g.m.x + g.m.w - PG - 6;
}
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch);
    if (h?.block && lifted) {
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") {
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m));
    }
    if (h?.block && pcAt(h.block, sx, sy)) return runSentence(h.block.set.pcq); // what people chase in this set, ringed
    if (h?.block) enterGroup(h.block);
    return;
  }
  if (!h?.card) return;
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}

// ----- inside a set the popular cards wear a small gold corner -----
function popCorner(c, r, alpha) {
  if (!c.pop || r.w < 16 || c.e < 0.5) return;
  const k = clamp(r.w * 0.2, 6, 16), rad = r.w * 0.045;
  ctx.globalAlpha = alpha * c.e; ctx.fillStyle = theme.gold;
  ctx.beginPath(); ctx.moveTo(r.x + r.w - k, r.y); ctx.lineTo(r.x + r.w - rad, r.y); ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + rad); ctx.lineTo(r.x + r.w, r.y + k); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawSet(g, now, C = cam, ox = 0, alpha = 1) {
  drawHeader(g, now, C, ox, alpha);
  if (shuffle && shuffle.g === g) {
    for (const c of g.cards) {
      if (c === state.focus) continue;
      const k = ease(clamp((now - shuffle.t0 - c.delay) / shuffle.dur, 0, 1));
      const x = c.px + (c.x - c.px) * k, y = c.py + (c.y - c.py) * k;
      const r = { x: (x - C.x) * C.s + ox, y: (y - C.y) * C.s, w: TW * c.sz * C.s, h: TH * c.sz * C.s };
      if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
      drawTile(c, r.x, r.y, r.w, r.h, now, alpha); popCorner(c, r, alpha);
    }
    return;
  }
  const y0 = C.y, y1 = C.y + vh / C.s;
  const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
  for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
    const c = g.cards[k];
    if (c === state.focus) continue;
    const r = binderRect(c, C, ox);
    if (r.x > vw || r.x + r.w < 0) continue;
    drawTile(c, r.x, r.y, r.w, r.h, now, alpha); popCorner(c, r, alpha);
  }
}

// ----- the list: your sentences first, and Chase these for the sentence in the box -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  const q = qIn.value.trim();
  if (q && state.matches) {
    const s = sentence(q), n = s.cards.size, k = toFind(q), saved = isSaved(q);
    top += `<section><h2>“${esc(s.key)}”</h2><p class="lsub">${!n ? "No cards match. Try a Pokémon, a set, an artist, full art or holo." : `${n} card${n === 1 ? "" : "s"}, ${k ? `${k} to find` : "you have them all"}.`}</p>${n ? `<p><button type="button" class="pill-btn${saved ? "" : " primary"}" data-lgo="${esc(s.key)}">${saved ? "Stop chasing" : "Chase these"}</button></p>` : ""}</section>`;
  } else if (chases.length) {
    top += `<section><h2>Your chases</h2><p class="lsub">Each one is a sentence. Tap it to see its cards.</p><ul>${chases.map((x) => `<li class="lwrow"><button class="lrow" data-lrun="${esc(x)}"><span class="lname">${esc(x)}</span><span class="lmeta">${sentence(x).cards.size} cards</span><span class="lstate">${toFind(x)} to find</span></button><button type="button" class="pill-btn" data-lx="${esc(x)}">Remove</button></li>`).join("")}</ul></section>`;
  }
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top += `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") top += tradeListHTML();
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}${g.set ? `. People chase ${esc(g.set.pcLine)}.` : ""}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}${c.pop ? ' <span class="lpop">popular</span>' : ""}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-lgo], [data-lrun], [data-lx]"); if (!b) return;
  e.stopImmediatePropagation();
  if (b.dataset.lgo) return isSaved(b.dataset.lgo) ? removeChase(b.dataset.lgo) : saveChase(b.dataset.lgo);
  if (b.dataset.lrun) return runSentence(b.dataset.lrun);
  if (b.dataset.lx) return removeChase(b.dataset.lx);
}, { capture: true });
syncRow();
