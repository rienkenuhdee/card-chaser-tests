// ---------- copies: how many of each card you have; any beyond the first is a spare (round 17) ----------
// The way every inventory app does it. A card you own has a count (1 unless you say otherwise). The card panel shows
// a stepper beside In your collection ("You have 2", − and +), and every copy past the first is a spare, up for
// trade, unless you choose Keep both. The import brings realistic doubles, seeded by card id and weighted toward
// commons and uncommons, so the trade binder is full from the first open. A spare finds someone in plain words: the
// card panel and the spare tile say who wants it, with Trade with Maya one tap away. A done trade takes one copy, not the card.
//
// The base keeps spares as a flag map (`spares`, read by the const isSpare everywhere). Here that map becomes a view
// of the counts: a Proxy whose every key is computed from `copies`, so isSpare, wantsOf, the Trade lift, the table
// and the replies all follow the counts without being touched.

let copies = {}; // id -> { n, got, keep }: n copies of the card you got at `got` (a re-added card starts again at 1)
try { copies = JSON.parse(localStorage.getItem("wall-copies") || "{}") || {}; } catch { copies = {}; }
// The flag map is written too, as the counts see it, so a build without counts on this device still finds your spares.
const persistCopies = () => { try { localStorage.setItem("wall-copies", JSON.stringify(copies)); localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* private mode */ } };
const poolById = new Map(pool.map((c) => [c.id, c]));
let copiesKey = 0; // bumps on every change, for anything that caches
const recOf2 = (b) => { const r = copies[b.id]; return r && r.got === b.got ? r : null; };
function nOf(c) { const b = c.base || c; if (!b.owned) return 0; const r = recOf2(b); return r ? Math.max(1, r.n) : 1; }
const keptOf = (c) => Boolean(recOf2(c.base || c)?.keep);
const sparesOf = (c) => (keptOf(c) ? 0 : Math.max(0, nOf(c) - 1));
function setN(c, n, keep) {
  const b = c.base || c; if (!b.owned) return;
  n = clamp(Math.round(n), 1, 99);
  const k = keep ?? keptOf(b);
  if (n <= 1) delete copies[b.id]; else copies[b.id] = k ? { n, got: b.got, keep: true } : { n, got: b.got };
  copiesKey++;
}
// Spares from before counts (the base's Spare flag, or another build on this device) become a second copy, once.
let fresh = false;
try { fresh = localStorage.getItem("wall-copies") == null; } catch { /* fine */ }
if (fresh) for (const [id, on] of Object.entries(spares)) { const c = poolById.get(id); if (on && c?.owned && !recOf2(c)) setN(c, 2, false); }
spares = new Proxy({}, {
  get: (_, id) => { const c = typeof id === "string" ? poolById.get(id) : null; return c ? sparesOf(c) > 0 : undefined; },
  has: (_, id) => { const c = typeof id === "string" ? poolById.get(id) : null; return Boolean(c && sparesOf(c) > 0); },
  set: (_, id, v) => { const c = poolById.get(id); if (c?.owned) { if (v) setN(c, Math.max(2, nOf(c)), false); else if (nOf(c) > 1) setN(c, nOf(c), true); persistCopies(); } return true; },
  deleteProperty: () => true, // a trade takes one copy: completeTrade below says how many
  ownKeys: () => pool.filter((c) => sparesOf(c) > 0).map((c) => c.id),
  getOwnPropertyDescriptor: (_, id) => { const c = poolById.get(id); return c && sparesOf(c) > 0 ? { value: true, writable: true, enumerable: true, configurable: true } : undefined; },
});
if (fresh) persistCopies();
const people = (list) => (list.length <= 1 ? list.map((t) => t.name).join("") : `${list.slice(0, -1).map((t) => t.name).join(", ")} and ${list[list.length - 1].name}`);
// The wall follows the spares; while a card is up close or Mark is on, it waits for you to finish.
let layoutDirty = false;
function relayoutSoon() {
  if (!lifted) return;
  if (state.focus || marking) { layoutDirty = true; return; }
  liftLayout(true);
}
function flushLayout() { if (!layoutDirty) return; layoutDirty = false; if (lifted) setTimeout(() => { if (!state.focus && !marking) liftLayout(true); }, 0); }

