// ---------- the trophy room (round 16) ----------
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
// Escape or Backspace closes the room.
document.addEventListener("keydown", (e) => {
  if (!room.on || view !== "mosaic" || tbl.on || document.activeElement === qIn) return;
  if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); e.stopImmediatePropagation(); closeRoom(); }
}, true);
// The room steps aside for anything that navigates the wall: a lens, a search, the list.
lensBox.addEventListener("click", () => { if (room.on) closeRoom(true); }, true);
qIn.addEventListener("input", () => { if (room.on) closeRoom(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (room.on) closeRoom(true); }, true);

// ----- drawing -----
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
