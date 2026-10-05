// ---------- after the handshake: the trade lives in the wall ----------
// Shake hands and the table closes, but the cards stay in play where they sit: the ones you offered (and the ones you
// asked for, as pockets) wear a small gold tag, lean a few pixels toward the Trade lens button, and a thin gold thread
// runs from each to it. A reply arrives the way a deal does (round 12): the cards flash gold, the panel header beats
// "Maya accepted", a gold line races to Trade, which counts it. On an acceptance the cards cross in the wall itself:
// yours lift out through the top edge, hers fly in from it and land in their pockets with the marking flood and the
// ripple. On a counter her hand reaches in: a card she left out settles back to rest, one she added flies in wearing
// "Maya offers", and a strip above the lens bar asks Accept or Not this time. A decline is one line. Press and hold
// any card in play and the trade reads out in one line. The other side is simulated and seeded (the shared rule for
// round 13): twelve seconds after a proposal, by h32(`${t.id}|${rec.at}|reply`).

const REPLY_MS = 12000, LEAN = 6, TAG_W = 44;
const PRONOUN = { maya: ["her", "her"], theo: ["his", "him"], jun: ["their", "them"], priya: ["her", "her"] };
for (const t of TRADERS) [t.pro, t.obj] = PRONOUN[t.id] || ["their", "them"];
const traderOf = (id) => TRADERS.find((t) => t.id === id);
const cardById = new Map(cards.map((c) => [c.id, c]));
const cardsOf = (ids) => (ids || []).map((id) => cardById.get(id)).filter(Boolean);
const names = (list) => list.map((c) => c.name).join(", ").replace(/, ([^,]*)$/, " and $1");
const tradeLine = (rec, t) => `your ${names(cardsOf(rec.give))} for ${t.pro} ${names(cardsOf(rec.get))}`;
const tradeBtn = lensBox.querySelector('[data-lens="trade"]');
const xbadge = document.createElement("i"); xbadge.className = "lbadge xbadge"; xbadge.hidden = true; xbadge.setAttribute("aria-hidden", "true"); tradeBtn.append(xbadge);
const persistSpares = () => { try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* private mode */ } };

// ----- what's in play: every card of every open trade, keyed by card -----
const play = new Map(); // card -> { rec, t, side: "give" | "get", offer }
const leaning = new Set(); // cards whose lean is still settling (in play, or just out of it)
const inFlight = new Set(); // cards mid-flight: not tagged until they land
let cross = null; // the crossing in progress: { rec, t, n, give, get }
const flights = []; // { c, out, edge, slot, t0, dur, then }
let xline = null, xlast = 0;
function syncPlay() {
  play.clear();
  for (const rec of trades) {
    if (rec.state !== "proposed" && rec.state !== "countered") continue;
    const t = traderOf(rec.t); if (!t) continue;
    for (const c of cardsOf(rec.give)) if (!inFlight.has(c)) play.set(c, { rec, t, side: "give" });
    for (const c of cardsOf(rec.get)) if (!inFlight.has(c)) play.set(c, { rec, t, side: "get", offer: rec.reply?.add === c.id });
  }
  for (const c of play.keys()) { c.leanK ??= 0; leaning.add(c); }
  syncXBadge(); syncXBar(); kick();
}
// Where the card's tile is on screen right now, or null if it isn't drawn (a folded panel, another set open).
function playRect(c) {
  if (view === "mosaic") return c.m ? mr(c.m) : null; // a folded panel's hairline counts: the card shrinks into the fold
  if (view === "set" && state.g === groups[c.g]) return binderRect(c, cam);
  return null;
}
// The Trade lens button: the threads run to it and the cards lean toward it. Read only while the bar is up.
let xbp = { x: 0, y: 0 }, xbpAt = -1e9;
function xBtn() {
  const now = performance.now();
  if (now - xbpAt > 250 && lensShown()) { const b = tradeBtn.getBoundingClientRect(); if (b.width) { xbp = { x: b.left + b.width / 2, y: b.top + 2 }; xbpAt = now; } }
  if (xbpAt < 0) xbp = { x: vw / 2 + 90, y: vh - botPad() + 16 };
  return xbp;
}
function leanOf(c, sx, sy, w, h) {
  if (reduced || tbl.on) return [0, 0];
  const b = xBtn(), dx = b.x - (sx + w / 2), dy = b.y - (sy + h / 2), d = Math.hypot(dx, dy) || 1, k = LEAN * c.leanK;
  return [dx / d * k, dy / d * k];
}

