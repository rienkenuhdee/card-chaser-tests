// ---------- rooms: the app as five places on a map, one level above the wall (round 21) ----------
// Production has five tabs: Feed, Chase, Trade, Medal, Source (here the Medal tab is called Trophies). Here there is no tab bar. The app is a map of five room
// cards one zoom level above the wall, each card live with what's inside (91-room-cards.js). Pinch the wall closed (or
// tap the rooms button at the top left, where Back sits inside a set) and it shrinks into its card while the other four
// settle in around it; spread on a card, or tap it, and that room grows to fill the screen; pinch any room closed to
// come back. At a room's own level a sideways flick goes to the next room along the map, the way a flick moves
// between sets in a binder.
//   Feed    every listing found for the cards you chase, newest first (92-feed.js)
//   Chase   the wall, with its lenses: Collection and Chase
//   Trade   the trade binder's cover, the trade checker, who to trade with (94-trade-room.js); the binder and the
//           table are levels inside it
//   Trophies the trophy room (67-room.js; its id is "medal")
//   Source  where Card Chaser looks, a switch for each (93-source.js)
// Feed, Trade and Source are pages (real lists: they scroll natively, read aloud and show in the list view); Chase and
// Medal are drawn on the canvas. A move up to the map, or into a room, is one transition with a position
// (state.trans "map": q 0 the room, 1 the map), held under the fingers and snapped by speed, then position. A page
// moves by a CSS transform; a canvas room is drawn live at its size every frame. No full-screen pictures are taken:
// iOS caps what all canvases together may hold, and a picture per pinch (with half-size copies) ran past it and left a
// blank screen. The only picture is the wall's on the Chase card, card-sized and reused. A flick between rooms is
// the same idea sideways (state.trans "hop").

const ROOM_COL = { feed: "c-blue", chase: "c-red", trade: "c-green", medal: "c-yellow", source: "c-blue" }; // production's tab colours (Trade's "green" is black now: round 23)
const mapUI = { L: null, press: null, kb: -1, pulse: null, feedIn: null };
let mapSeenOnce = false;
try { mapSeenOnce = localStorage.getItem("wall-map-seen") === "1"; } catch { /* fresh */ }
const mapSeen = () => { if (mapSeenOnce) return; mapSeenOnce = true; try { localStorage.setItem("wall-map-seen", "1"); } catch { /* private mode */ } };
// The map is up a level from anything settled: not while the first run, the import, a trade, a sheet or marking is under way.
const mapReady = () => !wel.on && !story && !ar.on && !tbl.on && !marking && !state.focus && !pop.c && !paying() && !document.body.classList.contains("listmode") && !document.querySelector("dialog[open]");
const SCREEN = () => ({ x: 0, y: 0, w: vw, h: vh });

// ----- the map's layout: one painting (round 23) -----
// The map is a single Mondrian: black rules, white fields and a few primary fields, each room one rectangle of it, full
// bleed. It reads like production's tab bar: Feed along the top, Chase and Trade over Trophies in the middle, Source
// along the bottom. Chase is the biggest: under its red field it holds the wall in the wall's own proportions, so the
// wall shrinks into it without cropping. Adjacent fields' frames make one rule.
const wallBand = () => ({ x: SAFE.left, y: topPad() - 4, w: vw - SAFE.left - SAFE.right, h: vh - botPad() + 4 - (topPad() - 4) });
const DS = { HEAD: 58, LENS: 46 }; // a coloured field's height under a room's name; the Chase card's lens strip
const CARD_HEAD = DS.HEAD;
const dsRW = () => (landPhone() ? 5 : 6); // the painting's rule
function mapLayout() {
  const key = `${vw}|${vh}|${botPad()}|${SAFE.left}|${SAFE.right}|${SAFE.bottom}`;
  if (mapUI.L?.key === key) return mapUI.L;
  if (landPhone()) return (mapUI.L = mapAcross(key));
  const RW = dsRW(), top = topPad() - 2, bottom = vh - 34, avail = bottom - top;
  const fH = Math.round(clamp(avail * 0.2, 128, 178)), sH = Math.round(clamp(avail * 0.155, 108, 142));
  const my = top + fH + RW, mh = avail - fH - sH - RW * 2;
  const B = wallBand(), asp = B.w / B.h;
  let thH = mh - DS.HEAD - DS.LENS - RW * 2, thW = thH * asp;
  const cMax = vw * (vw < 700 ? 0.58 : 0.62);
  if (thW > cMax) { thW = cMax; thH = thW / asp; }
  const cw = Math.round(thW), rx = cw + RW, rw = vw - rx, th = Math.round((mh - RW) * 0.5);
  const r = {
    feed: { x: 0, y: top, w: vw, h: fH },
    chase: { x: 0, y: my, w: cw, h: mh },
    trade: { x: rx, y: my, w: rw, h: th },
    medal: { x: rx, y: my + th + RW, w: rw, h: mh - th - RW },
    source: { x: 0, y: my + mh + RW, w: vw, h: sH },
  };
  const thumb = { x: 0, y: my + DS.HEAD + RW, w: cw, h: thH };
  return (mapUI.L = { key, r, thumb, RW, top, bottom, hintY: vh - 13 });
}
// On a phone on its side (round 22) the map reads across, in the tab bar's order: Feed, then Chase (the biggest, the
// wall's own proportions), then Trade over Trophies, then Source, each a column clear of the notch.
function mapAcross(key) {
  const RW = dsRW(), x0 = SAFE.left, W = vw - SAFE.left - SAFE.right, top = topPad() - 2, bottom = vh - SAFE.bottom - 28, h = bottom - top;
  const B = wallBand(), asp = B.w / B.h, U = W - RW * 3;
  let cw = Math.round(Math.min(U * 0.42, U - 3 * 150)), thW = cw, thH = thW / asp; // the others keep a readable width
  const maxH = h - DS.HEAD - DS.LENS - RW * 2;
  if (thH > maxH) { thH = maxH; thW = thH * asp; cw = Math.round(thW); }
  const sw = Math.round((U - cw) / 3), fx = x0, cx = fx + sw + RW, tx = cx + cw + RW, sx = tx + sw + RW, sW = x0 + W - sx, th = Math.round((h - RW) / 2);
  const r = {
    feed: { x: fx, y: top, w: sw, h },
    chase: { x: cx, y: top, w: cw, h },
    trade: { x: tx, y: top, w: sw, h: th },
    medal: { x: tx, y: top + th + RW, w: sw, h: h - th - RW },
    source: { x: sx, y: top, w: sW, h },
  };
  const thumb = { x: cx, y: top + DS.HEAD + RW, w: cw, h: thH }; // under its name, the lenses under it, and the set closest to done in what's left
  return { key, r, thumb, RW, top, bottom, hintY: vh - SAFE.bottom - 10 };
}
function mapHit(x, y, nearest = false) {
  const L = mapLayout();
  for (const id of ROOMS) if (inR(L.r[id], x, y)) return id;
  if (!nearest) return null;
  let best = null, bd = Infinity;
  for (const id of ROOMS) { const m = L.r[id], d = Math.hypot(Math.max(m.x - x, 0, x - m.x - m.w), Math.max(m.y - y, 0, y - m.y - m.h)); if (d < bd) { bd = d; best = id; } }
  return bd < 60 ? best : null;
}