// ----- the import brings doubles (seeded by card id; commons and uncommons come in twos and threes) -----
function importCopies(c) {
  const p = [0.2, 0.15, 0.06, 0.03, 0.015, 0.01, 0.005][clamp(c.tier, 0, 6)];
  if (h32(`${c.id}|copies`) >= p) return 1; // the id leads: keys that differ only at the end hash alike
  const q = h32(`${c.id}|more`);
  return c.tier <= 1 ? (q < 0.1 ? 4 : q < 0.34 ? 3 : 2) : 2;
}

// ----- the card panel: a stepper beside In your collection, and a line saying who wants the spare -----
const actsEl = panel.querySelector(".acts");
const stepEl = document.createElement("div");
stepEl.className = "copies"; stepEl.id = "p-copies"; stepEl.setAttribute("role", "group"); stepEl.setAttribute("aria-label", "Copies you have"); stepEl.hidden = true;
stepEl.innerHTML = `<button type="button" class="cbtn" id="p-less" aria-label="One fewer copy">−</button><output id="p-n" aria-live="polite"></output><button type="button" class="cbtn" id="p-more" aria-label="One more copy">+</button>`;
flagBtn.after(stepEl);
const pLess = stepEl.querySelector("#p-less"), pMore = stepEl.querySelector("#p-more"), pN = stepEl.querySelector("#p-n");
const spareEl = document.createElement("div");
spareEl.className = "spareline"; spareEl.id = "p-spare"; spareEl.hidden = true;
spareEl.innerHTML = `<p id="p-spare-t"></p><div class="sl-acts"><button type="button" class="pill-btn primary" id="p-trade"></button><button type="button" class="pill-btn" id="p-keep"></button></div>`;
actsEl.after(spareEl);
const pSpareT = spareEl.querySelector("#p-spare-t"), pTrade = spareEl.querySelector("#p-trade"), pKeep = spareEl.querySelector("#p-keep");
function copiesChanged(c) {
  persistCopies(); tick(5);
  if (state.focus) fillPanel(state.focus, 0);
  drawList(); relayoutSoon(); kick();
}
pMore.onclick = () => { const c = state.focus; if (!c?.owned) return; setN(c, nOf(c) + 1); flashTile(c); copiesChanged(c); };
pLess.onclick = () => { const c = state.focus; if (!c?.owned || nOf(c) <= 1) return; setN(c, nOf(c) - 1); copiesChanged(c); };
pKeep.onclick = () => { const c = state.focus; if (!c?.owned || nOf(c) <= 1) return; setN(c, nOf(c), !keptOf(c)); copiesChanged(c); };
pTrade.onclick = () => { const t = TRADERS.find((x) => x.id === pTrade.dataset.t); if (t) tradeWith(t); };
// Trade with Maya, from the card: to the Trade room (the table's home), then how to trade, then the table.
function tradeWith(t) {
  if (document.body.classList.contains("listmode") || wel.on || tbl.on) return;
  goRoom("trade", { then: () => startTrade(t, null) });
}
function flashTile(c) { const b = c.base || c, now = performance.now(); for (const x of [b, ...twinsOf(b)]) x.flash = { t0: now, gold: true }; live.until = Math.max(live.until, now + 1200); }
// The panel's own Chase it stays for cards you don't have; on a card you own the stepper takes its place.
// Back from the card: the wall takes the shape the counts left it in.

// ----- Mark: hold a card you have to add a copy, and keep the finger down to sweep along the row -----
const copySession = new Map(); // card -> its copies record when the session first touched it
function addCopy(c) {
  const b = c.base || c; if (!b.owned) return;
  if (!copySession.has(b)) copySession.set(b, copies[b.id] ? { ...copies[b.id] } : null);
  setN(b, nOf(b) + 1); flashTile(b); persistCopies(); tick(6);
  updateBar(); drawList(); relayoutSoon(); kick();
}
function revertCopies(list) {
  for (const [b, rec] of list) { if (rec) copies[b.id] = rec; else delete copies[b.id]; }
  copiesKey++; persistCopies(); drawList(); relayoutSoon(); kick();
}

