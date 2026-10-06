// ---------- the trophy room (round 16, bold) ----------
// After its day on the shelf a trophy leaves the wall. The case at the end of the wall is one row, a door:
// "Trophy room", how many, what they're worth, and every plaque's engraving as a thin strip. Tap it and the screen
// becomes the room, its own level like the trade table: the wall slides off to the left and the room slides in, dark
// wood shelves with the plaques lit, newest at the top, rows you scroll; Back (or a pinch) returns to the wall where
// it was. Tap a plaque and it comes forward as its sealed album opens behind it; Back from the album returns to the
// room. The new idea: every plaque carries its worth over the last year as a thin line (made up: each card's price
// walked back month by month with a seeded drift, summed, cached per plaque), and the room's header sums the whole
// case with the same line, so the room reads as what finishing has been worth. A set's master and grand set
// trophies stack behind the set's plaque; tap the stack and they fan out beneath it.
// The room borrows the wall's scroll: while it is up, mScroll and mMax are the room's, and the wall's scroll is kept
// to come back to. The plaques are laid out in mosaic coordinates, so a tap, a spread, the open transition, the
// press and the search rings all work on them unchanged.

const DOOR_H = 64, ROOM_HEAD = 128, ROW_H = 118, SUB_H = 66, SHELF_H = 12, MONTHS = 12;
const room = { on: false, q: 0, anim: null, closing: false, wallScroll: 0, pinch: null, fan: null, slots: [], L: null, sum: null };
const DOOR = { door: true, name: "Trophy room", cards: [], lead: [], m: null };
const inCase = (g) => Boolean(g.done && !onShelf(g));
const caseList = () => groups.filter(inCase).sort(byFinish);
const inR = (r, x, y) => Boolean(r) && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const lerpRect = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });

// ----- worth over time: a seeded drift per card, summed per plaque, cached -----
// Each card's price is walked back a year, month by month: w[12] is today (1), each earlier month divides by a step
// seeded by the card and the month, with a small lean per card so some climb and some sink. Pricier tiers swing more.
function walkOf(c) {
  if (c.walk) return c.walk;
  const w = new Array(MONTHS + 1); w[MONTHS] = 1;
  const lean = (h32(`drift|lean|${c.id}`) - 0.42) * 0.025, amp = 0.05 + 0.012 * (c.tier || 0);
  for (let i = MONTHS; i > 0; i--) { const step = (h32(`drift|${i}|${c.id}`) - 0.5) * amp + lean; w[i - 1] = w[i] / (1 + step); }
  return (c.walk = w);
}
function seriesOf(g) {
  const worth = worthOf(g.base), key = `${g.base.length}|${Math.round(worth * 100)}`;
  if (g.ser?.key === key) return g.ser;
  const pts = new Array(MONTHS + 1).fill(0);
  for (const c of g.base) { if (!c.owned) continue; const w = walkOf(c); for (let i = 0; i <= MONTHS; i++) pts[i] += c.price * w[i]; }
  return (g.ser = { key, pts, worth, delta: pts[MONTHS] - pts[0] });
}
function caseSeries() {
  const dn = caseList(), parts = dn.map(seriesOf), key = dn.map((g) => doneKey(g)).join(",") + "|" + parts.map((s) => s.key).join(",");
  if (room.sum?.key === key) return room.sum;
  const pts = new Array(MONTHS + 1).fill(0);
  for (const s of parts) for (let i = 0; i <= MONTHS; i++) pts[i] += s.pts[i];
  return (room.sum = { key, pts, worth: pts[MONTHS], delta: pts[MONTHS] - pts[0], n: dn.length });
}
const deltaText = (d) => (Math.abs(d) < 0.5 ? "Steady this year" : `${d > 0 ? "Up" : "Down"} ${short(Math.abs(d))} this year`);
// A thin line, the area under it tinted, the last point marked. Draws on any context: plaques are rendered once,
// offscreen, and kept.
function drawWorthLine(x, pts, px, py, w, h, col, dim) {
  let lo = Infinity, hi = -Infinity;
  for (const v of pts) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(hi - lo, Math.max(1, hi) * 0.08), n = pts.length - 1;
  const X = (i) => px + (w * i) / n, Y = (v) => py + h - ((v - lo + (span - (hi - lo)) / 2) / span) * h;
  x.beginPath();
  for (let i = 0; i <= n; i++) { if (i) x.lineTo(X(i), Y(pts[i])); else x.moveTo(X(0), Y(pts[0])); }
  x.lineTo(X(n), py + h); x.lineTo(X(0), py + h); x.closePath();
  x.fillStyle = dim; x.fill();
  x.beginPath();
  for (let i = 0; i <= n; i++) { if (i) x.lineTo(X(i), Y(pts[i])); else x.moveTo(X(0), Y(pts[0])); }
  x.lineWidth = 1.5; x.strokeStyle = col; x.lineJoin = "round"; x.stroke();
  x.beginPath(); x.arc(X(n), Y(pts[n]), 2.2, 0, Math.PI * 2); x.fillStyle = col; x.fill();
}

