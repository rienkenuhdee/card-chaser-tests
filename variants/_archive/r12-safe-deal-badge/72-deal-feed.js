// ---------- deals arrive: a badge and a banner (round 12, safe) ----------
// The feed is simulated, by the round's shared rule: 6 seconds after load and then every 9 seconds one arrival
// happens, in an order seeded by card id. A chased card without a deal gets one (only if it's under market); once
// every chased card has one, the oldest deal drops its price by 10%. Each arrival is timed (c.dealAt) and unseen
// (c.dealSeen false) until the collector looks at the card: pops it up for its offers, or brings it up close.
//
// What announces it is what iOS collectors already know. The Chase lens button wears a badge with the count of unseen
// deals. A banner drops from under the search bar with the card's mini face, holds a few seconds, then slides away
// (or swipe it up); tap it and the card pops up with its offers. In the Chase lens an unseen deal wears a "New"
// sticker and leads its set; the list view gets a Deals row on top, newest first, with times.
const FEED_FIRST = 6000, FEED_EVERY = 9000, BANNER_HOLD = 5200;
for (const c of cards) { c.dealAt = 0; c.dealSeen = true; } // the seeded deals were already there: nothing to announce
const unseen = (c) => c.dealSeen === false && isChase(c);
const unseenDeals = () => cards.filter(unseen);
const ago = (t) => { const s = Math.max(0, Date.now() - t) / 1000; return s < 45 ? "just now" : s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : `${Math.round(s / 3600)} hr ago`; };

// ----- the feed -----
const feedOrder = (list) => list.slice().sort((a, b) => h32(a.id + "r") - h32(b.id + "r") || a.i - b.i);
// The next arrival, or null when nothing is chased: the first chased card (in feed order) without a deal, priced
// under market; failing that, the chased card with the oldest deal, 10% cheaper.
function nextArrival() {
  const chased = cards.filter(isChase); if (!chased.length) return null;
  for (const c of feedOrder(chased)) {
    if (c.deal) continue;
    const p = Math.max(0.25, Math.round(c.price * (0.55 + 0.3 * h32(c.id + "e")) * 100) / 100);
    if (p < c.price) return { c, price: p, drop: false };
  }
  let old = null;
  for (const c of chased) if (c.deal && (!old || c.dealAt < old.dealAt || (c.dealAt === old.dealAt && c.i < old.i))) old = c;
  if (!old) return null;
  return { c: old, price: Math.max(0.25, Math.round(old.deal * 0.9 * 100) / 100), drop: true };
}
const feed = { pending: false, n: 0 };
function arrive() {
  const a = nextArrival(); if (!a) return null;
  const c = a.c;
  c.deal = a.price; c.dealAt = Date.now(); c.dealSeen = false; feed.n++;
  // In the Chase lens the tile flies to the front of its set; up close, the card you're looking at keeps still.
  if (lifted && !state.focus) liftLayout(true); else kick();
  if (state.focus === c) fillPanel(c, 0);
  if (pop.c === c) { fillOffers(c); markSeen(c); }
  updateBadge(); drawList(); showBanner(c, a.drop);
  tick(4);
  return c;
}
// An arrival waits for your hands: never mid-gesture, mid-flight or inside the welcome.
function feedTick() {
  if (feed.pending || wel.on || document.hidden) return;
  if (state.trans || gesture || fly || inertia || paying()) { feed.pending = true; setTimeout(() => { feed.pending = false; feedTick(); }, 400); return; }
  arrive();
}
setTimeout(() => { feedTick(); setInterval(feedTick, FEED_EVERY); }, FEED_FIRST);
// Looking at the card is what marks it seen.
function markSeen(c) {
  if (c.dealSeen !== false) return;
  c.dealSeen = true; updateBadge(); drawList();
  if (banner.c === c) hideBanner();
}

// ----- the badge on the Chase lens button -----
const chaseBtn = lensBox.querySelector('[data-lens="chase"]');
const badgeEl = document.createElement("i"); badgeEl.className = "badge"; badgeEl.hidden = true; badgeEl.setAttribute("aria-hidden", "true");
chaseBtn.append(badgeEl);
let badgeN = 0;
function updateBadge() {
  const n = unseenDeals().length;
  if (n === badgeN) return;
  const was = badgeN; badgeN = n;
  badgeEl.textContent = n > 99 ? "99+" : String(n); badgeEl.hidden = !n;
  if (n) chaseBtn.setAttribute("aria-label", `Chase, ${n} new deal${n === 1 ? "" : "s"}`); else chaseBtn.removeAttribute("aria-label");
  if (!was !== !n) placeInk(); // the pill widens the button: the ink follows
}

