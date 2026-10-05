// ---------- chase: the Chase lens is your chase list; Trade is your spares ----------
// A deal is a live listing on a card you're chasing, so deals live inside the chase list (round 9). Switching to the
// Chase lens folds the mosaic back and dims it while every card you want deals out of its panel as a big tile,
// stacking from the bottom of the screen up, by set, oldest first; within a set the live deals lead. Tap the circle
// (or swipe the tile sideways) when you get the card: it flies home into its set, is marked owned, and a thumb-reach
// keypad asks what you paid. Any other lens flies everything home and the wall is exactly as it was.
const capOf = (c) => Math.round(c.price * 0.85 * 100) / 100; // the most you'd pay (made up: 85% of market)
let chasing = {}, paid = {};
try { chasing = JSON.parse(localStorage.getItem("wall-chase") || "{}") || {}; } catch { chasing = {}; }
try { paid = JSON.parse(localStorage.getItem("wall-paid") || "{}") || {}; } catch { paid = {}; }
const persistChase = () => { try { localStorage.setItem("wall-chase", JSON.stringify(chasing)); localStorage.setItem("wall-paid", JSON.stringify(paid)); } catch { /* private mode */ } };
// Made-up wants, seeded by card id so variants compare; a card with a live deal is a want by definition.
for (const c of cards) c.chase0 = Boolean(c.deal) || h32(c.id + "w") < 0.1;
const isChase = (c) => !c.owned && (chasing[c.id] ?? c.chase0);
// Spares: a card you own an extra of, up for trade (made up, seeded by card id).
let spares = {};
try { spares = JSON.parse(localStorage.getItem("wall-spares") || "{}") || {}; } catch { spares = {}; }
for (const c of cards) c.spare0 = h32(c.id + "s") < 0.08;
const isSpare = (c) => c.owned && (spares[c.id] ?? c.spare0);

// ----- Chase it (or, on a card you own, Spare), next to I have it on the card panel -----
const flagBtn = document.getElementById("p-want");
function updateFlag(c) {
  const on = c.owned ? isSpare(c) : isChase(c);
  flagBtn.textContent = c.owned ? (on ? "Spare ✓" : "Spare") : (on ? "Chasing ✓" : "Chase it");
  flagBtn.classList.toggle("on", on); flagBtn.setAttribute("aria-pressed", String(on));
}
flagBtn.onclick = () => {
  const c = state.focus; if (!c) return;
  if (c.owned) {
    spares[c.id] = !isSpare(c); try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* fine */ }
    updateFlag(c); tick(5); drawList(); kick();
    toast(spares[c.id] ? `${c.name} is a spare, up for trade.` : `${c.name} is no longer a spare.`);
    return;
  }
  chasing[c.id] = !isChase(c); persistChase(); updateFlag(c); tick(5); drawList(); kick();
  toast(chasing[c.id] ? `${c.name} on your chase list. Pay up to ${money(capOf(c))}.` : `${c.name} off your chase list.`);
};