// ----- the tile: the base tile, then the gold (a reply's flash and ripple), the lean and the tag -----
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  const inPlay = play.size > 0 && c.leanK > 0;
  if (inPlay) { const [ox, oy] = leanOf(c, sx, sy, w, h); sx += ox; sy += oy; }
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  drawTile0(c, sx, sy, w, h, now, mult);
  if (state.lens === "need" && !c.owned && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
    ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
  }
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint >= 0.01 && c.e >= 0.05) {
    const a = Math.min(1, mult) * c.e;
    ctx.fillStyle = col; ctx.globalAlpha = a * tint;
    if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
    if (fp) { const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col; rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (inPlay && w >= 5 && c.e > 0.3 && play.has(c)) drawPlayTag(c, sx, sy, w, h, Math.min(1, mult) * c.e * c.leanK);
}
// The tag: a gold hairline round the tile, a gold corner when it's too small to read, "In play" when it isn't. On a
// wide tile (a spare or feed tile out in front) the tag sits on the card itself.
function drawPlayTag(c, sx, sy, w, h, a) {
  const p = play.get(c), wide = w > h * 1.05;
  ctx.globalAlpha = a; ctx.strokeStyle = theme.gold; ctx.fillStyle = theme.gold;
  if (!wide) { ctx.lineWidth = clamp(w * 0.06, 1, 2.5); rr(sx + 0.5, sy + 0.5, w - 1, h - 1, Math.min(w * 0.09, 12)); ctx.stroke(); }
  const pad = wide ? Math.max(8, w * 0.05) : 0, cw = wide ? (h - pad * 2) * TW / TH : w;
  if (cw >= TAG_W && h >= 24) {
    const txt = p.side === "give" ? (cw >= 96 ? `In play, ${p.t.name}` : "In play") : p.offer ? `${p.t.name} offers` : `From ${p.t.name}`;
    font(700, 9); const s = fitText(txt, cw - 12), tw = textW(s) + 10, x = sx + pad + 3, y = sy + pad + 3;
    rr(x, y, tw, 15, 4); ctx.fill();
    ctx.fillStyle = theme.dark ? "#1A1406" : "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x + 5, y + 11);
  } else if (w >= 10) { const s = clamp(w * 0.18, 3, 7); rr(sx + 1.5, sy + 1.5, s, s, 1); ctx.fill(); }
  ctx.globalAlpha = 1;
}
// The panel header's beat can be gold (a reply) as well as green (a deal).
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
  if (g.beat) { const p = (now - g.beat.t0) / 3000; if (p < 1) beat = { text: g.beat.text, col: g.beat.col || theme.deal, a: Math.min(1, p * 10, (1 - p) * 4) }; else g.beat = null; }
  font(beat ? 700 : 600, size * 0.82);
  const stat = beat ? fitText(beat.text, w * 0.72) : panelStat(g), sw = stat ? textW(stat) + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw), x, m.y + PG + 22);
  if (stat) {
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? beat.col : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, x + w, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha;
  }
  const owned = ownedNow(g.cards), n = g.cards.length;
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  ctx.globalAlpha = 1;
}
// So can the open set's header beat.
function drawLive(now) {
  if (now >= live.until && !live.line) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
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
    else if (p > 0) drawRace(L, p, theme.deal);
  }
  return now < live.until || Boolean(live.line);
}
// A line racing from a card to a lens button (the round 12 line, in either colour).
function drawRace(L, p, col) {
  const u = Math.max(0, p * 1.3 - 0.3), v = Math.min(1, p * 1.3);
  const q = (t) => { const s = 1 - t; return [s * s * L.x0 + 2 * s * t * L.cx + t * t * L.x1, s * s * L.y0 + 2 * s * t * L.cy + t * t * L.y1]; };
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) { const [px, py] = q(u + (v - u) * i / 14); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
  ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = col; ctx.stroke();
  const [hx, hy] = q(v); ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
  ctx.globalAlpha = 1; ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}

