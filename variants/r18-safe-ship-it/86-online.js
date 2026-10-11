// ---------- online: a trade by post, the way the marketplaces do it (round 18, safe) ----------
// Online in the chooser opens the same table, but the offer is sent rather than handed over. Their side reads like a
// listing: the trader's record in their header ("42 trades, all arrived. Ships from Sacramento."), each card's
// condition as a plain grade on its label, and a close-up photo while you hold one of their cards. Send offer waits on
// the same seeded reply (76-reply.js). When both accept the trade becomes a shipment, and its thread carries a short
// lifecycle: Ship by Thu, you mark Shipped (a tracking number if you have one), theirs goes In the mail, then
// Delivered, and you confirm Got them: the cards cross onto the wall as an in-person trade's do. The copies you send
// leave your count the moment the deal is struck (so they stop being spares), and sit on the wall marked To ship and
// then On its way; the cards coming to you go on your chase list and show as On its way in the Chase lens.
//
// Shipping takes days, so the demo runs a clock: a day passes every 20 seconds, counted from the moment the trade was
// accepted, and Settings has Skip a day. The shipment lives on the trade record (mode "online", state "shipping",
// and a ship object), so Reset the demo clears it with the trades. The in-person path is untouched: every function
// redefined here keeps the base body for a trade that isn't online.

const DEMO_DAY = 20000; // the demo clock: one day every 20 seconds
const DAY_MS = 86400e3;
const GRADES = [["Near mint", "Sharp corners and a clean surface."], ["Lightly played", "Light whitening along the edges."], ["Played", "Worn corners and a few scuffs."], ["Heavily played", "A crease and worn edges."]];
// The grade of a trader's copy: mostly near mint, seeded by card then trader (the id leads; see round 10).
const gradeOf = (t, c) => { const r = h32(`${c.id}|grade|${t.id}`); return r < 0.6 ? 0 : r < 0.86 ? 1 : r < 0.97 ? 2 : 3; };
for (const t of TRADERS) { t.record = 14 + Math.floor(h32(`${t.id}|record|n`) * 62); t.lost = h32(`${t.id}|record|lost`) < 0.25; }
const recordText = (t) => `${t.record} trades, ${t.lost ? "all but one arrived" : "all arrived"}. Ships from ${t.where}.`;

// ----- the shipment -----
// ship: { at, skip, by, theirShip, theirTransit, yourTransit, theirTrack, shipped, track, arrived, got }
// Days count from `at` on the demo clock (plus any skipped). Their parcel posts on day theirShip and is delivered on
// theirIn; yours is delivered yourTransit days after the day you post it.
const isOnline = (r) => r?.mode === "online";
const shipping = () => trades.filter((r) => r.state === "shipping" && r.ship);
const shipOf = (t) => trades.find((r) => r.t === t.id && r.state === "shipping" && r.ship) || null;
const days = (r) => (Date.now() - r.ship.at) / DEMO_DAY + (r.ship.skip || 0);
const wday = (r, d) => new Date(r.ship.at + Math.floor(d) * DAY_MS).toLocaleDateString("en-US", { weekday: "short" });
const theirIn = (r) => Math.ceil(r.ship.theirShip) + r.ship.theirTransit;
const yourIn = (r) => (r.ship.shipped == null ? Infinity : Math.floor(r.ship.shipped) + r.ship.yourTransit);
const isAre = (list) => (list.length === 1 ? "is" : "are");
function makeShip(rec, t, now) {
  const k = (s) => h32(`${rec.at}|${t.id}|ship|${s}`);
  const d4 = (s) => String(Math.floor(k(s) * 10000)).padStart(4, "0");
  return { at: now, skip: 0, by: 3, theirShip: 0.4 + k("out") * 0.9, theirTransit: 2 + Math.floor(k("in") * 2), yourTransit: 2 + Math.floor(k("yours") * 2), theirTrack: `9400 1${d4("a").slice(1)} ${d4("b")} ${d4("c")}`, shipped: null, track: null, arrived: null, got: null };
}
// Where each parcel is: a stage (0 not posted, 1 in the mail, 2 delivered, 3 confirmed) and the words for it.
function theirSide(r, t) {
  const s = r.ship, d = days(r), out = wday(r, Math.ceil(s.theirShip)), due = wday(r, theirIn(r));
  if (s.arrived != null) return { stage: 3, line: `Arrived ${wday(r, s.arrived)}. Yours now`, short: "Arrived", sentence: `${t.name}'s cards are yours`, col: theme.deal };
  if (d >= theirIn(r)) return { stage: 2, line: "Delivered. Got them?", short: "Delivered. Got them?", sentence: `${t.name}'s cards were delivered`, col: theme.deal };
  if (d >= s.theirShip) return { stage: 1, line: `In the mail. Arrives ${due}`, short: `In the mail, arrives ${due}`, sentence: `${t.name}'s cards arrive ${due}`, col: theme.ink };
  return { stage: 0, line: `Packing. Ships by ${out}`, short: `${t.name} ships by ${out}`, sentence: `${t.name} ships by ${out}`, col: theme.muted };
}
function yourSide(r, t) {
  const s = r.ship, d = days(r);
  if (s.shipped == null) { const late = Math.floor(d) >= s.by; return { stage: 0, line: late ? "Ship today" : `Ship by ${wday(r, s.by)}`, col: theme.gold }; }
  if (d >= yourIn(r)) return { stage: 2, line: `${t.name} got them`, col: theme.deal };
  return { stage: 1, line: `In the mail. Arrives ${wday(r, yourIn(r))}`, col: theme.ink };
}

const theirPhrase = (r, t) => { const th = theirSide(r, t); return [`ships by ${wday(r, Math.ceil(r.ship.theirShip))}`, `arrives ${wday(r, theirIn(r))}`, "delivered", "arrived"][th.stage]; };
// Which cards are on their way, either direction: card id -> record. Rebuilt whenever a shipment changes.
const shipIndex = { in: new Map(), out: new Map(), any: false };
function reindex() {
  shipIndex.in.clear(); shipIndex.out.clear();
  for (const r of shipping()) {
    if (!r.ship.landed) for (const id of r.get) shipIndex.in.set(id, r); // until they land on your wall
    if (r.ship.got == null) for (const id of r.give) shipIndex.out.set(id, r);
  }
  shipIndex.any = shipIndex.in.size + shipIndex.out.size > 0;
}

// ----- starting: the chooser asks whenever nothing is live with them; Online is a real choice now -----
let nextMode = null; // the mode the next table opens in, from the chooser
const onlineBtn = howEl.querySelector('[data-how="online"]');
onlineBtn.removeAttribute("aria-disabled");
onlineBtn.querySelector(".soon")?.replaceWith(Object.assign(document.createElement("span"), { className: "tick", textContent: "›" }));
onlineBtn.querySelector(".tick")?.setAttribute("aria-hidden", "true");
onlineBtn.onclick = () => { const p = howPend; hideHow(); if (p) { nextMode = "online"; openTable(p.t, p.from); } };
function startTrade(t, from) {
  if (tbl.on || state.trans) return;
  if (activeOf(t) || shipOf(t)) { openTable(t, from); return; } // a thread in progress skips the question
  howPend = { t, from }; howHead.textContent = `Trade with ${t.name}`; howEl.hidden = false; tick(4);
  howEl.querySelector('[data-how="person"]').focus();
}

