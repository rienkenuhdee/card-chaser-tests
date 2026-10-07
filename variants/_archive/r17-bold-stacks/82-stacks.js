// ---------- stacks: copies are physical (round 17, bold) ----------
// Every card you own has a copy count. A card with extra copies is drawn as a little stack at every level: the copies
// you keep are tucked behind it (edges peeking out below and to the right), and the copies up for trade are slid up
// out of the stack (edges peeking out above and to the left). An extra copy someone chases has a gold edge: the
// nearest copy up for trade, or, if none is up yet, the nearest one in the stack (an invitation to flick it).
// The import brings realistic doubles, seeded by card id and weighted toward commons and uncommons; common doubles
// go straight up for trade, rarer ones stay in the stack, so the Trade lens has something in it from the start.
// Up close, flick the top copy up and it slides off the stack into the trade pile above the card; pull down to bring
// one back. "Spare one" on the card panel does the same, "Add a copy" adds one, and a completed trade takes one copy
// off the stack instead of the card. The counts live in wall-copies: { id: [copies, up for trade] }.

let copies = {}, copiesSaved = false;
try { const raw = localStorage.getItem("wall-copies"); copiesSaved = raw != null; copies = JSON.parse(raw || "{}") || {}; } catch { copies = {}; }
const persistCopies = () => { try { localStorage.setItem("wall-copies", JSON.stringify(copies)); } catch { /* private mode */ } };
const poolById = new Map(pool.map((c) => [c.id, c]));
// How likely the import is to bring more than one, by rarity tier, and how many.
const DOUBLE_P = [0.5, 0.42, 0.24, 0.12, 0.06, 0.04, 0.03];
function seedCopies(c) {
  if (c.of || h32(`dbl|${c.id}`) >= DOUBLE_P[clamp(c.tier, 0, 6)]) return null;
  const more = 1 + Math.floor(Math.pow(h32(`dbn|${c.id}`), 2) * (c.tier <= 1 ? 4 : 2));
  return [1 + more, c.tier <= 1 ? more : 0]; // common doubles up for trade; rarer ones stay in the stack
}
// Spares marked on the base wall (one flag per card) become one extra copy, up for trade.
let copiesChanged = false;
for (const [id, on] of Object.entries(spares || {})) { const c = poolById.get(id); if (on && c?.owned && !copies[id]) { copies[id] = [2, 1]; copiesChanged = true; } }
// A wall imported before copies existed gets the import's doubles once.
try { if (!copiesSaved && localStorage.getItem("wall-imported")) for (const c of cards) if (c.owned && c.own0 && !copies[c.id]) { const s = seedCopies(c); if (s) { copies[c.id] = s; copiesChanged = true; } } } catch { /* fine */ }
if (copiesChanged) persistCopies();

const copiesOf = (c) => (c.owned ? copies[c.id]?.[0] || 1 : 0);
const sparesOf = (c) => (c.owned ? copies[c.id]?.[1] || 0 : 0);
const keptOf = (c) => Math.max(0, copiesOf(c) - 1 - sparesOf(c)); // extra copies still in the stack
function setCopies(c, n, s) {
  n = Math.max(1, Math.round(n)); s = clamp(Math.round(s), 0, n - 1);
  if (n === 1) delete copies[c.id]; else copies[c.id] = [n, s];
  persistCopies();
}
const spareCopies = () => cards.reduce((a, c) => a + sparesOf(c), 0);
const wantedOf = (c) => { const b = c.base || c; return (b.wantedBy ??= wantedBy(b)); }; // traders' chases are fixed
const whoText = (who) => (who.length <= 2 ? who.map((t) => t.name).join(" and ") : `${who.slice(0, -1).map((t) => t.name).join(", ")} and ${who[who.length - 1].name}`);

// isSpare reads spares[c.id]; now that reads the copies. Setting it (a hold while marking) puts every extra copy up
// for trade, or, with no extra copy, says you have one more and it's up; clearing it keeps them all.
spares = new Proxy({}, {
  get: (_, id) => (typeof id === "string" ? (copies[id]?.[1] || 0) > 0 : undefined),
  set: (_, id, v) => {
    const c = poolById.get(id); if (!c?.owned) return true;
    const n = copiesOf(c), k = keptOf(c);
    if (v) setCopies(c, k > 0 ? n : n + 1, k > 0 ? n - 1 : n); else setCopies(c, n, 0);
    return true;
  },
  deleteProperty: () => true,
});

