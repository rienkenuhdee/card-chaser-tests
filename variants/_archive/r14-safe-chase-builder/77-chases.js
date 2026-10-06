// ---------- chases: a saved chase is a rule, like a saved search in a shop ----------
// A collector defines a chase as a set, one Pokémon (its Dex number, so every print of it counts), an artist, the
// Dex with options (full art only, holo and up, a type), or any combination (Custom: every picker at once). Every
// unowned card a saved chase matches is on the chase list, on top of the cards picked by hand; a card turned off by
// hand stays off. The rules live in wall-chases. The top-left menu lists them with a count and has New chase, which
// opens a glass sheet along the bottom with the kind picker and a live count. Inside a set, a "People chase" row
// under the title shows the cards people typically chase in it, and the mosaic marks them with a gold corner.

// ----- the rules -----
const HOLO = 3, FULL = 4; // tiers: Rare Holo is 3; VMAX, Ultra, Illustration rares and up are 4
let chases = [];
try { chases = JSON.parse(localStorage.getItem("wall-chases-safe") || "[]") || []; } catch { chases = []; }
if (!Array.isArray(chases)) chases = [];
chases = chases.filter((r) => r && typeof r === "object" && r.id && r.label);
const persistChases = () => { try { localStorage.setItem("wall-chases-safe", JSON.stringify(chases)); } catch { /* private mode */ } };
// A Pokémon is its Dex number. Its name is the plainest card name for it (no Dark, Galarian, V or ex).
const baseName = (n) => n.replace(/^(Dark|Light|Galarian|Alolan|Hisuian|Paldean|Shining|Mega|M|Team Rocket's|Rocket's|Brock's|Misty's|Erika's|Sabrina's|Koga's|Blaine's|Giovanni's|Lt\. Surge's) /, "").replace(/ (V|VMAX|VSTAR|ex|EX|GX|BREAK|Prime|LEGEND|LV\.X)$/, "");
const SPECIES = new Map();
for (const c of cards) if (c.dex) { const n = baseName(c.name), cur = SPECIES.get(c.dex); if (!cur || n.length < cur.length) SPECIES.set(c.dex, n); }
const speciesList = [...SPECIES].map(([dex, name]) => ({ dex, name, n: cards.filter((c) => c.dex === dex).length })).sort((a, b) => a.dex - b.dex);
function matchRule(r, c) {
  if (r.set && sets[c.si].id !== r.set) return false;
  if (r.dex && c.dex !== r.dex) return false;
  if (r.artist && c.artist !== r.artist) return false;
  if (r.rarity && c.tier < r.rarity) return false;
  if (r.type && c.type !== r.type) return false;
  if (r.kind === "dex" && !r.only && !c.dex) return false; // the Dex is Pokémon cards only
  if (r.only && !r.only.includes(c.id)) return false;
  return true;
}
// What the rules match, remembered until a rule changes (isChase runs for every card every frame).
const ruled = new Set();
function refreshRules() { ruled.clear(); for (const c of cards) for (const r of chases) if (matchRule(r, c)) { ruled.add(c.id); break; } }
refreshRules();
// isChase reads chasing[c.id] ?? c.chase0. The hand-picked marks stay in the map; a card that has no mark of its own
// reads as chased when a saved rule matches it. A hand-picked off (false) wins over any rule.
const handPicked = chasing;
chasing = new Proxy(handPicked, { get: (t, k) => (Object.hasOwn(t, k) ? t[k] : ruled.has(k) ? true : undefined) });
const ruleMatches = (r) => cards.filter((c) => matchRule(r, c));
const ruleToFind = (r) => cards.filter((c) => !c.owned && matchRule(r, c) && handPicked[c.id] !== false).length;
const setById = (id) => sets.find((s) => s.id === id);
// "Charizard", "Base Set", "Full art Fire Pokémon", "Charizard by Ken Sugimori", "Holo in Base Set", "Popular in 151".
function labelOf(r) {
  const adj = [r.rarity === FULL ? "Full art" : r.rarity === HOLO ? "Holo" : "", r.type ? (TYPE[r.type] || TYPE.C)[0] : ""].filter(Boolean).join(" ");
  let what = r.dex ? SPECIES.get(r.dex) || "Pokémon" : r.only ? "Popular" : r.kind === "dex" ? (adj ? "Pokémon" : "Every Pokémon") : "";
  what = `${adj} ${what}`.trim();
  const st = r.set ? setById(r.set) : null;
  if (!what) { if (st) { what = st.name; if (r.artist) what += ` by ${r.artist}`; return what; } return r.artist || "Everything"; }
  if (st) what += ` in ${st.name}`;
  if (r.artist) what += ` by ${r.artist}`;
  return what;
}
const newId = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
let activeChase = null; // the saved chase the Chase lens is showing first, if any
function chasesChanged() {
  refreshRules(); persistChases(); renderChaseMenu(); syncPill(); drawList();
  if (lifted) liftLayout(true); else kick();
}
function addChase(r, { show = true } = {}) {
  r.id ||= newId(); r.label ||= labelOf(r);
  chases.push(r);
  if (show) activeChase = r;
  chasesChanged();
  return r;
}
function deleteChase(r, { quiet = false } = {}) {
  const i = chases.indexOf(r); if (i < 0) return;
  chases.splice(i, 1);
  if (activeChase === r) activeChase = null;
  chasesChanged(); tick(6);
  if (!quiet) toast(`${r.label} deleted.`, () => { chases.splice(Math.min(i, chases.length), 0, r); chasesChanged(); });
}
// Tapping a saved chase: the Chase lens, with that chase's cards first in every set and its sets first on the wall.
function showChase(r) {
  activeChase = r;
  if (document.body.classList.contains("listmode")) { if (state.lens !== "chase") setLens("chase"); else drawList(); syncPill(); return; }
  if (view === "set") { if (state.trans) finishTransition(); view = "mosaic"; state.g = null; setChrome(); }
  mScroll = 0;
  if (state.lens !== "chase") setLens("chase"); else liftLayout(true);
  const n = ruleToFind(r);
  toast(n ? `${r.label}: ${n} to find, first in each set.` : `${r.label}: nothing left to find.`);
  syncPill(); kick();
}
function clearActive() { if (!activeChase) return; activeChase = null; syncPill(); if (lifted) liftLayout(true); drawList(); }
lensBox.addEventListener("click", () => { if (state.lens !== "chase") clearActive(); });
// Reset the demo clears the saved chases too.
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases-safe", "wall-spares", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ----- the chase lens shows the active chase first -----
function orderGroup(g) {
  g.base ||= g.cards;
  const key = state.lens === "trade" ? isSpare : isChase, ord0 = state.lens === "trade" ? spareOrder : chaseOrder;
  const act = state.lens === "chase" ? activeChase : null;
  const ord = act ? (a, b) => (matchRule(act, b) ? 1 : 0) - (matchRule(act, a) ? 1 : 0) || ord0(a, b) : ord0;
  const lead = lifted ? g.base.filter(key).sort(ord) : [];
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !key(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}
function liftedLayout() {
  const R = { x: 8, y: topPad(), w: vw - 16 };
  let live = groups.filter((g) => g.lead.length);
  const folded = groups.filter((g) => !g.lead.length);
  const act = state.lens === "chase" ? activeChase : null;
  if (act) { const has = (g) => g.lead.some((c) => matchRule(act, c)); live = [...live.filter(has), ...live.filter((g) => !has(g))]; }
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

// ----- the active chase, named above the lens bar -----
const pillEl = document.createElement("div");
pillEl.className = "chase-pill glass"; pillEl.id = "chase-pill"; pillEl.hidden = true;
pillEl.innerHTML = `<b id="cp-name"></b><span id="cp-n"></span><button type="button" class="cp-x" id="cp-x" aria-label="Show every chase"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
document.body.append(pillEl);
pillEl.querySelector("#cp-x").onclick = () => { tick(4); clearActive(); };
function syncPill() {
  const on = Boolean(activeChase) && state.lens === "chase";
  pillEl.hidden = !on;
  if (!on) return;
  const n = ruleToFind(activeChase);
  pillEl.querySelector("#cp-name").textContent = activeChase.label;
  pillEl.querySelector("#cp-n").textContent = n ? `${n} to find` : "all found";
}
function updateCount() {
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
  syncPill();
}

// ----- the menu: your chases, and New chase -----
const menuRows = document.createElement("div");
menuRows.className = "ch-rows";
arrMenu.append(menuRows);
function renderChaseMenu() {
  const rows = chases.map((r) => {
    const n = ruleToFind(r);
    return `<div class="ch-row"><button type="button" role="menuitem" class="ch-go" data-chase="${r.id}" aria-current="${activeChase === r}"><span><b>${esc(r.label)}</b><small>${n ? `${n} to find` : "All found"}</small></span></button><button type="button" class="ch-del" data-del="${r.id}" aria-label="Delete ${esc(r.label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4.5h5V7"/></svg></button></div>`;
  }).join("");
  menuRows.innerHTML = `<p class="ch-head">Your chases</p>${rows}<button type="button" role="menuitem" class="ch-new" data-new><span><b>New chase</b><small>${chases.length ? "A set, a Pokémon, an artist, or a mix" : "Pick a set, a Pokémon, an artist, or mix them"}</small></span><span class="ch-plus" aria-hidden="true">+</span></button>`;
}
renderChaseMenu();
arrBtn.onclick = (e) => { e.stopPropagation(); if (arrMenu.hidden) renderChaseMenu(); setMenu(arrMenu.hidden); };
menuRows.addEventListener("click", (e) => {
  const go = e.target.closest("[data-chase]"), del = e.target.closest("[data-del]"), nu = e.target.closest("[data-new]");
  if (go) { setMenu(false); const r = chases.find((x) => x.id === go.dataset.chase); if (r) { tick(5); showChase(r); } }
  else if (del) { const r = chases.find((x) => x.id === del.dataset.del); if (r) { deleteChase(r); renderChaseMenu(); } }
  else if (nu) { setMenu(false); openSheet(); }
});

// ----- the sheet: New chase -----
const sheetEl = document.createElement("section");
sheetEl.className = "chase-sheet glass"; sheetEl.id = "chase-sheet"; sheetEl.setAttribute("aria-label", "New chase"); sheetEl.inert = true;
sheetEl.innerHTML = `
  <div class="cs-top"><b class="cs-title">New chase</b><button type="button" class="ib" id="cs-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <div class="seg cs-kind" role="group" aria-label="What kind of chase"><button type="button" data-kind="set">Set</button><button type="button" data-kind="pokemon">Pokémon</button><button type="button" data-kind="artist">Artist</button><button type="button" data-kind="dex">Dex</button><button type="button" data-kind="custom">Custom</button></div>
  <div class="cs-fields">
    <div class="cs-field" data-f="set"><span class="cs-lbl">Set</span><div class="cs-chips" id="cs-sets"></div></div>
    <div class="cs-field" data-f="pokemon"><label class="cs-lbl" for="cs-q">Pokémon</label><input class="cs-in" id="cs-q" type="text" placeholder="Type a name" autocomplete="off" autocapitalize="words" enterkeyhint="done"><div class="cs-chips wrap" id="cs-sugg"></div></div>
    <div class="cs-field" data-f="artist"><span class="cs-lbl">Artist</span><div class="cs-chips" id="cs-artists"></div></div>
    <div class="cs-field" data-f="rarity"><span class="cs-lbl">Rarity</span><div class="seg cs-rar" role="group" aria-label="Rarity"><button type="button" data-rar="0">Any</button><button type="button" data-rar="${HOLO}">Holo and up</button><button type="button" data-rar="${FULL}">Full art only</button></div></div>
    <div class="cs-field" data-f="type"><span class="cs-lbl">Type</span><div class="cs-chips" id="cs-types"></div></div>
  </div>
  <div class="cs-foot"><div class="cs-tally"><b id="cs-n">0</b><small>to find</small></div><span class="cs-line" id="cs-line"></span><button type="button" class="mbtn primary" id="cs-save">Save</button></div>`;
document.body.append(sheetEl);
const csQ = sheetEl.querySelector("#cs-q"), csN = sheetEl.querySelector("#cs-n"), csLine = sheetEl.querySelector("#cs-line"), csSave = sheetEl.querySelector("#cs-save");
const FIELDS = { set: ["set"], pokemon: ["pokemon"], artist: ["artist"], dex: ["rarity", "type"], custom: ["set", "pokemon", "artist", "rarity", "type"] };
const draft = { kind: "set", set: null, dex: null, artist: null, rarity: 0, type: null };
let preview = null; // while the sheet is up, the wall shows what the rule would match
const building = () => !sheetEl.inert;
function draftRule() {
  const r = { kind: draft.kind };
  for (const f of FIELDS[draft.kind]) { if (f === "pokemon") { if (draft.dex) r.dex = draft.dex; } else if (f === "rarity") { if (draft.rarity) r.rarity = draft.rarity; } else if (draft[f]) r[f] = draft[f]; }
  return r;
}
const draftReady = () => draft.kind === "dex" || (draft.kind === "custom" ? Boolean(draft.set || draft.dex || draft.artist || draft.rarity || draft.type) : Boolean(draftRule()[draft.kind === "pokemon" ? "dex" : draft.kind]));
const chip = (v, text, on, sub = "") => `<button type="button" class="cs-chip" data-v="${esc(v)}" aria-pressed="${on}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
function renderSheet() {
  sheetEl.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === draft.kind)));
  sheetEl.querySelectorAll("[data-f]").forEach((el) => { el.hidden = !FIELDS[draft.kind].includes(el.dataset.f); });
  sheetEl.querySelector("#cs-sets").innerHTML = sets.map((st) => chip(st.id, st.name, draft.set === st.id, String(st.year))).join("");
  sheetEl.querySelector("#cs-artists").innerHTML = ARTISTS.map((a) => chip(a, a, draft.artist === a)).join("");
  sheetEl.querySelectorAll("[data-rar]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.rar) === draft.rarity)));
  sheetEl.querySelector("#cs-types").innerHTML = chip("", "Any", !draft.type) + Object.entries(TYPE).filter(([k]) => k !== "t" && k !== "e").map(([k, [name]]) => chip(k, name, draft.type === k)).join("");
  renderSuggestions();
  renderCount();
}
function renderSuggestions() {
  const q = csQ.value.trim().toLowerCase();
  const byCards = (a, b) => b.n - a.n || a.dex - b.dex;
  let list = q ? speciesList.filter((s) => s.name.toLowerCase().startsWith(q)).sort(byCards) : [];
  if (q && list.length < 6) list = [...list, ...speciesList.filter((s) => !list.includes(s) && s.name.toLowerCase().includes(q)).sort(byCards)];
  if (!q && draft.dex) list = speciesList.filter((s) => s.dex === draft.dex);
  const hit = list.find((s) => s.name.toLowerCase() === q);
  if (hit && draft.dex !== hit.dex) draft.dex = hit.dex; // typed the whole name: that's the one
  else if (!hit && q && draft.dex && !list.some((s) => s.dex === draft.dex)) draft.dex = null;
  sheetEl.querySelector("#cs-sugg").innerHTML = list.slice(0, 8).map((s) => chip(String(s.dex), s.name, draft.dex === s.dex, `${s.n} card${s.n === 1 ? "" : "s"}`)).join("") || (q ? `<span class="cs-none">No Pokémon called "${esc(csQ.value.trim())}" here.</span>` : "");
}
function renderCount() {
  const r = draftRule(), ready = draftReady();
  const m = ready ? ruleMatches(r) : [], n = m.filter((c) => !c.owned && handPicked[c.id] !== false).length;
  csN.textContent = String(n); csN.classList.toggle("zero", !n);
  csLine.innerHTML = !ready ? (draft.kind === "pokemon" ? "Type a Pokémon's name." : draft.kind === "custom" ? "Pick anything below; they combine." : `Pick ${draft.kind === "set" ? "a set" : "an artist"}.`) : `<b>${esc(labelOf(r))}.</b> ${m.length ? `${m.length} card${m.length === 1 ? "" : "s"} match, you have ${m.length - n}.` : "No cards match."}`;
  csSave.disabled = !ready;
  preview = ready && m.length ? new Set(m) : null;
  kick();
}
function openSheet(pre = {}) {
  Object.assign(draft, { kind: "set", set: null, dex: null, artist: null, rarity: 0, type: null }, pre);
  csQ.value = pre.dex ? SPECIES.get(pre.dex) || "" : "";
  if (wel.on) finishWelcome(true);
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
  const kind = e.target.closest("[data-kind]"), rar = e.target.closest("[data-rar]"), ch = e.target.closest(".cs-chip");
  if (kind) { draft.kind = kind.dataset.kind; tick(3); renderSheet(); return; }
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
  e.stopPropagation(); // the wall's shortcuts (/ for search) stay out of the field
  if (e.key === "Enter") { const first = sheetEl.querySelector("#cs-sugg .cs-chip"); if (first && !draft.dex) first.click(); csQ.blur(); }
  if (e.key === "Escape") closeSheet();
});
sheetEl.querySelector("#cs-close").onclick = () => closeSheet();
csSave.onclick = () => {
  if (!draftReady()) return;
  const r = draftRule(); r.label = labelOf(r);
  closeSheet(); tick(8);
  const n = ruleToFind(r);
  addChase(r);
  if (n) showChase(r); else toast(`${r.label} saved. Nothing left to find.`);
};
addEventListener("keydown", (e) => { if (e.key === "Escape" && building() && !paying() && !pop.c) { e.preventDefault(); closeSheet(); } });
function emphasis(c) {
  if (c.away) return 0;
  if (preview) return preview.has(c) ? (c.owned ? 0.42 : 1) : 0.1;
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.1 : 1;
  if (state.lens === "chase") return isChase(c) ? 1 : 0.18;
  if (state.lens === "trade") return isSpare(c) ? 1 : 0.18;
  return 1;
}