// ----- the keypad: what did you pay? -----
const payEl = document.getElementById("pay"), payScrim = document.getElementById("pay-scrim");
const paySub = document.getElementById("pay-sub"), payAmt = document.getElementById("pay-amt"), paySkip = document.getElementById("pay-skip"), payDone = document.getElementById("pay-done");
const pay = { c: null, str: "", fresh: true };
const paying = () => Boolean(pay.c);
function renderPay() { payAmt.textContent = pay.str ? `$${pay.str}` : "$0"; }
function openPay(c) {
  pay.c = c; pay.fresh = true; pay.str = (c.deal || capOf(c)).toFixed(2);
  paySub.textContent = `${c.name}, ${sets[c.si].code} ${c.num}/${sets[c.si].printed}. Market ${money(c.price)}.`;
  renderPay(); payEl.inert = false; document.body.classList.add("paying"); payDone.focus({ preventScroll: true });
}
function closePay() { pay.c = null; payEl.inert = true; document.body.classList.remove("paying"); }
function payKey(k) {
  if (k === "⌫" || k === "Backspace") { pay.str = pay.fresh ? "" : pay.str.slice(0, -1); pay.fresh = false; }
  else if (k === ".") { if (pay.fresh || !pay.str.includes(".")) pay.str = pay.fresh ? "0." : `${pay.str || "0"}.`; pay.fresh = false; }
  else if (/^\d$/.test(k)) {
    if (pay.fresh) pay.str = "";
    const dot = pay.str.indexOf(".");
    if ((dot >= 0 && pay.str.length - dot > 2) || (dot < 0 && pay.str.length >= 5)) return;
    pay.str = pay.str === "0" ? k : pay.str + k; pay.fresh = false;
  } else return;
  tick(3); renderPay();
}
function payFinish(skip) {
  const c = pay.c; if (!c) return;
  const amount = skip ? null : clamp(Math.round((parseFloat(pay.str) || 0) * 100) / 100, 0, 99999);
  closePay();
  paid[c.id] = amount; persistChase(); drawList();
  const undo = () => { delete paid[c.id]; setOwned(c, false, { quiet: true }); persistChase(); };
  const left = cards.filter(isChase).length;
  toast(`${c.name} got${amount ? ` for ${money(amount)}` : ""}.${left ? ` ${left} to find.` : " That's all of them."}`, undo);
}
document.getElementById("pay-keys").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) payKey(b.dataset.k); });
paySkip.onclick = () => payFinish(true);
payDone.onclick = () => payFinish(false);
payScrim.onclick = () => payFinish(true);
addEventListener("keydown", (e) => {
  if (!paying()) return;
  if (e.key === "Enter") { e.preventDefault(); payFinish(false); }
  else if (e.key === "Escape") { e.preventDefault(); payFinish(true); }
  else if (/^\d$|^\.$|^Backspace$/.test(e.key)) { e.preventDefault(); payKey(e.key); }
});
// Got it: the card is yours now; the tile flies home and the keypad asks what you paid.
function gotIt(c) {
  if (!isChase(c)) return;
  tick(14);
  setOwned(c, true, { quiet: true });
  openPay(c);
}

