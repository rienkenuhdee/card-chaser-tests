// ---------- live: the wall moves when the market does ----------
// The round 12 feed (shared by every variant): 6 s after load and then every 9 s, one arrival on a chased card, in an
// order seeded by card id. A chased card without a deal gets one; once every chased card has one, the oldest deal
// drops by 10%. Nothing arrives until something is chased.
// This variant: an arrival is an event in the wall itself, wherever you are. The tile flashes green where it sits, a
// green ripple runs through its panel, the panel's header shows the price for a beat ("Mew ex $215"), and a thin green
// line races from the card to the Chase lens button, which ticks up and glows. In the Chase lens the new tile slides
// to the front of its set with "just now" under the price. Nothing is a notification. The Live filter (by the search
// box, next to Value and Time) replays this session's arrivals on a slider, the way Time replays the collection.
state.live = false;
const live = { t0: Date.now(), t: Date.now(), tPrev: Date.now(), atEnd: true, log: [], touched: new Set(), line: null, until: 0, playing: null, quick: false, badgeN: 0, ticksAt: 0 };
const liveNow = () => (state.live ? live.t : Date.now());
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
// Each card that an arrival touched keeps a history ({ at, price, was }), so the Live filter can show what was live at
// any moment. A seeded deal is the first entry, at time 0.
const latestOf = (c) => (c.hist ? c.hist[c.hist.length - 1] || null : c.deal ? { at: 0, price: c.deal, was: null } : null);
function entryAt(c, t) { let e = null; for (const x of c.hist) { if (x.at <= t) e = x; else break; } return e; }
function applyEntry(c, e) { c.deal = e ? e.price : null; c.dealAt = e ? e.at : 0; c.dealWas = e ? e.was : null; }
function nextArrival() {
  const chased = cards.filter(isChase).sort(feedOrder);
  if (!chased.length) return null;
  const now = Date.now();
  for (const c of chased) {
    if (latestOf(c) || c.noDeal) continue;
    const p = arrivalPrice(c);
    if (p >= c.price) { c.noDeal = true; continue; } // at or over market isn't a deal
    return { c, price: p, was: null, at: now };
  }
  let old = null, oldAt = Infinity; // every chased card has one: the oldest deal drops by 10%
  for (const c of chased) { const L = latestOf(c); if (L && L.at < oldAt) { old = c; oldAt = L.at; } }
  if (!old) return null;
  const was = latestOf(old).price, p = Math.max(0.25, Math.round(was * 0.9 * 100) / 100);
  return p < was ? { c: old, price: p, was, at: now } : null;
}
function arrive() {
  const a = nextArrival(); if (!a) return;
  const c = a.c;
  c.hist ||= c.deal ? [{ at: 0, price: c.deal, was: null }] : [];
  c.hist.push({ at: a.at, price: a.price, was: a.was });
  live.touched.add(c); live.log.push(a); c.dealSeen = false;
  if (state.live) { drawTicks(); if (live.atEnd && !live.playing) setLT(Date.now()); else liveCount(); return; } // scrubbed back: it waits on the slider
  applyEntry(c, a);
  live.quick = false;
  showArrival(c, Boolean(a.was));
}
// The feed never lands on a moving wall: while a transition plays, the arrival waits a moment.
function tickFeed() {
  if (state.trans || shuffle || tbl.anim) { setTimeout(tickFeed, 600); return; }
  arrive();
  setTimeout(tickFeed, 9000);
}
setTimeout(tickFeed, 6000);

// ----- the event on the wall -----
const chaseBtn = lensBox.querySelector('[data-lens="chase"]');
chaseBtn.insertAdjacentHTML("beforeend", '<i class="lbadge" aria-hidden="true" hidden></i>');
const badge = chaseBtn.querySelector(".lbadge");
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
  if (!c.dealAt || c.dealSeen) return;
  c.dealSeen = true; syncBadge(); if (state.live) liveCount();
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
  c.flash = { t0: now, drop };
  if (!reduced) g.ripple = { t0: now, col: c.col, row: c.row, live: true };
  g.beat = { t0: now, text: drop ? `${c.name} down to ${short(c.deal)}` : `${c.name} ${short(c.deal)}` };
  live.beat = { ...g.beat, g };
  live.until = now + 3200;
  if (lensShown() && !reduced) {
    const a = tileStart(c), b = chaseBtn.getBoundingClientRect();
    const x1 = b.left + b.width / 2, y1 = b.top + 3;
    live.line = { t0: now + 120, x0: a.x, y0: a.y, cx: x1, cy: a.y + (y1 - a.y) * 0.35, x1, y1 };
    setTimeout(glowChase, 640);
  } else if (lensShown()) glowChase();
  else syncBadge();
  drawList(); kick();
}

