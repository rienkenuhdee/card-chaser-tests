// ---------- chases: a chase is a set of your own, on the wall ----------
// A collector's chase is a rule: a set, one Pokémon (its Dex number, so every print of it counts), an artist, the Dex
// with options (full art only, holo and up, a type), the cards people chase in a set, or any mix of those. A saved
// chase is a panel on the wall beside the real sets, with its own binder, count and progress bar. Its cards are twins
// of the cards in their sets: the same card drawn in two places, so marking one marks both (a twin reads the card's
// facts through its prototype and keeps only its own place on the wall). Every unowned card a chase matches is on the
// chase list, on top of the cards picked by hand; a card turned off by hand stays off. A chase is made from the card
// you're looking at ("Chase more like this": Every Tangela, Everything by Arita, Full art in 151, Arita's Tangelas,
// Popular in 151, All of 151), from the New chase panel at the end of the wall (one plain form with a live count), or
// from a set's "People chase" row (Chase these). Rules live in localStorage wall-chases.

// ----- the rules -----
const HOLO = 3, FULL = 4; // tiers: Rare Holo is 3; VMAX, Ultra, Illustration rares and up are 4
let chases = [];
try { chases = (JSON.parse(localStorage.getItem("wall-chases") || "[]") || []).filter((r) => r && typeof r === "object" && r.id); } catch { chases = []; }
let firstChases = false;
try { firstChases = localStorage.getItem("wall-chases") === null; } catch { /* fine */ }
const persistChases = () => { try { localStorage.setItem("wall-chases", JSON.stringify(chases)); } catch { /* private mode */ } };
// A Pokémon is its Dex number. Its name is the plainest card name for it (no Dark, Galarian, V or ex).
const baseName = (n) => n.replace(/^(Dark|Light|Galarian|Alolan|Hisuian|Paldean|Shining|Mega|M|Team Rocket's|Rocket's|Brock's|Misty's|Erika's|Sabrina's|Koga's|Blaine's|Giovanni's|Lt\. Surge's) /, "").replace(/ (V|VMAX|VSTAR|ex|EX|GX|BREAK|Prime|LEGEND|LV\.X)$/, "");
const SPECIES = new Map();
for (const c of cards) if (c.dex) { const n = baseName(c.name), cur = SPECIES.get(c.dex); if (!cur || n.length < cur.length) SPECIES.set(c.dex, n); }
const speciesList = [...SPECIES].map(([dex, name]) => ({ dex, name, n: cards.filter((c) => c.dex === dex).length })).sort((a, b) => a.dex - b.dex);
const setById = (id) => sets.find((s) => s.id === id);
// The cards people chase in a set: rarity, price and a seed; the top 6% of each set (three at least).
const popScore = (c) => c.tier * 2 + Math.log10(c.price + 1) * 1.5 + h32(c.id + "p");
for (const st of sets) { st.pop = st.cards.slice().sort((a, b) => popScore(b) - popScore(a) || a.i - b.i).slice(0, Math.max(3, Math.round(0.06 * st.cards.length))); for (const c of st.pop) c.pop = true; }
function matchRule(r, c) {
  if (r.set && sets[c.si].id !== r.set) return false;
  if (r.dex && c.dex !== r.dex) return false;
  if (r.artist && c.artist !== r.artist) return false;
  if (r.rarity && c.tier < r.rarity) return false;
  if (r.type && c.type !== r.type) return false;
  if (r.popular && !c.pop) return false;
  if ((r.kind === "dex" || r.kind === "natdex") && !c.dex) return false; // the Dex is Pokémon cards only
  return true;
}
const ruleKey = (r) => `${r.set || ""}|${r.dex || 0}|${r.artist || ""}|${r.rarity || 0}|${r.type || ""}|${r.popular ? 1 : 0}${r.kind === "natdex" ? "|natdex" : ""}`; // a Complete Dex is its own kind, filters and all
const isFullDex = (r) => r.kind === "natdex" && !r.rarity && !r.type; // the Complete Dex, unfiltered
const findRule = (r) => chases.find((x) => ruleKey(x) === ruleKey(r)) || null;
const possessive = (artist) => { const w = artist.split(" "), n = w[w.length - 1]; return /s$/.test(n) ? `${n}'` : `${n}'s`; };
const plural = (n) => (/[sxz]$/.test(n) ? n : `${n}s`);
// "Every Charizard", "Everything by Ken Sugimori", "Full art in 151", "Sugimori's Charizards", "Popular in Base Set",
// "All of Base Set", "Holo Fire Pokémon in Jungle by Arita".
function labelOf(r) {
  if (r.kind === "natdex") return dexLabel(r); // "Complete Dex", "Full art Dex", "Fire Dex" (85-natdex.js)
  const st = r.set ? setById(r.set) : null, sp = r.dex ? SPECIES.get(r.dex) || "Pokémon" : "";
  const rar = r.rarity === FULL ? "Full art" : r.rarity === HOLO ? "Holo" : "", typ = r.type ? (TYPE[r.type] || TYPE.C)[0] : "";
  if (r.popular) return `Popular in ${st ? st.name : "every set"}`;
  let what = sp ? [rar, sp].filter(Boolean).join(" ") : [rar, typ ? `${typ} Pokémon` : ""].filter(Boolean).join(" ");
  if (!what && !r.artist && st) return `All of ${st.name}`;
  if (!what && r.artist && !st) return `Everything by ${r.artist}`;
  if (what === sp && sp && r.artist && !st) return `${possessive(r.artist)} ${plural(sp)}`;
  if (what === sp && sp && !r.artist && !st) return `Every ${sp}`;
  if (!what) what = "Everything";
  if (st) what += ` in ${st.name}`;
  if (r.artist) what += ` by ${r.artist}`;
  return what;
}
const ruleCards = (r) => cards.filter((c) => matchRule(r, c));
const ruleLeft = (r) => ruleCards(r).filter((c) => !c.owned && chasing[c.id] !== false);
// The rules fold into c.chase0 (isChase reads chasing[c.id] ?? c.chase0, so a hand-picked off wins). Returns the
// cards that just joined the chase list.
function applyRules() {
  const lit = [];
  for (const c of cards) { const was = isChase(c); c.chase0 = chases.some((r) => r.kind !== "natdex" && matchRule(r, c)); if (!was && isChase(c)) lit.push(c); } // the Complete Dex adds nothing: Show, Missing is its list
  return lit;
}
// A wall that has never had a chase starts with a few, so the shape is there to see: a Pokémon, an artist, a rarity in a set, a set's popular cards.
if (firstChases) {
  chases = [{ kind: "pokemon", dex: 6 }, { kind: "artist", artist: "Mitsuhiro Arita" }, { kind: "dex", set: "sv3pt5", rarity: FULL }, { kind: "popular", set: "base1", popular: true }].map((r, i) => ({ ...r, id: `seed${i}`, label: labelOf(r) }));
  persistChases();
}
applyRules();

