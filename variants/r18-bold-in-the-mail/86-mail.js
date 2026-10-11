// ---------- in the mail: trading online, and the mail on your wall (round 18, bold) ----------
// Online in the chooser opens the same table. Send offer sends it, the thread carries the reply, and an acceptance
// starts a short shipping lifecycle instead of the crossing: both of you ship by a date, Maya's parcel goes out on its
// own (seeded), you tap Mark shipped, each parcel is in the mail for a couple of days, then arrives.
// The new idea: the mail is on your wall. A card coming to you sits in its own empty slot as a ghost (its face, faint,
// a thin gold edge running round it as the parcel travels, dashed until it ships), at every level: a faint dot far
// out, a faint chip with a gold bar at arm's length, and "From Maya, arrives Thu" up close. When it arrives the ghost
// fills in solid with the arrival flash and the set's count ticks in gold. A card you've sent keeps a ghost of the
// copy behind its tile ("On its way to Maya") until it arrives, then the copy lifts away through the top edge and the
// count drops by one. In the Chase lens a card on its way reads as coming, not wanted.
// Shipping takes days, so the demo runs a clock: a day passes every 20 seconds while something is in the mail (and
// while the wall is open), and Settings has Skip a day. The record keeps its fields (how, mail) in wall-trades; the
// clock is in wall-mail-clock.

// ----- the demo clock -----
const MAIL_DAY = 20000, DAY_MS = 86400e3, MAIL_RATE = DAY_MS / MAIL_DAY;
const mclock = { cal: Date.now() };
try { const s = JSON.parse(localStorage.getItem("wall-mail-clock") || "null"); if (s && s.cal > 0) mclock.cal = s.cal; } catch { /* fresh */ }
const persistClock = () => { try { localStorage.setItem("wall-mail-clock", JSON.stringify({ cal: mclock.cal })); } catch { /* private mode */ } };
const inMail = () => trades.filter((r) => r.state === "mail" && r.mail);
if (!inMail().length) mclock.cal = Math.max(mclock.cal, Date.now());
const calOf = (rec, d) => rec.mail.t0 + d * DAY_MS; // the demo date of day d of this trade
const dayNow = (rec) => (mclock.cal - rec.mail.t0) / DAY_MS;
const midnight = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayDiff = (ms) => Math.round((midnight(ms) - midnight(mclock.cal)) / DAY_MS);
const wkday = (ms) => new Date(ms).toLocaleDateString("en-US", { weekday: "short" });
const dayWord = (ms) => { const k = dayDiff(ms); return k === 0 ? "today" : k === 1 ? "tomorrow" : wkday(ms); };
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const isAre = (list) => (list.length === 1 ? "is" : "are");

// ----- the record: { ..., how: "online", state: "mail", mail: { t0, shipBy, themShip, inTransit, outTransit, youShip, themShipped, inDone, outDone, had } } -----
for (const r of trades) if (r.state === "mail" && !r.mail) r.state = "done"; // a record whose mail went missing
const inArrive = (rec) => rec.mail.themShip + rec.mail.inTransit;
const outArrive = (rec) => rec.mail.youShip + rec.mail.outTransit;
const inProg = (rec) => (rec.mail.themShipped ? clamp((dayNow(rec) - rec.mail.themShip) / rec.mail.inTransit, 0, 1) : 0);
const outProg = (rec) => (rec.mail.youShip != null ? clamp((dayNow(rec) - rec.mail.youShip) / rec.mail.outTransit, 0, 1) : 0);
const mailRecOf = (t) => threadOf(t).filter((r) => r.state === "mail" && r.mail).pop() || null;
const shipDue = (t) => threadOf(t).find((r) => r.state === "mail" && r.mail && r.mail.youShip == null) || null;
// "by Thu", "today", or past the date
function shipWhen(rec) { const ms = calOf(rec, rec.mail.shipBy), k = dayDiff(ms); return k < 0 ? "as soon as you can" : k === 0 ? "today" : `by ${wkday(ms)}`; }
// Where the parcel coming to you is: "ships by Thu", "arrives tomorrow"
function inWhen(rec, t) {
  const m = rec.mail;
  if (m.inDone) return "arrived";
  if (!m.themShipped) return `${t.name} ships by ${wkday(calOf(rec, m.shipBy))}`;
  return `arrives ${dayWord(calOf(rec, inArrive(rec)))}`;
}
function outWhen(rec, t) {
  const m = rec.mail;
  if (m.outDone) return `${t.name} has it`;
  if (m.youShip == null) return `ship it ${shipWhen(rec)}`;
  return `reaches ${t.name} ${dayWord(calOf(rec, outArrive(rec)))}`;
}