// ----- the feed model: card tiles in a grid, by set -----
// Each card you're chasing is a tile that looks like the card: the live deal in green with the asking price, "was"
// and how far under, or the most you'd pay. Two across on a phone, more on a wide screen, scannable like a feed.
const HEAD_H = 34, SET_GAP = 14, TILE_GAP = 8, LX = 10;
const wl = { on: false, rows: [], heads: new Map(), items: [], ghosts: [], H: 0, Hcur: 0, scroll: 0, vel: 0, inertia: false, drag: null, q: null, dirty: false, closing: false, open: 0, from: 0, to: 0, t0: 0, last: 0, pop: null };
const flights = [];
let safeTop = 0, safeBot = 0;
const readSafe = () => { const cs = getComputedStyle(document.documentElement); safeTop = parseFloat(cs.paddingTop) || 0; safeBot = parseFloat(cs.paddingBottom) || 0; };
const listTopY = () => topPad() + 6 + safeTop;
const listBot = () => botPad() + 10 + safeBot; // above the lens bar
const listTop = () => vh - listBot() - wl.Hcur + wl.scroll;
const availH = () => vh - listBot() - listTopY();
const dealPct = (c) => Math.round((1 - c.deal / c.price) * 100);
// Where the card's tile sits in the wall behind, folded back with it.
function homeRect(c) {
  const r = mr(c.m), o = wl.open;
  if (o <= 0) return r;
  const k = 1 - 0.06 * o, px = vw / 2, py = topPad();
  return { x: px + (r.x - px) * k, y: py + (r.y - py) * k, w: r.w * k, h: r.h * k };
}
const listX = () => Math.max(LX, (vw - 600) / 2), listW = () => vw - listX() * 2;
const feedCols = () => clamp(Math.floor((listW() + TILE_GAP) / (150 + TILE_GAP)), 2, 4);
const tileRect = (r) => ({ x: listX() + r.cx, y: listTop() + r.ycur, w: r.w, h: r.h });
// Sets oldest first, reading down; within a set the live deals lead (best discount first), then the most you'd pay.
const rowOrder = (a, b) => (b.c.deal ? 1 : 0) - (a.c.deal ? 1 : 0) || (a.c.deal && b.c.deal ? dealPct(b.c) - dealPct(a.c) : 0) || capOf(b.c) - capOf(a.c) || a.c.i - b.c.i;
function layoutItems() {
  const bySet = new Map();
  for (const r of wl.rows) { if (wl.q && !matchQ(r.c, wl.q)) continue; if (!bySet.has(r.c.si)) bySet.set(r.c.si, []); bySet.get(r.c.si).push(r); }
  const cols = feedCols(), tw = (listW() - TILE_GAP * (cols - 1)) / cols, th = Math.round(tw * 0.64);
  const items = []; let y = 0;
  for (const si of [...bySet.keys()].sort((a, b) => a - b)) {
    const rs = bySet.get(si).sort(rowOrder);
    let h = wl.heads.get(si); if (!h) { h = { kind: "head", si, ycur: null, a: 0 }; wl.heads.set(si, h); }
    h.n = rs.length; h.live = rs.filter((r) => r.c.deal).length; h.cy = y; h.rows = rs; y += HEAD_H;
    if (h.ycur == null) h.ycur = h.cy;
    items.push(h);
    rs.forEach((r, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      r.cx = col * (tw + TILE_GAP); r.cy = y + row * (th + TILE_GAP); r.w = tw; r.h = th;
      if (r.ycur == null) r.ycur = r.cy; r.head = h; items.push(r);
    });
    y += Math.ceil(rs.length / cols) * (th + TILE_GAP) - TILE_GAP + SET_GAP;
  }
  for (const si of [...wl.heads.keys()]) if (!bySet.has(si)) wl.heads.delete(si);
  wl.items = items; wl.H = Math.max(0, y - SET_GAP);
  if (wl.Hcur === 0 || reduced) wl.Hcur = wl.H;
  wl.scroll = clamp(wl.scroll, 0, Math.max(0, wl.H - availH()));
}
// The feed follows the chase list: a card marked owned leaves, a card chased again deals back out.
function syncChase(now) {
  const want = new Set();
  for (const c of cards) if (isChase(c)) want.add(c);
  let changed = wl.dirty;
  for (const r of [...wl.rows]) if (!want.has(r.c)) { leaveRow(r, now); changed = true; }
  const have = new Set(wl.rows.map((r) => r.c)), fresh = [];
  for (const c of want) if (!have.has(c)) { const r = { kind: "row", c, cx: 0, cy: 0, w: 0, h: 0, ycur: null, a: 0 }; wl.rows.push(r); fresh.push(r); c.away = true; changed = true; }
  if (changed) { layoutItems(); wl.dirty = false; }
  if (fresh.length) { fresh.sort((a, b) => b.cy - a.cy || b.cx - a.cx); fresh.forEach((r, i) => dealRow(r, Math.min(900, i * 22))); }
}
function dealRow(r, delay) {
  const c = r.c, cur = c.flight?.cur;
  startFlight({ c, row: r, kind: "deal", from: cur ? { ...cur } : () => homeRect(c), to: () => tileRect(r), dur: 560, delay, lift: 28, done: () => { r.a = 1; kick(); } });
}
function leaveRow(r, now) {
  wl.rows.splice(wl.rows.indexOf(r), 1);
  if (wl.pop?.c === r.c) closePop(true);
  const from = r.c.flight?.cur ? { ...r.c.flight.cur } : tileRect(r);
  wl.ghosts.push({ kind: "ghost", c: r.c, x: listX() + r.cx, y: listTop() + r.ycur, w: r.w, h: r.h, a: r.a, t0: now });
  startFlight({ c: r.c, kind: "home", from, to: () => homeRect(r.c), dur: 620, delay: 0, lift: 26, done: () => { r.c.away = false; kick(); } });
}
// ----- flights: the tile itself travelling between its panel and the feed -----
function startFlight(f) {
  if (f.c.flight) flights.splice(flights.indexOf(f.c.flight), 1);
  f.t0 = performance.now() + (reduced ? 0 : f.delay || 0); f.c.flight = f; f.c.away = true;
  flights.push(f); kick();
}
function stepFlights(now) {
  if (!flights.length) return false;
  for (const f of [...flights]) {
    const p = reduced ? 1 : clamp((now - f.t0) / f.dur, 0, 1), e = ease(p);
    const a = typeof f.from === "function" ? f.from() : f.from, b = f.to();
    const r = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * p) * f.lift, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
    f.cur = r;
    if (f.row) f.row.a = Math.max(f.row.a, clamp((p - 0.45) / 0.4, 0, 1));
    if (p > 0 && p < 1 && r.w > 10) { ctx.globalAlpha = 0.22; rr(r.x + 1, r.y + 2 + r.w * 0.06, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill(); }
    const e0 = f.c.e; f.c.e = 1; ctx.globalAlpha = 1;
    // Landing in the feed, the card tile becomes its feed tile; leaving, it becomes the card again.
    if (f.kind === "deal" && p > 0.55) drawFeedTile(f.c, r.x, r.y, r.w, r.h, 1); else drawTile(f.c, r.x, r.y, r.w, r.h, now);
    f.c.e = e0;
    if (p >= 1) { flights.splice(flights.indexOf(f), 1); f.c.flight = null; f.done?.(); }
  }
  return true;
}