// ----- twins: a chase's panel holds the same cards as their sets, in a second place on the wall -----
const PER_VIEW = { x: 0, y: 0, sz: 1, col: 0, row: 0, e: 1, anim: null, intro: 0, m: null, pm: null, g: 0, k: 0, lift: 0, delay: 0, flash: null, away: false, o: null, spot: null, held: false, tcur: null, handed: false, px: 0, py: 0 };
function twinOf(b, id) {
  b.twins ||= new Map();
  let t = b.twins.get(id);
  if (!t) { t = Object.create(b); Object.assign(t, PER_VIEW, { base: b }); b.twins.set(id, t); }
  return t;
}
const twinsOf = (c) => { const b = c.base || c; return b.twins && mode === "set" ? [...b.twins.values()] : []; };
const CHASE_INKS = ["#C9962B", "#B5533C", "#4D7FC4", "#5B9E66", "#9A5FC9", "#C06A9B"];
const chaseGroups = new Map(); // id -> its group, kept across arrangements so an open binder stays the same object
function chaseGroup(r, i) {
  if (r.kind === "natdex") return natdexGroup(r, i); // one slot per Pokémon (85-natdex.js)
  const list = ruleCards(r).map((b) => twinOf(b, r.id));
  let g = chaseGroups.get(r.id);
  if (!g) { g = { key: `chase:${r.id}`, chase: r }; chaseGroups.set(r.id, g); }
  g.name = r.label; g.ink = CHASE_INKS[i % CHASE_INKS.length]; g.cards = list; g.base = list;
  g.sub = () => (state.value ? `Your chase. Yours is worth ${money(worthOf(list))}` : showNow() === "missing" ? `Your chase. ${list.length - ownedIn(list)} to go` : `Your chase. ${ownedIn(list)} of ${list.length}`);
  return g;
}

