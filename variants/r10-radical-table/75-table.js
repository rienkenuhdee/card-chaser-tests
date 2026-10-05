// ---------- the trade table: your spares meeting someone else's wants ----------
// The Trade lens lifts your spares out in front (the chase lift, keyed on spares) and puts a strip of traders along
// the top of the mosaic: each one wants something of yours. Tap a trader and the screen becomes a table between you:
// their spares along the top (the ones you chase lit green), yours along the bottom (the ones they chase lit gold),
// and the table between. Drag a card from either side onto the table and it stays there; the strip keeps both
// totals and the balance. Shake hands proposes the trade (kept on this device, with Undo). Back, Escape or a pinch
// returns to the wall with every card flying home. While the table is up it owns every touch on the canvas.

// ----- other collectors (made up, seeded by name; the same in every variant this round) -----
const TRADERS = [{ id: "maya", name: "Maya", where: "Sacramento" }, { id: "theo", name: "Theo", where: "Oakland" }, { id: "jun", name: "Jun", where: "Reno" }, { id: "priya", name: "Priya", where: "Davis" }];
const tOwns = (t, c) => h32(`${t.id}|o|${c.id}`) < 0.45;
const tSpare = (t, c) => tOwns(t, c) && h32(`${t.id}|s|${c.id}`) < 0.14;
const tChase = (t, c) => !tOwns(t, c) && h32(`${t.id}|c|${c.id}`) < 0.16;
const T_INKS = Object.values(SET_INK);
for (const t of TRADERS) {
  t.ink = T_INKS[Math.floor(h32(`${t.id}|k`) * T_INKS.length)];
  t.spares = cards.filter((c) => tSpare(t, c)); // what they have spare
  t.chases = cards.filter((c) => tChase(t, c)); // what they are after
  t.chaseSet = new Set(t.chases);
}
const wantsOf = (t) => t.chases.filter(isSpare); // your spares they chase
const offersOf = (t) => t.spares.filter(isChase); // their spares you chase
const wantedBy = (c) => TRADERS.filter((t) => t.chaseSet.has(c));
const sumOf = (list) => list.reduce((a, c) => a + c.price, 0);
let trades = [];
try { trades = JSON.parse(localStorage.getItem("wall-trades") || "[]") || []; } catch { trades = []; }
const persistTrades = () => { try { localStorage.setItem("wall-trades", JSON.stringify(trades)); } catch { /* private mode */ } };
const proposedTo = (t) => trades.filter((x) => x.t === t.id).pop() || null;
document.getElementById("reset").addEventListener("click", () => { try { localStorage.removeItem("wall-trades"); } catch { /* fine */ } });

// ----- the Trade lens lifts spares, the way Chase lifts the chase list -----
const spareOrder = (a, b) => wantedBy(b).length - wantedBy(a).length || b.price - a.price || a.i - b.i;
let liftKey = null;
function orderGroup(g) {
  g.base ||= g.cards;
  const key = state.lens === "trade" ? isSpare : isChase, ord = state.lens === "trade" ? spareOrder : chaseOrder;
  const lead = lifted ? g.base.filter(key).sort(ord) : [];
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !key(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}
function layoutAll() { lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null; for (const g of groups) orderGroup(g); groups.forEach(binderLayout); if (lifted) liftedLayout(); else mosaicLayout(); }
function liftLayout(force = false) {
  const want = state.lens === "chase" || state.lens === "trade";
  const same = want === lifted && (!want || state.lens === liftKey);
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
// The strip of traders along the top of the mosaic, above the lifted panels. It scrolls with the mosaic.
const CHIP_H = 66, CHIP_GAP = 6;
let strip = null; // { y, h, chips: [{ t, x, y, w, h }] } in mosaic coordinates
function stripLayout(R) {
  const ts = TRADERS.filter((t) => wantsOf(t).length || offersOf(t).length).sort((a, b) => wantsOf(b).length - wantsOf(a).length || offersOf(b).length - offersOf(a).length);
  if (!ts.length) { strip = null; return 0; }
  const cols = Math.min(ts.length, R.w >= 700 ? 4 : 2), cw = (R.w - PG * 2 - CHIP_GAP * (cols - 1)) / cols, rows = Math.ceil(ts.length / cols);
  strip = { y: R.y, h: PG + rows * (CHIP_H + CHIP_GAP) - CHIP_GAP + PG, chips: ts.map((t, i) => ({ t, x: R.x + PG + (i % cols) * (cw + CHIP_GAP), y: R.y + PG + Math.floor(i / cols) * (CHIP_H + CHIP_GAP), w: cw, h: CHIP_H })) };
  return strip.h;
}
function liftedLayout() {
  const R = { x: 8, y: topPad(), w: vw - 16 };
  const live = groups.filter((g) => g.lead.length), folded = groups.filter((g) => !g.lead.length);
  let y = R.y;
  if (state.lens === "trade") y += stripLayout(R); else strip = null;
  const across = R.w >= 900 ? 2 : 1, pw = R.w / across;
  for (let i = 0; i < live.length; i += across) {
    const row = live.slice(i, i + across), h = Math.max(...row.map((g) => liftedH(g, pw)));
    row.forEach((g, j) => { g.m = { x: R.x + j * pw, y, w: pw, h }; });
    y += h;
  }
  for (const g of folded) { g.m = { x: R.x, y, w: R.w, h: FOLD }; y += FOLD; }
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  for (const g of groups) if (g.lead.length) packLifted(g); else packFolded(g);
}
const chipAt = (sx, sy) => { if (!strip || view !== "mosaic" || state.lens !== "trade") return null; const y = sy + mScroll; return strip.chips.find((ch) => sx >= ch.x && sx <= ch.x + ch.w && y >= ch.y && y <= ch.y + ch.h) || null; };
let goldKey = "", goldVal = "";
function goldTint() { const k = theme.slot + theme.gold; if (k !== goldKey) { goldKey = k; goldVal = mix(theme.slot, theme.gold, theme.dark ? 0.16 : 0.11); } return goldVal; }
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
  if (prop) { ctx.fillStyle = theme.deal; ctx.fillText(fitText(`Proposed: ${prop.give.length} for ${prop.get.length}`, tw), tx, y + 55); }
  else if (wants) { ctx.fillStyle = theme.gold; ctx.fillText(fitText(`Wants ${wants} of yours`, tw), tx, y + 55); }
  else { ctx.fillStyle = theme.deal; ctx.fillText(fitText(`Has ${has} you chase`, tw), tx, y + 55); }
  // a chevron: there's a table behind this
  ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + w - 14, y + h / 2 - 5); ctx.lineTo(x + w - 9, y + h / 2); ctx.lineTo(x + w - 14, y + h / 2 + 5); ctx.stroke(); ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
}
function drawTraders(now) {
  if (!strip || view !== "mosaic" || state.lens !== "trade") return;
  const T = state.trans;
  let alpha = 1;
  if (T?.kind === "morph") alpha = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1));
  else if (T?.kind === "open") alpha = 1 - T.q;
  else if (T) return;
  if (tbl.on) alpha *= 1 - tbl.q;
  if (alpha <= 0.01) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const ch of strip.chips) drawChip(ch, now, alpha);
}

