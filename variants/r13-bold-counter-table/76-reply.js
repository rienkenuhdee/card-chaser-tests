// ---------- after the handshake: the reply happens on the table itself ----------
// Shake hands no longer closes the table. The cards on it gather on the trader's side, under a thin "Waiting on Maya"
// line, and twelve seconds later she answers with her hand on the same table (seeded by h32(`${t.id}|${rec.at}|reply`),
// the shared rule for this round):
//   - a counter: one of your cards slides back off the table into your binder (she doesn't want it), or one more of
//     hers comes down out of her binder onto the table, and the balance rewrites itself. The bar reads her counter,
//     with Accept and Counter back (the table is yours to drag again; Shake hands sends your counter).
//   - an acceptance: the cards cross over (the handshake crossing), fly on into their new binders, and the table
//     closes; on the wall her cards flood in as yours and yours flood out, with "Traded with Maya. You're up $0.16."
//   - a decline: she pushes the cards back to their binders and the table carries her one line.
// If you leave the table while waiting, the chip reads "Waiting on Maya" and the reply arrives as a toast with
// "See the table". Records stay in localStorage "wall-trades" ({t, give, get, at, state, reply}), and a record's state
// is proposed, countered, accepted, declined or done. Reset the demo clears them.

const REPLY_MS = 12000;
const cardById = new Map(cards.map((c) => [c.id, c]));
const byIds = (ids) => ids.map((id) => cardById.get(id)).filter(Boolean);
const traderOf = (rec) => TRADERS.find((x) => x.id === rec.t);
const lastTo = (t) => trades.filter((x) => x.t === t.id).pop() || null;
const liveTo = (t) => { const r = lastTo(t); return r && (r.state === "proposed" || r.state === "countered") ? r : null; };
const persistSpares = () => { try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* fine */ } };
for (const rec of trades) rec.state ||= "proposed"; // records from before this round
const replyTimers = new Map();
Object.assign(tbl, { phase: "open", rec: null, note: null, handed: [], landing: 0 });

// A toast whose button can say something other than Undo ("See the table").
function toast(t, action = null, label = "Undo") {
  toastEl.textContent = t;
  if (action) {
    const b = document.createElement("button"); b.textContent = label; b.className = "toast-btn";
    b.onclick = () => { toastEl.classList.remove("show"); action(); };
    toastEl.append(" ", b);
  }
  toastEl.classList.toggle("act", Boolean(action));
  toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), action ? 5200 : 2600);
}

