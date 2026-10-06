// ---------- the last card is a moment ----------
// Before the last card, every panel knows its next one: in the Chase and Need lenses the panel's stat names the
// cheapest card you still need ("Next: Pidgeot $19", "Last: Pidgeot $19" when one is left), and the binder header
// carries the same line in gold; a tap on it brings that card up close. When the last card of a group lands (a set in
// the view it's in, so a master set completes on its own, or a chase), the binder goes quiet for a beat: the other
// cards dim, the card you just marked lifts to the centre of the screen and grows, "Complete" stamps itself across
// the header in gold (a stamp that scales down into place), the progress bar fills gold with the shimmer, and the
// card settles back into its pocket. From the mosaic or the list the panel does the small version: its frame flashes
// gold and the stamp lands on it. After that the finished panel wears a gold frame and the stat "Complete", and its
// header offers "Keep on the wall" (the default) and "Put it away", which folds the panel to a gold line at the bottom
// of the wall and lists it under Finished in Settings with "Back on the wall". Finish dates and put-away state live in
// localStorage wall-done, per group. Reduced motion: the stamp and the lift simply appear.

// ----- what's finished, kept on this device -----
let finished = {};
try { finished = JSON.parse(localStorage.getItem("wall-done") || "{}") || {}; } catch { finished = {}; }
const persistDone = () => { try { localStorage.setItem("wall-done", JSON.stringify(finished)); } catch { /* private mode */ } };
// A set finishes in the view it's in: the set, its master set and its grand set each complete on their own.
const doneKey = (g) => (g.set ? (scopeOf(g.set) === "set" ? g.set.id : `${g.set.id}:${scopeOf(g.set)}`) : g.key);
const finGroups = () => (mode === "set" ? groups.filter((g) => g.set || g.chase) : [...(setGroups || []), ...chaseGroups.values()]);
const isAway = (g) => Boolean(g.fin?.complete && finished[doneKey(g)]?.away);
const finDate = (at) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
// Finished, as far as the Time filter is concerned (scrubbed back before the last card, a set isn't finished yet).
const finShown = (g, owned, n) => Boolean(g.fin?.complete) && !(state.time && owned < n);
let lastCard = null; // the moment in a binder: { g, c, t0, stamped }
const panelFlashes = []; // the small version on the mosaic: { g, t0, stamped }

// What a group knows about its finish: whether it's complete, the cheapest card still missing, how many are left.
// Computed when a card changes or the wall is laid out, never per frame.
function finOf(list) {
  let next = null, left = 0;
  for (const c of list) if (!c.owned) { left++; if (!next || c.price < next.price) next = c; }
  return { complete: left === 0 && list.length > 0, next, left };
}
const nextText = (f) => (f.next ? `${f.left === 1 ? "Last" : "Next"}: ${f.next.name} ${short(f.next.price)}` : "");
function listSuffix(g, base) {
  const f = g.fin; if (!f) return "";
  const sep = base.endsWith(".") ? " " : ". ";
  if (f.complete) return `${sep}Complete, finished ${finDate(finished[doneKey(g)]?.at || Date.now())}.`;
  return f.next ? `${sep}${nextText(f)}.` : "";
}
function refreshFinish() {
  const now = Date.now();
  let changed = false;
  for (const g of finGroups()) {
    g.fin = finOf(g.base || g.cards);
    const key = doneKey(g);
    if (g.fin.complete) { if (!finished[key]) { finished[key] = { at: now, away: false }; changed = true; } }
    else if (finished[key]) { delete finished[key]; changed = true; }
    // The list view reads the group's sub line: add the finish or the next card to it there (a chase's sub is
    // reassigned on every arrange, so the wrap is checked each time).
    if (g.sub !== g.subW) { g.sub0 = g.sub; g.subW = g.sub = () => { const b = g.sub0(); return b + (document.body.classList.contains("listmode") ? listSuffix(g, b) : ""); }; }
  }
  if (changed) persistDone();
}
// The buttons a finished group's header offers, where Chase these and Remove sat.
function finButtons(g) {
  const W = vw - 24;
  if (g.set) { g.hdrBtn = { x: W - 112, y: 4, w: 112, h: 22, keep: true }; g.hdrBtn2 = { x: W - 86, y: (g.popTop || 0) + 2, w: 86, h: 22, away: true }; }
  else { g.hdrBtn = { x: W - 112 - 6 - 86, y: 2, w: 112, h: 22, keep: true }; g.hdrBtn2 = { x: W - 86, y: 2, w: 86, h: 22, away: true }; }
}
function layoutAll() {
  refreshFinish();
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) orderGroup(g);
  groups.forEach(binderLayout);
  for (const g of groups) if ((g.set || g.chase) && g.fin?.complete) finButtons(g);
  if (lifted) { newPanel = null; liftedLayout(); } else mosaicLayout();
}
function updateCount() {
  refreshFinish();
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
}

