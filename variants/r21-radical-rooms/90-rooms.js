// ---------- rooms: the app as places, one level above the wall (round 21, radical) ----------
// Production has five tabs: Feed, Chase, Trade, Medal, Source. Here there is no tab bar. The app is a map of five
// rooms on one composed screen, one zoom level above the wall, and every room on it shows what is going on inside:
//   Feed   the newest listings for your chases, sliding in as they're found
//   Chase  the wall itself, as a picture of exactly what you left
//   Trade  the trade binder's first page, your spares and who wants them
//   Medal  the trophy room's door with its rarest medals (or the next one to earn)
//   Source where Card Chaser looks, with a pulse when a look finds something
// Pinch the wall closed and it shrinks into its place on the map while the other rooms settle in around it; spread on
// a room (or tap it) and it grows to fill the screen, the way a set grows into its binder; pinch any room closed to
// come back. Every step is one transition with a position, held under the fingers and snapped by speed, then position.
// The grid button at the top left of the wall (where Back sits inside a set) goes up to the map too.
// How it's built: the map, the Feed and the Source are levels drawn over the wall (`place`), which stays exactly as it
// was underneath (view "mosaic", its scroll, its lens). Chase is the wall. Medal is the trophy room and Trade the trade
// binder, opened without their own animation and remembered as `map.from`, so Back and a pinch from them go up to the
// map, while the same room opened from the wall (the door, the cover) still goes back to the wall. During a move
// between a room and the map, the room is a picture taken once (the wall's is kept and reused on the map), so a held
// pinch is one scaled image plus the four small cards.

const ROOMS = ["feed", "chase", "trade", "medal", "source"];
const ROOM_NAME = { feed: "Feed", chase: "Chase", trade: "Trade", medal: "Medal", source: "Source" };
const ROOM_COL = { feed: "c-blue", chase: "c-red", trade: "c-green", medal: "c-yellow", source: "c-blue" }; // production's tab colours
let place = null; // "map", "feed" or "source": a level drawn over the wall
const map = { from: null, L: null, wall: null, press: null, kb: -1, pulse: null, feedIn: null, found: [], scan: { last: 0, next: 0 }, layoutN: 0, wallVer: 0, tip: null };
let mapSeenOnce = false;
try { mapSeenOnce = localStorage.getItem("wall-map-seen") === "1"; } catch { /* fresh */ }
const mapSeen = () => { if (mapSeenOnce) return; mapSeenOnce = true; try { localStorage.setItem("wall-map-seen", "1"); } catch { /* private mode */ } };
// The map is up a level from anything settled: not while the first run, the import, a trade or marking is under way.
const mapReady = () => !wel.on && !story && !ar.on && !tbl.on && !marking && !state.focus && !pop.c && !paying() && !document.body.classList.contains("listmode");
// Where you are, as a room: null on the map, inside a set, or anywhere a pinch already means something else.
function currentRoom() {
  if (place === "feed" || place === "source") return place;
  if (place) return null;
  if (bnd.on) return map.from === "trade" && !bnd.show ? "trade" : null;
  if (room.on) return map.from === "medal" && view === "mosaic" ? "medal" : null;
  return view === "mosaic" && !tbl.on ? "chase" : null;
}

// ----- the map's layout: Feed along the top, Chase and Trade over Medal in the middle, Source along the bottom -----
// Read like production's tab bar: Feed, Chase, Trade, Medal, Source. Chase is the biggest: its card has the wall's own
// proportions so the wall shrinks into it without cropping.
const wallBand = () => ({ x: 0, y: topPad() - 4, w: vw, h: vh - botPad() + 4 - (topPad() - 4) });
function mapLayout() {
  const key = `${vw}|${vh}|${botPad()}`;
  if (map.L?.key === key) return map.L;
  const W = Math.min(vw - 20, 1180), x0 = Math.round((vw - W) / 2), gap = 10, top = topPad() - 2, bottom = vh - 34, avail = bottom - top;
  const fH = Math.round(clamp(avail * 0.2, 118, 176)), sH = Math.round(clamp(avail * 0.18, 116, 150));
  const my = top + fH + gap, mh = avail - fH - sH - gap * 2;
  const B = wallBand(), asp = B.w / B.h, HEAD = 42, FOOT = 30;
  let thH = mh - HEAD - FOOT, thW = thH * asp;
  const cMax = W * (vw < 700 ? 0.56 : 0.64);
  if (thW + 16 > cMax) { thW = cMax - 16; thH = thW / asp; }
  const cw = Math.round(thW + 16), rx = x0 + cw + gap, rw = W - cw - gap, th = Math.round((mh - gap) / 2);
  const r = {
    feed: { x: x0, y: top, w: W, h: fH },
    chase: { x: x0, y: my, w: cw, h: mh },
    trade: { x: rx, y: my, w: rw, h: th },
    medal: { x: rx, y: my + th + gap, w: rw, h: mh - th - gap },
    source: { x: x0, y: my + mh + gap, w: W, h: sH },
  };
  const thumb = { x: x0 + (cw - thW) / 2, y: my + HEAD, w: thW, h: thH };
  return (map.L = { key, r, thumb, hintY: vh - 14 });
}
function mapHit(x, y, nearest = false) {
  const L = mapLayout();
  for (const id of ROOMS) if (inR(L.r[id], x, y)) return id;
  if (!nearest) return null;
  let best = null, bd = Infinity;
  for (const id of ROOMS) { const m = L.r[id], d = Math.hypot(Math.max(m.x - x, 0, x - m.x - m.w), Math.max(m.y - y, 0, y - m.y - m.h)); if (d < bd) { bd = d; best = id; } }
  return bd < 60 ? best : null;
}

