// ---------- rooms: the app as five places on a map, one level above the wall (round 21) ----------
// Production has five tabs: Feed, Chase, Trade, Medal, Source. Here there is no tab bar. The app is a map of five room
// cards one zoom level above the wall, each card live with what's inside (91-room-cards.js). Pinch the wall closed (or
// tap the rooms button at the top left, where Back sits inside a set) and it shrinks into its card while the other four
// settle in around it; spread on a card, or tap it, and that room grows to fill the screen; pinch any room closed to
// come back. At a room's own level a sideways flick goes to the next room along the map, the way a flick moves
// between sets in a binder.
//   Feed    every listing found for the cards you chase, newest first (92-feed.js)
//   Chase   the wall, with its lenses: Have, Need and Chase
//   Trade   the trade binder's cover, the trade checker, who to trade with (94-trade-room.js); the binder and the
//           table are levels inside it
//   Medal   the trophy room (67-room.js)
//   Source  where Card Chaser looks, a switch for each (93-source.js)
// Feed, Trade and Source are pages (real lists: they scroll natively, read aloud and show in the list view); Chase and
// Medal are drawn on the canvas. A move up to the map, or into a room, is one transition with a position
// (state.trans "map": q 0 the room, 1 the map), held under the fingers and snapped by speed, then position. A page
// moves by a CSS transform; a canvas room is drawn live at its size every frame. No full-screen pictures are taken:
// iOS caps what all canvases together may hold, and a picture per pinch (with half-size copies) ran past it and left a
// blank screen. The only picture is the wall's on the Chase card, card-sized and reused. A flick between rooms is
// the same idea sideways (state.trans "hop").

const ROOM_COL = { feed: "c-blue", chase: "c-red", trade: "c-green", medal: "c-yellow", source: "c-blue" }; // production's tab colours
const mapUI = { L: null, press: null, kb: -1, pulse: null, feedIn: null };
let mapSeenOnce = false;
try { mapSeenOnce = localStorage.getItem("wall-map-seen") === "1"; } catch { /* fresh */ }
const mapSeen = () => { if (mapSeenOnce) return; mapSeenOnce = true; try { localStorage.setItem("wall-map-seen", "1"); } catch { /* private mode */ } };
// The map is up a level from anything settled: not while the first run, the import, a trade, a sheet or marking is under way.
const mapReady = () => !wel.on && !story && !ar.on && !tbl.on && !marking && !state.focus && !pop.c && !paying() && !document.body.classList.contains("listmode") && !document.querySelector("dialog[open]");
const SCREEN = () => ({ x: 0, y: 0, w: vw, h: vh });