// ----- the mosaic: finished panels you put away fold to gold lines at the bottom of the wall -----
function mosaicLayout() {
  const newH = mode === "set" && !picking() ? NEW_H : 0;
  newPanel = null;
  const away = mode === "set" && !picking() ? groups.filter(isAway) : [];
  const shown = groups.filter((g) => !away.includes(g));
  const fitH = vh - topPad() - botPad() - newH - away.length * W_FOLD;
  if (mode === "set" && pickedSets.size && pickedSets.size < sets.length) {
    const mine = shown.filter((g) => g.chase || pickedSets.has(g.set.id)), rest = shown.filter((g) => g.set && !pickedSets.has(g.set.id));
    const n = mine.reduce((a, g) => a + g.cards.length, 0);
    const R = { x: 8, y: topPad(), w: vw - 16, h: Math.max(fitH - rest.length * W_FOLD, fitH * 0.62, (n * 340) / (vw - 16)) };
    const items = mine.map((g) => ({ g, v: Math.max(g.cards.length, 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    if (items.length) stripTreemap(items, R);
    let y = R.y + R.h;
    for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
    if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
    for (const g of away) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
    mMax = Math.max(0, y + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    for (const g of mine) packPanel(g);
    for (const g of [...rest, ...away]) packFolded(g);
    return;
  }
  const R = { x: 8, y: topPad(), w: vw - 16, h: Math.max(fitH, (drawnCards.length * 340) / (vw - 16)) };
  let y = R.y + R.h;
  if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
  for (const g of away) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  const items = shown.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  if (items.length) stripTreemap(items, R);
  for (const g of shown) packPanel(g);
  for (const g of away) packFolded(g);
}
// Every panel flies to its new place (the picked-sets fold), without losing your scroll. Inside a binder the mosaic
// just takes its new shape underneath.
function foldAway() {
  const still = view !== "mosaic" || state.trans || tbl.on || document.body.classList.contains("listmode");
  if (still) { layoutAll(); kick(); return; }
  for (const c of drawnCards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  for (const c of drawnCards) c.delay = reduced ? 0 : Math.min(360, c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: performance.now(), dur: reduced ? 1 : 1100, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
function putAway(g) {
  const key = doneKey(g); if (!finished[key] || finished[key].away) return;
  finished[key].away = true; persistDone(); tick(6);
  const go = () => {
    foldAway(); renderDone();
    toast(`${g.name} put away. It's under Finished in Settings.`, () => { if (finished[key]) { finished[key].away = false; persistDone(); foldAway(); renderDone(); } });
  };
  leaveBinderThen(g, go);
}
function keepOnWall(g) {
  const key = doneKey(g); if (!finished[key]) return;
  if (!finished[key].away) { toast(`${g.name} stays on the wall.`); return; }
  finished[key].away = false; persistDone(); tick(6);
  foldAway(); renderDone(); toast(`${g.name} is back on the wall.`);
}

// ----- marking: the last card of a group is a moment -----
// Which groups are complete right now, before a card changes, so the one that just finished can be told apart.
function finSnapshot() {
  const m = new Map();
  for (const g of finGroups()) m.set(g, Boolean(g.fin?.complete));
  return m;
}
function finishHits(c, before) {
  const b = c.base || c, st = sets[b.si], hits = [];
  refreshFinish();
  for (const g of finGroups()) {
    if (!g.fin.complete || before.get(g)) continue;
    const inG = g.set ? g.set === st : g.base.some((x) => (x.base || x) === b);
    if (!inG) continue;
    hits.push({ g, c: g.base.find((x) => x === b || x.base === b) || b });
  }
  return hits;
}
function finish(hits, undo) {
  const now = performance.now(), names = hits.map((h) => h.g.name);
  for (const { g, c } of hits) {
    finished[doneKey(g)] = { at: Date.now(), away: false };
    if (view === "set" && state.g === g && !lastCard) startLastCard(g, c, now);
    else if (view === "mosaic" && mode === "set" && !panelFlashes.some((f) => f.g === g)) panelFlashes.push({ g, t0: now, stamped: false });
  }
  persistDone(); tick(40);
  const n = hits[0].g.base.length, say = () => toast(hits.length === 1 ? `${names[0]} complete. ${n} of ${n}.` : `${names.join(" and ")} complete.`, undo);
  if (lastCard && !reduced) setTimeout(say, 1900); else say(); // in the binder the moment plays out first, then the toast with Undo
  layoutAll(); renderDone(); kick();
}
// The binder goes quiet: back to the framed set first (the stamp lands on the header), then the lift.
function startLastCard(g, c, now) {
  if (state.focus) unfocus();
  const f = fitCam(g), far = Math.abs(cam.s - f.s) > 0.02 || Math.abs(cam.y - f.y) > 2;
  if (far) { fly = null; inertia = false; flyTo(f, 460); }
  if (reduced) c.anim = null; // the card simply appears, whole
  lastCard = { g, c, t0: now + (far && !reduced ? 180 : 0), stamped: false };
  pumpUntil(now + 2800);
}
const phaseK = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
// Where the moment is: how far the card has lifted (up and back), how dim the rest is, how far the stamp has landed,
// and how much of the last bar segment has filled.
function momentK(M, now) {
  const t = now - M.t0;
  if (reduced) { const on = t >= 0 && t < 1300 ? 1 : 0; return { lift: on, dim: on, stamp: t >= 0 ? 1 : 0, bar: t >= 0 ? 1 : 0, done: t >= 1300 }; }
  const up = ease(phaseK(t, 0, 520)), back = ease(phaseK(t, 1700, 2200));
  return { lift: up - back, dim: up - back, stamp: easeOut(phaseK(t, 420, 760)), bar: ease(phaseK(t, 420, 760)), done: t >= 2200 };
}
function flashK(F, now) {
  const t = now - F.t0;
  if (reduced) return { pulse: 0, stamp: t >= 0 && t < 1400 ? 1 : 0, bar: 1, done: t >= 1400 };
  return { pulse: t < 1400 ? Math.abs(Math.sin((t / 700) * Math.PI)) : 0, stamp: easeOut(phaseK(t, 120, 460)) * (1 - phaseK(t, 1600, 1900)), bar: ease(phaseK(t, 120, 460)), done: t >= 1900 };
}
const flashOf = (g) => panelFlashes.find((f) => f.g === g) || null;
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now(), b = c.base || c, before = finSnapshot(), wasAway = finGroups().filter(isAway);
  b.owned = on; b.got = on ? Date.now() : null; saved[b.id] = { on, at: b.got }; persist();
  for (const t of [b, ...twinsOf(b)]) { t.anim = { t0: now, to: on }; const tg = groups[t.g]; if (tg && (t === c || tg.base?.includes(t) || tg.cards.includes(t))) tg.ripple = { t0: now, col: t.col, row: t.row }; }
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  const hits = on ? finishHits(c, before) : [];
  if (hits.length) finish(hits, undo);
  else {
    if (!on) { refreshFinish(); if ([...before.keys()].some((g) => before.get(g) && !g.fin?.complete)) { lastCard = null; if (wasAway.some((g) => !g.fin?.complete)) foldAway(); else layoutAll(); renderDone(); } } // a finished group isn't any more: its buttons go, and a put-away one comes back
    if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  }
  if (state.focus === c) fillPanel(c, 0);
  if (lifted && !quietLayout) liftLayout(true);
  updateCount(); drawList(); kick();
}
function markAllInSet() {
  const g = state.g; if (!g || !marking) return;
  const todo = g.cards.filter((c) => !c.owned); if (!todo.length) { toast("You have all of them already."); return; }
  const now = performance.now(), before = finSnapshot();
  todo.forEach((c, i) => { const b = c.base || c; if (!session.has(c)) session.set(c, c.owned); b.owned = true; b.got = Date.now(); saved[b.id] = { on: true, at: b.got }; if (!reduced) for (const t of [b, ...twinsOf(b)]) t.anim = { t0: now + i * 5, to: true }; });
  persist(); updateBar(); updateCount(); drawList(); tick(14);
  if (lifted) liftLayout(true);
  const hits = finishHits(todo[todo.length - 1], before);
  if (hits.length) finish(hits, null); else if (view === "set") g.burst = now;
  kick();
}

// ----- the panel: Next, Complete, the gold frame, the flash -----
function panelStat(g) {
  if (picking()) return "  "; // the tick's place
  const n = g.cards.length, owned = ownedNow(g.cards), f = g.fin;
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(rootOf(c))).length; return m ? `${m} found` : ""; }
  // "Next: Pidgeot $19", or on a narrow panel "Pidgeot $19", or "Next $19": the set's name keeps its room.
  const fit = (word, name, price) => { const max = Math.max(60, (g.m?.w || 240) * 0.46); for (const t of [`${word}: ${name} ${price}`, `${name} ${price}`]) if (textW(t) <= max) return t; return fitText(`${word} ${price}`, max); };
  if (finShown(g, owned, n)) return "Complete";
  if (state.lens === "need") return f?.next ? fit(f.left === 1 ? "Last" : "Next", f.next.name, short(f.next.price)) : `${n - owned} to go`;
  if (state.lens === "chase") {
    const lead = g.lead || [];
    if (!lead.length) return "Nothing to chase";
    let best = lead[0]; for (const c of lead) if ((c.deal ?? c.price) < (best.deal ?? best.price)) best = c;
    return fit(lead.length === 1 ? "Last" : "Next", best.name, short(best.deal ?? best.price));
  }
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m);
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    const k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)), a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  const owned = ownedNow(g.cards), n = g.cards.length, fin = finShown(g, owned, n), F = fin ? flashOf(g) : null, FK = F ? flashK(F, now) : null;
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (fin) { // a finished panel wears a gold frame; when it has just finished, the frame flashes
    if (FK && FK.pulse > 0.01) { ctx.lineWidth = 8; ctx.strokeStyle = theme.gold; ctx.globalAlpha = alpha * 0.22 * FK.pulse; ctx.stroke(); }
    ctx.lineWidth = 1.5 + (FK ? 2 * FK.pulse : 0); ctx.strokeStyle = theme.gold; ctx.globalAlpha = alpha * 0.9; ctx.stroke(); ctx.globalAlpha = alpha;
  }
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
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
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? beat.col : fin ? theme.gold : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, x + w, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha;
  }
  let frac = owned / n;
  if (FK) frac = Math.min(frac, (n - 1) / n + FK.bar / n); // the last segment fills as the stamp lands
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? theme.gold : g.ink; ctx.fillRect(x, m.y + PG + 30, w * frac, 2);
  ctx.globalAlpha = 1;
}

// ----- the binder header: the next card in gold, the stamp, the two buttons -----
// The stamp: "Complete" in gold, a hair off square, like ink on the page. s scales it (it lands from large), a fades it.
function drawStamp(cx, cy, k, s, a) {
  if (a <= 0.01 || s <= 0.01) return;
  font(800, 15 * k); const tw = textW("Complete"), w = tw + 22 * k, h = 26 * k;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.1); ctx.scale(s, s);
  rr(-w / 2, -h / 2, w, h, 5 * k);
  ctx.globalAlpha = a * 0.16; ctx.fillStyle = theme.gold; ctx.fill();
  ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.2, 2 * k); ctx.strokeStyle = theme.gold; ctx.stroke();
  ctx.fillStyle = theme.gold; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Complete", 0, k);
  ctx.restore();
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
const stampW = (k) => { font(800, 15 * k); return textW("Complete") + 22 * k; };
function drawHeader(st, now, C = cam, ox = 0, alpha = 1) {
  const sx = (st.x - C.x) * C.s + ox, sy = (st.y - C.y) * C.s, sw = st.w * C.s;
  const k = (st.head * C.s) / (132 + (st.popH || 0)), hh = 132 * k; // 1 at the framed zoom; the title block is 132 of the header
  const owned = ownedNow(st.cards), n = st.cards.length;
  const fin = finShown(st, owned, n), M = lastCard && lastCard.g === st ? lastCard : null, MK = M ? momentK(M, now) : null;
  const a0 = alpha * (state.focus ? 1 - state.dimAll * 0.7 : 1);
  ctx.globalAlpha = a0;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = clamp(34 * k, 16, 64), sub = clamp(14 * k, 10, 24);
  const stw = fin ? stampW(k) : 0;
  ctx.fillStyle = theme.ink; font(800, title, true);
  ctx.fillText(fitText(st.name, sw - (fin ? stw + 10 * k : 0)), sx, sy + hh * 0.5);
  const pct = `${Math.floor((owned / n) * 100)}%`;
  font(700, sub); const pw = textW(pct);
  ctx.textAlign = "right"; ctx.fillStyle = fin ? theme.gold : theme.ink; ctx.fillText(pct, sx + sw, sy + hh * 0.72);
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(500, sub);
  const line = state.time ? `${owned} of ${n} by ${monthOf(state.t)}` : (st.sub0 || st.sub)();
  const room = sw - pw - 12, ly = sy + hh * 0.72;
  // The next card you need, in gold after the count; finished, the date instead. A tap on the card's name brings it up.
  const f = st.fin, extra = state.time || !f ? "" : fin ? `Finished ${finDate(finished[doneKey(st)]?.at || Date.now())}` : nextText(f);
  st.nextHit = null;
  if (extra) {
    const t1 = fitText(line, room * 0.5), w1 = textW(t1), gap = 10 * k;
    ctx.fillText(t1, sx, ly);
    font(600, sub); const t2 = fitText(extra, room - w1 - gap), w2 = textW(t2);
    ctx.fillStyle = theme.gold; ctx.fillText(t2, sx + w1 + gap, ly);
    if (!fin && f.next) st.nextHit = { c: f.next, x0: (w1 + gap) / k, x1: (w1 + gap + w2) / k };
  } else ctx.fillText(fitText(line, room), sx, ly);
  const by = sy + hh * 0.82, bh = Math.max(1.5, 3 * k);
  let frac = owned / n;
  if (MK) frac = Math.min(frac, (n - 1) / n + MK.bar / n);
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(sx, by, sw, bh);
  ctx.fillStyle = owned === n ? theme.gold : st.ink; ctx.fillRect(sx, by, sw * frac, bh);
  if (st.popChips) drawPopRow(st, sx, sy + hh, k, ctx.globalAlpha);
  else if (st.chase && k >= 0.3) { for (const b of [st.hdrBtn, st.hdrBtn2]) if (b) drawHdrBtn(st, b, sx, sy + hh + b.y * k, k, ctx.globalAlpha); ctx.textBaseline = "alphabetic"; }
  if (fin) { // the stamp, landing from large while the moment plays, then at rest on the title line
    const s = MK ? MK.stamp : 1;
    if (MK && s >= 1 && !M.stamped) { M.stamped = true; st.burst = now; tick(40); }
    drawStamp(sx + sw - stw / 2, sy + hh * 0.5 - title * 0.33, k, MK ? 1 + 1.4 * (1 - s) : 1, a0 * s);
  }
  if (st.burst) {
    const p = (now - st.burst) / 1400;
    if (p < 1) {
      const fx = sx - sw + p * sw * 3;
      const g = ctx.createLinearGradient(fx, sy, fx + sw * 0.6, sy + st.h * C.s);
      g.addColorStop(0, "rgb(255 255 255 / 0)"); g.addColorStop(0.5, "rgb(255 220 140 / .4)"); g.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.globalAlpha = a0; ctx.globalCompositeOperation = theme.dark ? "screen" : "multiply"; ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, st.h * C.s); ctx.globalCompositeOperation = "source-over";
    } else st.burst = 0;
  }
  ctx.globalAlpha = 1;
}
function drawHdrBtn(g, b, sx, by, k, alpha) {
  const sel = b.keep ? !isAway(g) : b.away ? isAway(g) : false;
  const on = (b.pop && Boolean(popularRule(g.set))) || sel, bx = sx + b.x * k, bw = b.w * k, bh = b.h * k;
  rr(bx, by, bw, bh, 6 * k);
  if (on) { ctx.fillStyle = theme.gold; ctx.globalAlpha = alpha * 0.18; ctx.fill(); ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  else if (b.pop) { ctx.fillStyle = theme.ink; ctx.fill(); }
  else { ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  ctx.fillStyle = on || !b.pop ? theme.ink : theme.bg; font(700, 11 * k); ctx.textAlign = "center";
  const label = b.keep ? "Keep on the wall" : b.away ? "Put it away" : b.pop ? (on ? "Chasing these ✓" : "Chase these") : b.remove ? "Remove set" : "Remove chase";
  ctx.fillText(label, bx + bw / 2, by + bh * 0.68);
  ctx.textAlign = "left";
}
function headAt(g, sx, sy) {
  const p = toWorld(sx, sy), k = (vw - 24) / g.w, fx = (p.x - g.x) * k, fy = (p.y - g.y) * k;
  const nh = g.nextHit;
  if (nh && fx >= nh.x0 - 6 && fx <= nh.x1 + 6 && fy >= 76 && fy <= 108) return { c: nh.c };
  for (const b of [g.hdrBtn, g.hdrBtn2]) if (b) { const by = 132 + b.y; if (fx >= b.x - 6 && fx <= b.x + b.w + 6 && fy >= by - 4 && fy <= by + b.h + 4) return { btn: b }; }
  if (!g.popChips) return null;
  const py = fy - 132; if (py < 0 || py > g.popH) return null;
  if (g.seg) for (const s of g.seg) if (fx >= s.x && fx <= s.x + s.w && py >= s.y - 3 && py <= s.y + s.h + 3) return { seg: s.key };
  for (const ch of g.popChips) if (fx >= ch.x && fx <= ch.x + ch.w && py >= ch.y - 3 && py <= ch.y + ch.h + 3) return { c: ch.c };
  return null;
}
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch);
    if (h?.block && lifted) {
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
    return;
  }
  if (!h?.card) {
    if (h?.block && !marking && !fly && !shuffle) {
      const p = headAt(h.block, sx, sy);
      if (p) {
        tick(4);
        if (p.seg) setScope(h.block.set, p.seg);
        else if (p.btn) { if (p.btn.keep) keepOnWall(h.block); else if (p.btn.away) putAway(h.block); else if (p.btn.pop) chasePopular(h.block.set); else if (p.btn.remove) removeSet(h.block.set); else removeChase(h.block.chase); }
        else focus(p.c);
      }
    }
    return;
  }
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}

