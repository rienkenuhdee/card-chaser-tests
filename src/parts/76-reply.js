// ---------- after the handshake: the other side answers ----------
// The other collector is simulated and seeded: twelve seconds after an offer goes out they accept, counter or decline,
// by h32(`${t.id}|${rec.at}|reply`). A counter shifts the balance toward them by one card: they leave out one of
// theirs, or ask for one more of yours they chase, whichever the seed picks (the other if that one isn't possible,
// an acceptance if neither is). A decline comes with a line. The reply never lands on a moving wall or a moving table.
// With the table up on that trader the reply plays on the table itself (75-trade.js): a counter moves the card, an
// acceptance crosses the cards and hands them over, a decline pushes them home with the line. With the table down the
// reply arrives the way a deal does: the cards flash gold where they sit, the panel header beats "Maya countered",
// and a toast carries the line with Open (the Trade lens, then the table from her chip). An acceptance off the table
// crosses the cards in the wall itself: yours lift out through the top edge and leave your collection, hers fly in
// from it and land in their pockets with the marking flood, one relayout at the end, and a toast says what changed
// hands. Accept, Decline and Counter from the thread; Take back while the offer is out.

const REPLY_MS = 12000;
const replyTimers = new Map(); // record -> timer
const persistSpares = () => { try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* private mode */ } };
function scheduleReply(rec, minMs = 1500) {
  clearTimeout(replyTimers.get(rec));
  replyTimers.set(rec, setTimeout(() => deliver(rec), Math.max(minMs, rec.at + REPLY_MS - Date.now())));
}
// With the table up only the table's motion matters (a feed arrival can leave a wall morph pending under it).
function replyBusy(rec) {
  if (wel.on) return true;
  if (tbl.on) return tbl.t.id !== rec.t || tbl.closing || Boolean(tbl.anim || tbl.pinch || tbl.drag || tbl.pend || tbl.flights.length || tbl.shake);
  return Boolean(state.trans || shuffle || gesture || fly || inertia || pop.c || crossing || state.press);
}
function deliver(rec, forced = null) {
  replyTimers.delete(rec);
  if (rec.state !== "proposed" || !trades.includes(rec)) return;
  if (replyBusy(rec)) { replyTimers.set(rec, setTimeout(() => deliver(rec, forced), 600)); return; }
  const t = traderOf(rec);
  const r = forced === "accept" ? 0 : forced === "counter" ? 0.5 : forced === "decline" ? 0.9 : h32(`${t.id}|${rec.at}|reply`);
  if (r < 0.45) return accept(rec, t, "them");
  if (r < 0.8) { const c = counterFor(rec, t); if (c) return counter(rec, t, c); return accept(rec, t, "them"); }
  decline(rec, t);
}
function counterFor(rec, t) {
  const seed = (k) => h32(`${t.id}|${rec.at}|${k}`);
  const give = rec.give.slice(), get = rec.get.slice();
  const more = t.chases.filter((c) => isSpare(c) && !give.includes(c.id));
  const dropOne = () => { get.splice(Math.floor(seed("drop") * get.length), 1); return { give, get }; };
  const addOne = () => { give.push(more[Math.floor(seed("add") * more.length)].id); return { give, get }; };
  const canDrop = get.length > 1, canAdd = more.length > 0;
  if (seed("how") < 0.5) return canDrop ? dropOne() : canAdd ? addOne() : null;
  return canAdd ? addOne() : canDrop ? dropOne() : null;
}
function reasonFor(rec, t) {
  const seed = h32(`${t.id}|${rec.at}|why`);
  const more = t.chases.filter((c) => isSpare(c) && !rec.give.includes(c.id));
  if (more.length && seed < 0.7) return `I'd want the ${more[Math.floor(h32(`${t.id}|${rec.at}|which`) * more.length)].name} too.`;
  return ["Not this time, sorry.", "I'm keeping those for now.", "Too far apart for me."][Math.floor(seed * 3)];
}
// The reply as an event in the wall, when the table is down: the cards flash gold, the panel header beats the line.
function replyEvent(rec, t, text) {
  if (tbl.on) return;
  const now = performance.now(), gs = new Map();
  for (const c of toCards([...rec.give, ...rec.get])) { c.flash = { t0: now, gold: true }; for (const t of twinsOf(c)) t.flash = { t0: now, gold: true }; if (!gs.has(groups[c.g])) gs.set(groups[c.g], c); }
  for (const [g, c] of gs) { if (!reduced) g.ripple = { t0: now, col: c.col, row: c.row, live: true, gold: true }; g.beat = { t0: now, text, col: theme.gold }; }
  const first = gs.values().next().value;
  if (first) { live.beat = { t0: now, text, g: groups[first.g], col: theme.gold }; live.until = Math.max(live.until, now + 3200); }
  tick(8); kick();
}
function counter(rec, t, c) {
  const now = Date.now();
  rec.log.push({ by: "them", kind: "counter", give: c.give, get: c.get, at: now }); rec.give = c.give; rec.get = c.get; rec.state = "countered"; persistTrades();
  const give = toCards(c.give), get = toCards(c.get);
  if (onTable(t)) { tbl.rec = rec; syncTableTo(rec); tick(10); setPhase("countered"); }
  else { replyEvent(rec, t, `${t.name} countered`); toast(`${t.name} countered: ${names(give)} for ${names(get)}.`, () => showThread(t), "Open"); }
  drawList(); kick();
}
function decline(rec, t) {
  const now = Date.now();
  rec.state = "declined"; rec.by = "them"; rec.reason = reasonFor(rec, t); rec.doneAt = now; rec.log.push({ by: "them", kind: "decline", reason: rec.reason, at: now }); persistTrades();
  if (onTable(t)) { tbl.rec = null; tbl.note = rec.reason; for (const x of [...tbl.get, ...tbl.give]) place(x, false, curRect(x)); tick(6); setPhase("open"); }
  else { replyEvent(rec, t, `${t.name} declined`); toast(`${t.name} declined: ${rec.reason}`, () => showThread(t), "Open"); }
  drawList(); kick();
}
// Accepted, by them or by you.
function accept(rec, t, by) {
  const now = Date.now();
  rec.state = "accepted"; rec.by = by; rec.log.push({ by, kind: "accept", at: now }); persistTrades();
  if (onTable(t)) { tbl.rec = rec; playAccept(by); }
  else { if (by === "them") replyEvent(rec, t, `${t.name} accepted`); crossOnWall(rec, t); }
  drawList();
}
// The bookkeeping of a done trade: the cards you gave leave your collection and stop being spares; the ones you got
// arrive, dated now, and leave your chase list. landAt times the marking flood to a flight that is still in the air.
function completeTrade(rec, t, landAt = 0) {
  const give = toCards(rec.give), get = toCards(rec.get);
  quietLayout = true;
  for (const c of give) { delete spares[c.id]; if (c.owned) setOwned(c, false, { quiet: true }); if (landAt) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; } }
  for (const c of get) { delete chasing[c.id]; if (!c.owned) setOwned(c, true, { quiet: true }); if (landAt) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; } }
  quietLayout = false;
  persistSpares(); persistChase(); syncBadge(); updateCount();
  rec.state = "done"; rec.doneAt = Date.now(); persistTrades(); drawList();
  toast(`${rec.by === "them" ? `${t.name} accepted. ` : ""}${tradedText(get, give, t)}`);
}
const tradedText = (get, give, t) => `${names(get)} ${get.length === 1 ? "is" : "are"} yours. ${names(give)} went to ${t.name}.`;