// ----- the spare tile: a card of yours out in front, and who wants it -----
function drawSpareTile(c, x, y, w, h, a, now) {
  const st = sets[c.si], who = wantedBy(c), want = who.length > 0, rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = want ? goldTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = want ? 1.5 : 1; ctx.strokeStyle = want ? theme.gold : theme["slot-line"]; ctx.stroke();
  if (w < 60) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.05), s = clamp(w / 177, 0.6, 1.3);
  const mh = h - pad * 2, mw = mh * TW / TH;
  foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  const tx = x + pad + mw + pad, tw = x + w - pad - tx;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.ink; font(800, 20 * s); ctx.fillText(short(c.price), tx, y + pad + 17 * s);
  if (want) { ctx.fillStyle = theme.gold; font(700, 11.5 * s); ctx.fillText(fitText(who.length === 1 ? `${who[0].name} wants it` : who.length === 2 ? `${who[0].name} and ${who[1].name} want it` : `${who.length} want it`, tw), tx, y + pad + 32 * s); }
  else { ctx.fillStyle = theme.muted; font(500, 11.5 * s); ctx.fillText(fitText("No takers yet", tw), tx, y + pad + 32 * s); }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}
// The base tile, with one change: a lifted card you own (a spare, in the Trade lens) draws as the spare tile while
// it is wider than it is tall; as it grows into the binder, or onto the table, it becomes the card.
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
  if (c.lift && w > h * 1.05) { if (c.owned) drawSpareTile(c, sx, sy, w, h, alpha, now); else drawFeedTile(c, sx, sy, w, h, alpha); ctx.globalAlpha = 1; return; }
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
// The base card face, with foil also off while anything on the table moves (two binders on screen).
let foilOff = false;
function cardFace(c, sx, sy, w, h, now, value) {
  const st = sets[c.si];
  const col = value ? heat(c.price) : typeColor(c);
  const r = w * 0.045;
  if (w > 90) { ctx.save(); ctx.shadowColor = "rgb(0 0 0 / .32)"; ctx.shadowBlur = w * 0.09; ctx.shadowOffsetY = w * 0.035; rr(sx, sy, w, h, r); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore(); }
  ctx.save(); rr(sx, sy, w, h, r); ctx.clip();
  const g = ctx.createLinearGradient(sx, sy, sx + w, sy + h);
  g.addColorStop(0, shade(col, 0.2)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.28));
  ctx.fillStyle = g; ctx.fillRect(sx, sy, w, h);
  if (w > 60) { ctx.fillStyle = engraving(); ctx.fillRect(sx, sy, w, h); }
  if (c.tier >= 3 && !reduced && !foilOff && !state.trans && !fly && !inertia && !(tbl.on && tableMoving())) {
    frameFoil = true;
    const phase = ((now * 0.00005 + (sx + cam.x * cam.s * 0.25) * 0.0011) % 1 + 1) % 1;
    const fx = sx - w + phase * w * 3;
    const fg = ctx.createLinearGradient(fx, sy, fx + w * 0.9, sy + h);
    fg.addColorStop(0, "rgb(255 255 255 / 0)"); fg.addColorStop(0.38, "rgb(150 220 255 / .28)"); fg.addColorStop(0.5, "rgb(255 226 160 / .42)"); fg.addColorStop(0.62, "rgb(160 245 205 / .28)"); fg.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = fg; ctx.fillRect(sx, sy, w, h); ctx.globalCompositeOperation = "source-over";
  }
  const lh = h * 0.24, ly = sy + h - lh;
  ctx.fillStyle = theme.paper; ctx.fillRect(sx, ly, w, lh);
  ctx.fillStyle = "rgb(0 0 0 / .14)"; ctx.fillRect(sx, ly, w, Math.max(1, w * 0.006));
  ctx.restore();
  if (c.tier >= 5) { rr(sx + w * 0.03, sy + w * 0.03, w * 0.94, h - lh - w * 0.04, r * 0.7); ctx.lineWidth = Math.max(1, w * 0.012); ctx.strokeStyle = "rgb(240 200 110 / .85)"; ctx.stroke(); }
  if (w < 40) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["paper-ink"];
  font(800, w * 0.092, true); ctx.fillText(fitText(c.name, w * 0.84), sx + pad, ly + lh * 0.46);
  font(500, w * 0.064); ctx.globalAlpha *= 0.7;
  ctx.fillText(`${st.code} ${c.num}/${st.printed}`, sx + pad, ly + lh * 0.82);
  ctx.textAlign = "right"; ctx.fillText(GLYPH[c.tier], sx + w - pad, ly + lh * 0.82);
  ctx.globalAlpha /= 0.7;
  if (value || w > 110) { ctx.textAlign = "right"; ctx.fillStyle = "rgb(255 255 255 / .92)"; font(700, w * 0.078); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
}
// A card that is out on the table leaves its tile empty.
function emphasis(c) {
  if (c.away) return 0;
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.16 : 1;
  if (state.lens === "chase") return isChase(c) ? 1 : 0.18;
  if (state.lens === "trade") return isSpare(c) ? 1 : 0.18;
  return 1;
}