// ----- the banner under the search bar -----
document.body.insertAdjacentHTML("beforeend", `<div class="deal-banner glass" id="deal-banner" role="status" hidden>
  <button type="button" class="db-body" id="db-open"><i class="db-face" aria-hidden="true"><small></small></i><span class="db-text"><b id="db-head"></b><span id="db-line"></span></span></button>
</div>`);
const bannerEl = document.getElementById("deal-banner"), dbOpen = document.getElementById("db-open"), dbFace = bannerEl.querySelector(".db-face"), dbHead = document.getElementById("db-head"), dbLine = document.getElementById("db-line");
const banner = { c: null, timer: 0, y0: 0, dy: 0, swiped: false, hide: 0 };
function showBanner(c, drop) {
  const st = sets[c.si];
  clearTimeout(banner.hide); clearTimeout(banner.timer);
  banner.c = c; banner.dy = 0; banner.swiped = false;
  dbFace.style.setProperty("--c", typeColor(c)); dbFace.querySelector("small").textContent = c.num;
  dbHead.textContent = `${drop ? "Price drop" : "Live"}: ${c.name}`;
  dbLine.textContent = `${money(c.deal)}, ${dealPct(c)}% under market. ${st.code} ${c.num}/${st.printed}.`;
  dbOpen.setAttribute("aria-label", `${drop ? "Price drop" : "Live deal"}: ${c.name}, ${money(c.deal)}, ${dealPct(c)}% under market. See the offers.`);
  bannerEl.style.transform = ""; bannerEl.classList.remove("drag");
  const wasUp = !bannerEl.hidden;
  bannerEl.hidden = false; document.body.classList.add("dealing");
  if (wasUp) { bannerEl.classList.add("show"); if (!reduced) { bannerEl.classList.remove("bump"); void bannerEl.offsetWidth; bannerEl.classList.add("bump"); } }
  else requestAnimationFrame(() => { if (banner.c) bannerEl.classList.add("show"); });
  banner.timer = setTimeout(hideBanner, BANNER_HOLD);
}
function hideBanner() {
  clearTimeout(banner.timer); clearTimeout(banner.hide);
  banner.c = null; bannerEl.classList.remove("show", "bump", "drag"); bannerEl.style.transform = ""; document.body.classList.remove("dealing");
  banner.hide = setTimeout(() => { if (!banner.c) bannerEl.hidden = true; }, reduced ? 0 : 360);
}
// Tap: the card pops up out of the banner with its offers (which marks it seen and clears it from the badge).
dbOpen.addEventListener("click", () => { if (banner.swiped) { banner.swiped = false; return; } const c = banner.c; if (!c) return; const r = bannerEl.getBoundingClientRect(); hideBanner(); openDeal(c, { x: r.x + 8, y: r.y + 6, w: 36, h: 50 }); });
// Swipe it up and it goes.
bannerEl.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) return; banner.y0 = e.touches[0].clientY; banner.dy = 0; banner.swiped = false; clearTimeout(banner.timer); bannerEl.classList.add("drag"); }, { passive: true });
bannerEl.addEventListener("touchmove", (e) => {
  if (e.touches.length !== 1 || !banner.c) return;
  banner.dy = Math.min(0, e.touches[0].clientY - banner.y0);
  if (banner.dy < 0) { e.preventDefault(); bannerEl.style.transform = `translate(-50%, ${banner.dy}px)`; }
}, { passive: false });
const bannerUp = () => {
  if (!banner.c) return;
  if (banner.dy < -24) { banner.swiped = true; hideBanner(); return; }
  bannerEl.classList.remove("drag"); bannerEl.style.transform = ""; banner.dy = 0;
  banner.timer = setTimeout(hideBanner, BANNER_HOLD);
};
bannerEl.addEventListener("touchend", bannerUp); bannerEl.addEventListener("touchcancel", bannerUp);
// From the banner or the list's Deals row: whatever is up steps aside and the card pops up with its offers.
function openDeal(c, from) {
  if (document.body.classList.contains("listmode")) setListMode(false);
  if (tbl.on) closeTable(true);
  if (pop.c) closePop(true);
  if (state.focus) unfocus();
  if (state.trans) finishTransition();
  if (lifted && view === "mosaic" && c.m) { const y = c.m.y - topPad() - 10; if (y < mScroll || c.m.y + c.m.h - mScroll > vh - botPad()) mScroll = clamp(y, 0, mMax); }
  popCard(c, from || { x: vw / 2 - 18, y: topPad() + 6, w: 36, h: 50 });
}
// Popping a card up is looking at it (64-chase.js, plus the seen mark).
function popCard(c, from) {
  if (pop.c) return;
  hideCaption(); cancelPress();
  pop.c = c; pop.from = from; pop.t0 = performance.now(); pop.closing = false;
  oKind = "single"; fillOffers(c);
  offersEl.inert = false; document.body.classList.add("offering");
  markSeen(c);
  tick(5); kick();
}
// So is bringing it up close in the binder (52-focus.js, plus the seen mark).
function focus(c, dir = 0) {
  state.focus = c;
  document.body.classList.add("focused");
  fillPanel(c, dir);
  const top = 70, avail = vh - panelH() - top - 12;
  const ch = Math.min(avail * 0.92, (vw * 0.78) * TH / TW);
  const S = TH * c.sz, s = Math.min(ch / S, maxS() * 1.4);
  const cy = top + avail / 2;
  flyTo({ s, x: c.x + TW * c.sz / 2 - vw / 2 / s, y: c.y + S / 2 - cy / s }, dir ? 360 : 520);
  markSeen(c);
  tick(6);
}
// The offers sheet says when the live copy arrived (64-chase.js, plus the time).
function fillOffers(c) {
  const st = sets[c.si], list = offersFor(c, oKind);
  oName.textContent = c.name;
  oMeta.textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. Market ${money(c.price)}, you'd pay up to ${money(capOf(c))}.`;
  oSub.textContent = oKind === "single" ? `${list.length} copies online, cheapest first. Swipe through them.` : oKind === "pack" ? `${packOdds(c) > 36 ? "A long shot in a pack" : "A fair pull from a pack"}: ${list[0].odds.toLowerCase()}.` : `Sealed, with the odds of this card inside.`;
  offersEl.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === oKind)));
  const when = c.dealAt ? `, ${ago(c.dealAt)}` : "";
  oRow.innerHTML = list.map((o) => `<article class="offer${o.live ? " live" : ""}"><b>${money(o.price)}</b><span class="osrc">${o.src}${o.live ? `, the live deal${when}` : ""}</span><span class="ocond">${o.title}</span><span class="ocond">${o.cond}${o.ship ? `, ${money(o.ship)} shipping` : ", free shipping"}${o.odds ? `. ${o.odds}` : ""}</span><button type="button" class="mbtn obuy" data-q="${o.q.replace(/"/g, "&quot;")}">Open on ${o.src}</button></article>`).join("");
  oRow.scrollLeft = 0;
  oFlag.textContent = isChase(c) ? "Chasing ✓" : "Chase it";
}