// ----- the binder while the moment plays: the rest dims, the card leaves its pocket -----
function drawSet(g, now, C = cam, ox = 0, alpha = 1) {
  drawHeader(g, now, C, ox, alpha);
  const M = lastCard && lastCard.g === g ? lastCard : null, MK = M ? momentK(M, now) : null;
  const ta = MK ? alpha * (1 - 0.62 * MK.dim) : alpha, skip = MK && MK.lift > 0.001 ? M.c : null;
  if (shuffle && shuffle.g === g) {
    for (const c of g.cards) {
      if (c === state.focus || c === skip) continue;
      const k = ease(clamp((now - shuffle.t0 - c.delay) / shuffle.dur, 0, 1));
      const x = c.px + (c.x - c.px) * k, y = c.py + (c.y - c.py) * k;
      const r = { x: (x - C.x) * C.s + ox, y: (y - C.y) * C.s, w: TW * c.sz * C.s, h: TH * c.sz * C.s };
      if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
      drawTile(c, r.x, r.y, r.w, r.h, now, ta);
    }
    return;
  }
  const y0 = C.y, y1 = C.y + vh / C.s;
  const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
  for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
    const c = g.cards[k];
    if (c === state.focus || c === skip) continue;
    const r = binderRect(c, C, ox);
    if (r.x > vw || r.x + r.w < 0) continue;
    drawTile(c, r.x, r.y, r.w, r.h, now, ta);
  }
}
// Drawn over the wall each frame, after the trade chips: the lifted card, and the stamp landing on a panel.
function drawTraders(now) {
  if (strip && view === "mosaic" && state.lens === "trade") {
    const T = state.trans;
    let alpha = 1;
    if (T?.kind === "morph") alpha = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1));
    else if (T?.kind === "open") alpha = 1 - T.q;
    else if (T) alpha = 0;
    if (tbl.on) alpha *= 1 - tbl.q;
    if (alpha > 0.01) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); for (const ch of strip.chips) drawChip(ch, now, alpha); }
  }
  drawLastCard(now);
}
function drawLastCard(now) {
  let more = false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  // the small version: the stamp lands on the panel (its frame flashes in drawPanel)
  if (panelFlashes.length) {
    for (const F of [...panelFlashes]) {
      const K = flashK(F, now);
      if (K.done || !F.g.fin?.complete) { panelFlashes.splice(panelFlashes.indexOf(F), 1); continue; }
      more = true;
      if (view !== "mosaic" || !F.g.m || tbl.on) continue;
      const T = state.trans;
      let m = mr(F.g.m), a = 1;
      if (T?.kind === "morph" && F.g.pm) { const k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)), p = mr(F.g.pm); m = { x: p.x + (m.x - p.x) * k, y: p.y + (m.y - p.y) * k, w: p.w + (m.w - p.w) * k, h: p.h + (m.h - p.h) * k }; }
      else if (T?.kind === "open") a = 1 - T.q; else if (T) a = 0;
      if (m.y > vh || m.y + m.h < 0 || a <= 0.01) continue;
      if (K.stamp >= 1 && !F.stamped) { F.stamped = true; tick(20); }
      const k = clamp(m.w / 300, 0.8, 1.3);
      drawStamp(m.x + m.w / 2, m.y + m.h / 2, k, 1 + 1.2 * (1 - Math.min(1, K.stamp * 1.0001)), a * K.stamp);
    }
  }
  // the moment in the binder: the card lifts to the centre and grows, then settles back into its pocket
  const M = lastCard;
  if (M) {
    const K = momentK(M, now);
    if (K.done || view !== "set" || state.g !== M.g || (state.trans && state.trans.kind !== "open") || !M.g.fin?.complete) lastCard = null;
    else {
      more = true;
      if (K.lift > 0.001) {
        const r0 = binderRect(M.c, cam);
        const H = Math.min((vh - topPad() - botPad()) * 0.6, vw * 0.7 * TH / TW), W = H * TW / TH;
        const r1 = { x: (vw - W) / 2, y: topPad() + (vh - topPad() - botPad() - H) / 2 + 24, w: W, h: H };
        const r = reduced ? r1 : lerpR(r0, r1, K.lift);
        ctx.globalAlpha = reduced ? 1 : Math.min(1, K.lift * 3);
        drawTile(M.c, r.x, r.y, r.w, r.h, now);
        ctx.globalAlpha = 1;
      }
    }
  }
  if (more) kick();
}

