// ---------- the thread: what happens to a proposed trade ----------
// A trade is a thread, like a Messages conversation or an eBay offer thread. Shake hands sends the offer and the table
// stays up with the cards on it, locked, and the trade bar grows into the thread: "You proposed: Charizard for
// Blastoise and Dratini. Maya's up $0.16." then "Waiting on Maya". Twelve seconds later Maya answers (simulated and
// seeded, the same in every variant this round): she accepts, counters, or declines with a line. A counter moves the
// cards on the table (the dropped one goes home, the one she asks for comes out of your binder) and the bar offers
// Accept and Decline. Accepting completes the trade: the cards cross, then fly to their new homes, yours up into her
// chip and hers down into the wall, where its panel ripples. Declining ends it. A completed trade stays in the thread
// as history ("Traded Oct 5"). The trader's chip reads the state ("Waiting on Maya", "Maya countered", "Traded Oct 5")
// and the list view shows the same thread in rows. Records stay in localStorage "wall-trades" with a state:
// proposed, countered, accepted (the moment the answer lands), declined or done.

// ----- records -----
// { t, give, get, at, state, counter: { give, get } | undefined, replyAt, reason, by, doneAt }
for (const r of trades) if (!r.state) r.state = "proposed"; // a record from before this round
const REPLY_MS = 12000;
const byId = new Map(cards.map((c) => [c.id, c]));
const toCards = (ids) => ids.map((id) => byId.get(id)).filter(Boolean);
const threadOf = (t) => trades.filter((x) => x.t === t.id);
const lastOf = (t) => threadOf(t).pop() || null;
const activeOf = (t) => { const r = lastOf(t); return r && (r.state === "proposed" || r.state === "countered") ? r : null; };
const offerOf = (r) => r.counter || { give: r.give, get: r.get }; // the offer as it stands, as ids
const traderOf = (r) => TRADERS.find((t) => t.id === r.t);
const names = (list) => (list.length <= 1 ? list.map((c) => c.name).join("") : `${list.slice(0, -1).map((c) => c.name).join(", ")} and ${list[list.length - 1].name}`);
const dayOf = (at) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
let quietLayout = false; // a batch of ownership changes: one relayout at the end, not one per card

// A toast can carry an action under any label (the base only knew Undo).
function toast(t, action = null, label = "Undo") {
  toastEl.textContent = t;
  if (action) {
    const b = document.createElement("button"); b.textContent = label; b.className = "toast-btn";
    b.onclick = () => { toastEl.classList.remove("show"); action(); };
    toastEl.append(" ", b);
  }
  toastEl.classList.toggle("act", Boolean(action));
  toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), action ? 4500 : 2200);
}
// setOwned, with one change: inside a batch the lens layout waits for the end.
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now();
  c.owned = on; c.got = on ? Date.now() : null; saved[c.id] = { on, at: c.got }; persist();
  c.anim = { t0: now, to: on };
  const g = groups[c.g];
  g.ripple = { t0: now, col: c.col, row: c.row };
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  if (on && owned === st.cards.length) { if (mode === "set") g.burst = now; tick(40); toast(`${st.name} complete. ${owned} of ${owned}.`, undo); }
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  if (lifted && !quietLayout) liftLayout(true); // a chased card changed hands: the chase layout flies to its new shape
  updateCount(); drawList(); kick();
}