// ----- the table: the base, plus the mode and a shipment in progress coming back as it was -----
function openTable(t, from, give = null) {
  const want = nextMode; nextMode = null;
  if (tbl.on || state.trans) return;
  hideCaption(); cancelPress(); closePop(true);
  tbl.on = true; tbl.t = t; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.flights = []; tbl.shake = null; tbl.drag = null; tbl.pend = null; tbl.pinch = null;
  tbl.their.sx = 0; tbl.their.v = 0; tbl.your.sx = 0; tbl.your.v = 0;
  tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.handed = []; tbl.landing = 0; tbl.settled = false; tbl.done = null;
  const rec = activeOf(t) || shipOf(t), last = lastOf(t);
  tbl.mode = want || (rec && isOnline(rec) ? "online" : "person");
  threadKey = ""; renderThread(t); tbl.botH = null; // the thread's height first, so the table fits under it from the start
  tbl.L = tableLayout();
  tbl.theirs = t.spares.slice().sort((a, b) => (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.yours = cards.filter(isSpare).sort((a, b) => (t.chaseSet.has(b) ? 1 : 0) - (t.chaseSet.has(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.origin = from ? { x: from.x + 11, y: from.y - mScroll + 17, w: 32, h: 32 } : { x: vw / 2 - 18, y: topPad(), w: 36, h: 36 };
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.yours) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); }
  // A thread in progress with this collector comes back as it was: the offer in their hands, their counter, or the parcels.
  if (rec) {
    tbl.rec = rec;
    const ship = rec.state === "shipping";
    if (!ship || rec.ship.arrived == null) for (const c of toCards(rec.get)) if (tbl.theirs.includes(c)) { c.spot = "table"; tbl.get.push(c); }
    for (const c of toCards(rec.give)) { if (!tbl.yours.includes(c)) { tbl.yours.push(c); c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); } c.spot = "table"; tbl.give.push(c); }
    tbl.phase = ship ? "shipping" : rec.state === "countered" ? "countered" : "waiting";
    if (rec.state === "proposed") scheduleReply(rec);
  } else {
    if (last?.state === "declined" && last.by === "them" && last.reason) tbl.note = last.reason;
    for (const c of give || []) if (tbl.yours.includes(c) && c.spot !== "table") { c.spot = "table"; tbl.give.push(c); }
  }
  document.body.classList.add("trading"); document.body.classList.toggle("online", tbl.mode === "online"); setChrome(); updateTradeBar();
  tbl.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 680 };
  if (reduced) tbl.q = 1;
  tick(8); kick();
}
// Send offer: the base handshake, with the record marked online and the words to match.
function shake() {
  if (!tbl.on || tbl.phase !== "open" || !tbl.give.length || !tbl.get.length || tbl.shake) return;
  const t = tbl.t, give = tbl.give.map((c) => c.id), get = tbl.get.map((c) => c.id), now = Date.now(), online = tbl.mode === "online";
  const back = tbl.rec && tbl.rec.state === "countered" && trades.includes(tbl.rec) ? tbl.rec : null;
  let rec = back;
  if (rec) { rec.log.push({ by: "you", kind: "counter", give, get, at: now }); rec.give = give; rec.get = get; rec.at = now; rec.state = "proposed"; }
  else { rec = { t: t.id, at: now, state: "proposed", give, get, log: [{ by: "you", kind: "offer", give, get, at: now }] }; if (online) rec.mode = "online"; trades.push(rec); }
  persistTrades(); scheduleReply(rec); tbl.rec = rec; tbl.note = null; tick(24);
  const lead = online ? (back ? "Counter sent to" : "Offer sent to") : back ? "Countered to" : "Proposed to";
  toast(`${lead} ${t.name}: ${give.length} of yours for ${get.length} of ${t.name}'s. ${balanceText(tbl.get, tbl.give, t)}.`, () => takeBack(rec));
  for (const c of [...tbl.get, ...tbl.give]) c.tcur ||= targetRect(c); // so they slide, rather than appear, into their hands
  setPhase("waiting"); drawList();
}

// ----- accepted: in person the cards change hands; online the trade becomes a shipment -----
function accept(rec, t, by) {
  if (isOnline(rec)) return toShipment(rec, t, by);
  const now = Date.now();
  rec.state = "accepted"; rec.by = by; rec.log.push({ by, kind: "accept", at: now }); persistTrades();
  if (onTable(t)) { tbl.rec = rec; playAccept(by); }
  else { if (by === "them") replyEvent(rec, t, `${t.name} accepted`); crossOnWall(rec, t); }
  drawList();
}
function toShipment(rec, t, by) {
  const now = Date.now();
  rec.state = "shipping"; rec.by = by; rec.log.push({ by, kind: "accept", at: now, day: 0 });
  rec.ship = makeShip(rec, t, now);
  // The copies you're sending are spoken for: one of each comes off your count now, so they stop being spares.
  quietLayout = true;
  for (const c of toCards(rec.give)) { if (nOf(c) > 1) setN(c, nOf(c) - 1); else if (c.owned) setOwned(c, false, { quiet: true }); }
  for (const c of toCards(rec.get)) if (!c.owned) chasing[c.id] = true; // what's coming shows in Chase as on its way
  quietLayout = false;
  persistCopies(); persistChase(); persistTrades(); reindex(); syncBadge(); updateCount();
  if (onTable(t)) {
    tbl.rec = rec; layoutAll(); for (const c of tbl.yours) c.o = tbHome(c);
    for (const c of [...tbl.get, ...tbl.give]) c.tcur ||= targetRect(c);
    tick(24); setPhase("shipping");
  } else {
    if (by === "them") replyEvent(rec, t, `${t.name} accepted`);
    toast(`${t.name} accepted. Ship yours by ${wday(rec, rec.ship.by)}.`, () => showThread(t), "Open");
    if (lifted) liftLayout(true);
  }
  drawList(); kick();
}

// ----- the lifecycle, on the demo clock -----
// Once a second: anything that has happened since gets its row in the thread, the wall flashes the cards it's about,
// and a toast says it (Got them on a delivery, Open otherwise). Nothing here moves the wall.
let shipKey = "";
function shipTick() {
  const recs = shipping(); if (!recs.length && !shipKey) return;
  let ev = null; // the event worth a toast: [priority, text, t, action, label]
  const say = (p, text, t, act, label) => { if (!ev || p >= ev[0]) ev = [p, text, t, act, label]; };
  let logged = false;
  for (const r of recs) {
    const t = traderOf(r), s = r.ship, d = days(r), has = (k) => r.log.some((e) => e.kind === k), get = toCards(r.get), give = toCards(r.give);
    if (!has("they-shipped") && d >= s.theirShip) { r.log.push({ by: "them", kind: "they-shipped", at: Date.now(), day: s.theirShip }); logged = true; for (const c of get) flashTile(c); say(1, `${t.name} shipped ${names(get)}. Arrives ${wday(r, theirIn(r))}.`, t, () => showThread(t), "Open"); }
    if (!has("delivered") && d >= theirIn(r)) { r.log.push({ by: "them", kind: "delivered", at: Date.now(), day: theirIn(r) }); logged = true; for (const c of get) flashTile(c); say(3, `${t.name}'s cards were delivered.`, t, () => confirmArrival(r), "Got them"); }
    if (s.shipped != null && s.got == null && d >= yourIn(r)) {
      s.got = yourIn(r); r.log.push({ by: "them", kind: "they-got", at: Date.now(), day: s.got }); logged = true;
      say(2, `${t.name} got your ${names(give)}.${s.arrived != null ? " The trade's done." : ""}`, t, () => showThread(t), "Open");
      if (s.arrived != null) finishShip(r);
    }
  }
  if (logged) { persistTrades(); reindex(); }
  const key = shipping().map((r) => `${r.t}|${r.at}|${Math.floor(days(r))}|${r.log.length}`).join(",");
  if (key === shipKey && !logged) return;
  shipKey = key;
  if (tbl.on && tbl.phase === "shipping") updateTradeBar();
  drawList(); kick();
  if (ev && !wel.on) { if (onTable(ev[2])) toast(ev[1]); else toast(ev[1], ev[3], ev[4]); }
}
setInterval(shipTick, 1000);
function finishShip(r) { r.state = "done"; r.doneAt = Date.now(); persistTrades(); reindex(); drawList(); kick(); }
// Skip a day, from Settings: every parcel moves a day on.
function skipDay() {
  const recs = shipping();
  if (!recs.length) { toast("Nothing in the mail right now."); return; }
  for (const r of recs) r.ship.skip = (r.ship.skip || 0) + 1;
  persistTrades(); tick(6);
  toast(`A day passed. It's ${wday(recs[0], days(recs[0]))} in the demo.`);
  shipTick();
}

// You mark it shipped, with a tracking number if you have one.
const shipDlg = document.createElement("dialog");
shipDlg.id = "ship-dlg"; shipDlg.setAttribute("aria-labelledby", "sd-h");
shipDlg.innerHTML = `<form method="dialog"><h2 id="sd-h">Mark as shipped</h2><p id="sd-what"></p><label class="lbl" for="sd-track">Tracking number (optional)</label><input id="sd-track" class="sd-in" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" placeholder="Leave blank if there isn't one"><div class="row"><button type="button" class="btn" id="sd-cancel">Cancel</button><button type="submit" class="btn primary" id="sd-go">Mark shipped</button></div></form>`;
document.body.append(shipDlg);
const sdTrack = shipDlg.querySelector("#sd-track");
let shipFor = null;
function openShip(r) {
  if (!r || r.state !== "shipping" || r.ship.shipped != null) return;
  const t = traderOf(r), give = toCards(r.give);
  shipFor = r; sdTrack.value = "";
  shipDlg.querySelector("#sd-what").textContent = `${names(give)} to ${t.name} in ${t.where}. Ship by ${wday(r, r.ship.by)}.`;
  shipDlg.showModal();
}
shipDlg.querySelector("#sd-cancel").onclick = () => { shipFor = null; shipDlg.close(); };
shipDlg.querySelector("form").addEventListener("submit", () => { const r = shipFor; shipFor = null; if (r) markShipped(r, sdTrack.value.trim()); });
function markShipped(r, track = "") {
  if (!r || r.state !== "shipping" || r.ship.shipped != null) return;
  const t = traderOf(r), d = days(r);
  r.ship.shipped = d; r.ship.track = track || null;
  r.log.push({ by: "you", kind: "you-shipped", at: Date.now(), day: d, track: track || null });
  persistTrades(); reindex(); tick(10);
  for (const c of toCards(r.give)) flashTile(c);
  toast(`Shipped. ${t.name} should have them by ${wday(r, yourIn(r))}.`);
  if (onTable(t)) updateTradeBar();
  drawList(); kick();
}

