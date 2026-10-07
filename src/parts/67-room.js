// ---------- Trophies: the trophy room (round 16), a room on the map since round 21, in the app's own look (round 22) ----------
// After its day on the shelf a trophy leaves the wall for Trophies, the room on the map (90-rooms.js; its id is still
// "medal"), its only way in. A pinch (or the rooms button) goes up to the map, a sideways flick to the next room. Tap a
// plaque and it comes forward as its sealed album opens behind it; Back from the album returns to the room. Every
// plaque carries its worth over the last year as a thin line (made up: each card's price walked back month by month
// with a seeded drift, summed, cached per plaque), and the room's header sums the whole case with the same line. A
// set's master and grand set trophies stack behind the set's plaque; tap the stack and they fan out beneath it.
// Round 19 moved production's medals in (68-medals.js): the header sums them, then the Showcase, Next up and the
// filters, then one shelf per set or chase, a finished one's plaque at the head of its shelf with its medals beneath.
// Round 22 took off the costume (dark wood, lit plates, shadows): the room is the wall's page with hairline panels,
// Archivo, and the plaques and medals as the only rich colour, in light and dark. Wide screens (landscape, a tablet)
// put the shelves in two columns, clear of the notch.
// The room borrows the wall's scroll: while it is up, mScroll and mMax are the room's, and the wall's scroll is kept
// to come back to. The plaques are laid out in mosaic coordinates, so a tap, a spread, the open transition, the
// press and the search rings all work on them unchanged.

const ROW_H = 112, SUB_H = 58, SHELF_H = 12, MONTHS = 12; // a plaque's block (its plate is 92), a fanned view's row
const room = { on: false, q: 0, anim: null, closing: false, wallScroll: 0, fan: null, L: null, sum: null, plaques: [] };
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
// The trophies past their day are in Trophies. On the wall they keep a place of no size at its end, so a trophy
// leaving the shelf shrinks away there (and a search ring has somewhere to be).
function caseLayout(R, y) {
  for (const g of caseList()) { g.plq = plaqueInfo(g); if (!room.on) { const m = { x: R.x + R.w / 2, y, w: 0, h: 0 }; g.m = m; packStrip(g, m); } }
  return 0;
}
function packStrip(g, m) { const n = g.base.length, cw = m.w / n; g.base.forEach((c, i) => { c.m = { x: m.x + i * cw, y: m.y, w: cw, h: m.h }; }); }
// The notch (and the home bar's corners) in landscape: read from CSS (env(), through --tr-inset-l/r) when the room is laid out.
const roomSafe = document.createElement("div"); roomSafe.id = "room-safe"; roomSafe.setAttribute("aria-hidden", "true"); document.body.append(roomSafe);
function roomInsets() { const s = getComputedStyle(roomSafe); return { l: parseFloat(s.paddingLeft) || 0, r: parseFloat(s.paddingRight) || 0 }; }
// The room: the header, then production's Medal tab (68-medals.js): the Showcase, Next up, the filters and a shelf per
// set or chase, a finished one's plaque at the head of its shelf. Clear of the notch, at most 1,120 wide; from 600 wide
// (a phone on its side, a tablet) the shelves sit in two columns.
const ROOM_GAP = 12;
const roomPlate = (m) => ({ x: m.x + 10, y: m.y + 10, w: m.w - 20, h: m.h - 20 }); // a plaque inside its shelf's panel
function roomLayout() {
  const I = roomInsets(), x0 = I.l + 12, x1 = vw - I.r - 12, W = Math.max(200, Math.min(x1 - x0, 1120));
  const R = { x: Math.round(x0 + (x1 - x0 - W) / 2), w: W }, y0 = topPad(), headH = caseList().length ? 100 : 60;
  R.cols = W >= 600 ? 2 : 1; R.cw = (W - ROOM_GAP * (R.cols - 1)) / R.cols;
  const items = [{ type: "header", x: R.x, y: y0, w: R.w, h: headH }], hits = [], plaques = [], rows = [];
  const y = mdRoomLayout(R, y0 + headH, items, hits, plaques, rows);
  room.plaques = plaques;
  room.L = { R, rows, y0, items, hits, headH };
  mMax = Math.max(0, y + botPad() + 10 - vh);
  mScroll = clamp(mScroll, 0, mMax);
}
// The engraving: the cards' colours in a strip along the bottom of the plate (the tiles live there, so opening the
// plaque grows them into the album).
function packRoomPlaque(g) {
  const p = roomPlate(g.m), n = g.base.length, ew = p.w - 24, cw = Math.min(ew / n, ENGR_H * TW / TH), ex = p.x + 12, ey = p.y + p.h - 18;
  g.base.forEach((c, i) => { c.m = { x: ex + i * cw, y: ey, w: cw, h: ENGR_H }; });
}

