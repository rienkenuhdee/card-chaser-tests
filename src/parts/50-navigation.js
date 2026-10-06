// ---------- navigation: mosaic, set, card ----------
// The interface moves the camera. Every gesture lands on a composed view: the mosaic, a set framed to the screen, or a card.
const backBtn = document.getElementById("back");
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on;
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : "";
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); updateCount();
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
  hideCaption(); tick(8);
  state.trans = openTrans(g, 0, fitCam(g)); state.trans.then = then;
  settle(1, 720);
}
function exitToMosaic() {
  if (state.trans || view !== "set") return;
  unfocus(); tick(6);
  inertia = false; fly = null;
  // Bring the panel it came from into view first, so the cards have somewhere to land.
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
backBtn.onclick = () => { if (tbl.on) closeTable(); else exitToMosaic(); };