// ----- chrome: Back stays while the table is up; the trade bar takes the lens bar's place -----
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on; arrBtn0.hidden = view === "set" || tbl.on;
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : "";
  if (marking && view !== "set") leaveMark();
  updateCount();
}
backBtn.onclick = () => { if (tbl.on) closeTable(); else exitToMosaic(); };
const tradeBar = document.createElement("div");
tradeBar.className = "tradebar glass"; tradeBar.id = "tradebar"; tradeBar.setAttribute("role", "group"); tradeBar.setAttribute("aria-label", "The trade");
tradeBar.innerHTML = '<div class="mtext" aria-live="polite"><b id="tb-head">Trade</b><span id="tb-sub"></span></div><button type="button" class="mbtn primary" id="tb-go" disabled>Shake hands</button>';
document.getElementById("markbar").after(tradeBar);
const tbHead = document.getElementById("tb-head"), tbSub = document.getElementById("tb-sub"), tbGo = document.getElementById("tb-go");
const balanceText = (get, give, t) => { const d = sumOf(get) - sumOf(give); return Math.abs(d) < 0.005 ? "An even trade" : d > 0 ? `You're up ${money(d)}` : `${t.name}'s up ${money(-d)}`; };
function updateTradeBar() {
  const t = tbl.t; if (!t) return;
  const give = tbl.give.length, get = tbl.get.length;
  if (!give && !get) { tbHead.textContent = `Trade with ${t.name}`; tbSub.textContent = "Drag a card from either side onto the table"; }
  else if (give && get) { tbHead.textContent = balanceText(tbl.get, tbl.give, t); tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s`; }
  else if (get) { tbHead.textContent = `${get} of ${t.name}'s on the table`; tbSub.textContent = "Add one of yours to make it a trade"; }
  else { tbHead.textContent = `${give} of yours on the table`; tbSub.textContent = `Add one of ${t.name}'s to make it a trade`; }
  tbGo.disabled = !(give && get) || Boolean(tbl.shake);
}
tbGo.onclick = () => shake();

// ----- the table -----
const tbl = { on: false, t: null, q: 0, anim: null, pinch: null, pend: null, drag: null, give: [], get: [], theirs: [], yours: [], their: { sx: 0, v: 0 }, your: { sx: 0, v: 0 }, flights: [], shake: null, origin: null, L: null, last: 0 };
const tableMoving = () => Boolean(tbl.drag || tbl.flights.length || tbl.anim || tbl.pinch || tbl.shake || tbl.their.v || tbl.your.v);
const sideOf = (c) => (tbl.theirs.includes(c) ? "their" : "your");
function tableLayout() {
  const top = topPad(), bot = vh - 76, W = Math.min(vw, 980), X = (vw - W) / 2;
  const sh = clamp(Math.round(vh * 0.15), 108, 136), bh = (bot - top - sh) / 2, head = 46, gap = 8;
  let rows = 3, ch = Math.floor((bh - head - 12 - gap * (rows - 1)) / rows);
  if (ch * TW / TH < 62) { rows = 2; ch = Math.floor((bh - head - 12 - gap) / 2); }
  ch = Math.min(ch, 122);
  const cw = Math.round(ch * TW / TH);
  return { X, W, top, bot, their: { x: X, y: top, w: W, h: bh }, strip: { x: X, y: top + bh, w: W, h: sh }, your: { x: X, y: top + bh + sh, w: W, h: bh }, rows, cw, ch, gap, head };
}
const sideRegion = (side) => (side === "their" ? tbl.L.their : tbl.L.your);
const sideList = (side) => (side === "their" ? tbl.theirs : tbl.yours);
const maxScroll = (side) => { const L = tbl.L, n = sideList(side).length, cols = Math.ceil(n / L.rows); return Math.max(0, cols * (L.cw + L.gap) - L.gap - (L.W - 24)); };
function slotRect(side, k) {
  const L = tbl.L, R = sideRegion(side), S = side === "their" ? tbl.their : tbl.your;
  const col = Math.floor(k / L.rows), row = k % L.rows;
  return { x: R.x + 12 + col * (L.cw + L.gap) - S.sx, y: R.y + L.head + row * (L.ch + L.gap), w: L.cw, h: L.ch };
}
// Where a card sits on the table: theirs fan in from the left, yours from the right. A handshake crosses them over.
function tableSlot(side, i, n) {
  const S = tbl.L.strip, h = S.h - 62, w = h * TW / TH, pad = 14, avail = S.w / 2 - pad * 2 - 4;
  const step = n > 1 ? Math.min(w + 6, (avail - w) / (n - 1)) : 0;
  const left = S.x + pad + i * step, right = S.x + S.w - pad - w - i * step;
  let x = side === "their" ? left : right;
  if (tbl.shake) { const k = ease(clamp((performance.now() - tbl.shake.t0) / tbl.shake.dur, 0, 1)); const o = side === "their" ? right : left; x += (o - x) * k; }
  return { x, y: S.y + 30, w, h };
}
function targetRect(c) {
  const side = sideOf(c);
  if (c.spot === "table") { const list = side === "their" ? tbl.get : tbl.give; return tableSlot(side, list.indexOf(c), list.length); }
  return slotRect(side, sideList(side).indexOf(c));
}
const curRect = (c) => (tbl.drag?.c === c ? { x: tbl.drag.x, y: tbl.drag.y, w: tbl.drag.w, h: tbl.drag.h } : c.spot === "table" && c.tcur ? { ...c.tcur } : targetRect(c));
const zoneAt = (y) => { const L = tbl.L; return y < L.strip.y ? "their" : y < L.strip.y + L.strip.h ? "table" : "your"; };
function cardAt(x, y) {
  for (const c of [...tbl.get, ...tbl.give]) { const r = c.tcur; if (r && !c.held && x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4) return c; }
  const zone = zoneAt(y); if (zone === "table") return null;
  const L = tbl.L, R = sideRegion(zone), S = zone === "their" ? tbl.their : tbl.your, list = sideList(zone);
  const lx = x - R.x - 12 + S.sx, ly = y - R.y - L.head;
  if (lx < 0 || ly < 0) return null;
  const col = Math.floor(lx / (L.cw + L.gap)), row = Math.floor(ly / (L.ch + L.gap));
  if (row >= L.rows || lx - col * (L.cw + L.gap) > L.cw || ly - row * (L.ch + L.gap) > L.ch) return null;
  const c = list[col * L.rows + row];
  return c && c.spot !== "table" && !c.held ? c : null;
}
function openTable(t, from) {
  if (tbl.on || state.trans) return;
  hideCaption(); cancelPress(); closePop(true);
  tbl.on = true; tbl.t = t; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.flights = []; tbl.shake = null; tbl.drag = null; tbl.pend = null; tbl.pinch = null;
  tbl.their.sx = 0; tbl.their.v = 0; tbl.your.sx = 0; tbl.your.v = 0;
  tbl.L = tableLayout();
  tbl.theirs = t.spares.slice().sort((a, b) => (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.yours = cards.filter(isSpare).sort((a, b) => (t.chaseSet.has(b) ? 1 : 0) - (t.chaseSet.has(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.origin = from ? { x: from.x + 11, y: from.y - mScroll + 17, w: 32, h: 32 } : { x: vw / 2 - 18, y: topPad(), w: 36, h: 36 };
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; }
  for (const c of tbl.yours) { c.spot = "binder"; c.held = false; c.tcur = null; c.away = true; c.e = 0; c.o = mr(c.m); }
  document.body.classList.add("trading"); setChrome(); updateTradeBar();
  tbl.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 680 };
  if (reduced) tbl.q = 1;
  tick(8); kick();
}
function closeTable(instant = false) {
  if (!tbl.on || tbl.closing) return;
  if (tbl.drag) { tbl.drag.c.held = false; tbl.drag = null; }
  tbl.pend = null; tbl.pinch = null; tbl.flights = []; tbl.shake = null; tbl.their.v = 0; tbl.your.v = 0;
  for (const c of [...tbl.get, ...tbl.give]) c.held = false;
  tbl.closing = true;
  if (instant || reduced) { tbl.q = 0; tbl.anim = null; endTable(); return; }
  tbl.anim = { from: tbl.q, to: 0, t0: performance.now(), dur: 180 + 400 * tbl.q };
  tick(6); kick();
}
function endTable() {
  for (const c of tbl.yours) { c.away = false; c.e = 1; c.spot = "binder"; c.held = false; c.tcur = null; }
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; }
  tbl.on = false; tbl.closing = false; tbl.anim = null; tbl.q = 0; tbl.give = []; tbl.get = [];
  document.body.classList.remove("trading"); setChrome(); kick();
}
function finishTableAnim() { if (!tbl.anim) return; tbl.q = tbl.anim.to; tbl.anim = null; if (tbl.q === 0) endTable(); }
// A card goes onto the table or comes home: it travels from where it was to where it is going.
function place(c, toTable, from) {
  const side = sideOf(c), list = side === "their" ? tbl.get : tbl.give;
  tbl.flights = tbl.flights.filter((f) => f.c !== c);
  if (toTable && c.spot !== "table") list.push(c);
  if (!toTable && c.spot === "table") list.splice(list.indexOf(c), 1);
  c.spot = toTable ? "table" : "binder"; c.held = true; c.tcur = null;
  const done = () => { c.held = false; if (c.spot === "table") c.tcur = targetRect(c); kick(); };
  if (reduced) done(); else tbl.flights.push({ c, from, t0: performance.now(), dur: 340, done });
  updateTradeBar(); kick();
}
function shake() {
  if (!tbl.on || !tbl.give.length || !tbl.get.length || tbl.shake) return;
  const t = tbl.t, rec = { t: t.id, give: tbl.give.map((c) => c.id), get: tbl.get.map((c) => c.id), at: Date.now() };
  trades.push(rec); persistTrades(); tick(24);
  toast(`Proposed to ${t.name}: ${rec.give.length} of yours for ${rec.get.length} of ${t.name}'s. ${balanceText(tbl.get, tbl.give, t)}.`, () => { trades = trades.filter((x) => x !== rec); persistTrades(); drawList(); kick(); });
  drawList();
  if (reduced) { closeTable(); return; }
  tbl.shake = { t0: performance.now(), dur: 520 }; updateTradeBar(); kick();
}

// ----- drawing the table -----
let feltKey = "", feltVal = "";
function felt() { const k = theme.panelFill + theme.ink; if (k !== feltKey) { feltKey = k; feltVal = mix(theme.panelFill, theme.ink, theme.dark ? 0.05 : 0.045); } return feltVal; }
// The pocket a card left behind when it went to the table: its outline and its name.
function drawPocket(c, r, alpha) {
  ctx.globalAlpha = alpha;
  rr(r.x, r.y, r.w, r.h, r.w * 0.045); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (r.w < 44) return;
  const pad = r.w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, r.w * 0.088, true); ctx.fillText(fitText(c.name, r.w - pad * 2), r.x + pad, r.y + r.h - pad - r.w * 0.075);
  font(500, r.w * 0.064); ctx.fillText("On the table", r.x + pad, r.y + r.h - pad);
}
function drawRing(r, col) { ctx.lineWidth = 2.5; ctx.strokeStyle = col; rr(r.x - 2.5, r.y - 2.5, r.w + 5, r.h + 5, r.w * 0.045 + 2.5); ctx.stroke(); }
function drawBinder(side, now, alpha, value) {
  const L = tbl.L, R = sideRegion(side), t = tbl.t, list = sideList(side), S = side === "their" ? tbl.their : tbl.your;
  const lit = side === "their" ? isChase : (c) => t.chaseSet.has(c), litCol = side === "their" ? theme.deal : theme.gold;
  ctx.globalAlpha = alpha;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  let tx = R.x + 12;
  if (side === "their") { ctx.beginPath(); ctx.arc(R.x + 26, R.y + 22, 14, 0, Math.PI * 2); ctx.fillStyle = t.ink; ctx.fill(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; font(800, 13); ctx.fillText(t.name[0], R.x + 26, R.y + 23); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; tx = R.x + 48; }
  const n = list.length, litN = list.filter(lit).length;
  ctx.fillStyle = theme.ink; font(800, 17, true); ctx.fillText(fitText(side === "their" ? `${t.name}'s spares` : "Your spares", R.w - 24), tx, R.y + 20);
  ctx.fillStyle = theme.muted; font(500, 12.5);
  ctx.fillText(fitText(side === "their" ? `${t.where}. ${n} spares, ${litN ? `${litN} you chase` : "none you chase"}` : `${n} spares, ${litN ? `${litN} ${t.name} wants` : `none ${t.name}'s after`}`, R.w - 24), tx, R.y + 36);
  // the cards, column by column, only the columns on screen
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y + L.head - 4, R.w, R.h - L.head + 4); ctx.clip();
  const c0 = Math.max(0, Math.floor((S.sx - 12) / (L.cw + L.gap))), c1 = Math.ceil((S.sx + R.w) / (L.cw + L.gap));
  for (let k = c0 * L.rows; k < Math.min(n, (c1 + 1) * L.rows); k++) {
    const c = list[k], r = slotRect(side, k);
    if (c.spot === "table" || c.held) { drawPocket(c, r, alpha * 0.7); ctx.globalAlpha = alpha; continue; }
    const on = lit(c);
    ctx.globalAlpha = alpha * (on ? 1 : 0.5);
    cardFace(c, r.x, r.y, r.w, r.h, now, value);
    if (on) { ctx.globalAlpha = alpha; drawRing(r, litCol); }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawStrip(now, alpha) {
  const S = tbl.L.strip, t = tbl.t;
  ctx.globalAlpha = alpha;
  rr(S.x + PG, S.y + 4, S.w - PG * 2, S.h - 8, 12); ctx.fillStyle = felt(); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(S.x + S.w / 2 - 0.5, S.y + 14, 1, S.h - 28);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(`${t.name} gives`, S.x + 14, S.y + 22);
  const gl = ctx.measureText(`${t.name} gives`).width;
  ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(tbl.get)), S.x + 14 + gl + 8, S.y + 22);
  ctx.textAlign = "right"; ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(tbl.give)), S.x + S.w - 14, S.y + 22);
  const yw = ctx.measureText(money(sumOf(tbl.give))).width;
  ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText("You give", S.x + S.w - 14 - yw - 8, S.y + 22);
  if (!tbl.give.length && !tbl.get.length) { ctx.textAlign = "center"; ctx.fillStyle = theme.muted; font(500, 13); ctx.fillText(fitText("Drag a card from either side onto the table", S.w - 40), S.x + S.w / 2, S.y + S.h / 2 + 10); }
  else {
    const txt = balanceText(tbl.get, tbl.give, t);
    font(700, 12); const tw = ctx.measureText(txt).width + 20;
    rr(S.x + S.w / 2 - tw / 2, S.y + S.h - 28, tw, 21, 10.5); ctx.fillStyle = theme.ink; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = theme.bg; ctx.fillText(txt, S.x + S.w / 2, S.y + S.h - 13.5);
  }
  ctx.globalAlpha = 1;
}
const lerpR = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });
function drawCardAt(c, r, now, value, shadow = 0) {
  if (shadow) { ctx.globalAlpha *= 0.28; rr(r.x + 2, r.y + shadow, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill(); ctx.globalAlpha /= 0.28; }
  cardFace(c, r.x, r.y, r.w, r.h, now, value);
}
function drawTable(now) {
  const dt = Math.min(48, now - (tbl.last || now)); tbl.last = now;
  tbl.L = tableLayout();
  let more = false;
  if (tbl.anim) { const a = tbl.anim, p = clamp((now - a.t0) / a.dur, 0, 1); tbl.q = a.from + (a.to - a.from) * ease(p); if (p >= 1) { tbl.anim = null; tbl.q = a.to; if (a.to === 0) { endTable(); return; } } else more = true; }
  const q = tbl.q, value = state.value && !state.matches, L = tbl.L;
  for (const side of ["their", "your"]) { const S = side === "their" ? tbl.their : tbl.your; S.sx = clamp(S.sx, 0, maxScroll(side)); if (S.v && !tbl.pend) { S.sx = clamp(S.sx - S.v * dt, 0, maxScroll(side)); S.v *= Math.pow(0.95, dt / 16); if (Math.abs(S.v) < 0.02 || S.sx <= 0 || S.sx >= maxScroll(side)) S.v = 0; more = true; } }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = q; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  if (q >= 1) {
    drawBinder("their", now, 1, value); drawBinder("your", now, 1, value); drawStrip(now, 1);
    // cards on the table ease to their places as others come and go
    for (const c of [...tbl.get, ...tbl.give]) {
      if (c.held) continue;
      const tgt = targetRect(c);
      if (!c.tcur) c.tcur = tgt;
      else if (Math.abs(c.tcur.x - tgt.x) > 0.3 || Math.abs(c.tcur.y - tgt.y) > 0.3) { c.tcur = lerpR(c.tcur, tgt, reduced ? 1 : Math.min(1, dt / 70)); more = true; } else c.tcur = tgt;
      ctx.globalAlpha = 1; drawCardAt(c, c.tcur, now, value, 3);
    }
    for (const f of tbl.flights) {
      const p = clamp((now - f.t0) / f.dur, 0, 1), r = lerpR(f.from, targetRect(f.c), ease(p));
      ctx.globalAlpha = 1; drawCardAt(f.c, r, now, value, 4 + 6 * Math.sin(Math.PI * p));
      if (p >= 1) { f.done(); tbl.flights = tbl.flights.filter((x) => x !== f); } else more = true;
    }
    if (tbl.drag) { const d = tbl.drag, r = { x: d.x - d.w * 0.04, y: d.y - d.h * 0.04, w: d.w * 1.08, h: d.h * 1.08 }; ctx.globalAlpha = 1; drawCardAt(d.c, r, now, value, 8); }
    if (tbl.shake) { more = true; if (now - tbl.shake.t0 > tbl.shake.dur + 160) { tbl.shake = null; closeTable(); } }
  } else {
    // Opening or closing: the chrome fades with q while every card travels between the wall and its place here.
    const a = clamp((q - 0.35) / 0.65, 0, 1);
    if (a > 0) { drawBinder("their", now, a, value); drawBinder("your", now, a, value); drawStrip(now, a); }
    const fly = (list, origin, idx) => {
      const n = list.length;
      list.forEach((c, i) => {
        const k = ease(clamp((q - (i / n) * 0.3) / 0.7, 0, 1));
        const to = c.spot === "table" && c.tcur ? c.tcur : targetRect(c), from = origin(c);
        const r = lerpR(from, to, k);
        if (r.y > vh || r.y + r.h < 0 || r.x > vw || r.x + r.w < 0) return;
        ctx.globalAlpha = Math.max(0.15, k);
        if (idx === "their") drawCardAt(c, r, now, value, 3 * k);
        else drawTile(c, r.x, r.y, r.w, r.h, now, 1);
      });
    };
    fly(tbl.theirs, () => tbl.origin, "their");
    for (const c of tbl.yours) c.e = 1; // the tile draws through our own alpha, not the wall's
    fly(tbl.yours, (c) => c.o, "your");
    for (const c of tbl.yours) c.e = 0;
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 1;
  if (more || tbl.anim || tbl.pinch) kick();
}
// Every frame: the wall (while the table is opening or closing it shows through), then the table or the traders.
function kick() {
  if (raf) return;
  raf = requestAnimationFrame(tableFrame);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; tableFrame(performance.now()); } }, 120);
}
function tableFrame(now) {
  if (tbl.on && tbl.q >= 1 && !tbl.anim) { raf = 0; drawTable(now); return; }
  frame(now);
  if (tbl.on) { drawTraders(now); drawTable(now); } else drawTraders(now);
}

