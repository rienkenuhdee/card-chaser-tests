// ---------- the deals tray: a deal is the card itself coming to you ----------
// When a deal appears, the card's tile leaves its panel in the mosaic and slides into a tray along the bottom edge,
// leaving a ghost outline where it came from. Deals land one by one over the first minute, in a fixed order seeded by
// card id, so runs are comparable (with reduced motion they're simply all there). In the tray: tap a chip to open the
// card (the chip grows into it), swipe it up to watch it (it keeps a mark and moves to the front), swipe it down to
// send it home (it flies back to its ghost). The Deals lens button carries the count.
const TRAY_PAD = 160, TRAY_H = 80, TRAY_BOTTOM = 70, CHIP_W = 128, CHIP_H = 64, CHIP_GAP = 8, CHIP_STEP = CHIP_W + CHIP_GAP, TILE_W = 40, TILE_H = 56;
let watchSaved = {}, homeSaved = {};
try { watchSaved = JSON.parse(localStorage.getItem("wall-watch") || "{}") || {}; } catch { watchSaved = {}; }
try { homeSaved = JSON.parse(localStorage.getItem("wall-sent-home") || "{}") || {}; } catch { homeSaved = {}; }
const persistTray = () => { try { localStorage.setItem("wall-watch", JSON.stringify(watchSaved)); localStorage.setItem("wall-sent-home", JSON.stringify(homeSaved)); } catch { /* private mode */ } };
document.getElementById("reset").addEventListener("click", () => { try { localStorage.removeItem("wall-watch"); localStorage.removeItem("wall-sent-home"); } catch { /* fine */ } });

const tray = { items: [], away: new Set(), scroll: 0, off: 0, drag: null, vel: 0, inertia: false, due: new Map(), seq: 0, ever: false, toasted: false };
const flights = [];
let trayLast = 0, lastBadge = -1;

// ----- the mosaic and the binder leave room for the tray -----
function mosaicLayout() {
  const fitH = vh - topPad() - TRAY_PAD;
  const R = { x: 8, y: topPad(), w: vw - 16, h: Math.max(fitH, (cards.length * 340) / (vw - 16)) };
  mMax = Math.max(0, R.y + R.h + TRAY_PAD - vh);
  mScroll = clamp(mScroll, 0, mMax);
  const items = groups.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  const total = items.reduce((a, i) => a + i.v, 0);
  const k = (R.w * R.h) / total;
  const worst = (strip) => { const area = strip.reduce((a, s) => a + s.v * k, 0), h = area / R.w; return Math.max(...strip.map((s) => { const w = (s.v * k) / h; return Math.max(w / h, h / w); })); };
  let y = R.y, i = 0;
  while (i < items.length) {
    let strip = [items[i]], best = worst(strip), j = i + 1;
    while (j < items.length) { const cand = [...strip, items[j]], w = worst(cand); if (w <= best) { strip = cand; best = w; j++; } else break; }
    const area = strip.reduce((a, s) => a + s.v * k, 0), h = area / R.w;
    let x = R.x;
    for (const s of strip) { const w = (s.v * k / area) * R.w; s.g.m = { x, y, w, h }; x += w; }
    y += h; i = j;
  }
  for (const g of groups) {
    const m = g.m, inner = { x: m.x + PG + 6, y: m.y + PG + LABEL, w: m.w - PG * 2 - 12, h: m.h - PG * 2 - LABEL - 6 };
    const n = g.cards.length;
    let best = { t: 0, cols: 1, rows: n };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const t = Math.min(inner.w / cols, (inner.h / rows) * (TW / TH));
      if (t > best.t) best = { t, cols, rows };
    }
    const cw = best.t, ch = cw * TH / TW, tw = cw * 0.86, th = ch - (cw - tw) * TH / TW;
    const gw = best.cols * cw, gh = best.rows * ch;
    const ox = inner.x + (inner.w - gw) / 2, oy = inner.y + Math.max(0, (inner.h - gh) / 2) * 0.5;
    g.cards.forEach((c, k) => { c.m = { x: ox + (k % best.cols) * cw, y: oy + Math.floor(k / best.cols) * ch, w: tw, h: th }; });
  }
}
function clampCam(g) {
  if (!g) return;
  const left = -12 / cam.s, right = g.w + 12 / cam.s - vw / cam.s;
  cam.x = right < left ? (left + right) / 2 : clamp(cam.x, left, right);
  const top = -(topPad() + 6) / cam.s, bottom = g.h + (TRAY_PAD + 20) / cam.s - vh / cam.s;
  cam.y = bottom < top ? top : clamp(cam.y, top, bottom);
}
function exitToMosaic() {
  if (state.trans || view !== "set") return;
  unfocus(); tick(6);
  inertia = false; fly = null;
  const m = state.g.m; if (m.y - mScroll < topPad() || m.y + m.h - mScroll > vh - TRAY_PAD) mScroll = clamp(m.y - topPad() - 10, 0, mMax);
  state.trans = openTrans(state.g, 1, cam);
  settle(0, 620);
}
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "slot", "slot-line", "ink", "muted", "deal", "gold", "panel", "paper", "paper-ink", "panel-solid"]) theme[k] = cs.getPropertyValue(`--${k}`).trim();
  theme.panelFill = cs.getPropertyValue("--panel-fill").trim();
  if (typeof heatCache !== "undefined") heatCache.clear();
  theme.dark = cs.colorScheme === "dark" || matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
}