// ----- Settings: what you've finished, with Back on the wall -----
const doneBox = document.createElement("div");
doneBox.innerHTML = `<p class="lbl">Finished</p><div class="done-list" id="done-list"></div>`;
{ const rows = prefs.querySelectorAll(".row"); rows[rows.length - 1].before(doneBox); }
const doneList = doneBox.querySelector("#done-list");
function renderDone() {
  const list = finGroups().filter((g) => g.fin?.complete).sort((a, b) => (finished[doneKey(b)]?.at || 0) - (finished[doneKey(a)]?.at || 0));
  doneList.innerHTML = list.length ? list.map((g) => {
    const d = finished[doneKey(g)] || {}, n = g.base.length, view = g.set && scopeOf(g.set) !== "set" ? ` ${scopeOf(g.set)} set` : "";
    return `<div class="done-row"><div class="done-text"><b>${esc(g.name)}${view}</b><span>${n} of ${n}. Finished ${finDate(d.at || Date.now())}.${d.away ? " Put away." : " On the wall."}</span></div><button type="button" class="btn" data-done="${esc(doneKey(g))}">${d.away ? "Back on the wall" : "Put it away"}</button></div>`;
  }).join("") : `<p class="done-none">Nothing finished yet. When the last card of a set or a chase lands, it shows here.</p>`;
}
doneList.addEventListener("click", (e) => {
  const b = e.target.closest("[data-done]"); if (!b) return;
  const g = finGroups().find((x) => doneKey(x) === b.dataset.done); if (!g) return;
  prefs.close();
  setTimeout(() => (finished[b.dataset.done]?.away ? keepOnWall(g) : putAway(g)), 80);
});
document.getElementById("settings").addEventListener("click", renderDone);
// Reset the demo forgets what was finished too.
{ const btn = document.getElementById("reset"), prev = btn.onclick; btn.onclick = (e) => { try { localStorage.removeItem("wall-done"); } catch { /* fine */ } prev?.(e); }; }
// Debug builds only: the tests' hook sees the finish.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { finished: { get: () => finished }, lastCard: { get: () => lastCard }, setOwned: { value: setOwned }, refreshFinish: { value: refreshFinish } }); }, 0);