// ----- the stack: a set's other views (master set, grand set) finished too -----
const stackOf = (g) => (g.set ? ["set", "master", "grand"].filter((s) => s !== scopeOf(g.set) && done[`${g.set.id}|${s}`]) : []);
const scopeName = (g, s) => `${g.name}${s === "master" ? " master set" : s === "grand" ? " grand set" : ""}`;
function subInfo(g, s) {
  const st = g.set, list = s === "set" ? st.cards : [...st.cards, ...st.master, ...(s === "grand" ? st.grand : [])], f = done[`${st.id}|${s}`];
  return { title: scopeName(g, s), line: `Finished ${dayOf(f.at)}`, worth: worthOf(list), list };
}
// The fan's rows (pseudo blocks a tap lands on), and the stack's badge.
function fanRows(g) { g.subs ||= {}; return stackOf(g).map((s) => (g.subs[s] ||= { pick: { g, scope: s }, lead: [], cards: [] })); }

// ----- layout -----
// The door on the wall: one row at the end, the engravings along its bottom. The trophies' tiles live in the strip,
// so a trophy coming down from the shelf shrinks into it and a search ring still finds a card.
function caseLayout(R, y) {
  const dn = caseList();
  room.slots = [];
  if (!dn.length) { trophyCase = null; DOOR.m = null; return 0; }
  trophyCase = { x: R.x, y, w: R.w, h: DOOR_H }; DOOR.m = trophyCase; caseSeries();
  const n = dn.length, gap = 5, x0 = R.x + PG + 12, w = R.w - PG * 2 - 24, sw = (w - gap * (n - 1)) / n, ey = y + DOOR_H - PG - 17;
  dn.forEach((g, i) => { const m = { x: x0 + i * (sw + gap), y: ey, w: sw, h: ENGR_H }; room.slots.push({ g, ...m }); g.plq = plaqueInfo(g); if (!room.on) { g.m = m; packStrip(g, m); } });
  return DOOR_H;
}
function packStrip(g, m) { const n = g.base.length, cw = m.w / n; g.base.forEach((c, i) => { c.m = { x: m.x + i * cw, y: m.y, w: cw, h: m.h }; }); }
// The room: a header, then rows of plaques on shelves, newest first. One across on a phone, two on a wide screen.
const roomPlate = (m) => ({ x: m.x + PG, y: m.y + 8, w: m.w - PG * 2, h: m.h - 8 - SHELF_H - 4 });
function roomLayout() {
  const dn = caseList(), W = Math.min(vw, 760), R = { x: (vw - W) / 2 + 8, w: W - 16 };
  const cols = R.w >= 560 ? 2 : 1, cw = R.w / cols, y0 = topPad() + ROOM_HEAD, rows = [];
  let y = y0;
  for (let i = 0; i < dn.length; i += cols) {
    const row = dn.slice(i, i + cols), fan = row.find((g) => g === room.fan), h = ROW_H + (fan ? stackOf(fan).length * SUB_H : 0);
    row.forEach((g, j) => {
      g.m = { x: R.x + j * cw, y, w: cw, h: ROW_H }; g.plq = plaqueInfo(g); packRoomPlaque(g);
      g.fanR = stackOf(g).length ? { x: g.m.x + g.m.w - PG - 12 - 150, y: g.m.y + 8, w: 150, h: 34 } : null; // the badge, and the worth beside it
      g.fanBtn ||= { fan: g, lead: [], cards: [] };
      if (g === room.fan) fanRows(g).forEach((r, k) => { r.m = { x: g.m.x, y: y + ROW_H + k * SUB_H, w: cw, h: SUB_H }; });
    });
    rows.push({ y: y + h - SHELF_H - 4, h: SHELF_H });
    y += h;
  }
  room.L = { R, cols, rows, y0 };
  mMax = Math.max(0, y + botPad() + 10 - vh);
  mScroll = clamp(mScroll, 0, mMax);
}
function packRoomPlaque(g) {
  const p = roomPlate(g.m), n = g.base.length, ew = p.w - 24, cw = Math.min(ew / n, ENGR_H * TW / TH), ex = p.x + 12, ey = p.y + p.h - 20;
  g.base.forEach((c, i) => { c.m = { x: ex + i * cw, y: ey, w: cw, h: ENGR_H }; });
}
function layoutAll() {
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); }
  groups.forEach(binderLayout);
  const keep = mScroll;
  if (lifted) { newPanel = null; liftedLayout(); } else mosaicLayout();
  if (room.on) { if (!caseList().length) { endRoom(); return; } if (room.fan && !inCase(room.fan)) room.fan = null; mScroll = keep; strip = null; roomLayout(); }
}
function syncShelfPad() { document.body.style.setProperty("--shelf-h", view === "mosaic" && shelf && mode === "set" && !room.on ? `${shelf.h}px` : "0px"); }
// The shelf's timer (a trophy's day is up) waits while the room is open, as it does under the table.
function shelfLayout(R) {
  const dn = groups.filter((g) => g.done && onShelf(g)).sort(byFinish);
  clearTimeout(shelfTimer);
  if (!dn.length) { shelf = null; syncShelfPad(); return 0; }
  const h = plaqueRows(dn, R, R.y) + 2;
  shelf = { y: R.y, h };
  const next = Math.min(...dn.map((g) => finishOf(g).at + DAY)) - Date.now() + 100;
  shelfTimer = setTimeout(() => { if (view === "mosaic" && !state.trans && !gesture && !tbl.on && !room.on) shelfMorph(); else { layoutAll(); kick(); } }, clamp(next, 100, 2e9));
  syncShelfPad();
  return h;
}