// A card that's away in the tray leaves only its ghost behind, unless it's the one up close.
function emphasis(c) {
  if (c.away && (c.flight || c !== state.focus)) return 0;
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.16 : 1;
  if (state.lens === "deals") return !c.owned && c.deal ? 1 : 0.1;
  if (state.lens === "value") return c.owned ? 1 : 0.22;
  return 1;
}

// ----- geometry -----
const trayRect = () => ({ x: 8, y: vh - TRAY_BOTTOM - TRAY_H + tray.off * (TRAY_H + TRAY_BOTTOM + 10), w: vw - 16, h: TRAY_H });
const trayMax = () => Math.max(0, tray.items.length * CHIP_STEP - CHIP_GAP + 20 - trayRect().w);
const itemOf = (c) => tray.items.find((it) => it.c === c) || null;
function chipPos(it) { const R = trayRect(); return { x: R.x + 10 + it.px - tray.scroll, y: R.y + 8 + it.dy }; }
function chipTileRect(it) { const p = chipPos(it); return { x: p.x + 4, y: p.y + 4, w: TILE_W, h: TILE_H }; }
function layoutTray() {
  tray.items.sort((a, b) => (b.c.watch ? 1 : 0) - (a.c.watch ? 1 : 0) || b.at - a.at);
  tray.items.forEach((it, i) => { it.tx = i * CHIP_STEP; });
  tray.scroll = clamp(tray.scroll, 0, trayMax());
}
// Where the card's home is on screen right now (its tile in the panel or the binder), or null when it's off this view.
function homeRect(c, now) {
  const g = groups[c.g], T = state.trans;
  if (T?.kind === "open") {
    if (T.g === g) { const k = clamp(T.q * 1.15 - (c.k / g.cards.length) * 0.15, 0, 1), kk = ease(k), B = binderRect(c, T.cam), A = mr(c.m); return { x: A.x + (B.x - A.x) * kk, y: A.y + (B.y - A.y) * kk, w: A.w + (B.w - A.w) * kk, h: A.h + (B.h - A.h) * kk, a: 1 }; }
    return { ...mr(c.m), a: 1 - T.q };
  }
  if (T?.kind === "morph") { if (!c.pm) return null; const k = ease(clamp((now - T.t0 - c.delay) / (T.dur - 520), 0, 1)), a = mr(c.pm), b = mr(c.m); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, a: 1 }; }
  if (T?.kind === "slide") return null;
  if (view === "mosaic") return { ...mr(c.m), a: 1 };
  if (state.g === g) return { ...binderRect(c, cam), a: 1 };
  return null;
}
const offTop = (x) => ({ x, y: -60, w: 12, h: 17 });