// ----- on and off: the lens switches it -----
function enterChase() {
  if (wl.on) return;
  if (state.trans) finishTransition();
  if (state.focus) unfocus();
  leaveMark(); setMenu(false);
  // From inside a set, close it first so the tiles have the wall to leave from.
  if (view === "set") {
    exitToMosaic();
    const T = state.trans;
    if (T) { const done = T.done; T.done = (t) => { done?.(t); enterChase(); }; return; }
    view = "mosaic"; state.g = null; setChrome();
  }
  wl.on = true; wl.closing = false; wl.scroll = 0; wl.vel = 0; wl.inertia = false; wl.drag = null; wl.ghosts = [];
  const q = qIn.value.trim().toLowerCase(); wl.q = q ? q.split(/\s+/) : null; state.matches = null;
  state.introT0 = 0; wl.dirty = true;
  document.body.classList.add("chase");
  wl.t0 = performance.now(); wl.from = wl.open; wl.to = 1;
  readSafe();
  for (const r of wl.rows) if (r.c.flight?.kind === "home") dealRow(r, 0); // caught mid-flight home: turn round
  syncChase(performance.now());
  drawList(); kick();
}
function exitChase() {
  if (!wl.on) return;
  closePop(true);
  wl.on = false; wl.closing = true; wl.drag = null; wl.inertia = false; closePay();
  document.body.classList.remove("chase");
  wl.t0 = performance.now(); wl.from = wl.open; wl.to = 0;
  const rows = [...wl.rows].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  rows.forEach((r, i) => { const from = r.c.flight?.cur ? { ...r.c.flight.cur } : tileRect(r); startFlight({ c: r.c, kind: "home", from, to: () => homeRect(r.c), dur: 560, delay: Math.min(500, i * 14), lift: 24, done: () => { r.c.away = false; kick(); } }); });
  wl.q = null;
  const q = qIn.value.trim().toLowerCase(); state.matches = q ? new Set(cards.filter((c) => matchQ(c, q.split(/\s+/)))) : null;
  drawList(); kick();
}

