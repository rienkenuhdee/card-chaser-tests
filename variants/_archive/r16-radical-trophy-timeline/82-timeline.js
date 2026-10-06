// ---------- the timeline: the collection's history, one level above the wall ----------
// The trophies are the collection's history. Pinch the mosaic itself in (two fingers closing on the wall, which did
// nothing before) and the whole wall shrinks to a thumbnail while the trophies spread out around it on a line of
// dates: the oldest furthest left, the wall's thumbnail at today, the shelf's fresh trophies hanging right beside it.
// Drag sideways through the years; spread (or tap the wall, or Back) and the thumbnail grows back into the mosaic
// under your fingers. Tap a plaque and its album opens from where it hangs, and closes back onto the line.
// Milestones with no trophy are ticks on the line: the first card, the days a batch of cards arrived, the first chase
// made, a finished set kept on the wall, a trade done. Only a wall with a trophy has a story: with none, a pinch on
// the mosaic does nothing, exactly as before.
// The thumbnail is the mosaic drawn once into an offscreen image (its plaques left out) and drawn through a scale, so
// the held pinch costs one drawImage a frame plus the plaques. Reduced motion: no shrink, the timeline simply appears.

const tl = { x: 0, v: 0, inertia: false, L: null, snap: null, snapping: false, layoutN: 0, g: null };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TL_PLQ = () => clamp(Math.round(vw * 0.44), 150, 196); // a plaque's width on the line
const tlReady = () => mode === "set" && !wel.on && !tbl.on && !marking && !state.matches && !state.focus && groups.some((g) => g.done);
const whenOf = (at) => new Date(at).toLocaleDateString("en-US", Date.now() - at > 300 * DAY ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });

// ----- the story: milestones that aren't trophies -----
function milestones() {
  const ms = [], byDay = new Map();
  let first = null;
  for (const c of cards) {
    if (!c.owned || !c.got) continue;
    if (!first || c.got < first.got) first = c;
    const d = Math.floor(c.got / DAY); byDay.set(d, (byDay.get(d) || 0) + 1);
  }
  if (first) ms.push({ at: first.got, text: `First card: ${first.name}` });
  for (const [d, n] of byDay) if (n >= 20) ms.push({ at: d * DAY + DAY / 2, text: `${n.toLocaleString()} cards arrived` });
  // A chase you made carries its moment in its id.
  let made = null;
  for (const r of chases) { if (!/^c[0-9a-z]{8}/.test(r.id)) continue; const t = parseInt(r.id.slice(1, 9), 36); if (t > 1e12 && t <= Date.now() + DAY && (!made || t < made.at)) made = { at: t, text: `First chase: ${r.label || labelOf(r)}` }; }
  if (made) ms.push(made);
  for (const g of groups) { const f = finishOf(g); if (f && !f.put) ms.push({ at: f.at, text: `${trophyName(g)} finished, on the wall`, gold: true }); }
  for (const r of trades) if (r.state === "done") ms.push({ at: r.doneAt || r.at, text: `Traded with ${traderOf(r)?.name || "a collector"}` });
  return ms.sort((a, b) => a.at - b.at);
}

