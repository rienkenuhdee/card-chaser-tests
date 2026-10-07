// ---------- trade: the table, your spares meeting someone else's wants ----------
// The Trade room (94-trade-room.js, round 21) lists the traders: each one wants something of yours, or has something
// you chase. Tap a trader (or a pocket in the trade binder, 78-trade-binder.js) and the screen becomes a table between you:
// their spares along the top (the ones you chase lit green), yours along the bottom (the ones they chase lit gold),
// and the table between. Drag a card from either side onto the table and it stays there; the strip keeps both
// totals and the balance. Shake hands sends the offer: the cards gather in the trader's hands and the trade bar grows
// into the thread ("You proposed: Charizard for Blastoise and Dratini. Maya's up $0.16." then "Waiting on Maya").
// The other side answers in 76-reply.js: a counter moves one card on the table, an acceptance crosses the cards and
// hands them over, a decline is one line. The Trade room's row reads the state and the list shows the same thread. Back, Escape
// or a pinch returns to the wall with every card flying home. While the table is up it owns every touch on the canvas.

// ----- other collectors (made up, seeded by name) -----
const TRADERS = [{ id: "maya", name: "Maya", where: "Sacramento" }, { id: "theo", name: "Theo", where: "Oakland" }, { id: "jun", name: "Jun", where: "Reno" }, { id: "priya", name: "Priya", where: "Davis" }];
const tOwns = (t, c) => h32(`${t.id}|o|${c.id}`) < 0.45;
const tSpare = (t, c) => tOwns(t, c) && h32(`${t.id}|s|${c.id}`) < 0.14;
const tChase = (t, c) => !tOwns(t, c) && h32(`${t.id}|c|${c.id}`) < 0.16;
const T_INKS = Object.values(SET_INK);
for (const t of TRADERS) {
  t.ink = T_INKS[Math.floor(h32(`${t.id}|k`) * T_INKS.length)];
  t.spares = cards.filter((c) => tSpare(t, c)); // what they have spare
  t.chases = cards.filter((c) => tChase(t, c)); // what they are after
  t.chaseSet = new Set(t.chases);
}
const wantsOf = (t) => t.chases.filter(isSpare); // your spares they chase
const offersOf = (t) => t.spares.filter(isChase); // their spares you chase
const wantedBy = (c) => TRADERS.filter((t) => t.chaseSet.has(c));
const sumOf = (list) => list.reduce((a, c) => a + c.price, 0);

// ----- records: a trade is a thread -----
// { t, at, state, give, get, log: [{ by, kind, give, get, at, reason }], doneAt, by, reason }
// give and get are the offer as it stands (card ids); the log is every turn of the thread, oldest first. A state is
// proposed (waiting on them), countered (waiting on you), accepted (the cards are crossing), done or declined.
let trades = [];
try { trades = JSON.parse(localStorage.getItem("wall-trades") || "[]") || []; } catch { trades = []; }
for (const r of trades) { if (!r.state) r.state = "proposed"; if (!r.log) r.log = [{ by: "you", kind: "offer", give: r.give, get: r.get, at: r.at }]; } // records from before the thread
const persistTrades = () => { try { localStorage.setItem("wall-trades", JSON.stringify(trades)); } catch { /* private mode */ } };
const byId = new Map(cards.map((c) => [c.id, c]));
const toCards = (ids) => (ids || []).map((id) => byId.get(id)).filter(Boolean);
const threadOf = (t) => trades.filter((x) => x.t === t.id);
const lastOf = (t) => threadOf(t).pop() || null;
const activeOf = (t) => { const r = lastOf(t); return r && (r.state === "proposed" || r.state === "countered") ? r : null; };
const traderOf = (r) => TRADERS.find((t) => t.id === r.t);
const names = (list) => (list.length <= 1 ? list.map((c) => c.name).join("") : `${list.slice(0, -1).map((c) => c.name).join(", ")} and ${list[list.length - 1].name}`);
const dayOf = (at) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const balanceText = (get, give, t) => { const d = sumOf(get) - sumOf(give); return Math.abs(d) < 0.005 ? "An even trade" : d > 0 ? `You're up ${money(d)}` : `${t.name}'s up ${money(-d)}`; };
// What a counter changed against the offer before it: "Left out Dratini" or "Asked for your Mew ex too".
function moveText(rec, t) {
  const n = rec.log.length, cur = rec.log[n - 1], prev = rec.log[n - 2];
  if (!prev || cur.kind !== "counter") return `${t.name}'s counter`;
  const out = toCards(prev.get.filter((id) => !cur.get.includes(id))), more = toCards(cur.give.filter((id) => !prev.give.includes(id)));
  if (out.length) return `Left out ${names(out)}`;
  if (more.length) return `Asked for your ${names(more)} too`;
  return `${t.name}'s counter`;
}

// ----- your spares, most wanted first (how many traders chase it), then the dearest: the trade binder's order -----
const spareOrder = (a, b) => wantedBy(rootOf(b)).length - wantedBy(rootOf(a)).length || b.price - a.price || a.i - b.i;
// A trader's line in the Trade room (and the list): where the thread stands, else what they want.
function chipState(t) {
  const rec = lastOf(t), wants = wantsOf(t).length, has = offersOf(t).length;
  if (rec?.state === "proposed") return { text: `Waiting on ${t.name}`, col: theme.gold };
  if (rec?.state === "countered") return { text: `${t.name} countered`, col: theme.deal, dot: true };
  if (rec?.state === "done" || rec?.state === "accepted") return { text: `Traded ${dayOf(rec.doneAt || Date.now())}`, col: theme.deal };
  if (wants) return { text: `Wants ${wants} of yours`, col: theme.gold };
  return { text: `Has ${has} you chase`, col: theme.deal };
}
let foilOff = false; // no foil on the mini cards on the table, in the binder or on the map