// ----- offers: every copy online, for the single card, the packs it comes in, or the boxes -----
// Made up for the demo, seeded by card id so runs compare.
const SOURCES = ["eBay", "TCGplayer", "Card Chaser"], CONDS = ["Near mint", "Near mint", "Lightly played", "Moderately played"];
const packOdds = (c) => [3, 9, 36, 120, 180, 400, 900][clamp(c.tier, 0, 6)];
function offersFor(c, kind) {
  const st = sets[c.si], r = (k) => h32(`${c.id}|${kind}|${k}`), out = [];
  const vintage = st.year < 2010, packBase = vintage ? 160 + r("b") * 420 : 3.8 + r("b") * 5;
  if (kind === "single") {
    const n = 3 + Math.floor(r("n") * 4);
    for (let i = 0; i < n; i++) out.push({ title: `${c.name} ${c.num}/${st.printed}`, price: Math.round(c.price * (0.82 + r(`p${i}`) * 0.55) * 100) / 100, src: SOURCES[Math.floor(r(`s${i}`) * 3)], cond: CONDS[Math.floor(r(`c${i}`) * 4)], ship: r(`f${i}`) < 0.4 ? 0 : Math.round((0.99 + r(`h${i}`) * 4) * 100) / 100, q: `pokemon ${c.name} ${c.num}/${st.printed} ${st.name}` });
    if (c.deal) out.push({ title: `${c.name} ${c.num}/${st.printed}`, price: c.deal, src: "eBay", cond: "Near mint", ship: 0, q: `pokemon ${c.name} ${c.num}/${st.printed} ${st.name}`, live: true });
    out.sort((a, b) => a.price - b.price);
  } else if (kind === "pack") {
    const n = 3 + Math.floor(r("n") * 2);
    for (let i = 0; i < n; i++) out.push({ title: `${st.name} booster pack`, price: Math.round(packBase * (0.9 + r(`p${i}`) * 0.35) * 100) / 100, src: SOURCES[Math.floor(r(`s${i}`) * 3)], cond: vintage && r(`v${i}`) < 0.5 ? "Heavy pack" : "Sealed", ship: r(`f${i}`) < 0.5 ? 0 : Math.round((0.99 + r(`h${i}`) * 3) * 100) / 100, q: `${st.name} booster pack sealed`, odds: `About 1 in ${packOdds(c)} packs` });
    out.sort((a, b) => a.price - b.price);
  } else {
    const boxes = Math.max(1, Math.round(packOdds(c) / 36));
    out.push({ title: `${st.name} booster box, 36 packs`, price: Math.round(packBase * 33 * (0.92 + r("x") * 0.2)), src: SOURCES[Math.floor(r("s0") * 3)], cond: "Sealed", ship: 0, q: `${st.name} booster box sealed`, odds: `About 1 in ${boxes} box${boxes === 1 ? "" : "es"}` });
    out.push({ title: `${st.name} booster box, 36 packs`, price: Math.round(packBase * 33 * (1.02 + r("y") * 0.25)), src: SOURCES[Math.floor(r("s1") * 3)], cond: "Sealed", ship: Math.round((4.99 + r("h1") * 10) * 100) / 100, q: `${st.name} booster box sealed`, odds: `About 1 in ${boxes} box${boxes === 1 ? "" : "es"}` });
    if (!vintage) out.push({ title: `${st.name} elite trainer box, 9 packs`, price: Math.round(packBase * 10 * (1 + r("z") * 0.3)), src: "TCGplayer", cond: "Sealed", ship: 0, q: `${st.name} elite trainer box`, odds: `About 1 in ${Math.max(1, Math.round(packOdds(c) / 9))} boxes` });
    if (vintage) out.push({ title: `${st.name} sealed pack lot of 6`, price: Math.round(packBase * 5.6), src: "eBay", cond: "Sealed", ship: 0, q: `${st.name} booster pack lot sealed`, odds: `About 1 in ${Math.max(1, Math.round(packOdds(c) / 6))} lots` });
  }
  return out;
}
const offersEl = document.getElementById("offers"), oName = document.getElementById("o-name"), oMeta = document.getElementById("o-meta"), oSub = document.getElementById("o-sub"), oRow = document.getElementById("o-row"), oGot = document.getElementById("o-got"), oFlag = document.getElementById("o-flag");
let oKind = "single";
function fillOffers(c) {
  const st = sets[c.si], list = offersFor(c, oKind);
  oName.textContent = c.name;
  oMeta.textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. Market ${money(c.price)}, you'd pay up to ${money(capOf(c))}.`;
  oSub.textContent = oKind === "single" ? `${list.length} copies online, cheapest first. Swipe through them.` : oKind === "pack" ? `${packOdds(c) > 36 ? "A long shot in a pack" : "A fair pull from a pack"}: ${list[0].odds.toLowerCase()}.` : `Sealed, with the odds of this card inside.`;
  offersEl.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === oKind)));
  oRow.innerHTML = list.map((o, i) => `<article class="offer${o.live ? " live" : ""}"><b>${money(o.price)}</b><span class="osrc">${o.src}${o.live ? ", the live deal" : ""}</span><span class="ocond">${o.title}</span><span class="ocond">${o.cond}${o.ship ? `, ${money(o.ship)} shipping` : ", free shipping"}${o.odds ? `. ${o.odds}` : ""}</span><button type="button" class="mbtn obuy" data-q="${o.q.replace(/"/g, "&quot;")}">Open on ${o.src === "Card Chaser" ? "Card Chaser" : o.src}</button></article>`).join("");
  oRow.scrollLeft = 0;
  oFlag.textContent = isChase(c) ? "Chasing ✓" : "Chase it";
}
oRow.addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(b.dataset.q)}&_sop=15`, "_blank", "noopener"); });
offersEl.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => { oKind = b.dataset.kind; tick(3); if (wl.pop) fillOffers(wl.pop.c); }));
document.getElementById("o-close").onclick = () => closePop();
oGot.onclick = () => { const c = wl.pop?.c; if (!c) return; closePop(true); gotIt(c); };
oFlag.onclick = () => { const c = wl.pop?.c; if (!c) return; chasing[c.id] = !isChase(c); persistChase(); fillOffers(c); drawList(); tick(5); if (!isChase(c)) { closePop(); toast(`${c.name} off your chase list.`, () => { chasing[c.id] = true; persistChase(); kick(); }); } kick(); };
// The card pops up out of its tile, over the dimmed feed, with the offers sheet under it.
function popCard(r) {
  if (wl.pop) return;
  const from = tileRect(r);
  wl.pop = { c: r.c, row: r, from, t0: performance.now(), closing: false };
  oKind = "single"; fillOffers(r.c);
  offersEl.inert = false; document.body.classList.add("offering");
  tick(5); kick();
}
function closePop(instant = false) {
  const p = wl.pop; if (!p) return;
  offersEl.inert = true; document.body.classList.remove("offering");
  if (instant || reduced) { wl.pop = null; kick(); return; }
  p.closing = true; p.t0 = performance.now(); kick();
}
function popRect(p) {
  const sheet = offersEl.offsetHeight || vh * 0.46, top = listTopY(), bot = vh - sheet - 14;
  const h = Math.min((bot - top) * 0.92, vw * 0.78 * TH / TW), w = h * TW / TH;
  return { x: (vw - w) / 2, y: top + (bot - top - h) / 2, w, h };
}
function drawPop(now) {
  const p = wl.pop; if (!p) return false;
  const k = reduced ? 1 : clamp((now - p.t0) / 360, 0, 1), e = ease(p.closing ? 1 - k : k);
  const a = p.from, b = popRect(p);
  const r = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
  ctx.globalAlpha = 0.55 * e; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  ctx.globalAlpha = 0.28 * e; rr(r.x + 2, r.y + 8, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill();
  const e0 = p.c.e; p.c.e = 1; ctx.globalAlpha = 1;
  if (e < 0.35) drawFeedTile(p.c, r.x, r.y, r.w, r.h, 1); else drawTile(p.c, r.x, r.y, r.w, r.h, now);
  p.c.e = e0; ctx.globalAlpha = 1;
  if (p.closing && k >= 1) { wl.pop = null; return false; }
  return k < 1;
}

// ----- drawing the feed (after the wall, every frame) -----
function stepChaseOpen(now) {
  if (wl.open === wl.to) return false;
  const p = reduced ? 1 : clamp((now - wl.t0) / 480, 0, 1);
  wl.open = wl.from + (wl.to - wl.from) * ease(p);
  return p < 1;
}
let tintKey = "", tintVal = "";
function dealTint() { const k = theme.slot + theme.deal; if (k !== tintKey) { tintKey = k; tintVal = mix(theme.slot, theme.deal, theme.dark ? 0.16 : 0.09); } return tintVal; }
// A feed tile: the card as a deal (green: asking price, was, how far under) or as a chase (the most you'd pay).
function drawFeedTile(c, x, y, w, h, a) {
  const st = sets[c.si], deal = Boolean(c.deal), rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = deal ? dealTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = deal ? 1.5 : 1; ctx.strokeStyle = deal ? theme.deal : theme["slot-line"]; ctx.stroke();
  if (w < 60) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.06), s = clamp(w / 177, 0.6, 1.3);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = deal ? theme.deal : theme.ink; font(800, 22 * s); ctx.fillText(short(c.deal ?? capOf(c)), x + pad, y + pad + 18 * s);
  ctx.fillStyle = theme.muted; font(500, 11.5 * s); ctx.fillText(deal ? `was ${short(c.price)}` : "the most you'd pay", x + pad, y + pad + 33 * s);
  ctx.textAlign = "right";
  if (deal) { ctx.fillStyle = theme.deal; font(800, 20 * s); ctx.fillText(`${dealPct(c)}%`, x + w - pad, y + pad + 18 * s); ctx.fillStyle = theme.muted; font(600, 10.5 * s); ctx.fillText("under market", x + w - pad, y + pad + 33 * s); }
  else { ctx.fillStyle = theme.muted; font(600, 11.5 * s); ctx.fillText(`Market ${short(c.price)}`, x + w - pad, y + pad + 18 * s); }
  ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(700, 14.5 * s, true); ctx.fillText(fitText(c.name, w - pad * 2), x + pad, y + h - pad - 14 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}, ${c.rname}`, w - pad * 2), x + pad, y + h - pad);
  ctx.globalAlpha = 1;
}
function drawHead(h, y) {
  if (h.a <= 0.01) return;
  const st = sets[h.si], x0 = listX(), W = listW();
  rr(x0, y + 2, W, HEAD_H - 4, 8); ctx.globalAlpha = h.a; ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.fillStyle = st.ink; ctx.fillRect(x0, y + 7, 3, HEAD_H - 14);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(800, 16, true); ctx.fillText(fitText(st.name, W * 0.5), x0 + 13, y + 22);
  ctx.textAlign = "right"; ctx.fillStyle = theme.muted; font(600, 13);
  ctx.fillText(`${h.n} to find${h.live ? `, ${h.live} live` : ""}`, x0 + W - 12, y + 22);
}
function drawEmpty() {
  ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const y = vh - listBot() - 120;
  ctx.fillStyle = theme.ink; font(800, 22, true); ctx.fillText(wl.q ? "Nothing on your chase list matches" : "Nothing on your chase list yet", vw / 2, y);
  ctx.fillStyle = theme.muted; font(500, 14); ctx.fillText(wl.q ? "Clear the search to see the whole list." : "Open a card and choose Chase it.", vw / 2, y + 26);
}
// Returns whether another frame is needed.
function drawChase(now) {
  if (!(wl.on || wl.closing || flights.length || wl.ghosts.length || wl.pop)) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const dt = Math.min(48, now - (wl.last || now)); wl.last = now;
  let more = false;
  if (wl.on) syncChase(now);
  const k = reduced ? 1 : Math.min(1, dt / 140);
  if (Math.abs(wl.Hcur - wl.H) > 0.3) { wl.Hcur += (wl.H - wl.Hcur) * k; more = true; } else wl.Hcur = wl.H;
  if (wl.inertia && !wl.drag) {
    const max = Math.max(0, wl.H - availH());
    wl.scroll = clamp(wl.scroll + wl.vel * dt, 0, max); wl.vel *= Math.pow(0.95, dt / 16);
    if (Math.abs(wl.vel) < 0.02 || wl.scroll <= 0 || wl.scroll >= max) wl.inertia = false; else more = true;
  }
  const top = listTop(), topY = listTopY();
  ctx.save(); ctx.beginPath(); ctx.rect(0, topY, vw, vh - topY); ctx.clip();
  for (const it of wl.items) {
    if (Math.abs(it.ycur - it.cy) > 0.3) { it.ycur += (it.cy - it.ycur) * k; more = true; } else it.ycur = it.cy;
    if (it.kind === "row") {
      const ta = wl.closing ? 0 : it.c.flight ? it.a : 1;
      if (Math.abs(it.a - ta) > 0.01) { it.a += (ta - it.a) * (reduced ? 1 : Math.min(1, dt / 160)); more = true; } else it.a = ta;
    } else it.a = it.rows.reduce((m, r) => Math.max(m, r.a), 0);
    const y = top + it.ycur, h = it.kind === "head" ? HEAD_H : it.h;
    if (y > vh || y + h < topY) continue;
    if (it.kind === "head") drawHead(it, y);
    else if (it.a > 0.01 && !it.c.flight && wl.pop?.row !== it) drawFeedTile(it.c, listX() + it.cx, y, it.w, it.h, it.a);
  }
  for (const g of [...wl.ghosts]) {
    g.a *= reduced ? 0 : Math.pow(0.75, dt / 16);
    if (g.a < 0.03) { wl.ghosts.splice(wl.ghosts.indexOf(g), 1); continue; }
    rr(g.x, g.y, g.w, g.h, 12); ctx.globalAlpha = g.a * 0.5; ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.globalAlpha = 1; more = true;
  }
  if (wl.on && !wl.items.length && !flights.length) drawEmpty();
  ctx.restore();
  if (stepFlights(now)) more = true;
  if (drawPop(now)) more = true;
  if (wl.closing && wl.open <= 0 && !flights.length) { wl.closing = false; wl.rows = []; wl.items = []; wl.heads.clear(); wl.ghosts = []; wl.H = wl.Hcur = 0; }
  ctx.globalAlpha = 1;
  return more || wl.closing;
}