// ----- drawing the stack -----
const edgeLight = new Map(), edgeDark = new Map();
function edgeOf(h) { const m = theme.dark ? edgeDark : edgeLight; let v = m.get(h); if (!v) { v = shade(h, theme.dark ? -0.42 : -0.3); m.set(h, v); } return v; }
const stackO = (w) => clamp(w * 0.085, 1, 6); // how far each copy sits from the one in front
const raiseY = (o, i) => o * (0.7 + 0.65 * i); // how far a copy up for trade is slid up
// Behind the tile: two slivers per copy on the far-out levels, a rounded card per copy up close. Nothing per tile but
// fillRects and a fill colour (cached per card colour), so the mosaic and a held pinch stay cheap.
function drawStack(c, sx, sy, w, h, now, mult) {
  const r = copies[c.id];
  if (!r || !c.owned || c.away) return;
  let kept = r[0] - 1 - r[1], spare = r[1];
  if (flk && flk.c === c) { if (flk.dir === "up") kept--; else spare--; } // the copy in your hand, or in the air
  if (kept <= 0 && spare <= 0) return;
  if (c.lift && w > h * 1.05) return; // a spare tile out in front draws its own
  if (state.time && !(c.got && c.got <= state.t)) return;
  let a = mult * c.e * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1);
  if (state.introT0 && !reduced) a *= clamp((now - state.introT0 - c.intro) / 360, 0, 1);
  if (c.anim) { const p = clamp((now - c.anim.t0) / 460, 0, 1); a *= c.anim.to ? p : 1 - p; }
  a = Math.min(1, (a - 0.5) * 2); // a card a lens has dimmed shows no stack
  if (a <= 0.02) return;
  const col = edgeOf(state.value && !state.matches ? heat(c.price) : typeColor(c));
  const gold = wantedOf(c).length > 0;
  const o = stackO(w), ns = Math.min(2, Math.max(0, spare)), nk = Math.min(2, Math.max(0, kept));
  ctx.globalAlpha = a;
  if (w < 26 || state.trans) { // far out, or mid-transition: slivers (no paths)
    const gap = o >= 3 ? 1 : 0;
    for (let i = ns; i >= 1; i--) { // slid up: a band above, a sliver to the left
      const dx = -o * 0.5 * i, dy = -raiseY(o, i), px = i > 1 ? -o * 0.5 * (i - 1) : 0, py = i > 1 ? -raiseY(o, i - 1) : 0;
      ctx.fillStyle = gold && i === 1 ? theme.gold : col;
      ctx.fillRect(sx + dx, sy + dy, w, py - dy - gap); ctx.fillRect(sx + dx, sy + dy, px - dx - gap, h);
    }
    for (let i = nk; i >= 1; i--) { // tucked behind: a sliver to the right, a band below
      const d = o * i, p = o * (i - 1);
      ctx.fillStyle = gold && !spare && i === 1 ? theme.gold : col;
      ctx.fillRect(sx + w + p + gap, sy + d, o - gap, h); ctx.fillRect(sx + d, sy + h + p + gap, w, o - gap);
    }
  } else {
    const rad = w * 0.045;
    ctx.lineWidth = 1; ctx.strokeStyle = theme.bg;
    for (let i = ns; i >= 1; i--) { rr(sx - o * 0.5 * i, sy - raiseY(o, i), w, h, rad); ctx.fillStyle = gold && i === 1 ? theme.gold : col; ctx.fill(); ctx.stroke(); }
    for (let i = nk; i >= 1; i--) { rr(sx + o * i, sy + o * i, w, h, rad); ctx.fillStyle = gold && !spare && i === 1 ? theme.gold : col; ctx.fill(); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}

// drawTile from 40-render.js, with the stack behind the tile and, on the card up close, the trade pile and the copy
// in your hand in front of it.
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  drawStack(c, sx, sy, w, h, now, mult);
  drawTile0(c, sx, sy, w, h, now, mult);
  if (c.pop && view === "set" && groups[c.g]?.set && w >= 14 && c.e > 0.3 && (!state.focus || state.focus === c)) {
    const s = clamp(w * 0.36, 4, 18), r = w >= 26 ? w * 0.045 : 0;
    ctx.globalAlpha = Math.min(1, mult) * c.e * 0.8; ctx.fillStyle = theme.gold;
    ctx.beginPath(); ctx.moveTo(sx + w - s, sy); ctx.lineTo(sx + w - r, sy); ctx.lineTo(sx + w, sy + r); ctx.lineTo(sx + w, sy + s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (state.lens === "need" && !c.owned && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
    ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (c === state.focus && view === "set") drawFocusStack(c, sx, sy, w, h, now);
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = col; ctx.globalAlpha = a * tint;
  if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
  if (fp) {
    const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col;
    rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ----- up close: the trade pile above the card, and the flick -----
let flk = null; // the copy in your hand: { c, dir: "up"|"down", dx, dy, phase: "drag"|"fly", commit, from, t0, dur, last, samples }
let cand = null; // a touch that began on the card or the pile, not yet a flick
let pillPulse = 0, flicked = 0, stackDirty = false;
// The trade pile: a pill centred above the card. It counts this card's copies up for trade, or says what to do.
function pileText(c) {
  const s = sparesOf(c) - (flk && flk.c === c && flk.dir === "down" ? 1 : 0);
  if (s > 0) return `${s} up for trade`;
  return keptOf(c) > 0 ? "Flick a copy up to trade it" : "";
}
function pileRect(c, sx, sy, w) {
  if (!c.owned || copiesOf(c) < 2) return null;
  const t = pileText(c); if (!t) return null;
  font(700, 12.5); const tw = textW(t) + 26, ph = 28;
  return { x: sx + w / 2 - tw / 2, y: sy - raiseY(stackO(w), 2) - 10 - ph, w: tw, h: ph, t };
}
const miniAt = (p) => { const h = 30, w = h * TW / TH; return { x: p.x + p.w / 2 - w / 2, y: p.y - 1, w, h }; };
function drawFocusStack(c, sx, sy, w, h, now) {
  const card = { x: sx, y: sy, w, h }, a = state.dimAll;
  const p = pileRect(c, sx, sy, w);
  if (p && a > 0.02) {
    const s = sparesOf(c), gold = s > 0 && wantedOf(c).length > 0;
    const k = pillPulse && !reduced ? clamp((now - pillPulse) / 420, 0, 1) : 1, sc = 1 + 0.14 * Math.sin(Math.PI * k);
    if (k < 1) kick();
    const pw = p.w * sc, ph = p.h * sc, px = p.x + (p.w - pw) / 2, py = p.y + (p.h - ph) / 2;
    ctx.globalAlpha = a;
    rr(px, py, pw, ph, ph / 2); ctx.fillStyle = gold ? goldTint() : theme["panel-solid"]; ctx.fill();
    ctx.lineWidth = gold ? 1.5 : 1; ctx.strokeStyle = gold ? theme.gold : theme["slot-line"]; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; font(700, 12.5);
    ctx.fillStyle = s > 0 ? theme.ink : theme.muted; ctx.fillText(p.t, p.x + p.w / 2, p.y + p.h / 2 + 0.5);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.globalAlpha = 1;
  }
  if (!flk || flk.c !== c) return;
  const pile = miniAt(p || { x: sx + w / 2 - 40, y: sy - 50, w: 80, h: 28 });
  const D = Math.min(170, h * 0.45);
  let r, alpha = 1;
  if (flk.phase === "drag") {
    if (flk.dir === "up") r = { x: sx + flk.dx * 0.2, y: sy + Math.min(10, flk.dy), w, h };
    else { const q = clamp(flk.dy / D, 0, 1); r = lerpR(pile, card, 1 - Math.pow(1 - q, 2)); }
    kick();
  } else {
    const q = flk.dur ? clamp((now - flk.t0) / flk.dur, 0, 1) : 1, e = ease(q);
    const to = flk.dir === "up" ? (flk.commit ? pile : card) : flk.commit ? card : pile;
    r = lerpR(flk.from, to, e);
    if (to === pile) alpha = 1 - 0.7 * e;
    if (q < 1) kick();
  }
  flk.last = r;
  const lift = flk.phase === "drag" ? 1 : 0.6;
  ctx.globalAlpha = 0.26 * alpha; rr(r.x + 2, r.y + 6 + 8 * lift, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill();
  ctx.globalAlpha = alpha; foilOff = true; cardFace(c, r.x, r.y, r.w, r.h, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = 1;
}
function landFlick() {
  const f = flk; if (!f) return;
  flk = null; clearTimeout(f.timer);
  if (f.phase === "fly" && f.commit) { if (f.dir === "up") spareOne(f.c); else keepOne(f.c); }
  kick();
}
// After a count changes: the panel, the list and the Trade lens follow. Up close in a lifted binder the reshuffle
// waits until you leave the card, so the card doesn't move out from under you.
function afterCopies(c) {
  if (state.focus === c) fillPanel(c, 0);
  if (lifted) { if (state.focus) stackDirty = true; else liftLayout(true); }
  drawList(); kick();
}
// No toast: the pile above the card counts, and the panel names who wants it (a flick down is the undo).
function spareOne(c) {
  const n = copiesOf(c), s = sparesOf(c);
  if (keptOf(c) <= 0) return;
  setCopies(c, n, s + 1); flicked++; pillPulse = performance.now(); tick(12);
  afterCopies(c);
}
function keepOne(c) {
  const n = copiesOf(c), s = sparesOf(c);
  if (s <= 0) return;
  setCopies(c, n, s - 1); pillPulse = performance.now(); tick(8);
  afterCopies(c);
}
function addCopy(c) {
  const n = copiesOf(c), s = sparesOf(c);
  setCopies(c, n + 1, s); tick(10);
  const g = groups[c.g]; if (g) g.ripple = { t0: performance.now(), col: c.col, row: c.row };
  toast(`Another ${c.name}. ${n + 1} copies.`, () => { setCopies(c, copiesOf(c) - 1, Math.min(sparesOf(c), copiesOf(c) - 2)); afterCopies(c); });
  afterCopies(c);
}

// The flick, read ahead of the wall's own gestures. A touch that starts on the card (or the pile) and sets off
// vertically, in a direction there's a copy to move, is the flick; anything else (a sideways flick to the next card,
// a tap, a drag elsewhere, a second finger) goes on to the wall as before.
function flickCan(c) { return c && view === "set" && !state.trans && !tbl.on && !pop.c && !marking && c.owned && copiesOf(c) > 1; }
function flickDown(p, mouse) {
  cand = null;
  if (flk?.phase === "fly") landFlick();
  const c = state.focus; if (!flickCan(c)) return;
  const r = binderRect(c, cam), pr = pileRect(c, r.x, r.y, r.w);
  const onCard = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y - 16 && p.y <= r.y + r.h;
  const onPile = pr && p.x >= pr.x - 16 && p.x <= pr.x + pr.w + 16 && p.y >= pr.y - 12 && p.y <= pr.y + pr.h + 12;
  if (onCard || onPile) cand = { x: p.x, y: p.y, onCard, mouse };
}
function flickMove(p) {
  const now = performance.now();
  if (flk?.phase === "drag") {
    flk.dx = p.x - flk.x0; flk.dy = p.y - flk.y0;
    flk.samples.push({ y: p.y, t: now }); if (flk.samples.length > 8) flk.samples.shift();
    kick(); return true;
  }
  if (!cand) return false;
  const dx = p.x - cand.x, dy = p.y - cand.y;
  if (Math.hypot(dx, dy) < 6) return false;
  const c = state.focus, up = dy < 0, k = cand; cand = null;
  if (!flickCan(c) || Math.abs(dy) < Math.abs(dx) * 1.1 || !(up ? k.onCard && keptOf(c) > 0 : sparesOf(c) > 0)) return false;
  gesture = null; cancelPress(); inertia = false;
  flk = { c, dir: up ? "up" : "down", x0: k.x, y0: k.y, dx, dy, phase: "drag", samples: [{ y: k.y, t: now - 16 }, { y: p.y, t: now }], last: null };
  tick(4); kick(); return true;
}
function flickUp(p) {
  cand = null;
  if (!flk || flk.phase !== "drag") return false;
  const now = performance.now();
  if (p) { flk.dx = p.x - flk.x0; flk.dy = p.y - flk.y0; flk.samples.push({ y: p.y, t: now }); }
  const s0 = flk.samples.find((s) => now - s.t < 100) || flk.samples[0], last = flk.samples[flk.samples.length - 1];
  const vy = s0 && last && last.t > s0.t ? (last.y - s0.y) / (last.t - s0.t) : 0;
  const c = flk.c, r = binderRect(c, cam), D = Math.min(170, r.h * 0.45);
  const prog = (flk.dir === "up" ? -flk.dy : flk.dy) / D, v = flk.dir === "up" ? -vy : vy;
  flk.commit = prog > 0.4 || (v > 0.4 && prog > 0.06);
  flk.phase = "fly"; flk.from = flk.last || r; flk.t0 = now;
  flk.dur = reduced ? 0 : flk.commit ? 380 : 220;
  if (!flk.dur) landFlick(); else flk.timer = setTimeout(landFlick, flk.dur + 30);
  kick(); return true;
}
const firstPt = (list) => (list && list.length ? { x: list[0].clientX, y: list[0].clientY } : null);
document.addEventListener("touchstart", (e) => {
  if (e.target !== canvas) return;
  if (e.touches.length !== 1) { if (flk?.phase === "drag") { flk.commit = false; flk.phase = "fly"; flk.from = flk.last || binderRect(flk.c, cam); flk.t0 = performance.now(); flk.dur = reduced ? 0 : 200; flk.timer = setTimeout(landFlick, 230); } cand = null; return; }
  flickDown(firstPt(e.touches), false);
}, { capture: true, passive: false });
document.addEventListener("touchmove", (e) => {
  if (e.target !== canvas || e.touches.length !== 1) return;
  if (flickMove(firstPt(e.touches))) { e.stopImmediatePropagation(); e.preventDefault(); }
}, { capture: true, passive: false });
for (const type of ["touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (e.target !== canvas) return;
  if (flk?.phase === "drag" && !e.touches.length) { e.stopImmediatePropagation(); e.preventDefault(); if (type === "touchcancel") { flk.dy = 0; flk.dx = 0; } flickUp(type === "touchcancel" ? null : firstPt(e.changedTouches)); gesture = null; }
  else if (!e.touches.length) cand = null;
}, { capture: true, passive: false });
document.addEventListener("pointerdown", (e) => { if (e.target === canvas && e.pointerType === "mouse") flickDown({ x: e.clientX, y: e.clientY }, true); }, { capture: true });
document.addEventListener("pointermove", (e) => {
  if (e.target !== canvas || e.pointerType !== "mouse" || !mouseDown) return;
  if (flickMove({ x: e.clientX, y: e.clientY })) e.stopImmediatePropagation();
}, { capture: true });
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => {
  if (e.target !== canvas || e.pointerType !== "mouse") return;
  if (flk?.phase === "drag") { e.stopImmediatePropagation(); mouseDown = false; gesture = null; flickUp({ x: e.clientX, y: e.clientY }); }
  else cand = null;
}, { capture: true });

// focus and unfocus from 52-focus.js: a card you own sits a little lower, under its trade pile; leaving it lands any
// flick in the air, sends the count to the Trade button, and lets a lifted binder take its new shape.
function focus(c, dir = 0) {
  landFlick(); cand = null;
  state.focus = c;
  document.body.classList.add("focused");
  fillPanel(c, dir);
  const top = c.owned ? 114 : 70, avail = vh - panelH() - top - 12;
  const ch = Math.min(avail * 0.92, (vw * 0.78) * TH / TW);
  const S = TH * c.sz, s = Math.min(ch / S, maxS() * 1.4);
  const cy = top + avail / 2;
  flyTo({ s, x: c.x + TW * c.sz / 2 - vw / 2 / s, y: c.y + S / 2 - cy / s }, dir ? 360 : 520);
  lookedAt(c);
  tick(6);
}
function unfocus() {
  if (!state.focus) return;
  landFlick(); cand = null;
  state.focus = null;
  document.body.classList.remove("focused");
  if (view === "set" && state.g) { const f = fitCam(state.g); if (cam.s > f.s * 1.02) flyTo(f, 380); }
  if (flicked) { glowTrade(flicked); flicked = 0; }
  if (stackDirty) { stackDirty = false; if (lifted) setTimeout(() => { if (lifted && !state.focus) liftLayout(true); }, 0); }
  kick();
}

// ----- the Trade button: the copies you flicked arrive with a count -----
const tradeBtn = lensBox.querySelector('[data-lens="trade"]');
const tradeBadge = document.createElement("i"); tradeBadge.className = "lbadge sbadge"; tradeBadge.setAttribute("aria-hidden", "true"); tradeBadge.hidden = true;
tradeBtn.append(tradeBadge);
function glowTrade(n) {
  tradeBadge.textContent = `+${n}`; tradeBadge.hidden = false;
  tradeBtn.classList.remove("sglow"); void tradeBtn.offsetWidth; tradeBtn.classList.add("sglow");
  clearTimeout(glowTrade.t); glowTrade.t = setTimeout(() => { tradeBtn.classList.remove("sglow"); tradeBadge.hidden = true; }, 2800);
}

// ----- the card panel: Spare one, Keep one, Add a copy, and who wants it -----
const pHint = panel.querySelector(".hint"), pBuy = document.getElementById("p-buy");
const HINT0 = pHint.textContent;
function updateFlag(c) {
  if (!c.owned) {
    const on = isChase(c);
    flagBtn.textContent = on ? "Chasing ✓" : "Chase it"; flagBtn.classList.toggle("on", on); flagBtn.setAttribute("aria-pressed", String(on));
    pHint.textContent = HINT0; return;
  }
  const n = copiesOf(c), s = sparesOf(c), k = keptOf(c), who = wantedOf(c);
  flagBtn.textContent = k > 0 || n === 1 ? "Spare one" : "Keep one";
  flagBtn.classList.toggle("on", s > 0); flagBtn.setAttribute("aria-pressed", String(s > 0));
  pBuy.textContent = "Add a copy";
  const meta = document.getElementById("p-meta"), base = meta.textContent.replace(" You have a spare.", "");
  const line = n > 1 ? ` ${n} copies, ${s ? `${s} up for trade` : "none up for trade"}.` : "";
  meta.textContent = `${base}${line}${n > 1 && who.length ? ` ${whoText(who)} want${who.length === 1 ? "s" : ""} this.` : ""}`;
  pHint.textContent = k > 0 && s > 0 ? "Flick a copy up to trade it, or down to keep one." : k > 0 ? "Flick the top copy up to trade it." : s > 0 ? "Pull down to keep one back." : HINT0;
}
// The button equivalent of the flick: the same copy flies the same way.
function flickByButton(c, dir) {
  const r = binderRect(c, cam);
  if (reduced || !state.focus) { if (dir === "up") spareOne(c); else keepOne(c); return; }
  landFlick();
  const p = pileRect(c, r.x, r.y, r.w);
  flk = { c, dir, dx: 0, dy: 0, phase: "fly", commit: true, from: dir === "up" ? { ...r } : miniAt(p || { x: r.x + r.w / 2 - 40, y: r.y - 50, w: 80, h: 28 }), t0: performance.now(), dur: 420, last: null };
  flk.timer = setTimeout(landFlick, 450); kick();
}
flagBtn.onclick = () => {
  const c = state.focus; if (!c) return;
  if (c.owned) {
    if (keptOf(c) > 0) flickByButton(c, "up");
    else if (sparesOf(c) > 0) flickByButton(c, "down");
    else { setCopies(c, 2, 1); flicked++; tick(12); pillPulse = performance.now(); toast(`A second ${c.name}, up for trade.`, () => { setCopies(c, 1, 0); flicked = Math.max(0, flicked - 1); afterCopies(c); }); afterCopies(c); }
    return;
  }
  chasing[c.id] = !isChase(c); persistChase(); updateFlag(c); tick(5); drawList(); if (lifted) liftLayout(true); kick();
  toast(chasing[c.id] ? `${c.name} on your chase list. Pay up to ${money(capOf(c))}.` : `${c.name} off your chase list.`);
};
pBuy.onclick = () => {
  const c = state.focus; if (!c) return;
  if (c.owned) { addCopy(c); return; }
  const st = sets[c.si];
  window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`pokemon ${c.name} ${c.num}/${st.printed} ${st.name}`)}&_sop=15`, "_blank", "noopener");
};

// setOwned from 52-focus.js: taking a card out puts its copies aside (Undo brings them back with it).
const putAside = {};
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now(), b = c.base || c;
  if (!on && copies[b.id]) { putAside[b.id] = copies[b.id]; delete copies[b.id]; persistCopies(); }
  else if (on && !b.owned && putAside[b.id]) { copies[b.id] = putAside[b.id]; delete putAside[b.id]; persistCopies(); }
  b.owned = on; b.got = on ? Date.now() : null; saved[b.id] = { on, at: b.got }; persist();
  for (const t of [b, ...twinsOf(b)]) { t.anim = { t0: now, to: on }; const tg = groups[t.g]; if (tg && (t === c || tg.base?.includes(t) || tg.cards.includes(t))) tg.ripple = { t0: now, col: t.col, row: t.row }; }
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  let sync = null;
  if (quietLayout) doneDirty = true; else sync = syncDone();
  if (sync?.minted.length) { tick(40); toast(finishedText(sync.minted), undo); }
  else if (sync?.freed.length) toast(`${c.name} taken out. ${sync.freed.map(trophyName).join(" and ")} ${sync.freed.length === 1 ? "is" : "are"} back on the wall.`, undo);
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  if (lifted && !quietLayout && !sync) liftLayout(true);
  updateCount(); drawList(); kick();
}

// ----- a trade takes the top copy off the stack -----
// The copy you give leaves; the card stays yours while a copy is left. (A spare from before copies, your only one,
// still leaves the collection.)
function giveCopy(c) {
  const n = copiesOf(c), s = sparesOf(c);
  if (n > 1) { setCopies(c, n - 1, Math.max(0, s - 1)); const g = groups[c.g]; if (g) g.ripple = { t0: performance.now(), col: c.col, row: c.row }; return false; }
  setOwned(c, false, { quiet: true }); return true;
}
function completeTrade(rec, t, landAt = 0) {
  const give = toCards(rec.give), get = toCards(rec.get);
  quietLayout = true;
  for (const c of give) { if (c.owned && giveCopy(c) && landAt) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; } }
  for (const c of get) { delete chasing[c.id]; if (!c.owned) setOwned(c, true, { quiet: true }); else setCopies(c, copiesOf(c) + 1, sparesOf(c)); if (landAt) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; } }
  quietLayout = false;
  persistChase(); syncBadge(); updateCount();
  rec.state = "done"; rec.doneAt = Date.now(); persistTrades(); drawList();
  toast(`${rec.by === "them" ? `${t.name} accepted. ` : ""}${tradedText(get, give, t)}`);
}
function crossOnWall(rec, t) {
  const give = toCards(rec.give).filter((c) => c.owned), get = toCards(rec.get).filter((c) => !c.owned);
  if (reduced || document.body.classList.contains("listmode") || crossing) { completeTrade(rec, t); if (lifted) liftLayout(true); kick(); return; }
  crossing = { rec, t, give, get, n: give.length + get.length };
  const now = performance.now(), step = () => { if (crossing && --crossing.n <= 0) finishCross(); };
  quietLayout = true;
  give.forEach((c, i) => { const last = giveCopy(c); if (lifted && (last || !sparesOf(c))) c.away = true; flyCard(c, true, now + i * 80, 720, step); });
  quietLayout = false;
  get.forEach((c, i) => flyCard(c, false, now + 260 + i * 80, 780, () => { quietLayout = true; setOwned(c, true, { quiet: true }); quietLayout = false; delete chasing[c.id]; persistChase(); step(); }));
  if (!crossing.n) finishCross();
}

// ----- the Trade lens: spare tiles carry their stack and count; the lens counts copies -----
function drawSpareTile(c, x, y, w, h, a, now) {
  const st = sets[c.si], who = wantedOf(c), want = who.length > 0, rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = want ? goldTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = want ? 1.5 : 1; ctx.strokeStyle = want ? theme.gold : theme["slot-line"]; ctx.stroke();
  if (w < 60) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.05), s = clamp(w / 177, 0.6, 1.3);
  const mh = h - pad * 2, mw = mh * TW / TH;
  drawStack(c, x + pad, y + pad, mw, mh, now, a); // the stack behind the little card
  ctx.globalAlpha = a;
  foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  const tx = x + pad + mw + pad + stackO(mw) * Math.min(2, keptOf(c)), tw = x + w - pad - tx;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.ink; font(800, 20 * s); ctx.fillText(short(c.price), tx, y + pad + 17 * s);
  if (want) { ctx.fillStyle = theme.gold; font(700, 11.5 * s); ctx.fillText(fitText(who.length === 1 ? `${who[0].name} wants it` : who.length === 2 ? `${who[0].name} and ${who[1].name} want it` : `${who.length} want it`, tw), tx, y + pad + 32 * s); }
  else { ctx.fillStyle = theme.muted; font(500, 11.5 * s); ctx.fillText(fitText("No takers yet", tw), tx, y + pad + 32 * s); }
  const n = copiesOf(c), sp = sparesOf(c);
  if (n > 1) { ctx.fillStyle = theme.muted; font(600, 11 * s); ctx.fillText(fitText(keptOf(c) ? `${sp} to trade, ${keptOf(c)} kept` : `${sp} to trade`, tw), tx, y + pad + 47 * s); }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}
function panelStat(g) {
  if (picking()) return "  ";
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(rootOf(c))).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") { const d = g.cards.reduce((a, c) => a + sparesOf(c), 0); return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
function setLens(lens) {
  if (lens === state.lens) return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "have") { const n = cards.filter((c) => c.owned).length, d = cards.filter((c) => copiesOf(c) > 1).length; toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection${d ? `, ${d} with copies` : ""}`); }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  const news = lens === "chase" && live.news.some((c) => c.deal && isChase(c) && !c.owned);
  if (lens === "chase" && !news) { const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length; toast(n ? `${n} on your chase list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your chase list yet. Open a card and choose Chase it."); }
  if (lens === "trade") { const n = spareCopies(), w = cards.filter((c) => isSpare(c) && wantedOf(c).length).length; toast(n ? `${n} spare${n === 1 ? "" : "s"} to trade${w ? `, ${w} wanted` : ""}` : "No spares yet. Open a card you have twice and flick a copy up."); }
  if (was === "chase") closePop(true);
  if (news) showDealBar(); else hideDealBar();
  liftLayout(); drawList(); updateCount(); kick();
}

// ----- the import brings copies -----
function finishImport(src) {
  if (!wel.on) return;
  const now = performance.now(), chaseAll = wChase.checked;
  let n = 0, k = 0, d = 0;
  for (const c of pool) {
    if (c.owned || !c.own0) { if (chaseAll && !c.owned) { chasing[c.id] = true; k++; } continue; }
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; n++;
    const sc = !c.of && !copies[c.id] ? seedCopies(c) : null; if (sc) { copies[c.id] = sc; d++; }
    if (!reduced) c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true };
  }
  persist(); persistCopies(); if (chaseAll) persistChase();
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  updateCount(); drawList();
  const sync = syncDone({ quiet: true });
  if (lifted && !sync) liftLayout(true);
  tick(14);
  setTimeout(() => toast(`${n.toLocaleString()} cards imported from ${src}, ${d} with copies. Common doubles are up for trade.${chaseAll ? ` ${k.toLocaleString()} on your chase list.` : ""}`), reduced ? 100 : 500);
  kick();
}
// Reset the demo forgets the copies too.
document.getElementById("reset").addEventListener("click", () => { try { localStorage.removeItem("wall-copies"); } catch { /* fine */ } });

// ----- the list: the same counts in words -----
function ownedText(c) {
  const n = copiesOf(c), s = sparesOf(c), who = wantedOf(c);
  if (n < 2) return "Have it";
  return `${n} copies${s ? `, ${s} up for trade` : ""}${who.length ? `. ${whoText(who)} want${who.length === 1 ? "s" : ""} one` : ""}`;
}
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}<p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
  }
  if (state.lens === "trade") top = tradeListHTML();
  const row = (c) => {
    const st = sets[c.si];
    return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? ownedText(c) : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
  };
  const rows = (items) => `<ul>${items.map(row).join("")}</ul>`;
  listEl.querySelector("#list-body").innerHTML = top + trophyListHTML(show, rows) + groups.map((g) => {
    if (g.done) return "";
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}</p><ul>${items.map(row).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { copies: { get: () => copies }, copiesOf: { value: copiesOf }, sparesOf: { value: sparesOf }, keptOf: { value: keptOf }, setCopies: { value: setCopies }, focus: { value: focus }, unfocus: { value: unfocus }, flk: { get: () => flk }, binderRect: { value: binderRect }, finishImport: { value: finishImport }, startImport: { value: startImport }, completeTrade: { value: completeTrade }, crossOnWall: { value: crossOnWall }, spareCopies: { value: spareCopies } }); }, 0);