// Got them: the table steps aside and the cards cross onto the wall, landing in their pockets with the marking flood.
function confirmArrival(r) {
  if (!r || r.state !== "shipping" || r.ship.arrived != null || days(r) < theirIn(r)) return;
  const t = traderOf(r);
  r.ship.arrived = days(r); r.log.push({ by: "you", kind: "arrived", at: Date.now(), day: r.ship.arrived });
  persistTrades(); reindex(); tick(10);
  if (tbl.on) closeTable();
  let tries = 0;
  const go = () => {
    if (tbl.on || state.trans || shuffle || fly || crossing) { if (tries++ < 50) { setTimeout(go, 120); return; } }
    arriveOnWall(r, t);
  };
  go();
}
function landOne(c) {
  quietLayout = true;
  if (!c.owned) setOwned(c, true, { quiet: true }); else setN(c, nOf(c) + 1);
  quietLayout = false;
  delete chasing[c.id]; persistChase(); persistCopies();
}
function arriveOnWall(r, t) {
  const get = toCards(r.get);
  if (reduced || document.body.classList.contains("listmode") || bnd.on || room.on || crossing || !get.length) { for (const c of get) landOne(c); arrivalDone(r, t); return; }
  crossing = { online: true, n: get.length };
  const now = performance.now(), step = () => { if (crossing && --crossing.n <= 0) arrivalDone(r, t); };
  get.forEach((c, i) => flyCard(c, false, now + 120 + i * 90, 780, () => { landOne(c); step(); }));
}
function arrivalDone(r, t) {
  if (crossing?.online) crossing = null;
  r.ship.landed = true; persistTrades(); reindex();
  const get = toCards(r.get);
  if (r.ship.got != null) finishShip(r);
  syncBadge(); updateCount(); drawList();
  if (lifted) liftLayout(true);
  tick(14); kick();
  toast(`${names(get)} ${isAre(get)} yours.${r.state === "done" ? ` Trade with ${t.name} done.` : r.ship.shipped == null ? ` Don't forget to ship ${t.name}'s.` : ` ${t.name} gets yours ${wday(r, yourIn(r))}.`}`);
}

// ----- the trade bar: Send offer online, and the shipment's next step once it's accepted -----
function shipBar(r, t) {
  const get = toCards(r.get);
  if (r.state === "done") return { head: `Traded with ${t.name}`, sub: "Both parcels arrived" };
  const th = theirSide(r, t), yo = yourSide(r, t), toShip = r.ship.shipped == null;
  const shipBtn = { text: "Mark shipped", act: "ship" }, gotBtn = { text: "Got them", act: "arrived" };
  if (th.stage === 2) return { head: `${t.name}'s cards were delivered`, sub: toShip ? `Got them? Ship yours ${yo.line === "Ship today" ? "today" : `by ${wday(r, r.ship.by)}`} too` : "Check them over, then confirm", go: gotBtn, alt: toShip ? shipBtn : null };
  if (toShip) return { head: yo.line, sub: th.sentence, go: shipBtn };
  if (th.stage === 3) return { head: yo.stage === 2 ? `${t.name} got yours` : `Yours arrives ${wday(r, yourIn(r))}`, sub: `${names(get)} ${isAre(get)} yours` };
  if (yo.stage === 2) return { head: `${t.name} got yours`, sub: th.sentence };
  return { head: "In the mail both ways", sub: `Yours arrives ${wday(r, yourIn(r))}. ${th.sentence}` };
}
function updateTradeBar() {
  const t = tbl.t; if (!t) return;
  renderThread(t);
  const ph = tbl.phase, give = tbl.give.length, get = tbl.get.length, bal = give && get ? balanceText(tbl.get, tbl.give, t) : "", online = tbl.mode === "online";
  tbGo.hidden = false; tbGo.disabled = false; tbGo.textContent = online ? "Send offer" : "Shake hands"; tbTake.hidden = tbDec.hidden = tbAlt.hidden = true; tbAlt.textContent = "Counter";
  tradebarEl.classList.toggle("three", ph === "countered");
  tbl.goAct = tbl.altAct = null;
  if (ph === "shipping" && tbl.rec?.ship) {
    const b = shipBar(tbl.rec, t);
    tbHead.textContent = b.head; tbSub.textContent = b.sub;
    tbGo.hidden = !b.go; if (b.go) { tbGo.textContent = b.go.text; tbl.goAct = b.go.act; }
    tbAlt.hidden = !b.alt; if (b.alt) { tbAlt.textContent = b.alt.text; tbl.altAct = b.alt.act; }
    tradebarEl.classList.toggle("three", Boolean(b.go && b.alt));
    return;
  }
  if (ph === "waiting") { tbHead.textContent = `Waiting on ${t.name}`; tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s. ${bal}`; tbGo.hidden = true; tbTake.hidden = false; }
  else if (ph === "countered") { tbHead.textContent = `${t.name} countered`; tbSub.textContent = `${tbl.rec ? moveText(tbl.rec, t) : ""}. ${bal}`; tbGo.textContent = "Accept"; tbDec.hidden = false; tbAlt.hidden = false; }
  else if (ph === "accepting") { const got = tbl.done ? tbl.done.get : tbl.get; tbHead.textContent = `Traded with ${t.name}`; tbSub.textContent = `${names(got)} ${got.length === 1 ? "is" : "are"} yours`; tbGo.hidden = true; }
  else if (!give && !get && tbl.note) { tbHead.textContent = `${t.name} declined`; tbSub.textContent = tbl.note; tbGo.disabled = true; }
  else if (!give && !get) { tbHead.textContent = `Trade with ${t.name}`; tbSub.textContent = online ? "Pick cards, send the offer, then ship" : "Drag a card from either side onto the table"; tbGo.disabled = true; }
  else if (give && get) { tbHead.textContent = bal; tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s${tbl.rec ? `. ${online ? "Send offer" : "Shake hands"} sends your counter` : ""}`; tbGo.disabled = Boolean(tbl.shake); }
  else if (get) { tbHead.textContent = `${get} of ${t.name}'s on the table`; tbSub.textContent = "Add one of yours to make it a trade"; tbGo.disabled = true; }
  else { tbHead.textContent = `${give} of yours on the table`; tbSub.textContent = `Add one of ${t.name}'s to make it a trade`; tbGo.disabled = true; }
}
const shipAct = (act) => { const r = tbl.rec; if (act === "ship") openShip(r); else if (act === "arrived") confirmArrival(r); };
tbGo.onclick = () => { if (tbl.phase === "shipping") return shipAct(tbl.goAct); if (tbl.phase === "countered" && tbl.rec) acceptCounter(tbl.rec); else shake(); };
tbAlt.onclick = () => { if (tbl.phase === "shipping") return shipAct(tbl.altAct); counterBack(); };
// While the parcels are out, nothing on the table moves: a touch on it says so.
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
  if (locked && !tbl.shake && zone === "table" && tbl.phase !== "accepting") {
    tick(3);
    toast(tbl.phase === "shipping" ? "These are in the mail. The bar below says what's next." : tbl.phase === "waiting" ? `${tbl.t.name} has the cards. Take back to move them.` : `${tbl.t.name}'s counter is on the table. Accept it, or Counter to move cards.`);
  }
}