// ----- layout, in timeline coordinates (x: pixels from the first date; screen x is x - tl.x) -----
function tlLayout() {
  const key = `${vw}|${vh}|${mMax}|${tl.layoutN}`;
  if (tl.L?.key === key) return tl.L;
  const now = Date.now();
  const plq = groups.filter((g) => g.done).sort((a, b) => (finishOf(a)?.at || 0) - (finishOf(b)?.at || 0)); // oldest first
  const ms = milestones();
  const t1 = now, t0 = Math.min(now - 60 * DAY, ...plq.map((g) => finishOf(g).at), ...ms.map((m) => m.at));
  const ppd = clamp((vw * 2.2) / ((t1 - t0) / DAY), 0.35, 8); // the whole story is about two screens wide
  const X = (t) => ((t - t0) / DAY) * ppd;
  // The thumbnail: the wall from under the shelf to the top of the case (the plaques travel on their own), small, its
  // middle on the line.
  const live = groups.filter((g) => !g.done && g.m);
  const top = Math.max(0, (shelf ? shelf.y + shelf.h : topPad()) - 6);
  const bot = Math.max(top + 10, (trophyCase ? trophyCase.y : newPanel ? newPanel.y + newPanel.h : live.reduce((a, g) => Math.max(a, g.m.y + g.m.h), top)) + 6), H = bot - top;
  const k = Math.min((0.44 * vh) / H, vw < 700 ? 0.3 : 0.4), tw = vw * k, th = H * k;
  const lineY = Math.round(vh * 0.5);
  const thumb = { x: X(t1) + 8, y: lineY - th / 2, w: tw, h: th }; // the line runs into the wall's left edge
  // Plaques hang below the line in date order. A crowded day fans out to the left, each on a string to its date.
  const W = TL_PLQ(), gap = 8, py = lineY + 26;
  let right = thumb.x - 10;
  for (let i = plq.length - 1; i >= 0; i--) {
    const g = plq[i], at = finishOf(g).at, x = Math.min(X(at) - W / 2, right - W);
    g.tm = { x, y: py, w: W, h: PLQ_H, at: X(at) }; right = x - gap;
  }
  // Milestone ticks above the line, each label ending at its tick; a label steps up a lane when one is in the way.
  const lanes = [];
  let minX = 0;
  font(600, 11);
  for (const m of ms) {
    m.x = X(m.at); m.label = `${fitText(m.text, 230)}, ${whenOf(m.at)}`; m.w = textW(m.label);
    let l = 0; while (l < lanes.length && lanes[l] > m.x - m.w - 18) l++;
    if (l >= 5) l = 0;
    m.lvl = l; lanes[l] = m.x; minX = Math.min(minX, m.x - m.w - 8);
  }
  // The growth curve: how many cards you had, over time, rising to meet the wall.
  const got = cards.filter((c) => c.owned && c.got).map((c) => c.got).sort((a, b) => a - b), N = 160, curve = [];
  for (let i = 0, k = 0; i <= N; i++) { const t = t0 + ((t1 - t0) * i) / N; while (k < got.length && got[k] <= t) k++; curve.push([X(t), k / Math.max(1, got.length)]); }
  const left = Math.min(-80, right, minX) - 16;
  const worth = plq.reduce((a, g) => a + worthOf(g.base), 0), owned = cards.filter((c) => c.owned).length;
  const story = !plq.length ? "Nothing finished yet." : `${plq.length} finished, worth ${money(worth)}. First: ${trophyName(plq[0])}, ${whenOf(finishOf(plq[0]).at)}.`;
  // Home: the wall at the right of a phone screen, centred on a wide one, and the line can't go past today.
  const cx = vw < 700 ? vw - 14 - tw / 2 : vw / 2, home = thumb.x + tw / 2 - cx;
  return (tl.L = { key, t0, t1, ppd, X, lineY, thumb, plq, ms, left, home, min: Math.min(home, left - 14), max: home, story, top, H, owned, curve, curveH: clamp(lineY - topPad() - 80, 60, 200) });
}
// The wall as one image: the mosaic drawn in screen-high slices on the main canvas and copied off, without its plaques
// (they travel on their own). Made once, kept until the wall changes.
function tlSnap() {
  const key = `${vw}|${vh}|${dpr}|${mMax}|${theme.bg}|${state.lens}|${state.value ? 1 : 0}|${state.time ? 1 : 0}|${mode}|${tl.layoutN}`;
  if (tl.snap?.key === key) return tl.snap;
  const L = tlLayout(), k = Math.min(dpr, Math.sqrt(2.6e6 / Math.max(1, vw * L.H)));
  const cv = tl.snap?.cv || document.createElement("canvas");
  cv.width = Math.ceil(vw * k); cv.height = Math.ceil(L.H * k);
  const x = cv.getContext("2d"), save = mScroll, now = performance.now();
  tl.snapping = true;
  for (let y = L.top; y < L.top + L.H; y += vh) {
    mScroll = y;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
    drawMosaic(now);
    const h = Math.min(vh, L.top + L.H - y);
    x.drawImage(canvas, 0, 0, Math.round(vw * dpr), Math.round(h * dpr), 0, (y - L.top) * k, vw * k, h * k);
  }
  mScroll = save; tl.snapping = false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Half and quarter size copies: the one nearest the scale on screen is drawn, so a small thumbnail stays cheap.
  const lv = [cv];
  for (let i = 1; i <= 2; i++) { const c = document.createElement("canvas"), a = lv[i - 1]; c.width = Math.max(1, Math.round(a.width / 2)); c.height = Math.max(1, Math.round(a.height / 2)); c.getContext("2d").drawImage(a, 0, 0, c.width, c.height); lv.push(c); }
  return (tl.snap = { key, cv, lv });
}
const snapFor = (snap, w) => { const r = (w * dpr) / snap.cv.width; return snap.lv[r <= 0.27 ? 2 : r <= 0.55 ? 1 : 0]; };
function layoutAll() { lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null; for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); } groups.forEach(binderLayout); if (lifted) { newPanel = null; liftedLayout(); } else mosaicLayout(); tl.layoutN++; tl.L = null; }
// The mosaic, as before; while the wall is being copied for its thumbnail the plaques and the case label stay out.
function drawMosaic(now, alpha = 1, except = null) {
  const pick = picking() && wel.picks.size > 0;
  let settling = false;
  for (const g of groups) {
    const t = pick && g.set && !wel.picks.has(g.set.id) ? 0.42 : 1;
    g.pe ??= 1;
    if (Math.abs(g.pe - t) > 0.01) { g.pe += (t - g.pe) * (reduced ? 1 : 0.16); settling = true; } else g.pe = t;
    if (g === except || (tl.snapping && g.done)) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    const a = alpha * g.pe;
    drawPanel(g, now, a);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, a);
  }
  if (!except && (!state.trans || tl.snapping)) { drawNewPanel(now, alpha); if (!tl.snapping) drawCaseLabel(alpha); }
  if (settling && !tl.snapping) kick();
}
// The case label on the wall says how to get to the story, and a tap on it goes there too.
function drawCaseLabel(alpha) {
  const t = trophyCase; if (!t || state.trans) return;
  const m = mr(t); if (m.y > vh || m.y + m.h < 0) return;
  ctx.globalAlpha = alpha; ctx.fillStyle = theme.muted; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; font(700, 12.5, true);
  ctx.fillText("Trophies", m.x + PG + 10, m.y + 19);
  ctx.textAlign = "right"; font(600, 11.5); ctx.fillText("Pinch in for the story ›", m.x + m.w - PG - 10, m.y + 19); ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}