// ----- chrome: Back stays while the table is up; the trade bar takes the lens bar's place and carries the thread -----
const tradebarEl = document.getElementById("tradebar"), threadEl = document.getElementById("thread");
const tbHead = document.getElementById("tb-head"), tbSub = document.getElementById("tb-sub"), tbGo = document.getElementById("tb-go");
const tbTake = document.getElementById("tb-take"), tbDec = document.getElementById("tb-dec"), tbAlt = document.getElementById("tb-alt");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// The rows of one record, top to bottom.
function rowsOf(rec, t) {
  const rows = [];
  for (const e of rec.log) {
    const you = e.by === "you";
    if (e.kind === "offer" || e.kind === "counter") { const g = toCards(e.give), k = toCards(e.get); rows.push({ who: you ? "you" : "them", lead: you ? (e.kind === "offer" ? "You proposed" : "You countered") : `${t.name} countered`, text: `${names(g)} for ${names(k)}. ${balanceText(k, g, t)}.`, at: e.at }); }
    else if (e.kind === "accept") rows.push({ who: you ? "you" : "them", lead: you ? "You accepted" : `${t.name} accepted`, text: "", at: e.at });
    else if (e.kind === "decline") rows.push({ who: you ? "you" : "them", lead: you ? "You declined" : `${t.name} declined`, text: you ? "" : e.reason || "", at: e.at });
  }
  if (rec.state === "done" || rec.state === "accepted") rows.push({ who: "sys", lead: "", text: `Traded ${dayOf(rec.doneAt || Date.now())}.`, at: null });
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
  const recs = threadOf(t), key = `${t.id}|${recs.map((r) => `${r.at}:${r.state}:${r.log.length}`).join(",")}`;
  if (key === threadKey) return;
  threadKey = key;
  const now = Date.now();
  threadEl.innerHTML = recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now)).join("")).join("");
  threadEl.scrollTop = threadEl.scrollHeight;
}
function updateTradeBar() {
  const t = tbl.t; if (!t) return;
  renderThread(t);
  const ph = tbl.phase, give = tbl.give.length, get = tbl.get.length, bal = give && get ? balanceText(tbl.get, tbl.give, t) : "";
  tbGo.hidden = false; tbGo.disabled = false; tbGo.textContent = "Shake hands"; tbTake.hidden = tbDec.hidden = tbAlt.hidden = true;
  tradebarEl.classList.toggle("three", ph === "countered");
  if (ph === "waiting") { tbHead.textContent = `Waiting on ${t.name}`; tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s. ${bal}`; tbGo.hidden = true; tbTake.hidden = false; }
  else if (ph === "countered") { tbHead.textContent = `${t.name} countered`; tbSub.textContent = `${tbl.rec ? moveText(tbl.rec, t) : ""}. ${bal}`; tbGo.textContent = "Accept"; tbDec.hidden = false; tbAlt.hidden = false; }
  else if (ph === "accepting") { const got = tbl.done ? tbl.done.get : tbl.get; tbHead.textContent = `Traded with ${t.name}`; tbSub.textContent = `${names(got)} ${got.length === 1 ? "is" : "are"} yours`; tbGo.hidden = true; }
  else if (!give && !get && tbl.note) { tbHead.textContent = `${t.name} declined`; tbSub.textContent = tbl.note; tbGo.disabled = true; }
  else if (!give && !get) { tbHead.textContent = `Trade with ${t.name}`; tbSub.textContent = "Drag a card from either side onto the table"; tbGo.disabled = true; }
  else if (give && get) { tbHead.textContent = bal; tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s${tbl.rec ? ". Shake hands sends your counter" : ""}`; tbGo.disabled = Boolean(tbl.shake); }
  else if (get) { tbHead.textContent = `${get} of ${t.name}'s on the table`; tbSub.textContent = "Add one of yours to make it a trade"; tbGo.disabled = true; }
  else { tbHead.textContent = `${give} of yours on the table`; tbSub.textContent = `Add one of ${t.name}'s to make it a trade`; tbGo.disabled = true; }
}
tbGo.onclick = () => { if (tbl.phase === "countered" && tbl.rec) acceptCounter(tbl.rec); else shake(); };
tbTake.onclick = () => { if (tbl.rec) takeBack(tbl.rec); };
tbDec.onclick = () => { if (tbl.rec) declineCounter(tbl.rec); };
tbAlt.onclick = () => counterBack();
// Counter back: the table is yours again. Shake hands then sends your counter and the clock restarts.
function counterBack() {
  if (!tbl.on || tbl.phase !== "countered") return;
  setPhase("open"); tick(4);
  toast(`The table is yours. Move cards, then shake hands to send ${tbl.t.name} your counter.`);
}
function setPhase(ph) { tbl.phase = ph; updateTradeBar(); kick(); }