// ----- pictures: a room's screen, taken once -----
function grabScreen(S, holder = null) {
  const k = Math.min(dpr, Math.sqrt(3.2e6 / Math.max(1, S.w * S.h)));
  const cv = holder?.cv || document.createElement("canvas"), W = Math.max(1, Math.ceil(S.w * k)), H = Math.max(1, Math.ceil(S.h * k));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const x = cv.getContext("2d"); x.clearRect(0, 0, W, H);
  x.drawImage(canvas, Math.round(S.x * dpr), Math.round(S.y * dpr), Math.round(S.w * dpr), Math.round(S.h * dpr), 0, 0, W, H);
  return { cv, S, half: null };
}
// The nearest of the full and half-size copies for the size it's drawn at (a small thumbnail stays cheap).
function snapFor(snap, w) {
  if ((w * dpr) / snap.cv.width > 0.55) return snap.cv;
  if (!snap.half) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(snap.cv.width / 2)); c.height = Math.max(1, Math.round(snap.cv.height / 2)); const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(snap.cv, 0, 0, c.width, c.height); snap.half = c; }
  return snap.half;
}
// Paint a room's full screen on the wall's canvas (the frame that follows draws over it).
function paintRoom(id, now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = id === "medal" ? theme["room-bg"] : theme.bg; ctx.fillRect(0, 0, vw, vh);
  const fo = foilOff; foilOff = true;
  if (id === "chase") { for (const c of drawnCards) c.e = emphasis(c); drawWall(now, 1); drawTraders(now); }
  else if (id === "medal") drawRoom(now, 1);
  else if (id === "trade") tbDraw(now);
  else if (id === "feed") drawFeedRoom(now);
  else if (id === "source") drawSourceRoom(now);
  foilOff = fo;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
}
// The wall's picture is kept for the map's Chase card and drawn again only when the wall has changed.
const wallKey = () => `${vw}|${vh}|${dpr}|${theme.bg}|${theme.dark ? 1 : 0}|${state.lens}|${state.value ? 1 : 0}|${state.time ? Math.round(state.t / 864e5) : 0}|${mode}|${map.layoutN}|${Math.round(mScroll)}|${map.wallVer}|${state.matches ? state.matches.size : -1}`;
function wallSnap(now, force = false) {
  if (room.on || bnd.on || tbl.on || view !== "mosaic") return map.wall; // the wall isn't what's drawn: the last picture stands
  const key = wallKey();
  if (!force && map.wall?.key === key) return map.wall;
  paintRoom("chase", now);
  map.wall = { key, ...grabScreen(wallBand(), map.wall) };
  return map.wall;
}
function roomSnap(id, now) {
  if (id === "chase") return wallSnap(now, true);
  paintRoom(id, now);
  return grabScreen({ x: 0, y: 0, w: vw, h: vh });
}