// ----- the other side answers -----
function scheduleReply(rec) { setTimeout(() => deliver(rec), Math.max(1500, rec.at + REPLY_MS - Date.now())); }
for (const r of trades) if (r.state === "proposed") scheduleReply(r); // a proposal from before a reload still gets its answer
// The answer never lands on a moving wall or a moving table: it waits a moment.
function deliver(rec, forced = null) {
  if (rec.state !== "proposed" || !trades.includes(rec)) return;
  const t = traderOf(rec);
  // With the table up only the table's motion matters (a feed arrival can leave a wall morph pending under it).
  const busy = tbl.on ? tbl.anim || tbl.closing || tbl.pinch || tbl.drag || tbl.pend : state.trans || shuffle || gesture;
  if (busy || wel.on) { setTimeout(() => deliver(rec, forced), 600); return; }
  const r = forced === "accept" ? 0 : forced === "counter" ? 0.5 : forced === "decline" ? 0.9 : h32(`${t.id}|${rec.at}|reply`);
  rec.replyAt = Date.now();
  if (r < 0.45) return completeTrade(rec, t, "them");
  if (r < 0.8) { const c = counterFor(rec, t); if (c) return counter(rec, t, c); return completeTrade(rec, t, "them"); }
  decline(rec, t);
}
// A counter shifts the balance toward them by one card: she drops one of hers, or asks for one more of yours she
// chases, whichever the seed picks (the other if that one isn't possible).
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
function counter(rec, t, c) {
  rec.state = "countered"; rec.counter = c; persistTrades();
  const give = toCards(c.give), get = toCards(c.get);
  const here = tbl.on && tbl.t === t && !tbl.closing;
  if (here) { // the cards move on the table: the one she dropped goes home, the one she asks for comes out
    for (const x of tbl.get.slice()) if (!get.includes(x)) place(x, false, curRect(x));
    for (const x of give) if (!tbl.give.includes(x) && tbl.yours.includes(x)) place(x, true, curRect(x));
    tick(10); updateTradeBar();
  }
  toast(`${t.name} countered: ${names(give)} for ${names(get)}.`, here ? null : () => showThread(t), "Open");
  drawList(); kick();
}
function decline(rec, t) {
  rec.state = "declined"; rec.by = "them"; rec.reason = reasonFor(rec, t); persistTrades();
  const here = tbl.on && tbl.t === t;
  if (here) { tick(6); updateTradeBar(); }
  toast(`${t.name} declined: ${rec.reason}`, here ? null : () => showThread(t), "Open");
  drawList(); kick();
}
// Accepted, by them or by you: the trade is done. The cards you gave leave your collection and stop being spares; the
// ones you got arrive, dated now, and leave your chase list. With the table up the cards cross and fly to their new
// homes and the wall's ripple waits for them to land; otherwise the wall floods where it sits.
function completeTrade(rec, t, by) {
  rec.state = "accepted"; rec.by = by; rec.doneAt = Date.now();
  const give = toCards(offerOf(rec).give), get = toCards(offerOf(rec).get);
  const here = tbl.on && tbl.t === t && !tbl.closing;
  const landAt = here && !reduced ? performance.now() + 520 + 160 + 580 : performance.now();
  quietLayout = true;
  for (const c of give) { delete spares[c.id]; if (c.owned) setOwned(c, false, { quiet: true }); if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; }
  for (const c of get) { delete chasing[c.id]; if (!c.owned) setOwned(c, true, { quiet: true }); if (here) c.anim = null; else if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; }
  quietLayout = false;
  try { localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* fine */ }
  persistChase(); syncBadge(); updateCount();
  rec.state = "done"; persistTrades();
  const msg = `${names(get)} ${get.length === 1 ? "is" : "are"} yours. ${names(give)} went to ${t.name}.`;
  toast(by === "them" ? `${t.name} accepted. ${msg}` : `Done. ${msg}`);
  drawList();
  if (here) {
    layoutAll(); // the wall takes its new shape under the table; the close flight carries the cards to it
    tbl.done = { give, get }; tick(24);
    if (reduced) closeTable(); else { tbl.shake = { t0: performance.now(), dur: 520 }; updateTradeBar(); kick(); }
  } else { tick(14); if (lifted) liftLayout(true); kick(); }
}
function acceptCounter(rec) { if (rec.state === "countered") completeTrade(rec, traderOf(rec), "you"); }
function declineCounter(rec) {
  if (rec.state !== "countered") return;
  const t = traderOf(rec);
  rec.state = "declined"; rec.by = "you"; rec.doneAt = Date.now(); persistTrades(); tick(6);
  if (tbl.on && tbl.t === t) updateTradeBar();
  drawList(); kick();
  toast(`Declined. ${t.name} still wants ${wantsOf(t).length} of yours.`);
}
function takeBack(rec) {
  if (rec.state !== "proposed") return;
  const t = traderOf(rec);
  trades = trades.filter((x) => x !== rec); persistTrades(); tick(4);
  if (tbl.on && tbl.t === t) updateTradeBar();
  drawList(); kick();
}
// Open from a toast: the Trade lens first if it isn't up (the table opens from the chip once the lens has flown).
function showThread(t) {
  if (tbl.on && tbl.t === t) return;
  if (tbl.on) closeTable(true);
  if (document.body.classList.contains("listmode") || state.focus || pop.c) return;
  if (state.lens !== "trade") { setLens("trade"); const T = state.trans; if (T) { const d = T.done; T.done = (x) => { d?.(x); showThread(t); }; } return; }
  if (view !== "mosaic" || state.trans) return;
  openTable(t, strip?.chips.find((x) => x.t === t) || null);
}