// ----- flights: a tile physically travelling between its home, the tray and the card up close -----
function startFlight(f) {
  if (f.c.flight) flights.splice(flights.indexOf(f.c.flight), 1);
  f.t0 = performance.now(); f.lift ||= 0; f.c.flight = f;
  flights.push(f); kick();
}
function stepFlights(now) {
  if (!flights.length) return false;
  for (const f of [...flights]) {
    const p = reduced ? 1 : clamp((now - f.t0) / f.dur, 0, 1), e = ease(p);
    const a = f.from, b = f.to() || f.off();
    const r = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * p) * f.lift, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
    f.cur = r;
    if (p < 1 && r.w > 8) { ctx.save(); ctx.globalAlpha = 1; ctx.shadowColor = "rgb(0 0 0 / .3)"; ctx.shadowBlur = 12 + r.w * 0.2; ctx.shadowOffsetY = 5 + r.w * 0.04; rr(r.x, r.y, r.w, r.h, r.w * 0.045); ctx.fillStyle = theme.slot; ctx.fill(); ctx.restore(); }
    const e0 = f.c.e; f.c.e = 1; ctx.globalAlpha = 1; drawTile(f.c, r.x, r.y, r.w, r.h, now); f.c.e = e0;
    if (p >= 1 && !(f.kind === "focus" && (fly || state.trans))) { flights.splice(flights.indexOf(f), 1); f.c.flight = null; f.done?.(); }
  }
  return true;
}
function flyFromChip(c, dur) {
  const it = itemOf(c);
  const from = c.flight?.cur || (it ? chipTileRect(it) : { x: vw / 2 - TILE_W / 2, y: vh + 20, w: TILE_W, h: TILE_H });
  const g = groups[c.g];
  startFlight({ c, from, kind: "focus", dur, to: () => { const T = state.trans; if (T?.kind === "open" && T.g === g) return binderRect(c, T.cam); return view === "set" && state.g === g ? binderRect(c, cam) : mr(c.m); }, off: () => mr(c.m), done: () => { c.e = 1; kick(); } });
}
function flyToChip(c, from) {
  c.e = 0;
  startFlight({ c, from, kind: "tray", dur: 520, to: () => { const it = itemOf(c); return it ? chipTileRect(it) : null; }, off: () => ({ x: vw / 2 - TILE_W / 2, y: vh + 40, w: TILE_W, h: TILE_H }), done: () => { c.e = 0; kick(); } });
}