// ----- drawing the table online: the record in their header, grades on their labels, the parcels on the mat -----
const GRADE_DOT = () => ["#3BD597", "#E8BE55", "#F08A4B", "#F0605A"]; // on a dark tag, so the bright set
function gradeStrip(c, r, t) { // the grade as a tag on the top of the card, where a listing's condition sits
  if (r.w < 36) return;
  const g = gradeOf(t, c), word = GRADES[g][0], ins = Math.max(3, r.w * 0.045), max = r.w - ins * 2;
  let size = clamp(r.w * 0.12, 9, 12);
  font(700, size, true);
  const dotted = textW(word) + 16 <= max, two = !dotted && textW(word) + 8 > max && word.includes(" ");
  if (two) { size = Math.min(size, 9.5); font(700, size, true); }
  const lines = two ? word.split(" ") : [word], h = Math.round(lines.length * (size + 1) + 5), w = Math.min(max, Math.max(...lines.map(textW)) + (dotted ? 16 : 8));
  rr(r.x + ins, r.y + ins, w, h, Math.min(h / 2, 7)); ctx.fillStyle = "rgb(16 18 26 / .66)"; ctx.fill();
  let tx = r.x + ins + 4;
  if (dotted) { ctx.beginPath(); ctx.arc(r.x + ins + 6.5, r.y + ins + h / 2, 3, 0, Math.PI * 2); ctx.fillStyle = GRADE_DOT()[g]; ctx.fill(); tx = r.x + ins + 11.5; }
  else { ctx.fillStyle = GRADE_DOT()[g]; ctx.fillRect(r.x + ins + 2, r.y + ins + 3, 1.5, h - 6); tx = r.x + ins + 5.5; }
  ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  lines.forEach((ln, i) => ctx.fillText(fitText(ln, max - (tx - r.x - ins) - 2), tx, r.y + ins + 2.5 + (size + 1) * (i + 0.5) + 0.5));
  ctx.textBaseline = "alphabetic";
}
function pocketLabel(c, side) {
  const t = tbl.t, online = tbl.mode === "online";
  if (c.spot === "table" && tbl.phase === "waiting") return online ? "Offered" : `With ${t.name}`;
  if (online && c.spot === "table" && tbl.phase === "shipping") return side === "their" ? "Coming to you" : `Going to ${t.name}`;
  return c.handed ? (side === "their" ? `${t.name}'s now` : "Yours now") : "On the table";
}
function drawBinder(side, now, alpha, value) {
  const L = tbl.L, R = sideRegion(side), t = tbl.t, list = sideList(side), S = side === "their" ? tbl.their : tbl.your, online = tbl.mode === "online";
  const lit0 = side === "their" ? isChase : (c) => t.chaseSet.has(c), lit = (c) => c.handed || lit0(c), litCol = side === "their" ? theme.deal : theme.gold;
  ctx.globalAlpha = alpha;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  let tx = R.x + 12;
  if (side === "their") { ctx.beginPath(); ctx.arc(R.x + 26, R.y + 22, 14, 0, Math.PI * 2); ctx.fillStyle = t.ink; ctx.fill(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; font(800, 13); ctx.fillText(t.name[0], R.x + 26, R.y + 23); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; tx = R.x + 48; }
  const n = list.length, litN = list.filter(lit0).length;
  ctx.fillStyle = theme.ink; font(800, 17, true); ctx.fillText(fitText(side === "their" ? `${t.name}'s spares` : "Your spares", R.w - 24), tx, R.y + 20);
  if (online && side === "their") { // the trader's record, the way a seller's shows on a listing
    const nw = textW(fitText(`${t.name}'s spares`, R.w - 24)); font(600, 12.5); ctx.fillStyle = theme.muted;
    const extra = litN ? `${litN} you chase` : ""; if (extra && tx + nw + 10 + textW(extra) < R.x + R.w - 12) ctx.fillText(extra, tx + nw + 10, R.y + 20);
  }
  ctx.fillStyle = theme.muted; font(500, 12.5);
  const sub = side === "their" ? (online ? recordText(t) : `${t.where}. ${n} spares, ${litN ? `${litN} you chase` : "none you chase"}`) : `${n} spares, ${litN ? `${litN} ${t.name} wants` : `none ${t.name}'s after`}`;
  ctx.fillText(fitText(sub, R.w - 24), tx, R.y + 36);
  // the cards, column by column, only the columns on screen
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y + L.head - 4, R.w, R.h - L.head + 4); ctx.clip();
  const c0 = Math.max(0, Math.floor((S.sx - 12) / (L.cw + L.gap))), c1 = Math.ceil((S.sx + R.w) / (L.cw + L.gap));
  for (let k = c0 * L.rows; k < Math.min(n, (c1 + 1) * L.rows); k++) {
    const c = list[k], r = slotRect(side, k);
    if (c.spot === "table" || c.held) { drawPocket(c, r, alpha * 0.7, pocketLabel(c, side)); ctx.globalAlpha = alpha; continue; }
    const on = lit(c);
    ctx.globalAlpha = alpha * (on ? 1 : 0.5);
    cardFace(c, r.x, r.y, r.w, r.h, now, value);
    if (online && side === "their" && !c.handed) gradeStrip(c, r, t);
    if (on) { ctx.globalAlpha = alpha; drawRing(r, c.handed ? (side === "their" ? theme.gold : theme.deal) : litCol); }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
let kraftKey = "", kraftVal = "", kraftLine = "";
function kraft() { const k = theme.panelFill + theme.dark; if (k !== kraftKey) { kraftKey = k; kraftVal = mix(theme.panelFill, "#C8A06A", theme.dark ? 0.2 : 0.3); kraftLine = mix(theme.panelFill, "#A27C48", theme.dark ? 0.45 : 0.55); } return kraftVal; }
function drawShipStrip(alpha) {
  const S = tbl.L.strip, t = tbl.t, r = tbl.rec;
  ctx.globalAlpha = alpha;
  rr(S.x + PG, S.y + 4, S.w - PG * 2, S.h - 8, 12); ctx.fillStyle = felt(); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (!r?.ship) { ctx.globalAlpha = 1; return; }
  const half = (S.w - PG * 2) / 2, done = r.state === "done";
  for (const side of ["their", "your"]) {
    const s = side === "their" ? theirSide(r, t) : yourSide(r, t), stage = done ? 2 : s.stage;
    const x0 = side === "their" ? S.x + PG : S.x + PG + half, x1 = x0 + half, left = side === "their";
    // the parcel: dashed while it's still to post, brown paper in the mail, green once it's there
    const bx = x0 + 4, by = S.y + 27, bw = half - 8, bh = S.h - 52;
    rr(bx, by, bw, bh, 8);
    if (stage === 0) { ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = left ? theme["slot-line"] : theme.gold; ctx.stroke(); ctx.setLineDash([]); }
    else { ctx.fillStyle = stage === 1 ? kraft() : dealTint(); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = stage === 1 ? kraftLine : theme.deal; ctx.stroke(); }
    ctx.textBaseline = "alphabetic"; ctx.textAlign = left ? "left" : "right";
    const tx = left ? x0 + 8 : x1 - 8;
    ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(left ? `From ${t.name}` : "From you", tx, S.y + 20);
    ctx.fillStyle = done ? theme.deal : s.col; font(700, 12.5, true); ctx.fillText(fitText(done ? (left ? "Arrived" : `${t.name} got them`) : s.line, half - 16), tx, S.y + S.h - 11);
  }
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
function drawStrip(now, alpha) {
  const online = tbl.mode === "online";
  if (online && tbl.phase === "shipping") return drawShipStrip(alpha);
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
  if (waiting) { ctx.textAlign = "center"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(online ? `Offer sent. Waiting on ${t.name}` : `Waiting on ${t.name}`, S.x + S.w / 2, S.y + S.h - 14); ctx.globalAlpha = 1; return; }
  if (!give.length && !get.length && !tbl.flights.length) {
    ctx.textAlign = "center"; ctx.fillStyle = tbl.note ? theme.ink : theme.muted; font(tbl.note ? 600 : 500, 13);
    const two = tbl.note || online;
    ctx.fillText(fitText(tbl.note || "Drag a card from either side onto the table", S.w - 40), S.x + S.w / 2, S.y + S.h / 2 + (two ? 4 : 10));
    if (two) { ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText(fitText(tbl.note ? "Put something else on the table and try again" : `Hold one of ${t.name}'s to see it up close`, S.w - 40), S.x + S.w / 2, S.y + S.h / 2 + 22); }
  } else if (give.length || get.length) {
    const txt = accepting ? (tbl.acceptBy === "you" ? "Done" : `${t.name} accepted`) : balanceText(get, give, t);
    font(700, 12); const tw = textW(txt) + 20;
    rr(S.x + S.w / 2 - tw / 2, S.y + S.h - 28, tw, 21, 10.5); ctx.fillStyle = accepting ? theme.deal : theme.ink; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = theme.bg; ctx.fillText(txt, S.x + S.w / 2, S.y + S.h - 13.5);
  }
  ctx.globalAlpha = 1;
}
// The table closing: the base, and the photo goes with it.
function endTable() {
  for (const c of tbl.yours) { c.away = false; c.e = 1; c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.theirs) { c.away = false; c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  tbl.on = false; tbl.closing = false; tbl.anim = null; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.handed = []; tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.done = null;
  tradebarEl.classList.remove("three"); document.body.classList.remove("online"); hidePeek();
  document.body.classList.remove("trading"); setChrome(); kick();
}

// ----- the close-up: hold one of their cards and its photo comes up; let go and it goes -----
const peekEl = document.createElement("div");
peekEl.className = "peek"; peekEl.setAttribute("role", "img");
peekEl.innerHTML = `<canvas></canvas><div class="pk-cap"><b></b><span class="pk-card"></span><span class="pk-line"></span></div>`;
document.body.append(peekEl);
let peekT = 0, peekAt = null, peeking = false;
function theirCardAt(x, y) {
  for (const c of tbl.get) { const r = c.tcur; if (r && x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4) return c; }
  if (!tbl.L || zoneAt(y) !== "their") return null;
  const L = tbl.L, R = L.their, S = tbl.their, lx = x - R.x - 12 + S.sx, ly = y - R.y - L.head;
  if (lx < 0 || ly < 0) return null;
  const col = Math.floor(lx / (L.cw + L.gap)), row = Math.floor(ly / (L.ch + L.gap));
  if (row >= L.rows || lx - col * (L.cw + L.gap) > L.cw || ly - row * (L.ch + L.gap) > L.ch) return null;
  const c = tbl.theirs[col * L.rows + row];
  return c && c.spot !== "table" && !c.held && !c.handed ? c : null;
}
function peekStart(x, y) {
  clearTimeout(peekT); peekT = 0;
  if (!tbl.on || tbl.mode !== "online" || tbl.q < 1 || tbl.closing) return;
  const c = theirCardAt(x, y); if (!c) return;
  peekAt = { x, y };
  peekT = setTimeout(() => { peekT = 0; if (!tbl.on || tbl.drag || tbl.pinch || tbl.pend?.axis) return; tbl.pend = null; showPeek(c, tbl.t); }, 420);
}
function peekMove(x, y) { if (peekT && peekAt && Math.hypot(x - peekAt.x, y - peekAt.y) > 8) { clearTimeout(peekT); peekT = 0; } }
function peekEnd() { clearTimeout(peekT); peekT = 0; if (peeking) hidePeek(); }
// The window hears a touch before the table's own handlers on the document do.
addEventListener("touchstart", (e) => { if (e.target !== canvas) return; if (e.touches.length === 1) peekStart(e.touches[0].clientX, e.touches[0].clientY); else peekEnd(); }, { capture: true, passive: true });
addEventListener("touchmove", (e) => { if (e.touches.length === 1) peekMove(e.touches[0].clientX, e.touches[0].clientY); }, { capture: true, passive: true });
for (const type of ["touchend", "touchcancel"]) addEventListener(type, (e) => { if (!e.touches.length) peekEnd(); }, { capture: true, passive: true });
addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.target === canvas) peekStart(e.clientX, e.clientY); }, true);
addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") peekMove(e.clientX, e.clientY); }, true);
for (const type of ["pointerup", "pointercancel"]) addEventListener(type, (e) => { if (e.pointerType === "mouse") peekEnd(); }, true);
function showPeek(c, t) {
  const g = gradeOf(t, c), st = sets[c.si], cv = peekEl.querySelector("canvas"), d = Math.min(3, devicePixelRatio || 1);
  const W = Math.min(260, vw - 64), H = Math.round(W * 1.12);
  cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
  const p = cv.getContext("2d"); p.setTransform(d, 0, 0, d, 0, 0);
  drawPhoto(p, c, t, g, W, H);
  peekEl.querySelector("b").textContent = GRADES[g][0];
  peekEl.querySelector(".pk-card").textContent = `${c.name}, ${st.code} ${c.num}/${st.printed}. Market ${money(c.price)}.`;
  peekEl.querySelector(".pk-line").textContent = `${GRADES[g][1]} Photo from ${t.name}.`;
  peekEl.setAttribute("aria-label", `${c.name}, ${GRADES[g][0]}. ${GRADES[g][1]}`);
  peekEl.classList.add("on"); peeking = true; tick(6);
}
function hidePeek() { peeking = false; peekEl.classList.remove("on"); }
// A photo of their copy, drawn once: the card on a desk under a lamp, a little turned, with the wear its grade says.
function drawPhoto(p, c, t, g, W, H) {
  const rnd = (k) => h32(`${k}|${c.id}|photo|${t.id}`); // the key leads: keys that differ only at the end hash alike
  const bg = p.createRadialGradient(W * 0.32, H * 0.22, 10, W * 0.5, H * 0.55, W * 0.95);
  bg.addColorStop(0, "#F1ECE3"); bg.addColorStop(1, "#9E9586"); p.fillStyle = bg; p.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { p.fillStyle = `rgb(${rnd(`gr${i}`) < 0.5 ? "255 255 255" : "0 0 0"} / .05)`; p.fillRect(rnd(`gx${i}`) * W, rnd(`gy${i}`) * H, 1.2, 1.2); } // grain
  const ch = H * 0.82, cw = ch * TW / TH, rad = cw * 0.045, col = typeColor(c);
  p.save(); p.translate(W / 2, H / 2); p.rotate((rnd("turn") - 0.5) * 0.11);
  p.save(); p.shadowColor = "rgb(0 0 0 / .38)"; p.shadowBlur = 16; p.shadowOffsetX = 5; p.shadowOffsetY = 9;
  p.beginPath(); p.roundRect ? p.roundRect(-cw / 2, -ch / 2, cw, ch, rad) : p.rect(-cw / 2, -ch / 2, cw, ch); p.fillStyle = col; p.fill(); p.restore();
  p.save(); p.beginPath(); p.roundRect ? p.roundRect(-cw / 2, -ch / 2, cw, ch, rad) : p.rect(-cw / 2, -ch / 2, cw, ch); p.clip();
  const fg = p.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2); fg.addColorStop(0, shade(col, 0.22)); fg.addColorStop(0.55, col); fg.addColorStop(1, shade(col, -0.3));
  p.fillStyle = fg; p.fillRect(-cw / 2, -ch / 2, cw, ch);
  p.strokeStyle = "rgb(255 255 255 / .07)"; p.lineWidth = 1; for (let x = -cw; x < cw; x += 6) { p.beginPath(); p.moveTo(x, -ch / 2); p.lineTo(x + ch, ch / 2); p.stroke(); } // the engraving
  if (c.tier >= 3) { const hg = p.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 4); hg.addColorStop(0, "rgb(255 255 255 / 0)"); hg.addColorStop(0.45, "rgb(150 220 255 / .22)"); hg.addColorStop(0.55, "rgb(255 226 160 / .3)"); hg.addColorStop(1, "rgb(255 255 255 / 0)"); p.fillStyle = hg; p.fillRect(-cw / 2, -ch / 2, cw, ch); }
  const lh = ch * 0.24, ly = ch / 2 - lh;
  p.fillStyle = theme.paper || "#F6F4EE"; p.fillRect(-cw / 2, ly, cw, lh); p.fillStyle = "rgb(0 0 0 / .14)"; p.fillRect(-cw / 2, ly, cw, 1);
  const pad = cw * 0.075, st = sets[c.si];
  p.fillStyle = theme["paper-ink"] || "#191B22"; p.textAlign = "left"; p.textBaseline = "alphabetic";
  p.font = `800 ${Math.round(cw * 0.1)}px ${FONT}`; p.fillText(c.name, -cw / 2 + pad, ly + lh * 0.48, cw - pad * 2);
  p.globalAlpha = 0.7; p.font = `500 ${Math.round(cw * 0.066)}px ${FONT}`; p.fillText(`${st.code} ${c.num}/${st.printed}`, -cw / 2 + pad, ly + lh * 0.82); p.textAlign = "right"; p.fillText(GLYPH[c.tier], cw / 2 - pad, ly + lh * 0.82); p.globalAlpha = 1;
  // wear: whitening on the corners and edges, then scuffs, then a crease
  const wear = [0, 0.4, 0.75, 1][g];
  if (wear) {
    p.fillStyle = `rgb(255 255 255 / ${0.45 + wear * 0.4})`;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    corners.forEach(([sx, sy], i) => { if (rnd(`cn${i}`) > 0.35 + wear * 0.6) return; const r0 = 1.5 + wear * 3 * rnd(`cr${i}`); p.beginPath(); p.arc(sx * (cw / 2 - r0 * 0.6), sy * (ch / 2 - r0 * 0.6), r0, 0, Math.PI * 2); p.fill(); });
    const nicks = Math.round(4 + wear * 22);
    for (let i = 0; i < nicks; i++) { const e = Math.floor(rnd(`ne${i}`) * 4), u = rnd(`nu${i}`) - 0.5, len = 1 + rnd(`nl${i}`) * (2 + wear * 6); const x = e === 0 || e === 2 ? u * cw : (e === 1 ? 1 : -1) * cw / 2, y = e === 1 || e === 3 ? u * ch : (e === 0 ? -1 : 1) * ch / 2; p.fillRect(x - (e % 2 ? 0.8 : len / 2), y - (e % 2 ? len / 2 : 0.8), e % 2 ? 1.6 : len, e % 2 ? len : 1.6); }
  }
  if (g >= 2) { p.strokeStyle = "rgb(255 255 255 / .28)"; p.lineWidth = 0.8; for (let i = 0; i < 3 + g * 2; i++) { const x = (rnd(`sx${i}`) - 0.5) * cw * 0.8, y = (rnd(`sy${i}`) - 0.6) * ch * 0.7, a = rnd(`sa${i}`) * Math.PI, l = 8 + rnd(`sl${i}`) * 22; p.beginPath(); p.moveTo(x, y); p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke(); } }
  if (g >= 3) { const y = (rnd("crease") - 0.5) * ch * 0.4; p.lineWidth = 1.4; p.strokeStyle = "rgb(255 255 255 / .45)"; p.beginPath(); p.moveTo(-cw / 2, y); p.lineTo(cw / 2, y + ch * 0.06); p.stroke(); p.strokeStyle = "rgb(0 0 0 / .25)"; p.beginPath(); p.moveTo(-cw / 2, y + 1.5); p.lineTo(cw / 2, y + ch * 0.06 + 1.5); p.stroke(); }
  // the lamp's glare across the sleeve
  const gl = p.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2); gl.addColorStop(0, "rgb(255 255 255 / 0)"); gl.addColorStop(0.3, "rgb(255 255 255 / .26)"); gl.addColorStop(0.42, "rgb(255 255 255 / 0)"); p.fillStyle = gl; p.fillRect(-cw / 2, -ch / 2, cw, ch);
  p.restore(); p.restore();
}