// ----- the chip reads the state; a trader with a thread stays in the strip -----
function stripLayout(R) {
  const ts = TRADERS.filter((t) => wantsOf(t).length || offersOf(t).length || threadOf(t).length).sort((a, b) => (activeOf(b) ? 1 : 0) - (activeOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length || offersOf(b).length - offersOf(a).length);
  if (!ts.length) { strip = null; return 0; }
  const cols = Math.min(ts.length, R.w >= 700 ? 4 : 2), cw = (R.w - PG * 2 - CHIP_GAP * (cols - 1)) / cols, rows = Math.ceil(ts.length / cols);
  strip = { y: R.y, h: PG + rows * (CHIP_H + CHIP_GAP) - CHIP_GAP + PG, chips: ts.map((t, i) => ({ t, x: R.x + PG + (i % cols) * (cw + CHIP_GAP), y: R.y + PG + Math.floor(i / cols) * (CHIP_H + CHIP_GAP), w: cw, h: CHIP_H })) };
  return strip.h;
}
function chipState(t) {
  const rec = lastOf(t), wants = wantsOf(t).length, has = offersOf(t).length;
  if (rec?.state === "proposed") return { text: `Waiting on ${t.name}`, col: theme.gold };
  if (rec?.state === "countered") return { text: `${t.name} countered`, col: theme.deal, dot: true };
  if (rec?.state === "done") return { text: `Traded ${dayOf(rec.doneAt)}`, col: theme.deal };
  if (wants) return { text: `Wants ${wants} of yours`, col: theme.gold };
  return { text: `Has ${has} you chase`, col: theme.deal };
}
function drawChip(ch, now, alpha) {
  const t = ch.t, x = ch.x, y = ch.y - mScroll, w = ch.w, h = ch.h;
  if (y > vh || y + h < 0) return;
  const s = chipState(t);
  ctx.globalAlpha = alpha;
  rr(x, y, w, h, 12); ctx.fillStyle = theme.panelFill; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = s.dot ? theme.deal : theme["slot-line"]; ctx.stroke();
  if (state.press?.chip === ch) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x + 27, y + h / 2, 16, 0, Math.PI * 2); ctx.fillStyle = t.ink; ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; font(800, 15); ctx.fillText(t.name[0], x + 27, y + h / 2 + 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tx = x + 51, tw = w - 51 - 16;
  ctx.fillStyle = theme.ink; font(800, 15, true); ctx.fillText(fitText(t.name, tw), tx, y + 23);
  ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText(fitText(t.where, tw), tx, y + 39);
  font(700, 12, true); ctx.fillStyle = s.col; ctx.fillText(fitText(s.text, tw), tx, y + 55);
  if (s.dot) { ctx.beginPath(); ctx.arc(x + 39, y + h / 2 - 11, 4.5, 0, Math.PI * 2); ctx.fillStyle = theme.deal; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = theme.panelFill; ctx.stroke(); } // something to answer
  ctx.strokeStyle = theme.muted; ctx.lineWidth = 1.6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x + w - 14, y + h / 2 - 5); ctx.lineTo(x + w - 9, y + h / 2); ctx.lineTo(x + w - 14, y + h / 2 + 5); ctx.stroke(); ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
}

