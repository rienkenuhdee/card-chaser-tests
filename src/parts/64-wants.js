// ---------- wants: the Wants lens is your want list ----------
// A deal is a live listing on a card you're chasing, so deals live inside the want list (round 9). Switching to the
// Wants lens folds the mosaic back and dims it while every card you want deals out of its panel as a big tile,
// stacking from the bottom of the screen up, by set, oldest first; within a set the live deals lead. Tap the circle
// (or swipe the tile sideways) when you get the card: it flies home into its set, is marked owned, and a thumb-reach
// keypad asks what you paid. Any other lens flies everything home and the wall is exactly as it was.
const capOf = (c) => Math.round(c.price * 0.85 * 100) / 100; // the most you'd pay (made up: 85% of market)
let wants = {}, paid = {};
try { wants = JSON.parse(localStorage.getItem("wall-wants") || "{}") || {}; } catch { wants = {}; }
try { paid = JSON.parse(localStorage.getItem("wall-paid") || "{}") || {}; } catch { paid = {}; }
const persistWants = () => { try { localStorage.setItem("wall-wants", JSON.stringify(wants)); localStorage.setItem("wall-paid", JSON.stringify(paid)); } catch { /* private mode */ } };
// Made-up wants, seeded by card id so variants compare; a card with a live deal is a want by definition.
for (const c of cards) c.want0 = Boolean(c.deal) || h32(c.id + "w") < 0.1;
const isWant = (c) => !c.owned && (wants[c.id] ?? c.want0);

// ----- Want it, next to I have it on the card panel -----
const wantBtn = document.getElementById("p-want");
function updateWant(c) {
  const on = isWant(c);
  wantBtn.hidden = c.owned;
  wantBtn.textContent = on ? "Want it ✓" : "Want it";
  wantBtn.classList.toggle("on", on); wantBtn.setAttribute("aria-pressed", String(on));
}
wantBtn.onclick = () => {
  const c = state.focus; if (!c || c.owned) return;
  wants[c.id] = !isWant(c); persistWants(); updateWant(c); tick(5); drawList(); kick();
  toast(wants[c.id] ? `${c.name} on your want list. Pay up to ${money(capOf(c))}.` : `${c.name} off your want list.`);
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
  paid[c.id] = amount; persistWants(); drawList();
  const undo = () => { delete paid[c.id]; setOwned(c, false, { quiet: true }); persistWants(); };
  const left = cards.filter(isWant).length;
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
  if (!isWant(c)) return;
  tick(14);
  setOwned(c, true, { quiet: true });
  openPay(c);
}

