// ---------- the finish line: how far along a set or chase is, and the moment the last card lands ----------
// Completion the way a checklist app does it. Every panel's progress bar carries more: thin gold ticks along its
// empty part are the missing cards that are on your chase list, so a glance says how much of what's left you're
// after. When the last card is marked, in any set (its current view: set, master or grand) or any chase, the bar
// fills to gold with a one-time shimmer, the binder line reads "Complete ✓" and then "Complete since Oct 6" (the date
// is kept per group in localStorage wall-done), and on the wall the panel wears a gold hairline frame with "Complete"
// as its stat. Finished panels keep their place; the Finished filter folds them to one line at the bottom, so the
// wall is just the work left. Completion is checked when a card changes, never per frame, and cached per group.

// ----- what's done, and since when -----
let done = {}; // group key -> when it was finished (ms)
try { done = JSON.parse(localStorage.getItem("wall-done") || "{}") || {}; } catch { done = {}; }
const persistDone = () => { try { localStorage.setItem("wall-done", JSON.stringify(done)); } catch { /* private mode */ } };
state.fin = false; // the Finished filter: fold what's complete to a line
try { state.fin = localStorage.getItem("wall-fin") === "1"; } catch { /* default */ }
let finVer = 1; // bumps whenever ownership or the chase list could have changed; the per-group cache keys on it
let finStrip = null; // the folded Finished line, in mosaic coordinates
// A master set completes separately from the set, so a set's key carries its view.
const finKey = (g) => (g.set ? (scopeOf(g.set) === "set" ? g.set.id : `${g.set.id}:${scopeOf(g.set)}`) : g.key);
const finishable = (g) => Boolean(g.set || g.chase);
// Per group: owned count, whether it's complete, and where the chased-but-missing cards sit along the bar.
function finOf(g) {
  const f = g.fin;
  if (f && f.ver === finVer) return f;
  const list = g.base || g.cards, n = list.length;
  let owned = 0;
  for (const c of list) if (c.owned) owned++;
  // The missing cards fill the empty part of the bar in order; the ones you're chasing get a tick.
  const ticks = [];
  let k = 0;
  for (const c of list) { if (c.owned) continue; if (isChase(c)) ticks.push((owned + k + 0.5) / n); k++; }
  return (g.fin = { ver: finVer, owned, n, done: n > 0 && owned === n && finishable(g), ticks });
}
const finDate = (t) => { const d = new Date(t); return d.toLocaleDateString("en-US", d.getFullYear() === new Date().getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }); };
// Every set and chase, whichever arrangement is up (a band isn't something you finish).
const finGroups = () => (mode === "set" ? groups : [...(setGroups || []), ...chaseGroups.values()]).filter(finishable);
// Compare every group with what was recorded. Newly complete: remember the date, start the bar's fill and the binder's
// sweep. No longer complete (a card taken out, Undo): forget it. Returns the groups that just finished.
function syncDone() {
  const now = performance.now(), fresh = [];
  let changed = false;
  for (const g of finGroups()) {
    const prev = g.fin && g.fin.ver === finVer ? g.fin.owned : null; // where the bar was before this change
    g.finPrev = prev;
  }
  finVer++;
  for (const g of finGroups()) {
    const f = finOf(g), key = finKey(g);
    if (f.done && !done[key]) {
      done[key] = Date.now(); changed = true; fresh.push(g);
      g.finT = now; g.finFrom = (g.finPrev == null ? f.n - 1 : g.finPrev) / f.n;
      if (view === "set" && state.g === g && !reduced) g.burst = now;
    } else if (!f.done && done[key]) { delete done[key]; changed = true; g.finT = 0; }
  }
  if (changed) persistDone();
  if (fresh.length) pumpUntil(now + 2800); // the shimmer, and "Complete ✓" turning into the date
  return fresh;
}
const finNames = () => finGroups().filter((g) => finOf(g).done).map((g) => g.name);
// The toast for the moment: the group you're in first; a second one finishing at the same time gets a mention.
function finToast(fresh, undo) {
  const g = fresh.find((x) => x === state.g) || fresh[0], f = finOf(g), rest = fresh.filter((x) => x !== g);
  tick(40);
  toast(`${g.name} complete. ${f.n} of ${f.n}.${rest.length ? ` ${rest.map((x) => x.name).join(" and ")} too.` : ""}`, undo);
}
// With Finished on, a panel that just finished (or just came back) takes its place with a flight.
function finReflow() { if (state.fin && mode === "set" && !lifted && !quietLayout) reflow(); }