// ----- the Chase lens: unseen deals lead their set and wear a "New" sticker -----
const newFirst = (a, b) => (unseen(b) ? 1 : 0) - (unseen(a) ? 1 : 0) || (unseen(a) && unseen(b) ? b.dealAt - a.dealAt : 0) || chaseOrder(a, b);
function orderGroup(g) {
  g.base ||= g.cards;
  const key = state.lens === "trade" ? isSpare : isChase, ord = state.lens === "trade" ? spareOrder : newFirst;
  const lead = lifted ? g.base.filter(key).sort(ord) : [];
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !key(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}
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
  ctx.fillStyle = deal ? theme.deal : theme.ink; font(800, 21 * s); ctx.fillText(fitText(short(c.deal ?? capOf(c)), tw), tx, y + pad + 17 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(deal ? `was ${short(c.price)}` : "the most you'd pay", tw), tx, y + pad + 31 * s);
  if (deal) { ctx.fillStyle = theme.deal; font(800, 13 * s); ctx.fillText(fitText(`${dealPct(c)}% under market`, tw), tx, y + pad + 47 * s); }
  else { ctx.fillStyle = theme.muted; font(600, 11 * s); ctx.fillText(fitText(`Market ${short(c.price)}`, tw), tx, y + pad + 47 * s); }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  if (unseen(c)) newSticker(x + pad - 4 * s, y + pad - 4 * s, s);
  ctx.globalAlpha = 1;
}
// The sticker: a small green "New" on the card's top-left corner, like an unread dot, until you've looked.
function newSticker(bx, by, s) {
  const bw = 30 * s, bh = 15 * s, ink = theme.dark ? theme.bg : "#fff";
  rr(bx, by, bw, bh, bh / 2); ctx.fillStyle = theme.deal; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = ink; font(800, 9.5 * s); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("New", bx + bw / 2, by + bh * 0.72); ctx.textAlign = "left";
}
// In the binder the unseen deal's pocket wears the same sticker (40-render.js, plus the sticker).
function emptyPocket(c, sx, sy, w, h, value) {
  const r = w * 0.045;
  const dealOn = c.deal && isChase(c) && state.lens !== "need" && !state.time;
  rr(sx, sy, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.strokeStyle = value ? heat(c.price) : dealOn ? theme.deal : theme["slot-line"];
  rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke();
  if (w < 44) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic";
  // price, top right
  ctx.textAlign = "right";
  if (dealOn) { ctx.fillStyle = theme.deal; font(700, w * 0.085); ctx.fillText(short(c.deal), sx + w - pad, sy + pad + w * 0.07); font(500, w * 0.06); ctx.fillText("live", sx + w - pad, sy + pad + w * 0.15); }
  else { ctx.fillStyle = value ? heat(c.price) : theme.muted; font(600, w * 0.08); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
  // label, bottom left
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, w * 0.088, true); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - w * 0.075);
  font(500, w * 0.064); ctx.fillText(`${sets[c.si].code} ${c.num}/${sets[c.si].printed}`, sx + pad, sy + h - pad);
  if (dealOn && unseen(c) && state.lens === "chase") newSticker(sx - 3, sy - 3, clamp(w / 90, 0.7, 1.4));
}

