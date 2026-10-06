// ---------- live: the wall moves when the market does ----------
// The feed (made up for the demo): 6 s after load and then every 9 s, one arrival on a chased card, in an order
// seeded by card id. A chased card without a deal gets one; once every chased card has one, the oldest deal drops by
// 10%. Nothing arrives until something is chased.
// An arrival is an event in the wall itself, wherever you are (round 12). The tile flashes green where it sits, a
// green ripple runs through its panel, the panel's header shows the card and the price for a beat ("Mew ex $215"),
// and a thin green line races from the card to the Chase lens button, which ticks up and glows. In the Chase lens the
// new tile slides to the front of its set with "just now" under the price; a price drop strikes the old price through.
// Nothing is a notification: the wall moves when the market does.
const live = { line: null, until: 0, beat: null, quick: false, badgeN: 0, news: [] }; // news: the arrivals the Chase lens hasn't shown in its banner yet
const feedOrder = (a, b) => h32(a.id + "r") - h32(b.id + "r") || a.i - b.i;
const arrivalPrice = (c) => Math.max(0.25, Math.round(c.price * (0.55 + 0.3 * h32(c.id + "e")) * 100) / 100);
function agoText(at, now) {
  const d = Math.max(0, now - at);
  if (d < 45e3) return "just now";
  if (d < 90e3) return "1 min ago";
  if (d < 3600e3) return `${Math.round(d / 60e3)} min ago`;
  if (d < 86400e3) return `${Math.round(d / 3600e3)} hr ago`;
  return `${Math.round(d / 86400e3)} days ago`;
}
// Measured text widths, remembered per font (measuring every frame is slow).
const wCache = new Map();
function textW(t) { const k = `${curFont}|${t}`; let v = wCache.get(k); if (v == null) { v = ctx.measureText(t).width; if (wCache.size > 3000) wCache.clear(); wCache.set(k, v); } return v; }

// ----- the feed -----
function nextArrival() {
  const chased = cards.filter(isChase).sort(feedOrder);
  if (!chased.length) return null;
  const now = Date.now();
  for (const c of chased) {
    if (c.deal || c.noDeal) continue;
    const p = arrivalPrice(c);
    if (p >= c.price) { c.noDeal = true; continue; } // at or over market isn't a deal
    return { c, price: p, was: null, at: now };
  }
  let old = null, oldAt = Infinity; // every chased card has one: the oldest deal drops by 10%
  for (const c of chased) { const at = c.dealAt || 0; if (c.deal && at < oldAt) { old = c; oldAt = at; } }
  if (!old) return null;
  const was = old.deal, p = Math.max(0.25, Math.round(was * 0.9 * 100) / 100);
  return p < was ? { c: old, price: p, was, at: now } : null;
}
function arrive() {
  const a = nextArrival(); if (!a) return;
  const c = a.c;
  c.deal = a.price; c.dealAt = a.at; c.dealWas = a.was; c.dealSeen = false;
  live.quick = false;
  showArrival(c, Boolean(a.was));
}
// The feed never lands on a moving wall: while a transition plays, the arrival waits a moment.
function tickFeed() {
  if (state.trans || shuffle || tbl.anim || gesture || revealing()) { setTimeout(tickFeed, 600); return; } // nor during the import's story and summary
  arrive();
  setTimeout(tickFeed, 9000);
}
setTimeout(tickFeed, 6000);