// ----- a done trade takes one copy, not the card -----
const copyTradedText = (get, give, still, t) => `${names(get)} ${get.length === 1 ? "is" : "are"} yours. ${names(give)} went to ${t.name}.${still.length ? ` You still have ${still.length === give.length && give.length > 1 ? "one of each" : names(still)}.` : ""}`;

// ----- the count on the wall: ×2 on a tile you can read -----
const pillW = new Map();
function countPill(n, spare, x, y, size) {
  if (n < 2) return;
  const txt = `×${n}`, a0 = ctx.globalAlpha;
  font(800, size);
  const k = `${curFont}|${txt}`; let tw = pillW.get(k); if (tw == null) { tw = ctx.measureText(txt).width; pillW.set(k, tw); }
  const h = size + 6, w = tw + 8;
  rr(x, y, w, h, h / 2); ctx.fillStyle = spare ? theme.gold : theme["panel-solid"]; ctx.fill();
  if (!spare) { ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  ctx.fillStyle = spare ? (theme.dark ? "#171920" : "#fff") : theme.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(txt, x + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.globalAlpha = a0;
}
function copyTile(c, r, a) {
  const b = c.base || c, n = nOf(b); if (n < 2 || r.w < 5) return;
  const spare = !keptOf(b);
  if (r.w < 26) return; // far out the count can't be read, and a sliver reads as a misdrawn tile
  ctx.globalAlpha = a;
  const marked = marking && session.has(c) && session.get(c) !== c.owned;
  const size = r.w >= 90 ? 13 : 10.5, inset = Math.max(3, r.w * 0.05);
  // At the top left of the art, under the name band (a card prints its name along the top; the drawn face's window
  // starts there too), so the count never covers the name.
  countPill(n, spare, r.x + inset + (marked ? clamp(r.w * 0.11, 5, 12) * 2 + 4 : 0), r.y + Math.max(inset, r.h * 0.12), size);
}
function drawCopies() {
  if (state.lens !== "have" || state.time || state.trans || shuffle || room.on || tbl.on || bnd.on || preview) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const dim = 1 - state.dimAll * 0.72;
  if (view === "mosaic") {
    for (const g of groups) {
      if (g.done || g.minting || inCase(g) || !g.m) continue;
      if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
      const pe = g.pe ?? 1;
      for (const c of g.cards) {
        if (!c.owned || c.e < 0.3 || !c.m || c.m.h < 3) continue;
        if (c.lift && c.m.w > c.m.h * 1.05) continue; // a spare tile carries its own count
        const y = c.m.y - mScroll; if (y > vh || y + c.m.h < 0) continue;
        if (nOf(c) < 2) continue;
        copyTile(c, { x: c.m.x, y, w: c.m.w, h: c.m.h }, c.e * pe);
      }
    }
  } else if (state.g) {
    const g = state.g;
    const y0 = cam.y, y1 = cam.y + vh / cam.s;
    const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
    for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
      const c = g.cards[k];
      if (!c.owned || c.e < 0.3 || nOf(c) < 2) continue;
      const r = binderRect(c, cam);
      if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
      copyTile(c, r, c.e * (state.focus && state.focus !== c ? dim : 1));
    }
  }
  ctx.globalAlpha = 1;
}
// Drawn with the other overlays, after the wall (the welcome's set picks go on top).

// ----- what the spares add up to -----
const spareCount = () => cards.reduce((a, c) => a + sparesOf(c), 0);
// ----- the list: counts in every row -----
function lstateOf(c) {
  if (!c.owned) return isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it";
  const b = c.base || c, n = nOf(b), s = sparesOf(b), who = wantedBy(b);
  if (n <= 1) return "Have it";
  if (!s) return `Have ${n}, keeping ${n === 2 ? "both" : "all"}`;
  return `Have ${n}, ${s} spare${who.length ? `, ${people(who)} want${who.length === 1 ? "s" : ""} it` : ""}`;
}

setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { copies: { get: () => copies }, nOf: { value: nOf }, sparesOf: { value: sparesOf }, setN: { value: setN }, focus: { value: focus }, setLens: { value: setLens }, completeTrade: { value: completeTrade }, pool: { value: pool } }); }, 0);
