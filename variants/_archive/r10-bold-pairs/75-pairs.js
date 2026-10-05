// ---------- pairs: the Trade lens leads with swaps, not spares ----------
// The unit of a trade is the pair: a spare of yours that another collector chases, joined to a spare of theirs that
// you chase. Trade lifts those pairs out in front inside their panels (the chase lift, generalised): your card flies
// out of its slot to the left of the tile, their card sits on the right as a chip in the collector's colour, the
// collector's name between, and a balance beam underneath that tips toward whoever comes out ahead. Tap the beam and
// the wall suggests a cheap spare (yours or theirs) to even it up; tap the tile to flip through the other pairs for
// the same spare; hold it, or tap Propose, to record the trade. Panels with no pairs fold. Nothing is sent anywhere.

// Other collectors, made up and seeded by name (the round's shared rule, so variants compare).
const TRADERS = [{ id: "maya", name: "Maya", where: "Sacramento" }, { id: "theo", name: "Theo", where: "Oakland" }, { id: "jun", name: "Jun", where: "Reno" }, { id: "priya", name: "Priya", where: "Davis" }];
const tOwns = (t, c) => h32(`${t.id}|o|${c.id}`) < 0.45;
const tSpare = (t, c) => tOwns(t, c) && h32(`${t.id}|s|${c.id}`) < 0.14;
const tChase = (t, c) => !tOwns(t, c) && h32(`${t.id}|c|${c.id}`) < 0.16;
const TRADER_INK = { maya: "#C9659D", theo: "#3D8BE8", jun: "#BF6E3E", priya: "#8A50BE" };
// What each collector chases and has spare never changes, so it's worked out once.
const T_CHASE = {}, T_SPARE = {};
for (const t of TRADERS) { T_CHASE[t.id] = new Set(); T_SPARE[t.id] = []; for (const c of cards) { if (tChase(t, c)) T_CHASE[t.id].add(c.id); if (tSpare(t, c)) T_SPARE[t.id].push(c); } }
const byId = new Map(cards.map((c) => [c.id, c]));
const traderOf = (id) => TRADERS.find((t) => t.id === id) || TRADERS[0];

// Proposed trades live on this device: { id, t, give: [card ids], get: [card ids], at }. The first card given leads.
let trades = [];
try { trades = JSON.parse(localStorage.getItem("wall-trades") || "[]"); if (!Array.isArray(trades)) trades = []; } catch { trades = []; }
const persistTrades = () => { try { localStorage.setItem("wall-trades", JSON.stringify(trades)); } catch { /* private mode */ } };
const tradeOf = (c) => trades.find((t) => t.give[0] === c.id) || null;
const promised = (c) => trades.some((t) => t.give.includes(c.id));
const asked = (tid, c) => trades.some((t) => t.t === tid && t.get.includes(c.id));
const tradeViews = new Map(); // trade id -> the pair-shaped view drawn for it