// ----- the thread: the shipment's rows after the handshake, dated on the demo clock -----
function rowsOf(rec, t) {
  const rows = [], on = isOnline(rec), s = rec.ship;
  for (const e of rec.log) {
    const you = e.by === "you", when = on && s && e.day != null ? wday(rec, e.day) : null;
    if (e.kind === "offer" || e.kind === "counter") { const g = toCards(e.give), k = toCards(e.get); rows.push({ who: you ? "you" : "them", lead: you ? (e.kind === "offer" ? (on ? "You offered" : "You proposed") : "You countered") : `${t.name} countered`, text: `${names(g)} for ${names(k)}. ${balanceText(k, g, t)}.`, at: e.at }); }
    else if (e.kind === "accept") {
      rows.push({ who: you ? "you" : "them", lead: you ? "You accepted" : `${t.name} accepted`, text: "", at: e.at, when });
      if (on && s) rows.push({ who: "sys", lead: "", text: `Ship within ${s.by} days. In this demo a day passes every 20 seconds.`, at: null });
    }
    else if (e.kind === "decline") rows.push({ who: you ? "you" : "them", lead: you ? "You declined" : `${t.name} declined`, text: you ? "" : e.reason || "", at: e.at });
    else if (e.kind === "they-shipped") rows.push({ who: "them", lead: `${t.name} shipped`, text: `Arrives ${wday(rec, theirIn(rec))}. Tracking ${s.theirTrack}.`, at: e.at, when });
    else if (e.kind === "delivered") rows.push({ who: "them", lead: `${t.name}'s cards were delivered`, text: "", at: e.at, when });
    else if (e.kind === "you-shipped") rows.push({ who: "you", lead: "You shipped", text: e.track ? `Tracking ${e.track}.` : "No tracking number.", at: e.at, when });
    else if (e.kind === "arrived") { const k = toCards(rec.get); rows.push({ who: "you", lead: "You got them", text: `${names(k)} ${isAre(k)} yours.`, at: e.at, when }); }
    else if (e.kind === "they-got") rows.push({ who: "them", lead: `${t.name} got yours`, text: "", at: e.at, when });
  }
  if (rec.state === "done" || rec.state === "accepted") rows.push({ who: "sys", lead: "", text: `Traded ${dayOf(rec.doneAt || Date.now())}.`, at: null });
  if (rec.state === "proposed") rows.push({ who: "wait", lead: "", text: `Waiting on ${t.name}`, at: null });
  if (rec.state === "shipping" && s) { const th = theirSide(rec, t), yo = yourSide(rec, t); rows.push({ who: "wait", lead: "", text: th.stage < 2 ? `${th.sentence}.` : th.stage === 2 ? "Got them? Confirm and they go on your wall." : yo.stage === 1 ? `Yours arrives ${wday(rec, yourIn(rec))}.` : `${yo.line}.`, at: null }); }
  return rows;
}
function rowHTML(r, t, now, tag = "div") {
  const lead = r.lead ? `<b>${r.who === "them" ? r.lead.replace(t.name, `<i class="tn" style="color:${t.ink}">${t.name}</i>`) : esc(r.lead)}${r.text ? ":" : "."}</b> ` : "";
  const fresh = r.at && now - r.at < 2500 ? " new" : "";
  const time = r.when || (r.at ? agoText(r.at, now) : "");
  return `<${tag} class="trow ${r.who}${fresh}">${r.who === "wait" ? `<i class="tdot" aria-hidden="true"></i>` : ""}<span class="tt">${lead}${esc(r.text)}</span>${time ? `<time>${time}</time>` : ""}</${tag}>`;
}
function renderThread(t) {
  const recs = threadOf(t), sr = shipOf(t);
  const key = `${t.id}|${recs.map((r) => `${r.at}:${r.state}:${r.log.length}`).join(",")}|${sr ? `${Math.floor(days(sr))}:${sr.ship.shipped != null}` : ""}`;
  if (key === threadKey) return;
  threadKey = key;
  const now = Date.now();
  threadEl.innerHTML = recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now)).join("")).join("");
  threadEl.scrollTop = threadEl.scrollHeight;
}
// The chip in the Trade lens: a shipment's next step leads.
function chipState(t) {
  const sr = shipOf(t);
  if (sr) {
    const th = theirSide(sr, t), yo = yourSide(sr, t);
    if (th.stage === 2) return { text: "Delivered. Got them?", col: theme.deal, dot: true };
    if (yo.stage === 0) return { text: yo.line, col: theme.gold, dot: true };
    return { text: "In the mail", col: theme.muted };
  }
  const rec = lastOf(t), wants = wantsOf(t).length, has = offersOf(t).length;
  if (rec?.state === "proposed") return { text: `Waiting on ${t.name}`, col: theme.gold };
  if (rec?.state === "countered") return { text: `${t.name} countered`, col: theme.deal, dot: true };
  if (rec?.state === "done" || rec?.state === "accepted") return { text: `Traded ${dayOf(rec.doneAt || Date.now())}`, col: theme.deal };
  if (wants) return { text: `Wants ${wants} of yours`, col: theme.gold };
  return { text: `Has ${has} you chase`, col: theme.deal };
}