// ----- the list model -----
const ROW_H = 86, ROW_GAP = 8, HEAD_H = 34, SET_GAP = 14, PW = 42, PH = Math.round(PW * TH / TW), LX = 10, CIRC = 40;
const wl = { on: false, rows: [], heads: new Map(), items: [], ghosts: [], H: 0, Hcur: 0, scroll: 0, vel: 0, inertia: false, drag: null, q: null, dirty: false, closing: false, open: 0, from: 0, to: 0, t0: 0, last: 0 };
const flights = [];
let safeTop = 0, safeBot = 0;
const readSafe = () => { const cs = getComputedStyle(document.documentElement); safeTop = parseFloat(cs.paddingTop) || 0; safeBot = parseFloat(cs.paddingBottom) || 0; };
const listTopY = () => topPad() + 6 + safeTop;
const listBot = () => botPad() + 10 + safeBot; // above the lens bar
const listTop = () => vh - listBot() - wl.Hcur + wl.scroll;
const availH = () => vh - listBot() - listTopY();
const dealPct = (c) => Math.round((1 - c.deal / c.price) * 100);
// Where the card's tile sits in the wall behind, folded back with it.
function homeRect(c) {
  const r = mr(c.m), o = wl.open;
  if (o <= 0) return r;
  const k = 1 - 0.06 * o, px = vw / 2, py = topPad();
  return { x: px + (r.x - px) * k, y: py + (r.y - py) * k, w: r.w * k, h: r.h * k };
}
const listX = () => Math.max(LX, (vw - 600) / 2), listW = () => vw - listX() * 2;
const pocketRect = (r) => ({ x: listX() + r.dx + CIRC + 6, y: listTop() + r.ycur + (ROW_H - PH) / 2, w: PW, h: PH });
// Sets oldest first, reading down; within a set the live deals lead (best discount first), then the most you'd pay.
const rowOrder = (a, b) => (b.c.deal ? 1 : 0) - (a.c.deal ? 1 : 0) || (a.c.deal && b.c.deal ? dealPct(b.c) - dealPct(a.c) : 0) || capOf(b.c) - capOf(a.c) || a.c.i - b.c.i;
function layoutItems() {
  const bySet = new Map();
  for (const r of wl.rows) { if (wl.q && !matchQ(r.c, wl.q)) continue; if (!bySet.has(r.c.si)) bySet.set(r.c.si, []); bySet.get(r.c.si).push(r); }
  const items = []; let y = 0;
  for (const si of [...bySet.keys()].sort((a, b) => a - b)) {
    const rs = bySet.get(si).sort(rowOrder);
    let h = wl.heads.get(si); if (!h) { h = { kind: "head", si, ycur: null, a: 0 }; wl.heads.set(si, h); }
    h.n = rs.length; h.live = rs.filter((r) => r.c.deal).length; h.cy = y; h.rows = rs; y += HEAD_H;
    if (h.ycur == null) h.ycur = h.cy;
    items.push(h);
    for (const r of rs) { r.cy = y; if (r.ycur == null) r.ycur = r.cy; r.head = h; y += ROW_H + ROW_GAP; items.push(r); }
    y += SET_GAP - ROW_GAP;
  }
  for (const si of [...wl.heads.keys()]) if (!bySet.has(si)) wl.heads.delete(si);
  wl.items = items; wl.H = Math.max(0, y - (SET_GAP - ROW_GAP));
  if (wl.Hcur === 0 || reduced) wl.Hcur = wl.H;
  wl.scroll = clamp(wl.scroll, 0, Math.max(0, wl.H - availH()));
}
// The list follows the wants: a card marked owned leaves, a card wanted again deals back out.
function syncWants(now) {
  const want = new Set();
  for (const c of cards) if (isWant(c)) want.add(c);
  let changed = wl.dirty;
  for (const r of [...wl.rows]) if (!want.has(r.c)) { leaveRow(r, now); changed = true; }
  const have = new Set(wl.rows.map((r) => r.c)), fresh = [];
  for (const c of want) if (!have.has(c)) { const r = { kind: "row", c, cy: 0, ycur: null, a: 0, dx: 0, armed: false }; wl.rows.push(r); fresh.push(r); c.away = true; changed = true; }
  if (changed) { layoutItems(); wl.dirty = false; }
  if (fresh.length) { fresh.sort((a, b) => b.cy - a.cy); fresh.forEach((r, i) => dealRow(r, Math.min(900, i * 22))); }
}
function dealRow(r, delay) {
  const c = r.c, cur = c.flight?.cur;
  startFlight({ c, row: r, kind: "deal", from: cur ? { ...cur } : () => homeRect(c), to: () => pocketRect(r), dur: 560, delay, lift: 28, done: () => { r.a = 1; kick(); } });
}
function leaveRow(r, now) {
  wl.rows.splice(wl.rows.indexOf(r), 1);
  const from = r.c.flight?.cur ? { ...r.c.flight.cur } : pocketRect(r);
  wl.ghosts.push({ kind: "ghost", c: r.c, y: listTop() + r.ycur, dx: r.dx, a: r.a, t0: now });
  startFlight({ c: r.c, kind: "home", from, to: () => homeRect(r.c), dur: 620, delay: 0, lift: 26, done: () => { r.c.away = false; kick(); } });
}
// ----- flights: the tile itself travelling between its panel and the list -----
function startFlight(f) {
  if (f.c.flight) flights.splice(flights.indexOf(f.c.flight), 1);
  f.t0 = performance.now() + (reduced ? 0 : f.delay || 0); f.c.flight = f; f.c.away = true;
  flights.push(f); kick();
}
function stepFlights(now) {
  if (!flights.length) return false;
  for (const f of [...flights]) {
    const p = reduced ? 1 : clamp((now - f.t0) / f.dur, 0, 1), e = ease(p);
    const a = typeof f.from === "function" ? f.from() : f.from, b = f.to();
    const r = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * p) * f.lift, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
    f.cur = r;
    if (f.row) f.row.a = Math.max(f.row.a, clamp((p - 0.45) / 0.4, 0, 1));
    if (p > 0 && p < 1 && r.w > 10) { ctx.globalAlpha = 0.22; rr(r.x + 1, r.y + 2 + r.w * 0.06, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill(); }
    const e0 = f.c.e; f.c.e = 1; ctx.globalAlpha = 1; drawTile(f.c, r.x, r.y, r.w, r.h, now); f.c.e = e0;
    if (p >= 1) { flights.splice(flights.indexOf(f), 1); f.c.flight = null; f.done?.(); }
  }
  return true;
}