// ----- adding and taking off: the wall takes its new shape, a new chase's cards flying out of their sets -----
const newId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
function pumpUntil(t) { const f = () => { kick(); if (performance.now() < t) setTimeout(f, 40); }; f(); }
function flashLit(lit) {
  if (!lit.length) return;
  const now = performance.now();
  lit.forEach((c, i) => { const f = { t0: now + Math.min(700, i * 14), gold: true }; c.flash = f; for (const t of twinsOf(c)) t.flash = { ...f }; });
  pumpUntil(now + 1900);
}
function reflow() {
  const now = performance.now();
  if (view === "set" && state.g) { // inside a binder: the mosaic takes its new shape underneath; a lifted binder reshuffles
    const g = state.g;
    if (lifted) for (const c of g.cards) { c.px = c.x; c.py = c.y; }
    arrange(mode); layoutAll();
    if (lifted && !reduced && !state.focus && !state.trans) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.4); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
    kick(); return;
  }
  const still = document.body.classList.contains("listmode") || tbl.on || wel.on || state.trans?.kind === "open" || view !== "mosaic";
  if (still) { arrange(mode); layoutAll(); kick(); return; }
  if (state.trans) finishTransition();
  const was = new Set(drawnCards);
  for (const c of drawnCards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  arrange(mode); layoutAll();
  for (const c of drawnCards) {
    if (!was.has(c)) c.pm = { ...(c.base?.pm || c.base?.m || c.m) }; // a new twin flies out of its set's tile
    c.delay = reduced ? 0 : Math.min(400, c.g * 30 + c.k * 0.5);
  }
  for (const g of groups) if (!g.pm) g.pm = { x: g.m.x, y: g.m.y + g.m.h / 2, w: g.m.w, h: 0 };
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
function chasesChanged(lit = []) {
  persistChases(); reflow(); syncDone({ quiet: true }); flashLit(lit); // a chase you already have every card of is a trophy the moment it's made
  syncBadge(); refreshChips(); updateCount(); drawList(); kick();
}
function addChase(r, { quiet = false } = {}) {
  const had = findRule(r); if (had) return had;
  r.id ||= newId(); r.label ||= labelOf(r);
  chases.push(r);
  const lit = applyRules();
  tick(8); chasesChanged(lit);
  if (!quiet && r.kind === "natdex") toast(dexAddedText(r), () => removeChase(r, { quiet: true }));
  else if (!quiet) { const left = ruleLeft(r), d = left.filter((c) => c.deal).length; toast(`${r.label} is on your wall. ${left.length ? `${left.length} to find${d ? `, ${d} with a live deal` : ""}.` : "You have them all."}`, () => removeChase(r, { quiet: true })); }
  return r;
}
function removeChase(r, { quiet = false } = {}) {
  const i = chases.indexOf(r); if (i < 0) return;
  const g = chaseGroups.get(r.id);
  const go = () => {
    if (!chases.includes(r)) return;
    chases.splice(chases.indexOf(r), 1); chaseGroups.delete(r.id);
    for (const c of cards) c.twins?.delete(r.id);
    applyRules(); tick(5); chasesChanged();
    if (!quiet) toast(`${r.label} taken off the wall.`, () => { chases.splice(Math.min(i, chases.length), 0, r); applyRules(); chasesChanged(); });
  };
  leaveBinderThen(g, go);
}
function toggleRule(r) { const had = findRule(r); if (had) removeChase(had); else addChase(r); }
// Chase the cards people chase in a set, from its "People chase" row. Tapping again takes the chase off.
const popularRule = (st) => chases.find((r) => r.popular && r.set === st.id);
function chasePopular(st) {
  const had = popularRule(st);
  if (had) { removeChase(had); return; }
  addChase({ kind: "popular", set: st.id, popular: true });
}

// ----- "Chase more like this": one-tap rules made from the card in hand, on the card panel and in the Chase pop -----
function rulesFor(c) {
  const st = sets[c.si], out = [], seen = new Set();
  const add = (r, min = 2) => {
    const all = ruleCards(r), k = all.map((x) => x.i).join(",");
    if (all.length < min || seen.has(k)) return; // nothing beyond this card, or the same cards as a row above
    seen.add(k);
    out.push({ r, n: all.filter((x) => !x.owned).length, on: Boolean(findRule(r)), label: labelOf(r) });
  };
  if (c.dex) add({ kind: "pokemon", dex: c.dex });
  add({ kind: "artist", artist: c.artist });
  if (c.tier >= FULL) add({ kind: "dex", set: st.id, rarity: FULL });
  if (c.dex) add({ kind: "custom", artist: c.artist, dex: c.dex });
  if (c.pop) add({ kind: "popular", set: st.id, popular: true });
  add({ kind: "set", set: st.id }, 1);
  return out.filter((x) => x.n > 0 || x.on);
}
function moreLikeEl(host, before) {
  const el = document.createElement("div"); el.className = "morelike"; el.hidden = true;
  el.innerHTML = `<p class="ml-head">Chase more like this</p><div class="ml-row" role="group" aria-label="Chase more like this"></div>`;
  host.querySelector(before).before(el);
  el.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b || !el.list) return; toggleRule(el.list[Number(b.dataset.i)].r); });
  return el;
}
const panelMore = moreLikeEl(panel, ".hint"), popMore = moreLikeEl(offersEl, ".o-acts");
function fillChips(el, c) {
  const list = rulesFor(c), row = el.querySelector(".ml-row"), sl = row.scrollLeft;
  el.list = list; el.hidden = !list.length;
  row.innerHTML = list.map((x, i) => `<button type="button" class="chip" aria-pressed="${x.on}" data-i="${i}" aria-label="${esc(x.label)}, ${x.n} to find"><b>${esc(x.label)}</b><span>${x.n}</span></button>`).join("");
  row.scrollLeft = sl;
}
function refreshChips() { if (state.focus) fillPanel(state.focus, 0); if (pop.c) fillOffers(pop.c); }