// ----- a canvas room, live: its screen rect S drawn into D (the same proportions) -----
function drawRoomAt(id, S, D, now) {
  const k = D.w / S.w, fo = foilOff;
  ctx.save();
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (D.x - S.x * k), dpr * (D.y - S.y * k));
  foilOff = true; // nobody sees foil mid-move, and it's the costliest thing on a card
  if (id === "chase") {
    const keep = mScroll; if (room.on) mScroll = room.wallScroll; // the trophy room borrows the wall's scroll
    ctx.fillStyle = theme.bg; ctx.fillRect(S.x, S.y, S.w, S.h);
    if (view === "set" && state.g && !room.on) drawSet(state.g, now); else drawWall(now, 1);
    mScroll = keep;
  } else if (id === "medal" && room.on && room.L) drawRoom(now, 1);
  foilOff = fo;
  ctx.restore(); curFont = ""; // restore puts back the context's font: the cache forgets it
}
// The Chase card's picture of the wall: drawn live into the card once, then kept (card-sized, at most 2x) until the
// wall changes.
const wallPic = { cv: null, key: "" };
function wallThumb(D, now) {
  const key = `${Math.round(D.w)}|${Math.round(D.h)}|${vw}|${vh}|${dpr}|${theme.bg}|${state.lens}|${state.value ? 1 : 0}|${state.time ? Math.round(state.t / 864e5) : 0}|${mode}|${wallVer}|${Math.round(room.on ? room.wallScroll : mScroll)}|${scan.last}|${state.matches ? state.matches.size : -1}`;
  if (wallPic.key === key && wallPic.cv) { ctx.drawImage(wallPic.cv, D.x, D.y, D.w, D.h); return; }
  ctx.save(); rr(D.x, D.y, D.w, D.h); ctx.clip(); drawRoomAt("chase", wallBand(), D, now + 4000); ctx.restore(); curFont = "";
  if (D.x < 0 || D.y < 0 || D.x + D.w > vw || D.y + D.h > vh) return; // not all on screen yet: drawn, not kept
  const k = Math.min(dpr, 2), W = Math.max(1, Math.round(D.w * k)), H = Math.max(1, Math.round(D.h * k));
  const cv = wallPic.cv || (wallPic.cv = document.createElement("canvas"));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  cv.getContext("2d").drawImage(canvas, Math.round(D.x * dpr), Math.round(D.y * dpr), Math.round(D.w * dpr), Math.round(D.h * dpr), 0, 0, W, H);
  wallPic.key = key;
}