// ----- on and off: the lens switches it -----
function enterWants() {
  if (wl.on) return;
  if (state.trans) finishTransition();
  if (state.focus) unfocus();
  leaveMark(); setMenu(false);
  // From inside a set, close it first so the tiles have the wall to leave from.
  if (view === "set") {
    exitToMosaic();
    const T = state.trans;
    if (T) { const done = T.done; T.done = (t) => { done?.(t); enterWants(); }; return; }
    view = "mosaic"; state.g = null; setChrome();
  }
  wl.on = true; wl.closing = false; wl.scroll = 0; wl.vel = 0; wl.inertia = false; wl.drag = null; wl.ghosts = [];
  const q = qIn.value.trim().toLowerCase(); wl.q = q ? q.split(/\s+/) : null; state.matches = null;
  state.introT0 = 0; wl.dirty = true;
  document.body.classList.add("wants");
  wl.t0 = performance.now(); wl.from = wl.open; wl.to = 1;
  readSafe();
  for (const r of wl.rows) if (r.c.flight?.kind === "home") dealRow(r, 0); // caught mid-flight home: turn round
  syncWants(performance.now());
  drawList(); kick();
}
function exitWants() {
  if (!wl.on) return;
  wl.on = false; wl.closing = true; wl.drag = null; wl.inertia = false; closePay();
  document.body.classList.remove("wants");
  wl.t0 = performance.now(); wl.from = wl.open; wl.to = 0;
  const rows = [...wl.rows].sort((a, b) => a.cy - b.cy);
  rows.forEach((r, i) => { const from = r.c.flight?.cur ? { ...r.c.flight.cur } : pocketRect(r); startFlight({ c: r.c, kind: "home", from, to: () => homeRect(r.c), dur: 560, delay: Math.min(500, i * 14), lift: 24, done: () => { r.c.away = false; kick(); } }); });
  wl.q = null;
  const q = qIn.value.trim().toLowerCase(); state.matches = q ? new Set(cards.filter((c) => matchQ(c, q.split(/\s+/)))) : null;
  drawList(); kick();
}