// ----- input: while the table is up it owns every touch on the canvas -----
function tDown(pts) {
  if (document.activeElement === qIn) qIn.blur();
  hideCaption();
  if (tbl.closing) { finishTableAnim(); return; } // the close finishes; the wall takes the next move
  if (tbl.anim) finishTableAnim();
  tbl.their.v = 0; tbl.your.v = 0;
  if (pts.length >= 2) return tPinchStart(pts);
  if (tbl.pend || tbl.pinch) return;
  const p = pts[0], now = performance.now(), zone = zoneAt(p.y);
  const S = zone === "their" ? tbl.their : zone === "your" ? tbl.your : null;
  tbl.pend = { x: p.x, y: p.y, t: now, zone, c: tbl.shake ? null : cardAt(p.x, p.y), sx0: S ? S.sx : 0, axis: null, samples: [{ x: p.x, y: p.y, t: now }] };
}
function pickUp(c, p) {
  const r = curRect(c);
  tbl.flights = tbl.flights.filter((f) => f.c !== c);
  tbl.drag = { c, ox: p.x - r.x, oy: p.y - r.y, x: r.x, y: r.y, w: r.w, h: r.h, from: c.spot };
  c.held = true; tick(5); kick();
}
function tMove(pts) {
  if (tbl.closing) return;
  if (tbl.pinch) { if (pts.length >= 2) tPinchMove(pts); return; }
  if (pts.length >= 2) { if (tbl.drag) dropHome(); tbl.pend = null; return tPinchStart(pts); }
  const p = pts[0], d = tbl.pend; if (!p || !d) return;
  const now = performance.now();
  d.samples.push({ x: p.x, y: p.y, t: now }); if (d.samples.length > 8) d.samples.shift();
  if (tbl.drag) { tbl.drag.x = p.x - tbl.drag.ox; tbl.drag.y = p.y - tbl.drag.oy; kick(); return; }
  const dx = p.x - d.x, dy = p.y - d.y;
  if (!d.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    // In a binder a sideways drag scrolls it; pulling a card out toward the table carries it. On the table any drag carries.
    d.axis = d.c && (d.zone === "table" || Math.abs(dy) > Math.abs(dx) * 0.9) ? "drag" : "scroll";
    if (d.axis === "drag") { pickUp(d.c, p); tbl.drag.x = p.x - tbl.drag.ox; tbl.drag.y = p.y - tbl.drag.oy; return; }
  }
  if (d.axis === "scroll" && d.zone !== "table") { const S = d.zone === "their" ? tbl.their : tbl.your; S.sx = clamp(d.sx0 - dx, 0, maxScroll(d.zone)); kick(); }
}
function dropHome() { const d = tbl.drag; if (!d) return; tbl.drag = null; place(d.c, d.from === "table", { x: d.x, y: d.y, w: d.w, h: d.h }); }
function drop(end, vy) {
  const d = tbl.drag; if (!d) return; tbl.drag = null;
  const c = d.c, side = sideOf(c), S = tbl.L.strip, fy = end ? end.y : d.y + d.oy;
  const toward = side === "their" ? vy : -vy; // speed toward the table
  let toTable;
  if (d.from === "table") toTable = Math.abs(vy) < 0.5 ? fy >= S.y - 24 && fy <= S.y + S.h + 24 : toward > 0;
  else if (Math.abs(vy) >= 0.5) toTable = toward > 0;
  else toTable = side === "their" ? fy > S.y - 24 : fy < S.y + S.h + 24;
  place(c, toTable, { x: d.x, y: d.y, w: d.w, h: d.h });
  tick(toTable ? 8 : 4);
}
function tUp(end, cancelled) {
  if (tbl.pinch) { if (!cancelled) tPinchEnd(); else { tbl.pinch = null; if (tbl.q < 1) { if (reduced) tbl.q = 1; else tbl.anim = { from: tbl.q, to: 1, t0: performance.now(), dur: 200 }; } kick(); } return; }
  const d = tbl.pend; if (!d) return; tbl.pend = null;
  const now = performance.now(), s0 = d.samples.find((s) => now - s.t < 90) || d.samples[0], last = d.samples[d.samples.length - 1];
  const vx = s0 && s0 !== last ? (last.x - s0.x) / Math.max(1, last.t - s0.t) : 0, vy = s0 && s0 !== last ? (last.y - s0.y) / Math.max(1, last.t - s0.t) : 0;
  if (tbl.drag) { if (cancelled) dropHome(); else drop(end, reduced ? 0 : vy); return; }
  if (cancelled) return;
  if (!d.axis) { if (d.c) { place(d.c, d.c.spot !== "table", curRect(d.c)); tick(d.c.spot === "table" ? 8 : 4); } return; } // a tap moves it across
  if (d.axis === "scroll" && d.zone !== "table" && !reduced && Math.abs(vx) > 0.2) { const S = d.zone === "their" ? tbl.their : tbl.your; S.v = vx; kick(); }
}
// Pinching in closes the table under your fingers; a quick pinch closes whatever the distance.
function tPinchStart(pts) {
  if (tbl.drag) dropHome();
  tbl.pend = null; tbl.anim = null;
  tbl.pinch = { d0: dist(pts[0], pts[1]), q0: tbl.q, qs: [] };
}
function tPinchMove(pts) {
  const g = tbl.pinch, d = dist(pts[0], pts[1]);
  tbl.q = clamp(g.q0 - (1 - d / g.d0) / 0.55, 0, 1);
  g.qs.push({ q: tbl.q, t: performance.now() }); kick();
}
function tPinchEnd() {
  const g = tbl.pinch; tbl.pinch = null;
  const qs = g.qs, last = qs[qs.length - 1];
  let first = qs.find((s) => last && last.t - s.t < 160);
  if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
  const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
  const to = Math.abs(v) > 0.0011 ? (v > 0 ? 1 : 0) : tbl.q > 0.5 ? 1 : 0;
  if (to === 0) closeTable();
  else if (reduced) { tbl.q = 1; kick(); }
  else { tbl.anim = { from: tbl.q, to: 1, t0: performance.now(), dur: 180 + 300 * (1 - tbl.q) }; kick(); }
}
const tPts = (list) => [...list].map((t) => ({ x: t.clientX, y: t.clientY }));
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (type === "touchstart") tDown(tPts(e.touches));
  else if (type === "touchmove") tMove(tPts(e.touches));
  else { const rem = tPts(e.touches); if (rem.length >= 2) return; if (rem.length === 1 && tbl.pinch) { tbl.pinch && tPinchEnd(); tbl.pend = null; return; } if (!rem.length) tUp(tPts(e.changedTouches)[0], type === "touchcancel"); }
}, { capture: true, passive: false });
let tMouse = false;
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !tbl.on || e.target !== canvas) return; e.stopImmediatePropagation(); tMouse = true; tDown([{ x: e.clientX, y: e.clientY }]); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !tMouse) return; e.stopImmediatePropagation(); tMove([{ x: e.clientX, y: e.clientY }]); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !tMouse) return; tMouse = false; e.stopImmediatePropagation(); tUp({ x: e.clientX, y: e.clientY }, type === "pointercancel"); }, true);
document.addEventListener("wheel", (e) => {
  if (!tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (tbl.closing || !tbl.L) return;
  if (e.ctrlKey || e.metaKey) { if (e.deltaY > 2) closeTable(); return; }
  const zone = zoneAt(e.clientY); if (zone === "table") return;
  const S = zone === "their" ? tbl.their : tbl.your;
  S.sx = clamp(S.sx + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY), 0, maxScroll(zone)); kick();
}, { capture: true, passive: false });
document.addEventListener("keydown", (e) => {
  if (!tbl.on) return;
  if (e.key === "Escape" || e.key === "Backspace") { if (document.activeElement === qIn) return; e.preventDefault(); e.stopImmediatePropagation(); closeTable(); }
  else if (e.key === "Enter" && !tbGo.disabled && document.activeElement === canvas) { e.preventDefault(); e.stopImmediatePropagation(); shake(); }
  else if (e.target === canvas && /^Arrow/.test(e.key)) e.stopImmediatePropagation();
}, true);
// The table steps aside for anything that navigates the wall: a lens, a search, the list, a rearrange.
lensBox.addEventListener("click", () => { if (tbl.on) closeTable(true); }, true);
qIn.addEventListener("input", () => { if (tbl.on) closeTable(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (tbl.on) closeTable(true); }, true);
addEventListener("resize", () => { if (tbl.on) kick(); });
// Spare toggled on a card you own: the Trade lens reshapes around it.
flagBtn.addEventListener("click", () => { if (state.focus?.owned && lifted) liftLayout(true); });

// ----- taps on the wall: a trader opens the table; a spare tile opens it with whoever wants it -----
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return openTable(ch.t, ch);
    if (h?.block && lifted) {
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") {
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return openTable(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m));
    }
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
// A press on a trader chip shows as the press on a panel does.
canvas.addEventListener("touchstart", (e) => { if (tbl.on || e.touches.length !== 1 || state.trans) return; const ch = chipAt(e.touches[0].clientX, e.touches[0].clientY); if (ch && !state.press) { state.press = { chip: ch, t0: performance.now(), timer: 0 }; kick(); } });

// ----- the list: Trade with Maya, in plain rows -----
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
    const ts = TRADERS.filter((t) => wantsOf(t).length).sort((a, b) => wantsOf(b).length - wantsOf(a).length);
    top = `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase.</p><ul>${ts.map((t) => {
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
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-trade]"); if (!b) return;
  const t = TRADERS.find((x) => x.id === b.dataset.trade), want = wantsOf(t), has = offersOf(t);
  if (!want.length || !has.length) return;
  const rec = { t: t.id, give: want.map((c) => c.id), get: has.map((c) => c.id), at: Date.now() };
  trades.push(rec); persistTrades(); drawList(); tick(12);
  toast(`Proposed to ${t.name}: ${rec.give.length} of yours for ${rec.get.length} of ${t.name}'s. ${balanceText(has, want, t)}.`, () => { trades = trades.filter((x) => x !== rec); persistTrades(); drawList(); });
});
// Debug builds only: the tests' hook learns about the table (window.__w exists only there).
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { tbl: { get: () => tbl }, strip: { get: () => strip }, slotRect: { value: slotRect }, TRADERS: { value: TRADERS }, wantsOf: { value: wantsOf }, offersOf: { value: offersOf } }); }, 0);