// ----- which cards are in the mail: an index on the cards themselves, so a tile asks one property -----
let mailCards = [];
const outN = new Map(); // card id -> copies of it on their way out (they stop being spares)
function mailIndex() {
  for (const c of mailCards) { c.mailIn = null; c.mailOut = null; }
  mailCards = []; outN.clear();
  for (const rec of trades) {
    if (rec.state !== "mail" || !rec.mail) continue;
    const t = traderOf(rec); if (!t) continue;
    if (!rec.mail.inDone) for (const c of toCards(rec.get)) { c.mailIn = { rec, t }; c.deal = null; c.noDeal = true; mailCards.push(c); } // coming, not wanted: no deals
    if (!rec.mail.outDone) for (const c of toCards(rec.give)) { c.mailOut = { rec, t }; outN.set(c.id, (outN.get(c.id) || 0) + 1); mailCards.push(c); }
  }
  // What she has sent you, or is about to, is no longer one of her spares.
  for (const t of TRADERS) {
    const gone = new Set();
    for (const rec of threadOf(t)) if (rec.how === "online" && (rec.state === "mail" || rec.state === "done")) for (const id of rec.get) gone.add(id);
    if (gone.size) t.spares = t.spares.filter((c) => !gone.has(c.id));
  }
}
mailIndex();
// A copy on its way out is spoken for: the spares map (a view of the counts, 77-copies.js) leaves it out.
const spares77 = spares;
const spareLeft = (c) => sparesOf(c) - (outN.get(c.id) || 0) > 0;
spares = new Proxy({}, {
  get: (_, id) => { const c = typeof id === "string" ? poolById.get(id) : null; return c ? spareLeft(c) : undefined; },
  has: (_, id) => { const c = typeof id === "string" ? poolById.get(id) : null; return Boolean(c && spareLeft(c)); },
  set: (_, id, v) => { spares77[id] = v; return true; },
  deleteProperty: () => true,
  ownKeys: () => pool.filter(spareLeft).map((c) => c.id),
  getOwnPropertyDescriptor: (_, id) => { const c = poolById.get(id); return c && spareLeft(c) ? { value: true, writable: true, enumerable: true, configurable: true } : undefined; },
});

// ----- starting a trade: In person or Online. An offer out, or a parcel in the mail, skips the question -----
const howOnline = howEl.querySelector('[data-how="online"]'), howPerson = howEl.querySelector('[data-how="person"]');
howOnline.removeAttribute("aria-disabled");
howOnline.querySelector(".soon")?.replaceWith(Object.assign(document.createElement("span"), { className: "tick", textContent: "›" }));
howOnline.querySelector(".tick").setAttribute("aria-hidden", "true");
function startTrade(t, from) {
  if (tbl.on || state.trans) return;
  const a = activeOf(t) || mailRecOf(t);
  if (a) { openTable(t, from); if (tbl.on) { tbl.how = a.how || "person"; updateTradeBar(); } return; }
  howPend = { t, from }; howHead.textContent = `Trade with ${t.name}`; howEl.hidden = false; tick(4);
  howPerson.focus();
}
// (The wall can still be mid-morph under the menu, from a lens change or a deal: the table waits for it rather than doing nothing.)
const openHow = (how, p = howPend, tries = 0) => {
  hideHow(); if (!p || tbl.on) return;
  if (state.trans && tries < 30) { setTimeout(() => openHow(how, p, tries + 1), 80); return; }
  openTable(p.t, p.from); if (tbl.on) { tbl.how = how; updateTradeBar(); }
};
howPerson.onclick = () => openHow("person");
howOnline.onclick = () => openHow("online");
const howNow = () => (tbl.rec && tbl.rec.how) || tbl.how || (tbl.t && mailRecOf(tbl.t)?.how) || "person";

// Send offer: the handshake, online. The record remembers how it was made.
function shake() {
  if (!tbl.on || tbl.phase !== "open" || !tbl.give.length || !tbl.get.length || tbl.shake) return;
  const t = tbl.t, give = tbl.give.map((c) => c.id), get = tbl.get.map((c) => c.id), now = Date.now(), online = howNow() === "online";
  const back = tbl.rec && tbl.rec.state === "countered" && trades.includes(tbl.rec) ? tbl.rec : null;
  let rec = back;
  if (rec) { rec.log.push({ by: "you", kind: "counter", give, get, at: now }); rec.give = give; rec.get = get; rec.at = now; rec.state = "proposed"; }
  else { rec = { t: t.id, at: now, state: "proposed", give, get, log: [{ by: "you", kind: "offer", give, get, at: now }] }; if (online) rec.how = "online"; trades.push(rec); }
  persistTrades(); scheduleReply(rec); tbl.rec = rec; tbl.note = null; tick(24);
  toast(`${back ? "Countered to" : online ? "Sent to" : "Proposed to"} ${t.name}: ${give.length} of yours for ${get.length} of ${t.name}'s. ${balanceText(tbl.get, tbl.give, t)}.`, () => takeBack(rec));
  for (const c of [...tbl.get, ...tbl.give]) c.tcur ||= targetRect(c);
  setPhase("waiting"); drawList();
}