// ----- input: while the feed is out it owns the touches that start on the canvas -----
function tileAt(x, y) {
  if (y < listTopY()) return null;
  const top = listTop(), x0 = listX();
  for (const it of wl.items) { if (it.kind !== "row") continue; const ry = top + it.ycur, rx = x0 + it.cx; if (y >= ry && y <= ry + it.h && x >= rx && x <= rx + it.w) return it; }
  return null;
}
function chaseDown(x, y) {
  wl.inertia = false; hideCaption(); if (document.activeElement === qIn) qIn.blur();
  wl.drag = { x, y, t: performance.now(), s0: wl.scroll, row: tileAt(x, y), moved: false, samples: [{ x, y, t: performance.now() }] };
}
function chaseMove(x, y) {
  const d = wl.drag; if (!d) return;
  const dy = y - d.y, now = performance.now();
  d.samples.push({ x, y, t: now }); if (d.samples.length > 8) d.samples.shift();
  if (!d.moved && Math.hypot(x - d.x, dy) < 8) return;
  d.moved = true;
  wl.scroll = clamp(d.s0 + dy, 0, Math.max(0, wl.H - availH()));
  kick();
}
function chaseUp(x, y, cancelled) {
  const d = wl.drag; if (!d) return; wl.drag = null;
  if (cancelled) { kick(); return; }
  const now = performance.now();
  if (d.moved) {
    const s0 = d.samples.find((s) => now - s.t < 90) || d.samples[0], last = d.samples[d.samples.length - 1];
    const vy = s0 && s0 !== last ? (last.y - s0.y) / Math.max(1, last.t - s0.t) : 0;
    if (!reduced && Math.abs(vy) > 0.2) { wl.vel = vy; wl.inertia = true; }
    kick(); return;
  }
  if (d.row) popCard(d.row); // a tap: the card pops up with every offer online
}
const chaseOwn = () => wl.on || wl.closing;
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!chaseOwn() || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (paying() || !wl.on) return;
  if (wl.pop) { if (type === "touchend") closePop(); return; } // a touch on the dimmed feed puts the card back
  const ts = e.touches;
  if (type === "touchstart") { if (ts.length !== 1) { chaseUp(null, null, true); return; } chaseDown(ts[0].clientX, ts[0].clientY); }
  else if (type === "touchmove") { if (ts.length !== 1) { chaseUp(null, null, true); return; } chaseMove(ts[0].clientX, ts[0].clientY); }
  else if (!ts.length) { const p = e.changedTouches[0]; chaseUp(p?.clientX, p?.clientY, type === "touchcancel"); }
}, { capture: true, passive: false });
let chaseMouse = false;
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !chaseOwn() || e.target !== canvas) return; e.stopImmediatePropagation(); if (paying() || !wl.on) return; if (wl.pop) { closePop(); return; } chaseMouse = true; chaseDown(e.clientX, e.clientY); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !chaseMouse) return; e.stopImmediatePropagation(); chaseMove(e.clientX, e.clientY); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !chaseMouse) return; chaseMouse = false; e.stopImmediatePropagation(); chaseUp(e.clientX, e.clientY, type === "pointercancel"); }, true);
document.addEventListener("wheel", (e) => {
  if (!chaseOwn() || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (!wl.on || wl.pop) return;
  wl.scroll = clamp(wl.scroll - e.deltaY, 0, Math.max(0, wl.H - availH())); kick();
}, { capture: true, passive: false });
canvas.addEventListener("keydown", (e) => {
  if (!wl.on) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.stopImmediatePropagation(); e.preventDefault(); wl.scroll = clamp(wl.scroll + (e.key === "ArrowUp" ? 120 : -120), 0, Math.max(0, wl.H - availH())); kick(); }
  else if (e.key === "Escape" || e.key === "Backspace") { e.stopImmediatePropagation(); e.preventDefault(); if (wl.pop) closePop(); else setLens("have"); }
}, true);
addEventListener("keydown", (e) => { if (e.key === "Escape" && wl.pop && !paying()) { e.preventDefault(); closePop(); } });
addEventListener("resize", () => { readSafe(); wl.dirty = true; kick(); });
readSafe();