// ----- the bar: a second button, and the waiting line over the strip -----
const tbAlt = document.createElement("button");
tbAlt.type = "button"; tbAlt.className = "mbtn"; tbAlt.id = "tb-alt"; tbAlt.hidden = true;
tbGo.before(tbAlt);
const waitEl = document.createElement("div");
waitEl.className = "tb-wait"; waitEl.innerHTML = "<i></i><span></span>"; waitEl.setAttribute("aria-live", "polite");
document.body.append(waitEl);
let waitTop = -1;
function syncWait() {
  const on = tbl.on && tbl.phase === "waiting" && tbl.q >= 1 && !tbl.anim && !tbl.closing && !tbl.pinch;
  if (on) { const S = tbl.L.strip, top = Math.round(S.y + S.h - 36); if (top !== waitTop) { waitTop = top; waitEl.style.top = `${top}px`; } waitEl.lastChild.textContent = `Waiting on ${tbl.t.name}`; }
  waitEl.classList.toggle("on", on);
}
const moveText = (rec, t) => { const r = rec.reply; if (!r) return ""; if (r.drop) return `Doesn't want the ${cardById.get(r.drop)?.name || "card"}`; if (r.add) return `Added the ${cardById.get(r.add)?.name || "card"}`; return `${t.name}'s counter`; };
function updateTradeBar() {
  const t = tbl.t; if (!t) return;
  const give = tbl.give.length, get = tbl.get.length, ph = tbl.phase, bal = give && get ? balanceText(tbl.get, tbl.give, t) : "";
  tbGo.hidden = false; tbGo.disabled = false; tbGo.textContent = "Shake hands"; tbAlt.hidden = true;
  if (ph === "waiting") { tbHead.textContent = `Waiting on ${t.name}`; tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s. ${bal}`; tbGo.hidden = true; tbAlt.hidden = false; tbAlt.textContent = "Withdraw"; }
  else if (ph === "countered") { tbHead.textContent = `${t.name}'s counter`; tbSub.textContent = moveText(tbl.rec, t); tbGo.textContent = "Accept"; tbAlt.hidden = false; tbAlt.textContent = "Counter back"; }
  else if (ph === "accepting") { tbHead.textContent = `${t.name} accepted`; tbSub.textContent = "The cards are changing hands"; tbGo.hidden = true; }
  else if (!give && !get && tbl.note) { tbHead.textContent = `${t.name} passed`; tbSub.textContent = tbl.note; tbGo.disabled = true; }
  else if (!give && !get) { tbHead.textContent = `Trade with ${t.name}`; tbSub.textContent = "Drag a card from either side onto the table"; tbGo.disabled = true; }
  else if (give && get) { tbHead.textContent = bal; tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s`; tbGo.disabled = Boolean(tbl.shake); }
  else if (get) { tbHead.textContent = `${get} of ${t.name}'s on the table`; tbSub.textContent = "Add one of yours to make it a trade"; tbGo.disabled = true; }
  else { tbHead.textContent = `${give} of yours on the table`; tbSub.textContent = `Add one of ${t.name}'s to make it a trade`; tbGo.disabled = true; }
}
tbAlt.onclick = () => {
  if (!tbl.on) return;
  if (tbl.phase === "waiting" && tbl.rec) withdraw(tbl.rec);
  else if (tbl.phase === "countered") { tbl.phase = "open"; tick(4); updateTradeBar(); toast(`The table is yours. Move cards, then shake hands to send ${tbl.t.name} your counter.`); kick(); }
};
function setPhase(ph) { tbl.phase = ph; updateTradeBar(); syncWait(); kick(); }

// ----- the record and the reply -----
function schedule(rec, minMs = 600) {
  clearTimeout(replyTimers.get(rec));
  const ms = Math.max(minMs, rec.at + REPLY_MS - Date.now());
  replyTimers.set(rec, setTimeout(() => replyTo(rec), ms));
}
// What she says, decided by the seed the moment it is due.
function decide(rec) {
  const t = traderOf(rec), r = h32(`${t.id}|${rec.at}|reply`);
  if (r < 0.45) return { kind: "accept" };
  if (r < 0.8) {
    const which = h32(`${t.id}|${rec.at}|which`), canDrop = rec.give.length > 1;
    const extra = offersOf(t).filter((c) => !rec.get.includes(c.id)), canAdd = extra.length > 0;
    if ((which < 0.5 && canDrop) || (!canAdd && canDrop)) return { kind: "counter", drop: rec.give[Math.floor(h32(`${t.id}|${rec.at}|drop`) * rec.give.length)] };
    if (canAdd) return { kind: "counter", add: extra[Math.floor(h32(`${t.id}|${rec.at}|add`) * extra.length)].id };
    return { kind: "accept" }; // nothing to move: she takes it as it is
  }
  const more = wantsOf(t).filter((c) => !rec.give.includes(c.id));
  const reason = more.length ? `${t.name}: I'd want the ${more[Math.floor(h32(`${t.id}|${rec.at}|want`) * more.length)].name} too.` : `${t.name}: I'll pass on this one.`;
  return { kind: "decline", reason };
}
function replyTo(rec, forced = null) {
  replyTimers.delete(rec);
  if (rec.state !== "proposed" || !trades.includes(rec)) return;
  // The reply never lands on a moving wall, or on someone else's table.
  // (A lift morph under an open table is frozen until it closes, so it only counts when the table is down.)
  if ((!tbl.on && (state.trans || shuffle)) || (tbl.on && (tbl.t.id !== rec.t || tbl.closing || tbl.anim || tbl.pinch || tbl.drag || tbl.flights.length))) { replyTimers.set(rec, setTimeout(() => replyTo(rec, forced), 700)); return; }
  const t = traderOf(rec), d = forced || decide(rec);
  rec.reply = { ...d, at: Date.now() };
  if (d.kind === "counter") { if (d.drop) rec.give = rec.give.filter((id) => id !== d.drop); if (d.add) rec.get = [...rec.get, d.add]; }
  rec.state = d.kind === "accept" ? "accepted" : d.kind === "counter" ? "countered" : "declined";
  persistTrades();
  const onTable = tbl.on && tbl.t === t && tbl.rec === rec && tbl.phase === "waiting" && tbl.q >= 1;
  if (onTable) playReply(rec); else toastReply(rec);
  drawList(); kick();
}
// Her hand on the table.
function playReply(rec) {
  const t = tbl.t, r = rec.reply;
  toastEl.classList.remove("show"); // the proposal's Undo is moot now
  if (r.kind === "accept") {
    tick(24);
    if (reduced) { setPhase("accepting"); closeTable(true); return; }
    tbl.shake = { t0: performance.now(), dur: 520 }; setPhase("accepting"); return;
  }
  if (r.kind === "counter") {
    const c = cardById.get(r.drop || r.add);
    if (r.drop && c && tbl.give.includes(c)) place(c, false, c.tcur || targetRect(c));
    if (r.add && c && tbl.theirs.includes(c) && !tbl.get.includes(c)) place(c, true, slotRect("their", tbl.theirs.indexOf(c)));
    tick(12); setPhase("countered"); return;
  }
  tbl.note = r.reason;
  for (const c of [...tbl.get, ...tbl.give]) place(c, false, c.tcur || targetRect(c));
  tick(6); setPhase("open");
}
// The reply as a toast, when the table is closed.
function toastReply(rec) {
  const t = traderOf(rec), r = rec.reply, see = document.body.classList.contains("listmode") ? null : () => seeTable(t);
  if (r.kind === "accept") { completeTrade(rec, `${t.name} accepted. `); return; }
  if (r.kind === "counter") { toast(`${t.name} countered: ${moveText(rec, t).toLowerCase()}. ${balanceText(byIds(rec.get), byIds(rec.give), t)}.`, see, "See the table"); return; }
  toast(r.reason, see, "See the table");
}
function seeTable(t) {
  if (tbl.on) return;
  closePop(true); unfocus();
  if (view === "set") exitToMosaic();
  if (state.lens !== "trade") setLens("trade");
  const go = () => { if (tbl.on) return; if (state.trans || view !== "mosaic") { setTimeout(go, 120); return; } openTable(t, strip?.chips.find((x) => x.t === t) || null); };
  go();
}
function withdraw(rec) {
  clearTimeout(replyTimers.get(rec)); replyTimers.delete(rec);
  trades = trades.filter((x) => x !== rec); persistTrades();
  if (tbl.on && tbl.rec === rec) { tbl.rec = null; tbl.note = null; setPhase("open"); }
  drawList(); kick();
}
// The trade is done: your cards leave (and stop being spares), hers arrive (dated now, off your chase list), with the
// wall's own marking flood.
function completeTrade(rec, said = "") {
  if (rec.state === "done") return;
  const t = traderOf(rec), give = byIds(rec.give), get = byIds(rec.get);
  const wasLifted = lifted; lifted = false; // one flight for the whole trade, not one per card
  for (const c of give) { delete spares[c.id]; if (c.owned) setOwned(c, false, { quiet: true }); }
  for (const c of get) { delete chasing[c.id]; if (!c.owned) setOwned(c, true, { quiet: true }); }
  lifted = wasLifted; if (lifted) liftLayout(true);
  persistSpares(); persistChase();
  rec.state = "done"; rec.doneAt = Date.now(); persistTrades();
  tick(20); updateCount(); drawList();
  toast(`${said}Traded with ${t.name}. ${balanceText(get, give, t)}.`);
  kick();
}
// Shake hands: propose (or send your counter back). In her counter, the same button accepts it.
function shake() {
  if (!tbl.on || tbl.shake) return;
  if (tbl.phase === "countered" && tbl.rec) { tbl.rec.state = "accepted"; tbl.rec.reply = { ...tbl.rec.reply, kind: "accept", byYou: true }; persistTrades(); drawList(); playReply(tbl.rec); return; }
  if (tbl.phase !== "open" || !tbl.give.length || !tbl.get.length) return;
  const t = tbl.t, prev = tbl.rec && tbl.rec.state === "countered" && trades.includes(tbl.rec) ? tbl.rec : null;
  const rec = prev || { t: t.id, give: [], get: [], at: 0, state: "proposed", round: 0 };
  rec.give = tbl.give.map((c) => c.id); rec.get = tbl.get.map((c) => c.id); rec.at = Date.now(); rec.state = "proposed"; rec.reply = null; rec.round = (rec.round || 0) + 1;
  if (!prev) trades.push(rec);
  persistTrades(); tbl.rec = rec; tbl.note = null; tick(24);
  toast(`${prev ? `Countered to ${t.name}` : `Proposed to ${t.name}`}: ${rec.give.length} of yours for ${rec.get.length} of ${t.name}'s. ${balanceText(tbl.get, tbl.give, t)}.`, () => withdraw(rec));
  schedule(rec); drawList();
  for (const c of [...tbl.get, ...tbl.give]) c.tcur ||= targetRect(c); // so they slide, rather than appear, in her hands
  setPhase("waiting");
}
// She accepted: after the crossing, hers drop into your binder and yours go up into hers, then the table closes.
function handOver() {
  const got = tbl.get.slice(), gave = tbl.give.slice(), now = performance.now();
  tbl.shake = null; tbl.get = []; tbl.give = []; tbl.handed = [...got, ...gave]; tbl.landing = got.length + gave.length;
  const land = () => { if (--tbl.landing <= 0) setTimeout(() => { if (tbl.on && tbl.phase === "accepting") closeTable(); }, 520); };
  for (const c of gave) { tbl.yours.splice(tbl.yours.indexOf(c), 1); tbl.theirs.unshift(c); }
  for (const c of got) { tbl.theirs.splice(tbl.theirs.indexOf(c), 1); tbl.yours.unshift(c); c.o = mr(c.m); c.away = true; c.e = 0; }
  for (const c of tbl.handed) { const from = c.tcur || targetRect(c); c.spot = "binder"; c.handed = true; c.held = true; c.tcur = null; tbl.flights.push({ c, from, t0: now, dur: 420, done: () => { c.held = false; land(); } }); }
  tick(10); updateTradeBar(); kick();
}

// ----- the table, with her side -----
function openTable(t, from) {
  if (tbl.on || state.trans) return;
  hideCaption(); cancelPress(); closePop(true);
  tbl.on = true; tbl.t = t; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.flights = []; tbl.shake = null; tbl.drag = null; tbl.pend = null; tbl.pinch = null;
  tbl.their.sx = 0; tbl.their.v = 0; tbl.your.sx = 0; tbl.your.v = 0;
  tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.handed = []; tbl.landing = 0;
  tbl.L = tableLayout();
  tbl.theirs = t.spares.slice().sort((a, b) => (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.yours = cards.filter(isSpare).sort((a, b) => (t.chaseSet.has(b) ? 1 : 0) - (t.chaseSet.has(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.origin = from ? { x: from.x + 11, y: from.y - mScroll + 17, w: 32, h: 32 } : { x: vw / 2 - 18, y: topPad(), w: 36, h: 36 };
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.yours) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = mr(c.m); }
  // A trade in progress with this collector comes back as it was: hers, or yours and waiting.
  const rec = liveTo(t), last = lastTo(t);
  if (rec) {
    tbl.rec = rec;
    tbl.get = byIds(rec.get).filter((c) => tbl.theirs.includes(c)); tbl.give = byIds(rec.give).filter((c) => tbl.yours.includes(c));
    for (const c of [...tbl.get, ...tbl.give]) c.spot = "table";
    tbl.phase = rec.state === "countered" ? "countered" : "waiting";
    if (tbl.phase === "waiting" && !replyTimers.has(rec)) schedule(rec);
  } else if (last?.state === "declined" && last.reply?.reason && !last.reply.byYou) tbl.note = last.reply.reason;
  document.body.classList.add("trading"); setChrome(); updateTradeBar();
  tbl.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 680 };
  if (reduced) tbl.q = 1;
  tick(8); kick();
}
function endTable() {
  const rec = tbl.rec, accepting = tbl.phase === "accepting";
  for (const c of tbl.yours) { c.away = false; c.e = 1; c.spot = "binder"; c.held = false; c.tcur = null; }
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; }
  for (const c of tbl.handed) { c.away = false; c.e = 1; c.handed = false; }
  tbl.on = false; tbl.closing = false; tbl.anim = null; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.handed = []; tbl.phase = "open"; tbl.rec = null; tbl.note = null;
  document.body.classList.remove("trading"); setChrome(); syncWait(); kick();
  if (accepting && rec && rec.state === "accepted") completeTrade(rec);
}
// While she is thinking, the cards sit together on her side of the strip. A counter or a crossing takes them back.
function tableSlot(side, i, n) {
  const S = tbl.L.strip;
  if (tbl.phase === "waiting" && !tbl.shake) {
    const h = Math.round((S.h - 62) * 0.84), w = h * TW / TH, N = tbl.get.length + tbl.give.length, j = side === "their" ? i : tbl.get.length + i;
    const avail = S.w - 2 * PG - 36, step = N > 1 ? Math.min(w + 6, (avail - w) / (N - 1)) : 0, total = w + step * (N - 1);
    return { x: S.x + S.w / 2 - total / 2 + j * step, y: S.y + 18, w, h };
  }
  const h = S.h - 62, w = h * TW / TH, pad = 14, avail = S.w / 2 - pad * 2 - 4;
  const step = n > 1 ? Math.min(w + 6, (avail - w) / (n - 1)) : 0;
  const left = S.x + pad + i * step, right = S.x + S.w - pad - w - i * step;
  let x = side === "their" ? left : right;
  if (tbl.shake) { const k = ease(clamp((performance.now() - tbl.shake.t0) / tbl.shake.dur, 0, 1)); const o = side === "their" ? right : left; x += (o - x) * k; }
  return { x, y: S.y + 30, w, h };
}
function drawPocket(c, r, alpha, label = "On the table") {
  ctx.globalAlpha = alpha;
  rr(r.x, r.y, r.w, r.h, r.w * 0.045); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (r.w < 44) return;
  const pad = r.w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, r.w * 0.088, true); ctx.fillText(fitText(c.name, r.w - pad * 2), r.x + pad, r.y + r.h - pad - r.w * 0.075);
  font(500, r.w * 0.064); ctx.fillText(label, r.x + pad, r.y + r.h - pad);
}
function drawBinder(side, now, alpha, value) {
  const L = tbl.L, R = sideRegion(side), t = tbl.t, list = sideList(side), S = side === "their" ? tbl.their : tbl.your;
  const lit0 = side === "their" ? isChase : (c) => t.chaseSet.has(c), lit = (c) => c.handed || lit0(c), litCol = side === "their" ? theme.deal : theme.gold;
  ctx.globalAlpha = alpha;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  let tx = R.x + 12;
  if (side === "their") { ctx.beginPath(); ctx.arc(R.x + 26, R.y + 22, 14, 0, Math.PI * 2); ctx.fillStyle = t.ink; ctx.fill(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; font(800, 13); ctx.fillText(t.name[0], R.x + 26, R.y + 23); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; tx = R.x + 48; }
  const n = list.length, litN = list.filter(lit0).length;
  ctx.fillStyle = theme.ink; font(800, 17, true); ctx.fillText(fitText(side === "their" ? `${t.name}'s spares` : "Your spares", R.w - 24), tx, R.y + 20);
  ctx.fillStyle = theme.muted; font(500, 12.5);
  ctx.fillText(fitText(side === "their" ? `${t.where}. ${n} spares, ${litN ? `${litN} you chase` : "none you chase"}` : `${n} spares, ${litN ? `${litN} ${t.name} wants` : `none ${t.name}'s after`}`, R.w - 24), tx, R.y + 36);
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y + L.head - 4, R.w, R.h - L.head + 4); ctx.clip();
  const c0 = Math.max(0, Math.floor((S.sx - 12) / (L.cw + L.gap))), c1 = Math.ceil((S.sx + R.w) / (L.cw + L.gap));
  for (let k = c0 * L.rows; k < Math.min(n, (c1 + 1) * L.rows); k++) {
    const c = list[k], r = slotRect(side, k);
    if (c.spot === "table" || c.held) { drawPocket(c, r, alpha * 0.7, c.spot === "table" && tbl.phase === "waiting" ? `With ${t.name}` : c.handed ? (side === "their" ? `${t.name}'s now` : "Yours now") : "On the table"); ctx.globalAlpha = alpha; continue; }
    const on = lit(c);
    ctx.globalAlpha = alpha * (on ? 1 : 0.5);
    cardFace(c, r.x, r.y, r.w, r.h, now, value);
    if (on) { ctx.globalAlpha = alpha; drawRing(r, c.handed ? (side === "their" ? theme.gold : theme.deal) : litCol); }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawStrip(now, alpha) {
  const S = tbl.L.strip, t = tbl.t, waiting = tbl.phase === "waiting", accepting = tbl.phase === "accepting";
  const get = accepting && tbl.rec ? byIds(tbl.rec.get) : tbl.get, give = accepting && tbl.rec ? byIds(tbl.rec.give) : tbl.give; // the totals stay while the cards land
  ctx.globalAlpha = alpha;
  rr(S.x + PG, S.y + 4, S.w - PG * 2, S.h - 8, 12); ctx.fillStyle = felt(); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = tbl.phase === "countered" ? t.ink : theme["slot-line"]; ctx.stroke();
  if (!waiting) ctx.fillRect(S.x + S.w / 2 - 0.5, S.y + 14, 1, S.h - 28);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(`${t.name} gives`, S.x + 14, S.y + 22);
  const gl = textW(`${t.name} gives`);
  ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(get)), S.x + 14 + gl + 8, S.y + 22);
  ctx.textAlign = "right"; ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(give)), S.x + S.w - 14, S.y + 22);
  const yw = textW(money(sumOf(give)));
  ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText("You give", S.x + S.w - 14 - yw - 8, S.y + 22);
  if (waiting) { ctx.globalAlpha = 1; return; } // the waiting line sits here instead
  if (!give.length && !get.length && !tbl.flights.length) {
    ctx.textAlign = "center"; ctx.fillStyle = tbl.note ? theme.ink : theme.muted; font(tbl.note ? 600 : 500, 13);
    ctx.fillText(fitText(tbl.note || "Drag a card from either side onto the table", S.w - 40), S.x + S.w / 2, S.y + S.h / 2 + (tbl.note ? 4 : 10));
    if (tbl.note) { ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText("Put something else on the table and try again", S.x + S.w / 2, S.y + S.h / 2 + 22); }
  } else if (give.length || get.length) {
    const txt = accepting ? `${t.name} accepted` : balanceText(get, give, t);
    font(700, 12); const tw = textW(txt) + 20;
    rr(S.x + S.w / 2 - tw / 2, S.y + S.h - 28, tw, 21, 10.5); ctx.fillStyle = accepting ? theme.deal : theme.ink; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = theme.bg; ctx.fillText(txt, S.x + S.w / 2, S.y + S.h - 13.5);
  }
  ctx.globalAlpha = 1;
}
function drawTable(now) {
  const dt = Math.min(48, now - (tbl.last || now)); tbl.last = now;
  tbl.L = tableLayout();
  let more = false;
  if (tbl.anim) { const a = tbl.anim, p = clamp((now - a.t0) / a.dur, 0, 1); tbl.q = a.from + (a.to - a.from) * ease(p); if (p >= 1) { tbl.anim = null; tbl.q = a.to; if (a.to === 0) { endTable(); return; } } else more = true; }
  const q = tbl.q, value = state.value && !state.matches;
  for (const side of ["their", "your"]) { const S = side === "their" ? tbl.their : tbl.your; S.sx = clamp(S.sx, 0, maxScroll(side)); if (S.v && !tbl.pend) { S.sx = clamp(S.sx - S.v * dt, 0, maxScroll(side)); S.v *= Math.pow(0.95, dt / 16); if (Math.abs(S.v) < 0.02 || S.sx <= 0 || S.sx >= maxScroll(side)) S.v = 0; more = true; } }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = q; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  if (q >= 1) {
    drawBinder("their", now, 1, value); drawBinder("your", now, 1, value); drawStrip(now, 1);
    for (const c of [...tbl.get, ...tbl.give]) {
      if (c.held) continue;
      const tgt = targetRect(c);
      if (!c.tcur) c.tcur = tgt;
      else if (Math.abs(c.tcur.x - tgt.x) > 0.3 || Math.abs(c.tcur.y - tgt.y) > 0.3 || Math.abs(c.tcur.w - tgt.w) > 0.3) { c.tcur = lerpR(c.tcur, tgt, reduced ? 1 : Math.min(1, dt / 70)); more = true; } else c.tcur = tgt;
      ctx.globalAlpha = 1; drawCardAt(c, c.tcur, now, value, 3);
    }
    for (const f of tbl.flights) {
      const p = clamp((now - f.t0) / f.dur, 0, 1), r = lerpR(f.from, targetRect(f.c), ease(p));
      ctx.globalAlpha = 1; drawCardAt(f.c, r, now, value, 4 + 6 * Math.sin(Math.PI * p));
      if (p >= 1) { f.done(); tbl.flights = tbl.flights.filter((x) => x !== f); } else more = true;
    }
    if (tbl.drag) { const d = tbl.drag, r = { x: d.x - d.w * 0.04, y: d.y - d.h * 0.04, w: d.w * 1.08, h: d.h * 1.08 }; ctx.globalAlpha = 1; drawCardAt(d.c, r, now, value, 8); }
    if (tbl.shake) { more = true; if (now - tbl.shake.t0 > tbl.shake.dur + 160) handOver(); }
  } else {
    const a = clamp((q - 0.35) / 0.65, 0, 1);
    if (a > 0) { drawBinder("their", now, a, value); drawBinder("your", now, a, value); drawStrip(now, a); }
    const fly = (list, origin, idx) => {
      const n = list.length;
      list.forEach((c, i) => {
        const k = ease(clamp((q - (i / n) * 0.3) / 0.7, 0, 1));
        const to = c.spot === "table" && c.tcur ? c.tcur : targetRect(c), from = origin(c);
        const r = lerpR(from, to, k);
        if (r.y > vh || r.y + r.h < 0 || r.x > vw || r.x + r.w < 0) return;
        ctx.globalAlpha = Math.max(0.15, k);
        if (idx === "their" || c.handed) drawCardAt(c, r, now, value, 3 * k);
        else drawTile(c, r.x, r.y, r.w, r.h, now, 1);
      });
    };
    fly(tbl.theirs, () => tbl.origin, "their");
    for (const c of tbl.yours) c.e = 1;
    fly(tbl.yours, (c) => c.o, "your");
    for (const c of tbl.yours) c.e = 0;
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 1;
  syncWait();
  if (more || tbl.anim || tbl.pinch) kick();
}
// While she holds the cards, or has countered, the table is hers: binders still scroll, a pinch still closes, but no
// card moves until Counter back hands it to you.
function tDown(pts) {
  if (document.activeElement === qIn) qIn.blur();
  hideCaption();
  if (tbl.closing) { finishTableAnim(); return; }
  if (tbl.anim) finishTableAnim();
  tbl.their.v = 0; tbl.your.v = 0;
  if (pts.length >= 2) return tPinchStart(pts);
  if (tbl.pend || tbl.pinch) return;
  const p = pts[0], now = performance.now(), zone = zoneAt(p.y);
  const S = zone === "their" ? tbl.their : zone === "your" ? tbl.your : null;
  const locked = tbl.shake || tbl.phase !== "open";
  tbl.pend = { x: p.x, y: p.y, t: now, zone, c: locked ? null : cardAt(p.x, p.y), sx0: S ? S.sx : 0, axis: null, samples: [{ x: p.x, y: p.y, t: now }] };
  if (locked && !tbl.shake && zone === "table") { tick(3); toast(tbl.phase === "waiting" ? `${tbl.t.name} has the cards. Withdraw to take them back.` : `${tbl.t.name}'s counter is on the table. Accept it, or Counter back to move cards.`); }
}

// ----- the chip: where the trade stands -----
function drawChip(ch, now, alpha) {
  const t = ch.t, x = ch.x, y = ch.y - mScroll, w = ch.w, h = ch.h;
  if (y > vh || y + h < 0) return;
  const wants = wantsOf(t).length, has = offersOf(t).length, rec = lastTo(t);
  ctx.globalAlpha = alpha;
  rr(x, y, w, h, 12); ctx.fillStyle = theme.panelFill; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = rec?.state === "countered" ? t.ink : theme["slot-line"]; ctx.stroke();
  if (state.press?.chip === ch) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x + 27, y + h / 2, 16, 0, Math.PI * 2); ctx.fillStyle = t.ink; ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; font(800, 15); ctx.fillText(t.name[0], x + 27, y + h / 2 + 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tx = x + 51, tw = w - 51 - 16;
  ctx.fillStyle = theme.ink; font(800, 15, true); ctx.fillText(fitText(t.name, tw), tx, y + 23);
  ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText(fitText(t.where, tw), tx, y + 39);
  font(700, 12, true);
  const st = rec?.state;
  if (st === "proposed") { ctx.fillStyle = theme.muted; ctx.fillText(fitText(`Waiting on ${t.name}`, tw), tx, y + 55); }
  else if (st === "countered") { ctx.fillStyle = theme.gold; ctx.fillText(fitText(`Countered: ${rec.give.length} for ${rec.get.length}`, tw), tx, y + 55); }
  else if (st === "done") { ctx.fillStyle = theme.deal; ctx.fillText(fitText(`Traded ${rec.give.length} for ${rec.get.length}`, tw), tx, y + 55); }
  else if (st === "declined") { ctx.fillStyle = theme.muted; ctx.fillText(fitText(rec.reply?.byYou ? "You passed" : `${t.name} passed`, tw), tx, y + 55); }
  else if (wants) { ctx.fillStyle = theme.gold; ctx.fillText(fitText(`Wants ${wants} of yours`, tw), tx, y + 55); }
  else { ctx.fillStyle = theme.deal; ctx.fillText(fitText(`Has ${has} you chase`, tw), tx, y + 55); }
  ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + w - 14, y + h / 2 - 5); ctx.lineTo(x + w - 9, y + h / 2); ctx.lineTo(x + w - 14, y + h / 2 + 5); ctx.stroke(); ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
}

// ----- the list: the same trade as rows, with Accept and Decline -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") {
    const names = (l) => l.map((c) => c.name).join(", ");
    const open = trades.filter((r) => r.state !== "done" && traderOf(r));
    const rows = open.map((rec) => {
      const t = traderOf(rec), give = byIds(rec.give), get = byIds(rec.get), i = trades.indexOf(rec), bal = give.length && get.length ? balanceText(get, give, t) : "";
      const line = rec.state === "proposed" ? `Waiting on ${t.name}.` : rec.state === "countered" ? `${t.name}'s counter: ${moveText(rec, t).toLowerCase()}.` : rec.state === "accepted" ? `${t.name} accepted.` : rec.reply?.byYou ? `You passed on ${t.name}'s counter.` : rec.reply?.reason || `${t.name} passed.`;
      const acts = rec.state === "proposed" ? `<button type="button" class="pill-btn" data-withdraw="${i}">Withdraw</button>` : rec.state === "countered" ? `<button type="button" class="pill-btn" data-accept="${i}">Accept</button><button type="button" class="pill-btn" data-decline="${i}">Decline</button>` : "";
      return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">You give ${names(give) || "nothing"} (${money(sumOf(give))}). ${t.name} gives ${names(get) || "nothing"} (${money(sumOf(get))}).</span><span class="lprice">${bal}</span><span class="lstate">${line}</span></div>${acts ? `<div class="lacts">${acts}</div>` : ""}</li>`;
    }).join("");
    const done = trades.filter((r) => r.state === "done" && traderOf(r));
    const ts = TRADERS.filter((t) => wantsOf(t).length).sort((a, b) => wantsOf(b).length - wantsOf(a).length);
    top = `${open.length ? `<section><h2>Trades in progress</h2><p class="lsub">What is on the table with each collector.</p><ul>${rows}</ul></section>` : ""}<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase.</p><ul>${ts.map((t) => {
      const want = wantsOf(t), has = offersOf(t), last = lastTo(t), busy = last && (last.state === "proposed" || last.state === "countered");
      return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">Wants ${names(want)} (${money(sumOf(want))}).${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${last?.state === "done" ? `Traded ${last.give.length} for ${last.get.length}` : busy ? "On the table" : ""}</span></div>${has.length && !busy ? `<button type="button" class="pill-btn" data-trade="${t.id}">Propose</button>` : ""}</li>`;
    }).join("")}</ul>${ts.length ? "" : `<p class="lsub">${done.length ? "Nobody wants your spares right now." : "Nobody wants your spares yet."}</p>`}</section>`;
  }
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-accept], [data-decline], [data-withdraw]"); if (!b) return;
  e.stopImmediatePropagation();
  const rec = trades[Number(b.dataset.accept ?? b.dataset.decline ?? b.dataset.withdraw)]; if (!rec) return;
  if (b.dataset.withdraw != null) { withdraw(rec); toast(`Proposal to ${traderOf(rec).name} withdrawn.`); return; }
  if (b.dataset.accept != null) { rec.state = "accepted"; rec.reply = { ...rec.reply, kind: "accept", byYou: true }; persistTrades(); completeTrade(rec); return; }
  rec.state = "declined"; rec.reply = { ...rec.reply, byYou: true }; persistTrades(); drawList(); tick(4); toast(`You passed on ${traderOf(rec).name}'s counter.`);
}, true);
// The list's Propose: the same record shape, and the clock starts.
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-trade]"); if (!b) return;
  e.stopImmediatePropagation();
  const t = TRADERS.find((x) => x.id === b.dataset.trade), want = wantsOf(t), has = offersOf(t);
  if (!want.length || !has.length || liveTo(t)) return;
  const rec = { t: t.id, give: want.map((c) => c.id), get: has.map((c) => c.id), at: Date.now(), state: "proposed", round: 1 };
  trades.push(rec); persistTrades(); schedule(rec); drawList(); tick(12);
  toast(`Proposed to ${t.name}: ${rec.give.length} of yours for ${rec.get.length} of ${t.name}'s. ${balanceText(has, want, t)}.`, () => withdraw(rec));
}, true);

// On load: proposals still waiting get their reply once the wall has inked in; an acceptance cut short completes.
setTimeout(() => {
  for (const rec of trades.slice()) {
    if (!traderOf(rec)) continue;
    if (rec.state === "proposed") schedule(rec, reduced ? 1200 : 3200);
    else if (rec.state === "accepted") completeTrade(rec, `${traderOf(rec).name} accepted. `);
  }
  if (window.__w) Object.defineProperties(window.__w, { trades: { get: () => trades }, replyTo: { value: replyTo }, decide: { value: decide }, openTable: { value: openTable }, seeTable: { value: seeTable }, completeTrade: { value: completeTrade } });
}, 0);