// ----- marking: the completion check runs here, for any group the card is in -----
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now(), b = c.base || c;
  b.owned = on; b.got = on ? Date.now() : null; saved[b.id] = { on, at: b.got }; persist();
  for (const t of [b, ...twinsOf(b)]) { t.anim = { t0: now, to: on }; const tg = groups[t.g]; if (tg && (t === c || tg.base?.includes(t) || tg.cards.includes(t))) tg.ripple = { t0: now, col: t.col, row: t.row }; }
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  const wasDone = Object.keys(done).length, fresh = syncDone(), undone = Object.keys(done).length < wasDone;
  if (fresh.length) finToast(fresh, undo);
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  if (lifted && !quietLayout) liftLayout(true); // a chased card changed hands: the chase layout flies to its new shape
  else if (fresh.length || undone) finReflow();
  updateCount(); drawList(); kick();
}
// Select all, inside a set or a chase (a chase's cards are twins: the mark goes to the card itself, as a tap's does).
function markAllInSet() {
  const g = state.g; if (!g || !marking) return;
  const todo = g.cards.filter((c) => !c.owned); if (!todo.length) { toast("You have all of them already."); return; }
  const now = performance.now();
  todo.forEach((c, i) => {
    const b = c.base || c;
    if (!session.has(c)) session.set(c, c.owned);
    b.owned = true; b.got = Date.now(); saved[b.id] = { on: true, at: b.got };
    if (!reduced) for (const t of [b, ...twinsOf(b)]) t.anim = { t0: now + i * 5, to: true };
  });
  persist(); tick(14);
  const fresh = syncDone(); // before updateCount, which runs the quiet check
  if (fresh.length) finToast(fresh, null); else if (view === "set") g.burst = now;
  updateBar(); updateCount(); drawList();
  if (lifted) liftLayout(true); else if (fresh.length) finReflow();
  kick();
}
// Everything else that changes a card (an import, a trade, a chase added or taken off) ends in updateCount.
function updateCount() {
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
  if (started) syncDone();
}
{ const was = flagBtn.onclick; flagBtn.onclick = (e) => { was(e); finVer++; kick(); }; } // Chase it / off the list: the ticks follow
{ const reset = document.getElementById("reset"), was = reset.onclick; reset.onclick = () => { try { localStorage.removeItem("wall-done"); localStorage.removeItem("wall-fin"); } catch { /* fine */ } was(); }; }