// ----- opening and closing -----
// Trophies, from wherever you are (a toast, the import's summary, the celebration card).
function openRoom() { goRoom("medal"); }
// The room up at once, with no slide of its own: it is about to come in as Trophies (from its card on the map,
// or sideways from the next room).
function roomOn() {
  if (room.on) return;
  Object.assign(room, { on: true, closing: false, wallScroll: mScroll, fan: null, anim: null, q: 1 });
  mScroll = 0; layoutAll();
  document.body.classList.add("inroom");
}
// Out of the room to the wall: the wall slides back in (Escape and the rooms button go up to the map instead).
function closeRoom(instant = false) {
  if (!room.on || room.closing) return;
  room.closing = true; room.fan = null;
  if (instant || reduced) { room.q = 0; room.anim = null; endRoom(); return; }
  room.anim = { from: room.q, to: 0, t0: performance.now(), dur: 160 + 320 * room.q }; tick(6); kick();
}
function endRoom() {
  room.on = false; room.closing = false; room.anim = null; room.q = 0; room.fan = null;
  if (rooms.at === "medal") rooms.at = "chase"; // leaving the room lands on the wall
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
// Escape or Backspace goes up to the map.
document.addEventListener("keydown", (e) => {
  if (!room.on || view !== "mosaic" || tbl.on || document.activeElement === qIn || document.querySelector("dialog[open]")) return;
  if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); e.stopImmediatePropagation(); toMap(); }
}, true);
// The room steps aside for anything that navigates the wall: a lens, a search, the list.
lensBox.addEventListener("click", () => { if (room.on) closeRoom(true); }, true);
qIn.addEventListener("input", () => { if (room.on) closeRoom(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (room.on) closeRoom(true); }, true);

// ----- drawing -----
function drawRoom(now, alpha = 1, except = null) {
  const L = room.L; if (!L) return;
  live.line = null; // a deal landing on the wall flashes there; its line to the lens bar has nowhere to go here
  ctx.globalAlpha = alpha; ctx.fillStyle = theme["room-bg"]; ctx.fillRect(0, 0, vw, vh);
  const R = L.R, pg = state.press?.g;
  // the panels, the header, the Showcase, Next up, the filters, and every shelf's heading and rows of medals (drawn once and kept)
  for (const it of L.items) {
    const y = it.y - mScroll; if (y > vh || y + it.h < 0) continue;
    if (it.type === "header") ctx.drawImage(headerImage(R.w, it.h), R.x - PADR, y - PADR, R.w + PADR * 2, it.h + PADR * 2);
    else if (it.type === "row") ctx.drawImage(mdRowImage(it), it.x - PADR, y - PADR, it.w + PADR * 2, it.h + PADR * 2);
    else mdDrawItem(it, y, pg && it.blk === pg);
    ctx.globalAlpha = alpha;
  }
  for (const g of room.plaques) {
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h + (g === room.fan ? stackOf(g).length * SUB_H : 0) - mScroll < 0) continue;
    drawPanel(g, now, alpha);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha);
  }
  // the medal under a finger
  if (pg?.mdt) for (const h of L.hits) if (h.blk === pg && !h.type) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme["room-ink"]; rr(h.x + 2, h.y - mScroll + 2, h.w - 4, h.h - 4, 9); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