// ----- the pairs -----
// A pair: { mine, t, theirs, adds }. Adds are what Even it up put on: { c, mine, t0 }. Pair objects persist across
// relayouts (keyed by the three ids) so their adds and animations survive.
const pairStore = new Map();
function buildPairs(c) {
  const out = [];
  if (promised(c) && !tradeOf(c)) return out; // already thrown in on another trade
  for (const t of TRADERS) {
    if (!T_CHASE[t.id].has(c.id)) continue;
    for (const x of T_SPARE[t.id]) {
      if (!isChase(x) || asked(t.id, x)) continue;
      const key = `${c.id}|${t.id}|${x.id}`;
      let p = pairStore.get(key);
      if (!p) { p = { key, mine: c, t, theirs: x, adds: [] }; pairStore.set(key, p); }
      p.adds = p.adds.filter((a) => (a.mine ? isSpare(a.c) && !promised(a.c) : !asked(t.id, a.c)));
      out.push(p);
    }
  }
  // Closest in value first, then the more valuable of theirs.
  out.sort((a, b) => Math.abs(a.theirs.price - c.price) - Math.abs(b.theirs.price - c.price) || b.theirs.price - a.theirs.price);
  return out;
}
const giveOf = (p) => p.mine.price + p.adds.reduce((s, a) => s + (a.mine ? a.c.price : 0), 0);
const getOf = (p) => p.theirs.price + p.adds.reduce((s, a) => s + (a.mine ? 0 : a.c.price), 0);
const amt = (v) => (v >= 1000 ? short(v) : money(v));
const verdict = (d) => (Math.abs(d) < 0.005 ? "Even." : d > 0 ? `Up ${amt(d)}.` : `Down ${amt(-d)}.`);
const balance = (give, get) => `You give ${amt(give)}, get ${amt(get)}. ${verdict(get - give)}`;
const tolOf = (give, get) => Math.max(0.25, Math.max(give, get) * 0.08); // within a quarter, or 8%, is even enough
// The pair a spare's tile is showing: its proposed trade, or the one you've flipped to.
function currentPair(c) {
  const tr = tradeOf(c);
  if (tr) {
    let v = tradeViews.get(tr.id);
    if (!v) {
      const give = tr.give.map((id) => byId.get(id)).filter(Boolean), get = tr.get.map((id) => byId.get(id)).filter(Boolean);
      if (!give.length || !get.length) return null;
      v = { mine: give[0], t: traderOf(tr.t), theirs: get[0], adds: [...give.slice(1).map((x) => ({ c: x, mine: true })), ...get.slice(1).map((x) => ({ c: x, mine: false }))], trade: tr, joinT0: 0 };
      tradeViews.set(tr.id, v);
    }
    return v;
  }
  const ps = c.pairs || [];
  if (!ps.length) return null;
  c.pi = clamp(c.pi | 0, 0, ps.length - 1);
  return ps[c.pi];
}