// The tile: the base tile, then the green. A flash on the card that changed (a pop, or two pulses for a price drop,
// still when motion is reduced) and the ripple's green tint on its neighbours.
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  drawTile0(c, sx, sy, w, h, now, mult);
  // In the Need lens the cards you're chasing stand out further still: a gold ring.
  if (state.lens === "need" && !c.owned && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
    ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
  }
  let tint = 0;
  if (fp) tint = 0.55 * (1 - fp);
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) tint = 0.3 * Math.sin(Math.PI * t); } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = theme.deal; ctx.globalAlpha = a * tint;
  if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
  if (fp) { // a ring spreads from the card, so it can be found in a dense wall
    const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = theme.deal;
    rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// The panel: for three seconds after a deal arrives in it, its header shows the card and the price, in green.
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
  if (g.beat) { const p = (now - g.beat.t0) / 3000; if (p < 1) beat = { text: g.beat.text, a: Math.min(1, p * 10, (1 - p) * 4) }; else g.beat = null; }
  font(beat ? 700 : 600, size * 0.82);
  const stat = beat ? fitText(beat.text, w * 0.72) : panelStat(g), sw = stat ? textW(stat) + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw), x, m.y + PG + 22);
  if (stat) {
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? theme.deal : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, x + w, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha;
  }
  const owned = ownedNow(g.cards), n = g.cards.length;
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  ctx.globalAlpha = 1;
}

// The feed tile: as the base, plus when the deal arrived under the price ("just now", green until you've looked), and
// on a price drop the old asking price struck through beside the new one. A tile that sits on screen counts as looked at.
function drawFeedTile(c, x, y, w, h, a, now = performance.now()) {
  const st = sets[c.si], deal = Boolean(c.deal), rad = Math.min(12, w * 0.07), arrived = deal && c.dealAt > 0;
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
  const price = fitText(short(c.deal ?? capOf(c)), tw);
  ctx.fillStyle = deal ? theme.deal : theme.ink; font(800, 21 * s); ctx.fillText(price, tx, y + pad + 17 * s);
  if (arrived && c.dealWas) {
    const pw = textW(price); font(600, 12 * s);
    const old = short(c.dealWas), ow = textW(old), ox = tx + pw + 6 * s;
    if (ox + ow <= tx + tw) { ctx.fillStyle = theme.muted; ctx.fillText(old, ox, y + pad + 17 * s); ctx.fillRect(ox, y + pad + 12.5 * s, ow, Math.max(1, s)); }
  }
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(deal ? `was ${short(c.price)}` : "the most you'd pay", tw), tx, y + pad + 31 * s);
  if (deal) { ctx.fillStyle = theme.deal; font(800, 13 * s); ctx.fillText(fitText(`${dealPct(c)}% under market`, tw), tx, y + pad + 47 * s); }
  else { ctx.fillStyle = theme.muted; font(600, 11 * s); ctx.fillText(fitText(`Market ${short(c.price)}`, tw), tx, y + pad + 47 * s); }
  if (arrived) {
    const ago = agoText(c.dealAt, liveNow());
    ctx.fillStyle = c.dealSeen ? theme.muted : theme.deal; font(700, 11 * s);
    ctx.fillText(fitText(c.dealWas ? `↓ ${ago}` : ago, tw), tx, y + pad + 62 * s);
    if (!c.dealSeen && !state.trans && !shuffle && liveNow() - c.dealAt > 3000 && y >= topPad() - 2 && y + h <= vh - botPad() + 2) lookedAt(c);
  }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}