const caseLabelAt = (sx, sy) => { const t = trophyCase; if (!t || view !== "mosaic") return false; const y = sy + mScroll; return sx >= t.x && sx <= t.x + t.w && y >= t.y && y <= t.y + t.h; };

// ----- drawing: the wall shrinking to its thumbnail, the plaques flying to the line, the line fading in -----
function drawTL(now, q = 1, alpha = 1, except = null) {
  const L = tlLayout(), e = reduced ? (q < 0.5 ? 0 : 1) : ease(q);
  if (e <= 0) { drawMosaic(now, alpha); return; }
  const snap = tlSnap();
  tl.x = clamp(tl.x, L.min, L.max);
  const sx = tl.x + (L.home - tl.x) * (1 - e), S = (x) => x - sx; // the line slides home as the wall grows back
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  ctx.globalAlpha = alpha;
  // The wall, from where it is to its thumbnail.
  const A = { x: 0, y: L.top - mScroll, s: 1 }, B = { x: S(L.thumb.x), y: L.thumb.y, s: L.thumb.w / vw };
  const s = Math.exp(Math.log(B.s) * e), x = A.x + (B.x - A.x) * e, y = A.y + (B.y - A.y) * e, w = vw * s, h = L.H * s;
  const fa = clamp((e - 0.5) / 0.5, 0, 1); // the frame, the line and its labels
  if (fa > 0.01) { ctx.globalAlpha = alpha * fa * 0.6; ctx.fillStyle = theme["slot-line"]; rr(x - 1, y - 1, w + 2, h + 4, 3); ctx.fill(); ctx.globalAlpha = alpha; }
  ctx.drawImage(snapFor(snap, w), x, y, w, h);
  if (fa > 0.01) {
    ctx.globalAlpha = alpha * fa;
    ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    drawLine(L, S, now, alpha * fa);
    drawToday(L, x + w / 2, y + h, alpha * fa);
  }
  // The plaques, from their place on the wall to their place on the line.
  for (const g of L.plq) {
    if (g === except) continue;
    const b = { x: S(g.tm.x), y: g.tm.y, w: g.tm.w, h: g.tm.h }, r = e >= 1 ? b : lerpR(mr(g.m), b, e);
    if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
    drawPlaque(g, r, now, alpha, 1);
  }
  ctx.globalAlpha = 1;
}
function drawLine(L, S, now, a) {
  const y = L.lineY, x0 = S(L.left + 8), x1 = S(L.thumb.x - 2);
  ctx.globalAlpha = a; ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
  // The curve first, under everything: the collection filling in.
  ctx.beginPath(); ctx.moveTo(S(L.curve[0][0]), y);
  for (const [cx, v] of L.curve) ctx.lineTo(S(cx), y - v * L.curveH);
  ctx.lineTo(S(L.curve[L.curve.length - 1][0]), y); ctx.closePath();
  ctx.globalAlpha = a * (theme.dark ? 0.09 : 0.06); ctx.fillStyle = theme.ink; ctx.fill();
  ctx.globalAlpha = a * 0.35; ctx.beginPath();
  L.curve.forEach(([cx, v], i) => { if (i) ctx.lineTo(S(cx), y - v * L.curveH); else ctx.moveTo(S(cx), y - v * L.curveH); });
  ctx.lineWidth = 1.2; ctx.strokeStyle = theme.ink; ctx.stroke();
  ctx.globalAlpha = a;
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x0, y, x1 - x0, 1.5);
  // Months as ticks, labelled where there's room; January carries the year.
  const step = [1, 2, 3, 6, 12].find((n) => n * 30.4 * L.ppd >= 64) || 12;
  const d = new Date(L.t0); d.setDate(1); d.setHours(0, 0, 0, 0);
  font(600, 10.5); ctx.fillStyle = theme.muted;
  for (; d.getTime() <= L.t1; d.setMonth(d.getMonth() + 1)) {
    const tx = S(L.X(d.getTime())); if (tx < -40 || tx > vw + 40 || tx >= x1) continue;
    const m = d.getMonth(), big = (d.getFullYear() * 12 + m) % step === 0;
    ctx.fillStyle = theme["slot-line"]; ctx.fillRect(tx, y - (big ? 5 : 3), 1, big ? 5 : 3);
    if (big) { ctx.fillStyle = theme.muted; ctx.fillText(m === 0 ? String(d.getFullYear()) : MON[m], tx, y - 9); }
  }
  // Strings from each plaque to its date.
  ctx.strokeStyle = theme.muted; ctx.lineWidth = 1; ctx.globalAlpha = a * 0.45;
  for (const g of L.plq) { const ax = S(g.tm.at), bx = S(g.tm.x) + g.tm.w / 2; if (Math.max(ax, bx) < -20 || Math.min(ax, bx) > vw + 20) continue; ctx.beginPath(); ctx.moveTo(ax, y + 1); ctx.lineTo(bx, g.tm.y + PG); ctx.stroke(); }
  ctx.globalAlpha = a; ctx.fillStyle = theme.gold;
  for (const g of L.plq) { const ax = S(g.tm.at); if (ax < -8 || ax > vw + 8) continue; ctx.beginPath(); ctx.arc(ax, y + 0.75, 3, 0, Math.PI * 2); ctx.fill(); }
  // Milestones: a tick up from the line, its line of text ending at it.
  font(600, 11); ctx.textAlign = "right";
  for (const m of L.ms) {
    const tx = S(m.x); if (tx < -10 || tx - m.w > vw + 10) continue;
    const ly = y - 24 - m.lvl * 17;
    ctx.fillStyle = m.gold ? theme.gold : theme.ink;
    ctx.fillRect(tx - 0.5, ly + 4, 1, y - ly - 4);
    ctx.beginPath(); ctx.arc(tx, y + 0.75, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(m.label, tx - 5, ly);
  }
  // The header, fixed: what the story adds up to (two lines when one won't do). And a hint along the bottom.
  ctx.textAlign = "left"; ctx.fillStyle = theme.ink; font(800, 21, true); ctx.fillText("Trophies", 14, topPad() + 26);
  ctx.fillStyle = theme.muted; font(500, 12.5);
  const cut = L.story.indexOf(" First:");
  if (textW(L.story) <= vw - 28 || cut < 0) ctx.fillText(fitText(L.story, vw - 28), 14, topPad() + 45);
  else { ctx.fillText(L.story.slice(0, cut), 14, topPad() + 45); ctx.fillText(fitText(L.story.slice(cut + 1), vw - 28), 14, topPad() + 62); }
  ctx.textAlign = "center"; font(500, 12); ctx.fillText("Drag sideways. Spread or tap the wall to go back.", vw / 2, vh - botPad() - 10);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
function drawToday(L, cx, by, a) {
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.ink; font(700, 12); ctx.fillText("Today", cx, by + 18);
  ctx.fillStyle = theme.muted; font(500, 11); ctx.fillText(fitText(`Your wall, ${L.owned.toLocaleString()} of ${TOTAL.toLocaleString()}`, L.thumb.w + 60), cx, by + 33);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
function tlHit(sx, sy) {
  const L = tlLayout();
  for (const g of L.plq) { const x = g.tm.x - tl.x + PG, y = g.tm.y + PG, w = g.tm.w - PG * 2, h = g.tm.h - PG * 2; if (sx >= x && sx <= x + w && sy >= y && sy <= y + h) return { g }; }
  const t = L.thumb, x = t.x - tl.x;
  if (sx >= x - 6 && sx <= x + t.w + 6 && sy >= t.y - 6 && sy <= t.y + t.h + 40) return { thumb: true };
  for (const m of L.ms) { const mx = m.x - tl.x, ly = L.lineY - 24 - m.lvl * 17; if (sx > mx - m.w - 10 && sx < mx + 10 && sy > ly - 14 && sy < ly + 6) return { m }; if (Math.abs(sx - mx) < 12 && sy > ly - 4 && sy < L.lineY + 8) return { m }; }
  return null;
}
// A plaque's tiles sit where it hangs, so its album grows out of the line and closes back onto it.
function placeOnLine(g) {
  tlLayout(); if (!g.tm) return;
  g.m = { x: g.tm.x - tl.x, y: g.tm.y + mScroll, w: g.tm.w, h: g.tm.h }; packPlaque(g); g.plq = plaqueInfo(g);
}

// ----- moving between the wall and the timeline: one transition with a position, like opening a set -----
function tlSettle(to, dur) {
  const T = state.trans; if (!T || T.kind !== "tl") return;
  T.anim = { from: T.q, to, t0: performance.now(), dur: reduced ? 1 : dur ?? 180 + 420 * Math.abs(to - T.q) };
  kick();
}
function tlSettled(T) {
  const q = T.anim ? T.anim.to : T.q;
  if (q >= 0.5) { view = "timeline"; state.g = null; tick(6); }
  else { view = "mosaic"; tl.x = tlLayout().home; }
  tl.v = 0; tl.inertia = false; inertia = false; gesture = null; tg = null; // whichever level it lands on starts clean
  setChrome(); kick();
}
function openTimeline() {
  if (state.trans || view !== "mosaic" || !tlReady()) return;
  hideCaption(); tick(8);
  tl.x = tlLayout().home;
  state.trans = { kind: "tl", q: 0, done: tlSettled };
  tlSettle(1, 640);
}
function closeTimeline(instant = false) {
  if (state.trans?.kind === "tl") finishTransition();
  if (view !== "timeline") return;
  if (state.trans) finishTransition();
  if (view !== "timeline") return;
  if (instant || reduced) { view = "mosaic"; tl.x = tlLayout().home; tl.inertia = false; setChrome(); kick(); return; }
  tick(6);
  state.trans = { kind: "tl", q: 1, done: tlSettled };
  tlSettle(0, 560);
}
// Opening a plaque's album from the line, and closing it back there (Back, or a pinch out).
function openTrans(g, q, C) {
  const toTL = g === tl.g && g.done && mode === "set";
  if (toTL && q === 1) placeOnLine(g);
  return { kind: "open", g, q, cam: { ...C }, done: settled, tl: toTL };
}
function settled(T) {
  if (T.q >= 0.5) { view = "set"; state.g = T.g; Object.assign(cam, T.cam); tick(6); T.then?.(); }
  else if (T.tl && T.g.done && mode === "set") { view = "timeline"; state.g = null; tl.g = null; }
  else { view = "mosaic"; state.g = null; tl.g = null; }
  setChrome(); kick();
}
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  document.body.classList.toggle("timeline", view === "timeline");
  backBtn.hidden = view !== "set" && view !== "timeline" && !tbl.on;
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : view === "timeline" ? "Trophies: your collection's story" : "";
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); updateCount();
}
backBtn.onclick = () => { if (tbl.on) closeTable(); else if (view === "timeline") closeTimeline(); else exitToMosaic(); };
document.getElementById("count").addEventListener("click", () => { if (view === "timeline") closeTimeline(); });
// The timeline steps aside for anything that changes the wall under it: a lens, a search, a filter, the list.
for (const [el, ev] of [[lensBox, "click"], [qIn, "input"], [document.getElementById("to-list"), "click"], [filterMenu, "click"], [document.getElementById("w-sets"), "click"]]) el.addEventListener(ev, () => closeTimeline(true), true);