// ----- plates, rendered once and kept (a plate is a few fills; drawing the room is a few drawImage calls) -----
const PADR = 26; // room around a cached plate for the views stacked behind it
function fontOn(x, weight, size, narrow = false) { x.font = `${weight} ${Math.round(size * 2) / 2}px ${FONT}`; if ("fontStretch" in x) x.fontStretch = narrow ? "semi-condensed" : "normal"; }
function fitOn(x, t, max) { if (x.measureText(t).width <= max) return t; let s = t; while (s.length > 2 && x.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; }
function rrOn(x, px, py, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(px, py, w, h, r) : x.rect(px, py, w, h); }
function cachedImage(holder, key, w, h, draw) {
  if (holder.img?.key === key) return holder.img.cv;
  const cv = holder.img?.cv || document.createElement("canvas"), W = Math.ceil((w + PADR * 2) * dpr), H = Math.ceil((h + PADR * 2) * dpr); // the same canvas, drawn again: a change never makes a new one
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const x = cv.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.globalAlpha = 1; x.scale(dpr, dpr); x.translate(PADR, PADR);
  draw(x);
  holder.img = { key, cv }; return cv;
}
// A plate: flat gold with a hairline inset, the way the shelf at the top of the wall draws it. No shadow, no light.
function plateOn(x, px, py, w, h, r, alpha = 1) {
  x.globalAlpha = alpha;
  rrOn(x, px, py, w, h, r); x.fillStyle = theme["room-plaque"]; x.fill();
  x.save(); rrOn(x, px, py, w, h, r); x.clip();
  x.fillStyle = theme["plaque-hi"]; x.fillRect(px, py, w, 1);
  x.fillStyle = theme["room-plaque-lo"]; x.fillRect(px, py + h - 1, w, 1);
  x.restore();
  x.globalAlpha = alpha;
  x.lineWidth = 1; x.strokeStyle = theme["room-plaque-lo"]; rrOn(x, px + 4.5, py + 4.5, w - 9, h - 9, Math.max(2, r - 3)); x.stroke();
  x.globalAlpha = 1;
}
const look = () => `${dpr}|${theme["room-plaque"]}|${theme["room-ink"]}|${theme.bg}`;
const upCol = (d) => (d >= 0 ? theme["room-up"] : theme["room-down"]);
// The summary: Trophies, how many earned (and hidden left), and with plaques what the finished ones are worth now and
// over the year. Plain: a title, two short lines, one thin line.
function headerImage(w, h) {
  const L = medalList(), dn = caseList(), s = dn.length ? room.sum || caseSeries() : null;
  const sum = `${L.earned.length} of ${L.list.length} earned${L.hiddenLeft ? ` · ${L.hiddenLeft} hidden` : ""}`;
  return cachedImage(room, `${Math.round(w)}|${h}|${landPhone() ? 1 : 0}|${sum}|${s ? s.key : ""}|${look()}`, w, h, (x) => {
    x.textBaseline = "alphabetic"; x.textAlign = "left"; x.fillStyle = theme["room-ink"]; fontOn(x, 800, landPhone() ? 28 : 32, true); // the size of the other rooms' titles
    x.fillText("Trophies", 4, 32);
    fontOn(x, 600, 13.5); x.fillStyle = theme["room-muted"]; x.fillText(sum, 4, 52);
    if (!s) return;
    x.textAlign = "right"; x.fillStyle = theme["room-ink"]; fontOn(x, 800, 22); x.fillText(short(s.worth), w - 4, 32);
    fontOn(x, 600, 12.5); x.fillStyle = upCol(s.delta); x.fillText(deltaText(s.delta), w - 4, 52);
    drawWorthLine(x, s.pts, 4, 62, w - 8, 28, theme.gold, theme.dark ? "rgb(232 190 85 / .12)" : "rgb(185 138 30 / .12)");
  });
}
function plaqueImage(g, w, h) {
  const stack = stackOf(g), s = seriesOf(g), info = g.plq || (g.plq = plaqueInfo(g)), fan = room.fan === g, ride = g.ride || null;
  return cachedImage(g, `${Math.round(w)}|${Math.round(h)}|${stack.length}|${fan ? 1 : 0}|${s.key}|${info.title}|${info.line}|${look()}|${ride ? `${ride.id}${ride.rank}|${theme["m-surface"]}|${mdVer}` : ""}`, w, h, (x) => {
    for (let i = stack.length; i >= 1; i--) plateOn(x, 6 * i, -5 * i, w - 12 * i, h, 7, 0.55); // the other views behind it
    plateOn(x, 0, 0, w, h, 7);
    if (ride) drawMedal(x, ride, 10 + MD_PW / 2, 6, MD_PW); // its Binder Complete, mounted on it
    const px = ride ? 20 + MD_PW : 12, pw = w - px - 12, ink = theme["room-plaque-ink"];
    x.textBaseline = "alphabetic"; x.fillStyle = ink;
    x.textAlign = "right"; fontOn(x, 800, 16); const ww = x.measureText(short(s.worth)).width; x.fillText(short(s.worth), px + pw, 24);
    const bw = stack.length ? 74 : 0;
    x.textAlign = "left"; fontOn(x, 800, 16, true); x.fillText(fitOn(x, info.title, pw - ww - 10 - (bw ? bw + 8 : 0)), px, 24);
    x.globalAlpha = 0.75; fontOn(x, 600, 11.5); x.fillText(info.when, px, 39); x.globalAlpha = 1;
    x.textAlign = "right"; x.globalAlpha = 0.75; fontOn(x, 700, 11.5); x.fillText(deltaText(s.delta), px + pw, 39); x.globalAlpha = 1;
    if (bw) { // the stack's badge: the other views behind it, tap to fan them out
      const bx = px + pw - ww - 10 - bw, by = 10;
      rrOn(x, bx + 0.5, by + 0.5, bw - 1, 19, 6); x.lineWidth = 1; x.strokeStyle = ink; x.globalAlpha = 0.4; x.stroke(); x.globalAlpha = 1;
      x.textAlign = "center"; x.fillStyle = ink; fontOn(x, 700, 11);
      x.fillText(`${stack.length} more ${fan ? "▴" : "▾"}`, bx + bw / 2, by + 13.5);
    }
    drawWorthLine(x, s.pts, px, 46, pw, h - 46 - 24, "rgb(36 24 2 / .85)", "rgb(36 24 2 / .08)"); // worth over the year
    const ey = h - 18, ex = 12, ew = w - 24, sw = Math.min(ew, g.base.length * ENGR_H * TW / TH); // the engraving runs under the medal too
    x.fillStyle = "rgb(0 0 0 / .18)"; x.fillRect(ex - 1, ey - 1, sw + 2, ENGR_H + 2);
    x.drawImage(engravingOf(g, ew, ENGR_H), ex, ey, ew, ENGR_H);
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
    x.globalAlpha = 0.75; fontOn(x, 600, 11.5); x.fillText(fitOn(x, `${info.line} · ${info.list.length} cards`, pw), px, 37); x.globalAlpha = 1;
  });
}
function drawRoomPlaque(g, m, now, alpha, labelAlpha) {
  const T = state.trans, p0 = roomPlate(mr(g.m));
  if (T?.kind === "open" && T.g === g) m = lerpRect(m, { x: m.x - 10, y: m.y - 6, w: m.w + 20, h: m.h + 12 }, T.q); // it comes forward as the album opens behind it
  const p = roomPlate(m), k = p.w / p0.w;
  ctx.globalAlpha = alpha;
  ctx.drawImage(plaqueImage(g, p0.w, p0.h), p.x - PADR * k, p.y - PADR * k, (p0.w + PADR * 2) * k, (p0.h + PADR * 2) * k);
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme["room-ink"]; rr(p.x, p.y, p.w, p.h, 7); ctx.stroke(); }
  if (g.fanR && state.press?.g === g.fanBtn) { const f = g.fanR; rr(f.x, f.y - mScroll, f.w, f.h, 7); ctx.fillStyle = "rgb(36 24 2 / .12)"; ctx.fill(); }
  ctx.globalAlpha = 1;
  if (room.fan === g) for (const r of fanRows(g)) drawFanRow(g, r, now, alpha);
}
function drawFanRow(g, r, now, alpha) {
  const m = mr(r.m), p = { x: m.x + 22, y: m.y + 2, w: m.w - 44, h: m.h - 8 };
  ctx.globalAlpha = alpha; ctx.drawImage(rowImage(g, r, p.w, p.h), p.x - PADR, p.y - PADR, p.w + PADR * 2, p.h + PADR * 2);
  if (state.press?.g === r) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme["room-ink"]; rr(p.x, p.y, p.w, p.h, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