// ----- accepted: in person the cards cross; online the mail starts -----
function accept(rec, t, by) {
  const now = Date.now();
  rec.state = "accepted"; rec.by = by; rec.log.push({ by, kind: "accept", at: now });
  if (rec.how !== "online") {
    persistTrades();
    if (onTable(t)) { tbl.rec = rec; playAccept(by); }
    else { if (by === "them") replyEvent(rec, t, `${t.name} accepted`); crossOnWall(rec, t); }
    drawList(); return;
  }
  startMail(rec, t);
  const give = toCards(rec.give), get = toCards(rec.get);
  if (onTable(t)) mailOnTable(rec, t, by);
  else {
    replyEvent(rec, t, `${t.name} accepted`); // the ghosts flash where they'll land
    toast(`${by === "them" ? `${t.name} accepted. ` : ""}Ship ${names(give)} ${shipWhen(rec)}. ${names(get)} ${isAre(get)} on your wall, on the way.`, () => showThread(t), "Open");
  }
  if (lifted) liftLayout(true);
  syncBadge(); drawList(); kick();
}
function startMail(rec, t) {
  if (!inMail().length) mclock.cal = Math.max(mclock.cal, Date.now());
  mailLast = Date.now();
  const s = (k) => h32(`${t.id}|${rec.at}|mail|${k}`);
  rec.state = "mail";
  rec.mail = { t0: mclock.cal, shipBy: 2, themShip: 0.3 + 0.8 * s("ship"), inTransit: 1.5 + s("in"), outTransit: 1.5 + s("out"), youShip: null, themShipped: false, inDone: false, outDone: false, had: rec.get.filter((id) => byId.get(id)?.owned) };
  persistTrades(); persistClock(); mailIndex();
}
// On the table: the cards stay put with "Maya accepted" between them, then the table closes and what's coming flies
// into its own slots on the wall as ghosts.
function mailOnTable(rec, t, by) {
  tbl.rec = rec; tbl.mailRec = rec; tbl.acceptBy = by; tbl.done = { give: tbl.give.slice(), get: tbl.get.slice() }; tbl.settled = true;
  tick(24); setPhase("accepting");
  setTimeout(() => { if (tbl.on && tbl.mailRec === rec && !tbl.closing) closeTable(); }, 2000);
}
function mailHome(rec) {
  tbl.mailRec = null;
  layoutAll();
  for (const c of toCards(rec.get)) { const i = tbl.theirs.indexOf(c); if (i < 0) continue; tbl.theirs.splice(i, 1); tbl.yours.push(c); c.away = true; c.e = 0; c.handed = false; c.held = false; }
  for (const c of tbl.yours) c.o = tbHome(c);
  const t = traderOf(rec), give = toCards(rec.give);
  setTimeout(() => toast(`Ship ${names(give)} to ${t.name} ${shipWhen(rec)}.`, () => markShipped(rec), "Shipped"), reduced ? 0 : 500);
}
function closeTable(instant = false) {
  if (!tbl.on || tbl.closing) return;
  if (tbl.phase === "accepting" && !tbl.settled) { settleTrade(true); return; }
  if (tbl.mailRec) mailHome(tbl.mailRec);
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
  tbl.on = false; tbl.closing = false; tbl.anim = null; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.handed = []; tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.done = null; tbl.how = null; tbl.mailRec = null;
  tradebarEl.classList.remove("three");
  document.body.classList.remove("trading"); setChrome(); kick();
}

// ----- Mark shipped -----
function markShipped(rec) {
  const m = rec?.mail; if (!m || m.youShip != null || rec.state !== "mail") return;
  const t = traderOf(rec), give = toCards(rec.give);
  m.youShip = dayNow(rec); rec.log.push({ by: "you", kind: "shipped", at: Date.now() }); persistTrades();
  for (const c of give) flashTile(c);
  tick(10); toast(`Shipped. ${names(give)} ${give.length === 1 ? "reaches" : "reach"} ${t.name} ${dayWord(calOf(rec, outArrive(rec)))}.`);
  mailChanged(t);
}
function mailChanged(t) {
  if (tbl.on && tbl.t === t) updateTradeBar();
  if (state.focus) fillPanel(state.focus, 0);
  drawList(); kick();
}

// ----- the clock runs, and the mail moves (one event a second at most, never on a moving wall) -----
let mailLast = Date.now();
const mailBusy = () => Boolean(wel.on || tbl.on || bnd.on || room.on || state.trans || shuffle || gesture || fly || inertia || pop.c || crossing || state.press || marking || flights.length || paying());
function mailTick() {
  const now = Date.now(), dt = clamp(now - mailLast, 0, 2500); mailLast = now;
  const live = inMail();
  if (!live.length) { if (mclock.cal < now) mclock.cal = now; return; }
  mclock.cal += dt * MAIL_RATE; persistClock();
  for (const rec of live) if (mailStep(rec)) break;
  kick(); // the edges move
}
function mailStep(rec) {
  const t = traderOf(rec), m = rec.mail, d = dayNow(rec);
  if (!t) return false;
  if (!m.themShipped && d >= m.themShip) {
    m.themShipped = true; rec.log.push({ by: "them", kind: "shipped", at: Date.now() }); persistTrades();
    const get = toCards(rec.get);
    for (const c of get) flashTile(c);
    toast(`${t.name} shipped ${names(get)}. ${get.length === 1 ? "It arrives" : "They arrive"} ${dayWord(calOf(rec, inArrive(rec)))}.`, () => showThread(t), "Open");
    mailChanged(t); return true;
  }
  if (mailBusy()) return false;
  if (m.themShipped && !m.inDone && d >= inArrive(rec)) { arriveIn(rec, t); return true; }
  if (m.youShip != null && !m.outDone && d >= outArrive(rec)) { arriveOut(rec, t); return true; }
  return false;
}
function mailFinish(rec) {
  const m = rec.mail;
  if (!m.inDone || !m.outDone) return false;
  rec.state = "done"; rec.doneAt = calOf(rec, Math.max(inArrive(rec), outArrive(rec)));
  return true;
}
// Coming to you: the ghost fills in solid where it sits, with the arrival flash, and the count ticks.
function arriveIn(rec, t) {
  const m = rec.mail, get = toCards(rec.get), now = performance.now();
  m.inDone = true; rec.log.push({ by: "them", to: "you", kind: "arrived", at: Date.now() });
  const done = mailFinish(rec);
  const fresh = get.filter((c) => !c.owned);
  for (const c of get) { delete chasing[c.id]; if (c.owned && m.had.includes(c.id)) setN(c, nOf(c) + 1); }
  persistTrades(); persistChase(); persistCopies(); mailIndex();
  const c0 = fresh[0] || get[0], st = sets[c0.si], n = ownedIn(st.cards) + fresh.filter((c) => c.si === c0.si).length;
  toast(`${names(get)} arrived from ${t.name}. ${n} of ${st.cards.length} in ${st.name}.${done ? " That's the trade done." : ""}`);
  fresh.forEach((c, i) => { quietLayout = i < fresh.length - 1; setOwned(c, true, { quiet: true }); quietLayout = false; });
  for (const c of get) {
    for (const x of [c, ...twinsOf(c)]) { x.anim = null; x.flash = { t0: now, gold: true }; }
    c.mailFill = reduced ? 0 : now; c.mailFrom = { rec, t };
    const g = groups[c.g]; if (g) g.beat = { t0: now, text: panelStat(g), col: theme.gold };
  }
  if (!fresh.length) { relayoutSoon(); updateCount(); }
  live.until = Math.max(live.until, now + 1600);
  tick(14); syncBadge(); mailChanged(t);
}
// Gone to them: the copy left behind lifts away through the top edge, and the count drops by one.
function arriveOut(rec, t) {
  const m = rec.mail, give = toCards(rec.give), now = performance.now(), still = [];
  m.outDone = true; rec.log.push({ by: "them", to: "them", kind: "arrived", at: Date.now() });
  const done = mailFinish(rec);
  mailIndex();
  const show = !reduced && !document.body.classList.contains("listmode");
  quietLayout = true;
  give.forEach((c, i) => {
    if (show) flyCard(c, true, now + i * 90, 720, null);
    if (nOf(c) > 1) { setN(c, nOf(c) - 1); still.push(c); } else if (c.owned) setOwned(c, false, { quiet: true });
  });
  quietLayout = false;
  persistCopies(); persistTrades(); syncBadge(); updateCount(); relayoutSoon();
  toast(`${names(give)} reached ${t.name}.${still.length ? ` You have ${still.length === 1 ? `${nOf(still[0])} left` : "the rest"}.` : ""}${done ? " That's the trade done." : ""}`);
  tick(10); mailChanged(t);
}
setInterval(mailTick, 1000);