// ----- arrivals and departures -----
function arrive(c) {
  const it = { c, px: 0, tx: 0, dy: 0, a: reduced ? 1 : 0, pop: 0, at: ++tray.seq };
  tray.items.push(it); layoutTray(); it.px = it.tx - 24;
  tray.ever = true; c.away = true; tray.away.add(c);
  updateBadge(); tick(3);
  if (c === state.focus) { it.a = 1; return; }
  c.e = 0;
  const from = homeRect(c, performance.now()) || offTop(chipTileRect(it).x);
  startFlight({ c, from, kind: "arrive", dur: 760, lift: 18, to: () => chipTileRect(it), off: () => chipTileRect(it), done: () => { it.pop = performance.now(); tick(4); kick(); } });
  if (!tray.toasted) { tray.toasted = true; toast("Deals come to you. Tap one to look, swipe up to watch, down to send home."); }
}
function removeItem(it, why) {
  const i = tray.items.indexOf(it); if (i < 0) return;
  tray.items.splice(i, 1); layoutTray(); updateBadge();
  const c = it.c;
  if (c === state.focus && !c.flight) { c.away = false; tray.away.delete(c); c.e = 1; kick(); return; }
  const from = c.flight?.cur || chipTileRect(it);
  if (why === "owned" && c.anim && !reduced) c.anim.t0 = performance.now() + 380; // it inks in as it lands
  startFlight({ c, from, kind: "home", dur: 560, lift: why === "home" ? 10 : 0, to: () => homeRect(c, performance.now()), off: () => offTop(from.x), done: () => {
    c.away = false; tray.away.delete(c); c.e = 1;
    if (why === "home") groups[c.g].ripple = { t0: performance.now(), col: c.col, row: c.row };
    trayReconcile();
  } });
}
// Which deals belong in the tray right now: due, still needed, not sent home at this price.
function trayReconcile() {
  const now = performance.now();
  for (const it of [...tray.items]) if (it.c.owned) removeItem(it, "owned");
  for (const [c, t] of tray.due) {
    if (now < t || c.owned || c.away || homeSaved[c.id] === c.deal) continue;
    arrive(c);
  }
  updateBadge(); drawList(); kick();
}
function toggleWatch(it) {
  if (!it) return;
  const c = it.c; c.watch = !c.watch;
  if (c.watch) watchSaved[c.id] = 1; else delete watchSaved[c.id];
  persistTray(); layoutTray(); it.pop = performance.now(); tick(10);
  toast(c.watch ? `Watching ${c.name}. It stays at the front.` : `Stopped watching ${c.name}.`);
  drawList(); kick();
}
function sendHome(it) {
  if (!it) return;
  const c = it.c;
  homeSaved[c.id] = c.deal; persistTray(); tick(6);
  removeItem(it, "home");
  toast(`${c.name} sent home.`, () => { delete homeSaved[c.id]; persistTray(); trayReconcile(); });
  drawList();
}
function openFromTray(c) {
  hideCaption(); finishTransition();
  if (state.trans) return;
  const g = groups[c.g];
  if (view === "set" && state.g === g) { if (state.focus === c) return; tick(5); return focus(c); }
  if (state.focus) unfocus();
  flyFromChip(c, 1300);
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  enterGroup(g, { then: () => focus(c) });
}
const dealsBtn = lensBox.querySelector('[data-lens="deals"]'), badge = document.createElement("b");
badge.className = "badge"; badge.hidden = true; badge.setAttribute("aria-label", "deals in the tray"); dealsBtn.append(badge);
function updateBadge() {
  const n = tray.items.length;
  if (n === lastBadge) return;
  lastBadge = n; badge.textContent = String(n); badge.hidden = !n;
  badge.classList.remove("tick"); void badge.offsetWidth; badge.classList.add("tick");
}

// ----- focus and unfocus: the chip grows into the card up close, and shrinks back when you leave -----
function focus(c, dir = 0) {
  const prev = state.focus;
  if (prev && prev !== c && prev.away && itemOf(prev)) flyToChip(prev, prev.flight?.cur || binderRect(prev, cam));
  if (c.away && !c.flight) flyFromChip(c, 560);
  state.focus = c;
  document.body.classList.add("focused");
  fillPanel(c, dir);
  const top = 70, avail = vh - panelH() - top - 12;
  const ch = Math.min(avail * 0.92, (vw * 0.78) * TH / TW);
  const S = TH * c.sz, s = Math.min(ch / S, maxS() * 1.4);
  const cy = top + avail / 2;
  flyTo({ s, x: c.x + TW * c.sz / 2 - vw / 2 / s, y: c.y + S / 2 - cy / s }, dir ? 360 : 520);
  tick(6);
}
function unfocus() {
  if (!state.focus) return;
  const c = state.focus;
  if (c.away && itemOf(c)) flyToChip(c, c.flight?.cur || binderRect(c, cam));
  state.focus = null;
  document.body.classList.remove("focused");
  if (view === "set" && state.g) { const f = fitCam(state.g); if (cam.s > f.s * 2.2) { const s = f.s * 2.2, cx = cam.x + vw / 2 / cam.s, cy = cam.y + vh / 2 / cam.s; flyTo({ s, x: cx - vw / 2 / s, y: cy - vh / 2 / s }, 380); } }
  kick();
}
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now();
  c.owned = on; c.got = on ? Date.now() : null; saved[c.id] = { on, at: c.got }; persist();
  c.anim = { t0: now, to: on };
  const g = groups[c.g];
  g.ripple = { t0: now, col: c.col, row: c.row };
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  if (on && owned === st.cards.length) { if (mode === "set") g.burst = now; tick(40); toast(`${st.name} complete. ${owned} of ${owned}.`, undo); }
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  updateCount(); drawList(); trayReconcile(); kick();
}