// ----- drawing the list (after the wall, every frame) -----
function stepWantsOpen(now) {
  if (wl.open === wl.to) return false;
  const p = reduced ? 1 : clamp((now - wl.t0) / 480, 0, 1);
  wl.open = wl.from + (wl.to - wl.from) * ease(p);
  return p < 1;
}
function drawRow(r, y, now) {
  const a = r.a; if (a <= 0.01) return;
  const x0 = listX(), W = listW(), c = r.c, st = sets[c.si], dx = r.dx;
  if (Math.abs(dx) > 1) { // the "Got it" strip under a tile as it slides
    const reveal = clamp(Math.abs(dx) / 80, 0, 1);
    rr(x0, y, W, ROW_H, 12); ctx.globalAlpha = a * reveal; ctx.fillStyle = theme["panel-solid"]; ctx.fill();
    ctx.globalAlpha = a * reveal * (r.armed ? 1 : 0.6); ctx.fillStyle = theme.deal; ctx.fill();
    ctx.globalAlpha = a * reveal;
    ctx.fillStyle = "#fff"; font(800, 18, true); ctx.textBaseline = "middle"; ctx.textAlign = dx > 0 ? "left" : "right";
    ctx.fillText("Got it", dx > 0 ? x0 + 20 : x0 + W - 20, y + ROW_H / 2);
  }
  ctx.globalAlpha = a;
  const rx = x0 + dx;
  rr(rx, y, W, ROW_H, 12); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  // The circle: tap it when you get the card (the way a reminder is ticked off).
  ctx.beginPath(); ctx.arc(rx + CIRC / 2 + 2, y + ROW_H / 2, 11, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = r.armed ? theme.deal : theme["slot-line"]; ctx.stroke();
  if (!c.flight) { const p = pocketRect(r); p.y = y + (ROW_H - PH) / 2; const e0 = c.e; c.e = 1; drawTile(c, p.x, p.y, p.w, p.h, now, a); c.e = e0; ctx.globalAlpha = a; }
  const tx = rx + CIRC + PW + 18, capW = 128, tw = W - (CIRC + PW + 18) - capW - 8;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(800, 20, true); ctx.fillText(fitText(c.name, tw), tx, y + 36);
  font(500, 13.5); ctx.fillStyle = theme.muted;
  ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}, ${c.rname}`, tw), tx, y + 58);
  ctx.textAlign = "right";
  if (c.deal) {
    // A live deal: the asking price leads, with what it was and how far under.
    ctx.fillStyle = theme.deal; font(800, 26); ctx.fillText(money(c.deal), rx + W - 14, y + 40);
    ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(`was ${short(c.price)}, ${dealPct(c)}% under`, rx + W - 14, y + 62);
  } else {
    ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText("Pay up to", rx + W - 14, y + 30);
    ctx.fillStyle = theme.ink; font(800, 26); ctx.fillText(money(capOf(c)), rx + W - 14, y + 62);
  }
}
function drawHead(h, y) {
  if (h.a <= 0.01) return;
  const st = sets[h.si], x0 = listX(), W = listW();
  rr(x0, y + 2, W, HEAD_H - 4, 8); ctx.globalAlpha = h.a; ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.fillStyle = st.ink; ctx.fillRect(x0, y + 7, 3, HEAD_H - 14);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(800, 16, true); ctx.fillText(fitText(st.name, W * 0.5), x0 + 13, y + 22);
  ctx.textAlign = "right"; ctx.fillStyle = theme.muted; font(600, 13);
  ctx.fillText(`${h.n} to find${h.live ? `, ${h.live} live` : ""}`, x0 + W - 12, y + 22);
}
function drawEmpty() {
  ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const y = vh - listBot() - 120;
  ctx.fillStyle = theme.ink; font(800, 22, true); ctx.fillText(wl.q ? "Nothing on your want list matches" : "Nothing on your want list yet", vw / 2, y);
  ctx.fillStyle = theme.muted; font(500, 14); ctx.fillText(wl.q ? "Clear the search to see the whole list." : "Open a card and choose Want it.", vw / 2, y + 26);
}
// Returns whether another frame is needed.
function drawWants(now) {
  if (!(wl.on || wl.closing || flights.length || wl.ghosts.length)) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const dt = Math.min(48, now - (wl.last || now)); wl.last = now;
  let more = false;
  if (wl.on) syncWants(now);
  const k = reduced ? 1 : Math.min(1, dt / 140);
  if (Math.abs(wl.Hcur - wl.H) > 0.3) { wl.Hcur += (wl.H - wl.Hcur) * k; more = true; } else wl.Hcur = wl.H;
  if (wl.inertia && !wl.drag) {
    const max = Math.max(0, wl.H - availH());
    wl.scroll = clamp(wl.scroll + wl.vel * dt, 0, max); wl.vel *= Math.pow(0.95, dt / 16);
    if (Math.abs(wl.vel) < 0.02 || wl.scroll <= 0 || wl.scroll >= max) wl.inertia = false; else more = true;
  }
  const top = listTop(), topY = listTopY();
  ctx.save(); ctx.beginPath(); ctx.rect(0, topY, vw, vh - topY); ctx.clip();
  for (const it of wl.items) {
    if (Math.abs(it.ycur - it.cy) > 0.3) { it.ycur += (it.cy - it.ycur) * k; more = true; } else it.ycur = it.cy;
    if (it.kind === "row") {
      const ta = wl.closing ? 0 : it.c.flight ? it.a : 1;
      if (Math.abs(it.a - ta) > 0.01) { it.a += (ta - it.a) * (reduced ? 1 : Math.min(1, dt / 160)); more = true; } else it.a = ta;
      if (!wl.drag || wl.drag.row !== it) { if (Math.abs(it.dx) > 0.5) { it.dx *= reduced ? 0 : Math.pow(0.8, dt / 16); more = true; } else it.dx = 0; }
    } else it.a = it.rows.reduce((m, r) => Math.max(m, r.a), 0);
    const y = top + it.ycur, h = it.kind === "head" ? HEAD_H : ROW_H;
    if (y > vh || y + h < topY) continue;
    if (it.kind === "head") drawHead(it, y); else drawRow(it, y, now);
  }
  for (const g of [...wl.ghosts]) {
    g.a *= reduced ? 0 : Math.pow(0.75, dt / 16); g.dx += g.dx * dt * 0.01;
    if (g.a < 0.03) { wl.ghosts.splice(wl.ghosts.indexOf(g), 1); continue; }
    drawRow(g, g.y, now); more = true;
  }
  if (wl.on && !wl.items.length && !flights.length) drawEmpty();
  ctx.restore();
  if (stepFlights(now)) more = true;
  if (wl.closing && wl.open <= 0 && !flights.length) { wl.closing = false; wl.rows = []; wl.items = []; wl.heads.clear(); wl.ghosts = []; wl.H = wl.Hcur = 0; }
  ctx.globalAlpha = 1;
  return more || wl.closing;
}

// ----- input: while the list is out it owns the touches that start on the canvas -----
const ARM = () => Math.min(150, vw * 0.38);
function rowAt(x, y) {
  if (y < listTopY()) return null;
  const top = listTop();
  for (const it of wl.items) { if (it.kind !== "row") continue; const ry = top + it.ycur; if (y >= ry && y <= ry + ROW_H && x >= listX() && x <= listX() + listW()) return it; }
  return null;
}
function wantsDown(x, y) {
  wl.inertia = false; hideCaption(); if (document.activeElement === qIn) qIn.blur();
  wl.drag = { x, y, t: performance.now(), s0: wl.scroll, row: rowAt(x, y), axis: null, samples: [{ x, y, t: performance.now() }] };
}
function wantsMove(x, y) {
  const d = wl.drag; if (!d) return;
  const dx = x - d.x, dy = y - d.y, now = performance.now();
  d.samples.push({ x, y, t: now }); if (d.samples.length > 8) d.samples.shift();
  if (!d.axis) { if (Math.hypot(dx, dy) < 8) return; d.axis = d.row && Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y"; }
  if (d.axis === "x") {
    const r = d.row; r.dx = clamp(dx, -vw, vw);
    const armed = Math.abs(r.dx) > ARM(); if (armed !== r.armed) { r.armed = armed; tick(armed ? 6 : 3); }
  } else wl.scroll = clamp(d.s0 + dy, 0, Math.max(0, wl.H - availH()));
  kick();
}
function wantsUp(x, y, cancelled) {
  const d = wl.drag; if (!d) return; wl.drag = null;
  if (cancelled) { if (d.row) d.row.armed = false; kick(); return; }
  const now = performance.now();
  const s0 = d.samples.find((s) => now - s.t < 90) || d.samples[0], last = d.samples[d.samples.length - 1];
  const vx = s0 && s0 !== last ? (last.x - s0.x) / Math.max(1, last.t - s0.t) : 0, vy = s0 && s0 !== last ? (last.y - s0.y) / Math.max(1, last.t - s0.t) : 0;
  if (d.axis === "x") {
    const r = d.row, flick = Math.abs(r.dx) > 48 && Math.abs(vx) > 0.7 && Math.sign(vx) === Math.sign(r.dx);
    r.armed = false;
    if (Math.abs(r.dx) > ARM() || flick) gotIt(r.c);
    kick(); return;
  }
  if (d.axis === "y") { if (!reduced && Math.abs(vy) > 0.2) { wl.vel = vy; wl.inertia = true; } kick(); return; }
  // A tap: the circle means you got it; the rest of the tile says what it's worth.
  if (d.row) {
    const c = d.row.c;
    if (x <= listX() + CIRC + 4) return gotIt(c);
    tick(4); toast(`${c.name}: market ${money(c.price)}. Tap the circle when you get it.`);
  }
}
const wantsOwn = () => wl.on || wl.closing;
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!wantsOwn() || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (paying() || !wl.on) return;
  const ts = e.touches;
  if (type === "touchstart") { if (ts.length !== 1) { wantsUp(null, null, true); return; } wantsDown(ts[0].clientX, ts[0].clientY); }
  else if (type === "touchmove") { if (ts.length !== 1) { wantsUp(null, null, true); return; } wantsMove(ts[0].clientX, ts[0].clientY); }
  else if (!ts.length) { const p = e.changedTouches[0]; wantsUp(p?.clientX, p?.clientY, type === "touchcancel"); }
}, { capture: true, passive: false });
let wantsMouse = false;
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !wantsOwn() || e.target !== canvas) return; e.stopImmediatePropagation(); if (paying() || !wl.on) return; wantsMouse = true; wantsDown(e.clientX, e.clientY); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !wantsMouse) return; e.stopImmediatePropagation(); wantsMove(e.clientX, e.clientY); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !wantsMouse) return; wantsMouse = false; e.stopImmediatePropagation(); wantsUp(e.clientX, e.clientY, type === "pointercancel"); }, true);
document.addEventListener("wheel", (e) => {
  if (!wantsOwn() || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (!wl.on) return;
  wl.scroll = clamp(wl.scroll - e.deltaY, 0, Math.max(0, wl.H - availH())); kick();
}, { capture: true, passive: false });
canvas.addEventListener("keydown", (e) => {
  if (!wl.on) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.stopImmediatePropagation(); e.preventDefault(); wl.scroll = clamp(wl.scroll + (e.key === "ArrowUp" ? 120 : -120), 0, Math.max(0, wl.H - availH())); kick(); }
  else if (e.key === "Escape" || e.key === "Backspace") { e.stopImmediatePropagation(); e.preventDefault(); lensBox.querySelector('[data-lens="all"]').click(); }
}, true);
addEventListener("resize", () => { readSafe(); wl.dirty = true; kick(); });
readSafe();