// ----- the crossing in the wall: yours lift out through the top edge, theirs fly in and land in their pockets -----
let crossing = null; // { rec, t, give, get, n }
const flights = []; // { c, out, edge, slot, last, t0, dur, then }
function crossOnWall(rec, t) {
  const give = toCards(rec.give).filter((c) => c.owned), get = toCards(rec.get).filter((c) => !c.owned);
  if (reduced || document.body.classList.contains("listmode") || crossing) { completeTrade(rec, t); if (lifted) liftLayout(true); kick(); return; }
  crossing = { rec, t, give, get, n: give.length + get.length };
  const now = performance.now(), step = () => { if (crossing && --crossing.n <= 0) finishCross(); };
  quietLayout = true;
  give.forEach((c, i) => { delete spares[c.id]; setOwned(c, false, { quiet: true }); if (lifted) c.away = true; flyCard(c, true, now + i * 80, 720, step); });
  quietLayout = false; persistSpares();
  get.forEach((c, i) => flyCard(c, false, now + 260 + i * 80, 780, () => { quietLayout = true; setOwned(c, true, { quiet: true }); quietLayout = false; delete chasing[c.id]; persistChase(); step(); }));
  if (!crossing.n) finishCross();
}
function finishCross() {
  const { rec, t, give, get } = crossing; crossing = null;
  for (const c of give) c.away = false;
  rec.state = "done"; rec.doneAt = Date.now(); persistTrades();
  syncBadge(); updateCount(); drawList();
  if (lifted) liftLayout(true);
  tick(14); kick();
  toast(`${rec.by === "them" ? `${t.name} accepted. ` : ""}${tradedText(get, give, t)}`);
}
// Where the card's tile is on screen right now, or null if it isn't drawn (another set open).
function tileRectOf(c) {
  if (view === "mosaic") return c.m ? mr(c.m) : null; // a folded panel's hairline counts: the card shrinks into the fold
  if (view === "set" && state.g === groups[c.g]) return binderRect(c, cam);
  return null;
}
// A card leaves through the top edge (out), or arrives from it. Leaving, it keeps the pocket it left; arriving, it
// follows the pocket as the wall settles. On a wide tile (a spare tile out in front) the card is the face on it.
function flyCard(c, out, t0, dur, then) {
  const r = tileRectOf(c);
  if (!r) { setTimeout(() => then?.(), Math.max(0, t0 - performance.now()) + dur); return; }
  const h = Math.max(72, Math.min(r.h, 120)), w = h * TW / TH;
  const at = () => { const q = tileRectOf(c); if (!q) return null; if (q.h > 24 && q.w > q.h * 1.05) { const pad = Math.max(8, q.w * 0.05); return { x: q.x + pad, y: q.y + pad, w: (q.h - pad * 2) * TW / TH, h: q.h - pad * 2 }; } return q; };
  const from = at(), slot = out ? () => from : at;
  flights.push({ c, out, edge: { x: r.x + r.w / 2 - w / 2, y: -h - 30, w, h }, slot, last: null, t0, dur, then });
  kick();
}
// The cards in flight, drawn over the wall each frame.
function drawFlights(now) {
  if (!flights.length || tbl.on) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const value = state.value && !state.matches, landed = [];
  let more = false;
  for (const f of flights) {
    const p = clamp((now - f.t0) / f.dur, 0, 1);
    if (p <= 0) { more = true; continue; }
    const slot = f.slot() || f.last; f.last = slot;
    if (!slot) { landed.push(f); continue; } // its tile left the screen (another set opened): it just arrives
    const big = { x: slot.x + (slot.w - f.edge.w) / 2, y: slot.y + (slot.h - f.edge.h) / 2, w: f.edge.w, h: f.edge.h };
    const from = f.out ? slot : f.edge, to = f.out ? f.edge : slot, e = ease(p);
    // the card grows to a readable size as it leaves its pocket, and shrinks into one as it lands
    const mid = { ...big, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
    const r = p < 0.5 ? lerpR(from, mid, e * 2) : lerpR(mid, to, (e - 0.5) * 2);
    r.x += Math.sin(Math.PI * p) * (f.out ? 14 : -14);
    ctx.globalAlpha = f.out ? 1 - Math.max(0, p - 0.7) / 0.3 : Math.min(1, p * 4);
    foilOff = true; drawCardAt(f.c, r, now, value, 4 + 10 * Math.sin(Math.PI * p)); foilOff = false;
    if (p >= 1) landed.push(f); else more = true;
  }
  for (const f of landed) { flights.splice(flights.indexOf(f), 1); f.then?.(); }
  ctx.globalAlpha = 1;
  return more || flights.length > 0;
}

// ----- your side of the thread -----
function acceptCounter(rec) { if (rec.state === "countered") accept(rec, traderOf(rec), "you"); }
function declineCounter(rec) {
  if (rec.state !== "countered") return;
  const t = traderOf(rec), now = Date.now();
  rec.state = "declined"; rec.by = "you"; rec.doneAt = now; rec.log.push({ by: "you", kind: "decline", at: now }); persistTrades(); tick(6);
  if (onTable(t)) { tbl.rec = null; for (const x of [...tbl.get, ...tbl.give]) place(x, false, curRect(x)); setPhase("open"); }
  drawList(); kick();
  toast(`Declined. ${t.name} still wants ${wantsOf(t).length} of yours.`);
}
// Take back: the offer comes off the table (your counter back goes back to their counter).
function takeBack(rec) {
  if (rec.state !== "proposed") return;
  const t = traderOf(rec), last = rec.log[rec.log.length - 1], prev = rec.log[rec.log.length - 2];
  clearTimeout(replyTimers.get(rec)); replyTimers.delete(rec);
  if (last.kind === "counter" && last.by === "you" && prev) {
    rec.log.pop(); rec.give = prev.give; rec.get = prev.get; rec.at = prev.at; rec.state = "countered"; persistTrades();
    if (onTable(t)) { syncTableTo(rec); setPhase("countered"); }
  } else {
    trades = trades.filter((x) => x !== rec); persistTrades();
    if (onTable(t)) { tbl.rec = null; setPhase("open"); }
  }
  tick(4); drawList(); kick();
}
// Open from a toast: the Trade lens first if it isn't up (the table opens from the chip once the lens has flown).
function showThread(t) {
  if (tbl.on && tbl.t === t) return;
  if (tbl.on) closeTable(true);
  if (document.body.classList.contains("listmode") || wel.on) return;
  closePop(true); if (state.focus) unfocus();
  let tries = 0, step = 0; // out of the set, then into the Trade lens, then the table, each once the wall is still
  const go = () => {
    if (tbl.on || tries++ > 60) return;
    if (state.trans || shuffle || fly) { setTimeout(go, 120); return; }
    if (step === 0) { step = 1; if (view === "set") { exitToMosaic(); setTimeout(go, 120); return; } }
    if (step === 1) { step = 2; if (state.lens !== "trade") { setLens("trade"); setTimeout(go, 120); return; } }
    if (view === "mosaic") openTable(t, strip?.chips.find((x) => x.t === t) || null);
  };
  go();
}
// The list's buttons.
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-propose], [data-accept], [data-decline], [data-back]"); if (!b) return;
  if (b.dataset.propose) {
    const t = TRADERS.find((x) => x.id === b.dataset.propose), want = wantsOf(t), has = offersOf(t);
    if (!want.length || !has.length || activeOf(t)) return;
    const now = Date.now(), give = want.map((c) => c.id), get = has.map((c) => c.id);
    const rec = { t: t.id, at: now, state: "proposed", give, get, log: [{ by: "you", kind: "offer", give, get, at: now }] };
    trades.push(rec); persistTrades(); scheduleReply(rec); drawList(); tick(12);
    toast(`Proposed to ${t.name}: ${give.length} of yours for ${get.length} of ${t.name}'s. ${balanceText(has, want, t)}.`, () => takeBack(rec));
    return;
  }
  const rec = recOf(b.dataset.accept || b.dataset.decline || b.dataset.back); if (!rec) return;
  if (b.dataset.accept) acceptCounter(rec); else if (b.dataset.decline) declineCounter(rec); else takeBack(rec);
});
// On load: an offer still out gets its answer once the wall has inked in; an acceptance cut short completes.
setTimeout(() => {
  for (const rec of trades.slice()) {
    const t = traderOf(rec); if (!t) continue;
    if (rec.state === "proposed") scheduleReply(rec, reduced ? 1200 : 3200);
    else if (rec.state === "accepted") { completeTrade(rec, t); if (lifted) liftLayout(true); }
  }
  if (window.__w) Object.defineProperties(window.__w, { deliver: { value: deliver }, flights: { get: () => flights }, crossing: { get: () => crossing }, takeBack: { value: takeBack }, acceptCounter: { value: acceptCounter }, declineCounter: { value: declineCounter }, showThread: { value: showThread } });
}, 0);