// ----- the pages (Feed, Trade, Source): shown while they're the room, or part of a move -----
function pagesOn() {
  const on = new Set(), T = state.trans;
  if (!rooms.map && PAGES[rooms.at]) on.add(rooms.at);
  if (T?.kind === "map" && PAGES[T.room]) on.add(T.room);
  if (T?.kind === "hop") { if (PAGES[T.from]) on.add(T.from); if (PAGES[T.to]) on.add(T.to); }
  return on;
}
function syncPages() {
  const on = pagesOn();
  for (const [id, el] of Object.entries(PAGES)) { const want = on.has(id); if (el.hidden === want) { el.hidden = !want; if (want) renderPage(id); } }
}
function renderPage(id) { if (id === "feed") renderFeed(); else if (id === "trade") renderTrade(); else if (id === "source") renderSource(); }
// A page at its place in a move to or from the map: scaled into D, cut square to its field R, fading as the card's face
// comes up under it.
function pageAt(el, R, D, a) {
  const k = D.w / vw, l = (R.x - D.x) / k, t = (R.y - D.y) / k, w = R.w / k, h = R.h / k;
  el.style.transform = `translate(${D.x.toFixed(2)}px, ${D.y.toFixed(2)}px) scale(${k.toFixed(4)})`;
  el.style.clipPath = `inset(${t.toFixed(1)}px ${(vw - l - w).toFixed(1)}px ${(vh - t - h).toFixed(1)}px ${l.toFixed(1)}px)`;
  el.style.opacity = a.toFixed(3);
}
function pagesRest() { for (const el of Object.values(PAGES)) { el.style.transform = ""; el.style.clipPath = ""; el.style.opacity = ""; } }
// Where a page stands in a move, set before the first frame paints (so it never flashes full screen).
function pagePose(T, now = performance.now()) {
  if (T.kind === "map" && PAGES[T.room]) mapGeom(T, (R, D, fb) => pageAt(PAGES[T.room], R, D, 1 - fb));
  if (T.kind === "hop") { const e = hopE(T, now); for (const [id, ox] of hopPos(T, e)) if (PAGES[id]) PAGES[id].style.transform = `translateX(${ox.toFixed(1)}px)`; }
}