// ----- the overlay: threads, the reply's line, and the cards in flight (drawn after the chips each frame) -----
function drawTraders(now) {
  if (strip && view === "mosaic" && state.lens === "trade") {
    const T = state.trans;
    let alpha = 1;
    if (T?.kind === "morph") alpha = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1));
    else if (T?.kind === "open") alpha = 1 - T.q;
    else if (T) alpha = 0;
    if (tbl.on) alpha *= 1 - tbl.q;
    if (alpha > 0.01) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); for (const ch of strip.chips) drawChip(ch, now, alpha); }
  }
  if (drawPlay(now)) kick();
}
function drawPlay(now) {
  const dt = Math.min(48, now - (xlast || now)); xlast = now;
  let more = false;
  for (const c of leaning) {
    const t = play.has(c) ? 1 : 0;
    if (Math.abs(c.leanK - t) > 0.01) { c.leanK += (t - c.leanK) * Math.min(1, dt / 160); more = true; }
    else { c.leanK = t; if (!t) leaning.delete(c); }
  }
  if (!play.size && !flights.length && !xline) return more;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const shown = lensShown() && !state.trans && (view === "mosaic" || view === "set");
  if (shown && play.size && !reduced) {
    const b = xBtn();
    ctx.lineWidth = 1; ctx.strokeStyle = theme.gold; ctx.fillStyle = theme.gold;
    for (const [c] of play) {
      if (c.leanK <= 0.02) continue;
      const r = playRect(c); if (!r || r.h <= 2) continue;
      const off = r.y > vh - botPad() || r.y + r.h < topPad(); // beyond the fold: a stub from the edge still points to it
      const [ox, oy] = leanOf(c, r.x, r.y, r.w, r.h), cx = r.x + r.w / 2 + ox, cy = off ? clamp(r.y + r.h / 2, topPad() + 4, vh - botPad() - 4) : r.y + r.h + oy;
      ctx.globalAlpha = (off ? 0.3 : 0.45) * c.leanK * c.e;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (xline) {
    const p = (now - xline.t0) / 640;
    if (p >= 1) xline = null; else { if (p > 0) drawRace(xline, p, theme.gold); more = true; }
  }
  if (flights.length) {
    const value = state.value && !state.matches, landed = [];
    for (const f of flights) {
      const p = clamp((now - f.t0) / f.dur, 0, 1);
      if (p <= 0) { more = true; continue; }
      const slot = f.slot() || f.last; f.last = slot;
      if (!slot) { landed.push(f); continue; } // its tile left the screen (another set opened): it just arrives
      const big = { x: slot.x + (slot.w - f.edge.w) / 2, y: slot.y + (slot.h - f.edge.h) / 2, w: f.edge.w, h: f.edge.h };
      const from = f.out ? slot : f.edge, mid = f.out ? big : big, to = f.out ? f.edge : slot, e = ease(p);
      // the card grows to a readable size as it leaves its pocket, and shrinks into one as it lands
      const r = p < 0.5 ? lerpR(from, { ...mid, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }, e * 2) : lerpR({ ...mid, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }, to, (e - 0.5) * 2);
      r.x += Math.sin(Math.PI * p) * (f.out ? 14 : -14);
      ctx.globalAlpha = f.out ? 1 - Math.max(0, p - 0.7) / 0.3 : Math.min(1, p * 4);
      foilOff = true; drawCardAt(f.c, r, now, value, 4 + 10 * Math.sin(Math.PI * p)); foilOff = false;
      if (p >= 1) landed.push(f); else more = true;
    }
    for (const f of landed) { flights.splice(flights.indexOf(f), 1); inFlight.delete(f.c); f.then?.(); }
    ctx.globalAlpha = 1;
  }
  return more;
}
// A card leaves through the top edge (out), or arrives from it. With motion reduced it simply happens.
function flyCard(c, out, t0, dur, then) {
  const r = playRect(c);
  if (reduced || document.body.classList.contains("listmode")) { then?.(); return; }
  if (!r) { setTimeout(() => then?.(), Math.max(0, t0 - performance.now()) + dur); return; }
  const h = Math.max(72, Math.min(r.h, 120)), w = h * TW / TH;
  const at = () => { const q = playRect(c); if (!q) return null; if (q.h > 24 && q.w > q.h * 1.05) { const pad = Math.max(8, q.w * 0.05); return { x: q.x + pad, y: q.y + pad, w: (q.h - pad * 2) * TW / TH, h: q.h - pad * 2 }; } return q; };
  const from = at(), slot = out ? () => from : at; // leaving, it keeps the pocket it left; arriving, it follows the pocket as the wall settles
  inFlight.add(c);
  flights.push({ c, out, edge: { x: r.x + r.w / 2 - w / 2, y: -h - 30, w, h }, slot, last: null, t0, dur, then });
  kick();
}

// ----- the other side answers (simulated, seeded; the shared rule this round) -----
const timers = new Map(); // record -> timer
const busy = () => Boolean(state.trans || shuffle || tbl.on || gesture || fly || inertia || pop.c || paying() || cross || flights.length || wel.on || state.press);
function syncTrades() {
  for (const rec of trades) {
    rec.state ||= "proposed";
    if (rec.state === "proposed" && !timers.has(rec)) timers.set(rec, setTimeout(() => tryReply(rec), Math.max(400, rec.at + REPLY_MS - Date.now())));
  }
  syncPlay();
}
function tryReply(rec) {
  timers.delete(rec);
  if (!trades.includes(rec) || rec.state !== "proposed") return;
  if (busy()) { timers.set(rec, setTimeout(() => tryReply(rec), 600)); return; } // never on a moving wall
  reply(rec);
}
function reply(rec) {
  const t = traderOf(rec.t), r = h32(`${t.id}|${rec.at}|reply`), give = cardsOf(rec.give);
  rec.reply = { at: Date.now() };
  let kind = "decline";
  if (r < 0.45) kind = "accept";
  else if (r < 0.8) {
    // A counter shifts the deal by one card: one of yours left out, or one more of theirs you chase put in.
    const pick = h32(`${t.id}|${rec.at}|pick`), more = offersOf(t).filter((c) => !rec.get.includes(c.id));
    const canDrop = give.length > 1, canAdd = more.length > 0;
    if ((pick < 0.5 && canDrop) || (!canAdd && canDrop)) { const d = give[Math.floor(h32(`${t.id}|${rec.at}|drop`) * give.length)]; rec.reply.drop = d.id; rec.give = rec.give.filter((id) => id !== d.id); kind = "counter"; }
    else if (canAdd) { const a = more[Math.floor(h32(`${t.id}|${rec.at}|add`) * more.length)]; rec.reply.add = a.id; rec.get = [...rec.get, a.id]; kind = "counter"; }
    else kind = "accept";
  }
  if (kind === "decline") {
    const extra = wantsOf(t).filter((c) => !rec.give.includes(c.id));
    rec.reply.reason = extra.length ? `I'd want the ${extra[Math.floor(h32(`${t.id}|${rec.at}|why`) * extra.length)].name} too.` : "Not this time, sorry.";
  }
  rec.state = kind === "accept" ? "accepted" : kind === "counter" ? "countered" : "declined";
  rec.seen = false; persistTrades();
  showReply(rec, kind);
}
// The reply lands in the wall: gold flash and ripple on the cards in play, the panel header beats it, a gold line
// races to Trade, which counts it. Then the cards do what the reply says.
function showReply(rec, kind) {
  const t = traderOf(rec.t), now = performance.now();
  const mine = cardsOf(kind === "counter" && rec.reply.drop ? [...rec.give, rec.reply.drop] : rec.give), theirs = cardsOf(kind === "counter" && rec.reply.add ? rec.get.filter((id) => id !== rec.reply.add) : rec.get);
  const all = [...mine, ...theirs], text = `${t.name} ${kind === "accept" ? "accepted" : kind === "counter" ? "countered" : "declined"}`;
  const gs = new Map();
  for (const c of all) { c.flash = { t0: now, gold: true }; if (!gs.has(groups[c.g])) gs.set(groups[c.g], c); }
  for (const [g, c] of gs) { if (!reduced) g.ripple = { t0: now, col: c.col, row: c.row, live: true, gold: true }; g.beat = { t0: now, text, col: theme.gold }; }
  const first = all[0];
  if (first) { live.beat = { t0: now, text, g: groups[first.g], col: theme.gold }; live.until = Math.max(live.until, now + 3200); }
  if (lensShown() && !reduced && first) {
    const a = tileStart(first), b = xBtn();
    xline = { t0: now + 120, x0: a.x, y0: a.y, cx: b.x, cy: a.y + (b.y - a.y) * 0.35, x1: b.x, y1: b.y };
    setTimeout(glowTrade, 640);
  } else glowTrade();
  tick(kind === "accept" ? 14 : 8); drawList(); kick();
  if (kind === "accept") setTimeout(() => startCross(rec), reduced ? 0 : 900);
  else if (kind === "counter") {
    const add = rec.reply.add ? cardById.get(rec.reply.add) : null;
    if (add) { inFlight.add(add); syncPlay(); flyCard(add, false, now + 500, 760, () => { tick(6); syncPlay(); }); }
    else syncPlay(); // the card she left out settles back to rest
  } else { syncPlay(); toast(`${t.name} declined. "${rec.reply.reason}"`); }
}
// Accepting completes the trade in the wall: yours lift out through the top edge (and leave your collection, no longer
// spares), hers fly in from it and land in their pockets (yours now, dated today, off your chase list), one relayout
// at the end, and a toast says what changed hands.
function startCross(rec) {
  if (!trades.includes(rec) || cross) return;
  const t = traderOf(rec.t), give = cardsOf(rec.give).filter((c) => c.owned), get = cardsOf(rec.get).filter((c) => !c.owned);
  rec.state = "accepted"; persistTrades();
  cross = { rec, t, give, get, n: give.length + get.length };
  syncPlay();
  const now = performance.now(), L = lifted, step = () => { if (cross && --cross.n <= 0) finishCross(); };
  lifted = false; // one relayout when the crossing is done, not one per card
  give.forEach((c, i) => { setOwned(c, false, { quiet: true }); delete spares[c.id]; if (L) c.away = true; flyCard(c, true, now + i * 80, 720, step); });
  lifted = L; persistSpares();
  get.forEach((c, i) => flyCard(c, false, now + 260 + i * 80, 780, () => {
    const L2 = lifted; lifted = false; setOwned(c, true, { quiet: true }); lifted = L2;
    delete chasing[c.id]; persistChase();
    step();
  }));
  if (!cross.n) finishCross();
}
function finishCross() {
  const { rec, t, give, get } = cross; cross = null;
  rec.state = "done"; rec.done = Date.now(); persistTrades();
  for (const c of give) c.away = false;
  if (lifted) liftLayout(true);
  syncPlay(); drawList(); updateCount(); tick(14);
  toast(give.length && get.length ? `Traded with ${t.name}: your ${names(give)} for ${t.pro} ${names(get)}.` : `Traded with ${t.name}.`);
}
function passCounter(rec) {
  if (rec.state !== "countered") return;
  rec.state = "declined"; rec.reply.by = "you"; rec.seen = true; persistTrades();
  const t = traderOf(rec.t);
  syncPlay(); drawList(); tick(6);
  toast(`Not this time. ${t.name}'s cards go back.`, () => { rec.state = "countered"; delete rec.reply.by; persistTrades(); syncPlay(); drawList(); });
}

// ----- the Trade button counts replies; a strip above the lens bar asks about a counter -----
function syncXBadge() {
  let n = 0;
  for (const r of trades) if (r.state === "countered" || (r.seen === false && r.state !== "proposed")) n++;
  xbadge.textContent = n > 99 ? "99+" : String(n); xbadge.hidden = !n;
  if (n) tradeBtn.setAttribute("aria-label", `Trade, ${n} ${n === 1 ? "reply" : "replies"}`); else tradeBtn.removeAttribute("aria-label");
}
function glowTrade() {
  syncXBadge();
  tradeBtn.classList.remove("xglow"); void tradeBtn.offsetWidth; tradeBtn.classList.add("xglow");
  clearTimeout(glowTrade.t); glowTrade.t = setTimeout(() => tradeBtn.classList.remove("xglow"), 1100);
}
function markSeen() { let ch = false; for (const r of trades) if (r.seen === false && r.state !== "countered") { r.seen = true; ch = true; } if (ch) persistTrades(); syncXBadge(); }
tradeBtn.addEventListener("click", markSeen);
document.body.insertAdjacentHTML("beforeend", `<div class="xbar glass" id="xbar" role="group" aria-label="A counter offer" hidden><div class="mtext" aria-live="polite"><b id="x-head"></b><span id="x-sub"></span></div><div class="xacts"><button type="button" class="mbtn" id="x-no">Not this time</button><button type="button" class="mbtn primary" id="x-yes">Accept</button></div></div>`);
const xbar = document.getElementById("xbar"), xHead = document.getElementById("x-head"), xSub = document.getElementById("x-sub");
const pendingCounter = () => trades.filter((r) => r.state === "countered").pop() || null;
function syncXBar() {
  const rec = pendingCounter();
  xbar.hidden = !rec;
  if (!rec) return;
  const t = traderOf(rec.t), give = cardsOf(rec.give), get = cardsOf(rec.get);
  xHead.textContent = `${t.name} countered`;
  xSub.textContent = `${rec.reply?.drop ? `Left out your ${cardById.get(rec.reply.drop)?.name || "card"}` : `Added ${t.pro} ${cardById.get(rec.reply?.add)?.name || "card"}`}: your ${names(give)} for ${t.pro} ${names(get)}. ${balanceText(get, give, t)}.`;
}
document.getElementById("x-yes").onclick = () => { const rec = pendingCounter(); if (rec) { tick(10); startCross(rec); } };
document.getElementById("x-no").onclick = () => { const rec = pendingCounter(); if (rec) passCounter(rec); };

// ----- press and hold a card in play: the trade in one line -----
let xpress = null;
function playAt(sx, sy) {
  if (!play.size || tbl.on || pop.c || state.trans) return null;
  for (const c of play.keys()) { const r = playRect(c); if (r && r.w >= 8 && r.h > 2 && sx >= r.x - 2 && sx <= r.x + r.w + 2 && sy >= r.y - 2 && sy <= r.y + r.h + 2) return c; }
  return null;
}
function tellTrade(c) {
  const p = play.get(c); if (!p) return;
  const { rec, t } = p, line = tradeLine(rec, t);
  if (rec.state === "countered") toast(`${t.name} countered: ${line}. Accept or not, below.`);
  else toast(`Offered to ${t.name} ${agoText(rec.at, Date.now())}: ${line}. Waiting on ${t.obj}.`);
}
function xPressStart(x, y) {
  const c = playAt(x, y); if (!c) return;
  xpress = { c, x, y, timer: setTimeout(() => { xpress = null; cancelPress(); gesture = null; tick(8); tellTrade(c); }, 400) };
}
function xPressEnd() { if (xpress) { clearTimeout(xpress.timer); xpress = null; } }
document.addEventListener("touchstart", (e) => { if (e.target !== canvas || e.touches.length !== 1) { xPressEnd(); return; } xPressStart(e.touches[0].clientX, e.touches[0].clientY); }, { capture: true, passive: true });
document.addEventListener("touchmove", (e) => { if (xpress && e.touches.length && Math.hypot(e.touches[0].clientX - xpress.x, e.touches[0].clientY - xpress.y) > 8) xPressEnd(); }, { capture: true, passive: true });
for (const type of ["touchend", "touchcancel"]) document.addEventListener(type, xPressEnd, { capture: true, passive: true });
canvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") xPressStart(e.clientX, e.clientY); });
canvas.addEventListener("pointermove", (e) => { if (xpress && e.pointerType === "mouse" && Math.hypot(e.clientX - xpress.x, e.clientY - xpress.y) > 8) xPressEnd(); });
for (const type of ["pointerup", "pointercancel"]) canvas.addEventListener(type, (e) => { if (e.pointerType === "mouse") xPressEnd(); });

// ----- the trader's chip reads the state of the trade -----
function drawChip(ch, now, alpha) {
  const t = ch.t, x = ch.x, y = ch.y - mScroll, w = ch.w, h = ch.h;
  if (y > vh || y + h < 0) return;
  const wants = wantsOf(t).length, has = offersOf(t).length, prop = proposedTo(t);
  ctx.globalAlpha = alpha;
  rr(x, y, w, h, 12); ctx.fillStyle = theme.panelFill; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (state.press?.chip === ch) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x + 27, y + h / 2, 16, 0, Math.PI * 2); ctx.fillStyle = t.ink; ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; font(800, 15); ctx.fillText(t.name[0], x + 27, y + h / 2 + 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tx = x + 51, tw = w - 51 - 16;
  ctx.fillStyle = theme.ink; font(800, 15, true); ctx.fillText(fitText(t.name, tw), tx, y + 23);
  ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText(fitText(t.where, tw), tx, y + 39);
  font(700, 12, true);
  if (prop) {
    const g = prop.give.length, n = prop.get.length, s = prop.state;
    const line = s === "proposed" ? `Offered ${g} for ${n}, waiting` : s === "countered" ? `Countered: ${g} for ${n}` : s === "accepted" ? "Accepted, crossing" : s === "done" ? `Traded ${g} for ${n}` : prop.reply?.by === "you" ? "You passed" : "Declined";
    ctx.fillStyle = s === "declined" ? theme.muted : s === "countered" || s === "proposed" ? theme.gold : theme.deal;
    ctx.fillText(fitText(line, tw), tx, y + 55);
  }
  else if (wants) { ctx.fillStyle = theme.gold; ctx.fillText(fitText(`Wants ${wants} of yours`, tw), tx, y + 55); }
  else { ctx.fillStyle = theme.deal; ctx.fillText(fitText(`Has ${has} you chase`, tw), tx, y + 55); }
  ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + w - 14, y + h / 2 - 5); ctx.lineTo(x + w - 9, y + h / 2); ctx.lineTo(x + w - 14, y + h / 2 + 5); ctx.stroke(); ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
}
// Shake hands: the record starts as proposed, and the reply is on its way.
function shake() {
  if (!tbl.on || !tbl.give.length || !tbl.get.length || tbl.shake) return;
  const t = tbl.t, rec = { t: t.id, give: tbl.give.map((c) => c.id), get: tbl.get.map((c) => c.id), at: Date.now(), state: "proposed" };
  trades.push(rec); persistTrades(); syncTrades(); tick(24);
  toast(`Offered to ${t.name}: ${rec.give.length} of yours for ${rec.get.length} of ${t.name}'s. ${balanceText(tbl.get, tbl.give, t)}.`, () => { trades = trades.filter((x) => x !== rec); persistTrades(); syncTrades(); drawList(); kick(); });
  drawList();
  if (reduced) { closeTable(); return; }
  tbl.shake = { t0: performance.now(), dur: 520 }; updateTradeBar(); kick();
}
listEl.addEventListener("click", (e) => { if (e.target.closest("[data-trade]")) syncTrades(); }); // after the base's propose
listEl.addEventListener("click", (e) => {
  const y = e.target.closest("[data-xyes]"), n = e.target.closest("[data-xno]");
  if (y) { const rec = trades[Number(y.dataset.xyes)]; if (rec?.state === "countered") startCross(rec); }
  if (n) { const rec = trades[Number(n.dataset.xno)]; if (rec?.state === "countered") passCounter(rec); }
});

// ----- the list: a Trades section on top, with Accept and Decline on a counter -----
function tradeStatus(rec) {
  const t = traderOf(rec.t);
  if (rec.state === "proposed") return `Waiting on ${t.obj}`;
  if (rec.state === "countered") return `${rec.reply?.drop ? `${t.name} left out your ${cardById.get(rec.reply.drop)?.name || "card"}` : `${t.name} added ${t.pro} ${cardById.get(rec.reply?.add)?.name || "card"}`}. Accept or decline`;
  if (rec.state === "accepted") return "Accepted, cards crossing";
  if (rec.state === "done") return `Traded ${agoText(rec.done || rec.at, Date.now())}`;
  return rec.reply?.by === "you" ? "You passed" : `${t.name}: "${rec.reply?.reason || "Not this time."}"`;
}
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (trades.length) {
    const rows = trades.map((rec, i) => ({ rec, i })).filter((x) => traderOf(x.rec.t)).reverse().slice(0, 8);
    top = `<section><h2>Trades</h2><p class="lsub">What you've offered, what came back, and what changed hands.</p><ul>${rows.map(({ rec, i }) => {
      const t = traderOf(rec.t), give = cardsOf(rec.give), get = cardsOf(rec.get), label = { proposed: "offered", countered: "countered", accepted: "accepted", done: "traded", declined: "declined" }[rec.state];
      return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${label}</span><span class="lmeta">Your ${names(give)} (${money(sumOf(give))}) for ${t.pro} ${names(get)} (${money(sumOf(get))}).</span><span class="lprice">${balanceText(get, give, t)}</span><span class="lstate">${tradeStatus(rec)}</span></div>${rec.state === "countered" ? `<button type="button" class="pill-btn" data-xyes="${i}">Accept</button><button type="button" class="pill-btn" data-xno="${i}">Decline</button>` : ""}</li>`;
    }).join("")}</ul></section>`;
  }
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top += `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") {
    const ts = TRADERS.filter((t) => wantsOf(t).length).sort((a, b) => wantsOf(b).length - wantsOf(a).length);
    top += `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase.</p><ul>${ts.map((t) => {
      const want = wantsOf(t), has = offersOf(t), prop = proposedTo(t);
      return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">Wants ${names(want)} (${money(sumOf(want))}).${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${prop ? tradeStatus(prop) : ""}</span></div>${has.length ? `<button type="button" class="pill-btn" data-trade="${t.id}">Propose</button>` : ""}</li>`;
    }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
  }
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si], p = play.get(c);
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${p ? (p.side === "give" ? `In play, offered to ${p.t.name}` : `In play, ${p.t.name} offers it`) : c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

// Start: whatever was in play when you left is still in play, and replies that were due arrive shortly.
setTimeout(syncTrades, 0);
// Debug builds only: the tests' hook learns about the trades.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { trades: { get: () => trades }, play: { get: () => play }, cross: { get: () => cross }, flights: { get: () => flights }, isSpare: { value: isSpare }, isChase: { value: isChase }, syncTrades: { value: syncTrades }, reply: { value: reply } }); }, 0);