// ----- moving between a room and the map: one transition with a position (q: 0 the room, 1 the map) -----
function roomUp() { // the trophy room, with no slide of its own: it is about to grow out of its card
  map.from = "medal";
  Object.assign(room, { on: true, closing: false, wallScroll: mScroll, fan: null, pinch: null, anim: null, q: 1 });
  mScroll = 0; layoutAll();
  document.body.classList.add("inroom");
}
function binderUp() { // the trade binder, likewise (an empty one too: its page says how a card gets in)
  map.from = "trade";
  Object.assign(bnd, { on: true, closing: false, turn: 0, tAnim: null, pinch: null, drag: null, rest: false, swallow: false, press: null, show: false, sq: 0, sa: null, vi: 0, q: 1, anim: null });
  tbFresh(); bnd.L = tbGeom(false); tbSync();
}
function beginMap(id, dir) {
  const now = performance.now();
  hideTip(); cancelPress(); hideDealBar(); hideWho();
  if (dir === "in") { if (id === "medal") roomUp(); else if (id === "trade") binderUp(); }
  else { inertia = false; fly = null; pInertia = 0; if (id === "trade") document.body.classList.remove("inbinder"); }
  const snap = roomSnap(id, now);
  state.trans = { kind: "map", room: id, dir, q: dir === "in" ? 1 : 0, snap, done: mapSettled };
  document.body.classList.add("maptrans");
  setChrome();
  return state.trans;
}
function mapSettle(to, dur) {
  const T = state.trans; if (!T || T.kind !== "map") return;
  T.anim = { from: T.q, to, t0: performance.now(), dur: reduced ? 1 : dur ?? 200 + 440 * Math.abs(to - T.q) };
  kick();
}
function mapSettled(T) {
  const up = (T.anim ? T.anim.to : T.q) >= 0.5, id = T.room;
  document.body.classList.remove("maptrans");
  map.press = null;
  if (up) {
    if (id === "medal" && room.on) { room.closing = false; endRoom(); }
    if (id === "trade" && bnd.on) tbEnd();
    if (id === "feed") feedSeen();
    map.from = null; place = "map"; mapSeen();
  } else {
    place = id === "feed" || id === "source" ? id : null;
    map.from = id === "medal" || id === "trade" ? id : null;
    if (id === "trade") { document.body.classList.add("inbinder"); tbSync(); }
  }
  tick(6); setChrome(); kick();
}
// Up to the map from wherever you are, or into a room from the map: a tap, a key or a button plays it.
function toMap() {
  if (state.trans?.kind === "map") { if (state.trans.anim) finishTransition(); else return; }
  if (state.trans) finishTransition();
  const id = currentRoom(); if (!id || !mapReady()) return;
  tick(8); beginMap(id, "out"); mapSettle(1, 600);
}
function openPlace(id, dur = 640) {
  if (place !== "map" || state.trans || !ROOMS.includes(id)) return;
  tick(8); beginMap(id, "in"); mapSettle(0, dur);
}
// Something that belongs to the wall was asked for (a search, a filter, the list): the place steps aside at once.
function goWallNow() {
  if (state.trans?.kind === "map" && state.trans.anim) finishTransition();
  if (!place) return;
  if (place === "feed") feedSeen();
  place = null; pg = null; setChrome(); kick();
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

// ----- drawing the move: the room between the full screen and its card, the other rooms settling in around it -----
function stepMapTrans(now, T) {
  if (!T.anim) return false;
  const a = clamp((now - T.anim.t0) / T.anim.dur, 0, 1);
  T.q = T.anim.from + (T.anim.to - T.anim.from) * (1 - Math.pow(1 - a, 3));
  if (a < 1) return false;
  state.trans = null; T.done(T);
  return true;
}
function drawMapTrans(now, T) {
  const L = mapLayout(), id = T.room, A = L.r[id];
  const e = reduced ? (T.q < 0.5 ? 0 : 1) : ease(clamp(T.q, 0, 1));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  if (e > 0.01) { // the other rooms come in from just beyond their places
    const ax = A.x + A.w / 2, ay = A.y + A.h / 2, push = (1 - e) * 0.24;
    for (const k of ROOMS) {
      if (k === id) continue;
      const r = L.r[k];
      drawCard(k, { x: r.x + (r.x + r.w / 2 - ax) * push, y: r.y + (r.y + r.h / 2 - ay) * push, w: r.w, h: r.h }, now, e);
    }
    drawMapHint(e);
  }
  const R = lerpRect({ x: 0, y: 0, w: vw, h: vh }, A, e), fa = clamp((e - 0.45) / 0.45, 0, 1), snap = T.snap;
  if (id === "chase") { // the wall itself becomes the card's picture; the card's frame and words come up around it
    if (fa > 0) { ctx.globalAlpha = fa; rr(R.x, R.y, R.w, R.h, 14 * e); ctx.fillStyle = theme.panelFill; ctx.fill(); ctx.globalAlpha = 1; }
    if (snap) {
      const D = lerpRect(snap.S, L.thumb, e);
      ctx.save(); rr(D.x, D.y, D.w, D.h, 6 * e); ctx.clip(); ctx.drawImage(snapFor(snap, D.w), D.x, D.y, D.w, D.h); ctx.restore();
    }
    if (fa > 0) chaseChrome(R, now, fa);
  } else { // a room shrinks into its card and its card's face comes up through it
    if (fa > 0) {
      const k = R.w / A.w;
      ctx.save(); rr(R.x, R.y, R.w, R.h, 14 * e); ctx.clip();
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * R.x, dpr * R.y);
      drawCard(id, { x: 0, y: 0, w: A.w, h: A.h }, now, 1);
      ctx.restore(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (snap && fa < 1) {
      const k1 = A.w / vw, D = lerpRect({ x: 0, y: 0, w: vw, h: vh }, { x: A.x, y: A.y - (topPad() - 8) * k1, w: A.w, h: vh * k1 }, e);
      ctx.save(); rr(R.x, R.y, R.w, R.h, 14 * e); ctx.clip();
      ctx.globalAlpha = 1 - fa; ctx.drawImage(snapFor(snap, D.w), D.x, D.y, D.w, D.h);
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  ctx.globalAlpha = 1;
}
function drawMapHint(a) {
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.muted; font(500, 12.5);
  ctx.fillText(fitText(vw < 520 ? "Tap a room to go in. Pinch closed to come back." : "Tap a room, or spread two fingers on it, to go in. Pinch any room closed to come back here.", vw - 24), vw / 2, mapLayout().hintY);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
// The map at rest: five cards, each showing what's going on inside.
function drawMap(now) {
  const L = mapLayout();
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  let more = false;
  for (const id of ROOMS) if (drawCard(id, L.r[id], now, 1)) more = true;
  const pr = map.press && L.r[map.press];
  if (pr) { ctx.lineWidth = 2; ctx.strokeStyle = theme.ink; rr(pr.x + 1, pr.y + 1, pr.w - 2, pr.h - 2, 13); ctx.stroke(); }
  const kr = map.kb >= 0 && L.r[ROOMS[map.kb]];
  if (kr) { ctx.lineWidth = 2.5; ctx.strokeStyle = theme.ink; rr(kr.x - 3, kr.y - 3, kr.w + 6, kr.h + 6, 16); ctx.stroke(); }
  drawMapHint(1);
  return more;
}

// ----- gestures on the map, the Feed and the Source (Touch Events for fingers, pointer events for the mouse) -----
// The wall's own handlers never see these touches: these listeners sit on the window, ahead of everything else.
let pg = null, pInertia = 0;
function pDown(pts) {
  hideTip();
  if (document.activeElement === qIn) qIn.blur();
  if (pts.length >= 2) return pTwo(pts);
  if (pg) return;
  const p = pts[0], now = performance.now();
  pInertia = 0;
  pg = { kind: "one", x: p.x, y: p.y, t: now, moved: false, s: [{ y: p.y, t: now }], y0: pScroll() };
  if (place === "map") { map.press = mapHit(p.x, p.y); map.kb = -1; kick(); }
  else pPress(p.x, p.y);
}
function pTwo(pts) {
  map.press = null; pPressOff();
  const [a, b] = pts, m = mid(a, b);
  pg = { kind: "two", d0: Math.max(1, dist(a, b)), qs: [], id: place === "map" ? mapHit(m.x, m.y, true) : place, go: false };
  kick();
}
function pMove(pts) {
  if (!pg) { if (pts.length) pDown(pts); return; }
  if (pg.kind === "one" && pts.length >= 2) return pTwo(pts);
  if (pg.kind === "two") { if (pts.length >= 2) pPinch(pts[0], pts[1]); return; }
  if (pg.kind !== "one") return;
  const p = pts[0]; if (!p) return;
  const g = pg, dy = p.y - g.y, now = performance.now();
  g.s.push({ y: p.y, t: now }); if (g.s.length > 8) g.s.shift();
  if (!g.moved && Math.hypot(p.x - g.x, dy) < 8) return;
  if (!g.moved) { g.moved = true; map.press = null; pPressOff(); }
  if (place === "feed" || place === "source") { pSetScroll(g.y0 - dy); kick(); }
}
function pPinch(a, b) {
  const g = pg, r = dist(a, b) / g.d0, now = evT || performance.now();
  if (place === "map") { // spreading on a room grows it to fill the screen
    if (!g.id || (state.trans && state.trans.kind !== "map")) return;
    const q = 1 - clamp((r - 1) / 1.1, 0, 1);
    if (!g.go) { if (q < 0.99 && !state.trans) { g.go = true; tick(4); beginMap(g.id, "in"); } else return; }
    const T = state.trans; if (T?.kind === "map" && !T.anim) { T.q = q; g.qs.push({ q, t: now }); kick(); }
    return;
  }
  // in the Feed or the Source, closing fingers shrink it back into its card
  if (!g.go) { if (r < 0.96 && !state.trans && mapReady()) { g.go = true; beginMap(place, "out"); } else return; }
  const T = state.trans; if (T?.kind === "map" && !T.anim) { T.q = clamp((1 - r) / 0.5, 0, 1); g.qs.push({ q: T.q, t: now }); kick(); }
}
function pUp(remaining, end, cancelled = false) {
  const g = pg; if (!g) return;
  if (g.kind === "two") {
    if (remaining.length >= 2) return;
    const T = state.trans;
    if (g.go && T?.kind === "map" && !T.anim) mapSettle(cancelled ? (T.dir === "in" ? 1 : 0) : snapQ(g.qs, T.q, T.dir === "in" ? 0.65 : 0.4));
    pg = remaining.length === 1 ? { kind: "rest" } : null; kick();
    return;
  }
  if (g.kind === "rest") { if (!remaining.length) pg = null; return; }
  if (remaining.length) return;
  pg = null;
  const was = map.press; map.press = null; pPressOff();
  if (cancelled) { kick(); return; }
  const p = end || { x: g.x, y: g.s[g.s.length - 1].y };
  if (!g.moved) { pTap(p.x, p.y, was); kick(); return; }
  if (place === "feed" || place === "source") {
    const now = performance.now(), s0 = g.s.find((s) => now - s.t < 90) || g.s[0];
    if (s0 && !reduced) { const v = (p.y - s0.y) / Math.max(1, now - s0.t); if (Math.abs(v) > 0.2) pInertia = v; }
  }
  kick();
}
function pTap(x, y, was) {
  if (state.trans) return;
  if (place === "map") { const id = mapHit(x, y); if (id && (!was || was === id)) openPlace(id); return; }
  if (place === "feed") feedTap(x, y); else if (place === "source") sourceTap(x, y);
}
const pScroll = () => (place === "feed" ? feedView.scroll : place === "source" ? srcView.scroll : 0);
function pSetScroll(v) { const P = place === "feed" ? feedView : place === "source" ? srcView : null; if (P) P.scroll = clamp(v, 0, P.max); }
function stepPlaceInertia(dt) {
  if (!pInertia || state.trans) return false;
  const P = place === "feed" ? feedView : srcView;
  P.scroll = clamp(P.scroll - pInertia * dt, 0, P.max);
  pInertia *= Math.pow(0.95, dt / 16);
  if (Math.abs(pInertia) < 0.02 || P.scroll <= 0 || P.scroll >= P.max) pInertia = 0;
  return true;
}
const ownsPlace = () => Boolean(place) && !pop.c && !tbl.on && !paying();
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) addEventListener(type, (e) => {
  if (e.target !== canvas) return;
  if (type === "touchstart") {
    const T = state.trans;
    if (T?.kind === "map" && T.anim && !pg) finishTransition(); // a touch never waits: the move lands and the touch takes over
    if (!pg && !ownsPlace()) return; // the wall, a room or the binder takes it
  } else if (!pg) return;
  e.stopImmediatePropagation(); e.preventDefault(); evT = e.timeStamp;
  const pts = touchPts(e.touches);
  if (type === "touchstart") pDown(pts);
  else if (type === "touchmove") pMove(pts);
  else pUp(pts, touchPts(e.changedTouches)[0], type === "touchcancel");
}, { capture: true, passive: false });
let pMouse = false;
addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse" || e.target !== canvas) return;
  if (state.trans?.kind === "map" && state.trans.anim) finishTransition();
  if (!ownsPlace()) return;
  e.stopImmediatePropagation(); pMouse = true; pDown([{ x: e.clientX, y: e.clientY }]);
}, true);
addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !pMouse) return; e.stopImmediatePropagation(); pMove([{ x: e.clientX, y: e.clientY }]); }, true);
for (const type of ["pointerup", "pointercancel"]) addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !pMouse) return; pMouse = false; e.stopImmediatePropagation(); pUp([], { x: e.clientX, y: e.clientY }, type === "pointercancel"); }, true);
// A trackpad: pinch on the wall (or in a room you came to from the map) goes up to the map; spread on a room goes in.
addEventListener("wheel", (e) => {
  if (e.target !== canvas) return;
  const pinch = e.ctrlKey || e.metaKey;
  if (place) {
    e.preventDefault(); e.stopImmediatePropagation(); hideTip();
    if (state.trans?.kind === "map") { if (state.trans.anim) finishTransition(); return; }
    if (place === "map") { if (pinch && e.deltaY < -2) { const id = mapHit(e.clientX, e.clientY, true); if (id) openPlace(id); } return; }
    if (pinch) { if (e.deltaY > 2) toMap(); return; }
    pInertia = 0; pSetScroll(pScroll() + e.deltaY); kick(); return;
  }
  const here = currentRoom();
  if (pinch && e.deltaY > 2 && (here === "chase" || here === "medal" || here === "trade") && !state.trans && mapReady()) { e.preventDefault(); e.stopImmediatePropagation(); toMap(); }
}, { capture: true, passive: false });
// Keys: on the map the arrows pick a room and Enter goes in; Escape or Backspace in a room from the map goes up to it.
addEventListener("keydown", (e) => {
  if (document.activeElement === qIn || document.querySelector("dialog[open]") || paying() || pop.c) return;
  const k = e.key, onCanvas = e.target === canvas || e.target === document.body;
  if (place === "map" && onCanvas) {
    const i = map.kb;
    if (k === "ArrowRight" || k === "ArrowDown") map.kb = (i + 1) % ROOMS.length;
    else if (k === "ArrowLeft" || k === "ArrowUp") map.kb = (i <= 0 ? ROOMS.length : i) - 1;
    else if ((k === "Enter" || k === " ") && i >= 0) { openPlace(ROOMS[i]); map.kb = -1; }
    else if (k === "Escape") openPlace("chase");
    else return;
    e.preventDefault(); e.stopImmediatePropagation(); if (map.kb >= 0) toast(ROOM_NAME[ROOMS[map.kb]]); kick(); return;
  }
  if ((place === "feed" || place === "source") && onCanvas) {
    if (k === "Escape" || k === "Backspace") toMap();
    else if (k === "ArrowDown" || k === "PageDown") { pSetScroll(pScroll() + (k === "PageDown" ? vh * 0.8 : 90)); kick(); }
    else if (k === "ArrowUp" || k === "PageUp") { pSetScroll(pScroll() - (k === "PageUp" ? vh * 0.8 : 90)); kick(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  if ((k === "Escape" || k === "Backspace") && !state.trans && ((map.from === "trade" && bnd.on && !bnd.show && whoEl.hidden) || (map.from === "medal" && room.on && view === "mosaic"))) {
    e.preventDefault(); e.stopImmediatePropagation(); toMap();
  }
}, true);

// ----- the base's gestures, extended: closing fingers on the wall (or in a room from the map) go up to the map -----
function pinchMove(a, b) {
  const g = gesture, d = dist(a, b), m = mid(a, b), r = d / g.d0, now = evT || performance.now();
  if (g.snap) return;
  if (view === "mosaic") {
    const here = room.on ? (map.from === "medal" ? "medal" : null) : bnd.on ? null : "chase";
    if (here && !g.mapT && !g.out) { if (r < 0.96 && !state.trans && mapReady()) { g.mapT = true; g.tqs = []; tick(4); beginMap(here, "out"); } else if (r > 1.01) g.out = true; }
    if (g.mapT) { const T = state.trans; if (T?.kind === "map" && !T.anim) { T.q = clamp((1 - r) / 0.5, 0, 1); g.tqs.push({ q: T.q, t: now }); kick(); } return; }
    if (room.on && here === "medal") { if (!g.g?.done) return; } // in a room from the map a spread still opens a plaque's album
    else if (room.on) {
      if (room.pinch || (r < 1 && !state.trans)) {
        if (!room.pinch) { room.pinch = { q0: room.q, qs: [] }; room.anim = null; }
        room.q = clamp(room.pinch.q0 - (1 - r) / 0.55, 0, 1); room.pinch.qs.push({ q: room.q, t: now }); kick(); return;
      }
      if (!g.g?.done) return;
    } else if (g.g?.door) { if (r > 1.12) { g.snap = true; openRoom(); } return; }
    else if (g.g?.tbCover) { if (r > 1.12) { g.snap = true; openBinder(); } return; }
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
  if (g.mapT) { if (T?.kind === "map" && !T.anim) mapSettle(snapQ(g.tqs, T.q, 0.4)); return; } // a slow small pinch stays home
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
// The trade binder from the map: a pinch shrinks it into its card rather than back onto the Trade lens's cover.
function bPinchStart(pts) {
  if (bnd.show) return; // across the table a pinch does nothing: the other person can't close it by accident
  bnd.drag = null; bnd.press = null; bnd.tAnim = null; bnd.turn = 0;
  bnd.pinch = { d0: dist(pts[0], pts[1]), q0: bnd.q, qs: [], map: map.from === "trade", go: false }; kick();
}
function bPinchMove(pts) {
  const g = bnd.pinch, d = dist(pts[0], pts[1]), r = d / g.d0;
  if (g.map) {
    if (!g.go) { if (r < 0.96 && !state.trans && mapReady()) { g.go = true; tick(4); beginMap("trade", "out"); } else return; }
    const T = state.trans; if (T?.kind === "map" && !T.anim) { T.q = clamp((1 - r) / 0.5, 0, 1); g.qs.push({ q: T.q, t: performance.now() }); kick(); }
    return;
  }
  bnd.q = clamp(g.q0 - (1 - d / g.d0) / 0.55, 0, 1); g.qs.push({ q: bnd.q, t: performance.now() }); kick();
}
function bPinchEnd(cancelled) {
  const g = bnd.pinch; bnd.pinch = null; if (!g) return;
  if (g.map) { const T = state.trans; if (g.go && T?.kind === "map" && !T.anim) mapSettle(cancelled ? 0 : snapQ(g.qs, T.q, 0.4)); return; }
  const qs = g.qs, last = qs[qs.length - 1];
  let first = qs.find((s) => last && last.t - s.t < 160);
  if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
  const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
  const to = cancelled ? 1 : Math.abs(v) > 0.0011 ? (v > 0 ? 1 : 0) : bnd.q > 0.5 ? 1 : 0;
  if (to === 0) closeBinder();
  else if (reduced) { bnd.q = 1; kick(); }
  else { bnd.anim = { from: bnd.q, to: 1, t0: performance.now(), dur: 160 + 300 * (1 - bnd.q) }; kick(); }
}

// ----- the base, extended: the layout, the rooms' ends, the chrome, the count -----
function layoutAll() {
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); }
  groups.forEach(binderLayout);
  const keep = mScroll;
  if (lifted) { newPanel = null; liftedLayout(); } else mosaicLayout();
  map.layoutN++;
  // The trophy room from the map opens on an empty case too: it says how the first trophy comes.
  if (room.on) { if (!roomHas() && map.from !== "medal") { endRoom(); return; } if (room.fan && !inCase(room.fan)) room.fan = null; mScroll = keep; strip = null; roomLayout(); }
  if (bnd.on) { bnd.L = tbGeom(bnd.show); bnd.vi = clamp(bnd.vi, 0, tbViews() - 1); }
}
function endRoom() {
  room.on = false; room.closing = false; room.anim = null; room.q = 0; room.pinch = null; room.fan = null;
  if (map.from === "medal") map.from = null;
  mScroll = room.wallScroll; layoutAll();
  document.body.classList.remove("inroom"); setChrome(); kick();
}
function tbEnd() {
  Object.assign(bnd, { on: false, closing: false, anim: null, q: 0, pinch: null, drag: null, press: null, show: false, sq: 0, sa: null });
  if (map.from === "trade") map.from = null;
  document.body.classList.remove("inbinder", "showing"); setChrome(); kick();
}
function updateCount() {
  natdexSync(); // a Dex slot shows the best print you own: picked again when what you own changes
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
  map.wallVer++; // the map's picture of the wall is drawn again
  scheduleMedals();
}
// The strip: on the wall the left button is the map (up a level, where Back is inside a set); in a room it is Back.
const roomsBtn = document.createElement("button");
roomsBtn.className = "ib"; roomsBtn.id = "rooms"; roomsBtn.type = "button"; roomsBtn.setAttribute("aria-label", "All rooms: Feed, Chase, Trade, Medal, Source");
roomsBtn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="4.2" rx="1.2"/><rect x="3" y="9" width="9.5" height="9.2" rx="1.2"/><rect x="14.3" y="9" width="6.7" height="4.1" rx="1.2"/><rect x="14.3" y="14.6" width="6.7" height="3.6" rx="1.2"/><rect x="3" y="19.8" width="18" height="1.6" rx=".8"/></svg>`;
roomsBtn.hidden = true;
backBtn.before(roomsBtn);
roomsBtn.onclick = () => { hideTip(); toMap(); };
// For a screen reader, the map is five buttons (the canvas can't say what's on it).
const roomsNav = document.createElement("nav");
roomsNav.className = "sr"; roomsNav.setAttribute("aria-label", "Rooms"); roomsNav.hidden = true;
roomsNav.innerHTML = ROOMS.map((id) => `<button type="button" data-room="${id}">${ROOM_NAME[id]}</button>`).join("");
roomsNav.addEventListener("click", (e) => { const b = e.target.closest("[data-room]"); if (b) openPlace(b.dataset.room); });
document.querySelector(".top").after(roomsNav);
function setChrome() {
  const inPlace = place === "feed" || place === "source", moving = state.trans?.kind === "map";
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  document.body.classList.toggle("onmap", place === "map");
  document.body.classList.toggle("inplace", inPlace);
  backBtn.hidden = moving || (!inPlace && view !== "set" && !tbl.on && !room.on && !bnd.on);
  backBtn.setAttribute("aria-label", inPlace || (bnd.on && !tbl.on && map.from === "trade") || (room.on && view !== "set" && map.from === "medal") ? "Back to the rooms" : bnd.on && !tbl.on ? "Back to the Trade lens" : room.on && view !== "set" ? "Back to the wall" : "Back to everything");
  roomsBtn.hidden = moving || Boolean(place) || view !== "mosaic" || room.on || bnd.on || tbl.on || wel.on || Boolean(story) || ar.on;
  roomsNav.hidden = place !== "map";
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = place === "map" ? "Rooms: Feed, Chase, Trade, Medal, Source" : place === "feed" ? "Feed" : place === "source" ? "Source" : tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : bnd.on ? (bnd.show ? "Trade binder, Show mode" : "Trade binder") : room.on ? "Trophy room" : "";
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); if (place) document.body.style.setProperty("--shelf-h", "0px");
  updateCount();
}
backBtn.onclick = () => {
  if (state.trans?.kind === "map") return;
  if (tbl.on) closeTable();
  else if (place === "feed" || place === "source") toMap();
  else if (bnd.on) { if (bnd.show) tbHandBack(); else if (map.from === "trade") toMap(); else closeBinder(); }
  else if (view === "set") exitToMosaic();
  else if (room.on) { if (map.from === "medal") toMap(); else closeRoom(); }
};
// The count is the wall: from the map it opens Chase; from the Feed or the Source it goes straight there.
document.getElementById("count").addEventListener("click", (e) => {
  if (place === "map") { e.preventDefault(); e.stopImmediatePropagation(); openPlace("chase"); }
  else if (place) { e.preventDefault(); e.stopImmediatePropagation(); goWallNow(); }
}, true);
// Anything that belongs to the wall steps the place aside first: a search, a filter, the list, choosing your sets.
qIn.addEventListener("input", () => goWallNow(), true);
filterMenu.addEventListener("click", () => goWallNow(), true);
for (const id of ["to-list", "w-sets"]) document.getElementById(id).addEventListener("click", () => goWallNow(), true);
toastEl.addEventListener("click", (e) => { const b = e.target.closest(".toast-btn"); if (b && b.textContent !== "Undo" && place) goWallNow(); }, true);
document.getElementById("reset").addEventListener("click", () => { try { for (const k of ["wall-map-seen", "wall-sources-off"]) localStorage.removeItem(k); } catch { /* fine */ } }, true);

// ----- finding the map the first time: a tip under the grid button, once, when the wall is quiet -----
const tipEl = document.createElement("div");
tipEl.className = "maptip glass"; tipEl.id = "maptip"; tipEl.setAttribute("role", "status");
tipEl.innerHTML = `<b>Every room is up here</b><span>Pinch the wall closed, or tap the grid, for Feed, Trade, Medal and Source.</span>`;
document.body.append(tipEl);
let tipShown = false;
function hideTip() { if (!tipEl.classList.contains("show")) return; tipEl.classList.remove("show"); roomsBtn.classList.remove("tipglow"); }
const tipTimer = setInterval(() => {
  if (mapSeenOnce || tipShown) { clearInterval(tipTimer); return; }
  if (!welcomed || roomsBtn.hidden || state.trans || gesture || toastEl.classList.contains("show") || revealing() || document.body.matches(".listmode, .focused, .offering, .paying, .welcoming")) return;
  tipShown = true; tipEl.classList.add("show"); roomsBtn.classList.add("tipglow");
  setTimeout(hideTip, 7000);
}, 2500);
addEventListener("pointerdown", () => hideTip(), true);
// The About sheet says how the rooms work.
document.querySelector("#about ul")?.insertAdjacentHTML("afterbegin", `<li><b>Rooms</b>: pinch the wall closed (or tap the grid at the top left) and it shrinks into the app's map, five rooms on one screen, each showing what's happening in it: <b>Feed</b> (listings for your chases, newest first), <b>Chase</b> (this wall), <b>Trade</b> (your trade binder), <b>Medal</b> (the trophy room) and <b>Source</b> (where it looks). Tap a room or spread two fingers on it to go in; pinch any room closed to come back.</li>`);

// ----- live: a find lands in the Feed and pulses in the Source, as well as on the wall -----
function tickFeed() {
  if (state.trans || shuffle || tbl.anim || gesture || pg || revealing()) { setTimeout(tickFeed, 600); return; } // nor during the import's story and summary
  map.scan.last = Date.now(); map.scan.next = map.scan.last + 9000;
  arrive();
  setTimeout(tickFeed, 9000);
  if (place) kick();
}
function showArrival(c, drop) {
  const now = performance.now(), g = groups[c.g], away = Boolean(place) || state.trans?.kind === "map";
  // In the Chase lens the tile slides to the front of its set (a deal leads); seen from the map, it just takes its place.
  if (lifted && !state.focus) { if (state.trans || live.quick || away) layoutAll(); else liftLayout(true); }
  c.flash = { t0: now, drop }; for (const t of twinsOf(c)) t.flash = { t0: now, drop };
  if (!reduced) g.ripple = { t0: now, col: c.col, row: c.row, live: true };
  live.until = now + 3200;
  if (!live.news.includes(c)) live.news.push(c);
  if (state.lens === "chase" && !dealBar.hidden && !away) showDealBar();
  if (lensShown() && !reduced && !away) {
    const a = tileStart(c), b = chaseBtn.getBoundingClientRect();
    const x1 = b.left + b.width / 2, y1 = b.top + 3;
    live.line = { t0: now + 120, x0: a.x, y0: a.y, cx: x1, cy: a.y + (y1 - a.y) * 0.35, x1, y1 };
    setTimeout(glowChase, 640);
  } else if (lensShown() && !away) glowChase();
  else syncBadge();
  map.found.unshift({ c, price: c.deal, was: c.dealWas, at: Date.now(), src: "ebay" }); if (map.found.length > 40) map.found.pop();
  map.pulse = { c, t0: now }; map.feedIn = { id: `${c.id}|${Math.round(c.deal * 100)}`, t0: now };
  drawList(); kick();
}

// ----- the frame: the base's, with the map, the places and the move between them -----
function frame(now) {
  raf = 0; frameFoil = false;
  const T0 = state.trans;
  if (T0?.kind === "map" && !stepMapTrans(now, T0)) {
    lastFrame = now;
    drawMapTrans(now, T0);
    drawPop(now); kick(); return;
  }
  if (place && !placeGuard()) {
    const dt = Math.min(48, now - (lastFrame || now)); lastFrame = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    let more = false;
    if (place === "map") { wallSnap(now); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); more = drawMap(now); }
    else { if (stepPlaceInertia(dt)) more = true; if ((place === "feed" ? drawFeedRoom(now) : drawSourceRoom(now))) more = true; }
    if (drawPop(now)) more = true;
    if (state.press) more = true;
    if (more) kick(); else placeIdle();
    return;
  }
  if (tbl.on && tbl.q >= 1 && !tbl.anim) { drawTable(now); return; } // the table is its own level: nothing of the wall shows
  const dt = Math.min(48, now - (lastFrame || now)); lastFrame = now;
  let more = stepFly(now);
  if (stepInertia(dt)) more = true;
  if (view === "set" && !state.trans && !fly) clampCam(state.g);
  for (const c of drawnCards) { const t = emphasis(c); if (Math.abs(c.e - t) > 0.005) { c.e += (t - c.e) * Math.min(1, dt / 90); more = true; } else c.e = t; }
  const dimT = state.focus ? 1 : 0;
  if (Math.abs(state.dimAll - dimT) > 0.01) { state.dimAll += (dimT - state.dimAll) * Math.min(1, dt / 110); more = true; } else state.dimAll = dimT;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  const T = state.trans;
  if (T) {
    let p = T.kind === "open" ? 0 : clamp((now - T.t0) / T.dur, 0, 1), e = ease(p);
    if (T.kind === "open") {
      if (T.anim) { const a = clamp((now - T.anim.t0) / T.anim.dur, 0, 1); T.q = T.anim.from + (T.anim.to - T.anim.from) * (1 - Math.pow(1 - a, 3)); p = a; } else p = 0;
      const q = T.q;
      drawMosaic(now, 1 - q, T.g);
      drawPanel(T.g, now, 1 - q, 1 - q);
      drawHeader(T.g, now, T.cam, 0, clamp((q - 0.6) / 0.4, 0, 1));
      for (const c of T.g.cards) {
        if (c === state.focus) continue;
        const k = clamp(q * 1.15 - (c.k / T.g.cards.length) * 0.15, 0, 1);
        const kk = ease(k), B = binderRect(c, T.cam), A = mr(c.m);
        const x = A.x + (B.x - A.x) * kk, y = A.y + (B.y - A.y) * kk, w = A.w + (B.w - A.w) * kk, h = A.h + (B.h - A.h) * kk;
        if (y > vh + 40 || y + h < -40) continue;
        drawTile(c, x, y, w, h, now);
      }
    } else if (T.kind === "slide") {
      drawSet(T.from, now, T.fromCam, -T.dir * vw * e, 1 - e * 0.6);
      drawSet(T.g, now, cam, T.dir * vw * (1 - e), 0.4 + e * 0.6);
    } else if (T.kind === "morph") {
      for (const g of groups) drawPanel(g, now, 1, clamp((p - 0.55) / 0.45, 0, 1));
      for (const c of drawnCards) {
        const k = ease(clamp((now - T.t0 - c.delay) / (T.dur - 520), 0, 1)), a = mr(c.pm), b2 = mr(c.m);
        drawTile(c, a.x + (b2.x - a.x) * k, a.y + (b2.y - a.y) * k, a.w + (b2.w - a.w) * k, a.h + (b2.h - a.h) * k, now);
      }
    }
    if (p >= 1 && (T.kind !== "open" || T.anim)) { const done = T.done; state.trans = null; done?.(T); }
    more = true;
  } else if (view === "mosaic") {
    drawMosaic(now);
    for (const g of groups) if (g.ripple && now - g.ripple.t0 < 1600) more = true;
  } else if (state.g) {
    drawSet(state.g, now);
    if (state.g.burst || (state.g.ripple && now - state.g.ripple.t0 < 1600)) more = true;
    for (const c of state.g.cards) if (c.anim) { more = true; break; }
  }
  if (state.matches && view === "mosaic" && !T && !bnd.on) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink;
    for (const c of state.matches) { ctx.beginPath(); ctx.arc(c.m.x + c.m.w / 2, c.m.y - mScroll + c.m.h / 2, Math.max(6, c.m.h * 0.7), 0, Math.PI * 2); ctx.stroke(); }
  }
  if (state.focus) { const c = state.focus, r = binderRect(c, cam); ctx.globalAlpha = 1; drawTile(c, r.x, r.y, r.w, r.h, now); if (c.anim) more = true; if (c.owned && c.tier >= 3 && !reduced) more = true; }
  ctx.globalAlpha = 1;
  for (const c of drawnCards) if (c.anim) { more = true; break; }
  drawMarks(); drawPicks();
  if (drawRings(now)) more = true;
  if (drawMints(now)) more = true;
  if (drawLive(now)) more = true;
  if (drawPop(now)) more = true;
  drawTraders(now);
  if (drawFlights(now)) more = true;
  if (tbl.on) drawTable(now);
  if (frameFoil) more = true;
  if (state.press) more = true;
  if (state.introT0 && now - state.introT0 < 3000 && !reduced) more = true;
  if (more) kick();
}
// Something of the wall's own took over (a set opened from a sheet, the table from a toast): the place steps aside.
// A layout flight on the hidden wall just lands.
function placeGuard() {
  if (state.trans?.kind === "morph") finishTransition();
  if (view === "mosaic" && !state.trans && !room.on && !bnd.on && !tbl.on) return false;
  if (place === "feed") feedSeen();
  place = null; pg = null; pInertia = 0; setChrome();
  return true;
}
// While a place is up and nothing moves, the Source's clock still ticks: a frame four times a second, not sixty.
let idleTimer = 0;
function placeIdle() {
  if (reduced || idleTimer) return;
  idleTimer = setTimeout(() => { idleTimer = 0; if (place) kick(); }, 250);
}

// Debug builds only: the tests' hook sees the rooms.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { map: { get: () => map }, place: { get: () => place }, mapLayout: { value: mapLayout }, toMap: { value: toMap }, openPlace: { value: openPlace }, feedData: { value: () => feedData() }, room: { get: () => room }, bnd: { get: () => bnd } }); }, 0);
