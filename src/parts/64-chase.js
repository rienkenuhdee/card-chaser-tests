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
  chasing[c.id] = !isChase(c); persistChase(); updateFlag(c); tick(5); drawList(); if (lifted) liftLayout(true); kick();
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
  oMeta.textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. Market ${money(c.price)}, you'd pay up to ${money(capOf(c))}.`;
  oSub.textContent = oKind === "single" ? `${list.length} copies online, cheapest first. Swipe through them.` : oKind === "pack" ? `${packOdds(c) > 36 ? "A long shot in a pack" : "A fair pull from a pack"}: ${list[0].odds.toLowerCase()}.` : `Sealed, with the odds of this card inside.`;
  offersEl.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === oKind)));
  oRow.innerHTML = list.map((o) => `<article class="offer${o.live ? " live" : ""}"><b>${money(o.price)}</b><span class="osrc">${o.src}${o.live ? ", the live deal" : ""}</span><span class="ocond">${o.title}</span><span class="ocond">${o.cond}${o.ship ? `, ${money(o.ship)} shipping` : ", free shipping"}${o.odds ? `. ${o.odds}` : ""}</span><button type="button" class="mbtn obuy" data-q="${o.q.replace(/"/g, "&quot;")}">Open on ${o.src}</button></article>`).join("");
  oRow.scrollLeft = 0;
  oFlag.textContent = isChase(c) ? "Chasing ✓" : "Chase it";
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
  hideCaption(); cancelPress();
  pop.c = c; pop.from = from; pop.t0 = performance.now(); pop.closing = false;
  oKind = "single"; fillOffers(c);
  offersEl.inert = false; document.body.classList.add("offering");
  tick(5); kick();
}
function closePop(instant = false) {
  if (!pop.c) return;
  offersEl.inert = true; document.body.classList.remove("offering");
  if (instant || reduced) { pop.c = null; kick(); return; }
  pop.closing = true; pop.t0 = performance.now(); kick();
}
function popRect() {
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
  if (r.w > r.h * 1.05) drawFeedTile(c, r.x, r.y, r.w, r.h, 1); else drawTile(c, r.x, r.y, r.w, r.h, now);
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