// ----- the list: a Deals row on top, newest first, with times (70-chrome.js, plus the row) -----
function drawList() {
  updateBadge(); // the chase list changed (this runs on every change): the badge follows
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  const nd = unseenDeals().filter((c) => !state.matches || state.matches.has(c)).sort((a, b) => b.dealAt - a.dealAt || a.i - b.i);
  if (nd.length) {
    top += `<section class="ldeals"><h2>Deals</h2><p class="lsub">${nd.length} new since you last looked. Tap one for the offers.</p><ul>${nd.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><button type="button" class="lrow" data-offers="${c.i}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice"><b class="ldeal">Live ${money(c.deal)}</b></span><span class="lstate">${dealPct(c)}% under market, <time data-at="${c.dealAt}">${ago(c.dealAt)}</time></span></button><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul></section>`;
  }
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top += `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">${c.deal && c.dealAt ? `${ago(c.dealAt)}, market` : "Market"} ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") {
    const ts = TRADERS.filter((t) => wantsOf(t).length).sort((a, b) => wantsOf(b).length - wantsOf(a).length);
    top += `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase.</p><ul>${ts.map((t) => {
      const want = wantsOf(t), has = offersOf(t), prop = proposedTo(t);
      const names = (l) => l.map((c) => c.name).join(", ");
      return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">Wants ${names(want)} (${money(sumOf(want))}).${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${prop ? `Proposed ${prop.give.length} for ${prop.get.length}` : ""}</span></div>${has.length ? `<button type="button" class="pill-btn" data-trade="${t.id}">Propose</button>` : ""}</li>`;
    }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
  }
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-offers]"); if (b) openDeal(cards[Number(b.dataset.offers)]); });
// "4 min ago" keeps up without redrawing the list.
setInterval(() => { for (const t of document.querySelectorAll("time[data-at]")) t.textContent = ago(Number(t.dataset.at)); }, 30000);
// For the tests and screenshots (debug builds only): make the next arrival happen now.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { arrive: { value: arrive }, feed: { get: () => feed }, unseenDeals: { value: unseenDeals }, openDeal: { value: openDeal } }); }, 0);
