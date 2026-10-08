// ---------- chase: the Chase lens is your chase list; Trade is your spares ----------
// A deal is a live listing on a card you are chasing, so deals live inside the chase list (round 9). The Chase lens
// lifts every chased card out in front inside its panel as a feed tile (the live deal in green, or the most you would
// pay); the layout is in 30-layout.js. Tap a lifted tile and the card pops up with every copy online, and Got it asks
// what you paid.
const capOf = (c) => Math.round(c.price * 0.85 * 100) / 100; // the most you'd pay (made up: 85% of market)
let chasing = {}, paid = {};
try { chasing = JSON.parse(localStorage.getItem("wall-chase") || "{}") || {}; } catch { chasing = {}; }
try { paid = JSON.parse(localStorage.getItem("wall-paid") || "{}") || {}; } catch { paid = {}; }
const persistChase = () => { try { localStorage.setItem("wall-chase", JSON.stringify(chasing)); localStorage.setItem("wall-paid", JSON.stringify(paid)); } catch { /* private mode */ } };
// Made-up wants, seeded by card id so variants compare; a card with a live deal is a want by definition.
for (const c of cards) c.chase0 = false; // the chase list starts empty
const isChase = (c) => !c.owned && (chasing[c.id] ?? c.chase0);
// Spares: a card you own an extra of, up for trade (made up, seeded by card id).
let spares = {};
try { spares = JSON.parse(localStorage.getItem("wall-spares") || "{}") || {}; } catch { spares = {}; }
for (const c of cards) c.spare0 = false; // so do your spares
const isSpare = (c) => c.owned && (spares[c.id] ?? c.spare0);
// Favorites (parity 4): up to five cards you own, oldest first, shown first in Show mode. A card you take out drops
// off (it's left out when read, so Undo brings it back). Priority: a ★ on a card you chase (production's).
let favs = [], prio = {}, prioVer = 0;
try { favs = (JSON.parse(localStorage.getItem("wall-favs") || "[]") || []).filter((id) => typeof id === "string"); } catch { favs = []; }
try { prio = JSON.parse(localStorage.getItem("wall-priority") || "{}") || {}; } catch { prio = {}; }
const FAV_MAX = 5;
const favCards = () => favs.map((id) => cards.find((c) => c.id === id)).filter((c) => c && c.owned).slice(0, FAV_MAX);
const isFav = (c) => favCards().includes(c.base || c);
const isPrio = (c) => Boolean(prio[(c.base || c).id]) && isChase(c);
const persistStars = () => { prioVer++; try { localStorage.setItem("wall-favs", JSON.stringify(favs)); localStorage.setItem("wall-priority", JSON.stringify(prio)); } catch { /* private mode */ } };