// ----- layout: Trade lifts pairs the way Chase lifts chased cards -----
let liftKind = null; // which lens the lifted layout leads with: "chase", "trade", or null
const LIFT_LENS = { chase: true, trade: true };
const PAIR_H = 156, PAIR_MIN_W = 300, CARD_H = 84, CARD_W = Math.round(CARD_H * TW / TH), ADD_W = 44, ADD_H = Math.round(ADD_W * TH / TW), PAD = 10;
const pairCols = (w) => clamp(Math.floor((w + TILE_GAP) / (PAIR_MIN_W + TILE_GAP)), 1, 3);
const pairOrder = (a, b) => b.price - a.price || a.i - b.i;
function layoutAll() { lifted = Boolean(LIFT_LENS[state.lens]); liftKind = lifted ? state.lens : null; for (const g of groups) orderGroup(g); groups.forEach(binderLayout); if (lifted) liftedLayout(); else mosaicLayout(); }
function orderGroup(g) {
  g.base ||= g.cards;
  let lead = [];
  if (liftKind === "chase") lead = g.base.filter(isChase).sort(chaseOrder);
  else if (liftKind === "trade") {
    for (const c of g.base) if (isSpare(c)) c.pairs = buildPairs(c);
    lead = g.base.filter((c) => isSpare(c) && (tradeOf(c) || c.pairs.length)).sort(pairOrder);
  }
  g.lead = lead;
  const out = new Set(lead);
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !out.has(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; c.pair = null; });
  for (const c of lead) c.lift = 1;
}
function liftedH(g, w) {
  const inner = w - PG * 2 - 12;
  let tiles;
  if (liftKind === "trade") tiles = Math.ceil(g.lead.length / pairCols(inner)) * (PAIR_H + TILE_GAP);
  else { const cols = feedCols(inner), tw = (inner - TILE_GAP * (cols - 1)) / cols, th = Math.round(tw * 0.64); tiles = Math.ceil(g.lead.length / cols) * (th + TILE_GAP); }
  const rest = g.cards.length - g.lead.length;
  const rc = Math.max(1, Math.floor(inner / REST)), rr = Math.ceil(rest / rc);
  return PG + LABEL + tiles + (rest ? 6 + rr * (REST * TH / TW) : 0) + PG + 6;
}
function packLifted(g) {
  const inner = innerOf(g.m), n = g.lead.length;
  let cols, tw, th;
  if (liftKind === "trade") { cols = pairCols(inner.w); tw = (inner.w - TILE_GAP * (cols - 1)) / cols; th = PAIR_H; }
  else { cols = feedCols(inner.w); tw = (inner.w - TILE_GAP * (cols - 1)) / cols; th = Math.round(tw * 0.64); }
  const rows = Math.ceil(n / cols);
  g.cards.forEach((c, k) => {
    if (k < n) {
      const x = inner.x + (k % cols) * (tw + TILE_GAP), y = inner.y + Math.floor(k / cols) * (th + TILE_GAP);
      if (liftKind === "trade") { c.pair = { x, y, w: tw, h: th }; c.m = { x: x + PAD, y: y + PAD, w: CARD_W, h: CARD_H }; } // your card, out of its slot, on the left of the pair
      else c.m = { x, y, w: tw, h: th };
      return;
    }
    const j = k - n, rc = Math.max(1, Math.floor(inner.w / REST)), cw = inner.w / rc, ch = REST * TH / TW;
    c.m = { x: inner.x + (j % rc) * cw, y: inner.y + rows * (th + TILE_GAP) + 6 + Math.floor(j / rc) * ch, w: cw * 0.86, h: ch - cw * 0.14 * TH / TW };
  });
}
// force: what's lifted changed while it is out, so the layout flies to its new shape. A change of lens between Chase
// and Trade flies too (different cards lead).
function liftLayout(force = false) {
  const want = Boolean(LIFT_LENS[state.lens]), kind = want ? state.lens : null;
  if (want === lifted && kind === liftKind && !(force && lifted)) { layoutAll(); return; }
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
// A trade came or went: relayout, and fly only if a tile appeared or disappeared.
function reflowPairs() {
  if (!lifted || liftKind !== "trade" || view === "set" || state.trans) { if (lifted) liftLayout(true); else layoutAll(); kick(); return; }
  const key = () => groups.map((g) => g.lead.map((c) => c.id).join()).join("|");
  const before = key();
  for (const c of cards) c.pm = { ...c.m };
  for (const g of groups) g.pm = { ...g.m };
  layoutAll();
  if (before === key()) { for (const g of groups) g.pm = null; kick(); return; }
  for (const g of groups) { g.ripple = null; g.burst = 0; }
  for (const c of cards) c.delay = reduced ? 0 : Math.min(400, (c.lift ? 0 : 90) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: performance.now(), dur: reduced ? 1 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
function setLens(lens) {
  if (lens === state.lens) return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (was === "chase") closePop(true);
  liftLayout(); drawList(); updateCount(); kick();
  if (lens === "have") { const n = cards.filter((c) => c.owned).length; toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection`); }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  if (lens === "chase") { const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length; toast(n ? `${n} on your chase list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your chase list yet. Open a card and choose Chase it."); }
  if (lens === "trade") {
    const leads = groups.flatMap((g) => g.lead), prop = leads.filter(tradeOf).length, open = leads.length - prop;
    const who = new Set(leads.flatMap((c) => [...c.pairs.map((p) => p.t.id), ...(tradeOf(c) ? [tradeOf(c).t] : [])])).size;
    toast(leads.length ? `${open} swap${open === 1 ? "" : "s"} on the table with ${who} collector${who === 1 ? "" : "s"}${prop ? `, ${prop} proposed` : ""}` : "No swaps yet: nobody is after your spares, or you aren't chasing theirs.");
  }
}
function panelStat(g) {
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(c)).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") {
    const k = (g.lead || []).length, prop = (g.lead || []).filter(tradeOf).length, open = k - prop;
    if (k) return [open ? `${open} swap${open === 1 ? "" : "s"}` : "", prop ? `${prop} proposed` : ""].filter(Boolean).join(", ");
    const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}, no takers` : "";
  }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}

// ----- drawing the pair tiles (behind the cards, with the panel) -----
let goldKey = "", goldVal = "";
function goldTint() { const k = theme.slot + theme.gold; if (k !== goldKey) { goldKey = k; goldVal = mix(theme.slot, theme.gold, theme.dark ? 0.14 : 0.1); } return goldVal; }
const inR = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Where everything in a tile sits right now (screen coordinates). A proposed pair's chip slides over to join your card.
function pairParts(c, p, now) {
  const P = mr(c.pair);
  const card = { x: P.x + PAD, y: P.y + PAD, w: CARD_W, h: CARD_H };
  const mine = p.adds.filter((a) => a.mine), theirs = p.adds.filter((a) => !a.mine);
  const addsW = (n) => (n ? 6 + ADD_W + (n - 1) * 10 : 0);
  const rightX = P.x + P.w - PAD - CARD_W, joinedX = card.x + CARD_W + addsW(mine.length) + addsW(theirs.length) + 6;
  let k = p.trade ? 1 : 0;
  if (p.trade && p.joinT0 && !reduced) { k = ease(clamp((now - p.joinT0) / 460, 0, 1)); if (k < 1) pairMore = true; }
  const chip = { x: rightX + (joinedX - rightX) * k, y: card.y, w: CARD_W, h: CARD_H };
  const mineAdds = mine.map((a, i) => ({ a, x: card.x + CARD_W + 6 + i * 10, y: card.y + CARD_H - ADD_H, w: ADD_W, h: ADD_H }));
  const theirAdds = theirs.map((a, i) => ({ a, x: chip.x - 6 - ADD_W - i * 10, y: card.y + CARD_H - ADD_H, w: ADD_W, h: ADD_H }));
  const left = p.trade ? chip.x + CARD_W + 10 : card.x + CARD_W + addsW(mine.length) + 10;
  const right = p.trade ? P.x + P.w - PAD : chip.x - addsW(theirs.length) - 10;
  const mid = { x: left, y: card.y, w: Math.max(40, right - left) };
  const pill = { x: mid.x, y: card.y + CARD_H - 26, w: Math.min(100, mid.w), h: 26 };
  const beam = { x: P.x + PAD + 30, y: P.y + PAD + CARD_H + 24, w: P.w - PAD * 2 - 60 };
  const even = { x: P.x + P.w - PAD - 82, y: P.y + 130, w: 82, h: 20 };
  const band = { x: P.x, y: P.y + PAD + CARD_H + 10, w: P.w, h: P.h - (PAD + CARD_H + 10) };
  return { P, card, chip, mineAdds, theirAdds, mid, pill, beam, even, band };
}
// A card as a chip: flat colour, a label strip, who it belongs to and what it's worth. Cheap on purpose.
function chip(c, x, y, w, h, col, who) {
  if (w < 2) return;
  const r = w * 0.06, lh = h * 0.26, ly = y + h - lh;
  ctx.save(); rr(x, y, w, h, r); ctx.clip();
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = theme.paper; ctx.fillRect(x, ly, w, lh);
  ctx.restore();
  if (w < 28) return;
  const s = w / CARD_W, pad = 4 * s;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = "rgb(255 255 255 / .92)"; font(800, 8.5 * s); ctx.fillText(fitText(who.toUpperCase(), w - pad * 2), x + pad, y + 11 * s);
  ctx.textAlign = "right"; font(700, 11 * s); ctx.fillText(short(c.price), x + w - pad, ly - 5 * s);
  ctx.textAlign = "left"; ctx.fillStyle = theme["paper-ink"]; font(800, 8 * s, true); ctx.fillText(fitText(c.name, w - pad * 2), x + pad, ly + lh * 0.48);
  font(500, 6.5 * s); ctx.fillText(`${sets[c.si].code} ${c.num}`, x + pad, ly + lh * 0.84);
}
function drawPill(r, text, primary, fill) {
  rr(r.x, r.y, r.w, r.h, r.h / 2);
  if (primary) { ctx.fillStyle = theme.ink; ctx.fill(); } else { ctx.lineWidth = 1; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  if (fill > 0) { ctx.save(); rr(r.x, r.y, r.w, r.h, r.h / 2); ctx.clip(); ctx.fillStyle = theme.deal; ctx.fillRect(r.x, r.y, r.w * fill, r.h); ctx.restore(); }
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = primary ? theme.bg : theme.ink;
  font(700, 12); ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 4.2);
  ctx.textAlign = "left";
}
// An add slides out from behind the card it joins.
function drawAdd(s, fromX, now, alpha, col, who) {
  let k = 1;
  if (s.a.t0 && !reduced) { k = ease(clamp((now - s.a.t0) / 420, 0, 1)); if (k < 1) pairMore = true; }
  ctx.globalAlpha = alpha * (0.35 + 0.65 * k);
  chip(s.a.c, fromX + (s.x - fromX) * k, s.y, s.w, s.h, col, who);
  ctx.globalAlpha = alpha;
}
const angOf = (give, get) => { const d = get - give, m = Math.max(give, get, 1); return 0.061 * Math.sign(d) * Math.pow(Math.min(1, Math.abs(d) / m), 0.35); };
const swapLine = (p) => { const m = p.adds.filter((a) => a.mine).length, t = p.adds.filter((a) => !a.mine).length; return `Your ${p.mine.name}${m ? ` + ${m}` : ""} for ${p.theirs.name}${t ? ` + ${t}` : ""}`; };
let pairMore = false;
function drawPairs(g, now, alpha) {
  pairMore = false;
  for (const c of g.lead) if (c.pair) drawPairTile(c, now, alpha);
  if (pairMore || hold) kick();
}
function drawPairTile(c, now, alpha) {
  const p = currentPair(c); if (!p) return;
  const G = pairParts(c, p, now), P = G.P;
  if (P.y > vh || P.y + P.h < 0) return;
  const tr = p.trade;
  // The flip: the chip turns over to the next pair; halfway through, the other side shows.
  let k = 1, from = null;
  if (c.flip) { k = clamp((now - c.flip.t0) / 380, 0, 1); from = c.flip.from; if (k >= 1) { c.flip = null; from = null; } else pairMore = true; }
  const show = from && k < 0.5 ? from : p, sx = from ? Math.abs(Math.cos(Math.PI * k)) : 1;
  ctx.globalAlpha = alpha;
  rr(P.x, P.y, P.w, P.h, 12); ctx.fillStyle = tr ? goldTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = tr ? 1.5 : 1; ctx.strokeStyle = tr ? theme.gold : theme["slot-line"]; ctx.stroke();
  const ch = G.chip, cw = ch.w * sx;
  chip(show.theirs, ch.x + (ch.w - cw) / 2, ch.y, cw, ch.h, TRADER_INK[show.t.id], show.t.name);
  for (const s of G.mineAdds) drawAdd(s, G.card.x, now, alpha, typeColor(s.a.c), "Yours");
  for (const s of G.theirAdds) drawAdd(s, ch.x, now, alpha, TRADER_INK[p.t.id], p.t.name);
  // Between: who, and what for.
  const M = G.mid;
  ctx.globalAlpha = alpha * sx; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.ink; font(700, 13.5); ctx.fillText(fitText(tr ? `Proposed to ${p.t.name}` : `${show.t.name}, ${show.t.where}`, M.w), M.x, M.y + 14);
  ctx.fillStyle = theme.muted; font(500, 11.5); ctx.fillText(fitText(tr ? "Waiting to hear back" : swapLine(show), M.w), M.x, M.y + 30);
  ctx.globalAlpha = alpha;
  drawPill(G.pill, tr ? "Take back" : "Propose", !tr, hold?.c === c ? clamp((now - hold.t0) / HOLD_MS, 0, 1) : 0);
  // Which pair of this spare you're on.
  const n = (c.pairs || []).length;
  if (!tr && n > 1) {
    const cx = ch.x + ch.w / 2, dy = ch.y + ch.h + 9;
    if (n <= 6) for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(cx - (n - 1) * 3.5 + i * 7, dy, 2, 0, Math.PI * 2); ctx.fillStyle = i === c.pi ? theme.ink : theme["slot-line"]; ctx.fill(); }
    else { ctx.textAlign = "center"; ctx.fillStyle = theme.muted; font(600, 10); ctx.fillText(`${c.pi + 1} of ${n}`, cx, dy + 3); ctx.textAlign = "left"; }
  }
  // The beam: a bar on a fulcrum that tips toward whoever comes out ahead (eased, so it swings as the weights land).
  const give = giveOf(show), get = getOf(show), d = get - give, tgt = angOf(give, get);
  if (c.beamAng == null || reduced) c.beamAng = tgt;
  else { const dt = Math.min(48, now - (c.beamT || now)); c.beamAng += (tgt - c.beamAng) * Math.min(1, dt / 150); if (Math.abs(tgt - c.beamAng) > 0.0006) pairMore = true; else c.beamAng = tgt; }
  c.beamT = now;
  const B = G.beam, bx = B.x + B.w / 2, by = B.y;
  ctx.save(); ctx.translate(bx, by); ctx.rotate(c.beamAng);
  ctx.fillStyle = theme.ink; ctx.fillRect(-B.w / 2, -1, B.w, 2);
  ctx.fillRect(-B.w / 2, -4, 2, 8); ctx.fillRect(B.w / 2 - 2, -4, 2, 8);
  ctx.restore();
  ctx.fillStyle = theme.muted; ctx.beginPath(); ctx.moveTo(bx, by + 1); ctx.lineTo(bx - 5, by + 8); ctx.lineTo(bx + 5, by + 8); ctx.closePath(); ctx.fill();
  // The sentence under it, in figures, and Even it up when it isn't.
  const even = Math.abs(d) < tolOf(give, get), label = !tr && !even;
  ctx.globalAlpha = alpha * sx; ctx.fillStyle = theme.muted; font(500, 11.5); ctx.textAlign = "left";
  ctx.fillText(fitText(balance(give, get), P.w - PAD * 2 - (label ? G.even.w + 8 : 0)), P.x + PAD, P.y + 144);
  ctx.globalAlpha = alpha;
  if (label) drawPill(G.even, "Even it up", false, 0);
  ctx.globalAlpha = 1;
}
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
  font(800, size, true);
  const stat = panelStat(g);
  font(600, size * 0.82); const sw = stat ? ctx.measureText(stat).width + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw), x, m.y + PG + 22);
  if (stat) { ctx.textAlign = "right"; font(600, size * 0.82); ctx.fillStyle = theme.muted; ctx.fillText(stat, x + w, m.y + PG + 22); }
  const owned = ownedNow(g.cards), n = g.cards.length;
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  ctx.globalAlpha = 1;
  // The pair tiles sit on the panel, under the cards; they fade in with the labels as a lens flight settles.
  if (liftKind === "trade" && g.lead.length && labelAlpha > 0.01) drawPairs(g, now, alpha * labelAlpha);
}

// ----- touch: tap to flip, the beam to even up, hold or Propose to record -----
function liftedAt(g, sx, sy) {
  const y = sy + mScroll;
  for (const c of g.lead || []) { const r = liftKind === "trade" ? c.pair : c.m; if (r && sx >= r.x && sx <= r.x + r.w && y >= r.y && y <= r.y + r.h) return c; }
  return null;
}
function tap(sx, sy) {
  if (holdFired) { holdFired = false; return; }
  if (state.trans) return;
  const h = hit(sx, sy);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    if (h?.block && lifted) { const c = liftedAt(h.block, sx, sy); if (c) return liftKind === "trade" ? pairTap(c, sx, sy) : popCard(c, mr(c.m)); }
    if (h?.block) enterGroup(h.block);
    return;
  }
  if (!h?.card) return;
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}
function pairTap(c, sx, sy) {
  const p = currentPair(c); if (!p) return;
  const G = pairParts(c, p, performance.now());
  if (inR(G.pill, sx, sy)) return p.trade ? takeBack(c, p.trade) : propose(c);
  if (p.trade) { tick(3); toast(`Proposed to ${p.t.name}. ${balance(giveOf(p), getOf(p))}`); return; }
  if (inR(G.band, sx, sy)) return evenUp(c, p);
  flipPair(c);
}
function flipPair(c) {
  const ps = c.pairs || [];
  if (ps.length < 2) { tick(3); toast(ps.length ? `Only ${ps[0].t.name} is after your ${c.name} so far.` : "No one is after this one."); return; }
  const from = currentPair(c);
  c.pi = ((c.pi | 0) + 1) % ps.length;
  c.flip = reduced ? null : { t0: performance.now(), from };
  tick(4); kick();
}
// Even it up: the cheapest fix for the gap. You're up, so one of your spares goes on; you're down, so one of theirs
// does. Closest to the gap wins, never far over it; a card the other side actually chases wins a tie.
function evenUp(c, p) {
  const give = giveOf(p), get = getOf(p), d = get - give;
  if (Math.abs(d) < tolOf(give, get)) { tick(3); toast("This one is even already."); return; }
  if (p.adds.length >= 3) { tick(3); toast("That's as close as it gets."); return; }
  const want = Math.abs(d), used = new Set([p.mine.id, p.theirs.id, ...p.adds.map((a) => a.c.id)]), mine = d > 0;
  const pool = mine ? cards.filter((x) => isSpare(x) && !used.has(x.id) && !promised(x)) : T_SPARE[p.t.id].filter((x) => !x.owned && !used.has(x.id) && !asked(p.t.id, x));
  let best = null, bs = Infinity;
  for (const x of pool) {
    if (x.price > want * 1.3 + 0.5) continue;
    let s = Math.abs(want - x.price) * ((mine ? T_CHASE[p.t.id].has(x.id) : isChase(x)) ? 1 : 1.6);
    if (mine && x.pairs?.length) s *= 1.3; // keep spares with swaps of their own for their own tiles
    if (s < bs) { bs = s; best = x; }
  }
  if (!best) { tick(3); toast(mine ? "Nothing of yours left to add." : `${p.t.name} has nothing left to add.`); return; }
  p.adds.push({ c: best, mine, t0: performance.now() });
  tick(6); kick(); drawList();
  toast(`${mine ? "Your" : `${p.t.name}'s`} ${best.name} (${amt(best.price)}) goes on. ${verdict(getOf(p) - giveOf(p))}`);
}
function propose(c) {
  const p = currentPair(c); if (!p || p.trade) return;
  const give = [c, ...p.adds.filter((a) => a.mine).map((a) => a.c)], get = [p.theirs, ...p.adds.filter((a) => !a.mine).map((a) => a.c)];
  const tr = { id: Math.random().toString(36).slice(2, 8), t: p.t.id, give: give.map((x) => x.id), get: get.map((x) => x.id), at: Date.now() };
  trades.push(tr); persistTrades();
  tradeViews.set(tr.id, { mine: c, t: p.t, theirs: p.theirs, adds: p.adds.map((a) => ({ c: a.c, mine: a.mine })), trade: tr, joinT0: performance.now() });
  c.flip = null; tick(14);
  reflowPairs(); drawList();
  const names = (l) => l.map((x) => x.name).join(" and ");
  toast(`Proposed to ${p.t.name}: your ${names(give)} for ${names(get)}. ${verdict(getOf(p) - giveOf(p))}`, () => removeTrade(tr));
}
function removeTrade(tr) { trades = trades.filter((x) => x !== tr); tradeViews.delete(tr.id); persistTrades(); reflowPairs(); drawList(); }
function takeBack(c, tr) {
  removeTrade(tr); tick(6);
  toast(`Took back your offer to ${traderOf(tr.t).name}.`, () => { trades.push(tr); persistTrades(); reflowPairs(); drawList(); });
}
// Press and hold a tile to propose: the pill fills while you hold. Fingers are read from the touch list.
const HOLD_MS = 560;
let hold = null, holdFired = false;
function startHold(x, y) {
  holdFired = false; endHold();
  if (view !== "mosaic" || liftKind !== "trade" || state.trans || pop.c) return;
  const h = hit(x, y), c = h?.block ? liftedAt(h.block, x, y) : null;
  if (!c || tradeOf(c)) return;
  hold = { c, x, y, t0: performance.now(), timer: setTimeout(() => { if (!hold) return; const cc = hold.c; hold = null; holdFired = true; propose(cc); }, HOLD_MS) };
  kick();
}
function endHold() { if (hold) { clearTimeout(hold.timer); hold = null; kick(); } }
canvas.addEventListener("touchstart", (e) => { if (e.touches.length === 1) startHold(e.touches[0].clientX, e.touches[0].clientY); else endHold(); }, { passive: true });
canvas.addEventListener("touchmove", (e) => { if (hold && e.touches.length && Math.hypot(e.touches[0].clientX - hold.x, e.touches[0].clientY - hold.y) > 8) endHold(); }, { passive: true });
canvas.addEventListener("touchend", () => endHold(), { passive: true });
canvas.addEventListener("touchcancel", () => endHold(), { passive: true });
canvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") startHold(e.clientX, e.clientY); });
canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 8) endHold(); });
canvas.addEventListener("pointerup", () => endHold());
canvas.addEventListener("pointercancel", () => endHold());

// ----- Spare on the card panel: in Trade the layout follows; a spare taken back drops its proposed trade -----
flagBtn.onclick = () => {
  const c = state.focus; if (!c) return;
  if (c.owned) {
    spares[c.id] = !isSpare(c); try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* fine */ }
    if (!spares[c.id]) { const gone = trades.filter((t) => t.give.includes(c.id)); if (gone.length) { trades = trades.filter((t) => !gone.includes(t)); for (const t of gone) tradeViews.delete(t.id); persistTrades(); } }
    updateFlag(c); tick(5); if (lifted) liftLayout(true); drawList(); kick();
    toast(spares[c.id] ? `${c.name} is a spare, up for trade.` : `${c.name} is no longer a spare.`);
    return;
  }
  chasing[c.id] = !isChase(c); persistChase(); updateFlag(c); tick(5); drawList(); if (lifted) liftLayout(true); kick();
  toast(chasing[c.id] ? `${c.name} on your chase list. Pay up to ${money(capOf(c))}.` : `${c.name} off your chase list.`);
};
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-spares", "wall-paid", "wall-trades"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ----- the list: swaps on top, with Propose or Take back on each -----
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
    const leads = groups.flatMap((g) => g.lead || []).filter((c) => !state.matches || state.matches.has(c));
    top = `<section><h2>Swaps</h2><p class="lsub">Your spares other collectors are after, paired with their spares you chase.</p><ul>${leads.map((c) => {
      const p = currentPair(c); if (!p) return "";
      const give = giveOf(p), get = getOf(p), n = (c.pairs || []).length;
      const adds = p.adds.length ? ` With ${p.adds.map((a) => `${a.mine ? "your" : `${p.t.name}'s`} ${a.c.name}`).join(", ")}.` : "";
      return `<li class="lwrow"><div class="lrow"><span class="lname">${p.mine.name} for ${p.theirs.name}</span><span class="lmeta">You give ${amt(give)}, get ${amt(get)}. ${p.trade ? `Proposed to ${p.t.name}, waiting to hear back.` : `${p.t.name}, ${p.t.where}.${n > 1 ? ` ${n} pairs for this spare.` : ""}`}${adds}</span><span class="lprice">${verdict(get - give)}</span></div><button type="button" class="pill-btn" data-propose="${c.i}">${p.trade ? "Take back" : "Propose"}</button></li>`;
    }).join("")}</ul>${leads.length ? "" : `<p class="lsub">No swaps yet.</p>`}</section>`;
  }
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (promised(c) ? "Spare, in a trade" : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-propose]"); if (!b) return;
  const c = cards[Number(b.dataset.propose)], tr = tradeOf(c);
  if (tr) takeBack(c, tr); else propose(c);
});