// ----- Skip a day, in Settings -----
const prefsRow = prefs.querySelector("#prefs-close").closest(".row");
prefsRow.insertAdjacentHTML("beforebegin", `<p class="lbl">Trading online</p><p class="mailnote" id="mail-note">In this demo a day passes every 20 seconds while something is in the mail.</p><div class="row" style="justify-content:flex-start"><button class="btn" id="mail-skip">Skip a day</button></div>`);
function skipDay() {
  if (!inMail().length) { toast("Nothing in the mail. Trade online and the days start to pass."); return; }
  mclock.cal += DAY_MS; persistClock(); mailLast = Date.now();
  prefs.close();
  toast(`A day passed. It's ${wkday(mclock.cal)} in the demo.`);
  for (const rec of inMail()) if (mailStep(rec)) break;
  kick();
}
document.getElementById("mail-skip").onclick = skipDay;
about.querySelector("ul")?.insertAdjacentHTML("beforeend", `<li><b>Online trades go by mail.</b> Choose Online when you start a trade and Send offer. Once it's accepted, what's coming sits faint in its own slot on your wall, its gold edge filling as the parcel travels, and fills in when it arrives. Mark shipped when you post yours. In this demo a day passes every 20 seconds; Settings has Skip a day.</li>`);
document.getElementById("reset").addEventListener("click", () => { try { localStorage.removeItem("wall-mail-clock"); } catch { /* fine */ } });

