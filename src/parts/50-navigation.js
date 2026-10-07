// ---------- navigation: mosaic, set, card ----------
// The interface moves the camera. Every gesture lands on a composed view: the mosaic, a set framed to the screen, or a card.
const backBtn = document.getElementById("back");
// The app is five rooms (round 21): Feed, Chase (this wall), Trade, Trophies (the trophy room; its id is still "medal") and Source, on a map one
// level up (90-rooms.js). rooms.at is the room you're in (or came to the map from); rooms.map is true on the map.
const ROOMS = ["feed", "chase", "trade", "medal", "source"];
const ROOM_NAME = { feed: "Feed", chase: "Chase", trade: "Trade", medal: "Trophies", source: "Source" };
const rooms = { at: "chase", map: false };
const roomsBtn = document.getElementById("rooms"), roomsNav = document.getElementById("rooms-nav");
const pgFeed = document.getElementById("pg-feed"), pgTrade = document.getElementById("pg-trade"), pgSource = document.getElementById("pg-source");
const PAGES = { feed: pgFeed, trade: pgTrade, source: pgSource }; // the rooms that are pages; Chase and Trophies are drawn
const moving = () => state.trans?.kind === "map" || state.trans?.kind === "hop"; // between rooms, or up to the map
// A room's own level: the rooms button (up to the map) sits where Back sits one level further in.
const atRoot = () => !rooms.map && view === "mosaic" && !tbl.on && !bnd.on;
const upBtn = () => [roomsBtn, backBtn].find((b) => !b.hidden && b.offsetParent) || null; // whichever is at the top left: the rooms button, or Back in its place
function setChrome() {
  const go = moving(), root = atRoot();
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  document.body.classList.toggle("maptrans", go);
  document.body.dataset.room = rooms.map ? "map" : rooms.at;
  backBtn.hidden = go || rooms.map || root;
  backBtn.setAttribute("aria-label", bnd.on && !tbl.on ? "Back to the Trade room" : room.on && view === "set" ? "Back to Trophies" : "Back to everything");
  roomsBtn.hidden = go || !root; // (the welcome, the import's story and its summary hide it too, by their classes)
  roomsNav.hidden = !rooms.map;
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = rooms.map ? "Rooms: Feed, Chase, Trade, Trophies, Source" : tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : bnd.on ? (bnd.show ? "Trade binder, Show mode" : "Trade binder") : room.on ? "Trophies" : rooms.at === "chase" ? "" : ROOM_NAME[rooms.at];
  if (marking && view !== "set") leaveMark();
  syncPages(); syncShelfPad(); updateCount(); syncBadge();
}
// Opening and closing a group are one transition with a position, q (0 is the mosaic, 1 the binder). A tap plays it;
// a pinch holds it under your fingers; letting go settles it to whichever end is nearer.
function openTrans(g, q, C) { return { kind: "open", g, q, cam: { ...C }, done: settled }; }
function settle(to, dur) {
  const T = state.trans; if (!T || T.kind !== "open") return;
  T.anim = { from: T.q, to, t0: performance.now(), dur: reduced ? 1 : dur ?? 180 + 420 * Math.abs(to - T.q) };
  kick();
}
function settled(T) {
  if (T.q >= 0.5) { view = "set"; state.g = T.g; Object.assign(cam, T.cam); tick(6); T.then?.(); }
  else { view = "mosaic"; state.g = null; }
  setChrome(); kick();
}
function enterGroup(g, { then = null } = {}) {
  if (state.trans) return;
  if (g.md) { mdTap(g); return; } // a medal, a filter or a fold line in the trophy room
  if (g.fan) { toggleFan(g.fan); return; }
  if (g.pick) { openScope(g.pick.g, g.pick.scope); return; }
  hideCaption(); tick(8);
  state.trans = openTrans(g, 0, fitCam(g)); state.trans.then = then;
  settle(1, 720);
}
function exitToMosaic() {
  if (state.trans || view !== "set") return;
  if (room.on && state.g && !inCase(state.g)) endRoom();
  unfocus(); tick(6);
  inertia = false; fly = null;
  const m = state.g.m; if (m.y - mScroll < topPad() || m.y + m.h - mScroll > vh - botPad()) mScroll = clamp(m.y - topPad() - 10, 0, mMax);
  state.trans = openTrans(state.g, 1, cam);
  settle(0, 620);
}
function slideGroup(d) {
  if (state.trans || view !== "set") return;
  const i = groups.indexOf(state.g), n = groups[i + d];
  if (!n) { bump(d); return; }
  tick(6);
  const fromCam = { ...cam };
  const prev = state.g;
  state.g = n; Object.assign(cam, fitCam(n));
  state.trans = { kind: "slide", from: prev, fromCam, g: n, dir: d, t0: performance.now(), dur: reduced ? 1 : 460, done: () => kick() };
  setChrome(); kick();
}
function bump(d) {
  if (reduced || view !== "set") return;
  const a = { ...cam };
  flyTo({ ...cam, x: cam.x + (d * 24) / cam.s }, 130);
  setTimeout(() => flyTo(a, 240), 140);
}
backBtn.onclick = () => { if (moving()) return; if (tbl.on) closeTable(); else if (bnd.on) { if (bnd.show) tbHandBack(); else closeBinder(); } else if (view === "set") exitToMosaic(); else toMap(); };