// ----- opening and closing -----
function openRoom() {
  if (room.on || state.trans || tbl.on || view !== "mosaic" || !caseList().length) return;
  hideCaption(); cancelPress(); closePop(true); tick(8);
  room.on = true; room.closing = false; room.wallScroll = mScroll; room.fan = null; room.pinch = null; mScroll = 0;
  layoutAll();
  document.body.classList.add("inroom"); setChrome();
  room.q = reduced ? 1 : 0; room.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 520 };
  kick();
}
function closeRoom(instant = false) {
  if (!room.on || room.closing) return;
  room.closing = true; room.fan = null; room.pinch = null;
  if (instant || reduced) { room.q = 0; room.anim = null; endRoom(); return; }
  room.anim = { from: room.q, to: 0, t0: performance.now(), dur: 160 + 320 * room.q }; tick(6); kick();
}
function endRoom() {
  room.on = false; room.closing = false; room.anim = null; room.q = 0; room.pinch = null; room.fan = null;
  mScroll = room.wallScroll; layoutAll();
  document.body.classList.remove("inroom"); setChrome(); kick();
}
function stepRoomAnim(now) {
  const a = room.anim; if (!a) return false;
  const p = clamp((now - a.t0) / a.dur, 0, 1); room.q = a.from + (a.to - a.from) * ease(p);
  if (p >= 1) { room.anim = null; room.q = a.to; if (a.to === 0) endRoom(); }
  return true;
}
function finishRoomAnim() { if (!room.anim) return; const a = room.anim; room.anim = null; room.q = a.to; if (a.to === 0) endRoom(); }
function toggleFan(g) {
  if (!inCase(g)) return;
  tick(4); room.fan = room.fan === g ? null : g; layoutAll();
  const m = g.m; if (room.fan && m.y + m.h + stackOf(g).length * SUB_H - mScroll > vh - botPad()) mScroll = clamp(m.y - topPad() - 10, 0, mMax);
  kick();
}
// A fanned plaque: the set switches to that view and its album opens from the room.
function openScope(g, s) {
  if (state.trans || !g.set) return;
  room.fan = null;
  setScope(g.set, s); // rearranges and relays the room: g is still a trophy, now keyed on this view
  if (inCase(g)) enterGroup(g); else { layoutAll(); kick(); }
}
function enterGroup(g, { then = null } = {}) {
  if (state.trans) return;
  if (g.door) { openRoom(); return; }
  if (g.fan) { toggleFan(g.fan); return; }
  if (g.pick) { openScope(g.pick.g, g.pick.scope); return; }
  hideCaption(); tick(8);
  state.trans = openTrans(g, 0, fitCam(g)); state.trans.then = then;
  settle(1, 720);
}
// Back from an album opened in the room returns to the room; an album that stopped being a trophy (Back to the
// wall in its header), or a slide to a neighbouring set, closes onto the wall.
function exitToMosaic() {
  if (state.trans || view !== "set") return;
  if (room.on && state.g && !inCase(state.g)) endRoom();
  unfocus(); tick(6);
  inertia = false; fly = null;
  const m = state.g.m; if (m.y - mScroll < topPad() || m.y + m.h - mScroll > vh - botPad()) mScroll = clamp(m.y - topPad() - 10, 0, mMax);
  state.trans = openTrans(state.g, 1, cam);
  settle(0, 620);
}
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on && !room.on;
  backBtn.setAttribute("aria-label", room.on && view !== "set" ? "Back to the wall" : "Back to everything");
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : room.on ? "Trophy room" : "";
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); updateCount();
}
backBtn.onclick = () => { if (tbl.on) closeTable(); else if (view === "set") exitToMosaic(); else if (room.on) closeRoom(); };
document.getElementById("count").addEventListener("click", () => { if (view === "mosaic" && room.on) closeRoom(); });
document.addEventListener("keydown", (e) => {
  if (!room.on || view !== "mosaic" || tbl.on || document.activeElement === qIn) return;
  if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); e.stopImmediatePropagation(); closeRoom(); }
}, true);
// The room steps aside for anything that navigates the wall: a lens, a search, the list.
lensBox.addEventListener("click", () => { if (room.on) closeRoom(true); }, true);
qIn.addEventListener("input", () => { if (room.on) closeRoom(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (room.on) closeRoom(true); }, true);

// ----- hit testing: the door on the wall; the plaques, the stack badge and the fan in the room -----
function hit(sx, sy, nearest = false) {
  if (state.trans) return null;
  if (view === "mosaic") {
    if (room.on && room.closing) return null;
    if (room.on && room.anim) finishRoomAnim();
    const y = sy + mScroll;
    if (room.on) {
      for (const g of caseList()) {
        if (g.fanR && inR(g.fanR, sx, y)) return { block: g.fanBtn };
        if (g === room.fan) for (const r of fanRows(g)) if (inR(r.m, sx, y)) return { block: r };
        if (inR(g.m, sx, y)) return { block: g };
      }
      if (!nearest) return null;
      let best = null, bd = Infinity;
      for (const g of caseList()) { const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
      return best && bd < 60 ? { block: best } : null;
    }
    if (inR(DOOR.m, sx, y)) return { block: DOOR };
    for (const g of groups) if (g.m && !inCase(g) && inR(g.m, sx, y)) return { block: g };
    if (!nearest) return null;
    let best = null, bd = Infinity;
    for (const g of groups) { if (!g.m || inCase(g)) continue; const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
    return best && bd < 60 ? { block: best } : null;
  }
  const g = state.g; if (!g) return null;
  const p = toWorld(sx, sy);
  if (p.x < g.x || p.x > g.x + g.w || p.y < g.y || p.y > g.y + g.h) return null;
  if (p.y < g.y + g.head) return { block: g };
  const col = Math.floor((p.x - g.x) / stepX(g)), row = Math.floor((p.y - g.y - g.head) / stepY(g));
  const inX = (p.x - g.x) - col * stepX(g) <= TW * g.sz, inY = (p.y - g.y - g.head) - row * stepY(g) <= TH * g.sz;
  const card = col < g.cols ? g.cards[row * g.cols + col] : null;
  return card && inX && inY ? { card, block: g } : { block: g };
}
// A pinch in the room closes it under the fingers (a quick pinch closes whatever the distance); a spread on the
// door opens the room; a spread on a plaque opens its album, as on the wall.
function pinchMove(a, b) {
  const g = gesture, d = dist(a, b), m = mid(a, b), r = d / g.d0, now = evT || performance.now();
  if (g.snap) return;
  if (view === "mosaic") {
    if (room.on) {
      if (room.pinch || (r < 1 && !state.trans)) {
        if (!room.pinch) { room.pinch = { q0: room.q, qs: [] }; room.anim = null; }
        room.q = clamp(room.pinch.q0 - (1 - r) / 0.55, 0, 1); room.pinch.qs.push({ q: room.q, t: now }); kick(); return;
      }
      if (!g.g?.done) return;
    } else if (g.g?.door) { if (r > 1.12) { g.snap = true; openRoom(); } return; }
    else if (g.g && (g.g.fan || g.g.pick)) return;
    if (!g.g) return;
    const q = clamp((r - 1) / 1.1, 0, 1);
    if (!state.trans && q > 0.01) state.trans = openTrans(g.g, 0, fitCam(g.g));
    if (state.trans?.kind === "open" && !state.trans.anim) { state.trans.q = q; g.qs.push({ q, t: now }); kick(); }
    return;
  }
  if (state.trans && state.trans.kind !== "open") return;
  const f = fitCam(state.g), s = g.cam.s * r;
  g.m = m; g.r = r;
  if (s < f.s * 0.995) {
    if (g.noClose) { Object.assign(cam, f); kick(); return; }
    if (!state.trans) { Object.assign(cam, f); state.trans = openTrans(state.g, 1, f); g.closeD = d * (f.s / s); }
    if (!state.trans.anim) { const q = clamp(1 - (1 - d / (g.closeD || d)) / 0.6, 0, 1); state.trans.q = q; g.qs.push({ q, t: now }); }
    kick(); return;
  }
  if (state.trans && !state.trans.anim) { state.trans = null; g.closeD = 0; g.qs = []; }
  const sc = Math.min(s, maxS());
  const wx = g.cam.x + g.m0.x / g.cam.s, wy = g.cam.y + g.m0.y / g.cam.s;
  cam.s = sc; cam.x = wx - m.x / sc; cam.y = wy - m.y / sc;
  clampCam(state.g);
  kick();
}
function releasePinch() {
  const g = gesture, T = state.trans;
  if (g.snap) return;
  if (room.pinch) {
    const qs = room.pinch.qs, last = qs[qs.length - 1]; room.pinch = null;
    let first = qs.find((s) => last && last.t - s.t < 160);
    if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
    const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
    const to = Math.abs(v) > 0.0011 ? (v > 0 ? 1 : 0) : room.q > 0.5 ? 1 : 0;
    if (to === 0) closeRoom(); else { room.anim = { from: room.q, to: 1, t0: performance.now(), dur: 160 + 300 * (1 - room.q) }; kick(); }
    return;
  }
  if (T?.kind === "open" && !T.anim) {
    const qs = g.qs, last = qs[qs.length - 1];
    let first = qs.find((s) => last && last.t - s.t < 160);
    if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
    const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
    let to;
    if (Math.abs(v) > 0.0011) to = v > 0 ? 1 : 0;
    else to = T.q > (view === "mosaic" ? 0.35 : 0.65) ? 1 : 0;
    settle(to);
  } else if (view === "set" && state.g && cam.s < fitCam(state.g).s) flyTo(fitCam(state.g), 260);
  else if (view === "set" && state.g && !g.noClose && g.r > 1.15 && g.m && cam.s > fitCam(state.g).s * 1.8) {
    const h = hit(g.m.x, g.m.y);
    let c = h?.card || null;
    if (!c) { let bd = Infinity; for (const x of state.g.cards) { const r = binderRect(x, cam), d = Math.hypot(r.x + r.w / 2 - g.m.x, r.y + r.h / 2 - g.m.y); if (d < bd) { bd = d; c = x; } } }
    if (c) focus(c);
  }
}

// ----- drawing -----
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "slot", "slot-line", "ink", "muted", "deal", "gold", "panel", "panel-solid", "paper", "paper-ink", "plaque", "plaque-ink", "plaque-hi", "plaque-lo", "door", "door-hi", "door-ink", "door-muted", "room-bg", "room-bg2", "room-wood", "room-wood-hi", "room-ink", "room-muted", "room-plaque", "room-plaque-ink", "room-plaque-lo", "room-up", "room-down"]) theme[k] = cs.getPropertyValue(`--${k}`).trim();
  theme.panelFill = cs.getPropertyValue("--panel-fill").trim();
  if (typeof heatCache !== "undefined") heatCache.clear();
  theme.dark = cs.colorScheme === "dark" || matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
}
function drawCaseLabel() { /* the door draws in its place */ }
// The door on the wall.
function drawDoor(now, alpha) {
  const t = trophyCase; if (!t || state.trans) return;
  const m = mr(t); if (m.y > vh || m.y + m.h < 0) return;
  const x = m.x + PG, y = m.y + PG, w = m.w - PG * 2, h = m.h - PG * 2, s = room.sum || caseSeries();
  ctx.globalAlpha = alpha;
  rr(x, y, w, h, 12); ctx.fillStyle = theme.door; ctx.fill();
  ctx.save(); rr(x, y, w, h, 12); ctx.clip(); ctx.fillStyle = theme["door-hi"]; ctx.fillRect(x, y, w, 1.5); ctx.restore();
  if (state.press?.g === DOOR) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; rr(x, y, w, h, 12); ctx.stroke(); }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "right"; ctx.fillStyle = theme["door-muted"]; font(600, 13);
  const stat = `${s.n} ${s.n === 1 ? "trophy" : "trophies"} · ${short(s.worth)}  ›`;
  ctx.fillText(stat, x + w - 12, y + 22);
  const sw = textW(stat);
  ctx.textAlign = "left"; ctx.fillStyle = theme["door-ink"]; font(800, 15.5, true); ctx.fillText(fitText("Trophy room", w - sw - 32), x + 12, y + 22);
  for (const sl of room.slots) { ctx.fillStyle = "rgb(0 0 0 / .35)"; ctx.fillRect(sl.x - 1, sl.y - mScroll - 1, sl.w + 2, sl.h + 2); ctx.drawImage(engravingOf(sl.g, sl.w, sl.h), sl.x, sl.y - mScroll, sl.w, sl.h); }
  ctx.globalAlpha = 1;
}
// The wall, as the base draws it, with the door at the end. A trophy inside the case is not drawn as a panel: the
// door shows its engraving (its tiles still draw, in the strip).
function drawWall(now, alpha = 1, except = null) {
  const pick = picking() && wel.picks.size > 0;
  let settling = false;
  for (const g of groups) {
    const t = pick && g.set && !wel.picks.has(g.set.id) ? 0.42 : 1;
    g.pe ??= 1;
    if (Math.abs(g.pe - t) > 0.01) { g.pe += (t - g.pe) * (reduced ? 1 : 0.16); settling = true; } else g.pe = t;
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    if (room.on && inCase(g)) continue;
    const a = alpha * g.pe;
    drawPanel(g, now, a);
    if (inCase(g)) continue; // its strip is part of the door, drawn below the tiles
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, a);
  }
  if (!except && !state.trans) { drawNewPanel(now, alpha); drawDoor(now, alpha); }
  if (!state.trans) for (const g of groups) { if (!inCase(g) || room.on) continue; if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue; for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha * g.pe); }
  if (settling) kick();
}
function drawMosaic(now, alpha = 1, except = null) {
  if (!room.on) { drawWall(now, alpha, except); return; }
  if (stepRoomAnim(now)) kick();
  if (!room.on) { drawWall(now, alpha, except); return; } // the close just finished
  const q = room.q;
  if (q >= 1) { drawRoom(now, alpha, except); return; }
  // Opening or closing: the wall slides off to the left and dims as the room slides in from the right.
  const keep = mScroll; mScroll = room.wallScroll;
  ctx.save(); ctx.translate(-vw * 0.3 * q, 0); drawWall(now, alpha, null); ctx.restore();
  mScroll = keep;
  ctx.fillStyle = `rgb(0 0 0 / ${(0.45 * q).toFixed(3)})`; ctx.fillRect(0, 0, vw, vh);
  ctx.save(); ctx.translate(vw * (1 - q), 0);
  ctx.shadowColor = "rgb(0 0 0 / .5)"; ctx.shadowBlur = 30; ctx.fillStyle = theme["room-bg"]; ctx.fillRect(0, 0, vw, vh); ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
  drawRoom(now, alpha, except);
  ctx.restore();
  kick();
}
function drawRoom(now, alpha = 1, except = null) {
  const L = room.L; if (!L) return;
  live.line = null; // a deal landing on the wall flashes there; its line to the lens bar has nowhere to go here
  ctx.globalAlpha = alpha; ctx.fillStyle = theme["room-bg"]; ctx.fillRect(0, 0, vw, vh);
  // the header: the whole case summed, with its line
  const R = L.R, hy = topPad() - mScroll;
  if (hy + ROOM_HEAD > 0) ctx.drawImage(headerImage(R.w), R.x - PADR, hy - PADR, R.w + PADR * 2, ROOM_HEAD + PADR * 2);
  // the shelves, then the plaques on them
  for (const row of L.rows) {
    const y = row.y - mScroll; if (y > vh || y + row.h < 0) continue;
    ctx.fillStyle = theme["room-wood"]; ctx.fillRect(R.x - 6, y, R.w + 12, row.h);
    ctx.fillStyle = theme["room-wood-hi"]; ctx.fillRect(R.x - 6, y, R.w + 12, 1.5);
    ctx.fillStyle = "rgb(0 0 0 / .35)"; ctx.fillRect(R.x - 6, y + row.h, R.w + 12, 6);
  }
  for (const g of caseList()) {
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h + (g === room.fan ? stackOf(g).length * SUB_H : 0) - mScroll < 0) continue;
    drawPanel(g, now, alpha);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha);
  }
  ctx.globalAlpha = 1;
}
// ----- plates, rendered once and kept (a shadow and a gradient per plate per frame was the slow part) -----
const PADR = 26; // room around a cached plate for its shadow and the views stacked behind it
function fontOn(x, weight, size, narrow = false) { x.font = `${weight} ${Math.round(size * 2) / 2}px ${FONT}`; if ("fontStretch" in x) x.fontStretch = narrow ? "semi-condensed" : "normal"; }
function fitOn(x, t, max) { if (x.measureText(t).width <= max) return t; let s = t; while (s.length > 2 && x.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; }
function rrOn(x, px, py, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(px, py, w, h, r) : x.rect(px, py, w, h); }
function cachedImage(holder, key, w, h, draw) {
  if (holder.img?.key === key) return holder.img.cv;
  const cv = document.createElement("canvas"); cv.width = Math.ceil((w + PADR * 2) * dpr); cv.height = Math.ceil((h + PADR * 2) * dpr);
  const x = cv.getContext("2d"); x.scale(dpr, dpr); x.translate(PADR, PADR);
  draw(x);
  holder.img = { key, cv }; return cv;
}
// A plate, lit from above, with its shadow.
function plateOn(x, px, py, w, h, r, alpha = 1) {
  x.globalAlpha = alpha;
  x.save(); x.shadowColor = "rgb(0 0 0 / .45)"; x.shadowBlur = 14; x.shadowOffsetY = 5; rrOn(x, px, py, w, h, r); x.fillStyle = theme["room-plaque"]; x.fill(); x.restore();
  x.save(); rrOn(x, px, py, w, h, r); x.clip();
  const lit = x.createLinearGradient(0, py, 0, py + h); lit.addColorStop(0, "rgb(255 250 225 / .34)"); lit.addColorStop(0.5, "rgb(255 255 255 / 0)"); lit.addColorStop(1, "rgb(70 40 0 / .18)");
  x.fillStyle = lit; x.fillRect(px, py, w, h);
  x.fillStyle = theme["plaque-hi"]; x.fillRect(px, py, w, 1.5);
  x.fillStyle = theme["room-plaque-lo"]; x.fillRect(px, py + h - 1.5, w, 1.5);
  x.restore();
  x.lineWidth = 1; x.strokeStyle = theme["room-plaque-lo"]; rrOn(x, px + 4.5, py + 4.5, w - 9, h - 9, Math.max(2, r - 3)); x.stroke();
  x.globalAlpha = 1;
}
const look = () => `${dpr}|${theme["room-plaque"]}|${theme["room-ink"]}`;
function headerImage(w) {
  const s = room.sum || caseSeries();
  return cachedImage(room, `${Math.round(w)}|${s.key}|${look()}`, w, ROOM_HEAD, (x) => {
    x.textBaseline = "alphabetic"; x.textAlign = "left"; x.fillStyle = theme["room-ink"]; fontOn(x, 800, 26, true);
    x.fillText("Trophy room", 10, 30);
    x.textAlign = "right"; fontOn(x, 800, 22); x.fillText(short(s.worth), w - 10, 30);
    x.textAlign = "left"; x.fillStyle = theme["room-muted"]; fontOn(x, 600, 12.5);
    x.fillText(`${s.n} ${s.n === 1 ? "trophy" : "trophies"} finished and sealed`, 10, 48);
    x.textAlign = "right"; x.fillStyle = s.delta >= 0 ? theme["room-up"] : theme["room-down"]; fontOn(x, 600, 12.5);
    x.fillText(deltaText(s.delta), w - 10, 48);
    drawWorthLine(x, s.pts, 10, 60, w - 20, 44, theme["room-plaque"], "rgb(230 192 80 / .12)");
    x.fillStyle = theme["room-muted"]; fontOn(x, 500, 10.5); x.textAlign = "left"; x.fillText("A year ago", 10, 116); x.textAlign = "right"; x.fillText("Now", w - 10, 116);
  });
}
function plaqueImage(g, w, h) {
  const stack = stackOf(g), s = seriesOf(g), info = g.plq || (g.plq = plaqueInfo(g)), fan = room.fan === g;
  return cachedImage(g, `${Math.round(w)}|${Math.round(h)}|${stack.length}|${fan ? 1 : 0}|${s.key}|${info.title}|${look()}`, w, h, (x) => {
    for (let i = stack.length; i >= 1; i--) plateOn(x, 7 * i, -6 * i, w - 14 * i, h, 8, 0.75); // the other views behind it
    plateOn(x, 0, 0, w, h, 8);
    const px = 12, pw = w - 24;
    x.textBaseline = "alphabetic"; x.fillStyle = theme["room-plaque-ink"];
    x.textAlign = "right"; fontOn(x, 800, 15); const ww = x.measureText(short(s.worth)).width; x.fillText(short(s.worth), px + pw, 23);
    x.textAlign = "left"; fontOn(x, 800, 15, true); x.fillText(fitOn(x, info.title, pw - ww - 10 - (stack.length ? 92 : 0)), px, 23);
    x.globalAlpha = 0.78; fontOn(x, 600, 11); x.fillText(`Finished ${dayOf(finishOf(g)?.at || Date.now())}`, px, 38); x.globalAlpha = 1;
    x.textAlign = "right"; x.fillStyle = s.delta >= 0 ? "#2E5A14" : "#7A2A14"; fontOn(x, 600, 11); x.fillText(deltaText(s.delta), px + pw, 38);
    if (stack.length) { // the stack's badge
      const bw = 80, bh = 18, bx = px + pw - ww - 10 - bw, by = 10;
      rrOn(x, bx, by, bw, bh, 9); x.fillStyle = "rgb(42 30 5 / .18)"; x.fill();
      x.textAlign = "center"; x.fillStyle = theme["room-plaque-ink"]; fontOn(x, 700, 10.5);
      x.fillText(`${stack.length} behind ${fan ? "▴" : "▾"}`, bx + bw / 2, by + bh / 2 + 3.5);
    }
    drawWorthLine(x, s.pts, px, 46, pw, h - 46 - 24, "rgb(42 30 5 / .9)", "rgb(42 30 5 / .1)"); // the line beneath: worth over the year
    const ey = h - 20;
    x.fillStyle = "rgb(0 0 0 / .22)"; x.fillRect(px - 1, ey - 1, pw + 2, ENGR_H + 2);
    x.drawImage(engravingOf(g, pw, ENGR_H), px, ey, pw, ENGR_H);
  });
}
function rowImage(g, r, w, h) {
  const info = subInfo(g, r.pick.scope);
  return cachedImage(r, `${Math.round(w)}|${Math.round(h)}|${info.title}|${Math.round(info.worth)}|${look()}`, w, h, (x) => {
    plateOn(x, 0, 0, w, h, 7);
    const px = 12, pw = w - 24;
    x.textBaseline = "alphabetic"; x.fillStyle = theme["room-plaque-ink"];
    x.textAlign = "right"; fontOn(x, 800, 14); const ww = x.measureText(short(info.worth)).width; x.fillText(short(info.worth), px + pw, 21);
    x.textAlign = "left"; fontOn(x, 800, 14, true); x.fillText(fitOn(x, info.title, pw - ww - 10), px, 21);
    x.globalAlpha = 0.78; fontOn(x, 600, 11); x.fillText(fitOn(x, `${info.line} · ${info.list.length} cards. Tap to open.`, pw), px, 36); x.globalAlpha = 1;
  });
}
function drawRoomPlaque(g, m, now, alpha, labelAlpha) {
  const T = state.trans, p0 = roomPlate(mr(g.m));
  if (T?.kind === "open" && T.g === g) m = lerpRect(m, { x: m.x - 10, y: m.y - 6, w: m.w + 20, h: m.h + 12 }, T.q); // it comes forward as the album opens behind it
  const p = roomPlate(m), k = p.w / p0.w;
  ctx.globalAlpha = alpha;
  ctx.drawImage(plaqueImage(g, p0.w, p0.h), p.x - PADR * k, p.y - PADR * k, (p0.w + PADR * 2) * k, (p0.h + PADR * 2) * k);
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme["room-ink"]; rr(p.x, p.y, p.w, p.h, 8); ctx.stroke(); }
  if (g.fanR && state.press?.g === g.fanBtn) { rr(p.x + p.w - 12 - 150, p.y + 6, 150, 26, 9); ctx.fillStyle = "rgb(42 30 5 / .14)"; ctx.fill(); }
  ctx.globalAlpha = 1;
  if (room.fan === g) for (const r of fanRows(g)) drawFanRow(g, r, now, alpha);
}
function drawFanRow(g, r, now, alpha) {
  const m = mr(r.m), p = { x: m.x + PG + 10, y: m.y + 2, w: m.w - PG * 2 - 20, h: m.h - SHELF_H - 8 };
  ctx.globalAlpha = alpha; ctx.drawImage(rowImage(g, r, p.w, p.h), p.x - PADR, p.y - PADR, p.w + PADR * 2, p.h + PADR * 2);
  if (state.press?.g === r) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme["room-ink"]; rr(p.x, p.y, p.w, p.h, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m), k = 1;
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)); const a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  if (inCase(g)) {
    if (room.on) { drawRoomPlaque(g, m, now, alpha, labelAlpha); return; }
    if (k < 1 && m.h >= 30) drawPlaque(g, m, now, alpha * (1 - k), 0); // coming down from the shelf: it shrinks through the door
    return;
  }
  if (g.done || g.minting) { drawPlaque(g, m, now, alpha, labelAlpha); return; }
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  if (g.unmint && k < 1) drawPlaque(g, m, now, alpha * (1 - k), 0);
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
  drawBar(g, x, m.y + PG + 30, w, 2, now);
  ctx.globalAlpha = 1;
}

// The toasts name the room rather than the shelf once a trophy has moved there; the list's line too.
function trophyListHTML(show, rows) {
  const fin = groups.filter((g) => g.done).sort(byFinish);
  if (!fin.length) return "";
  return `<section class="lshelf"><h2>Trophies</h2><p class="lsub">Finished and sealed. On the shelf for a day, then in the trophy room. Back to the wall puts one among the others again.</p>${fin.map((g) => {
    const f = finishOf(g), items = g.cards.filter(show), s = seriesOf(g);
    return `<h3 class="lfin">${esc(trophyName(g))}</h3><p class="lsub lfin-line"><span>Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. ${deltaText(s.delta)}.${onShelf(g) ? " On the shelf today." : " In the trophy room."}</span><button type="button" class="pill-btn" data-shelf="${esc(doneKey(g))}">Back to the wall</button></p>${items.length ? rows(items) : ""}`;
  }).join("")}</section>`;
}
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { room: { get: () => room }, openRoom: { value: openRoom }, closeRoom: { value: closeRoom }, caseList: { value: caseList }, toggleFan: { value: toggleFan }, seriesOf: { value: seriesOf }, shelfMorph: { value: shelfMorph } }); }, 0);