// ----- the map's layout: Feed along the top, Chase and Trade over Medal in the middle, Source along the bottom -----
// It reads like production's tab bar: Feed, Chase, Trade, Medal, Source. Chase is the biggest: its card has the wall's
// own proportions, so the wall shrinks into it without cropping.
const wallBand = () => ({ x: SAFE.left, y: topPad() - 4, w: vw - SAFE.left - SAFE.right, h: vh - botPad() + 4 - (topPad() - 4) });
const CARD_HEAD = 56; // a card's name and its count line
function mapLayout() {
  const key = `${vw}|${vh}|${botPad()}|${SAFE.left}|${SAFE.right}`;
  if (mapUI.L?.key === key) return mapUI.L;
  if (landPhone()) return (mapUI.L = mapAcross(key));
  const W = Math.min(vw - 20, 1180), x0 = Math.round((vw - W) / 2), gap = 10, top = topPad() - 2, bottom = vh - 34, avail = bottom - top;
  const fH = Math.round(clamp(avail * 0.21, 132, 186)), sH = Math.round(clamp(avail * 0.18, 126, 156));
  const my = top + fH + gap, mh = avail - fH - sH - gap * 2;
  const B = wallBand(), asp = B.w / B.h, FOOT = 50;
  let thH = mh - CARD_HEAD - FOOT, thW = thH * asp;
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
  const thumb = { x: x0 + (cw - thW) / 2, y: my + CARD_HEAD, w: thW, h: thH };
  return (mapUI.L = { key, r, thumb, hintY: vh - 14 });
}
// On a phone on its side (round 22) the map reads across, in the tab bar's order: Feed, then Chase (the biggest, the
// wall's own proportions), then Trade over Medal, then Source, each a column clear of the notch.
function mapAcross(key) {
  const gap = 10, x0 = 10 + SAFE.left, W = vw - 20 - SAFE.left - SAFE.right, top = topPad() - 2, bottom = vh - SAFE.bottom - 30, h = bottom - top;
  const B = wallBand(), asp = B.w / B.h, FOOT = 50, U = W - gap * 3;
  let cw = Math.round(U * 0.46), thW = cw - 16, thH = thW / asp;
  if (thH > h - CARD_HEAD - FOOT) { thH = h - CARD_HEAD - FOOT; thW = thH * asp; cw = Math.round(thW + 16); }
  const sw = Math.round((U - cw) / 3), fx = x0, cx = fx + sw + gap, tx = cx + cw + gap, sx = tx + sw + gap, sW = x0 + W - sx, th = Math.round((h - gap) / 2);
  const r = {
    feed: { x: fx, y: top, w: sw, h },
    chase: { x: cx, y: top, w: cw, h },
    trade: { x: tx, y: top, w: sw, h: th },
    medal: { x: tx, y: top + th + gap, w: sw, h: h - th - gap },
    source: { x: sx, y: top, w: sW, h },
  };
  const thumb = { x: cx + (cw - thW) / 2, y: top + CARD_HEAD + Math.max(0, (h - CARD_HEAD - FOOT - thH) / 2), w: thW, h: thH };
  return { key, r, thumb, hintY: vh - SAFE.bottom - 12 };
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
  ctx.save(); rr(D.x, D.y, D.w, D.h, 6); ctx.clip(); drawRoomAt("chase", wallBand(), D, now + 4000); ctx.restore(); curFont = "";
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
// A page at its place in a move to or from the map: scaled into D, clipped to its card R, fading as the card's face
// comes up under it.
function pageAt(el, R, D, a) {
  const k = D.w / vw, l = (R.x - D.x) / k, t = (R.y - D.y) / k, w = R.w / k, h = R.h / k;
  el.style.transform = `translate(${D.x.toFixed(2)}px, ${D.y.toFixed(2)}px) scale(${k.toFixed(4)})`;
  el.style.clipPath = `inset(${t.toFixed(1)}px ${(vw - l - w).toFixed(1)}px ${(vh - t - h).toFixed(1)}px ${l.toFixed(1)}px round ${(14 / k).toFixed(1)}px)`;
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
  if (id === "medal") { if (mode !== "set") { arrange("set"); markFilters(); } roomOn(); } // the trophy room is a level of the set wall
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
// The geometry of a move at q: the room's rect R (full screen to its card), what's drawn into it (D, scaled to the
// card's width), and how far the card's own face has come up (fb).
function mapGeom(T, use) {
  const L = mapLayout(), A = L.r[T.room], e = reduced ? (T.q < 0.5 ? 0 : 1) : ease(clamp(T.q, 0, 1));
  const R = lerpRect(SCREEN(), A, e), fb = clamp((e - 0.55) / 0.4, 0, 1), k1 = A.w / vw;
  const D = lerpRect(SCREEN(), { x: A.x, y: A.y - (topPad() - 8) * k1, w: A.w, h: vh * k1 }, e);
  use(R, D, fb, e, L, A);
}
function drawMapTrans(now, T) {
  prepCards(); // a card whose picture is out of date is painted first, before anything else is drawn
  mapGeom(T, (R, D, fb, e, L, A) => {
    const id = T.room;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
    if (e > 0.01) { // the other rooms come in from just beyond their places
      const ax = A.x + A.w / 2, ay = A.y + A.h / 2, push = (1 - e) * 0.24;
      for (const k of ROOMS) {
        if (k === id) continue;
        const r = L.r[k];
        drawCard(k, { x: r.x + (r.x + r.w / 2 - ax) * push, y: r.y + (r.y + r.h / 2 - ay) * push, w: r.w, h: r.h }, now, e);
      }
      drawMapHint(clamp((e - 0.7) / 0.3, 0, 1));
    }
    if (id === "chase") { // the wall itself becomes the card's picture; the card's frame and words come up around it
      const fa = clamp((e - 0.45) / 0.45, 0, 1), W = lerpRect(wallBand(), L.thumb, e);
      if (fa > 0) { ctx.globalAlpha = fa; rr(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 14 * e); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.save(); rr(W.x, W.y, W.w, W.h, 6 * e); ctx.clip();
      if (e >= 0.999) wallThumb(W, now); else drawRoomAt("chase", wallBand(), W, now);
      ctx.restore(); curFont = "";
      if (fa > 0) chaseChrome(R, now, fa);
      return;
    }
    // A room shrinks into its card and the card's face comes up through it.
    ctx.save(); rr(R.x, R.y, R.w, R.h, 14 * e); ctx.clip();
    ctx.fillStyle = id === "medal" ? theme["room-bg"] : theme.bg; ctx.fillRect(R.x, R.y, R.w, R.h);
    if (fb > 0 || PAGES[id]) { const k = R.w / A.w; ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * R.x, dpr * R.y); drawCard(id, { x: 0, y: 0, w: A.w, h: A.h }, now, 1); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (id === "medal" && fb < 1) { ctx.globalAlpha = 1 - fb; drawRoomAt("medal", SCREEN(), D, now); }
    ctx.restore(); curFont = ""; ctx.globalAlpha = 1;
    if (PAGES[id]) pageAt(PAGES[id], R, D, 1 - fb); // a page moves itself, over the canvas
  });
  ctx.globalAlpha = 1;
}
function drawMapHint(a) {
  if (a <= 0.01) return;
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.muted; font(500, 12.5);
  ctx.fillText(fitText(vw < 520 ? "Tap a room to go in. Pinch any room closed to come back." : "Tap a room, or spread two fingers on it, to go in. Pinch any room closed to come back here.", vw - 24), vw / 2, mapLayout().hintY);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
// The map at rest: five cards, each showing what's going on inside.
function drawMap(now) {
  prepCards();
  const L = mapLayout();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  let more = false;
  for (const id of ROOMS) if (drawCard(id, L.r[id], now, 1)) more = true;
  const pr = mapUI.press && L.r[mapUI.press];
  if (pr) { ctx.lineWidth = 2; ctx.strokeStyle = theme.ink; rr(pr.x + 1, pr.y + 1, pr.w - 2, pr.h - 2, 13); ctx.stroke(); }
  const kr = mapUI.kb >= 0 && L.r[ROOMS[mapUI.kb]];
  if (kr) { ctx.lineWidth = 2.5; ctx.strokeStyle = theme.ink; rr(kr.x - 3, kr.y - 3, kr.w + 6, kr.h + 6, 16); ctx.stroke(); }
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
// The Chase card's small lens bar: a tap on a lens goes into Chase, and the wall then takes that lens (its own flight).
function chaseLensAt(x, y) {
  const R = mapLayout().r.chase, bx = R.x + 12, by = R.y + R.h - 40, bw = R.w - 24;
  if (y < by - 6 || y > by + 34 || x < bx || x > bx + bw) return null;
  return LENSES[clamp(Math.floor(((x - bx) / bw) * LENSES.length), 0, LENSES.length - 1)];
}
const LENSES = ["have", "need", "chase"];
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