// The overlay, drawn after the wall each frame: the open set's header beat, and the line racing to the Chase button.
function drawLive(now) {
  if (now >= live.until && !live.line) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  // Inside a binder the open set's header carries the beat, naming the set when the deal landed elsewhere.
  const g = state.g, b = live.beat;
  if (view === "set" && g && b && !state.trans) {
    const p = (now - b.t0) / 3000;
    if (p < 1) {
      const sx = (g.x - cam.x) * cam.s, sy = (g.y - cam.y) * cam.s, sw = g.w * cam.s, hh = g.head * cam.s;
      ctx.globalAlpha = Math.min(1, p * 10, (1 - p) * 4); ctx.fillStyle = theme.deal; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
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
// Returns whether another frame is needed (the base's pop, with the live overlay under it).
function drawPop(now) {
  const more = drawLive(now);
  const c = pop.c; if (!c) return more;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = reduced ? 1 : clamp((now - pop.t0) / 360, 0, 1), e = ease(pop.closing ? 1 - k : k);
  const a = pop.from, b = popRect();
  const r = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
  ctx.globalAlpha = 0.6 * e; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  ctx.globalAlpha = 0.28 * e; rr(r.x + 2, r.y + 8, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill();
  const e0 = c.e; c.e = 1; ctx.globalAlpha = 1;
  if (r.w > r.h * 1.05) drawFeedTile(c, r.x, r.y, r.w, r.h, 1, now); else drawTile(c, r.x, r.y, r.w, r.h, now);
  c.e = e0; ctx.globalAlpha = 1;
  if (pop.closing && k >= 1) { pop.c = null; return more; }
  return k < 1 || more;
}
// Popping a card, or bringing it up close, is looking at its deal.
function popCard(c, from) {
  if (pop.c) return;
  hideCaption(); cancelPress();
  pop.c = c; pop.from = from; pop.t0 = performance.now(); pop.closing = false;
  oKind = "single"; fillOffers(c);
  offersEl.inert = false; document.body.classList.add("offering");
  lookedAt(c);
  tick(5); kick();
}
function focus(c, dir = 0) {
  state.focus = c;
  document.body.classList.add("focused");
  fillPanel(c, dir);
  const top = 70, avail = vh - panelH() - top - 12;
  const ch = Math.min(avail * 0.92, (vw * 0.78) * TH / TW);
  const S = TH * c.sz, s = Math.min(ch / S, maxS() * 1.4);
  const cy = top + avail / 2;
  flyTo({ s, x: c.x + TW * c.sz / 2 - vw / 2 / s, y: c.y + S / 2 - cy / s }, dir ? 360 : 520);
  lookedAt(c);
  tick(6);
}

// ----- the Live filter: replay this session's arrivals -----
filterBtn.setAttribute("aria-label", "Filters: value, time and live");
filterMenu.insertAdjacentHTML("beforeend", '<button role="menuitemcheckbox" data-filter="live" aria-checked="false"><span><b>Live</b><small>Replay the deals that arrived</small></span><span class="tick" aria-hidden="true">✓</span></button>');
filterMenu.querySelector('[data-filter="live"]').onclick = () => { setFilterMenu(false); setLive(!state.live); };
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>', PAUSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13M16 5.5v13" stroke-width="3"/></svg>';
document.querySelector(".timebar").insertAdjacentHTML("afterend", `<div class="timebar livebar glass" id="livebar" role="group" aria-label="Live deals">
  <button class="ib" id="l-play" aria-label="Replay the deals that arrived">${PLAY_SVG}</button>
  <div class="tl"><b id="l-when">Now</b><span id="l-count"></span></div>
  <div class="tr"><svg id="l-ticks" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true"></svg>
  <input type="range" id="l-range" min="0" max="1000" value="1000" aria-label="When each deal arrived"></div>
</div>`);
const lRange = document.getElementById("l-range"), lWhen = document.getElementById("l-when"), lCount = document.getElementById("l-count"), lPlay = document.getElementById("l-play"), lTicks = document.getElementById("l-ticks");
function markFilters() {
  filterMenu.querySelector('[data-filter="value"]').setAttribute("aria-checked", String(state.value));
  filterMenu.querySelector('[data-filter="time"]').setAttribute("aria-checked", String(state.time));
  filterMenu.querySelector('[data-filter="live"]').setAttribute("aria-checked", String(state.live));
  filterBtn.setAttribute("aria-pressed", String(state.value || state.time || state.live));
}
// Time and Live share the bottom of the screen, so one puts the other away.
function setTime(on) {
  if (on && state.live) setLive(false);
  state.time = on; markFilters(); tick(5); hideCaption();
  document.body.classList.toggle("timing", on);
  if (on) { drawSpark(); playTime(true); } else { stopTime(); state.t = Date.now(); }
  layoutAll(); updateCount(); drawList(); kick();
}
function setLive(on) {
  if (on && state.time) setTime(false);
  state.live = on; markFilters(); tick(5); hideCaption();
  document.body.classList.toggle("living", on); document.body.classList.toggle("timing", on); // timing keeps the wall clear of the bar
  if (on) {
    live.tPrev = live.t0 - 1; drawTicks(); setLT(Date.now());
    if (live.log.length) playLive(true);
    else toast(cards.some(isChase) ? "No deals have arrived yet. The first is on its way." : "Nothing arrives until you chase a card.");
  } else { stopLive(); setLT(Date.now()); }
  layoutAll(); drawList(); kick();
}
function liveCount() {
  let n = 0, k = 0;
  for (const c of cards) if (c.deal && isChase(c)) { n++; if (c.dealAt && !c.dealSeen) k++; }
  lCount.textContent = n ? `${n} live deal${n === 1 ? "" : "s"}${k ? `, ${k} new since you looked` : ""}` : "No live deals";
}
// One tick per arrival along the slider (a short one for a price drop).
function drawTicks() {
  const now = Date.now(), span = Math.max(1, now - live.t0);
  live.ticksAt = now;
  lTicks.innerHTML = live.log.map((a) => { const x = ((a.at - live.t0) / span * 1000).toFixed(1); return `<line x1="${x}" y1="${a.was ? 21 : 12}" x2="${x}" y2="30"${a.was ? ' class="drop"' : ""}/>`; }).join("");
}
// The moment on the slider: every touched card shows the deal it had then. Stepping forward over one arrival plays
// it on the wall exactly as it happened.
function setLT(t, { user = false } = {}) {
  const now = Date.now(); t = clamp(t, live.t0, now);
  const p = (t - live.t0) / Math.max(1, now - live.t0);
  live.t = t; live.atEnd = p > 0.995;
  lRange.value = String(Math.round(p * 1000)); lRange.style.setProperty("--p", `${p * 100}%`);
  lWhen.textContent = live.atEnd ? "Now" : p < 0.005 ? "Start" : now - t < 60e3 ? `${Math.max(1, Math.round((now - t) / 1e3))} s ago` : agoText(t, now);
  if (now - live.ticksAt > 4000) drawTicks();
  const fresh = []; let changed = false;
  for (const c of live.touched) {
    const e = entryAt(c, t), was = c.deal, wasAt = c.dealAt;
    applyEntry(c, e);
    if (c.deal !== was || c.dealAt !== wasAt) { changed = true; if (e && e.at > live.tPrev && e.at <= t) fresh.push(c); }
  }
  live.tPrev = t;
  if (fresh.length === 1) { if (user || live.playing) tick(3); showArrival(fresh[0], Boolean(fresh[0].dealWas)); }
  else if (changed) { if (lifted && !state.focus) layoutAll(); drawList(); }
  liveCount(); syncBadge(); kick();
}
function playLive(fromStart = false) {
  stopLive();
  if (!live.log.length) return;
  const from = fromStart || live.atEnd ? live.t0 : live.t;
  const stops = [...live.log.map((a) => a.at).filter((at) => at > from), Infinity];
  const P = { from, stops, i: 0, t0: performance.now(), dur: reduced ? 1 : clamp(14000 / stops.length, 500, 1400) };
  live.playing = P; live.quick = P.dur < 1000;
  lPlay.setAttribute("aria-label", "Pause"); lPlay.innerHTML = PAUSE_SVG;
  const at = (i) => (P.stops[i] === Infinity ? Date.now() : P.stops[i]);
  if (reduced) { // no tween: each arrival a beat apart
    const step = () => { if (live.playing !== P) return; setLT(at(P.i)); P.i++; if (P.i < P.stops.length) P.timer = setTimeout(step, 700); else stopLive(); };
    setLT(from); P.timer = setTimeout(step, 400); return;
  }
  setLT(from);
  const run = (pn) => {
    if (live.playing !== P) return;
    const a = P.i ? at(P.i - 1) : P.from, b = at(P.i);
    const k = clamp((pn - P.t0) / P.dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    setLT(a + (b - a) * e);
    if (k < 1) requestAnimationFrame(run);
    else { P.i++; P.t0 = pn; if (P.i < P.stops.length) requestAnimationFrame(run); else stopLive(); }
  };
  requestAnimationFrame(run);
}
function stopLive() {
  if (live.playing?.timer) clearTimeout(live.playing.timer);
  live.playing = null; live.quick = false;
  lPlay.setAttribute("aria-label", "Replay the deals that arrived"); lPlay.innerHTML = PLAY_SVG;
}
lPlay.onclick = () => (live.playing ? stopLive() : playLive());
lRange.addEventListener("input", () => { stopLive(); setLT(live.t0 + (Date.now() - live.t0) * Number(lRange.value) / 1000, { user: true }); });