// ----- the event on the wall -----
const chaseBtn = lensBox.querySelector('[data-lens="chase"]'), badge = chaseBtn.querySelector(".lbadge");
const lensShown = () => !tbl.on && !document.body.matches(".focused, .offering, .marking, .trading, .welcoming, .listmode, .paying");
function syncBadge() {
  let n = 0;
  for (const c of cards) if (c.deal && c.dealAt && !c.dealSeen && isChase(c)) n++;
  if (n === live.badgeN) return;
  live.badgeN = n;
  badge.textContent = n > 99 ? "99+" : String(n); badge.hidden = !n;
  if (n) chaseBtn.setAttribute("aria-label", `Chase, ${n} new deal${n === 1 ? "" : "s"}`); else chaseBtn.removeAttribute("aria-label");
}
function glowChase() {
  syncBadge();
  chaseBtn.classList.remove("lglow"); void chaseBtn.offsetWidth; chaseBtn.classList.add("lglow");
  clearTimeout(glowChase.t); glowChase.t = setTimeout(() => chaseBtn.classList.remove("lglow"), 1100);
}
// You looked at it: the card popped up, or came up close, or its tile sat on screen in the Chase lens.
function lookedAt(c) {
  const b = c.base || c;
  if (!b.dealAt || b.dealSeen) return;
  b.dealSeen = true; syncBadge();
}
// Where the tile is on screen right now, or the edge it is beyond.
function tileStart(c) {
  let x, y;
  if (view === "set") {
    if (state.g !== groups[c.g]) return { x: vw / 2, y: topPad() + 4 };
    const r = binderRect(c, cam); x = r.x + r.w / 2; y = r.y + r.h / 2;
  } else { x = c.m.x + c.m.w / 2; y = c.m.y - mScroll + c.m.h / 2; }
  return { x: clamp(x, 8, vw - 8), y: clamp(y, topPad() + 4, vh - botPad() - 4) };
}
function showArrival(c, drop) {
  const now = performance.now(), g = groups[c.g];
  // In the Chase lens the tile slides to the front of its set (a deal leads).
  if (lifted && !state.focus) { if (state.trans || live.quick) layoutAll(); else liftLayout(true); }
  c.flash = { t0: now, drop }; for (const t of twinsOf(c)) t.flash = { t0: now, drop };
  if (!reduced) g.ripple = { t0: now, col: c.col, row: c.row, live: true };
  live.until = now + 3200;
  if (!live.news.includes(c)) live.news.push(c);
  if (state.lens === "chase" && !dealBar.hidden) showDealBar();
  if (lensShown() && !reduced) {
    const a = tileStart(c), b = chaseBtn.getBoundingClientRect();
    const x1 = b.left + b.width / 2, y1 = b.top + 3;
    live.line = { t0: now + 120, x0: a.x, y0: a.y, cx: x1, cy: a.y + (y1 - a.y) * 0.35, x1, y1 };
    setTimeout(glowChase, 640);
  } else if (lensShown()) glowChase();
  else syncBadge();
  drawList(); kick();
}


// The banner at the top of the Chase lens: what arrived since you last looked, one tap from the first one's offers.
const dealBar = document.getElementById("dealbar"), dbHead = document.getElementById("db-head"), dbSub = document.getElementById("db-sub");
function showDealBar() {
  live.news = live.news.filter((c) => c.deal && isChase(c) && !c.owned);
  const list = live.news.slice().sort((a, b) => (b.dealAt || 0) - (a.dealAt || 0)), c = list[0];
  if (!c) { hideDealBar(); return; }
  const pct = Math.round((1 - c.deal / c.price) * 100);
  dbHead.textContent = list.length === 1 ? `New deal: ${c.name} ${short(c.deal)}` : `${list.length} new deals`;
  dbSub.textContent = list.length === 1 ? `${pct}% under market, ${sets[c.si].name}` : `${c.name} ${short(c.deal)}, ${pct}% under, and ${list.length - 1} more`;
  dealBar.hidden = false;
  clearTimeout(showDealBar.t); showDealBar.t = setTimeout(hideDealBar, 9000);
}
function hideDealBar() { dealBar.hidden = true; clearTimeout(showDealBar.t); }
document.getElementById("db-main").onclick = () => { const c = live.news[0]; hideDealBar(); live.news = []; if (c && view === "mosaic" && !state.trans) popCard(c, c.m ? mr(c.m) : null); };
document.getElementById("db-x").onclick = () => { hideDealBar(); live.news = []; };
// The overlay, drawn after the wall each frame: the line racing to the Chase button.
function drawLive(now) {
  if (now >= live.until && !live.line) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  // Inside a binder the open set's header carries the beat, naming the set when the deal landed elsewhere.
  const g = state.g, b = live.beat;
  if (view === "set" && g && b && !state.trans) {
    const p = (now - b.t0) / 3000;
    if (p < 1) {
      const sx = (g.x - cam.x) * cam.s, sy = (g.y - cam.y) * cam.s, sw = g.w * cam.s, hh = g.head * cam.s;
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
