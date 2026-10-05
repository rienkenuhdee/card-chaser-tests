// ---------- trade matches: the Trade lens is your spares, dealt out like the chase list ----------
// A trade is your spare meeting someone else's want. The Trade lens works like Chase: every spare lifts out in front
// inside its panel as a tile (the market value, "Wanted by 3", who offers what), panels with no spares fold. Tap a
// tile and the card pops up over the wall with a sheet under it listing the collectors who want it, each with what
// they'd give you from their spares that you chase, the balance, and Propose. Nothing is sent anywhere: a proposal is
// kept on this device and the toast has Undo.

// ----- other collectors (made up, seeded by name, the same in every round 10 variant) -----
const TRADERS = [{ id: "maya", name: "Maya", where: "Sacramento" }, { id: "theo", name: "Theo", where: "Oakland" }, { id: "jun", name: "Jun", where: "Reno" }, { id: "priya", name: "Priya", where: "Davis" }];
const tOwns = (t, c) => h32(`${t.id}|o|${c.id}`) < 0.45;
const tSpare = (t, c) => tOwns(t, c) && h32(`${t.id}|s|${c.id}`) < 0.14;
const tChase = (t, c) => !tOwns(t, c) && h32(`${t.id}|c|${c.id}`) < 0.16;
const THEIR = { maya: "her", theo: "his", jun: "their", priya: "her" };
const traderById = (id) => TRADERS.find((t) => t.id === id);

// ----- proposed trades: kept on this device, with Undo -----
let trades = [];
try { trades = JSON.parse(localStorage.getItem("wall-trades") || "[]") || []; } catch { trades = []; }
const persistTrades = () => { try { localStorage.setItem("wall-trades", JSON.stringify(trades)); } catch { /* private mode */ } };
const proposalFor = (c, t) => trades.find((x) => x.give === c.id && x.to === t.id);

// ----- matching: who wants a spare, and what each would give for it -----
// Their offer is a bundle from their spares that you chase, picked to come as close as it can to your card's value
// (up to four cards); if that still falls well short they add cash, and someone with nothing you chase offers cash at
// market. Everything here is cached per card and cleared whenever the layout is recomputed (every change that can move
// a match also moves the layout).
const matchCache = new Map(), poolCache = new Map();
function tradeDirty() { matchCache.clear(); poolCache.clear(); }
function poolOf(t) {
  let p = poolCache.get(t.id);
  if (!p) { p = cards.filter((x) => isChase(x) && tSpare(t, x)).sort((a, b) => b.price - a.price); poolCache.set(t.id, p); }
  return p;
}
function offerFrom(t, c) {
  const target = c.price, out = [];
  let total = 0;
  for (const x of poolOf(t)) {
    if (out.length >= 4) break;
    if (Math.abs(total + x.price - target) < Math.abs(total - target)) { out.push(x); total += x.price; }
  }
  // Cash evens it up when the cards fall well short (theirs) or run well over (yours); whole dollars above $5.
  const even = (v) => (v >= 5 ? Math.round(v) : Math.round(v * 100) / 100);
  let cash = 0, yours = 0;
  if (!out.length) cash = target; else if (total < target * 0.75) cash = even(target - total); else if (total > target * 1.25) yours = even(total - target);
  return { cards: out, cash, yours, total: Math.round((total + cash) * 100) / 100 };
}
function matchOf(c) {
  let m = matchCache.get(c.id);
  if (m) return m;
  const who = TRADERS.filter((t) => tChase(t, c));
  // Card offers first, the most even balance first; cash offers last.
  const offers = who.map((t) => ({ t, o: offerFrom(t, c) })).sort((a, b) => (b.o.cards.length ? 1 : 0) - (a.o.cards.length ? 1 : 0) || Math.abs(a.o.total - c.price) - Math.abs(b.o.total - c.price));
  const proposed = trades.filter((x) => x.give === c.id).map((x) => traderById(x.to)).filter(Boolean);
  const best = offers[0];
  m = { n: who.length, offers, proposed: proposed[0] || null, line: best ? (best.o.cards.length ? `${best.t.name} has ${best.o.cards[0].name}` : `${best.t.name} offers cash`) : "" };
  matchCache.set(c.id, m);
  return m;
}
const listOf = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