// ----- moving between a room and the map: one transition with a position (q: 0 the room, 1 the map) -----
// Getting a room ready to be drawn or shown (into it from the map, or sideways from the next one).
function enterPrep(id) {
  // The trophy room is a level of the set wall: another grouping steps aside while you're in it and comes back with
  // the wall when you leave (endRoom), so Trophies never changes Group by.
  if (id === "medal") { if (mode !== "set" && !room.on) { room.mode = mode; arrange("set"); } roomOn(); }
  else if (id === "feed") feedEnter();
  else if (PAGES[id]) renderPage(id);
}
// Leaving one: the trophy room ends (the wall gets its scroll back), the Feed's NEW is cleared (only after a visit: a
// spread that starts into a room and settles back onto the map was never in it).
function leaveRoom(id, visited = true) {
  if (id === "medal" && room.on) endRoom();
  if (id === "feed" && visited) feedLeave();
  if (id === "trade" && bnd.on) tbEnd();
}
function beginMap(id, dir) {
  hideTip(); cancelPress(); hideWho(); hideHow(); closePop(true);
  if (dir === "in") { rooms.at = id; enterPrep(id); } else { inertia = false; fly = null; }
  state.trans = { kind: "map", room: id, dir, q: dir === "in" ? 1 : 0, done: mapSettled };
  pagePose(state.trans); setChrome(); kick();
  return state.trans;
}
function mapSettle(to, dur) {
  const T = state.trans; if (!T || T.kind !== "map") return;
  T.anim = { from: T.q, to, t0: performance.now(), dur: reduced ? 1 : dur ?? 200 + 440 * Math.abs(to - T.q) };
  kick();
}
function mapSettled(T) {
  const up = (T.anim ? T.anim.to : T.q) >= 0.5, id = T.room;
  mapUI.press = null;
  if (up) { leaveRoom(id, T.dir === "out"); rooms.at = id; rooms.map = true; mapSeen(); } // on the map; Escape goes back where you were
  else { rooms.map = false; rooms.at = id; if (T.then) setTimeout(T.then, 0); }
  pagesRest(); tick(6); setChrome(); kick();
}
// Speed first, position second: a quick move wins whatever the distance; a slow one goes to the nearer end.
function snapQ(qs, q, mid) {
  const last = qs[qs.length - 1];
  let first = qs.find((s) => last && last.t - s.t < 160);
  if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
  const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
  if (Math.abs(v) > 0.0011) return v > 0 ? 1 : 0;
  return q > mid ? 1 : 0;
}
// Up to the map from a room's own level (the rooms button, Escape, a trackpad pinch).
function toMap() {
  const T = state.trans;
  if (T) { if (T.anim || T.t0) finishTransition(); else return; }
  if (!atRoot() || !mapReady()) return;
  tick(8); beginMap(rooms.at, "out"); mapSettle(1, 600);
}
// Into a room from the map (a tap, a key, the screen reader's button).
function openPlace(id, dur = 640, then = null) {
  if (!rooms.map || state.trans || !ROOMS.includes(id)) return;
  tick(8); beginMap(id, "in").then = then; mapSettle(0, dur);
}
function stepMapTrans(now, T) {
  if (!T.anim) return false;
  const a = clamp((now - T.anim.t0) / T.anim.dur, 0, 1);
  T.q = T.anim.from + (T.anim.to - T.anim.from) * (1 - Math.pow(1 - a, 3));
  if (a < 1) return false;
  state.trans = null; T.done(T);
  return true;
}
// ----- the move between a room and the map, along straight lines (round 23) -----
// q: 0 the room, 1 the map. Up to the map the room narrows to its column first, then closes to its row; into a room
// it's the reverse (a room that already spans the screen one way moves in one phase). Every field carries its own
// rules, so they ride out to the screen's edges with it. The painting is never empty: while the room narrows it keeps
// its full size, cut by its edges like a window, and only shrinks into its card as it closes to its row; and the rest
// of the painting is cut along the room's column (dsPieces), so whatever stands beside the column arrives whole in the
// first phase, at its own height, and what is above and below the room comes in with its edges in the second.
function dsAxes(q, A) {
  if (reduced) { const s = q < 0.5 ? 0 : 1; return [s, s]; }
  if (A.w >= vw * 0.9 || A.h >= vh * 0.7) { const e = ease(q); return [e, e]; }
  return [ease(clamp(q / 0.6, 0, 1)), ease(clamp((q - 0.4) / 0.6, 0, 1))];
}
const dsLerp = (a, b, k) => a + (b - a) * k;
// The geometry of a move at q: the room's field R (the screen, narrowing, then closing to its card), what's drawn into
// it (D: the room at its own size until it closes, then shrinking to the card's width), and how far the card's own
// face has come up (fb).
function mapGeom(T, use) {
  const L = mapLayout(), A = L.r[T.room], q = clamp(T.q, 0, 1), [ex, ey] = dsAxes(q, A);
  const R = { x: A.x * ex, y: A.y * ey, w: dsLerp(vw, A.w, ex), h: dsLerp(vh, A.h, ey) };
  const k = dsLerp(1, A.w / vw, ey), D = { x: R.x, y: R.y - (topPad() - 8) * k * ey, w: vw * k, h: vh * k };
  const fb = reduced ? (q < 0.5 ? 0 : 1) : clamp((q - 0.55) / 0.4, 0, 1);
  use(R, D, fb, ease(q), L, A, ex, ey);
}
// A field's frame: the rule around it, as wide as the painting's rules (adjacent frames make one rule).
function dsFrame(r, RW) { ctx.fillStyle = theme.rule; ctx.fillRect(r.x - RW, r.y - RW, r.w + RW * 2, r.h + RW * 2); }
// Where another room stands while one moves (A its place on the map, R where it is now), as up to three pieces cut
// along A's column: the piece in the column moves up or down with R's edge, the pieces beside it sideways with R's
// sides. Each: the strip [x0, x1] of the room's frame on the map, and how far it has moved.
function dsPieces(r, A, R, RW) {
  const c0 = A.x - RW / 2, c1 = A.x + A.w + RW / 2, l = r.x - RW, rt = r.x + r.w + RW, out = [];
  const dxL = R.x - A.x, dxR = R.x + R.w - A.x - A.w, dy = r.y + r.h <= A.y ? R.y - A.y : R.y + R.h - A.y - A.h;
  if (l < c0) out.push({ x0: l, x1: Math.min(rt, c0), dx: dxL, dy: 0, w0: 0 });
  if (rt > c0 && l < c1) out.push({ x0: Math.max(l, c0), x1: Math.min(rt, c1), dx: dxL, dy, w0: rt > c1 ? R.w - A.w : 0 }); // stretched to R's width while it's still narrowing
  if (rt > c1) out.push({ x0: Math.max(l, c1), x1: rt, dx: dxR, dy: 0, w0: 0 });
  return out;
}
function drawPieces(k, r, A, R, RW, now) {
  const P = dsPieces(r, A, R, RW);
  for (const p of P) {
    const x0 = p.x0 + p.dx, x1 = p.x1 + p.dx + p.w0, y0 = r.y - RW + p.dy, y1 = r.y + r.h + RW + p.dy;
    if (x0 > vw || x1 < 0 || y0 > vh || y1 < 0) continue;
    const f = { x: r.x + p.dx, y: r.y + p.dy, w: r.w, h: r.h };
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    dsFrame(f, RW); drawCard(k, f, now, 1);
    ctx.restore(); curFont = "";
  }
  // Where two pieces of one room have parted, the cut between them is a rule.
  ctx.fillStyle = theme.rule;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i]; if (Math.abs(a.dy - b.dy) < 0.5) continue;
    ctx.fillRect(b.x0 + b.dx - RW / 2, r.y - RW + Math.min(a.dy, b.dy), RW, r.h + RW * 2 + Math.abs(a.dy - b.dy));
  }
}
function drawMapTrans(now, T) {
  prepCards(); // a card whose picture is out of date is painted first, before anything else is drawn
  mapGeom(T, (R, D, fb, e, L, A, ex, ey) => {
    const id = T.room, RW = L.RW, q = clamp(T.q, 0, 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
    if (q > 0.005) for (const k of ROOMS) if (k !== id) drawPieces(k, L.r[k], A, R, RW, now);
    drawMapHint(clamp((q - 0.75) / 0.25, 0, 1));
    dsFrame(R, RW);
    if (id === "chase") { // the wall becomes the card's picture; its red field comes down from above and its lenses ride its foot
      const B = wallBand(), s = dsLerp(1, L.thumb.w / B.w, ey), Wd = { x: R.x + dsLerp(B.x, L.thumb.x - A.x, ey), y: dsLerp(B.y, L.thumb.y, ey), w: B.w * s, h: B.h * s };
      ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      ctx.save(); ctx.beginPath(); ctx.rect(Wd.x, Wd.y, Wd.w, Wd.h); ctx.clip();
      if (q >= 0.999) wallThumb(Wd, now); else drawRoomAt("chase", B, Wd, now);
      ctx.restore(); curFont = "";
      chaseChrome(R, now, 1, Wd, reduced ? (q < 0.5 ? 0 : 1) : ease(clamp(q / 0.35, 0, 1)));
      ctx.restore(); curFont = "";
      return;
    }
    // Another room: it narrows into its field, and the field's face comes up through it.
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    ctx.fillStyle = id === "medal" ? theme["room-bg"] : theme.bg; ctx.fillRect(R.x, R.y, R.w, R.h);
    if (fb > 0 || PAGES[id]) { const kk = R.w / A.w; ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.setTransform(dpr * kk, 0, 0, dpr * kk, dpr * R.x, dpr * R.y); drawCard(id, { x: 0, y: 0, w: A.w, h: A.h }, now, 1); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (id === "medal" && fb < 1) { ctx.globalAlpha = 1 - fb; drawRoomAt("medal", SCREEN(), D, now); }
    ctx.restore(); curFont = ""; ctx.globalAlpha = 1;
    if (PAGES[id]) pageAt(PAGES[id], R, D, 1 - fb); // a page moves itself, over the canvas
  });
  ctx.globalAlpha = 1;
}
function drawMapHint(a) {
  if (a <= 0.01) return;
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.muted; font(500, 12.5);
  ctx.fillText(fitText("Pinch any room closed to come back here", vw - 24), vw / 2, mapLayout().hintY);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
// The map at rest: the painting.
function drawMap(now) {
  prepCards();
  const L = mapLayout(), RW = L.RW;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  for (const id of ROOMS) dsFrame(L.r[id], RW);
  let more = false;
  for (const id of ROOMS) if (drawCard(id, L.r[id], now, 1)) more = true;
  const pr = mapUI.press && L.r[mapUI.press];
  if (pr) { ctx.lineWidth = 4; ctx.strokeStyle = theme.ink; ctx.strokeRect(pr.x + 2, pr.y + 2, pr.w - 4, pr.h - 4); }
  const kr = mapUI.kb >= 0 && L.r[ROOMS[mapUI.kb]];
  if (kr) { ctx.lineWidth = 5; ctx.strokeStyle = theme.ink; ctx.strokeRect(kr.x + 2.5, kr.y + 2.5, kr.w - 5, kr.h - 5); }
  drawMapHint(1);
  return more;
}

// ----- room to room in one move: a sideways flick at a room's own level, or a door from anywhere -----
const hopE = (T, now) => (reduced ? 1 : ease(clamp((now - T.t0) / T.dur, 0, 1)));
const hopPos = (T, e) => [[T.from, -T.dir * vw * e], [T.to, T.dir * vw * (1 - e)]];
function hop(to, then = null) {
  const from = rooms.at, dir = Math.sign(ROOMS.indexOf(to) - ROOMS.indexOf(from)) || 1;
  hideTip(); cancelPress(); hideWho(); hideHow(); closePop(true);
  inertia = false; fly = null;
  enterPrep(to);
  state.trans = { kind: "hop", from, to, dir, t0: performance.now(), dur: reduced ? 1 : 440, done: hopDone, then };
  pagePose(state.trans); setChrome(); tick(6); kick();
}
function hopDone(T) {
  leaveRoom(T.from);
  rooms.at = T.to; pagesRest(); setChrome(); kick();
  if (T.then) setTimeout(T.then, 0);
}
function drawHop(now, T) {
  const e = hopE(T, now);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  for (const [id, ox] of hopPos(T, e)) {
    if (PAGES[id]) PAGES[id].style.transform = `translateX(${ox.toFixed(1)}px)`;
    else if (ox > -vw && ox < vw) drawRoomAt(id, SCREEN(), { x: ox, y: 0, w: vw, h: vh }, now);
  }
  const sx = T.dir > 0 ? vw * (1 - e) : vw * e, RW = dsRW(); // the seam between two rooms is a rule (a page carries its own)
  ctx.fillStyle = theme.rule; ctx.fillRect(sx - RW / 2, 0, RW, vh);
}
function hopBy(d) {
  const i = ROOMS.indexOf(rooms.at) + d;
  if (i < 0 || i >= ROOMS.length) { tick(2); return; } // Feed and Source are the ends of the map
  goRoom(ROOMS[i]);
}
// A clearly sideways, quick flick (not a scroll) at a room's own level: the next room along. Returns whether it took it.
function roomFlick(dx, dy, dt) {
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2 || dt > 600 || state.trans || !atRoot() || !mapReady()) return false;
  hopBy(dx < 0 ? 1 : -1);
  return true;
}
// To a room from wherever you are: a card up close goes down, a set closes (its own flight), the binder or the table
// steps aside, and then the room comes in sideways (or grows out of its card, from the map). then: once it's there.
function goRoom(id, { then = null } = {}) {
  if (!ROOMS.includes(id)) return;
  if (document.body.classList.contains("listmode")) { listEl.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ block: "start" }); return; } // the list has every room as a section
  closePop(true); hideTip(); if (marking) leaveMark();
  let tries = 0;
  const go = () => {
    if (tries++ > 80) return;
    if (state.trans || gesture || mapGesture() || shuffle || fly || tbl.anim) { setTimeout(go, 100); return; }
    if (state.focus) unfocus();
    if (tbl.on) closeTable(true);
    if (bnd.on) closeBinder(true);
    if (view === "set") { exitToMosaic(); setTimeout(go, 100); return; }
    if (rooms.map) { openPlace(id, 640, then); return; }
    if (rooms.at === id) { then?.(); kick(); return; }
    hop(id, then);
  };
  go();
}
// Something that belongs to the wall was asked for (a search, a filter, the list): the wall comes up at once.
function goWallNow() {
  const T = state.trans;
  if (T?.kind === "map" || T?.kind === "hop") finishTransition();
  if (!rooms.map && rooms.at === "chase") return;
  const from = rooms.at;
  if (!rooms.map) leaveRoom(from);
  rooms.map = false; rooms.at = "chase"; mg = null; pagesRest(); setChrome(); kick();
}