// ----- popular: the cards people typically chase in a set (shared rule across the round's variants) -----
const popScore = (c) => c.tier * 2 + Math.log10(c.price + 1) * 1.5 + h32(c.id + "p");
for (const st of sets) {
  const n = Math.max(3, Math.round(0.06 * st.cards.length));
  st.pop = st.cards.slice().sort((a, b) => popScore(b) - popScore(a) || a.i - b.i).slice(0, n);
  for (const c of st.pop) c.pop = true;
}
const popularRule = (st) => chases.find((r) => r.only && r.set === st.id);
// Chase the popular ones: a Dex chase for the set, limited to its popular cards. Tapping again takes it off.
function chasePopular(st) {
  const had = popularRule(st);
  if (had) { deleteChase(had); return; }
  const r = { kind: "dex", set: st.id, only: st.pop.map((c) => c.id) };
  r.label = labelOf(r); tick(8);
  addChase(r, { show: false });
  const n = ruleToFind(r);
  toast(n ? `${r.label} saved. ${n} to find.` : `${r.label} saved. You have them all.`, () => deleteChase(r, { quiet: true }));
}
// The row under a set's title, laid out in framed pixels (1 = the set framed to the screen) so the header's height
// is known before anything is measured: a label line with the button, then chips in up to three rows.
const POP_CHIP = 24, POP_GAP = 6, POP_ROWS = 3;
function popLayout(g) {
  const st = g.set, W = vw - 24, chips = [];
  let x = 0, row = 0, more = 0;
  for (const c of st.pop) {
    const price = short(c.price), w = Math.min(W, Math.round(c.name.length * 6.1 + price.length * 6.4 + 26));
    if (x + w > W && x > 0) { row++; x = 0; }
    if (row >= POP_ROWS) { more++; continue; }
    chips.push({ c, x, y: 30 + row * (POP_CHIP + POP_GAP), w, h: POP_CHIP, price });
    x += w + POP_GAP;
  }
  const rows = chips.length ? Math.min(POP_ROWS, row + 1) : 0;
  g.popChips = chips; g.popMore = more;
  g.popH = 32 + rows * (POP_CHIP + POP_GAP) + 2;
  g.popBtn = { x: W - 112, y: 3, w: 112, h: 22 };
}
function binderLayout(g) {
  const base = clamp(Math.floor((vw - 24) / 74), 4, COLS);
  g.cols = Math.max(1, Math.floor(base / g.sz));
  g.x = 0; g.y = 0;
  g.w = g.cols * stepX(g) - GAP * g.sz;
  const k = (vw - 24) / g.w;
  if (g.set) popLayout(g); else { g.popH = 0; g.popChips = null; }
  g.head = (132 + (g.popH || 0)) / k;
  g.h = g.head + Math.ceil(g.cards.length / g.cols) * stepY(g) - GAP * g.sz;
  g.cards.forEach((c, k2) => { c.sz = g.sz; c.col = k2 % g.cols; c.row = Math.floor(k2 / g.cols); c.x = c.col * stepX(g); c.y = g.head + c.row * stepY(g); });
}
// The chip (or the button) under a point in a set's header.
function popAt(g, sx, sy) {
  if (!g.popChips) return null;
  const p = toWorld(sx, sy), k = (vw - 24) / g.w, fx = (p.x - g.x) * k, fy = (p.y - g.y) * k - 132;
  if (fy < 0 || fy > g.popH) return null;
  const b = g.popBtn;
  if (fx >= b.x - 6 && fx <= b.x + b.w + 6 && fy >= b.y - 4 && fy <= b.y + b.h + 4) return { btn: true };
  for (const ch of g.popChips) if (fx >= ch.x && fx <= ch.x + ch.w && fy >= ch.y - 3 && fy <= ch.y + ch.h + 3) return { c: ch.c };
  return null;
}
function drawPopRow(st, sx, y0, sw, k, alpha) {
  if (k < 0.3 || !st.popChips) return;
  const W = vw - 24;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.muted; font(600, 11 * k);
  ctx.fillText("People chase", sx, y0 + 16 * k);
  // the button: Chase these, or Chasing these with a gold tint once they're on your list
  const on = Boolean(popularRule(st.set)), b = st.popBtn, bx = sx + b.x * k, by = y0 + b.y * k, bw = b.w * k, bh = b.h * k;
  rr(bx, by, bw, bh, 6 * k);
  if (on) { ctx.fillStyle = theme.gold; ctx.globalAlpha = alpha * 0.18; ctx.fill(); ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  else { ctx.fillStyle = theme.ink; ctx.fill(); }
  ctx.fillStyle = on ? theme.ink : theme.bg; font(700, 11 * k); ctx.textAlign = "center";
  ctx.fillText(on ? "Chasing these ✓" : "Chase these", bx + bw / 2, by + bh * 0.68);
  ctx.textAlign = "left";
  for (const ch of st.popChips) {
    const x = sx + ch.x * k, y = y0 + ch.y * k, w = ch.w * k, h = ch.h * k, c = ch.c;
    rr(x, y, w, h, 6 * k); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
    ctx.lineWidth = Math.max(1, k * 0.8); ctx.strokeStyle = c.owned ? theme["slot-line"] : theme.gold; ctx.stroke();
    const pad = 9 * k;
    ctx.fillStyle = theme.muted; font(600, 10 * k); const pw = textW(ch.price);
    ctx.fillText(ch.price, x + w - pad - pw, y + h * 0.68);
    ctx.fillStyle = c.owned ? theme.muted : theme.ink; font(700, 10.5 * k, true);
    ctx.fillText(fitText(c.name, w - pad * 2 - pw - 5 * k), x + pad, y + h * 0.68);
  }
  if (st.popMore) {
    const last = st.popChips[st.popChips.length - 1], x = sx + (last.x + last.w + POP_GAP) * k, y = y0 + last.y * k;
    ctx.fillStyle = theme.muted; font(600, 10.5 * k);
    if (x + textW(`and ${st.popMore} more`) <= sx + W * k) ctx.fillText(`and ${st.popMore} more`, x, y + last.h * k * 0.68);
  }
}
function drawHeader(st, now, C = cam, ox = 0, alpha = 1) {
  const sx = (st.x - C.x) * C.s + ox, sy = (st.y - C.y) * C.s, sw = st.w * C.s;
  const k = (st.head * C.s) / (132 + (st.popH || 0)), hh = 132 * k; // 1 at the framed zoom
  const owned = ownedNow(st.cards), n = st.cards.length;
  ctx.globalAlpha = alpha * (state.focus ? 1 - state.dimAll * 0.7 : 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = clamp(34 * k, 16, 64), sub = clamp(14 * k, 10, 24);
  ctx.fillStyle = theme.ink; font(800, title, true);
  ctx.fillText(fitText(st.name, sw), sx, sy + hh * 0.5);
  const pct = `${Math.floor((owned / n) * 100)}%`;
  font(700, sub); const pw = ctx.measureText(pct).width;
  ctx.textAlign = "right"; ctx.fillStyle = theme.ink; ctx.fillText(pct, sx + sw, sy + hh * 0.72);
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(500, sub);
  const line = state.time ? `${owned} of ${n} by ${monthOf(state.t)}` : st.sub();
  ctx.fillText(fitText(line, sw - pw - 12), sx, sy + hh * 0.72);
  const by = sy + hh * 0.82, bh = Math.max(1.5, 3 * k);
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(sx, by, sw, bh);
  ctx.fillStyle = owned === n ? "#E2B33C" : st.ink; ctx.fillRect(sx, by, sw * (owned / n), bh);
  if (st.popH) drawPopRow(st, sx, sy + hh, sw, k, ctx.globalAlpha);
  if (st.burst) {
    const p = (now - st.burst) / 1400;
    if (p < 1) {
      const fx = sx - sw + p * sw * 3;
      const g = ctx.createLinearGradient(fx, sy, fx + sw * 0.6, sy + st.h * C.s);
      g.addColorStop(0, "rgb(255 255 255 / 0)"); g.addColorStop(0.5, "rgb(255 220 140 / .4)"); g.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.globalCompositeOperation = theme.dark ? "screen" : "multiply"; ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, st.h * C.s); ctx.globalCompositeOperation = "source-over";
    } else st.burst = 0;
  }
  ctx.globalAlpha = 1;
}
// The live feed's header beat measures from the title block, not the whole header (the row sits under it now).
function drawLive(now) {
  if (now >= live.until && !live.line) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  const g = state.g, b = live.beat;
  if (view === "set" && g && b && !state.trans) {
    const p = (now - b.t0) / 3000;
    if (p < 1) {
      const sx = (g.x - cam.x) * cam.s, sy = (g.y - cam.y) * cam.s, sw = g.w * cam.s, hh = 132 * (g.head * cam.s) / (132 + (g.popH || 0));
      ctx.globalAlpha = Math.min(1, p * 10, (1 - p) * 4); ctx.fillStyle = b.col || theme.deal; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      font(700, clamp(14 * hh / 132, 11, 20)); ctx.fillText(fitText(b.g === g ? b.text : `${b.text}, ${b.g.name}`, sw), sx + sw, sy + hh * 0.97); ctx.globalAlpha = 1;
    } else live.beat = null;
  }
  const L = live.line;
  if (L) {
    const p = (now - L.t0) / 640;
    if (p >= 1) live.line = null;
    else if (p > 0) {
      const u = Math.max(0, p * 1.3 - 0.3), v = Math.min(1, p * 1.3);
      const q = (t) => { const s = 1 - t; return [s * s * L.x0 + 2 * s * t * L.cx + t * t * L.x1, s * s * L.y0 + 2 * s * t * L.cy + t * t * L.y1]; };
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) { const [px, py] = q(u + (v - u) * i / 14); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
      ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = theme.deal; ctx.stroke();
      const [hx, hy] = q(v); ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fillStyle = theme.deal; ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  return now < live.until || Boolean(live.line);
}
// A tap on a chip brings that card up close; the button chases the popular ones. Everything else as before.
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
        if (who.length) { const chip0 = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip0); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m));
    }
    if (h?.block) enterGroup(h.block);
    return;
  }
  if (!h?.card) {
    if (h?.block?.set && !marking) { const p = popAt(h.block, sx, sy); if (p) { tick(4); if (p.btn) chasePopular(h.block.set); else focus(p.c); } }
    return;
  }
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}
// The gold corner on a popular card's tile, in the mosaic and the binder alike.
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  drawTile0(c, sx, sy, w, h, now, mult);
  if (c.pop && w >= 7 && c.e > 0.3 && !(c.lift && w > h * 1.05) && (!state.focus || state.focus === c)) {
    const s = clamp(w * 0.36, 4, 18), r = w >= 26 ? w * 0.045 : 0;
    ctx.globalAlpha = Math.min(1, mult) * c.e * 0.8; ctx.fillStyle = theme.gold;
    ctx.beginPath(); ctx.moveTo(sx + w - s, sy); ctx.lineTo(sx + w - r, sy); ctx.lineTo(sx + w, sy + r); ctx.lineTo(sx + w, sy + s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (state.lens === "need" && !c.owned && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
    ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
  }
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = col; ctx.globalAlpha = a * tint;
  if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
  if (fp) {
    const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col;
    rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ----- the list: the saved chases as rows, with Show and Delete -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const rows = chases.map((r) => { const n = ruleToFind(r); return `<li class="lwrow lchase"><div class="lrow"><span class="lname">${esc(r.label)}</span><span class="lmeta">${n ? `${n} to find` : "All found"}${activeChase === r ? ", showing first" : ""}</span></div><button type="button" class="pill-btn" data-show="${r.id}">Show</button><button type="button" class="pill-btn" data-ldel="${r.id}">Delete</button></li>`; }).join("");
    top += `<section><h2>Your chases</h2><p class="lsub">${chases.length ? "Every card a chase matches is on your chase list." : "A chase is a set, a Pokémon, an artist, the Dex with options, or a mix."}</p><ul>${rows}</ul><p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => (activeChase ? (matchRule(activeChase, b) ? 1 : 0) - (matchRule(activeChase, a) ? 1 : 0) : 0) || a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top += `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. ${activeChase ? `${esc(activeChase.label)} first, then live deals.` : "Live deals first."}</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") top = tradeListHTML();
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}${g.set ? ` People chase ${g.set.pop.slice(0, 3).map((c) => c.name).join(", ")}${g.set.pop.length > 3 ? ` and ${g.set.pop.length - 3} more` : ""}.` : ""}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}${c.pop ? ` <span class="lpop" title="People chase this">●</span>` : ""}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => {
  const s = e.target.closest("[data-show]"), d = e.target.closest("[data-ldel]"), n = e.target.closest("[data-lnew]");
  if (s) { const r = chases.find((x) => x.id === s.dataset.show); if (r) showChase(r); }
  else if (d) { const r = chases.find((x) => x.id === d.dataset.ldel); if (r) deleteChase(r); }
  else if (n) openSheet();
});
// The layout ran before this part existed (99-start runs last, but 30-layout's binderLayout is what resize calls, and
// this one wins by hoisting): nothing to redo here. Sync the pill once the start-up has run.
setTimeout(syncPill, 0);