// ----- the thread in the trade bar -----
const tradebarEl = document.getElementById("tradebar"), threadEl = document.createElement("div"), tbRow = document.createElement("div");
threadEl.className = "thread"; threadEl.id = "thread"; threadEl.setAttribute("aria-live", "polite"); threadEl.setAttribute("aria-label", "The thread");
tbRow.className = "tb-row"; while (tradebarEl.firstChild) tbRow.append(tradebarEl.firstChild);
tradebarEl.append(threadEl, tbRow);
const tbMake = (id, text, cls) => { const b = document.createElement("button"); b.type = "button"; b.id = id; b.className = `mbtn${cls ? ` ${cls}` : ""}`; b.textContent = text; b.hidden = true; tbRow.append(b); return b; };
const tbTake = tbMake("tb-take", "Take back", ""), tbDec = tbMake("tb-dec", "Decline", ""), tbAcc = tbMake("tb-acc", "Accept", "primary");
tbTake.onclick = () => { const r = tbl.t && activeOf(tbl.t); if (r) takeBack(r); };
tbDec.onclick = () => { const r = tbl.t && activeOf(tbl.t); if (r) declineCounter(r); };
tbAcc.onclick = () => { const r = tbl.t && activeOf(tbl.t); if (r) acceptCounter(r); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// The rows of one record, top to bottom.
function rowsOf(rec, t) {
  const o = { give: toCards(rec.give), get: toCards(rec.get) }, rows = [];
  rows.push({ who: "you", lead: "You proposed", text: `${names(o.give)} for ${names(o.get)}. ${balanceText(o.get, o.give, t)}.`, at: rec.at });
  if (rec.counter) { const c = { give: toCards(rec.counter.give), get: toCards(rec.counter.get) }; rows.push({ who: "them", lead: `${t.name} countered`, text: `${names(c.give)} for ${names(c.get)}. ${balanceText(c.get, c.give, t)}.`, at: rec.replyAt }); }
  if (rec.state === "declined") rows.push(rec.by === "you" ? { who: "you", lead: "You declined", text: "", at: rec.doneAt } : { who: "them", lead: `${t.name} declined`, text: rec.reason || "", at: rec.replyAt });
  if (rec.state === "done" || rec.state === "accepted") { rows.push(rec.by === "you" ? { who: "you", lead: "You accepted", text: "", at: rec.doneAt } : { who: "them", lead: `${t.name} accepted`, text: "", at: rec.replyAt }); rows.push({ who: "sys", lead: "", text: `Traded ${dayOf(rec.doneAt)}.`, at: null }); }
  if (rec.state === "proposed") rows.push({ who: "wait", lead: "", text: `Waiting on ${t.name}`, at: null });
  return rows;
}
function rowHTML(r, t, now, tag = "div") {
  const lead = r.lead ? `<b>${r.who === "them" ? r.lead.replace(t.name, `<i class="tn" style="color:${t.ink}">${t.name}</i>`) : esc(r.lead)}${r.text ? ":" : "."}</b> ` : "";
  const fresh = r.at && now - r.at < 2500 ? " new" : "";
  return `<${tag} class="trow ${r.who}${fresh}">${r.who === "wait" ? `<i class="tdot" aria-hidden="true"></i>` : ""}<span class="tt">${lead}${esc(r.text)}</span>${r.at ? `<time>${agoText(r.at, now)}</time>` : ""}</${tag}>`;
}
let threadKey = "";
function renderThread(t) {
  const recs = threadOf(t), key = `${t.id}|${recs.map((r) => `${r.at}:${r.state}:${r.replyAt || 0}`).join(",")}`;
  if (key === threadKey) return;
  threadKey = key;
  const now = Date.now();
  threadEl.innerHTML = recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now)).join("")).join("");
  threadEl.scrollTop = threadEl.scrollHeight;
}
function updateTradeBar() {
  const t = tbl.t; if (!t) return;
  renderThread(t);
  const rec = activeOf(t), give = tbl.give.length, get = tbl.get.length;
  tbGo.hidden = Boolean(rec || tbl.done); tbTake.hidden = rec?.state !== "proposed"; tbDec.hidden = tbAcc.hidden = rec?.state !== "countered";
  if (tbl.done) { // the cards are crossing: it's done
    const got = tbl.done.get;
    tbHead.textContent = `Traded with ${t.name}`; tbSub.textContent = `${names(got)} ${got.length === 1 ? "is" : "are"} yours`;
    return;
  }
  if (rec) {
    const o = offerOf(rec), og = toCards(o.give), ot = toCards(o.get);
    tbHead.textContent = balanceText(ot, og, t);
    tbSub.textContent = `${og.length} of yours for ${ot.length} of ${t.name}'s${rec.state === "proposed" ? ", on the table" : ""}`;
    return;
  }
  if (!give && !get) { tbHead.textContent = `Trade with ${t.name}`; tbSub.textContent = "Drag a card from either side onto the table"; }
  else if (give && get) { tbHead.textContent = balanceText(tbl.get, tbl.give, t); tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s`; }
  else if (get) { tbHead.textContent = `${get} of ${t.name}'s on the table`; tbSub.textContent = "Add one of yours to make it a trade"; }
  else { tbHead.textContent = `${give} of yours on the table`; tbSub.textContent = `Add one of ${t.name}'s to make it a trade`; }
  tbGo.disabled = !(give && get) || Boolean(tbl.shake);
}
// Shake hands sends the offer. The table stays up with the cards on it, locked, until the answer comes.
function shake() {
  if (!tbl.on || !tbl.give.length || !tbl.get.length || tbl.shake || activeOf(tbl.t)) return;
  const t = tbl.t, rec = { t: t.id, give: tbl.give.map((c) => c.id), get: tbl.get.map((c) => c.id), at: Date.now(), state: "proposed" };
  trades.push(rec); persistTrades(); scheduleReply(rec); tick(24);
  toast(`Proposed to ${t.name}: ${rec.give.length} of yours for ${rec.get.length} of ${t.name}'s. ${balanceText(tbl.get, tbl.give, t)}.`, () => takeBack(rec));
  drawList(); updateTradeBar(); kick();
}

// ----- the table: the bar's height is the table's floor; an offer out locks the cards; done swaps the sides -----
const barH = () => tradebarEl.offsetHeight + 26;
function tableLayout() {
  const want = barH();
  if (tbl.botH == null || reduced) tbl.botH = want; else if (Math.abs(tbl.botH - want) > 0.5) { tbl.botH += (want - tbl.botH) * 0.2; kick(); } else tbl.botH = want;
  const top = topPad(), bot = vh - tbl.botH, W = Math.min(vw, 980), X = (vw - W) / 2;
  const sh = clamp(Math.round(vh * 0.15), 108, 136), bh = (bot - top - sh) / 2, head = 46, gap = 8;
  let rows = 3, ch = Math.floor((bh - head - 12 - gap * (rows - 1)) / rows);
  if (ch * TW / TH < 62) { rows = 2; ch = Math.floor((bh - head - 12 - gap) / 2); }
  ch = Math.min(ch, 122);
  const cw = Math.round(ch * TW / TH);
  return { X, W, top, bot, their: { x: X, y: top, w: W, h: bh }, strip: { x: X, y: top + bh, w: W, h: sh }, your: { x: X, y: top + bh + sh, w: W, h: bh }, rows, cw, ch, gap, head };
}
function cardAt(x, y) {
  if (tbl.t && activeOf(tbl.t)) return null; // the offer is out: nothing moves until the answer comes
  for (const c of [...tbl.get, ...tbl.give]) { const r = c.tcur; if (r && !c.held && x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4) return c; }
  const zone = zoneAt(y); if (zone === "table") return null;
  const L = tbl.L, R = sideRegion(zone), S = zone === "their" ? tbl.their : tbl.your, list = sideList(zone);
  const lx = x - R.x - 12 + S.sx, ly = y - R.y - L.head;
  if (lx < 0 || ly < 0) return null;
  const col = Math.floor(lx / (L.cw + L.gap)), row = Math.floor(ly / (L.ch + L.gap));
  if (row >= L.rows || lx - col * (L.cw + L.gap) > L.cw || ly - row * (L.ch + L.gap) > L.ch) return null;
  const c = list[col * L.rows + row];
  return c && c.spot !== "table" && !c.held ? c : null;
}
function openTable(t, from) {
  if (tbl.on || state.trans) return;
  hideCaption(); cancelPress(); closePop(true);
  tbl.on = true; tbl.t = t; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.flights = []; tbl.shake = null; tbl.drag = null; tbl.pend = null; tbl.pinch = null; tbl.done = null;
  tbl.their.sx = 0; tbl.their.v = 0; tbl.your.sx = 0; tbl.your.v = 0;
  threadKey = ""; renderThread(t); tbl.botH = null; // the thread's height first, so the table fits under it from the start
  tbl.L = tableLayout();
  tbl.theirs = t.spares.slice().sort((a, b) => (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.yours = cards.filter(isSpare).sort((a, b) => (t.chaseSet.has(b) ? 1 : 0) - (t.chaseSet.has(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.origin = from ? { x: from.x + 11, y: from.y - mScroll + 17, w: 32, h: 32 } : { x: vw / 2 - 18, y: topPad(), w: 36, h: 36 };
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; }
  for (const c of tbl.yours) { c.spot = "binder"; c.held = false; c.tcur = null; c.away = true; c.e = 0; c.o = mr(c.m); }
  const rec = activeOf(t);
  if (rec) { // the offer that's out is already on the table
    const o = offerOf(rec);
    for (const c of toCards(o.get)) if (tbl.theirs.includes(c)) { c.spot = "table"; tbl.get.push(c); }
    for (const c of toCards(o.give)) { if (!tbl.yours.includes(c)) { tbl.yours.push(c); c.held = false; c.tcur = null; c.away = true; c.e = 0; c.o = mr(c.m); } c.spot = "table"; tbl.give.push(c); }
  }
  document.body.classList.add("trading"); setChrome(); updateTradeBar();
  tbl.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 680 };
  if (reduced) tbl.q = 1;
  tick(8); kick();
}
// Done: what you gave is theirs now and leaves with their cards; what you got is yours and flies to its place on the wall.
function swapSides() {
  const { give, get } = tbl.done; tbl.done = null;
  for (const c of give) { const i = tbl.yours.indexOf(c); if (i >= 0) tbl.yours.splice(i, 1); if (!tbl.theirs.includes(c)) tbl.theirs.push(c); }
  for (const c of get) { const i = tbl.theirs.indexOf(c); if (i >= 0) tbl.theirs.splice(i, 1); if (!tbl.yours.includes(c)) tbl.yours.push(c); c.away = true; c.e = 0; c.o = mr(c.m); }
}
function closeTable(instant = false) {
  if (!tbl.on || tbl.closing) return;
  if (tbl.done) swapSides();
  if (tbl.drag) { tbl.drag.c.held = false; tbl.drag = null; }
  tbl.pend = null; tbl.pinch = null; tbl.flights = []; tbl.shake = null; tbl.their.v = 0; tbl.your.v = 0;
  for (const c of [...tbl.get, ...tbl.give]) c.held = false;
  tbl.closing = true;
  if (instant || reduced) { tbl.q = 0; tbl.anim = null; endTable(); return; }
  tbl.anim = { from: tbl.q, to: 0, t0: performance.now(), dur: 180 + 400 * tbl.q };
  tick(6); kick();
}
function endTable() {
  for (const c of tbl.yours) { c.away = false; c.e = 1; c.spot = "binder"; c.held = false; c.tcur = null; }
  for (const c of tbl.theirs) { c.away = false; c.spot = "binder"; c.held = false; c.tcur = null; }
  tbl.on = false; tbl.closing = false; tbl.anim = null; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.done = null;
  document.body.classList.remove("trading"); setChrome(); kick();
}

// ----- the list: the same thread in rows -----
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
    const now = Date.now();
    const ts = TRADERS.filter((t) => wantsOf(t).length || threadOf(t).length).sort((a, b) => (activeOf(b) ? 1 : 0) - (activeOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length);
    top = `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase. Each trade is a thread.</p><ul>${ts.map((t) => {
      const want = wantsOf(t), has = offersOf(t), rec = activeOf(t), recs = threadOf(t);
      const thread = recs.length ? `<ul class="lthread">${recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now, "li")).join("")).join("")}</ul>` : "";
      const acts = rec?.state === "proposed" ? `<button type="button" class="pill-btn" data-back="${r2(rec)}">Take back</button>`
        : rec?.state === "countered" ? `<button type="button" class="pill-btn primary" data-accept="${r2(rec)}">Accept</button><button type="button" class="pill-btn" data-decline="${r2(rec)}">Decline</button>`
        : want.length && has.length ? `<button type="button" class="pill-btn" data-propose="${t.id}">Propose ${want.length} for ${has.length}</button>` : "";
      return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">${want.length ? `Wants ${names(want)} (${money(sumOf(want))}).` : "Wants nothing of yours right now."}${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length && want.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${chipState(t).text}</span>${thread}${acts ? `<div class="lacts">${acts}</div>` : ""}</div></li>`;
    }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
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
const r2 = (rec) => `${rec.t}|${rec.at}`; // a record's handle in the list's markup
const recOf = (h) => trades.find((r) => r2(r) === h) || null;
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-propose], [data-accept], [data-decline], [data-back]"); if (!b) return;
  if (b.dataset.propose) {
    const t = TRADERS.find((x) => x.id === b.dataset.propose), want = wantsOf(t), has = offersOf(t);
    if (!want.length || !has.length || activeOf(t)) return;
    const rec = { t: t.id, give: want.map((c) => c.id), get: has.map((c) => c.id), at: Date.now(), state: "proposed" };
    trades.push(rec); persistTrades(); scheduleReply(rec); drawList(); tick(12);
    toast(`Proposed to ${t.name}: ${rec.give.length} of yours for ${rec.get.length} of ${t.name}'s. ${balanceText(has, want, t)}.`, () => takeBack(rec));
    return;
  }
  const rec = recOf(b.dataset.accept || b.dataset.decline || b.dataset.back); if (!rec) return;
  if (b.dataset.accept) acceptCounter(rec); else if (b.dataset.decline) declineCounter(rec); else takeBack(rec);
});
// Debug builds only: the tests' hook learns about the thread.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { trades: { get: () => trades }, deliver: { value: deliver }, place: { value: place }, openTable: { value: openTable }, curRect: { value: curRect }, activeOf: { value: activeOf }, shake: { value: shake } }); }, 0);