// ----- the frame: the map, a move, or a room that is a page; anything else is the wall's own frame -----
function roomsFrame(now) {
  const T = state.trans;
  if (T?.kind === "map") {
    if (!stepMapTrans(now, T)) { lastFrame = now; drawMapTrans(now, T); drawPop(now); kick(); return true; }
  } else if (T?.kind === "hop") {
    if (now - T.t0 < T.dur) { lastFrame = now; drawHop(now, T); kick(); return true; }
    state.trans = null; T.done(T);
  }
  if (rooms.map) {
    lastFrame = now;
    let more = drawMap(now);
    if (drawPop(now)) more = true;
    if (more) kick(); else mapIdle();
    return true;
  }
  if (PAGES[rooms.at] && !state.trans && view === "set") goWallNow(); // something of the wall's own opened a set: the page steps aside
  if (PAGES[rooms.at] && !bnd.on && !state.trans) { // the page covers the screen; the table may open over it
    lastFrame = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
    if (tbl.on) drawTable(now);
    return true;
  }
  return false;
}
// On the map with nothing moving, Source's clock still ticks: a frame four times a second, not sixty.
let idleTimer = 0;
function mapIdle() {
  if (reduced || idleTimer) return;
  idleTimer = setTimeout(() => { idleTimer = 0; if (rooms.map) kick(); }, 250);
}