// ----- on the wall: what you're sending and what's coming -----
// A pill on the tile: To ship (gold) or On its way (ink) on a card a copy of which is leaving; On its way (green) on
// a card coming to you. Far out, where words can't be read, a dot with the arrow. Drawn after the counts.
function shipPill(c, r, a, out, posted) {
  const col = out ? (posted ? theme.ink : theme.gold) : theme.deal, txt = out ? (posted ? "On its way" : "To ship") : "On its way";
  ctx.globalAlpha = a;
  const arrow = (x, y, s, up) => { ctx.beginPath(); ctx.moveTo(x, y + (up ? s : -s)); ctx.lineTo(x, y - (up ? s : -s)); ctx.moveTo(x - s * 0.7, y - (up ? s * 0.3 : -s * 0.3)); ctx.lineTo(x, y - (up ? s : -s)); ctx.lineTo(x + s * 0.7, y - (up ? s * 0.3 : -s * 0.3)); ctx.stroke(); };
  const fg = out && posted ? theme.bg : theme.dark ? "#171920" : "#fff";
  ctx.lineWidth = 1.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = fg;
  if (r.w < 60) { // far out: a dashed outline (in transit), and the dot with the arrow once it can be seen
    ctx.setLineDash([3, 2]); ctx.lineWidth = r.w < 20 ? 1.2 : 1.6; ctx.strokeStyle = col; rr(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3, Math.min(r.w * 0.09, 6) + 1.5); ctx.stroke(); ctx.setLineDash([]);
    if (r.w >= 20) {
      const R = clamp(r.w * 0.2, 4.5, 8), x = r.x + r.w - R * 0.6, y = r.y + R * 0.6;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = fg;
      arrow(x, y, R * 0.5, out);
    }
  } else {
    font(700, 10.5); const tw = textW(txt), h = 17, w = tw + 22, ins = Math.max(4, r.w * 0.05), x = r.x + ins, y = r.y + r.h * 0.76 - h - ins; // the foot of the art, clear of the count and the price
    rr(x, y, w, h, h / 2); ctx.fillStyle = col; ctx.fill();
    arrow(x + 8.5, y + h / 2, 3.6, out);
    ctx.fillStyle = fg; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, x + 15, y + h / 2 + 0.5); ctx.textBaseline = "alphabetic";
  }
  ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.globalAlpha = 1;
}
function drawShipMarks() {
  if (!shipIndex.any || state.time || state.trans || shuffle || room.on || tbl.on || bnd.on || preview || crossing) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const one = (id, r, out) => {
    const c = byId.get(id); if (!c) return;
    const q = tileRectOf(c); if (!q || q.w < 9 || q.y > vh || q.y + q.h < 0) return;
    if (!out && c.lift && q.w > q.h * 1.05) return; // the Chase tile says it in words
    if (out && c.lift && q.w > q.h * 1.05) { const pad = Math.max(8, q.w * 0.05); shipPill(c, { x: q.x + pad, y: q.y + pad, w: (q.h - pad * 2) * TW / TH, h: q.h - pad * 2 }, 1, true, r.ship.shipped != null); return; }
    shipPill(c, q, Math.max(0.75, c.e), out, r.ship.shipped != null);
  };
  for (const [id, r] of shipIndex.out) one(id, r, true);
  for (const [id, r] of shipIndex.in) one(id, r, false);
}
function drawPicks() {
  drawCopies();
  drawShipMarks();
  if (!picking()) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const g of groups) {
    if (!g.set || !g.m || g.done) continue;
    const m = mr(g.m); if (m.y > vh || m.y + m.h < 0) continue;
    const on = wel.picks.has(g.set.id), R = 10, x = m.x + m.w - PG - 10 - R, y = m.y + PG + 16;
    if (on) { ctx.lineWidth = 2; ctx.strokeStyle = g.ink; rr(m.x + PG + 1, m.y + PG + 1, m.w - PG * 2 - 2, m.h - PG * 2 - 2, 11); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    if (on) {
      ctx.fillStyle = g.ink; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = "#fff"; ctx.beginPath();
      ctx.moveTo(x - R * 0.45, y + R * 0.02); ctx.lineTo(x - R * 0.12, y + R * 0.38); ctx.lineTo(x + R * 0.48, y - R * 0.36); ctx.stroke();
    } else { ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  }
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}
// In the Chase lens a card coming to you is a tile of its own: On its way, from whom, and where the parcel is.
function drawFeedTile(c, x, y, w, h, a, now = performance.now()) {
  const sr = shipIndex.in.get((c.base || c).id);
  if (sr && !c.owned) return drawComingTile(c, sr, x, y, w, h, a, now);
  const st = sets[c.si], deal = Boolean(c.deal), rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = deal ? dealTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = deal ? 1.5 : 1; ctx.strokeStyle = deal ? theme.deal : theme["slot-line"]; ctx.stroke();
  if (w < 60 || h < 30) { ctx.globalAlpha = 1; return; } // (h: mid-flight a tile can be wide and flat)
  const pad = Math.max(8, w * 0.05), s = clamp(w / 177, 0.6, 1.3);
  const mh = h - pad * 2, mw = mh * TW / TH;
  foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  const tx = x + pad + mw + pad, tw = x + w - pad - tx;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const arrived = deal && c.dealAt > 0, price = fitText(short(c.deal ?? capOf(c)), tw);
  ctx.fillStyle = deal ? theme.deal : theme.ink; font(800, 21 * s); ctx.fillText(price, tx, y + pad + 17 * s);
  if (arrived && c.dealWas) {
    const pw = textW(price); font(600, 12 * s);
    const old = short(c.dealWas), ow = textW(old), ox = tx + pw + 6 * s;
    if (ox + ow <= tx + tw) { ctx.fillStyle = theme.muted; ctx.fillText(old, ox, y + pad + 17 * s); ctx.fillRect(ox, y + pad + 12.5 * s, ow, Math.max(1, s)); }
  }
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(deal ? `was ${short(c.price)}` : "the most you'd pay", tw), tx, y + pad + 31 * s);
  if (deal) { ctx.fillStyle = theme.deal; font(800, 13 * s); ctx.fillText(fitText(`${dealPct(c)}% under market`, tw), tx, y + pad + 47 * s); }
  else { ctx.fillStyle = theme.muted; font(600, 11 * s); ctx.fillText(fitText(`Market ${short(c.price)}`, tw), tx, y + pad + 47 * s); }
  if (arrived) {
    const ago = agoText(c.dealAt, Date.now());
    ctx.fillStyle = c.dealSeen ? theme.muted : theme.deal; font(700, 11 * s);
    ctx.fillText(fitText(c.dealWas ? `↓ ${ago}` : ago, tw), tx, y + pad + 62 * s);
    if (!c.dealSeen && !state.trans && !shuffle && Date.now() - c.dealAt > 3000 && y >= topPad() - 2 && y + h <= vh - botPad() + 2) lookedAt(c);
  }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}