// ----- Chase it, next to I have it on the card panel (on a card you own, the copies stepper takes its place) -----
const flagBtn = document.getElementById("p-want");
function updateFlag(c) {
  const owned = c.owned;
  flagBtn.hidden = owned; stepEl.hidden = !owned;
  if (!owned) {
    const on = isChase(c);
    flagBtn.textContent = on ? "Chasing ✓" : "Chase it"; flagBtn.classList.toggle("on", on); flagBtn.setAttribute("aria-pressed", String(on));
    spareEl.hidden = true; return;
  }
  const b = c.base || c, n = nOf(b), s = sparesOf(b), who = wantedBy(b);
  pN.textContent = `You have ${n}`; pLess.disabled = n <= 1; pMore.disabled = n >= 99;
  stepEl.classList.toggle("spare", s > 0);
  let text = "", trade = null, keep = "";
  if (n <= 1) { if (who.length) text = `${people(who)} ${who.length === 1 ? "wants" : "want"} this. Got a double? Tap +.`; }
  else if (s) {
    text = `<b>${s === 1 ? "1 spare" : `${s} spares`}</b>, up for trade. ${who.length ? `Wanted by ${people(who)}.` : "Nobody's after it yet."}`;
    trade = who[0] || null; keep = n === 2 ? "Keep both" : `Keep all ${n}`;
  } else { text = `Keeping ${n === 2 ? "both" : `all ${n}`}, not up for trade.`; keep = n === 2 ? "Trade the extra" : "Trade the extras"; }
  spareEl.hidden = !text;
  pSpareT.innerHTML = text;
  pTrade.hidden = !trade; if (trade) { pTrade.textContent = `Trade with ${trade.name}`; pTrade.dataset.t = trade.id; }
  pKeep.hidden = !keep; pKeep.textContent = keep;
}
flagBtn.onclick = () => {
  const c = state.focus; if (!c || c.owned) return;
  chasing[c.id] = !isChase(c); persistChase(); updateFlag(c); starPanel(c); tick(5); drawList(); if (lifted) liftLayout(true); kick();
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
  renderPay(); payEl.inert = false; document.body.classList.add("paying"); focusFor(payDone, payEl);
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
  toast(`${c.name} got${amount ? ` for ${money(amount)}` : ""}.${left ? ` ${left} to go.` : " That's all of them."}`, undo);
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

// ----- offers: every copy online, for the single card, the packs it comes in, or the boxes -----
// Made up for the demo, seeded by card id so runs compare.
const SOURCES = ["eBay", "TCGplayer", "Card Chaser"], CONDS = ["Near mint", "Near mint", "Lightly played", "Moderately played"];
const packOdds = (c) => [3, 9, 36, 120, 180, 400, 900][clamp(c.tier, 0, 6)];
const dealPct = (c) => Math.round((1 - c.deal / c.price) * 100);
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
const pop = { c: null, from: null, t0: 0, closing: false };
function fillOffers(c) {
  const st = sets[c.si], list = offersFor(c, oKind);
  oName.textContent = c.name;
  oMeta.textContent = `${st.name} ${c.num}/${st.printed} · Market ${money(c.price)} · Pay up to ${money(capOf(c))}`;
  oSub.textContent = oKind === "single" ? `${list.length} copies online, cheapest first` : oKind === "pack" ? `${packOdds(c) > 36 ? "A long shot in a pack" : "A fair pull from a pack"}: ${list[0].odds.toLowerCase()}.` : `Sealed, with the odds of this card inside.`;
  offersEl.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === oKind)));
  oRow.innerHTML = list.map((o) => `<article class="offer${o.live ? " live" : ""}"><b>${money(o.price)}</b><span class="osrc">${o.src}${o.live ? ", the live deal" : ""}</span>${oKind === "single" ? "" : `<span class="ocond">${o.title}</span>`}<span class="ocond">${o.cond}${o.ship ? `, ${money(o.ship)} shipping` : ", free shipping"}${o.odds ? `. ${o.odds}` : ""}</span><button type="button" class="mbtn obuy" data-q="${o.q.replace(/"/g, "&quot;")}">Open on ${o.src}</button></article>`).join("");
  oRow.scrollLeft = 0;
  oFlag.textContent = isChase(c) ? "Chasing ✓" : "Chase it";
  fillChips(popMore, c);
}
oRow.addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(b.dataset.q)}&_sop=15`, "_blank", "noopener"); });
offersEl.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => { oKind = b.dataset.kind; tick(3); if (pop.c) fillOffers(pop.c); }));
document.getElementById("o-close").onclick = () => closePop();
oGot.onclick = () => { const c = pop.c; if (!c) return; closePop(true); gotIt(c); };
oFlag.onclick = () => {
  const c = pop.c; if (!c) return;
  chasing[c.id] = !isChase(c); persistChase(); fillOffers(c); drawList(); tick(5);
  if (!isChase(c)) { closePop(true); liftLayout(true); toast(`${c.name} off your chase list.`, () => { chasing[c.id] = true; persistChase(); liftLayout(true); kick(); }); }
  kick();
};
// The card pops up out of its tile, over the dimmed wall, with the offers sheet under it.
function popCard(c, from) {
  if (pop.c) return;
  hideCaption(); cancelPress(); toastEl.classList.remove("show"); // the lens's line is said: the card comes up clear of it
  pop.c = c; pop.from = from; pop.t0 = performance.now(); pop.closing = false;
  oKind = "single"; fillOffers(c);
  offersEl.inert = false; document.body.classList.add("offering");
  lookedAt(c); // popping a card is looking at its deal
  tick(5); kick();
}
function closePop(instant = false) {
  if (!pop.c) return;
  offersEl.inert = true; document.body.classList.remove("offering");
  if (instant || reduced) { pop.c = null; kick(); return; }
  pop.closing = true; pop.t0 = performance.now(); kick();
}
function popRect() {
  if (landPhone()) { // the offers stand at the right: the card fills the space beside them
    const L = SAFE.left + 10, R = vw - sideW(), top = topPad(), bot = vh - SAFE.bottom - 14;
    const h = Math.min((bot - top) * 0.94, (R - L) * 0.8 * TH / TW), w = h * TW / TH;
    return { x: (L + R - w) / 2, y: top + (bot - top - h) / 2, w, h };
  }
  const sheet = offersEl.offsetHeight || vh * 0.46, top = topPad() + 6, bot = vh - sheet - 14;
  const h = Math.min((bot - top) * 0.92, vw * 0.78 * TH / TW), w = h * TW / TH;
  return { x: (vw - w) / 2, y: top + (bot - top - h) / 2, w, h };
}
// Returns whether another frame is needed.
function drawPop(now) {
  const c = pop.c; if (!c) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = reduced ? 1 : clamp((now - pop.t0) / 360, 0, 1), e = ease(pop.closing ? 1 - k : k);
  const a = pop.from, b = popRect();
  const r = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
  ctx.globalAlpha = 0.6 * e; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  ctx.globalAlpha = 0.28 * e; rr(r.x + 2, r.y + 8, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill();
  const e0 = c.e; c.e = 1; ctx.globalAlpha = 1;
  if (r.w > r.h * 1.05) drawFeedTile(c, r.x, r.y, r.w, r.h, 1, now); else drawTile(c, r.x, r.y, r.w, r.h, now);
  c.e = e0; ctx.globalAlpha = 1;
  if (pop.closing && k >= 1) { pop.c = null; return false; }
  return k < 1;
}
// The lifted tile under a point in a panel, if any.
function liftedAt(g, sx, sy) {
  const y = sy + mScroll;
  for (const c of g.lead || []) if (c.m && sx >= c.m.x && sx <= c.m.x + c.m.w && y >= c.m.y && y <= c.m.y + c.m.h) return c;
  return null;
}
// While the card is up, a touch on the wall puts it back.
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!pop.c || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (type === "touchend" && !paying()) closePop();
}, { capture: true, passive: false });
for (const type of ["pointerdown", "pointerup", "pointermove", "wheel"]) document.addEventListener(type, (e) => {
  if (!pop.c || e.target !== canvas) return;
  if (e.pointerType && e.pointerType !== "mouse") return;
  e.stopImmediatePropagation(); if (type === "wheel") e.preventDefault();
  if (type === "pointerdown" && !paying()) closePop();
}, { capture: true, passive: false });
addEventListener("keydown", (e) => { if (e.key === "Escape" && pop.c && !paying()) { e.preventDefault(); closePop(); } });

// ----- the feed tile: a chased card out in front -----
let tintKey = "", tintVal = "";
function dealTint() { const k = theme.slot + theme.deal; if (k !== tintKey) { tintKey = k; tintVal = mix(theme.slot, theme.deal, theme.dark ? 0.16 : 0.09); } return tintVal; }
// The card as a deal (green: asking price, was, how far under) or as a chase (the most you'd pay, the market).
// The card itself sits in the tile, with the price beside it.
function drawFeedTile(c, x, y, w, h, a, now = performance.now()) {
  const st = sets[c.si], deal = Boolean(c.deal), rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = deal ? dealTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = deal ? 1.5 : 1; ctx.strokeStyle = deal ? theme.deal : theme["slot-line"]; ctx.stroke();
  if (w < 60) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.05), s = clamp(w / 177, 0.6, 1.3);
  const mh = h - pad * 2, mw = mh * TW / TH;
  foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  const tx = x + pad + mw + pad, tw = x + w - pad - tx;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const star = isPrio(c), sb = Math.round(16 * s); // priority: a black star on a yellow field in a black rule, in the corner
  if (star) {
    const bx = x + w - pad - sb, by = y + pad;
    ctx.fillStyle = theme.rule || "#121212"; ctx.fillRect(bx, by, sb, sb); ctx.fillStyle = theme["c-yellow"] || "#F2C200"; ctx.fillRect(bx + 1.5, by + 1.5, sb - 3, sb - 3);
    ctx.fillStyle = "#121212"; ctx.textAlign = "center"; font(700, 11 * s); ctx.fillText("★", bx + sb / 2, by + sb * 0.74); ctx.textAlign = "left";
  }
  const arrived = deal && c.dealAt > 0, price = fitText(short(c.deal ?? capOf(c)), tw - (star ? sb + 4 : 0));
  ctx.fillStyle = deal ? theme.deal : theme.ink; font(800, 21 * s); ctx.fillText(price, tx, y + pad + 17 * s);
  if (arrived && c.dealWas) { // a price drop: the old asking price, struck through
    const pw = textW(price); font(600, 12 * s);
    const old = short(c.dealWas), ow = textW(old), ox = tx + pw + 6 * s;
    if (ox + ow <= tx + tw) { ctx.fillStyle = theme.muted; ctx.fillText(old, ox, y + pad + 17 * s); ctx.fillRect(ox, y + pad + 12.5 * s, ow, Math.max(1, s)); }
  }
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(deal ? fitText(`was ${short(c.price)}`, tw) : textW("Most you'd pay") <= tw ? "Most you'd pay" : fitText("Your max", tw), tx, y + pad + 31 * s); // the price above it is the most you'd pay
  if (deal) { ctx.fillStyle = theme.deal; font(800, 13 * s); ctx.fillText(fitText(`${dealPct(c)}% under market`, tw), tx, y + pad + 47 * s); }
  else { ctx.fillStyle = theme.muted; font(600, 11 * s); ctx.fillText(fitText(`Market ${short(c.price)}`, tw), tx, y + pad + 47 * s); }
  if (arrived) { // when it landed, green until you've looked; a tile that sits on screen counts as looked at
    const ago = agoText(c.dealAt, Date.now());
    ctx.fillStyle = c.dealSeen ? theme.muted : theme.deal; font(700, 11 * s);
    ctx.fillText(fitText(c.dealWas ? `↓ ${ago}` : ago, tw), tx, y + pad + 62 * s);
    if (!c.dealSeen && !state.trans && !shuffle && Date.now() - c.dealAt > 3000 && y >= topPad() - 2 && y + h <= vh - botPad() + 2) lookedAt(c);
  }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}