// ----- the bar: the fill, the gold, the ticks, the moment -----
// x, y, w, h on screen; k is the header's scale (1 on a panel). Draws the slot, the fill (the group's ink, or gold once
// complete, filling up from where it was when the last card landed), the chase ticks, and the one-time shimmer.
function drawBar(g, x, y, w, h, now, k = 1) {
  const f = finOf(g), timed = state.time;
  const owned = timed ? ownedNow(g.cards) : f.owned, n = timed ? g.cards.length : f.n;
  const isDone = f.done && !timed;
  let frac = n ? owned / n : 0;
  if (isDone && g.finT && !reduced) { const p = clamp((now - g.finT) / 600, 0, 1); frac = g.finFrom + (1 - g.finFrom) * (1 - Math.pow(1 - p, 3)); }
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = isDone ? "#E2B33C" : g.ink; ctx.fillRect(x, y, w * frac, h);
  if (!timed && f.ticks.length && !isDone && !picking()) { // the missing cards you're after
    const tw = Math.max(1, Math.min(2, (w / n) * 0.5)), th = h + 4 * k, ty = y - 2 * k;
    ctx.fillStyle = theme.gold;
    for (const t of f.ticks) ctx.fillRect(x + w * t - tw / 2, ty, tw, th);
  }
  if (isDone && g.finT && !reduced) { // a glint runs along the gold once
    const p = (now - g.finT - 350) / 900;
    if (p > 0 && p < 1) {
      const gx = x - w * 0.3 + p * w * 1.6, gr = ctx.createLinearGradient(gx, 0, gx + w * 0.3, 0);
      gr.addColorStop(0, "rgb(255 255 255 / 0)"); gr.addColorStop(0.5, "rgb(255 255 255 / .85)"); gr.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.fillStyle = gr; ctx.fillRect(x, y - 1 * k, w, h + 2 * k);
    }
  }
}
const FRESH = 2600; // how long "Complete ✓" shows before the date
function doneLine(g, now) {
  if (g.finT && now - g.finT < FRESH) return "Complete ✓";
  const t = done[finKey(g)];
  return t ? `Complete since ${finDate(t)}` : "Complete";
}

// A set's title inside the set view (the base header, with the bar and the line taken over once it's complete).
function drawHeader(st, now, C = cam, ox = 0, alpha = 1) {
  const sx = (st.x - C.x) * C.s + ox, sy = (st.y - C.y) * C.s, sw = st.w * C.s;
  const k = (st.head * C.s) / (132 + (st.popH || 0)), hh = 132 * k;
  const owned = ownedNow(st.cards), n = st.cards.length;
  const isDone = !state.time && finishable(st) && finOf(st).done;
  ctx.globalAlpha = alpha * (state.focus ? 1 - state.dimAll * 0.7 : 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = clamp(34 * k, 16, 64), sub = clamp(14 * k, 10, 24);
  ctx.fillStyle = theme.ink; font(800, title, true);
  ctx.fillText(fitText(st.name, sw), sx, sy + hh * 0.5);
  const pct = `${Math.floor((owned / n) * 100)}%`;
  font(700, sub); const pw = ctx.measureText(pct).width;
  ctx.textAlign = "right"; ctx.fillStyle = isDone ? theme.gold : theme.ink; ctx.fillText(pct, sx + sw, sy + hh * 0.72);
  ctx.textAlign = "left";
  if (isDone) { ctx.fillStyle = theme.gold; font(600, sub); }
  else { ctx.fillStyle = theme.muted; font(500, sub); }
  const line = state.time ? `${owned} of ${n} by ${monthOf(state.t)}` : isDone ? (state.value ? `${doneLine(st, now)}. Worth ${money(worthOf(st.base || st.cards))}` : doneLine(st, now)) : st.sub();
  ctx.fillText(fitText(line, sw - pw - 12), sx, sy + hh * 0.72);
  drawBar(st, sx, sy + hh * 0.82, sw, Math.max(1.5, 3 * k), now, k);
  if (st.popChips) drawPopRow(st, sx, sy + hh, k, ctx.globalAlpha);
  else if (st.chase && st.hdrBtn && k >= 0.3) { drawHdrBtn(st, st.hdrBtn, sx, sy + hh + st.hdrBtn.y * k, k, ctx.globalAlpha); ctx.textBaseline = "alphabetic"; }
  if (st.burst) {
    const p = (now - st.burst) / 1400;
    if (p < 1) {
      const fx = sx - sw + p * sw * 3;
      const g = ctx.createLinearGradient(fx, sy, fx + sw * 0.6, sy + st.h * C.s);
      g.addColorStop(0, "rgb(255 255 255 / 0)"); g.addColorStop(0.5, "rgb(255 220 140 / .4)"); g.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.globalCompositeOperation = theme.dark ? "screen" : "multiply"; ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, st.h * C.s); ctx.globalCompositeOperation = "source-over";
    } else st.burst = 0;
  }
  ctx.globalAlpha = 1;
}