// ----- drawing: ghosts, the tray, the flights, every frame after the wall -----
function kick() {
  if (raf) return;
  raf = requestAnimationFrame(frameWithTray);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; frameWithTray(performance.now()); } }, 120);
}
function frameWithTray(now) { frame(now); trayFrame(now); }
function trayFrame(now) {
  const dt = Math.min(48, now - (trayLast || now)); trayLast = now;
  if (document.body.classList.contains("listmode")) return;
  let busy = false;
  const hideT = state.focus || state.lens === "time" ? 1 : 0;
  if (reduced) tray.off = hideT; else if (Math.abs(tray.off - hideT) > 0.002) { tray.off += (hideT - tray.off) * Math.min(1, dt / 110); busy = true; } else tray.off = hideT;
  for (const it of tray.items) {
    if (reduced) it.px = it.tx; else if (Math.abs(it.px - it.tx) > 0.3) { it.px += (it.tx - it.px) * Math.min(1, dt / 120); busy = true; } else it.px = it.tx;
    const aT = it.c.flight ? 0 : 1;
    if (reduced) it.a = aT; else if (Math.abs(it.a - aT) > 0.01) { it.a += (aT - it.a) * Math.min(1, dt / 160); busy = true; } else it.a = aT;
    if (tray.drag?.it !== it && it.dy) { if (reduced || Math.abs(it.dy) < 0.4) it.dy = 0; else { it.dy *= Math.pow(0.8, dt / 16); busy = true; } }
    if (it.pop && now - it.pop < 420) busy = true;
  }
  if (tray.inertia) { tray.scroll = clamp(tray.scroll - tray.vel * dt, 0, trayMax()); tray.vel *= Math.pow(0.95, dt / 16); if (Math.abs(tray.vel) < 0.02 || tray.scroll <= 0 || tray.scroll >= trayMax()) tray.inertia = false; busy = true; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawGhosts(now);
  drawTray(now);
  if (stepFlights(now)) busy = true;
  if (tray.drag) busy = true;
  ctx.globalAlpha = 1; ctx.setLineDash([]);
  if (busy) kick();
}
function drawGhosts(now) {
  if (!tray.away.size) return;
  const dealsLens = state.lens === "deals" && !state.matches;
  ctx.lineWidth = 1; ctx.strokeStyle = dealsLens ? theme.deal : theme["slot-line"];
  for (const c of tray.away) {
    if (c === state.focus && !c.flight) continue;
    const r = homeRect(c, now);
    if (!r || r.w < 3 || r.y > vh || r.y + r.h < 0) continue;
    ctx.globalAlpha = r.a * (dealsLens ? 0.95 : 0.65);
    if (r.w >= 26) { const d = Math.max(2, r.w * 0.06); ctx.setLineDash([d, d]); rr(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, r.w * 0.045); ctx.stroke(); ctx.setLineDash([]); }
    else ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  ctx.globalAlpha = 1;
}
// How far under market. (Cheap commons have a floor on the made-up deal price, so a few land at market.)
const underLine = (c) => { const pct = Math.round((1 - c.deal / c.price) * 100); return pct > 0 ? `${pct}% under` : "At market"; };
function star(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.46 : r; ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
  ctx.closePath();
}
function drawTray(now) {
  const R = trayRect();
  if (R.y >= vh) return;
  ctx.globalAlpha = 1;
  ctx.save(); ctx.shadowColor = theme.dark ? "rgb(0 0 0 / .5)" : "rgb(18 21 29 / .16)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  rr(R.x, R.y, R.w, R.h, 12); ctx.fillStyle = theme["panel-solid"] || theme.bg; ctx.fill(); ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  ctx.textBaseline = "alphabetic";
  if (!tray.items.length) {
    ctx.textAlign = "center"; ctx.fillStyle = theme.muted; font(500, 13.5);
    ctx.fillText(tray.ever ? "No new deals. Ones you sent home come back if the price drops." : "Deals on cards you need land here.", R.x + R.w / 2, R.y + R.h / 2 + 5);
    return;
  }
  const vis = [];
  for (const it of tray.items) { const p = chipPos(it); if (p.x > R.x + R.w || p.x + CHIP_W < R.x) continue; it.sx = p.x; it.sy = p.y; vis.push(it); }
  const lifted = tray.drag?.axis === "y" ? tray.drag.it : null;
  ctx.save(); rr(R.x + 1, R.y + 1, R.w - 2, R.h - 2, 11); ctx.clip();
  drawChips(vis.filter((it) => it !== lifted), now, false);
  // The strip fades at the edge it can still scroll towards.
  const fill = theme["panel-solid"] || theme.bg, max = trayMax();
  if (tray.scroll < max - 1) { const g = ctx.createLinearGradient(R.x + R.w - 36, 0, R.x + R.w, 0); g.addColorStop(0, "rgb(0 0 0 / 0)"); g.addColorStop(1, fill); ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.fillRect(R.x + R.w - 36, R.y, 36, R.h); }
  if (tray.scroll > 1) { const g = ctx.createLinearGradient(R.x + 36, 0, R.x, 0); g.addColorStop(0, "rgb(0 0 0 / 0)"); g.addColorStop(1, fill); ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.fillRect(R.x, R.y, 36, R.h); }
  ctx.restore();
  if (lifted && vis.includes(lifted)) drawChips([lifted], now, true);
}
function drawChips(list, now, lifted) {
  ctx.textAlign = "left";
  // Four passes, one font each: setting the font is the slow part.
  for (const it of list) {
    const { c, sx, sy } = it;
    if (lifted) { ctx.save(); ctx.shadowColor = "rgb(0 0 0 / .3)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; rr(sx, sy, CHIP_W, CHIP_H, 10); ctx.fillStyle = theme["panel-solid"] || theme.slot; ctx.fill(); ctx.restore(); }
    ctx.globalAlpha = 1;
    rr(sx, sy, CHIP_W, CHIP_H, 10); ctx.fillStyle = lifted ? theme["panel-solid"] || theme.slot : theme.slot; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
    const t = { x: sx + 4, y: sy + 4 };
    if (c.flight) { ctx.globalAlpha = 0.5; const d = 3; ctx.setLineDash([d, d]); rr(t.x + 0.5, t.y + 0.5, TILE_W - 1, TILE_H - 1, 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    else { const e0 = c.e; c.e = 1; drawTile(c, t.x, t.y, TILE_W, TILE_H, now); c.e = e0; }
    if (c.watch && !c.flight) {
      const pop = it.pop && now - it.pop < 420 ? 1 + 0.6 * Math.sin(Math.PI * (now - it.pop) / 420) : 1;
      ctx.globalAlpha = 1; star(t.x + TILE_W - 1, t.y + 2, 7 * pop); ctx.fillStyle = theme.gold; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = lifted ? theme["panel-solid"] || theme.slot : theme.slot; ctx.stroke();
    }
  }
  const lx = 52, lw = CHIP_W - lx - 8;
  // Inside the pocket: which set, which number.
  ctx.textAlign = "center"; font(600, 8, true); ctx.fillStyle = theme.muted;
  for (const it of list) if (!it.c.flight) { ctx.globalAlpha = it.a * 0.9; const st = sets[it.c.si]; ctx.fillText(st.code, it.sx + 4 + TILE_W / 2, it.sy + 4 + TILE_H - 13); ctx.fillText(String(it.c.num), it.sx + 4 + TILE_W / 2, it.sy + 4 + TILE_H - 4); }
  ctx.textAlign = "left";
  font(700, 12.5, true); ctx.fillStyle = theme.ink;
  for (const it of list) { ctx.globalAlpha = it.a; ctx.fillText(fitText(it.c.name, lw), it.sx + lx, it.sy + 20); }
  font(700, 14); ctx.fillStyle = theme.deal;
  for (const it of list) { ctx.globalAlpha = it.a; ctx.fillText(short(it.c.deal), it.sx + lx, it.sy + 38); }
  font(500, 10.5); ctx.fillStyle = theme.muted;
  for (const it of list) { ctx.globalAlpha = it.a; ctx.fillText(underLine(it.c), it.sx + lx, it.sy + 54); }
  ctx.globalAlpha = 1;
  // While a chip is being dragged up or down, say what letting go will do.
  if (lifted) {
    const it = list[0], up = it.dy < 0, armed = Math.abs(it.dy) > 36;
    if (Math.abs(it.dy) > 16) {
      const label = up ? (it.c.watch ? "Stop watching" : "Watch") : "Send home";
      font(700, 12.5); const w = ctx.measureText(label).width + 22;
      const px = it.sx + CHIP_W / 2 - w / 2, py = up ? it.sy - 36 : it.sy + CHIP_H + 12;
      rr(px, py, w, 26, 13); ctx.fillStyle = armed ? theme.ink : theme.muted; ctx.globalAlpha = armed ? 1 : 0.7; ctx.fill();
      ctx.fillStyle = theme.bg; ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.fillText(label, px + w / 2, py + 17.5); ctx.textAlign = "left";
    }
  }
}

// ----- input: touches and the mouse inside the tray never reach the wall -----
const inTray = (x, y) => { if (tray.off > 0.5 || state.focus || document.body.classList.contains("listmode")) return false; const R = trayRect(); return x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h; };
function itemAt(x, y) {
  const R = trayRect(), lx = x - R.x - 10 + tray.scroll, i = Math.floor(lx / CHIP_STEP), it = tray.items[i];
  if (!it || lx < 0 || lx - i * CHIP_STEP > CHIP_W) return null;
  return y >= R.y + 6 && y <= R.y + 10 + CHIP_H ? it : null;
}
function trayDown(id, x, y, mouse = false) {
  hideCaption(); tray.inertia = false;
  if (!arrMenu.hidden) setMenu(false);
  tray.drag = { id, x, y, t: performance.now(), s0: tray.scroll, it: itemAt(x, y), axis: null, mouse, samples: [{ x, t: performance.now() }] };
  kick();
}
function trayMove(x, y) {
  const d = tray.drag; if (!d) return;
  const dx = x - d.x, dy = y - d.y, now = performance.now();
  d.samples.push({ x, t: now }); if (d.samples.length > 8) d.samples.shift();
  if (!d.axis) { if (Math.hypot(dx, dy) < 8) return; d.axis = Math.abs(dy) > Math.abs(dx) * 1.2 && d.it ? "y" : "x"; }
  if (d.axis === "x") tray.scroll = clamp(d.s0 - dx, 0, trayMax());
  else { const m = Math.abs(dy), r = m > 60 ? 60 + (m - 60) * 0.35 : m; d.it.dy = Math.sign(dy) * r; }
  kick();
}
function trayUp(cancelled = false) {
  const d = tray.drag; if (!d) return;
  tray.drag = null;
  if (cancelled) { kick(); return; }
  if (!d.axis) { if (d.it) openFromTray(d.it.c); kick(); return; }
  if (d.axis === "y") {
    const it = d.it;
    if (it.dy < -36) toggleWatch(it);
    else if (it.dy > 36) sendHome(it);
    kick(); return;
  }
  const now = performance.now(), s0 = d.samples.find((s) => now - s.t < 90) || d.samples[0], last = d.samples[d.samples.length - 1];
  if (s0 && last && !reduced) { const v = (last.x - s0.x) / Math.max(1, last.t - s0.t); if (Math.abs(v) > 0.2) { tray.vel = v; tray.inertia = true; } }
  kick();
}
document.addEventListener("touchstart", (e) => {
  if (tray.drag && !tray.drag.mouse) { e.stopPropagation(); e.preventDefault(); return; }
  if (gesture || e.touches.length !== 1) return;
  const t = e.touches[0];
  if (!inTray(t.clientX, t.clientY)) return;
  e.stopPropagation(); e.preventDefault();
  trayDown(t.identifier, t.clientX, t.clientY);
}, { capture: true, passive: false });
document.addEventListener("touchmove", (e) => {
  if (!tray.drag || tray.drag.mouse) return;
  e.stopPropagation(); e.preventDefault();
  const t = [...e.touches].find((t) => t.identifier === tray.drag.id);
  if (t) trayMove(t.clientX, t.clientY);
}, { capture: true, passive: false });
for (const type of ["touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!tray.drag || tray.drag.mouse) return;
  e.stopPropagation(); e.preventDefault();
  if (![...e.touches].some((t) => t.identifier === tray.drag.id)) trayUp(type === "touchcancel");
}, { capture: true, passive: false });
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.target !== canvas || !inTray(e.clientX, e.clientY)) return; e.stopPropagation(); trayDown("mouse", e.clientX, e.clientY, true); }, true);
document.addEventListener("pointermove", (e) => { if (!tray.drag?.mouse) return; e.stopPropagation(); trayMove(e.clientX, e.clientY); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (!tray.drag?.mouse) return; e.stopPropagation(); trayUp(type === "pointercancel"); }, true);
document.addEventListener("wheel", (e) => {
  if (!inTray(e.clientX, e.clientY)) return;
  e.preventDefault(); e.stopPropagation();
  tray.scroll = clamp(tray.scroll + (e.deltaX || e.deltaY), 0, trayMax()); kick();
}, { capture: true, passive: false });

// ----- the list: the tray as text -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "deals" ? !c.owned && c.deal : true);
  const live = tray.items.length ? `<section><h2>Live deals</h2><p class="lsub">${tray.items.length} on cards you need. Tap a card to mark it.</p><ul>${tray.items.map(({ c }) => {
    const st = sets[c.si];
    return `<li class="ltray"><button class="lrow" data-i="${c.i}" aria-pressed="false"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice"><b class="ldeal">Deal ${money(c.deal)}</b></span><span class="lstate">${underLine(c)}</span></button><span class="lacts"><button class="pill-btn" data-watch="${c.i}" aria-pressed="${Boolean(c.watch)}">${c.watch ? "Watching" : "Watch"}</button><button class="pill-btn" data-home="${c.i}">Send home</button></span></li>`;
  }).join("")}</ul></section>` : "";
  listEl.querySelector("#list-body").innerHTML = live + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? "Have it" : c.away ? "In the tray" : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => {
  const w = e.target.closest("[data-watch]"); if (w) { toggleWatch(itemOf(cards[Number(w.dataset.watch)])); return; }
  const h = e.target.closest("[data-home]"); if (h) sendHome(itemOf(cards[Number(h.dataset.home)]));
});

// ----- the schedule: one deal at a time over the first minute, same order every run -----
const dealCards = cards.filter((c) => c.deal).sort((a, b) => h32(a.id + "arrive") - h32(b.id + "arrive"));
dealCards.forEach((c, k) => {
  c.watch = Boolean(watchSaved[c.id]); c.away = false; c.flight = null;
  const t = reduced ? 0 : 2200 + k * 2500 + h32(c.id + "jitter") * 900;
  tray.due.set(c, t);
  setTimeout(trayReconcile, Math.max(0, t - performance.now()) + 1);
});