// ----- the lead: Chase leads with chases, Trade leads with spares -----
// Wanted spares first (most wanted, then dearest), then the rest of the spares by value.
const tradeOrder = (a, b) => matchOf(b).n - matchOf(a).n || b.price - a.price || a.i - b.i;
let liftLens = null; // which lens the current lifted layout is for
function orderGroup(g) {
  g.base ||= g.cards;
  const is = state.lens === "trade" ? isSpare : isChase, order = state.lens === "trade" ? tradeOrder : chaseOrder;
  const lead = lifted ? g.base.filter(is).sort(order) : [];
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !is(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}
function layoutAll() {
  lifted = state.lens === "chase" || state.lens === "trade"; liftLens = lifted ? state.lens : null;
  tradeDirty();
  for (const g of groups) orderGroup(g); groups.forEach(binderLayout); if (lifted) liftedLayout(); else mosaicLayout();
}
// Same as the base, except that going straight from Chase to Trade (or back) is a flight too, not a cut.
function liftLayout(force = false) {
  const want = state.lens === "chase" || state.lens === "trade";
  const same = want === lifted && (!want || liftLens === state.lens);
  if (same && !(force && lifted)) { layoutAll(); return; }
  const T = state.trans;
  if (T && !(T.anim || T.t0)) { layoutAll(); return; }
  if (T) finishTransition();
  const now = performance.now();
  if (view === "set" && state.g) {
    const g = state.g;
    if (state.focus) unfocus();
    for (const c of g.cards) { c.px = c.x; c.py = c.y; }
    layoutAll();
    if (!reduced) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.4); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
    tick(8); kick(); return;
  }
  for (const c of cards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  for (const c of cards) c.delay = reduced ? 0 : Math.min(400, (c.lift ? 0 : 90) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
function setLens(lens) {
  if (lens === state.lens) return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "have") { const n = cards.filter((c) => c.owned).length; toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection`); }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  if (lens === "chase") { const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length; toast(n ? `${n} on your chase list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your chase list yet. Open a card and choose Chase it."); }
  if (lens === "trade") { const sp = cards.filter(isSpare), w = sp.filter((c) => matchOf(c).n).length; toast(sp.length ? `${sp.length} spare${sp.length === 1 ? "" : "s"} to trade${w ? `, ${w} that someone wants` : ""}` : "No spares yet. Open a card you own and choose Spare."); }
  if (was === "chase" || was === "trade") closePop(true);
  liftLayout(); drawList(); updateCount(); kick();
}
function panelStat(g) {
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(c)).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") { const sp = g.cards.filter(isSpare), w = sp.filter((c) => matchOf(c).n).length; return sp.length ? `${sp.length} spare${sp.length === 1 ? "" : "s"}${w ? `, ${w} wanted` : ""}` : "No spares"; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
// Spare on the card panel now also moves the Trade layout, the way Chase it moves the Chase layout.
flagBtn.onclick = () => {
  const c = state.focus; if (!c) return;
  if (c.owned) {
    spares[c.id] = !isSpare(c); try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* fine */ }
    updateFlag(c); tick(5); drawList(); if (lifted) liftLayout(true); kick();
    toast(spares[c.id] ? `${c.name} is a spare, up for trade.` : `${c.name} is no longer a spare.`);
    return;
  }
  chasing[c.id] = !isChase(c); persistChase(); updateFlag(c); tick(5); drawList(); if (lifted) liftLayout(true); kick();
  toast(chasing[c.id] ? `${c.name} on your chase list. Pay up to ${money(capOf(c))}.` : `${c.name} off your chase list.`);
};
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-spares", "wall-paid", "wall-trades"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ----- the tiles: a lifted card you own is its trade tile while it's wide -----
// drawTile as in the base, with one change: the feed-tile path no longer requires the card to be unowned.
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  const a0 = mult * c.e * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1);
  if (a0 < 0.02) return;
  let scale = 1;
  const st = groups[c.g];
  if (st.ripple) {
    const d = Math.hypot(c.col - st.ripple.col, c.row - st.ripple.row);
    const t = (now - st.ripple.t0 - d * 38) / 300;
    if (t > 0 && t < 1) scale = 1 + 0.075 * Math.sin(Math.PI * t);
  }
  if (state.press?.c === c) scale *= 1 - 0.07 * clamp((now - state.press.t0) / 420, 0, 1);
  let intro = 1;
  if (state.introT0 && !reduced) intro = clamp((now - state.introT0 - c.intro) / 360, 0, 1);
  if (intro <= 0) return;
  const alpha = a0 * intro;
  if (scale !== 1 || intro < 1) {
    const k = scale * (0.86 + 0.14 * intro);
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  ctx.globalAlpha = alpha;
  if (c.lift && w > h * 1.05) { drawFeedTile(c, sx, sy, w, h, alpha); ctx.globalAlpha = 1; return; }
  const value = state.value && !state.matches;
  let flood = c.owned ? 1 : 0;
  if (state.time) flood = c.owned && c.got ? clamp((state.t - c.got) / (14 * 86400e3), 0, 1) : 0;
  else if (c.anim) {
    const p = clamp((now - c.anim.t0) / 460, 0, 1);
    const e = 1 - Math.pow(1 - p, 3);
    flood = c.anim.to ? e : 1 - e;
    if (p >= 1) c.anim = null;
  }
  if (w < 5) {
    ctx.fillStyle = value ? (c.owned ? heat(c.price) : theme.slot) : flood > 0.5 ? typeColor(c) : theme.slot;
    if (!c.owned && c.deal && (state.lens === "chase" || state.lens === "have")) ctx.fillStyle = theme.deal;
    ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1));
    return;
  }
  if (w < 26) {
    const r = w * 0.09, round = w >= 12;
    const dealOn = !c.owned && c.deal && state.lens !== "need" && !state.time;
    if (flood < 1) {
      ctx.fillStyle = theme.slot;
      if (round) { rr(sx, sy, w, h, r); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = dealOn ? theme.deal : theme["slot-line"]; ctx.stroke(); }
      else { ctx.fillRect(sx, sy, w, h); if (dealOn) { ctx.strokeStyle = theme.deal; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1); } }
    }
    if (flood > 0) {
      const col = value ? heat(c.price) : typeColor(c);
      const partial = flood < 1;
      if (partial) { ctx.save(); ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, Math.hypot(w, h) / 2 * flood, 0, Math.PI * 2); ctx.clip(); }
      ctx.fillStyle = col;
      if (round) { rr(sx, sy, w, h, r); ctx.fill(); } else ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = lighter(col); ctx.fillRect(sx + r * 0.3, sy + r * 0.3, w - r * 0.6, h * 0.22);
      if (w > 12) { ctx.fillStyle = theme.paper; ctx.fillRect(sx + r * 0.3, sy + h * 0.78, w - r * 0.6, h * 0.2); }
      if (partial) ctx.restore();
    }
    if (value && !c.owned) { ctx.lineWidth = Math.max(1, w * 0.08); ctx.strokeStyle = heat(c.price); ctx.strokeRect(sx, sy, w, h); }
    if (dealOn && w > 9) { ctx.fillStyle = theme.deal; ctx.beginPath(); ctx.arc(sx + w * 0.8, sy + w * 0.2, Math.max(2, w * 0.12), 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  if (flood < 1) emptyPocket(c, sx, sy, w, h, value);
  if (flood > 0) {
    ctx.save();
    if (flood < 1) { ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, Math.hypot(w, h) / 2 * flood, 0, Math.PI * 2); ctx.clip(); }
    cardFace(c, sx, sy, w, h, now, value);
    ctx.restore();
  }
}
let wantKey = "", wantVal = "";
function wantTint() { const k = theme.slot + theme.gold; if (k !== wantKey) { wantKey = k; wantVal = mix(theme.slot, theme.gold, theme.dark ? 0.16 : 0.1); } return wantVal; }
// The feed tile: a chased card (as in the base) or, for a card you own, a spare: the market value, who wants it.
function drawFeedTile(c, x, y, w, h, a) {
  if (c.owned) return drawSpareTile(c, x, y, w, h, a);
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
function drawSpareTile(c, x, y, w, h, a) {
  const st = sets[c.si], m = matchOf(c), hot = m.n > 0, rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = hot ? wantTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = hot ? 1.5 : 1; ctx.strokeStyle = hot ? theme.gold : theme["slot-line"]; ctx.stroke();
  if (w < 60) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.06), s = clamp(w / 177, 0.6, 1.3), rw = w - pad * 2 - 50 * s; // the name line sits beside "market", which is short
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.ink; font(800, 22 * s); ctx.fillText(short(c.price), x + pad, y + pad + 18 * s);
  ctx.fillStyle = theme.muted; font(500, 11.5 * s); ctx.fillText("market", x + pad, y + pad + 33 * s);
  ctx.textAlign = "right";
  if (m.proposed) { ctx.fillStyle = theme.gold; font(800, 14 * s); ctx.fillText("Proposed", x + w - pad, y + pad + 18 * s); ctx.fillStyle = theme.muted; font(600, 10.5 * s); ctx.fillText(fitText(`to ${m.proposed.name}${m.n > 1 ? `, ${m.n - 1} more want it` : ""}`, rw), x + w - pad, y + pad + 33 * s); }
  else if (hot) { ctx.fillStyle = theme.gold; font(800, 14 * s); ctx.fillText(`Wanted by ${m.n}`, x + w - pad, y + pad + 18 * s); ctx.fillStyle = theme.muted; font(600, 10.5 * s); ctx.fillText(fitText(m.line, rw), x + w - pad, y + pad + 33 * s); }
  else { ctx.fillStyle = theme.muted; font(600, 11.5 * s); ctx.fillText("No takers yet", x + w - pad, y + pad + 18 * s); }
  ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(700, 14.5 * s, true); ctx.fillText(fitText(c.name, w - pad * 2), x + pad, y + h - pad - 14 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}, ${c.rname}`, w - pad * 2), x + pad, y + h - pad);
  ctx.globalAlpha = 1;
}

// ----- the sheet: who wants it, like a marketplace listing -----
offersEl.insertAdjacentHTML("afterend", `<div class="tsheet glass" id="trade" role="dialog" aria-labelledby="t-name" inert>
  <div class="o-head"><div class="o-title"><b id="t-name"></b><span id="t-meta"></span></div><button type="button" class="ib" id="t-close" aria-label="Put the card back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <p class="o-sub" id="t-sub"></p>
  <div class="trows" id="t-rows"></div>
  <div class="t-acts"><button type="button" class="mbtn" id="t-flag">Spare ✓</button></div>
</div>`);
const tradeEl = document.getElementById("trade"), tName = document.getElementById("t-name"), tMeta = document.getElementById("t-meta"), tSub = document.getElementById("t-sub"), tRows = document.getElementById("t-rows");
const trading = () => document.body.classList.contains("trading");
const chip = (x) => `<span class="chip" style="--c:${typeColor(x)}"><span>${x.name}</span><small><b>${short(x.price)}</b> ${sets[x.si].code} ${x.num}</small></span>`;
function tradeRow(c, t, o) {
  const done = proposalFor(c, t);
  const chips = o.cards.map(chip).join("") + (o.cash ? `<span class="chip cash"><span>Cash</span><small><b>${short(o.cash)}</b>${o.cards.length ? " to even it up" : " at market"}</small></span>` : "");
  const bal = o.cards.length ? `You give ${short(c.price)}${o.yours ? ` and ${short(o.yours)} cash` : ""}, get ${short(o.total)}` : `Cash at market, ${short(c.price)}`;
  return `<article class="trow${done ? " done" : ""}"><div class="twho"><b>${t.name}<span>, ${t.where}</span></b><span class="tbal">${bal}</span></div><button type="button" class="mbtn${done ? "" : " primary"} tpro" data-t="${t.id}" aria-pressed="${Boolean(done)}">${done ? "Proposed ✓" : "Propose"}</button><div class="tchips">${chips}</div></article>`;
}
function fillTrade(c) {
  const st = sets[c.si], m = matchOf(c), others = m.n - trades.filter((x) => x.give === c.id).length;
  tName.textContent = c.name;
  tMeta.textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. Market ${money(c.price)}. Your spare.`;
  tSub.textContent = m.proposed ? `Proposed to ${listOf(trades.filter((x) => x.give === c.id).map((x) => traderById(x.to)?.name).filter(Boolean))}.${others > 0 ? ` ${others} other${others === 1 ? "" : "s"} want${others === 1 ? "s" : ""} it too.` : ""}` : m.n ? `${m.n} collector${m.n === 1 ? "" : "s"} want${m.n === 1 ? "s" : ""} it. Pick one to propose a trade.` : "Nobody wants this one yet. It stays up for trade.";
  tRows.innerHTML = m.offers.map(({ t, o }) => tradeRow(c, t, o)).join("");
  tRows.scrollTop = 0;
}
function refreshTrade() { if (pop.c && trading()) fillTrade(pop.c); drawList(); kick(); }
function propose(c, t) {
  if (proposalFor(c, t)) return;
  const o = offerFrom(t, c);
  const rec = { to: t.id, give: c.id, get: o.cards.map((x) => x.id), cash: o.cash, yours: o.yours, at: Date.now() };
  trades.push(rec); persistTrades(); tradeDirty(); tick(10);
  const names = o.cards.map((x) => x.name);
  const what = o.cards.length ? `${THEIR[t.id]} ${listOf(names)}${o.cash ? ` and ${short(o.cash)} cash` : ""}` : `${short(o.cash)} cash`;
  toast(`Proposed to ${t.name}: ${/^The /.test(c.name) ? "" : "your "}${c.name}${o.yours ? ` and ${short(o.yours)} cash` : ""} for ${what}.`, () => { trades = trades.filter((x) => x !== rec); persistTrades(); tradeDirty(); refreshTrade(); });
  refreshTrade();
}
function withdraw(c, t) {
  const rec = proposalFor(c, t); if (!rec) return;
  trades = trades.filter((x) => x !== rec); persistTrades(); tradeDirty(); tick(5);
  toast(`Withdrawn: your ${c.name} to ${t.name}.`, () => { trades.push(rec); persistTrades(); tradeDirty(); refreshTrade(); });
  refreshTrade();
}
tRows.addEventListener("click", (e) => {
  const b = e.target.closest("[data-t]"); if (!b || !pop.c) return;
  const t = traderById(b.dataset.t); if (!t) return;
  if (proposalFor(pop.c, t)) withdraw(pop.c, t); else propose(pop.c, t);
});
document.getElementById("t-close").onclick = () => closePop();
document.getElementById("t-flag").onclick = () => {
  const c = pop.c; if (!c) return;
  spares[c.id] = false; try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* fine */ }
  closePop(true); tick(5); liftLayout(true); drawList();
  toast(`${c.name} is no longer a spare.`, () => { spares[c.id] = true; try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* fine */ } liftLayout(true); drawList(); kick(); });
  kick();
};
// The pop-up is shared with Chase: a card you own pops up over the trade sheet, a card you chase over the offers.
function popCard(c, from) {
  if (pop.c) return;
  hideCaption(); cancelPress();
  pop.c = c; pop.from = from; pop.t0 = performance.now(); pop.closing = false;
  if (c.owned) { fillTrade(c); tradeEl.inert = false; document.body.classList.add("trading"); }
  else { oKind = "single"; fillOffers(c); offersEl.inert = false; document.body.classList.add("offering"); }
  tick(5); kick();
}
function closePop(instant = false) {
  if (!pop.c) return;
  offersEl.inert = true; tradeEl.inert = true; document.body.classList.remove("offering", "trading");
  if (instant || reduced) { pop.c = null; kick(); return; }
  pop.closing = true; pop.t0 = performance.now(); kick();
}
function popRect() {
  const sheet = (trading() ? tradeEl : offersEl).offsetHeight || vh * 0.46, top = topPad() + 6, bot = vh - sheet - 14;
  const h = Math.min((bot - top) * 0.92, vw * 0.78 * TH / TW), w = h * TW / TH;
  return { x: (vw - w) / 2, y: top + (bot - top - h) / 2, w, h };
}

// ----- the list: a Trade section with the same rows -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") {
    const sp = cards.filter((c) => isSpare(c) && (!state.matches || state.matches.has(c))).sort((a, b) => matchOf(b).n - matchOf(a).n || a.si - b.si || b.price - a.price);
    const wanted = sp.filter((c) => matchOf(c).n).length;
    top = `<section><h2>Your spares</h2><p class="lsub">${sp.length} up for trade${wanted ? `, ${wanted} that someone wants. Those first.` : "."}</p><ul>${sp.map((c) => {
      const st = sets[c.si], m = matchOf(c);
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${money(c.price)}</span><span class="lstate">${m.proposed ? `Proposed to ${m.proposed.name}` : m.n ? `Wanted by ${m.n}` : "Nobody wants it yet"}</span></div>${m.n ? `<button type="button" class="pill-btn" data-trade="${c.i}">Offers</button>` : ""}</li>`;
    }).join("")}</ul>${sp.length ? "" : `<p class="lsub">No spares yet. Open a card you own on the wall and choose Spare.</p>`}</section>`;
  }
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (matchOf(c).n ? `Spare, wanted by ${matchOf(c).n}` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-trade]"); if (b) popCard(cards[Number(b.dataset.trade)], popRect()); });