// ----- New chase: one plain form, along the bottom, with a live count; the wall under it dims to the match -----
const sheetEl = document.getElementById("chase-sheet");
const csQ = sheetEl.querySelector("#cs-q"), csN = sheetEl.querySelector("#cs-n"), csLine = sheetEl.querySelector("#cs-line"), csSave = sheetEl.querySelector("#cs-save");
const draft = { set: null, dex: null, artist: null, rarity: 0, type: null, natdex: false, edit: null }; // natdex: the Complete Dex; edit: the Dex whose settings these are
let preview = null; // while the form is up, the wall shows what the rule would match
const building = () => !sheetEl.inert;
function draftRule() {
  if (draft.natdex) { const d = { kind: "natdex" }; if (draft.rarity) d.rarity = draft.rarity; if (draft.type) d.type = draft.type; return d; }
  const r = { kind: "custom" };
  if (draft.set) r.set = draft.set; if (draft.dex) r.dex = draft.dex; if (draft.artist) r.artist = draft.artist; if (draft.rarity) r.rarity = draft.rarity; if (draft.type) r.type = draft.type;
  if (!r.set && !r.dex && !r.artist && (r.rarity || r.type)) r.kind = "dex";
  return r;
}
const draftReady = () => Boolean(draft.natdex || draft.set || draft.dex || draft.artist || draft.rarity || draft.type);
const chipHTML = (v, text, on, sub = "") => `<button type="button" class="cs-chip" data-v="${esc(v)}" aria-pressed="${on}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
function renderSheet() {
  dexSheetSync(); // the Complete Dex choice, and the Dex's own settings (85-natdex.js)
  sheetEl.querySelector("#cs-sets").innerHTML = sets.map((st) => chipHTML(st.id, st.name, draft.set === st.id, String(st.year))).join("");
  sheetEl.querySelector("#cs-artists").innerHTML = ARTISTS.map((a) => chipHTML(a, a, draft.artist === a)).join("");
  sheetEl.querySelectorAll("[data-rar]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.rar) === draft.rarity)));
  sheetEl.querySelector("#cs-types").innerHTML = chipHTML("", "Any", !draft.type) + Object.entries(TYPE).filter(([k]) => k !== "t" && k !== "e").map(([k, [name]]) => chipHTML(k, name, draft.type === k)).join("");
  renderSuggestions(); renderCount();
}
function renderSuggestions() {
  const q = csQ.value.trim().toLowerCase(), byCards = (a, b) => b.n - a.n || a.dex - b.dex;
  let list = q ? speciesList.filter((s) => s.name.toLowerCase().startsWith(q)).sort(byCards) : [];
  if (q && list.length < 6) list = [...list, ...speciesList.filter((s) => !list.includes(s) && s.name.toLowerCase().includes(q)).sort(byCards)];
  if (!q && draft.dex) list = speciesList.filter((s) => s.dex === draft.dex);
  const hit = list.find((s) => s.name.toLowerCase() === q);
  if (hit && draft.dex !== hit.dex) draft.dex = hit.dex; // typed the whole name: that's the one
  else if (!hit && q && draft.dex && !list.some((s) => s.dex === draft.dex)) draft.dex = null;
  sheetEl.querySelector("#cs-sugg").innerHTML = list.slice(0, 8).map((s) => chipHTML(String(s.dex), s.name, draft.dex === s.dex, `${s.n} card${s.n === 1 ? "" : "s"}`)).join("") || (q ? `<span class="cs-none">No Pokémon called "${esc(csQ.value.trim())}" here.</span>` : "");
}
function renderCount() {
  if (draft.natdex) { dexSheetCount(); return; }
  const r = draftRule(), ready = draftReady();
  const m = ready ? ruleCards(r) : [], n = m.filter((c) => !c.owned && chasing[c.id] !== false).length;
  csN.textContent = String(n); csN.classList.toggle("zero", !n);
  csLine.innerHTML = !ready ? "Pick a set, a Pokémon, an artist, a rarity or a type. They combine." : `<b>${esc(labelOf(r))}.</b> ${m.length ? `${m.length} card${m.length === 1 ? "" : "s"}, you have ${m.length - n}.` : "No cards match."}`;
  csSave.disabled = !ready || !m.length;
  preview = ready && m.length ? new Set(m) : null;
  kick();
}
function openSheet(pre = {}) {
  if (tbl.on || wel.on) return;
  if (view === "set" && !pre.edit) { exitToMosaic(); } // the Dex's settings open over its binder
  Object.assign(draft, { set: null, dex: null, artist: null, rarity: 0, type: null, natdex: false, edit: null }, pre);
  csQ.value = pre.dex ? SPECIES.get(pre.dex) || "" : "";
  sheetEl.inert = false; document.body.classList.add("building");
  renderSheet(); tick(4);
  requestAnimationFrame(() => sheetEl.classList.add("on"));
}
function closeSheet() {
  if (!building()) return;
  sheetEl.inert = true; sheetEl.classList.remove("on"); document.body.classList.remove("building");
  preview = null; csQ.blur(); kick();
}
sheetEl.addEventListener("click", (e) => {
  const rar = e.target.closest("[data-rar]"), ch = e.target.closest(".cs-chip");
  if (e.target.closest("#cs-dex")) { draft.natdex = !draft.natdex; tick(3); renderSheet(); return; }
  if (rar) { draft.rarity = Number(rar.dataset.rar); tick(3); renderSheet(); return; }
  if (!ch) return;
  const box = ch.parentElement.id, v = ch.dataset.v; tick(3);
  if (box === "cs-sets") draft.set = draft.set === v ? null : v;
  else if (box === "cs-artists") draft.artist = draft.artist === v ? null : v;
  else if (box === "cs-types") draft.type = v || null;
  else if (box === "cs-sugg") { const dex = Number(v); draft.dex = draft.dex === dex ? null : dex; csQ.value = draft.dex ? SPECIES.get(dex) : ""; }
  renderSheet();
});
csQ.addEventListener("input", () => { renderSuggestions(); renderCount(); });
csQ.addEventListener("keydown", (e) => {
  e.stopPropagation(); // the wall's shortcuts stay out of the field
  if (e.key === "Enter") { const first = sheetEl.querySelector("#cs-sugg .cs-chip"); if (first && !draft.dex) first.click(); csQ.blur(); }
  if (e.key === "Escape") closeSheet();
});
sheetEl.querySelector("#cs-close").onclick = () => closeSheet();
csSave.onclick = () => {
  if (!draftReady()) return;
  const r = draftRule(); r.label = labelOf(r);
  const edit = draft.edit;
  closeSheet(); tick(8);
  if (edit) setDexFilter(edit, r); else addChase(r);
};
addEventListener("keydown", (e) => { if (e.key === "Escape" && building() && !paying() && !pop.c) { e.preventDefault(); closeSheet(); } });
document.getElementById("list").addEventListener("click", (e) => { const n = e.target.closest("[data-lnew]"); if (n) { setListMode(false); setTimeout(() => openSheet(), 60); } });

// ----- the "People chase" row under a set's title, and the Remove chase button on a chase's -----
// Laid out in framed pixels (1 = the set framed to the screen), so the header's height is known before anything is measured.
const POP_CHIP = 24, POP_GAP = 6, POP_ROWS = 3, SEG_W = 72, SEG_H = 26;
const SCOPES = [["set", "Set"], ["master", "Master set"], ["grand", "Grand set"]];
function popLayout(g) {
  const st = g.set, W = vw - 24, chips = [];
  // line one: the view (Set, Master set, Grand set) and Chase these; then People chase and its chips
  g.seg = st.master.length || st.grand.length ? SCOPES.map(([key, label], i) => ({ key, label, x: i * (SEG_W + 2), y: 2, w: SEG_W, h: SEG_H })) : null;
  g.hdrBtn = { x: W - 112, y: 4, w: 112, h: 22, pop: true };
  const top = g.seg ? 46 : 0;
  g.hdrBtn2 = { x: W - 96, y: top + 2, w: 96, h: 22, remove: true }; // Remove set, on the People chase line
  let x = 0, row = 0, more = 0;
  for (const c of st.pop) {
    const price = short(c.price), w = Math.min(W, Math.round(c.name.length * 6.1 + price.length * 6.4 + 26));
    if (x + w > W && x > 0) { row++; x = 0; }
    if (row >= POP_ROWS) { more++; continue; }
    chips.push({ c, x, y: top + 30 + row * (POP_CHIP + POP_GAP), w, h: POP_CHIP, price });
    x += w + POP_GAP;
  }
  const rows = chips.length ? Math.min(POP_ROWS, row + 1) : 0;
  g.popChips = chips; g.popMore = more; g.popTop = top;
  g.popH = top + 32 + rows * (POP_CHIP + POP_GAP) + 2;
}
// The set, its master set (every printing), or its grand set (the reprints too): the binder reshuffles, the new
// printings springing out of the cards they print.
function setScope(st, key) {
  if (scopeOf(st) === key) return;
  scopes[st.id] = key; try { localStorage.setItem("wall-scope", JSON.stringify(scopes)); } catch { /* fine */ }
  const g = state.g && state.g.set === st ? state.g : null, now = performance.now();
  if (g) {
    const old = new Set(g.base);
    for (const c of g.base) { c.px = c.x; c.py = c.y; }
    arrange(mode); layoutAll(); clampCam(g);
    for (const c of g.cards) if (!old.has(c)) { const o = c.of || c; c.px = o.x; c.py = o.y; }
    if (!reduced && !state.focus && !state.trans) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.2); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
  } else { arrange(mode); layoutAll(); }
  const n = scopedCards(st).length;
  tick(5); toast(key === "set" ? `${st.name}: the set, ${n} cards.` : key === "master" ? `${st.name} master set: every printing, ${n} cards.` : `${st.name} grand set: every printing and reprint, ${n} cards.`);
  updateCount(); drawList(); kick();
}
// Leaving a binder before its group changes under you: framed first, then the close flight, then the change.
function leaveBinderThen(g, fn) {
  if (view === "set" && state.g === g) {
    if (state.focus) unfocus();
    Object.assign(cam, fitCam(g)); fly = null; inertia = false;
    exitToMosaic();
    const T = state.trans;
    if (T) { const d = T.done; T.done = (x) => { d?.(x); fn(); }; } else fn();
  } else fn();
}
// Taking a set off the wall: it folds to a line beneath the others (Settings has your sets), with Undo.
function removeSet(st) {
  const shown = pickedSets.size ? [...pickedSets] : sets.map((s) => s.id);
  if (shown.length <= 1) { toast(`${st.name} is the last set on your wall.`); return; }
  const was = [...pickedSets];
  const apply = (ids) => { pickedSets.clear(); for (const id of ids) pickedSets.add(id); persistSets(); };
  const go = () => { apply(shown.filter((id) => id !== st.id)); foldFlight(); drawList(); toast(`${st.name} taken off the wall.`, () => { apply(was); foldFlight(); drawList(); }); };
  leaveBinderThen(groups.find((g) => g.set === st), go);
}
// The chip or the button under a point in a binder's header, in framed pixels.
function headAt(g, sx, sy) {
  const p = toWorld(sx, sy), k = (vw - 24) / g.w, fx = (p.x - g.x) * k, fy = (p.y - g.y) * k;
  for (const b of [g.hdrBtn, g.hdrBtn2]) if (b) { const by = 132 + b.y; if (fx >= b.x - 6 && fx <= b.x + b.w + 6 && fy >= by - 4 && fy <= by + b.h + 4) return { btn: b }; }
  if (g.natdex && !finishOf(g)?.put) return dexHeadAt(g, fx, fy - 132); // the Dex's prints, type and regions
  if (!g.popChips) return null;
  const py = fy - 132; if (py < 0 || py > g.popH) return null;
  if (g.seg) for (const s of g.seg) if (fx >= s.x && fx <= s.x + s.w && py >= s.y - 3 && py <= s.y + s.h + 3) return { seg: s.key };
  for (const ch of g.popChips) if (fx >= ch.x && fx <= ch.x + ch.w && py >= ch.y - 3 && py <= ch.y + ch.h + 3) return { c: ch.c };
  return null;
}
function drawHdrBtn(g, b, sx, by, k, alpha) {
  const on = b.shelf || b.away || (b.pop && Boolean(popularRule(g.set))), bx = sx + b.x * k, bw = b.w * k, bh = b.h * k;
  rr(bx, by, bw, bh, 6 * k);
  if (on) { ctx.fillStyle = theme.gold; ctx.globalAlpha = alpha * 0.18; ctx.fill(); ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  else if (b.pop) { ctx.fillStyle = theme.ink; ctx.fill(); }
  else { ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  ctx.fillStyle = on || !b.pop ? theme.ink : theme.bg; font(700, 11 * k); ctx.textAlign = "center";
  ctx.fillText(b.away ? "To the case now" : b.shelf ? (finishOf(g)?.put ? "Back to the wall" : "Put on the shelf") : b.pop ? (on ? "Chasing these ✓" : "Chase these") : b.remove ? "Remove set" : "Remove chase", bx + bw / 2, by + bh * 0.68);
  ctx.textAlign = "left";
}
function drawPopRow(g, sx, y0, k, alpha) {
  if (k < 0.3 || !g.popChips) return;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  if (g.seg) { // the view: Set, Master set, Grand set
    const cur = scopeOf(g.set);
    for (const s of g.seg) {
      const x = sx + s.x * k, y = y0 + s.y * k, w = s.w * k, h = s.h * k, on = s.key === cur;
      rr(x, y, w, h, 7 * k);
      if (on) { ctx.fillStyle = theme.ink; ctx.fill(); } else { ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = Math.max(1, k * 0.8); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
      ctx.fillStyle = on ? theme.bg : theme.muted; font(700, 10.5 * k); ctx.textAlign = "center"; ctx.fillText(s.label, x + w / 2, y + h * 0.66);
    }
    ctx.textAlign = "left";
  }
  ctx.fillStyle = theme.muted; font(600, 11 * k); ctx.fillText("People chase", sx, y0 + (g.popTop + 16) * k);
  drawHdrBtn(g, g.hdrBtn, sx, y0 + g.hdrBtn.y * k, k, alpha);
  if (g.hdrBtn2) drawHdrBtn(g, g.hdrBtn2, sx, y0 + g.hdrBtn2.y * k, k, alpha);
  for (const ch of g.popChips) {
    const x = sx + ch.x * k, y = y0 + ch.y * k, w = ch.w * k, h = ch.h * k, c = ch.c;
    rr(x, y, w, h, 6 * k); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
    ctx.lineWidth = Math.max(1, k * 0.8); ctx.strokeStyle = isChase(c) ? theme.gold : theme["slot-line"]; ctx.stroke(); // gold: on your chase list
    const pad = 9 * k;
    ctx.fillStyle = theme.muted; font(600, 10 * k); const pw = textW(ch.price);
    ctx.fillText(ch.price, x + w - pad - pw, y + h * 0.68);
    ctx.fillStyle = c.owned ? theme.muted : theme.ink; font(700, 10.5 * k, true);
    ctx.fillText(fitText(c.name, w - pad * 2 - pw - 5 * k), x + pad, y + h * 0.68);
  }
  if (g.popMore) {
    const last = g.popChips[g.popChips.length - 1], x = sx + (last.x + last.w + POP_GAP) * k, y = y0 + last.y * k;
    ctx.fillStyle = theme.muted; font(600, 10.5 * k);
    if (x + textW(`and ${g.popMore} more`) <= sx + (vw - 24) * k) ctx.fillText(`and ${g.popMore} more`, x, y + last.h * k * 0.68);
  }
}
// The New chase panel at the end of the wall (laid out in 30-layout, drawn in 40-render).
function drawNewPanel(now, alpha) {
  const p = newPanel; if (!p) return;
  const m = mr(p); if (m.y > vh || m.y + m.h < 0) return;
  ctx.globalAlpha = alpha * 0.9;
  ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2; ctx.strokeStyle = theme.muted;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12); ctx.stroke(); ctx.setLineDash([]);
  if (state.press?.newPanel) { ctx.fillStyle = theme.panelFill; ctx.fill(); }
  ctx.fillStyle = theme.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle"; font(700, 15, true);
  ctx.fillText(chases.length ? "+ New chase" : "+ New chase: a Pokémon, an artist, full art, or a mix", m.x + m.w / 2, m.y + m.h / 2 + 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
}
const newPanelAt = (sx, sy) => { const p = newPanel; if (!p || view !== "mosaic" || lifted) return false; const y = sy + mScroll; return sx >= p.x && sx <= p.x + p.w && y >= p.y && y <= p.y + p.h; };
// Debug builds only: the tests' hook learns about the chases.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { chases: { get: () => chases }, groupsNow: { get: () => groups }, newPanel: { get: () => newPanel }, addChase: { value: addChase }, removeChase: { value: removeChase }, drawnCards: { get: () => drawnCards } }); }, 0);