// ----- drawing: the ghost coming in, the ghost of the copy going out -----
function ghostAlpha(c, mult, now) {
  let a = mult * c.e * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1);
  if (state.introT0 && !reduced) a *= clamp((now - state.introT0 - c.intro) / 360, 0, 1);
  return a;
}
// A card on its way to you, in its own slot: the face, faint, and the parcel's progress.
function drawGhostIn(c, mi, sx, sy, w, h, now, mult) {
  const a = ghostAlpha(c, mult, now); if (a < 0.02) return;
  const value = state.value && !state.matches, col = value ? heat(c.price) : typeColor(c), p = inProg(mi.rec);
  if (w < 5) { ctx.globalAlpha = a * 0.45; ctx.fillStyle = col; ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); ctx.globalAlpha = 1; return; }
  if (w < 26) { // a faint chip, the parcel a gold bar along its foot
    const round = w >= 12, r = w * 0.09;
    ctx.globalAlpha = a; ctx.fillStyle = theme.slot;
    if (round) { rr(sx, sy, w, h, r); ctx.fill(); } else ctx.fillRect(sx, sy, w, h);
    ctx.globalAlpha = a * 0.36; ctx.fillStyle = col;
    if (round) ctx.fill(); else ctx.fillRect(sx, sy, w, h);
    ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.strokeStyle = theme.gold; ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1); // a gold hairline: in the mail
    const bh = Math.max(2, h * 0.14);
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = theme.gold; ctx.fillRect(sx, sy + h - bh, w, bh);
    if (p > 0) { ctx.globalAlpha = a; ctx.fillRect(sx, sy + h - bh, w * p, bh); }
    ctx.globalAlpha = 1; return;
  }
  const r = w * 0.045;
  ctx.globalAlpha = a; rr(sx, sy, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.globalAlpha = a * 0.34; foilOff = true; cardFace(c, sx, sy, w, h, now, value); foilOff = false;
  // the edge: dashed until it ships, then gold runs round the card as the parcel travels
  const lw = clamp(w * 0.022, 1.5, 3.5);
  ctx.globalAlpha = a; ctx.lineWidth = lw; rr(sx + lw / 2, sy + lw / 2, w - lw, h - lw, r);
  if (p <= 0) { ctx.setLineDash([lw * 2.2, lw * 2.2]); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  else { ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); const L = 2 * (w + h); ctx.setLineDash([L * p, L]); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  ctx.setLineDash([]);
  if (w >= 70) {
    const pad = w * 0.08;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = theme.ink; font(800, w * 0.088, true); ctx.fillText(fitText(`From ${mi.t.name}`, w - pad * 2), sx + pad, sy + pad + w * 0.085);
    ctx.fillStyle = theme.muted; font(600, w * 0.068); ctx.fillText(fitText(cap1(inWhen(mi.rec, mi.t)), w - pad * 2), sx + pad, sy + pad + w * 0.18);
  }
  ctx.globalAlpha = 1;
}
// A copy of yours on its way out: a ghost of it behind the tile, its top and right edge the parcel's progress.
function drawGhostOut(c, mo, sx, sy, w, h, now, mult) {
  const a = ghostAlpha(c, mult, now); if (a < 0.02) return;
  const o = clamp(w * 0.075, 3, 12), x = sx + o, y = sy - o, r = w * 0.045, p = outProg(mo.rec);
  ctx.globalAlpha = a; rr(x, y, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.globalAlpha = a * 0.38; foilOff = true; cardFace(c, x, y, w, h, now, state.value && !state.matches); foilOff = false;
  const lw = clamp(w * 0.022, 1.5, 3);
  ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + r, y + lw / 2); ctx.lineTo(x + w - lw / 2, y + lw / 2); ctx.lineTo(x + w - lw / 2, y + h - r);
  if (p <= 0) { ctx.setLineDash([lw * 2.2, lw * 2.2]); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  else { ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); const L = w + h; ctx.setLineDash([L * p, L]); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  ctx.setLineDash([]); ctx.lineCap = "butt"; ctx.globalAlpha = 1;
}
// At arm's length a tile that's in the mail carries the parcel as a gold bar along its foot.
function mailBar(c, p, sx, sy, w, h, now, mult) {
  const a = ghostAlpha(c, mult, now); if (a < 0.02) return;
  const bh = Math.max(2, h * 0.14);
  ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.strokeStyle = theme.gold; ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
  ctx.fillStyle = theme.bg; ctx.fillRect(sx, sy + h - bh, w, bh);
  ctx.fillStyle = theme.gold; ctx.globalAlpha = a * 0.35; ctx.fillRect(sx, sy + h - bh, w, bh);
  if (p > 0) { ctx.globalAlpha = a; ctx.fillRect(sx, sy + h - bh, w * p, bh); }
  ctx.globalAlpha = 1;
}
// The base tile with the mail on it (the rest is 40-render.js's drawTile as it was).
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  const b = c.base || c, mi = b.mailIn, mo = b.mailOut, plain = state.time || (c.lift && w > h * 1.05);
  const ghost = mi && !b.owned && !plain;
  if (ghost) drawGhostIn(c, mi, sx, sy, w, h, now, mult);
  else if (b.mailFill && !plain && now - b.mailFill < 600) { // arrived: the card fills the ghost from the middle
    const k = clamp((now - b.mailFill) / 600, 0, 1), e = 1 - Math.pow(1 - k, 3);
    drawGhostIn(c, b.mailFrom, sx, sy, w, h, now, mult);
    ctx.save(); ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, Math.max(1, Math.hypot(w, h) / 2 * e), 0, Math.PI * 2); ctx.clip();
    drawTile0(c, sx, sy, w, h, now, mult);
    ctx.restore();
  } else {
    if (b.mailFill) b.mailFill = 0;
    if (mo && !plain && w >= 26) drawGhostOut(c, mo, sx, sy, w, h, now, mult);
    drawTile0(c, sx, sy, w, h, now, mult);
    if (!plain && w >= 5 && w < 26 && (mo || mi)) mailBar(c, mo ? outProg(mo.rec) : inProg(mi.rec), sx, sy, w, h, now, mult);
  }
  // Inside a set the cards people chase wear a gold corner.
  if (c.pop && view === "set" && groups[c.g]?.set && w >= 14 && c.e > 0.3 && (!state.focus || state.focus === c)) {
    const s = clamp(w * 0.36, 4, 18), r = w >= 26 ? w * 0.045 : 0;
    ctx.globalAlpha = Math.min(1, mult) * c.e * 0.8; ctx.fillStyle = theme.gold;
    ctx.beginPath(); ctx.moveTo(sx + w - s, sy); ctx.lineTo(sx + w - r, sy); ctx.lineTo(sx + w, sy + r); ctx.lineTo(sx + w, sy + s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // In the Need lens the cards you're chasing stand out further still: a gold ring (not one already on its way).
  if (state.lens === "need" && !c.owned && !ghost && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
    ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
  }
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = col; ctx.globalAlpha = a * tint;
  if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
  if (fp) {
    const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col;
    rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// The Trade lens keeps what's in the mail in full, either way.
function emphasis(c) {
  if (c.away) return 0;
  if (preview) return preview.has(c.base || c) ? (c.owned ? 0.42 : 1) : 0.1;
  if (state.matches) return state.matches.has(rootOf(c)) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.1 : 1;
  if (state.lens === "chase") return isChase(c) ? 1 : 0.18;
  if (state.lens === "trade") { const b = c.base || c; return isSpare(c) || b.mailIn || b.mailOut ? 1 : 0.18; }
  return 1;
}

// ----- the Chase lens: a chased card on its way reads as coming, not wanted -----
function drawFeedTile(c, x, y, w, h, a, now = performance.now()) {
  const b = c.base || c;
  if (b.mailIn && !b.owned) return drawComingTile(c, b.mailIn, x, y, w, h, a, now);
  const st = sets[c.si], deal = Boolean(c.deal), rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = deal ? dealTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = deal ? 1.5 : 1; ctx.strokeStyle = deal ? theme.deal : theme["slot-line"]; ctx.stroke();
  if (w < 60) { ctx.globalAlpha = 1; return; }
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
let comingKey = "", comingVal = "";
function comingTint() { const k = theme["panel-solid"] + theme.gold; if (k !== comingKey) { comingKey = k; comingVal = mix(theme["panel-solid"], theme.gold, theme.dark ? 0.1 : 0.07); } return comingVal; }
function drawComingTile(c, mi, x, y, w, h, a, now) {
  const st = sets[c.si], rad = Math.min(12, w * 0.07), p = inProg(mi.rec);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = comingTint(); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = theme.gold;
  if (p <= 0) ctx.setLineDash([4, 4]);
  ctx.stroke(); ctx.setLineDash([]);
  if (w < 60) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.05), s = clamp(w / 177, 0.6, 1.3);
  const mh = h - pad * 2, mw = mh * TW / TH;
  rr(x + pad, y + pad, mw, mh, mw * 0.045); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.globalAlpha = a * 0.36; foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  const tx = x + pad + mw + pad, tw = x + w - pad - tx;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const m = mi.rec.mail, when = m.themShipped ? `Arrives ${wkday(calOf(mi.rec, inArrive(mi.rec)))}` : `Ships by ${wkday(calOf(mi.rec, m.shipBy))}`;
  ctx.fillStyle = theme.gold; font(800, 19 * s); ctx.fillText(fitText("Coming", tw), tx, y + pad + 16 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`from ${mi.t.name}`, tw), tx, y + pad + 31 * s);
  ctx.fillStyle = theme.ink; font(700, 11.5 * s); ctx.fillText(fitText(when, tw), tx, y + pad + 46 * s);
  const by = y + pad + 52 * s, bh = Math.max(2, 3 * s);
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(tx, by, tw, bh);
  if (p > 0) { ctx.fillStyle = theme.gold; ctx.fillRect(tx, by, tw * p, bh); }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}
// Tapping a card on its way: not the offers online, the trade it's coming in.
function popCard(c, from) {
  if (pop.c) return;
  const b = c.base || c;
  if (b.mailIn && !b.owned) { const { rec, t } = b.mailIn; tick(4); cancelPress(); toast(`${c.name} is on its way from ${t.name}: ${inWhen(rec, t)}.`, () => showThread(t), "Open"); return; }
  hideCaption(); cancelPress();
  pop.c = c; pop.from = from; pop.t0 = performance.now(); pop.closing = false;
  oKind = "single"; fillOffers(c);
  offersEl.inert = false; document.body.classList.add("offering");
  lookedAt(c);
  tick(5); kick();
}

// ----- the card up close: where its parcel is -----
function updateFlag(c) {
  flag0(c);
  const b = c.base || c, dl = document.getElementById("p-deal"), buy = document.getElementById("p-buy"), mi = b.mailIn, mo = b.mailOut;
  dl.classList.remove("mailline"); delete buy.dataset.mail; delete pTrade.dataset.ship;
  if (mi) {
    dl.hidden = false; dl.classList.add("mailline");
    dl.textContent = `${b.owned ? "Another copy" : "On its way"} from ${mi.t.name}: ${inWhen(mi.rec, mi.t)}.`;
    if (!b.owned) { buy.textContent = "See the trade"; buy.dataset.mail = mi.t.id; }
  }
  if (mo && b.owned) {
    const m = mo.rec.mail;
    spareEl.hidden = false; pKeep.hidden = true;
    pSpareT.innerHTML = m.youShip == null ? `<b>One copy is going to ${esc(mo.t.name)}.</b> Ship it ${shipWhen(mo.rec)}.` : `<b>One copy is on its way to ${esc(mo.t.name)}</b>, ${outWhen(mo.rec, mo.t).replace(/^reaches \S+ /, "arriving ")}.`;
    pTrade.hidden = m.youShip != null;
    if (m.youShip == null) { pTrade.textContent = "Mark shipped"; pTrade.dataset.ship = recKey(mo.rec); }
  }
}
// 64-chase.js's updateFlag as it was.
function flag0(c) {
  const owned = c.owned;
  flagBtn.hidden = owned; stepEl.hidden = !owned;
  if (!owned) {
    const on = isChase(c);
    flagBtn.textContent = on ? "Chasing ✓" : "Chase it"; flagBtn.classList.toggle("on", on); flagBtn.setAttribute("aria-pressed", String(on));
    spareEl.hidden = true; return;
  }
  const meta = document.getElementById("p-meta"); meta.textContent = meta.textContent.replace(" You have a spare.", "");
  const b = c.base || c, n = nOf(b), s = sparesOf(b), who = wantedBy(b);
  pN.textContent = `You have ${n}`; pLess.disabled = n <= 1; pMore.disabled = n >= 99;
  stepEl.classList.toggle("spare", s > 0);
  let text = "", trade = null, keep = "";
  if (n <= 1) { if (who.length) text = `${people(who)} ${who.length === 1 ? "wants" : "want"} this. Got a double? Tap +.`; }
  else if (s) {
    text = `<b>${s === 1 ? "1 spare" : `${s} spares`}</b>, up for trade. ${who.length ? `Wanted by ${people(who)}.` : "Nobody's after it yet."}`;
    trade = who[0] || null; keep = n === 2 ? "Keep both" : `Keep all ${n}`;
  } else { text = `Keeping ${n === 2 ? "both" : `all ${n}`}, not up for trade.`; keep = n === 2 ? "Trade the extra" : "Trade the extras"; }
  spareEl.hidden = !text;
  pSpareT.innerHTML = text;
  pTrade.hidden = !trade; if (trade) { pTrade.textContent = `Trade with ${trade.name}`; pTrade.dataset.t = trade.id; }
  pKeep.hidden = !keep; pKeep.textContent = keep;
}
pTrade.onclick = () => {
  if (pTrade.dataset.ship) { const r = recOf(pTrade.dataset.ship); if (r) markShipped(r); return; }
  const t = TRADERS.find((x) => x.id === pTrade.dataset.t); if (t) tradeWith(t);
};
document.getElementById("p-buy").onclick = () => {
  const c = state.focus; if (!c) return;
  const buy = document.getElementById("p-buy");
  if (buy.dataset.mail) { const t = TRADERS.find((x) => x.id === buy.dataset.mail); unfocus(); if (t) showThread(t); return; }
  const st = sets[c.si];
  if (c.owned) { unfocus(); return flyTo(fitCam(groups[c.g]), 460); }
  window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`pokemon ${c.name} ${c.num}/${st.printed} ${st.name}`)}&_sop=15`, "_blank", "noopener");
};

// ----- the thread and the chip carry the mail -----
function rowsOf(rec, t) {
  const rows = [];
  for (const e of rec.log) {
    const you = e.by === "you";
    if (e.kind === "offer" || e.kind === "counter") { const g = toCards(e.give), k = toCards(e.get); rows.push({ who: you ? "you" : "them", lead: you ? (e.kind === "offer" ? (rec.how === "online" ? "You sent" : "You proposed") : "You countered") : `${t.name} countered`, text: `${names(g)} for ${names(k)}. ${balanceText(k, g, t)}.`, at: e.at }); }
    else if (e.kind === "accept") rows.push({ who: you ? "you" : "them", lead: you ? "You accepted" : `${t.name} accepted`, text: "", at: e.at });
    else if (e.kind === "decline") rows.push({ who: you ? "you" : "them", lead: you ? "You declined" : `${t.name} declined`, text: you ? "" : e.reason || "", at: e.at });
    else if (e.kind === "shipped" && rec.mail) {
      const list = toCards(you ? rec.give : rec.get), eta = calOf(rec, you ? outArrive(rec) : inArrive(rec));
      rows.push({ who: you ? "you" : "them", lead: you ? "You shipped" : `${t.name} shipped`, text: `${names(list)}. ${you ? `Reaches ${t.name}` : "Arrives"} ${wkday(eta)}.`, at: null });
    } else if (e.kind === "arrived" && rec.mail) {
      const mine = e.to === "you", list = toCards(mine ? rec.get : rec.give);
      rows.push({ who: mine ? "them" : "you", lead: mine ? "Arrived" : `${t.name} received`, text: mine ? `${names(list)} ${isAre(list)} in your binder.` : `${names(list)}.`, at: null });
    }
  }
  if (rec.state === "done" || rec.state === "accepted") rows.push({ who: "sys", lead: "", text: `Traded ${dayOf(rec.doneAt || Date.now())}.`, at: null });
  if (rec.state === "proposed") rows.push({ who: "wait", lead: "", text: `Waiting on ${t.name}`, at: null });
  if (rec.state === "mail" && rec.mail) rows.push({ who: "wait", lead: "", text: mailWait(rec, t), at: null });
  return rows;
}
function mailWait(rec, t) {
  const m = rec.mail, give = toCards(rec.give), get = toCards(rec.get);
  if (m.youShip == null) return `Ship ${names(give)} ${shipWhen(rec)}`;
  if (!m.inDone) return `${names(get)}: ${inWhen(rec, t)}`;
  return `${names(give)} ${outWhen(rec, t)}`;
}
function chipState(t) {
  const rec = lastOf(t), wants = wantsOf(t).length, has = offersOf(t).length, mrec = mailRecOf(t);
  if (rec?.state === "proposed") return { text: `Waiting on ${t.name}`, col: theme.gold };
  if (rec?.state === "countered") return { text: `${t.name} countered`, col: theme.deal, dot: true };
  if (mrec) {
    const m = mrec.mail;
    if (m.youShip == null) return { text: cap1(`ship ${shipWhen(mrec)}`), col: theme.gold, dot: true };
    if (!m.inDone) return { text: cap1(inWhen(mrec, t)), col: theme.gold };
    return { text: "In the mail", col: theme.gold };
  }
  if (rec?.state === "done" || rec?.state === "accepted") return { text: `Traded ${dayOf(rec.doneAt || Date.now())}`, col: theme.deal };
  if (wants) return { text: `Wants ${wants} of yours`, col: theme.gold };
  return { text: `Has ${has} you chase`, col: theme.deal };
}
function updateTradeBar() {
  const t = tbl.t; if (!t) return;
  renderThread(t);
  const ph = tbl.phase, give = tbl.give.length, get = tbl.get.length, bal = give && get ? balanceText(tbl.get, tbl.give, t) : "";
  const online = howNow() === "online", send = online ? "Send offer" : "Shake hands", mrec = mailRecOf(t);
  tbGo.hidden = false; tbGo.disabled = false; tbGo.textContent = send; tbTake.hidden = tbDec.hidden = tbAlt.hidden = true;
  tradebarEl.classList.toggle("three", ph === "countered");
  if (ph === "waiting") { tbHead.textContent = `Waiting on ${t.name}`; tbSub.textContent = `${give} of yours for ${get} of ${t.name}'s. ${bal}`; tbGo.hidden = true; tbTake.hidden = false; }
  else if (ph === "countered") { tbHead.textContent = `${t.name} countered`; tbSub.textContent = `${tbl.rec ? moveText(tbl.rec, t) : ""}. ${bal}`; tbGo.textContent = "Accept"; tbDec.hidden = false; tbAlt.hidden = false; }
  else if (ph === "accepting" && tbl.rec?.mail) { const r = tbl.rec, g = toCards(r.give), k = toCards(r.get); tbHead.textContent = tbl.acceptBy === "you" ? "You accepted" : `${t.name} accepted`; tbSub.textContent = `Ship ${names(g)} ${shipWhen(r)}. ${names(k)} will show on your wall.`; tbGo.hidden = true; }
  else if (ph === "accepting") { const got = tbl.done ? tbl.done.get : tbl.get; tbHead.textContent = `Traded with ${t.name}`; tbSub.textContent = `${names(got)} ${got.length === 1 ? "is" : "are"} yours`; tbGo.hidden = true; }
  else if (!give && !get && mrec) {
    const m = mrec.mail, g = toCards(mrec.give), k = toCards(mrec.get);
    if (m.youShip == null) { tbHead.textContent = `Ship ${names(g)} to ${t.name}`; tbSub.textContent = `${cap1(shipWhen(mrec))}. ${names(k)}: ${inWhen(mrec, t)}.`; tbGo.textContent = "Mark shipped"; }
    else { tbHead.textContent = "In the mail"; tbSub.textContent = `${m.inDone ? `${names(k)} arrived` : `${names(k)}: ${inWhen(mrec, t)}`}. ${names(g)}: ${outWhen(mrec, t)}.`; tbGo.disabled = true; }
  }
  else if (!give && !get && tbl.note) { tbHead.textContent = `${t.name} declined`; tbSub.textContent = tbl.note; tbGo.disabled = true; }
  else if (!give && !get) { tbHead.textContent = `Trade with ${t.name}${online ? " online" : ""}`; tbSub.textContent = "Drag a card from either side onto the table"; tbGo.disabled = true; }
  else if (give && get) { tbHead.textContent = bal; tbSub.textContent = `${online && !tbl.rec ? "By mail: " : ""}${give} of yours for ${get} of ${t.name}'s${tbl.rec ? `. ${send} sends your counter` : ""}`; tbGo.disabled = Boolean(tbl.shake); }
  else if (get) { tbHead.textContent = `${get} of ${t.name}'s on the table`; tbSub.textContent = "Add one of yours to make it a trade"; tbGo.disabled = true; }
  else { tbHead.textContent = `${give} of yours on the table`; tbSub.textContent = `Add one of ${t.name}'s to make it a trade`; tbGo.disabled = true; }
}
tbGo.onclick = () => {
  if (tbl.phase === "countered" && tbl.rec) { acceptCounter(tbl.rec); return; }
  const due = tbl.t && shipDue(tbl.t);
  if (tbl.phase === "open" && !tbl.give.length && !tbl.get.length && due) { markShipped(due); return; }
  shake();
};

// ----- the list: the same mail in words, with Mark shipped -----
function lstateOf(c) {
  const b = c.base || c;
  if (b.mailIn && !b.owned) return `On its way from ${b.mailIn.t.name}, ${inWhen(b.mailIn.rec, b.mailIn.t)}`;
  const s0 = lstate0(c);
  return b.mailOut ? `${s0}. One going to ${b.mailOut.t.name}, ${outWhen(b.mailOut.rec, b.mailOut.t)}` : s0;
}
function lstate0(c) {
  if (!c.owned) return isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it";
  const b = c.base || c, n = nOf(b), s = sparesOf(b), who = wantedBy(b);
  if (n <= 1) return "Have it";
  if (!s) return `Have ${n}, keeping ${n === 2 ? "both" : "all"}`;
  return `Have ${n}, ${s} spare${who.length ? `, ${people(who)} want${who.length === 1 ? "s" : ""} it` : ""}`;
}
function tradeListHTML() {
  const now = Date.now();
  const ts = TRADERS.filter((t) => wantsOf(t).length || threadOf(t).length).sort((a, b) => (activeOf(b) ? 1 : 0) - (activeOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length);
  const bl = tbList(), binder = `<section><h2>Trade binder</h2><p class="lsub">${bl.length ? `${bl.length} ${bl.length === 1 ? "card" : "cards"} you have a spare of, the most wanted first.` : "Empty for now. On a card you have, + adds a spare."}</p><ul>${bl.map((c) => {
    const st = sets[c.si], who = wantedBy(c), s = sparesOf(c);
    return `<li class="lwrow"><div class="lrow"><span class="lname">${esc(c.name)}</span><span class="lmeta">${esc(st.name)} #${c.num}, ${c.rname}</span><span class="lprice">${money(c.price)}</span><span class="lstate">${s > 1 ? `${s} spares. ` : ""}${who.length ? `${people(who)} ${who.length === 1 ? "wants" : "want"} it` : "No takers yet"}</span></div></li>`;
  }).join("")}</ul></section>`;
  return binder + `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase. Each trade is a thread.</p><ul>${ts.map((t) => {
    const want = wantsOf(t), has = offersOf(t), rec = activeOf(t), recs = threadOf(t), due = shipDue(t);
    const thread = recs.length ? `<ul class="lthread">${recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now, "li")).join("")).join("")}</ul>` : "";
    const acts = (due ? `<button type="button" class="pill-btn primary" data-shipped="${recKey(due)}">Mark shipped</button>` : "") + (rec?.state === "proposed" ? `<button type="button" class="pill-btn" data-back="${recKey(rec)}">Take back</button>`
      : rec?.state === "countered" ? `<button type="button" class="pill-btn primary" data-accept="${recKey(rec)}">Accept</button><button type="button" class="pill-btn" data-decline="${recKey(rec)}">Decline</button>`
      : want.length && has.length ? `<button type="button" class="pill-btn" data-propose="${t.id}">Propose ${want.length} for ${has.length}</button>` : "");
    return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">${want.length ? `Wants ${names(want)} (${money(sumOf(want))}).` : "Wants nothing of yours right now."}${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length && want.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${chipState(t).text}</span>${thread}${acts ? `<div class="lacts">${acts}</div>` : ""}</div></li>`;
  }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-shipped]"); if (!b) return; const r = recOf(b.dataset.shipped); if (r) markShipped(r); });

// Debug builds only.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { mclock: { get: () => mclock }, skipDay: { value: skipDay }, markShipped: { value: markShipped }, mailTick: { value: mailTick }, mailIndex: { value: mailIndex }, inProg: { value: inProg }, outProg: { value: outProg }, startTrade: { value: startTrade } }); }, 0);