// ----- the pinch from the mosaic: closing fingers shrink the wall; spreading ones still open the panel under them -----
function pinchMove(a, b) {
  const g = gesture, d = dist(a, b), m = mid(a, b), r = d / g.d0, now = evT || performance.now();
  if (g.snap) return;
  if (view === "mosaic") {
    if (!g.tl && !g.out) { if (r < 0.96 && !state.trans && tlReady()) { g.tl = true; g.tqs = []; } else if (r > 1.01) g.out = true; }
    if (g.tl) {
      const q = clamp((1 - r) / 0.5, 0, 1);
      if (!state.trans && q > 0.01) { tl.x = tlLayout().home; state.trans = { kind: "tl", q: 0, done: tlSettled }; }
      const T = state.trans; if (T?.kind === "tl" && !T.anim) { T.q = q; g.tqs.push({ q, t: now }); kick(); }
      return;
    }
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
// Speed first, position second: a quick pinch opens the timeline whatever the distance; a slow one needs to be well in.
function snapQ(qs, T, mid) {
  const last = qs[qs.length - 1];
  let first = qs.find((s) => last && last.t - s.t < 160);
  if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
  const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
  if (Math.abs(v) > 0.0011) return v > 0 ? 1 : 0;
  return T.q > mid ? 1 : 0;
}
function releasePinch() {
  const g = gesture, T = state.trans;
  if (g.snap) return;
  if (T?.kind === "tl" && !T.anim) { tlSettle(snapQ(g.tqs || [], T, 0.4)); return; }
  if (T?.kind === "open" && !T.anim) { settle(snapQ(g.qs, T, view === "mosaic" ? 0.35 : 0.65)); }
  else if (view === "set" && state.g && cam.s < fitCam(state.g).s) flyTo(fitCam(state.g), 260);
  else if (view === "set" && state.g && !g.noClose && g.r > 1.15 && g.m && cam.s > fitCam(state.g).s * 1.8) {
    const h = hit(g.m.x, g.m.y);
    let c = h?.card || null;
    if (!c) { let bd = Infinity; for (const x of state.g.cards) { const r = binderRect(x, cam), d = Math.hypot(r.x + r.w / 2 - g.m.x, r.y + r.h / 2 - g.m.y); if (d < bd) { bd = d; c = x; } } }
    if (c) focus(c);
  }
}
// A tap on the wall, as before, plus the Trophies label as a way into the story.
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch);
    if (h?.block && lifted && !h.block.done) {
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") {
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m));
    }
    if (h?.block) enterGroup(h.block);
    else if (newPanelAt(sx, sy)) { tick(4); openSheet(); }
    else if (caseLabelAt(sx, sy) && tlReady()) openTimeline();
    return;
  }
  if (!h?.card) {
    if (h?.block && !marking && !fly && !shuffle) { const p = headAt(h.block, sx, sy); if (p) { tick(4); if (p.seg) setScope(h.block.set, p.seg); else if (p.btn) { if (p.btn.shelf) toggleShelf(h.block); else if (p.btn.pop) chasePopular(h.block.set); else if (p.btn.remove) removeSet(h.block.set); else removeChase(h.block.chase); } else focus(p.c); } }
    return;
  }
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}