function drawComingTile(c, r, x, y, w, h, a, now) {
  const t = traderOf(r), st = sets[c.si], rad = Math.min(12, w * 0.07), th = theirSide(r, t);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = th.stage >= 2 ? dealTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = theme.deal; if (th.stage < 2) ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
  if (w < 60 || h < 30) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.05), s = clamp(w / 177, 0.6, 1.3), mh = h - pad * 2, mw = mh * TW / TH;
  ctx.globalAlpha = a * 0.55; foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  const tx = x + pad + mw + pad, tw = x + w - pad - tx;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.deal; font(800, 15 * s, true); ctx.fillText(fitText("On its way", tw), tx, y + pad + 14 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`from ${t.name}`, tw), tx, y + pad + 29 * s);
  ctx.fillStyle = th.stage >= 2 ? theme.deal : theme.ink; font(700, 12 * s, true); ctx.fillText(fitText(th.stage >= 2 ? "Delivered" : th.stage === 1 ? `Arrives ${wday(r, theirIn(r))}` : `Ships by ${wday(r, Math.ceil(r.ship.theirShip))}`, tw), tx, y + pad + 45 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(GRADES[gradeOf(t, c)][0], tw), tx, y + pad + 60 * s);
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}
// The live feed skips a card that's already coming to you (the base feed, with that one filter).
function nextArrival() {
  const chased = cards.filter((c) => isChase(c) && !shipIndex.in.has(c.id)).sort(feedOrder);
  if (!chased.length) return null;
  const now = Date.now();
  for (const c of chased) {
    if (c.deal || c.noDeal) continue;
    const p = arrivalPrice(c);
    if (p >= c.price) { c.noDeal = true; continue; }
    return { c, price: p, was: null, at: now };
  }
  let old = null, oldAt = Infinity;
  for (const c of chased) { const at = c.dealAt || 0; if (c.deal && at < oldAt) { old = c; oldAt = at; } }
  if (!old) return null;
  const was = old.deal, p = Math.max(0.25, Math.round(was * 0.9 * 100) / 100);
  return p < was ? { c: old, price: p, was, at: now } : null;
}
// Tapping a card that's coming to you opens its trade rather than the offers for it.
function popCard(c, from) {
  const sr = shipIndex.in.get((c.base || c).id);
  if (sr && !c.owned) { tick(4); showThread(traderOf(sr)); return; }
  if (pop.c) return;
  hideCaption(); cancelPress();
  pop.c = c; pop.from = from; pop.t0 = performance.now(); pop.closing = false;
  oKind = "single"; fillOffers(c);
  offersEl.inert = false; document.body.classList.add("offering");
  lookedAt(c);
  tick(5); kick();
}

// ----- the card panel: a copy that's leaving says so; a card that's coming says from whom -----
function updateFlag(c) {
  const owned = c.owned, id = (c.base || c).id, inn = shipIndex.in.get(id), out = shipIndex.out.get(id);
  flagBtn.hidden = owned; stepEl.hidden = !owned;
  if (!owned) {
    const on = isChase(c);
    flagBtn.textContent = on ? "Chasing ✓" : "Chase it"; flagBtn.classList.toggle("on", on); flagBtn.setAttribute("aria-pressed", String(on));
    if (inn) {
      const t = traderOf(inn);
      spareEl.hidden = false; pSpareT.innerHTML = `<b>On its way</b> from ${t.name}: ${theirPhrase(inn, t)}. ${GRADES[gradeOf(t, c.base || c)][0]}.`;
      pTrade.hidden = false; pTrade.textContent = "Open the trade"; pTrade.dataset.t = t.id; pKeep.hidden = true;
      return;
    }
    spareEl.hidden = true; return;
  }
  const meta = document.getElementById("p-meta"); meta.textContent = meta.textContent.replace(" You have a spare.", "");
  const b = c.base || c, n = nOf(b), s = sparesOf(b), who = wantedBy(b);
  pN.textContent = `You have ${n}`; pLess.disabled = n <= 1; pMore.disabled = n >= 99;
  stepEl.classList.toggle("spare", s > 0);
  let text = "", trade = null, keep = "", label = "";
  if (n <= 1) { if (who.length) text = `${people(who)} ${who.length === 1 ? "wants" : "want"} this. Got a double? Tap +.`; }
  else if (s) {
    text = `<b>${s === 1 ? "1 spare" : `${s} spares`}</b>, up for trade. ${who.length ? `Wanted by ${people(who)}.` : "Nobody's after it yet."}`;
    trade = who[0] || null; keep = n === 2 ? "Keep both" : `Keep all ${n}`;
  } else { text = `Keeping ${n === 2 ? "both" : `all ${n}`}, not up for trade.`; keep = n === 2 ? "Trade the extra" : "Trade the extras"; }
  if (out) { // one more copy is already spoken for, in the mail or about to be
    const t = traderOf(out), posted = out.ship.shipped != null;
    const line = `<b>One copy ${posted ? "on its way" : "to ship"}</b> to ${t.name}, ${posted ? `arriving ${wday(out, yourIn(out))}` : `by ${wday(out, out.ship.by)}`}.`;
    text = n <= 1 ? line : `${line} ${text}`;
    if (n <= 1) { trade = t; label = "Open the trade"; }
  }
  spareEl.hidden = !text;
  pSpareT.innerHTML = text;
  pTrade.hidden = !trade; if (trade) { pTrade.textContent = label || `Trade with ${trade.name}`; pTrade.dataset.t = trade.id; }
  pKeep.hidden = !keep; pKeep.textContent = keep;
}