// ----- the table -----
// phase: open (the cards are yours to move), waiting (the offer is out, the cards sit in their hands), countered (their
// counter is on the table: Accept, Decline or Counter back), accepting (the cards are crossing and changing hands).
const tbl = { on: false, t: null, q: 0, anim: null, pinch: null, pend: null, drag: null, give: [], get: [], theirs: [], yours: [], their: { sx: 0, v: 0 }, your: { sx: 0, v: 0 }, flights: [], shake: null, origin: null, L: null, last: 0, phase: "open", rec: null, note: null, handed: [], landing: 0, botH: null, settled: false };
const tableMoving = () => Boolean(tbl.drag || tbl.flights.length || tbl.anim || tbl.pinch || tbl.shake || tbl.their.v || tbl.your.v);
const sideOf = (c) => (tbl.theirs.includes(c) ? "their" : "your");
const onTable = (t) => tbl.on && tbl.t === t && !tbl.closing;
// The bar's height is the table's floor: as the thread grows the binders make room, eased.
const barH = () => tradebarEl.offsetHeight + 26;
function tableLayout() {
  const want = barH();
  if (tbl.botH == null || reduced) tbl.botH = want; else if (Math.abs(tbl.botH - want) > 0.5) { tbl.botH += (want - tbl.botH) * 0.2; kick(); } else tbl.botH = want;
  if (landPhone()) return tableAcross();
  const top = topPad(), bot = vh - tbl.botH, W = Math.min(vw, 980), X = (vw - W) / 2;
  const sh = clamp(Math.round(vh * 0.15), 108, 136), bh = (bot - top - sh) / 2, head = 46, gap = 8;
  let rows = 3, ch = Math.floor((bh - head - 12 - gap * (rows - 1)) / rows);
  if (ch * TW / TH < 62) { rows = 2; ch = Math.floor((bh - head - 12 - gap) / 2); }
  ch = Math.min(ch, 122);
  const cw = Math.round(ch * TW / TH);
  return { X, W, top, bot, their: { x: X, y: top, w: W, h: bh }, strip: { x: X, y: top + bh, w: W, h: sh }, your: { x: X, y: top + bh + sh, w: W, h: bh }, rows, cw, ch, gap, head };
}
// On a phone on its side (round 22) the table runs across: their spares in a column at the left (under Back), the
// table in the middle with the trade bar under it, yours in a column at the right. The binders scroll down instead
// of along, and a card comes out of one sideways, toward the table. rows is then how many cards sit side by side.
let tblVars = "";
function tableAcross() {
  const X0 = SAFE.left + 10, X1 = vw - SAFE.right - 10, W = X1 - X0, gap = 8;
  const colW = Math.round(clamp(W * 0.28, 190, 290)), midW = W - colW * 2 - gap * 2, head = 46, per = colW >= 228 ? 3 : 2;
  const top = SAFE.top + 10, bottom = vh - SAFE.bottom - 10, bot = vh - tbl.botH;
  const cw = Math.floor((colW - 24 - gap * (per - 1)) / per), ch = Math.round(cw * TH / TW);
  const their = { x: X0, y: topPad(), w: colW, h: bottom - topPad() }, strip = { x: X0 + colW + gap, y: top, w: midW, h: bot - top }, your = { x: X1 - colW, y: top, w: colW, h: bottom - top };
  const vars = `${Math.round(midW)}|${Math.round(strip.x + midW / 2)}`;
  if (vars !== tblVars) { tblVars = vars; document.body.style.setProperty("--tbl-mid-w", `${Math.round(midW)}px`); document.body.style.setProperty("--tbl-mid-x", `${Math.round(strip.x + midW / 2)}px`); }
  return { across: true, X: X0, W, top, bot, their, strip, your, rows: per, cw, ch, gap, head };
}
const sideRegion = (side) => (side === "their" ? tbl.L.their : tbl.L.your);
const sideList = (side) => (side === "their" ? tbl.theirs : tbl.yours);
const maxScroll = (side) => { const L = tbl.L, n = sideList(side).length, cols = Math.ceil(n / L.rows); if (L.across) { const R = sideRegion(side); return Math.max(0, cols * (L.ch + L.gap) - L.gap - (R.h - L.head - 12)); } return Math.max(0, cols * (L.cw + L.gap) - L.gap - (L.W - 24)); };
function slotRect(side, k) {
  const L = tbl.L, R = sideRegion(side), S = side === "their" ? tbl.their : tbl.your;
  if (L.across) { const col = k % L.rows, row = Math.floor(k / L.rows); return { x: R.x + 12 + col * (L.cw + L.gap), y: R.y + L.head + row * (L.ch + L.gap) - S.sx, w: L.cw, h: L.ch }; }
  const col = Math.floor(k / L.rows), row = k % L.rows;
  return { x: R.x + 12 + col * (L.cw + L.gap) - S.sx, y: R.y + L.head + row * (L.ch + L.gap), w: L.cw, h: L.ch };
}
// Where a card sits on the table: theirs fan in from the left, yours from the right. While the offer is out they
// gather in one row on the trader's side, in their hands. A handshake crosses them over.
function tableSlot(side, i, n) {
  const S = tbl.L.strip;
  const across = tbl.L.across, cap = Math.min(S.h * 0.4, ((S.w / 2 - 34) * TH) / TW); // across: the table is tall, its cards no taller than they'd be on a phone held up
  if (tbl.phase === "waiting" && !tbl.shake) {
    const h = across ? cap : Math.round((S.h - 62) * 0.84), w = h * TW / TH, N = tbl.get.length + tbl.give.length, j = side === "their" ? i : tbl.get.length + i;
    const avail = S.w - 2 * PG - 36, step = N > 1 ? Math.min(w + 6, (avail - w) / (N - 1)) : 0, total = w + step * (N - 1);
    return { x: S.x + S.w / 2 - total / 2 + j * step, y: across ? S.y + (S.h - h) / 2 : S.y + 18, w, h };
  }
  const h = across ? cap : S.h - 62, w = h * TW / TH, pad = 14, avail = S.w / 2 - pad * 2 - 4;
  const step = n > 1 ? Math.min(w + 6, (avail - w) / (n - 1)) : 0;
  const left = S.x + pad + i * step, right = S.x + S.w - pad - w - i * step;
  let x = side === "their" ? left : right;
  if (tbl.shake) { const k = ease(clamp((performance.now() - tbl.shake.t0) / tbl.shake.dur, 0, 1)); const o = side === "their" ? right : left; x += (o - x) * k; }
  return { x, y: across ? S.y + (S.h - h) / 2 : S.y + 30, w, h };
}
function targetRect(c) {
  const side = sideOf(c);
  if (c.spot === "table") { const list = side === "their" ? tbl.get : tbl.give; return tableSlot(side, list.indexOf(c), list.length); }
  return slotRect(side, sideList(side).indexOf(c));
}
const curRect = (c) => (tbl.drag?.c === c ? { x: tbl.drag.x, y: tbl.drag.y, w: tbl.drag.w, h: tbl.drag.h } : c.spot === "table" && c.tcur ? { ...c.tcur } : targetRect(c));
const zoneAt = (y, x = 0) => { const L = tbl.L; if (L.across) return x < L.strip.x ? "their" : x < L.strip.x + L.strip.w ? "table" : "your"; return y < L.strip.y ? "their" : y < L.strip.y + L.strip.h ? "table" : "your"; };
function cardAt(x, y) {
  if (tbl.phase !== "open") return null; // the offer is out, or their counter is on the table: nothing moves
  for (const c of [...tbl.get, ...tbl.give]) { const r = c.tcur; if (r && !c.held && x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4) return c; }
  const zone = zoneAt(y, x); if (zone === "table") return null;
  const L = tbl.L, R = sideRegion(zone), S = zone === "their" ? tbl.their : tbl.your, list = sideList(zone);
  if (L.across && y < R.y + L.head - 4) return null;
  const lx = x - R.x - 12 + (L.across ? 0 : S.sx), ly = y - R.y - L.head + (L.across ? S.sx : 0);
  if (lx < 0 || ly < 0) return null;
  const col = Math.floor(lx / (L.cw + L.gap)), row = Math.floor(ly / (L.ch + L.gap));
  if ((L.across ? col : row) >= L.rows || lx - col * (L.cw + L.gap) > L.cw || ly - row * (L.ch + L.gap) > L.ch) return null;
  const c = list[L.across ? row * L.rows + col : col * L.rows + row];
  return c && c.spot !== "table" && !c.held ? c : null;
}
// Starting a trade: in person (the table) or online (coming soon). A thread already open skips the question.
const howEl = document.getElementById("trade-how"), howHead = document.getElementById("th-head");
let howPend = null;
function startTrade(t, from) {
  if (tbl.on || state.trans) return;
  if (activeOf(t) || lastOf(t)) { openTable(t, from); return; }
  howPend = { t, from }; howHead.textContent = `Trade with ${t.name}`; howEl.hidden = false; tick(4);
  howEl.querySelector('[data-how="person"]').focus();
}
function hideHow() { howEl.hidden = true; howPend = null; }
howEl.querySelector('[data-how="person"]').onclick = () => { const p = howPend; hideHow(); if (p) openTable(p.t, p.from); };
howEl.querySelector('[data-how="online"]').onclick = () => { toast("Online trades are coming soon. For now, trade in person."); };
addEventListener("pointerdown", (e) => { if (!howEl.hidden && !e.target.closest("#trade-how")) hideHow(); }, true);
howEl.addEventListener("keydown", (e) => { if (e.key === "Escape") hideHow(); });
// give: cards of yours to put on the table as it opens (from the trade binder: a pocket, or Show mode's picks).
function openTable(t, from, give = null) {
  if (tbl.on || state.trans) return;
  hideCaption(); cancelPress(); closePop(true);
  tbl.on = true; tbl.t = t; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.flights = []; tbl.shake = null; tbl.drag = null; tbl.pend = null; tbl.pinch = null;
  tbl.their.sx = 0; tbl.their.v = 0; tbl.your.sx = 0; tbl.your.v = 0;
  tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.handed = []; tbl.landing = 0; tbl.settled = false; tbl.done = null;
  threadKey = ""; renderThread(t); tbl.botH = null; // the thread's height first, so the table fits under it from the start
  tbl.L = tableLayout();
  tbl.theirs = t.spares.slice().sort((a, b) => (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.yours = cards.filter(isSpare).sort((a, b) => (t.chaseSet.has(b) ? 1 : 0) - (t.chaseSet.has(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.origin = from ? { x: from.x + 11, y: from.y - mScroll + 17, w: 32, h: 32 } : { x: vw / 2 - 18, y: topPad(), w: 36, h: 36 };
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.yours) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); }
  // A thread in progress with this collector comes back as it was: the offer in their hands, or their counter.
  const rec = activeOf(t), last = lastOf(t);
  if (rec) {
    tbl.rec = rec;
    for (const c of toCards(rec.get)) if (tbl.theirs.includes(c)) { c.spot = "table"; tbl.get.push(c); }
    for (const c of toCards(rec.give)) { if (!tbl.yours.includes(c)) { tbl.yours.push(c); c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); } c.spot = "table"; tbl.give.push(c); }
    tbl.phase = rec.state === "countered" ? "countered" : "waiting";
    if (rec.state === "proposed") scheduleReply(rec);
  } else {
    if (last?.state === "declined" && last.by === "them" && last.reason) tbl.note = last.reason;
    for (const c of give || []) if (tbl.yours.includes(c) && c.spot !== "table") { c.spot = "table"; tbl.give.push(c); }
  }
  document.body.classList.add("trading"); setChrome(); updateTradeBar();
  tbl.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 680 };
  if (reduced) tbl.q = 1;
  tick(8); kick();
}
// The cards on the table follow the record: a card the trader left out goes home, one they asked for comes out.
function syncTableTo(rec) {
  const give = toCards(rec.give), get = toCards(rec.get);
  for (const x of tbl.get.slice()) if (!get.includes(x)) place(x, false, curRect(x));
  for (const x of tbl.give.slice()) if (!give.includes(x)) place(x, false, curRect(x));
  for (const c of get) if (!tbl.get.includes(c) && tbl.theirs.includes(c)) place(c, true, curRect(c));
  for (const c of give) { if (tbl.give.includes(c)) continue; if (!tbl.yours.includes(c)) { tbl.yours.push(c); c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); } place(c, true, curRect(c)); }
}
function closeTable(instant = false) {
  if (!tbl.on || tbl.closing) return;
  if (tbl.phase === "accepting" && !tbl.settled) { settleTrade(true); return; } // leaving mid-crossing: the trade still completes
  if (tbl.drag) { tbl.drag.c.held = false; tbl.drag = null; }
  tbl.pend = null; tbl.pinch = null; tbl.flights = []; tbl.shake = null; tbl.their.v = 0; tbl.your.v = 0;
  for (const c of [...tbl.get, ...tbl.give, ...tbl.handed]) c.held = false;
  tbl.closing = true;
  if (instant || reduced) { tbl.q = 0; tbl.anim = null; endTable(); return; }
  tbl.anim = { from: tbl.q, to: 0, t0: performance.now(), dur: 180 + 400 * tbl.q };
  tick(6); kick();
}
function endTable() {
  for (const c of tbl.yours) { c.away = false; c.e = 1; c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.theirs) { c.away = false; c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  tbl.on = false; tbl.closing = false; tbl.anim = null; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.handed = []; tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.done = null;
  tradebarEl.classList.remove("three");
  document.body.classList.remove("trading"); setChrome(); kick();
}
function finishTableAnim() { if (!tbl.anim) return; tbl.q = tbl.anim.to; tbl.anim = null; if (tbl.q === 0) endTable(); }
// A card goes onto the table or comes home: it travels from where it was to where it is going.
function place(c, toTable, from) {
  const side = sideOf(c), list = side === "their" ? tbl.get : tbl.give;
  tbl.flights = tbl.flights.filter((f) => f.c !== c);
  if (toTable && c.spot !== "table") list.push(c);
  if (!toTable && c.spot === "table") list.splice(list.indexOf(c), 1);
  c.spot = toTable ? "table" : "binder"; c.held = true; c.tcur = null;
  const done = () => { c.held = false; if (c.spot === "table") c.tcur = targetRect(c); kick(); };
  if (reduced) done(); else tbl.flights.push({ c, from, t0: performance.now(), dur: 340, done });
  updateTradeBar(); kick();
}
// Shake hands sends the offer (or, after Counter back, your counter). The table stays up with the cards in their
// hands until the answer comes. Undo on the toast takes it back.
function shake() {
  if (!tbl.on || tbl.phase !== "open" || !tbl.give.length || !tbl.get.length || tbl.shake) return;
  const t = tbl.t, give = tbl.give.map((c) => c.id), get = tbl.get.map((c) => c.id), now = Date.now();
  const back = tbl.rec && tbl.rec.state === "countered" && trades.includes(tbl.rec) ? tbl.rec : null;
  let rec = back;
  if (rec) { rec.log.push({ by: "you", kind: "counter", give, get, at: now }); rec.give = give; rec.get = get; rec.at = now; rec.state = "proposed"; }
  else { rec = { t: t.id, at: now, state: "proposed", give, get, log: [{ by: "you", kind: "offer", give, get, at: now }] }; trades.push(rec); }
  persistTrades(); scheduleReply(rec); tbl.rec = rec; tbl.note = null; tick(24);
  toast(`${back ? "Countered to" : "Proposed to"} ${t.name}: ${give.length} of yours for ${get.length} of ${t.name}'s. ${balanceText(tbl.get, tbl.give, t)}.`, () => takeBack(rec));
  for (const c of [...tbl.get, ...tbl.give]) c.tcur ||= targetRect(c); // so they slide, rather than appear, into their hands
  setPhase("waiting"); drawList();
}
// Accepted, on the table: the cards cross over, drop into their new binders, and the table closes on the new wall.
function playAccept(by = "them") {
  tbl.acceptBy = by; tbl.done = { give: tbl.give.slice(), get: tbl.get.slice() }; // the offer, for the bar and the strip while the cards land
  tbl.settled = false; tick(24);
  if (reduced) { setPhase("accepting"); settleTrade(true); return; }
  tbl.shake = { t0: performance.now(), dur: 520 }; setPhase("accepting");
}
function handOver() {
  const got = tbl.get.slice(), gave = tbl.give.slice(), now = performance.now();
  tbl.shake = null; tbl.get = []; tbl.give = []; tbl.handed = [...got, ...gave]; tbl.landing = got.length + gave.length;
  const land = () => { if (--tbl.landing <= 0) setTimeout(() => { if (tbl.on && tbl.phase === "accepting") settleTrade(); }, 420); };
  for (const c of gave) { tbl.yours.splice(tbl.yours.indexOf(c), 1); tbl.theirs.unshift(c); }
  for (const c of got) { tbl.theirs.splice(tbl.theirs.indexOf(c), 1); tbl.yours.unshift(c); c.away = true; c.e = 0; }
  for (const c of tbl.handed) { const from = c.tcur || targetRect(c); c.spot = "binder"; c.handed = true; c.held = true; c.tcur = null; tbl.flights.push({ c, from, t0: now, dur: 420, done: () => { c.held = false; land(); } }); }
  tick(10); updateTradeBar(); kick();
}
// The trade is done: the wall takes its new shape under the table and the close flight carries every card to it,
// what you got landing with the marking flood as it arrives.
function settleTrade(instant = false) {
  if (tbl.settled) return;
  tbl.settled = true;
  const rec = tbl.rec, t = tbl.t;
  if (tbl.give.length || tbl.get.length) { // the crossing was cut short: the lists swap without the flight
    for (const c of tbl.give) { tbl.yours.splice(tbl.yours.indexOf(c), 1); tbl.theirs.unshift(c); }
    for (const c of tbl.get) { tbl.theirs.splice(tbl.theirs.indexOf(c), 1); tbl.yours.unshift(c); c.away = true; c.e = 0; }
    tbl.handed = [...tbl.get, ...tbl.give]; tbl.get = []; tbl.give = []; tbl.shake = null;
    for (const c of tbl.handed) { c.spot = "binder"; c.handed = true; c.held = false; c.tcur = null; }
  }
  tbl.flights = [];
  const closeDur = instant || reduced ? 0 : 180 + 400 * tbl.q;
  if (rec) completeTrade(rec, t, performance.now() + closeDur);
  layoutAll();
  for (const c of tbl.yours) c.o = tbHome(c); // the close flight lands on the new wall (or the binder's pockets)
  tbl.rec = null;
  closeTable(instant);
}

// ----- drawing the table -----
let feltKey = "", feltVal = "";
function felt() { const k = theme.panelFill + theme.ink; if (k !== feltKey) { feltKey = k; feltVal = mix(theme.panelFill, theme.ink, theme.dark ? 0.05 : 0.045); } return feltVal; }
// The pocket a card left behind when it went to the table: its outline and its name.
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
function drawRing(r, col) { ctx.lineWidth = 2.5; ctx.strokeStyle = col; rr(r.x - 2.5, r.y - 2.5, r.w + 5, r.h + 5, r.w * 0.045 + 2.5); ctx.stroke(); }
function drawBinder(side, now, alpha, value) {
  const L = tbl.L, R = sideRegion(side), t = tbl.t, list = sideList(side), S = side === "their" ? tbl.their : tbl.your;
  const lit0 = side === "their" ? isChase : (c) => t.chaseSet.has(c), lit = (c) => c.handed || lit0(c), litCol = side === "their" ? theme.deal : theme.gold;
  ctx.globalAlpha = alpha;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  let tx = R.x + 12;
  if (side === "their") { ctx.beginPath(); ctx.arc(R.x + 26, R.y + 22, 14, 0, Math.PI * 2); ctx.fillStyle = t.ink; ctx.fill(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; font(800, 13); ctx.fillText(t.name[0], R.x + 26, R.y + 23); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; tx = R.x + 48; }
  const n = list.length, litN = list.filter(lit0).length;
  const tw = R.x + R.w - 12 - tx; // the words fit the binder's own width (narrow when the table runs across)
  ctx.fillStyle = theme.ink; font(800, 17, true); ctx.fillText(fitText(side === "their" ? `${t.name}'s spares` : "Your spares", tw), tx, R.y + 20);
  ctx.fillStyle = theme.muted; font(500, 12.5);
  ctx.fillText(fitText(side === "their" ? `${t.where}. ${n} spares, ${litN ? `${litN} you chase` : "none you chase"}` : `${n} spares, ${litN ? `${litN} ${t.name} wants` : `none ${t.name}'s after`}`, tw), tx, R.y + 36);
  // the cards, column by column, only the columns on screen
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y + L.head - 4, R.w, R.h - L.head + 4); ctx.clip();
  const step = L.across ? L.ch + L.gap : L.cw + L.gap, c0 = Math.max(0, Math.floor((S.sx - 12) / step)), c1 = Math.ceil((S.sx + (L.across ? R.h : R.w)) / step);
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
  const get = accepting && tbl.done ? tbl.done.get : tbl.get, give = accepting && tbl.done ? tbl.done.give : tbl.give; // the totals stay while the cards land
  ctx.globalAlpha = alpha;
  rr(S.x + PG, S.y + 4, S.w - PG * 2, S.h - 8, 12); ctx.fillStyle = felt(); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = tbl.phase === "countered" ? t.ink : theme["slot-line"]; ctx.stroke();
  if (!waiting) { ctx.fillStyle = theme["slot-line"]; ctx.fillRect(S.x + S.w / 2 - 0.5, S.y + 14, 1, S.h - 28); }
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(`${t.name} gives`, S.x + 14, S.y + 22);
  const gl = textW(`${t.name} gives`);
  ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(get)), S.x + 14 + gl + 8, S.y + 22);
  ctx.textAlign = "right"; ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(give)), S.x + S.w - 14, S.y + 22);
  const yw = textW(money(sumOf(give)));
  ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText("You give", S.x + S.w - 14 - yw - 8, S.y + 22);
  if (waiting) { ctx.textAlign = "center"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(`Waiting on ${t.name}`, S.x + S.w / 2, S.y + S.h - 14); ctx.globalAlpha = 1; return; }
  if (!give.length && !get.length && !tbl.flights.length) {
    ctx.textAlign = "center"; ctx.fillStyle = tbl.note ? theme.ink : theme.muted; font(tbl.note ? 600 : 500, 13);
    ctx.fillText(fitText(tbl.note || "Drag a card from either side onto the table", S.w - 40), S.x + S.w / 2, S.y + S.h / 2 + (tbl.note ? 4 : 10));
    if (tbl.note) { ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText("Put something else on the table and try again", S.x + S.w / 2, S.y + S.h / 2 + 22); }
  } else if (give.length || get.length) {
    const txt = accepting ? (tbl.acceptBy === "you" ? "Done" : `${t.name} accepted`) : balanceText(get, give, t);
    font(700, 12); const tw = textW(txt) + 20;
    rr(S.x + S.w / 2 - tw / 2, S.y + S.h - 28, tw, 21, 10.5); ctx.fillStyle = accepting ? theme.deal : theme.ink; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = theme.bg; ctx.fillText(txt, S.x + S.w / 2, S.y + S.h - 13.5);
  }
  ctx.globalAlpha = 1;
}
const lerpR = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });
function drawCardAt(c, r, now, value, shadow = 0) {
  if (shadow) { ctx.globalAlpha *= 0.28; rr(r.x + 2, r.y + shadow, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill(); ctx.globalAlpha /= 0.28; }
  cardFace(c, r.x, r.y, r.w, r.h, now, value);
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
    // cards on the table ease to their places as others come and go
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
    // Opening or closing: the chrome fades with q while every card travels between the wall and its place here.
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
    for (const c of tbl.yours) c.e = 1; // the tile draws through our own alpha, not the wall's
    fly(tbl.yours, (c) => c.o, "your");
    for (const c of tbl.yours) c.e = 0;
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 1;
  if (more || tbl.anim || tbl.pinch) kick();
}
// ----- input: while the table is up it owns every touch on the canvas -----
// While the offer is out, or their counter is on the table, no card moves: the binders still scroll and a pinch still
// closes. A touch on the table says why.
function tDown(pts) {
  if (document.activeElement === qIn) qIn.blur();
  hideCaption();
  if (tbl.closing) { finishTableAnim(); return; } // the close finishes; the wall takes the next move
  if (tbl.anim) finishTableAnim();
  tbl.their.v = 0; tbl.your.v = 0;
  if (pts.length >= 2) return tPinchStart(pts);
  if (tbl.pend || tbl.pinch) return;
  const p = pts[0], now = performance.now(), zone = zoneAt(p.y, p.x);
  const S = zone === "their" ? tbl.their : zone === "your" ? tbl.your : null;
  const locked = tbl.shake || tbl.phase !== "open";
  tbl.pend = { x: p.x, y: p.y, t: now, zone, c: locked ? null : cardAt(p.x, p.y), sx0: S ? S.sx : 0, axis: null, samples: [{ x: p.x, y: p.y, t: now }] };
  if (locked && !tbl.shake && zone === "table" && tbl.phase !== "accepting") { tick(3); toast(tbl.phase === "waiting" ? `${tbl.t.name} has the cards. Take back to move them.` : `${tbl.t.name}'s counter is on the table. Accept it, or Counter to move cards.`); }
}
function pickUp(c, p) {
  const r = curRect(c);
  tbl.flights = tbl.flights.filter((f) => f.c !== c);
  tbl.drag = { c, ox: p.x - r.x, oy: p.y - r.y, x: r.x, y: r.y, w: r.w, h: r.h, from: c.spot };
  c.held = true; tick(5); kick();
}
function tMove(pts) {
  if (tbl.closing) return;
  if (tbl.pinch) { if (pts.length >= 2) tPinchMove(pts); return; }
  if (pts.length >= 2) { if (tbl.drag) dropHome(); tbl.pend = null; return tPinchStart(pts); }
  const p = pts[0], d = tbl.pend; if (!p || !d) return;
  const now = performance.now();
  d.samples.push({ x: p.x, y: p.y, t: now }); if (d.samples.length > 8) d.samples.shift();
  if (tbl.drag) { tbl.drag.x = p.x - tbl.drag.ox; tbl.drag.y = p.y - tbl.drag.oy; kick(); return; }
  const dx = p.x - d.x, dy = p.y - d.y;
  if (!d.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    // In a binder a sideways drag scrolls it; pulling a card out toward the table carries it. On the table any drag carries.
    const out = tbl.L.across ? Math.abs(dx) > Math.abs(dy) * 0.9 : Math.abs(dy) > Math.abs(dx) * 0.9; // toward the table: sideways when it runs across
    d.axis = d.c && (d.zone === "table" || out) ? "drag" : "scroll";
    if (d.axis === "drag") { pickUp(d.c, p); tbl.drag.x = p.x - tbl.drag.ox; tbl.drag.y = p.y - tbl.drag.oy; return; }
  }
  if (d.axis === "scroll" && d.zone !== "table") { const S = d.zone === "their" ? tbl.their : tbl.your; S.sx = clamp(d.sx0 - (tbl.L.across ? dy : dx), 0, maxScroll(d.zone)); kick(); }
}
function dropHome() { const d = tbl.drag; if (!d) return; tbl.drag = null; place(d.c, d.from === "table", { x: d.x, y: d.y, w: d.w, h: d.h }); }
function drop(end, vy, vx = 0) {
  const d = tbl.drag; if (!d) return; tbl.drag = null;
  const c = d.c, side = sideOf(c), S = tbl.L.strip, across = tbl.L.across;
  const f = across ? (end ? end.x : d.x + d.ox) : end ? end.y : d.y + d.oy, v = across ? vx : vy, s0 = across ? S.x : S.y, s1 = across ? S.x + S.w : S.y + S.h; // along the way to the table
  const toward = side === "their" ? v : -v; // speed toward the table
  let toTable;
  if (d.from === "table") toTable = Math.abs(v) < 0.5 ? f >= s0 - 24 && f <= s1 + 24 : toward > 0;
  else if (Math.abs(v) >= 0.5) toTable = toward > 0;
  else toTable = side === "their" ? f > s0 - 24 : f < s1 + 24;
  place(c, toTable, { x: d.x, y: d.y, w: d.w, h: d.h });
  tick(toTable ? 8 : 4);
}
function tUp(end, cancelled) {
  if (tbl.pinch) { if (!cancelled) tPinchEnd(); else { tbl.pinch = null; if (tbl.q < 1) { if (reduced) tbl.q = 1; else tbl.anim = { from: tbl.q, to: 1, t0: performance.now(), dur: 200 }; } kick(); } return; }
  const d = tbl.pend; if (!d) return; tbl.pend = null;
  const now = performance.now(), s0 = d.samples.find((s) => now - s.t < 90) || d.samples[0], last = d.samples[d.samples.length - 1];
  const vx = s0 && s0 !== last ? (last.x - s0.x) / Math.max(1, last.t - s0.t) : 0, vy = s0 && s0 !== last ? (last.y - s0.y) / Math.max(1, last.t - s0.t) : 0;
  if (tbl.drag) { if (cancelled) dropHome(); else drop(end, reduced ? 0 : vy, reduced ? 0 : vx); return; }
  if (cancelled) return;
  if (!d.axis) { if (d.c) { place(d.c, d.c.spot !== "table", curRect(d.c)); tick(d.c.spot === "table" ? 8 : 4); } return; } // a tap moves it across
  const va = tbl.L.across ? vy : vx;
  if (d.axis === "scroll" && d.zone !== "table" && !reduced && Math.abs(va) > 0.2) { const S = d.zone === "their" ? tbl.their : tbl.your; S.v = va; kick(); }
}
// Pinching in closes the table under your fingers; a quick pinch closes whatever the distance.
function tPinchStart(pts) {
  if (tbl.drag) dropHome();
  tbl.pend = null; tbl.anim = null;
  tbl.pinch = { d0: dist(pts[0], pts[1]), q0: tbl.q, qs: [] };
}
function tPinchMove(pts) {
  const g = tbl.pinch, d = dist(pts[0], pts[1]);
  tbl.q = clamp(g.q0 - (1 - d / g.d0) / 0.55, 0, 1);
  g.qs.push({ q: tbl.q, t: performance.now() }); kick();
}
function tPinchEnd() {
  const g = tbl.pinch; tbl.pinch = null;
  const qs = g.qs, last = qs[qs.length - 1];
  let first = qs.find((s) => last && last.t - s.t < 160);
  if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
  const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
  const to = Math.abs(v) > 0.0011 ? (v > 0 ? 1 : 0) : tbl.q > 0.5 ? 1 : 0;
  if (to === 0) closeTable();
  else if (reduced) { tbl.q = 1; kick(); }
  else { tbl.anim = { from: tbl.q, to: 1, t0: performance.now(), dur: 180 + 300 * (1 - tbl.q) }; kick(); }
}
const tPts = (list) => [...list].map((t) => ({ x: t.clientX, y: t.clientY }));
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (type === "touchstart") tDown(tPts(e.touches));
  else if (type === "touchmove") tMove(tPts(e.touches));
  else { const rem = tPts(e.touches); if (rem.length >= 2) return; if (rem.length === 1 && tbl.pinch) { tbl.pinch && tPinchEnd(); tbl.pend = null; return; } if (!rem.length) tUp(tPts(e.changedTouches)[0], type === "touchcancel"); }
}, { capture: true, passive: false });
let tMouse = false;
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !tbl.on || e.target !== canvas) return; e.stopImmediatePropagation(); tMouse = true; tDown([{ x: e.clientX, y: e.clientY }]); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !tMouse) return; e.stopImmediatePropagation(); tMove([{ x: e.clientX, y: e.clientY }]); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !tMouse) return; tMouse = false; e.stopImmediatePropagation(); tUp({ x: e.clientX, y: e.clientY }, type === "pointercancel"); }, true);
document.addEventListener("wheel", (e) => {
  if (!tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (tbl.closing || !tbl.L) return;
  if (e.ctrlKey || e.metaKey) { if (e.deltaY > 2) closeTable(); return; }
  const zone = zoneAt(e.clientY, e.clientX); if (zone === "table") return;
  const S = zone === "their" ? tbl.their : tbl.your;
  S.sx = clamp(S.sx + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY), 0, maxScroll(zone)); kick();
}, { capture: true, passive: false });
document.addEventListener("keydown", (e) => {
  if (!tbl.on) return;
  if (e.key === "Escape" || e.key === "Backspace") { if (document.activeElement === qIn) return; e.preventDefault(); e.stopImmediatePropagation(); closeTable(); }
  else if (e.key === "Enter" && !tbGo.disabled && !tbGo.hidden && document.activeElement === canvas) { e.preventDefault(); e.stopImmediatePropagation(); tbGo.onclick(); }
  else if (e.target === canvas && /^Arrow/.test(e.key)) e.stopImmediatePropagation();
}, true);
// The table steps aside for anything that navigates the wall: a lens, a search, the list, a rearrange.
lensBox.addEventListener("click", () => { if (tbl.on) closeTable(true); }, true);
qIn.addEventListener("input", () => { if (tbl.on) closeTable(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (tbl.on) closeTable(true); }, true);
addEventListener("resize", () => { if (tbl.on) kick(); });


// ----- the list: the same thread in rows under each trader, with the same buttons -----
const recKey = (rec) => `${rec.t}|${rec.at}`; // a record's handle in the list's markup
const recOf = (h) => trades.find((r) => recKey(r) === h) || null;
function tradeListHTML() {
  const now = Date.now();
  const ts = TRADERS.filter((t) => wantsOf(t).length || threadOf(t).length).sort((a, b) => (activeOf(b) ? 1 : 0) - (activeOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length);
  // The trade binder first, in its order: what you have spare, the most wanted first.
  const bl = tbList(), binder = `<section data-sec="trade"><h2>Trade binder</h2><p class="lsub">${bl.length ? `${bl.length} ${bl.length === 1 ? "card" : "cards"} you have a spare of, the most wanted first.` : "Empty for now. On a card you have, + adds a spare."}</p><ul>${bl.map((c) => {
    const st = sets[c.si], who = wantedBy(c), s = sparesOf(c);
    return `<li class="lwrow"><div class="lrow"><span class="lname">${esc(c.name)}</span><span class="lmeta">${esc(st.name)} #${c.num}, ${c.rname}</span><span class="lprice">${money(c.price)}</span><span class="lstate">${s > 1 ? `${s} spares. ` : ""}${who.length ? `${people(who)} ${who.length === 1 ? "wants" : "want"} it` : "No takers yet"}</span></div></li>`;
  }).join("")}</ul></section>`;
  return binder + `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase. Each trade is a thread.</p><ul>${ts.map((t) => {
    const want = wantsOf(t), has = offersOf(t), rec = activeOf(t), recs = threadOf(t);
    const thread = recs.length ? `<ul class="lthread">${recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now, "li")).join("")).join("")}</ul>` : "";
    const acts = rec?.state === "proposed" ? `<button type="button" class="pill-btn" data-back="${recKey(rec)}">Take back</button>`
      : rec?.state === "countered" ? `<button type="button" class="pill-btn primary" data-accept="${recKey(rec)}">Accept</button><button type="button" class="pill-btn" data-decline="${recKey(rec)}">Decline</button>`
      : want.length && has.length ? `<button type="button" class="pill-btn" data-propose="${t.id}">Propose ${want.length} for ${has.length}</button>` : "";
    return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">${want.length ? `Wants ${names(want)} (${money(sumOf(want))}).` : "Wants nothing of yours right now."}${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length && want.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${chipState(t).text}</span>${thread}${acts ? `<div class="lacts">${acts}</div>` : ""}</div></li>`;
  }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
}
// Debug builds only: the tests' hook learns about the table (window.__w exists only there).
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { tbl: { get: () => tbl }, slotRect: { value: slotRect }, TRADERS: { value: TRADERS }, wantsOf: { value: wantsOf }, offersOf: { value: offersOf }, trades: { get: () => trades }, cards: { value: cards }, isChase: { value: isChase }, isSpare: { value: isSpare }, openTable: { value: openTable }, place: { value: place }, curRect: { value: curRect }, activeOf: { value: activeOf }, shake: { value: shake } }); }, 0);