// ----- gestures on the map (Touch Events for fingers, pointer events for the mouse) -----
// These listeners sit on the window ahead of the wall's own: on the map the canvas is the map's.
let mg = null;
const mapGesture = () => Boolean(mg || pgG);
function mDown(pts) {
  hideTip();
  if (document.activeElement === qIn) qIn.blur();
  if (pts.length >= 2) return mTwo(pts);
  if (mg) return;
  const p = pts[0];
  mg = { kind: "one", x: p.x, y: p.y, moved: false };
  mapUI.press = mapHit(p.x, p.y); mapUI.kb = -1; kick();
}
function mTwo(pts) {
  mapUI.press = null;
  const [a, b] = pts, m = mid(a, b);
  mg = { kind: "two", d0: Math.max(1, dist(a, b)), qs: [], id: mapHit(m.x, m.y, true), go: false };
  kick();
}
function mMove(pts) {
  if (!mg) { if (pts.length) mDown(pts); return; }
  if (mg.kind === "one" && pts.length >= 2) return mTwo(pts);
  if (mg.kind === "two") { if (pts.length >= 2) mPinch(pts[0], pts[1]); return; }
  if (mg.kind !== "one" || !pts[0]) return;
  if (!mg.moved && Math.hypot(pts[0].x - mg.x, pts[0].y - mg.y) >= 8) { mg.moved = true; mapUI.press = null; kick(); }
}
function mPinch(a, b) { // spreading on a card grows its room to fill the screen
  const g = mg, r = dist(a, b) / g.d0, now = evT || performance.now();
  if (!g.id || (state.trans && state.trans.kind !== "map")) return;
  const q = 1 - clamp((r - 1) / 1.1, 0, 1);
  if (!g.go) { if (q < 0.99 && !state.trans) { g.go = true; tick(4); beginMap(g.id, "in"); } else return; }
  const T = state.trans; if (T?.kind === "map" && !T.anim) { T.q = q; g.qs.push({ q, t: now }); kick(); }
}
function mUp(remaining, end, cancelled = false) {
  const g = mg; if (!g) return;
  if (g.kind === "two") {
    if (remaining.length >= 2) return;
    const T = state.trans;
    if (g.go && T?.kind === "map" && !T.anim) mapSettle(cancelled ? 1 : snapQ(g.qs, T.q, 0.65));
    mg = remaining.length === 1 ? { kind: "rest" } : null; kick();
    return;
  }
  if (g.kind === "rest") { if (!remaining.length) mg = null; return; }
  if (remaining.length) return;
  mg = null;
  const was = mapUI.press; mapUI.press = null;
  if (cancelled || g.moved) { kick(); return; }
  const p = end || g;
  mapTap(p.x, p.y, was); kick();
}
function mapTap(x, y, was) {
  if (state.trans) return;
  const id = mapHit(x, y); if (!id || (was && was !== id)) return;
  const lens = id === "chase" ? chaseLensAt(x, y) : null;
  openPlace(id, 640, lens && lens !== state.lens ? () => { if (rooms.at === "chase" && view === "mosaic" && !state.trans) setLens(lens); } : null);
}
// The Chase card's lens strip: a tap on a lens goes into Chase, and the wall then takes that lens (its own flight).
function chaseLensAt(x, y) {
  const L = mapLayout(), R = L.r.chase, by = L.thumb.y + L.thumb.h + L.RW;
  if (y < by || y > by + DS.LENS || x < R.x || x > R.x + R.w) return null;
  return LENSES[clamp(Math.floor(((x - R.x) / R.w) * LENSES.length), 0, LENSES.length - 1)];
}
const LENSES = ["have", "chase"], LENS_NAMES = { have: "Collection", chase: "Chase" };
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) addEventListener(type, (e) => {
  if (e.target !== canvas) return;
  if (type === "touchstart") {
    const T = state.trans;
    if ((T?.kind === "map" || T?.kind === "hop") && (T.anim || T.t0) && !mg) finishTransition(); // a touch never waits: the move lands and the touch takes over
    if (!mg && (!rooms.map || pop.c)) return; // the wall, the trophy room or the binder takes it
  } else if (!mg) return;
  e.stopImmediatePropagation(); e.preventDefault(); evT = e.timeStamp;
  const pts = touchPts(e.touches);
  if (type === "touchstart") mDown(pts);
  else if (type === "touchmove") mMove(pts);
  else mUp(pts, touchPts(e.changedTouches)[0], type === "touchcancel");
}, { capture: true, passive: false });
let mMouse = false;
addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || e.target !== canvas) return;
  const T = state.trans; if ((T?.kind === "map" || T?.kind === "hop") && (T.anim || T.t0)) finishTransition();
  if (!rooms.map || pop.c) return;
  e.stopImmediatePropagation(); mMouse = true; mDown([{ x: e.clientX, y: e.clientY }]);
}, true);
addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !mMouse) return; e.stopImmediatePropagation(); mMove([{ x: e.clientX, y: e.clientY }]); }, true);
for (const type of ["pointerup", "pointercancel"]) addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !mMouse) return; mMouse = false; e.stopImmediatePropagation(); mUp([], { x: e.clientX, y: e.clientY }, type === "pointercancel"); }, true);
// A trackpad on the map: spreading on a card goes in.
addEventListener("wheel", (e) => {
  if (e.target !== canvas || !rooms.map) return;
  e.preventDefault(); e.stopImmediatePropagation(); hideTip();
  if (state.trans?.kind === "map") { if (state.trans.anim) finishTransition(); return; }
  if ((e.ctrlKey || e.metaKey) && e.deltaY < -2) { const id = mapHit(e.clientX, e.clientY, true); if (id) openPlace(id); }
}, { capture: true, passive: false });