// ----- the list: rows say what's in the mail; the trade section carries the shipment's thread and buttons -----
function lstate0(c) {
  if (!c.owned) return isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it";
  const b = c.base || c, n = nOf(b), s = sparesOf(b), who = wantedBy(b);
  if (n <= 1) return "Have it";
  if (!s) return `Have ${n}, keeping ${n === 2 ? "both" : "all"}`;
  return `Have ${n}, ${s} spare${who.length ? `, ${people(who)} want${who.length === 1 ? "s" : ""} it` : ""}`;
}
function lstateOf(c) {
  const id = (c.base || c).id, inn = shipIndex.in.get(id), out = shipIndex.out.get(id);
  if (inn && !c.owned) return `On its way from ${traderOf(inn).name}`;
  const s = lstate0(c);
  return out ? `${s}. One ${out.ship.shipped != null ? "on its way" : "to ship"} to ${traderOf(out).name}` : s;
}
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si], inn = shipIndex.in.get(c.id);
      if (inn) { // coming to you by post
        const t = traderOf(inn), th = theirSide(inn, t);
        return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice"><b class="ldeal">On its way</b></span><span class="lstate">From ${t.name}, ${theirPhrase(inn, t)}</span></div>${th.stage === 2 ? `<button type="button" class="pill-btn lgot" data-arrived="${recKey(inn)}">Got them</button>` : ""}</li>`;
      }
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}<p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
  }
  if (state.lens === "trade") top = tradeListHTML();
  const row = (c) => {
    const st = sets[c.si];
    return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${lstateOf(c)}</span></button></li>`;
  };
  const rows = (items) => `<ul>${items.map(row).join("")}</ul>`;
  listEl.querySelector("#list-body").innerHTML = top + trophyListHTML(show, rows) + groups.map((g) => {
    if (g.done) return "";
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}</p><ul>${items.map(row).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
function tradeListHTML() {
  const now = Date.now();
  const ts = TRADERS.filter((t) => wantsOf(t).length || threadOf(t).length).sort((a, b) => (shipOf(b) ? 1 : 0) - (shipOf(a) ? 1 : 0) || (activeOf(b) ? 1 : 0) - (activeOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length);
  const bl = tbList(), binder = `<section><h2>Trade binder</h2><p class="lsub">${bl.length ? `${bl.length} ${bl.length === 1 ? "card" : "cards"} you have a spare of, the most wanted first.` : "Empty for now. On a card you have, + adds a spare."}</p><ul>${bl.map((c) => {
    const st = sets[c.si], who = wantedBy(c), s = sparesOf(c);
    return `<li class="lwrow"><div class="lrow"><span class="lname">${esc(c.name)}</span><span class="lmeta">${esc(st.name)} #${c.num}, ${c.rname}</span><span class="lprice">${money(c.price)}</span><span class="lstate">${s > 1 ? `${s} spares. ` : ""}${who.length ? `${people(who)} ${who.length === 1 ? "wants" : "want"} it` : "No takers yet"}</span></div></li>`;
  }).join("")}</ul></section>`;
  // Online trades in the mail lead: what's moving, where it is, and the one button for your next step.
  const sh = shipping();
  const shipBtns = (r, t) => { const b = shipBar(r, t), btn = (x, primary) => (x ? `<button type="button" class="pill-btn${primary ? " primary" : ""}" data-${x.act === "ship" ? "ship" : "arrived"}="${recKey(r)}">${x.text}</button>` : ""); return btn(b.go, true) + btn(b.alt, false); };
  const mail = sh.length ? `<section><h2>In the mail</h2><p class="lsub">Online trades on their way. In this demo a day passes every 20 seconds, and Skip a day is in Settings.</p><ul>${sh.map((r) => {
    const t = traderOf(r), b = shipBar(r, t), acts = shipBtns(r, t), th = theirSide(r, t), yo = yourSide(r, t);
    return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">${esc(`You send ${names(toCards(r.give))}: ${[yo.stage ? "" : yo.line === "Ship today" ? "ship today" : `ship by ${wday(r, r.ship.by)}`, `in the mail, arrives ${wday(r, yourIn(r))}`, `${t.name} has them`][yo.stage]}. ${t.name} sends ${names(toCards(r.get))}: ${theirPhrase(r, t)}.`)}</span><span class="lprice"></span><span class="lstate">${esc(b.head)}</span>${acts ? `<div class="lacts">${acts}</div>` : ""}</div></li>`;
  }).join("")}</ul></section>` : "";
  return mail + binder + `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase. Each trade is a thread.</p><ul>${ts.map((t) => {
    const want = wantsOf(t), has = offersOf(t), rec = activeOf(t), sr = shipOf(t), recs = threadOf(t);
    const thread = recs.length ? `<ul class="lthread">${recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now, "li")).join("")).join("")}</ul>` : "";
    let acts = "";
    if (sr) acts = shipBtns(sr, t);
    else acts = rec?.state === "proposed" ? `<button type="button" class="pill-btn" data-back="${recKey(rec)}">Take back</button>`
      : rec?.state === "countered" ? `<button type="button" class="pill-btn primary" data-accept="${recKey(rec)}">Accept</button><button type="button" class="pill-btn" data-decline="${recKey(rec)}">Decline</button>`
      : want.length && has.length ? `<button type="button" class="pill-btn" data-propose="${t.id}">Propose ${want.length} for ${has.length}</button>` : "";
    const meta = sr ? `Online trade: ${names(toCards(sr.give))} for ${names(toCards(sr.get))}. ${recordText(t)}` : `${want.length ? `Wants ${names(want)} (${money(sumOf(want))}).` : "Wants nothing of yours right now."}${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}`;
    return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">${esc(meta)}</span><span class="lprice">${!sr && has.length && want.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${chipState(t).text}</span>${thread}${acts ? `<div class="lacts">${acts}</div>` : ""}</div></li>`;
  }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ship], [data-arrived]"); if (!b) return;
  const r = recOf(b.dataset.ship || b.dataset.arrived); if (!r) return;
  if (b.dataset.ship) openShip(r); else confirmArrival(r);
});

// ----- Settings: the demo clock, and Skip a day -----
{
  const done = document.getElementById("prefs-close").closest(".row");
  const lbl = Object.assign(document.createElement("p"), { className: "lbl", textContent: "Online trades" });
  const note = Object.assign(document.createElement("p"), { className: "shipnote", textContent: "Parcels take days, so this demo runs fast: a day passes every 20 seconds." });
  const row = document.createElement("div"); row.className = "row"; row.style.justifyContent = "flex-start";
  const btn = Object.assign(document.createElement("button"), { className: "btn", id: "skip-day", type: "button", textContent: "Skip a day" });
  btn.onclick = () => skipDay();
  row.append(btn); done.before(lbl, note, row);
}

// On load: shipments pick up where they were (anything that happened while you were away gets its row).
setTimeout(() => {
  reindex();
  for (const r of trades) if (r.ship && r.ship.arrived != null && !r.ship.landed && traderOf(r)) { for (const c of toCards(r.get)) landOne(c); arrivalDone(r, traderOf(r)); } // closed mid-flight
  shipTick();
  if (window.__w) Object.defineProperties(window.__w, { startTrade: { value: startTrade }, shipping: { value: shipping }, shipOf: { value: shipOf }, days: { value: days }, markShipped: { value: markShipped }, confirmArrival: { value: confirmArrival }, skipDay: { value: skipDay }, shipTick: { value: shipTick }, showPeek: { value: showPeek }, hidePeek: { value: hidePeek }, theirCardAt: { value: theirCardAt }, shipIndex: { value: shipIndex }, recordText: { value: recordText } });
}, 0);