// A panel's stat: "Complete" once it is (search, picking, Value and spares still say their own thing).
function panelStat(g) {
  if (picking()) return "  ";
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(rootOf(c))).length; return m ? `${m} found` : ""; }
  const isDone = !state.time && finishable(g) && finOf(g).done;
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : isDone ? "Complete" : ""; }
  if (state.value) return short(worthOf(g.cards));
  if (isDone) return "Complete";
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  return `${owned}/${n}`;
}
// A mosaic panel (the base panel, plus the gold frame, the ticks, and the folded Finished line).
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m);
  const T = state.trans, moving = T?.kind === "morph" && g.pm;
  if (moving) {
    const k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)), a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  if (g.finFold) { drawFinFold(g, m, now, alpha, labelAlpha, moving); return; }
  const isDone = !state.time && !picking() && finishable(g) && finOf(g).done;
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  else if (isDone) { ctx.lineWidth = 1; ctx.strokeStyle = theme.gold; ctx.globalAlpha = alpha * labelAlpha; ctx.stroke(); }
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
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? beat.col : isDone ? theme.gold : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, x + w, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha;
  }
  drawBar(g, x, m.y + PG + 30, w, 2, now);
  ctx.globalAlpha = 1;
}
// The Finished line: every finished group is a segment of one strip (so a tap on its part opens it), and the first
// draws the strip: a gold hairline, "Finished: Base Set, Every Charizard" in gold, their cards as hairlines under.
function drawFinFold(g, m, now, alpha, labelAlpha, moving) {
  ctx.globalAlpha = alpha;
  if (moving) { rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12); ctx.fillStyle = theme.panelFill; ctx.fill(); }
  if (!g.finFirst) { ctx.globalAlpha = 1; return; }
  const s = { x: 8, y: m.y, w: vw - 16, h: m.h };
  ctx.globalAlpha = alpha * (moving ? labelAlpha : 1);
  rr(s.x + PG, s.y + PG, s.w - PG * 2, s.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  ctx.globalAlpha = alpha * labelAlpha;
  const pressed = groups.some((x) => x.finFold && state.press?.g === x);
  ctx.lineWidth = pressed ? 1.5 : 1; ctx.strokeStyle = pressed ? theme.ink : theme.gold; ctx.stroke();
  const x = s.x + PG + 10, w = s.w - PG * 2 - 20;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.gold;
  font(800, 15, true); const head = "Finished: ", hw = textW(head);
  ctx.fillText(head, x, s.y + PG + 22);
  font(600, 14, true); ctx.fillText(fitText(groups.filter((x) => x.finFold).map((x) => x.name).join(", "), w - hw), x + hw, s.y + PG + 22);
  ctx.globalAlpha = 1;
}