// ----- on the timeline: drag sideways, flick, tap a plaque, spread to go back -----
let tg = null, tlMouse = false;
function tlDown(pts) {
  hideCaption(); fly = null; inertia = false; tl.inertia = false; cancelPress();
  if (document.activeElement === qIn) qIn.blur();
  if (pts.length >= 2) return tlTwo(pts);
  if (tg) return;
  const p = pts[0], now = performance.now();
  tg = { kind: "one", x: p.x, y: p.y, x0: tl.x, t: now, moved: false, s: [{ x: p.x, t: now }] };
  const h = tlHit(p.x, p.y);
  if (h?.g) { state.press = { g: h.g, t0: now, timer: 0 }; kick(); }
}
function tlTwo(pts) { cancelPress(); tg = { kind: "two", d0: dist(pts[0], pts[1]), qs: [] }; }
function tlMove(pts) {
  if (!tg) { if (pts.length) tlDown(pts); return; }
  if (tg.kind === "one" && pts.length >= 2) return tlTwo(pts);
  if (tg.kind === "two") {
    if (pts.length < 2) return;
    const r = dist(pts[0], pts[1]) / tg.d0, now = evT || performance.now(), q = 1 - clamp((r - 1) / 1.1, 0, 1);
    if (!state.trans && q < 0.99) state.trans = { kind: "tl", q: 1, done: tlSettled };
    const T = state.trans; if (T?.kind === "tl" && !T.anim) { T.q = q; tg.qs.push({ q, t: now }); kick(); }
    return;
  }
  if (tg.kind !== "one") return;
  const p = pts[0]; if (!p) return;
  const dx = p.x - tg.x, dy = p.y - tg.y, now = performance.now();
  tg.s.push({ x: p.x, t: now }); if (tg.s.length > 8) tg.s.shift();
  if (!tg.moved && Math.hypot(dx, dy) < 8) return;
  if (!tg.moved) { tg.moved = true; cancelPress(); }
  const L = tlLayout();
  tl.x = clamp(tg.x0 - dx, L.min, L.max); kick();
}
function tlUp(remaining, end, cancelled = false) {
  const g = tg; if (!g) return;
  cancelPress();
  if (g.kind === "two") {
    if (remaining.length >= 2) return;
    const T = state.trans; if (T?.kind === "tl" && !T.anim) tlSettle(snapQ(g.qs, T, 0.6));
    tg = remaining.length === 1 ? { kind: "rest" } : null;
    return;
  }
  if (g.kind === "rest") { if (!remaining.length) tg = null; return; }
  if (remaining.length) return;
  tg = null;
  if (cancelled) return;
  const p = end || { x: g.s[g.s.length - 1].x, y: g.y };
  if (!g.moved) return tlTap(p.x, p.y);
  const s0 = g.s.find((s) => performance.now() - s.t < 90) || g.s[0];
  if (s0 && !reduced) { const t = Math.max(1, performance.now() - s0.t), v = (p.x - s0.x) / t; if (Math.abs(v) > 0.2) { tl.v = v; tl.inertia = true; kick(); } }
}
function tlTap(sx, sy) {
  if (state.trans) return;
  const h = tlHit(sx, sy);
  if (h?.g) { tl.g = h.g; placeOnLine(h.g); enterGroup(h.g); return; }
  if (h?.thumb) return closeTimeline();
  if (h?.m) { tick(3); toast(`${h.m.text}, ${whenOf(h.m.at)}.`); }
}
function tlStep(dt) {
  if (!tl.inertia || state.trans) return false;
  const L = tlLayout();
  tl.x = clamp(tl.x - tl.v * dt, L.min, L.max);
  tl.v *= Math.pow(0.95, dt / 16);
  if (Math.abs(tl.v) < 0.02 || tl.x <= L.min || tl.x >= L.max) tl.inertia = false;
  return true;
}
// The timeline's touches come first (the wall's handlers never see them); a touch during the settle finishes it and
// goes to whichever level that leaves.
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (e.target !== canvas || tbl.on) return;
  if (type === "touchstart") {
    if (state.trans?.kind === "tl" && state.trans.anim) finishTransition();
    if (view !== "timeline") return;
    if (state.trans?.kind === "open" && state.trans.anim) { finishTransition(); if (view !== "timeline") return; }
  } else if (view !== "timeline") return;
  e.stopImmediatePropagation(); e.preventDefault(); evT = e.timeStamp;
  const pts = touchPts(e.touches);
  if (type === "touchstart") tlDown(pts);
  else if (type === "touchmove") tlMove(pts);
  else tlUp(pts, touchPts(e.changedTouches)[0], type === "touchcancel");
}, { capture: true, passive: false });
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || e.target !== canvas || tbl.on) return; if (state.trans?.kind === "tl" && state.trans.anim) finishTransition(); if (view !== "timeline") return; e.stopImmediatePropagation(); tlMouse = true; tlDown([{ x: e.clientX, y: e.clientY }]); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !tlMouse) return; e.stopImmediatePropagation(); tlMove([{ x: e.clientX, y: e.clientY }]); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !tlMouse) return; tlMouse = false; e.stopImmediatePropagation(); tlUp([], { x: e.clientX, y: e.clientY }, type === "pointercancel"); }, true);
// A trackpad: pinch on the wall opens the story, spread on the story goes back, scrolling moves along the line.
document.addEventListener("wheel", (e) => {
  if (e.target !== canvas || tbl.on) return;
  if (view === "mosaic") { if (e.ctrlKey && e.deltaY > 2 && !state.trans && tlReady()) { e.preventDefault(); e.stopImmediatePropagation(); openTimeline(); } return; }
  if (view !== "timeline") return;
  e.preventDefault(); e.stopImmediatePropagation(); hideCaption();
  if (state.trans) finishTransition();
  if (view !== "timeline") return;
  if (e.ctrlKey || e.metaKey) { if (e.deltaY < -2) closeTimeline(); return; }
  const L = tlLayout(); tl.x = clamp(tl.x + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY), L.min, L.max); kick();
}, { capture: true, passive: false });
document.addEventListener("keydown", (e) => {
  if (view !== "timeline" || e.target !== canvas) return;
  const k = e.key;
  if (k === "Escape" || k === "Backspace") { e.preventDefault(); e.stopImmediatePropagation(); closeTimeline(); }
  else if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); const L = tlLayout(); tl.x = clamp(tl.x + (k === "ArrowRight" ? 160 : -160), L.min, L.max); kick(); }
  else if (k === "ArrowUp" || k === "ArrowDown" || k === "Enter" || k === "+" || k === "=" || k === "-") { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

// ----- the frame: as before, with the timeline as a level and its transition -----
function frame(now) {
  raf = 0; frameFoil = false;
  if (tbl.on && tbl.q >= 1 && !tbl.anim) { drawTable(now); return; }
  const dt = Math.min(48, now - (lastFrame || now)); lastFrame = now;
  let more = stepFly(now);
  if (stepInertia(dt)) more = true;
  if (tlStep(dt)) more = true;
  if (view === "set" && !state.trans && !fly) clampCam(state.g);
  for (const c of drawnCards) { const t = emphasis(c); if (Math.abs(c.e - t) > 0.005) { c.e += (t - c.e) * Math.min(1, dt / 90); more = true; } else c.e = t; }
  const dimT = state.focus ? 1 : 0;
  if (Math.abs(state.dimAll - dimT) > 0.01) { state.dimAll += (dimT - state.dimAll) * Math.min(1, dt / 110); more = true; } else state.dimAll = dimT;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  const T = state.trans;
  if (T) {
    let p = T.kind === "open" || T.kind === "tl" ? 0 : clamp((now - T.t0) / T.dur, 0, 1), e = ease(p);
    if (T.kind === "open") {
      if (T.anim) { const a = clamp((now - T.anim.t0) / T.anim.dur, 0, 1); T.q = T.anim.from + (T.anim.to - T.anim.from) * (1 - Math.pow(1 - a, 3)); p = a; } else p = 0;
      const q = T.q;
      if (T.tl && T.g.done) drawTL(now, 1, 1 - q, T.g); else drawMosaic(now, 1 - q, T.g); // the album grows out of the line, or out of the wall
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
    } else if (T.kind === "tl") {
      // The wall shrinking to its thumbnail on the timeline, held under the fingers or settling either way.
      if (T.anim) { const a = clamp((now - T.anim.t0) / T.anim.dur, 0, 1); T.q = T.anim.from + (T.anim.to - T.anim.from) * (1 - Math.pow(1 - a, 3)); p = a; } else p = 0;
      drawTL(now, T.q);
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
    if (p >= 1 && (T.kind === "slide" || T.kind === "morph" || T.anim)) { const done = T.done; state.trans = null; done?.(T); }
    more = true;
  } else if (view === "mosaic") {
    drawMosaic(now);
    for (const g of groups) if (g.ripple && now - g.ripple.t0 < 1600) more = true;
  } else if (view === "timeline") {
    drawTL(now, 1);
    for (const g of groups) if (g.gleam) more = true;
  } else if (state.g) {
    drawSet(state.g, now);
    if (state.g.burst || (state.g.ripple && now - state.g.ripple.t0 < 1600)) more = true;
    for (const c of state.g.cards) if (c.anim) { more = true; break; }
  }
  if (state.matches && view === "mosaic" && !T) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink;
    for (const c of state.matches) { ctx.beginPath(); ctx.arc(c.m.x + c.m.w / 2, c.m.y - mScroll + c.m.h / 2, Math.max(6, c.m.h * 0.7), 0, Math.PI * 2); ctx.stroke(); }
  }
  if (state.focus) { const c = state.focus, r = binderRect(c, cam); ctx.globalAlpha = 1; drawTile(c, r.x, r.y, r.w, r.h, now); if (c.anim) more = true; if (c.owned && c.tier >= 3 && !reduced) more = true; }
  ctx.globalAlpha = 1;
  for (const c of drawnCards) if (c.anim) { more = true; break; }
  drawMarks(); drawPicks();
  if (view !== "timeline" && drawLive(now)) more = true; // the line to Chase starts from a tile, which the thumbnail doesn't have
  if (drawPop(now)) more = true;
  drawTraders(now);
  if (drawFlights(now)) more = true;
  if (tbl.on) drawTable(now);
  if (frameFoil) more = true;
  if (state.press) more = true;
  if (state.introT0 && now - state.introT0 < 3000 && !reduced) more = true;
  if (more) kick();
}
// Debug builds only: the tests' hook sees the timeline.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { tl: { get: () => tl }, openTimeline: { value: openTimeline }, closeTimeline: { value: closeTimeline }, tlLayout: { value: tlLayout }, milestones: { value: milestones } }); }, 0);