// ----- gestures on a page: it scrolls natively; two fingers closing go up to the map, a sideways flick to the next room -----
let pgG = null;
function pageTouch(id, el, e, type) {
  const pts = touchPts(e.touches);
  if (type === "touchstart") {
    hideTip();
    const T = state.trans; if ((T?.kind === "map" || T?.kind === "hop") && (T.anim || T.t0) && !pgG) finishTransition();
    if (pts.length >= 2) { pgG = { kind: "two", d0: Math.max(1, dist(pts[0], pts[1])), qs: [], go: false }; return; }
    if (pgG) return;
    const p = pts[0];
    pgG = { kind: "one", x: p.x, y: p.y, lx: p.x, ly: p.y, t: performance.now(), top: el.scrollTop, skip: Boolean(e.target.closest?.("input, select, textarea, [data-noflick]")) };
    return;
  }
  if (!pgG) return;
  if (type === "touchmove") {
    if (pts.length >= 2) {
      e.preventDefault(); // two fingers on a page never zoom it
      if (pgG.kind !== "two") pgG = { kind: "two", d0: Math.max(1, dist(pts[0], pts[1])), qs: [], go: false };
      const g = pgG, r = dist(pts[0], pts[1]) / g.d0, now = e.timeStamp;
      if (!g.go) { if (r < 0.96 && !state.trans && atRoot() && rooms.at === id && mapReady()) { g.go = true; tick(4); beginMap(id, "out"); } else return; }
      const T = state.trans; if (T?.kind === "map" && !T.anim) { T.q = clamp((1 - r) / 0.5, 0, 1); g.qs.push({ q: T.q, t: now }); kick(); }
      return;
    }
    if (pgG.kind === "one" && pts[0]) { pgG.lx = pts[0].x; pgG.ly = pts[0].y; }
    return;
  }
  const g = pgG, rem = pts.length, cancelled = type === "touchcancel";
  if (g.kind === "two") {
    if (rem >= 2) return;
    const T = state.trans;
    if (g.go && T?.kind === "map" && !T.anim) mapSettle(cancelled ? 0 : snapQ(g.qs, T.q, 0.4));
    pgG = rem ? { kind: "rest" } : null;
    return;
  }
  if (g.kind === "rest") { if (!rem) pgG = null; return; }
  if (rem) return;
  pgG = null;
  if (cancelled || g.skip || Math.abs(el.scrollTop - g.top) > 24) return; // it scrolled: not a flick
  const end = touchPts(e.changedTouches)[0] || { x: g.lx, y: g.ly };
  if (rooms.at === id && !rooms.map) roomFlick(end.x - g.x, end.y - g.y, performance.now() - g.t);
}
for (const [id, el] of Object.entries(PAGES)) {
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) el.addEventListener(type, (e) => pageTouch(id, el, e, type), { passive: type !== "touchmove" });
  el.addEventListener("wheel", (e) => { if ((e.ctrlKey || e.metaKey) && e.deltaY > 2) { e.preventDefault(); toMap(); } }, { passive: false }); // a trackpad pinch
}