// ----- the mosaic: the work left shares the screen; the finished fold to a line at the bottom -----
function mosaicLayout() {
  const newH = mode === "set" && !picking() ? NEW_H : 0;
  newPanel = null; finStrip = null;
  for (const g of groups) { g.finFold = false; g.finFirst = false; }
  const fitH = vh - topPad() - botPad() - newH;
  const fin = mode === "set" && state.fin && !picking() ? groups.filter((g) => finishable(g) && finOf(g).done) : [];
  const picks = mode === "set" && pickedSets.size && pickedSets.size < sets.length;
  const mine = groups.filter((g) => !fin.includes(g) && (!picks || g.chase || pickedSets.has(g.set.id)));
  const rest = picks ? groups.filter((g) => g.set && !pickedSets.has(g.set.id) && !fin.includes(g)) : [];
  const foldH = rest.length * W_FOLD + (fin.length ? W_FOLD : 0);
  const n = mine.reduce((a, g) => a + g.cards.length, 0);
  const R = { x: 8, y: topPad(), w: vw - 16, h: !mine.length ? 0 : foldH ? Math.max(fitH - foldH, fitH * 0.62, (n * 340) / (vw - 16)) : Math.max(fitH, (n * 340) / (vw - 16)) };
  const items = mine.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  if (items.length) stripTreemap(items, R);
  let y = R.y + R.h;
  for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
  if (fin.length) {
    const sw = R.w / fin.length;
    fin.forEach((g, i) => { g.m = { x: R.x + i * sw, y, w: sw, h: W_FOLD }; g.finFold = true; g.finFirst = i === 0; });
    finStrip = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD;
  }
  if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  for (const g of mine) packPanel(g);
  for (const g of rest) packFolded(g);
  for (const g of fin) packFinFold(g);
}
// A finished group's cards as a hairline across its part of the line, each card a dot at most 3px wide (a chase of
// six would otherwise spread into readable tiles 2px tall).
function packFinFold(g) {
  const m = g.m, n = g.cards.length, w = Math.min(m.w - PG * 2 - 20, n * 3), x = m.x + (m.w - w) / 2;
  g.cards.forEach((c, k) => { c.m = { x: x + (w * k) / n, y: m.y + PG + 30, w: Math.max(0.5, (w / n) * 0.8), h: 2 }; });
}

// ----- the Finished filter, in the Filters menu -----
const finBtn = document.createElement("button");
finBtn.type = "button"; finBtn.setAttribute("role", "menuitemcheckbox"); finBtn.dataset.filter = "finished"; finBtn.setAttribute("aria-checked", "false");
finBtn.innerHTML = `<span><b>Finished</b><small>Fold what's complete to a line</small></span><span class="tick" aria-hidden="true">✓</span>`;
filterMenu.append(finBtn);
function markFilters() {
  filterMenu.querySelector('[data-filter="value"]').setAttribute("aria-checked", String(state.value));
  filterMenu.querySelector('[data-filter="time"]').setAttribute("aria-checked", String(state.time));
  filterMenu.querySelector('[data-filter="bands"]').setAttribute("aria-checked", String(mode === "value"));
  finBtn.setAttribute("aria-checked", String(state.fin));
  filterBtn.setAttribute("aria-pressed", String(state.value || state.time || mode === "value" || state.fin));
}
function setFinished(on) {
  state.fin = on; markFilters(); tick(5); hideCaption();
  try { localStorage.setItem("wall-fin", on ? "1" : ""); } catch { /* fine */ }
  const names = finNames();
  if (on) toast(names.length ? `Finished: ${names.join(", ")}. Folded to a line at the bottom.` : "Nothing finished yet. A set or chase folds down here once you have it all.");
  else if (names.length) toast("Finished sets and chases are back in place.");
  if (mode === "set" && !lifted) reflow(); else { layoutAll(); kick(); }
  drawList();
}
finBtn.onclick = () => { setFilterMenu(false); setFinished(!state.fin); };

// ----- the list: the same wall, readable -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}<p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
  }
  if (state.lens === "trade") top = tradeListHTML();
  const folded = mode === "set" && state.fin ? groups.filter((g) => finishable(g) && finOf(g).done) : [];
  const now = performance.now();
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    if (folded.includes(g)) return "";
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const isDone = finishable(g) && finOf(g).done;
    return `<section><h2>${g.name}</h2><p class="lsub${isDone ? " lfin" : ""}">${isDone ? doneLine(g, now) : g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") + (folded.length ? `<section><h2 class="lfin">Finished</h2><p class="lsub lfin">${folded.map((g) => g.name).join(", ")}</p></section>` : "") || `<p class="lsub">Nothing here with this lens.</p>`;
}

// Debug builds only: the tests' hook learns about what's finished.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { done: { get: () => done }, finStrip: { get: () => finStrip }, setFinished: { value: setFinished }, finOf: { value: finOf } }); }, 0);