// ----- keys: on the map the arrows pick a room and Enter goes in; Escape in a room's page goes up to the map -----
addEventListener("keydown", (e) => {
  if (document.activeElement === qIn || document.querySelector("dialog[open]") || paying() || pop.c) return;
  const k = e.key;
  if (rooms.map && (e.target === canvas || e.target === document.body)) {
    const i = mapUI.kb;
    if (k === "ArrowRight" || k === "ArrowDown") mapUI.kb = (i + 1) % ROOMS.length;
    else if (k === "ArrowLeft" || k === "ArrowUp") mapUI.kb = (i <= 0 ? ROOMS.length : i) - 1;
    else if ((k === "Enter" || k === " ") && i >= 0) { openPlace(ROOMS[i]); mapUI.kb = -1; }
    else if (k === "Escape") openPlace(rooms.at);
    else return;
    e.preventDefault(); e.stopImmediatePropagation(); if (mapUI.kb >= 0) toast(ROOM_NAME[ROOMS[mapUI.kb]]); kick(); return;
  }
  if (PAGES[rooms.at] && !rooms.map && atRoot() && (k === "Escape" || (k === "Backspace" && !e.target.closest?.("input, select, textarea")))) {
    e.preventDefault(); e.stopImmediatePropagation(); toMap();
  }
}, true);

// ----- the chrome: the rooms button, the screen reader's map, and what steps a room aside for the wall -----
roomsBtn.onclick = () => { hideTip(); toMap(); };
roomsNav.addEventListener("click", (e) => { const b = e.target.closest("[data-room]"); if (b) openPlace(b.dataset.room); });
qIn.addEventListener("input", () => goWallNow(), true); // a search, a filter, the list and your sets belong to the wall
filterMenu.addEventListener("click", (e) => { if (e.target.closest("[data-filter]")) goWallNow(); }, true);
for (const id of ["to-list", "w-sets"]) document.getElementById(id).addEventListener("click", () => goWallNow(), true);

// ----- finding the map the first time: a tip under the rooms button, once, when the wall is quiet -----
const tipEl = document.getElementById("maptip");
let tipShown = false;
function hideTip() { if (!tipEl.classList.contains("show")) return; tipEl.classList.remove("show"); roomsBtn.classList.remove("tipglow"); }
const tipTimer = setInterval(() => {
  if (mapSeenOnce || tipShown) { clearInterval(tipTimer); return; }
  if (!welcomed || roomsBtn.hidden || state.trans || gesture || toastEl.classList.contains("show") || revealing() || document.body.matches(".listmode, .focused, .offering, .paying, .welcoming")) return;
  tipShown = true; tipEl.classList.add("show"); roomsBtn.classList.add("tipglow");
  setTimeout(hideTip, 7000);
}, 2500);
addEventListener("pointerdown", () => hideTip(), true);

// Debug builds only: the tests' hook sees the rooms.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { rooms: { get: () => rooms }, mapUI: { get: () => mapUI }, mapLayout: { value: mapLayout }, toMap: { value: toMap }, openPlace: { value: openPlace }, goRoom: { value: goRoom }, hopBy: { value: hopBy }, beginMap: { value: beginMap }, wallPic: { get: () => wallPic } }); }, 0);
