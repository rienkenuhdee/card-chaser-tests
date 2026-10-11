// ---------- round 18, radical: the table, live, across the internet ----------
// Online opens the same trade table as In person, but the other collector is at it right now. Their hand is on the
// mat: a soft fingertip with their name, gliding the way a finger does, hovering over your spares ("Maya is looking at
// your Alakazam"), picking a card up so it lifts and wobbles in place, sliding it onto the table, putting one of
// theirs down, pausing half way. It's a seeded script (h32 of the trader's id and a step count) that reacts to what
// you do: a card of yours it chases gets a touch ("Maya likes your Dratini"), one it doesn't is slid back once, and an
// offer that's too far in your favour gets a counter (one more of yours it chases, or one of its cards back).
// Agreeing is two hands at once: both handshake buttons sit in the trade bar, and the trade closes only when you hold
// yours while they hold theirs. A change on the table lets both go, the way a ready check resets.
// Nobody hands anything over online, so after the shake both sides' cards gather in the middle of the mat, "Held until
// both arrive", and the thread carries the shipping in short lines on a demo clock (a day every 20 seconds, or Skip a
// day in Settings): they send, you tap I sent mine, each side is in the mail, each arrives. When both have arrived the
// cards cross onto both walls (the table's crossing if it's up, the wall's crossing if not) and the trade is done.
// The in-person path is untouched. Records stay in wall-trades with `online` and `lt` (the shipping plan); the skipped
// days are in wall-live-days.

const LIVE_DAY = 20000, LIVE_SHAKE = 650;
let liveSkip = 0;
try { liveSkip = Math.max(0, Number(localStorage.getItem("wall-live-days")) || 0); } catch { liveSkip = 0; }
const isLive = (r) => Boolean(r && r.online && r.lt && r.lt.them && r.lt.you);
const heldOf = (t) => trades.find((r) => r.t === t.id && isLive(r) && r.state === "held") || null;
const liveDay = (r) => Math.max(0, Math.floor((Date.now() - r.lt.at) / LIVE_DAY) + liveSkip - (r.lt.skip0 || 0));
const shipped = (r, by, what) => r.log.some((e) => e.kind === "ship" && e.by === by && e.what === what);
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ----- their hand -----
const lv = { t: null, tok: 0, n: 0, hand: { x: 0, y: 0, a: 0, m: null, fade: null, press: 0, moving: false }, carry: null, pulses: [], dot: null, line: "", her: "off", you: false, holdTok: 0, bothT: 0, poke: null, seen: [], passed: new Set(), refused: new Set(), asked: new Set(), self: false };
const lsd = (k) => h32(`${lv.t.id}|live|${lv.n}|${k}`); // the script's seed: the trader, then how far along it is
function liveReset(t) {
  lv.tok++; lv.t = t; lv.n = 0; lv.carry = null; lv.pulses = []; lv.dot = null; lv.line = ""; lv.her = "off"; lv.you = false; lv.holdTok++;
  clearTimeout(lv.bothT); lv.bothT = 0; lv.poke = null; lv.seen = []; lv.passed.clear(); lv.refused.clear(); lv.asked.clear(); lv.self = false;
  Object.assign(lv.hand, { x: vw / 2, y: -40, a: 0, m: null, fade: null, press: 0, moving: false });
  handsEl.classList.remove("both");
}
// Where the hand is now: gliding along a slight curve toward a point (or a card, followed as the binder scrolls).
function handTick(now) {
  const h = lv.hand, m = h.m;
  if (m) {
    const p = m.dur <= 0 ? 1 : clamp((now - m.t0) / m.dur, 0, 1), e = ease(p), to = typeof m.to === "function" ? m.to() : m.to;
    const dx = to.x - m.fx, dy = to.y - m.fy, len = Math.hypot(dx, dy) || 1, b = Math.sin(Math.PI * p) * m.bend * Math.min(44, len * 0.15);
    h.x = m.fx + dx * e - (dy / len) * b; h.y = m.fy + dy * e + (dx / len) * b; h.moving = p < 1;
  } else h.moving = false;
  const f = h.fade;
  if (f) { const p = f.dur <= 0 ? 1 : clamp((now - f.t0) / f.dur, 0, 1); h.a = f.from + (f.to - f.from) * p; if (p >= 1) h.fade = null; }
  return h;
}
// Reduced motion: the hand jumps rather than glides (the pauses stay, so you can still follow it).
function glide(to, ms = null) {
  lv.n++;
  const h = handTick(performance.now()), p = typeof to === "function" ? to() : to, d = Math.hypot(p.x - h.x, p.y - h.y);
  const dur = reduced ? 0 : ms ?? Math.round(clamp(240 + d * 1.25, 300, 900) * (0.85 + 0.3 * lsd("pace")));
  h.m = { fx: h.x, fy: h.y, to, t0: performance.now(), dur, bend: lsd("bend") < 0.5 ? -1 : 1 };
  kick();
  return sleep(dur + 20);
}
function fadeTo(a, ms) { const h = handTick(performance.now()); h.fade = { from: h.a, to: a, t0: performance.now(), dur: reduced ? 0 : ms }; kick(); }
function touchAt(col) {
  const now = performance.now(), h = handTick(now);
  if (!reduced) lv.pulses.push({ x: h.x, y: h.y, t0: now, col });
  lv.dot = { x: h.x, y: h.y, t0: now, col }; h.press = now; kick();
}
function say(text) { lv.line = text; if (tbl.on && tbl.live && tbl.phase === "open") tbSub.textContent = text; }
function ptOf(c) {
  const r = curRect(c);
  let x = r.x + r.w / 2, y = r.y + r.h * 0.45;
  if (c.spot !== "table" && tbl.L) { const R = sideRegion(sideOf(c)); x = clamp(x, R.x + 18, R.x + R.w - 18); } // a card scrolled off: the hand reaches for the edge
  return { x, y };
}
const restPt = () => { const S = tbl.L.strip; return { x: S.x + S.w * (0.22 + 0.2 * lsd("rest")), y: S.y + 2 }; };
const btnPt = () => { const r = themTip.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: vw * 0.25, y: vh - 40 }; };

// The hand over the table: pulses where it touched, the card it carries, the fingertip and its name.
function drawHand(now) {
  if (!lv.t || tbl.closing) return false;
  const h = handTick(now);
  let more = h.moving || Boolean(h.fade);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let i = lv.pulses.length - 1; i >= 0; i--) {
    const P = lv.pulses[i], k = (now - P.t0) / 900;
    if (k >= 1) { lv.pulses.splice(i, 1); continue; }
    ctx.globalAlpha = 0.6 * (1 - k); ctx.lineWidth = 2; ctx.strokeStyle = P.col;
    ctx.beginPath(); ctx.arc(P.x, P.y, 9 + 30 * ease(k), 0, Math.PI * 2); ctx.stroke(); more = true;
  }
  if (lv.dot) { // where they last touched: a small mark that fades
    const k = reduced ? 0 : (now - lv.dot.t0) / 2600;
    if (k >= 1) lv.dot = null;
    else { ctx.globalAlpha = 0.55 * (1 - k); ctx.fillStyle = lv.dot.col; ctx.beginPath(); ctx.arc(lv.dot.x, lv.dot.y, 4, 0, Math.PI * 2); ctx.fill(); if (!reduced) more = true; }
  }
  const C = lv.carry;
  if (C) { // a card in their fingers: lifted, wobbling as it's picked up, easing to its size on the table
    const lift = reduced ? 1 : clamp((now - C.t0) / 160, 0, 1), k = C.ts ? (reduced ? 1 : clamp((now - C.ts) / 420, 0, 1)) : 0;
    const w = (C.w0 + (C.w1 - C.w0) * k) * (1 + 0.08 * lift), hh = (C.h0 + (C.h1 - C.h0) * k) * (1 + 0.08 * lift);
    const rot = reduced ? 0 : Math.sin((now - C.t0) / 70) * 0.07 * Math.max(0.15, 1 - (now - C.t0) / 900);
    const cx = h.x, cy = h.y + hh * 0.05;
    ctx.setTransform(dpr * Math.cos(rot), dpr * Math.sin(rot), -dpr * Math.sin(rot), dpr * Math.cos(rot), dpr * cx, dpr * cy);
    ctx.globalAlpha = 0.25; rr(-w / 2 + 3, -hh / 2 + 7 * lift, w, hh, w * 0.045); ctx.fillStyle = "#000"; ctx.fill();
    ctx.globalAlpha = 1; cardFace(C.c, -w / 2, -hh / 2, w, hh, now, state.value && !state.matches);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!reduced) more = true;
  }
  if (h.a > 0.01) {
    const ink = lv.t.ink, pr = reduced ? 0 : clamp(1 - (now - h.press) / 240, 0, 1);
    if (pr > 0) more = true;
    ctx.globalAlpha = h.a * 0.16; ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(h.x, h.y, 21 - 4 * pr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = h.a * 0.92; ctx.beginPath(); ctx.arc(h.x, h.y, 10 - 2.5 * pr, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    font(700, 11.5); const tw = textW(lv.t.name), pw = tw + 14, left = h.x + 16 + pw > vw - 6;
    const px = left ? h.x - 16 - pw : h.x + 14, py = h.y + 8;
    rr(px, py, pw, 19, 9.5); ctx.fillStyle = ink; ctx.fill();
    ctx.globalAlpha = h.a; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(lv.t.name, px + 7, py + 10);
    ctx.textBaseline = "alphabetic";
  }
  ctx.globalAlpha = 1;
  return more;
}
// "Here now" beside their name, and a green dot on their initial, while they're at the table.
function drawHere() {
  if (tbl.phase !== "open") return;
  const R = tbl.L.their, t = tbl.t;
  ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(R.x + 37, R.y + 33, 5, 0, Math.PI * 2); ctx.fillStyle = theme.deal; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = theme.bg; ctx.stroke();
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  font(800, 17, true); const tw = textW(fitText(`${t.name}'s spares`, R.w - 24));
  font(600, 12); ctx.fillStyle = theme.deal; ctx.fillText("Here now", R.x + 48 + tw + 8, R.y + 20);
}

// ----- what they think of the table -----
const wantPool = () => tbl.yours.filter((c) => lv.t.chaseSet.has(c) && c.spot !== "table" && !c.held);
function verdict() {
  const t = lv.t, give = tbl.give, get = tbl.get;
  const worth = give.reduce((a, c) => a + c.price * (t.chaseSet.has(c) ? 1 : 0.5), 0), cost = sumOf(get);
  const tol = 0.06 + 0.16 * h32(`${t.id}|live|tol`), need = cost * (1 - tol);
  const liked = give.some((c) => t.chaseSet.has(c)) || !tbl.yours.some((c) => t.chaseSet.has(c));
  return { worth, cost, gap: need - worth, liked, content: give.length > 0 && get.length > 0 && liked && worth >= need };
}
// One of theirs you chase, nearest a value (strictly under `below` if given).
function offerNear(target, below = Infinity) {
  const free = tbl.theirs.filter((c) => c.spot !== "table" && !c.held && c.price < below), chased = free.filter(isChase), pool = chased.length ? chased : free;
  let best = null;
  for (const c of pool) if (!best || Math.abs(c.price - target) < Math.abs(best.price - target)) best = c;
  return best;
}
// What they'd change: ask for one of yours they chase, put one of theirs down, or take one back.
function counterMove(v) {
  const t = lv.t, wants = wantPool().filter((c) => !lv.refused.has(c));
  const ask = (gap) => wants.filter((c) => c.price >= gap).sort((a, b) => a.price - b.price)[0] || wants.slice().sort((a, b) => b.price - a.price)[0] || null;
  if (!tbl.give.length) { const c = ask(sumOf(tbl.get) * 0.8); return c ? [{ c, to: true, line: `${t.name} asked for your ${c.name}` }] : null; }
  if (!tbl.get.length) { const c = offerNear(v.worth); return c ? [{ c, to: true, line: `${t.name} put ${c.name} on the table` }] : null; }
  if (!v.liked && wants.length) { const c = ask(v.gap); return [{ c, to: true, line: `${t.name} asked for your ${c.name} too` }]; }
  if (v.gap > 0) {
    const c = ask(v.gap);
    if (c && c.price >= v.gap * 0.6) return [{ c, to: true, line: `${t.name} asked for your ${c.name} too` }];
    const dear = tbl.get.slice().sort((a, b) => b.price - a.price)[0];
    if (tbl.get.length > 1) return [{ c: dear, to: false, line: `${t.name} took ${dear.name} back` }];
    const cheaper = offerNear(v.worth, dear.price);
    if (cheaper) return [{ c: dear, to: false, line: `${t.name} took ${dear.name} back` }, { c: cheaper, to: true, line: `${t.name} put ${cheaper.name} down instead` }];
    if (c) return [{ c, to: true, line: `${t.name} asked for your ${c.name} too` }];
  }
  return null;
}

// ----- the script: one move at a time, reacting to yours -----
const movable = (c, toTable) => !c.held && tbl.drag?.c !== c && (toTable ? c.spot !== "table" : c.spot === "table") && tbl.phase === "open";
async function calm(ok) { while (ok() && (tbl.drag || tbl.pend || tbl.flights.length || tbl.pinch || tbl.anim)) await sleep(160); }
// A pause that ends early when you do something (after a beat, the time it takes a person to notice).
function idle(ms) {
  return new Promise((res) => {
    let fin = false;
    const done = () => { if (fin) return; fin = true; clearTimeout(timer); if (lv.poke === pk) lv.poke = null; res(); };
    const timer = setTimeout(done, lv.you || lv.seen.length ? 300 : ms), pk = () => setTimeout(done, reduced ? 250 : 420 + 380 * lsd("react"));
    lv.poke = pk;
  });
}
// They pick a card up (it lifts and wobbles in place), sometimes pause half way, and put it down where it's going.
async function herMove(c, toTable, ok, line) {
  if (!c || !ok() || !movable(c, toTable)) return false;
  await glide(() => ptOf(c));
  if (!ok() || !movable(c, toTable)) return false;
  const side = sideOf(c), r0 = curRect(c);
  touchAt(lv.t.ink); say(side === "your" ? `${lv.t.name} picked up your ${c.name}` : `${lv.t.name} picked up ${c.name}`);
  tbl.flights = tbl.flights.filter((f) => f.c !== c); c.held = true;
  lv.carry = { c, w0: r0.w, h0: r0.h, w1: r0.w, h1: r0.h, t0: performance.now(), ts: 0 };
  kick();
  const drop = () => { if (lv.carry?.c === c) lv.carry = null; c.held = false; kick(); };
  await sleep(reduced ? 200 : 560);
  if (!ok()) { drop(); return false; }
  const list = side === "their" ? tbl.get : tbl.give;
  const dest = toTable ? tableSlot(side, list.length, list.length + 1) : slotRect(side, sideList(side).indexOf(c));
  Object.assign(lv.carry, { w1: dest.w, h1: dest.h, ts: performance.now() });
  const end = { x: dest.x + dest.w / 2, y: dest.y + dest.h / 2 - dest.h * 0.05 };
  if (!reduced && lsd("hes") < 0.35) { // hesitating: part of the way, a beat, then the rest
    const h = handTick(performance.now());
    await glide({ x: h.x + (end.x - h.x) * 0.45, y: h.y + (end.y - h.y) * 0.45 });
    if (!ok()) { drop(); return false; }
    await sleep(360 + 420 * lsd("hp"));
    if (!ok()) { drop(); return false; }
  }
  await glide(end);
  if (!ok()) { drop(); return false; }
  const h = handTick(performance.now()), C = lv.carry;
  lv.carry = null;
  lv.self = true; place(c, toTable, { x: h.x - C.w1 / 2, y: h.y + C.h1 * 0.05 - C.h1 / 2, w: C.w1, h: C.h1 }); lv.self = false;
  if (toTable && side === "your") lv.asked.add(c);
  touchAt(lv.t.ink); say(line); tick(4);
  return true;
}
async function lookAt(c, ok, line, ms) {
  await glide(() => ptOf(c));
  if (!ok()) return false;
  say(line); await sleep(ms); return true;
}
// Holding out a hand: the fingertip goes to their handshake button in the bar and stays there a while.
async function herHold(ms, ok) {
  const t = lv.t, my = ++lv.holdTok;
  lv.her = "reach"; refreshHands();
  fadeTo(0, 480); await glide(btnPt, reduced ? 0 : 520);
  if (!ok() || my !== lv.holdTok) { if (lv.her === "reach" && my === lv.holdTok) { lv.her = "off"; refreshHands(); } fadeTo(1, 200); return; }
  lv.her = "hold"; say(lv.you ? `${t.name} is holding out a hand too` : `${t.name} is holding out a hand`); tick(4); checkBoth();
  const t0 = Date.now();
  while (ok() && my === lv.holdTok && (lv.you || lv.bothT || Date.now() - t0 < ms)) await sleep(120);
  if (!ok()) return; // shaken on, or the table closed
  if (my === lv.holdTok) { lv.her = "off"; checkBoth(); say(`${t.name} let go. Hold to shake when you're ready`); }
  fadeTo(1, 300); await glide(restPt());
}
// A glance when there's nothing to do.
async function wander(ok) {
  const t = lv.t, on = [...tbl.give, ...tbl.get], wants = wantPool(), r = lsd("wander");
  if (wants.length && r < 0.5) { const c = wants[Math.floor(lsd("w1") * Math.min(4, wants.length))]; await lookAt(c, ok, `${t.name} is looking at your ${c.name}`, 900 + 600 * lsd("w2")); return; }
  if (on.length && r < 0.85) { const c = on[Math.floor(lsd("w3") * on.length)]; await lookAt(c, ok, `${t.name} is looking at ${sideOf(c) === "your" ? `your ${c.name}` : c.name}`, 800 + 500 * lsd("w4")); return; }
  await glide(restPt());
}
// The opening: a look over your spares, one of theirs you chase on the table, and one of yours they chase, near it in
// price (a fair first offer; if they have nothing you chase, the other way round).
const nearest = (list, price) => { let best = null; for (const c of list) if (!best || Math.abs(c.price - price) < Math.abs(best.price - price)) best = c; return best; };
async function opening(ok) {
  const t = lv.t, want = wantPool(), busy = () => lv.seen.length > 0 || tbl.give.length > 0 || tbl.get.length > 0;
  const mine = tbl.theirs.filter((c) => isChase(c) && c.spot !== "table" && !c.held);
  let offer, ask;
  if (mine.length) { offer = mine[Math.floor(lsd("offer0") * Math.min(3, mine.length))]; ask = nearest(want, offer.price); }
  else { ask = want.length ? want[Math.floor(lsd("ask") * Math.min(3, want.length))] : null; offer = offerNear(ask ? ask.price : 0); }
  const looks = [ask, ...want.filter((c) => c !== ask)].filter(Boolean).slice(0, lsd("look") < 0.6 ? 2 : 1).reverse(); // the one they want last
  for (const c of looks) {
    await calm(ok); if (!ok() || busy()) return;
    if (!(await lookAt(c, ok, `${t.name} is looking at your ${c.name}`, reduced ? 1000 : 900 + 700 * lsd("lk")))) return;
  }
  if (offer && !busy()) { await calm(ok); await herMove(offer, true, ok, `${t.name} put ${offer.name} on the table`); await sleep(500); }
  if (ask && ok() && !lv.seen.length) { await calm(ok); await herMove(ask, true, ok, `${t.name} asked for your ${ask.name}`); }
  if (ok()) await glide(restPt());
}
async function react(ok) {
  const t = lv.t;
  let did = false;
  for (const s of lv.seen.splice(0).slice(-2)) {
    const c = s.c;
    if (!ok()) return did;
    await calm(ok);
    if (s.side === "your" && s.toTable && c.spot === "table") {
      if (t.chaseSet.has(c)) { if (await lookAt(c, ok, `${t.name} likes your ${c.name}`, 0)) { touchAt(theme.deal); await sleep(850); did = true; } }
      else if (!lv.passed.has(c) && wantPool().length) {
        lv.passed.add(c);
        if (await lookAt(c, ok, `${t.name} is looking at your ${c.name}`, 650 + 500 * lsd("pv"))) did = (await herMove(c, false, ok, `${t.name} passed on your ${c.name}`)) || did;
      } else if (await lookAt(c, ok, `${t.name} left your ${c.name} on the table`, 700)) did = true;
    } else if (s.side === "their" && s.toTable && c.spot === "table") { if (await lookAt(c, ok, `${t.name} sees you want ${c.name}`, 750)) did = true; }
    else if (!s.toTable && s.side === "your" && lv.asked.has(c)) { lv.refused.add(c); lv.asked.delete(c); }
  }
  if (!ok()) return did;
  await calm(ok); if (!ok()) return did;
  const v = verdict();
  if (v.content) {
    if (lv.you || lsd("offer") < 0.55) { await herHold(lv.you ? 4000 : 4800, ok); return true; }
    if (!did) await wander(ok);
    return did;
  }
  const m = counterMove(v);
  if (m) { for (const step of m) { if (!ok()) break; await calm(ok); await herMove(step.c, step.to, ok, step.line); await sleep(300); } return true; }
  if ((tbl.give.length || tbl.get.length) && (lv.you || !did)) say(`${t.name} isn't ready to shake on this`);
  if (!did) await wander(ok);
  return did;
}
async function liveRun(tok) {
  const t = lv.t, ok = () => tok === lv.tok && tbl.on && tbl.live && !tbl.closing && tbl.phase === "open";
  await sleep(reduced ? 300 : 800);
  while (ok() && tbl.anim) await sleep(100);
  if (!ok()) return;
  const L = tbl.L, h = lv.hand; // they come in from their side of the screen
  Object.assign(h, { x: L.their.x + L.their.w * (0.3 + 0.4 * lsd("in")), y: L.their.y - 10, m: null, a: 0 });
  fadeTo(1, 500); say(`${t.name} joined the table`);
  await glide({ x: L.their.x + L.their.w * 0.5, y: L.their.y + L.their.h * 0.6 });
  if (!ok()) return;
  await sleep(450);
  if (!tbl.give.length && !tbl.get.length) await opening(ok);
  while (ok()) {
    await calm(ok); if (!ok()) return;
    const did = await react(ok); if (!ok()) return;
    await idle(did ? 1700 + 1500 * lsd("i1") : 4000 + 3000 * lsd("i2"));
  }
}

// ----- the handshake: two hands at once -----
const handsEl = document.createElement("div");
handsEl.className = "lv-hands"; handsEl.id = "lv-hands"; handsEl.hidden = true;
handsEl.innerHTML = `<div class="lv-hand them" id="lv-them" role="status" aria-live="polite"><i class="lv-tip" aria-hidden="true"></i><span><b id="lv-them-n"></b><small id="lv-them-s"></small></span></div><button type="button" class="lv-hand you" id="lv-you"><i class="lv-tip" aria-hidden="true"></i><span><b id="lv-you-n">Hold to shake</b><small id="lv-you-s"></small></span></button>`;
tradebarEl.append(handsEl);
const themEl = handsEl.querySelector("#lv-them"), themTip = themEl.querySelector(".lv-tip"), youEl = handsEl.querySelector("#lv-you");
const themN = handsEl.querySelector("#lv-them-n"), themS = handsEl.querySelector("#lv-them-s"), youN = handsEl.querySelector("#lv-you-n"), youS = handsEl.querySelector("#lv-you-s");
function refreshHands() {
  const t = tbl.t; if (!t) return;
  handsEl.style.setProperty("--tink", t.ink);
  themEl.classList.toggle("on", lv.her === "hold"); themEl.classList.toggle("reach", lv.her === "reach"); youEl.classList.toggle("on", lv.you);
  themN.textContent = `${t.name}'s hand`; themS.textContent = lv.her === "hold" ? "Holding" : lv.her === "reach" ? "Reaching" : "Not holding";
  youN.textContent = lv.you ? "Holding" : "Hold to shake";
  youS.textContent = lv.you ? (lv.her === "hold" ? "Shaking hands" : `Waiting for ${t.name}`) : lv.her === "hold" ? "Hold now to agree" : "Both hold at once to agree";
}
function checkBoth() {
  const both = lv.you && lv.her === "hold" && tbl.phase === "open";
  handsEl.classList.toggle("both", both);
  if (both && !lv.bothT) lv.bothT = setTimeout(liveShake, reduced ? 250 : LIVE_SHAKE);
  if (!both && lv.bothT) { clearTimeout(lv.bothT); lv.bothT = 0; }
  refreshHands();
}
function youDown() {
  if (!tbl.on || !tbl.live || tbl.phase !== "open" || lv.you) return;
  if (!tbl.give.length || !tbl.get.length) { tick(3); say("Put a card from each side on the table first"); return; }
  lv.you = true; lv.youAt = performance.now(); tick(5); checkBoth(); lv.poke?.();
}
function youUp() {
  if (!lv.you) return;
  lv.you = false; checkBoth();
  if (performance.now() - lv.youAt < 350 && tbl.phase === "open") say(`Keep holding until ${tbl.t.name} holds a hand out too`); // a tap isn't a handshake
}
// A change on the table lets both hands go, the way a ready check resets.
function releaseHolds(msg) {
  const had = lv.you || lv.her !== "off";
  lv.you = false; if (lv.her !== "off") { lv.her = "off"; lv.holdTok++; }
  checkBoth(); if (had && msg) say(msg);
}
function liveSaw(c, toTable) {
  releaseHolds(lv.self ? null : "The table changed. Hold again when you're happy");
  if (!lv.self) { lv.seen.push({ c, toTable, side: sideOf(c) }); lv.poke?.(); }
}
youEl.addEventListener("touchstart", (e) => { e.preventDefault(); youDown(); }, { passive: false });
youEl.addEventListener("touchend", (e) => { e.preventDefault(); youUp(); }, { passive: false });
youEl.addEventListener("touchcancel", () => youUp());
youEl.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") { try { youEl.setPointerCapture(e.pointerId); } catch { /* fine */ } youDown(); } });
for (const type of ["pointerup", "pointercancel"]) youEl.addEventListener(type, (e) => { if (e.pointerType === "mouse") youUp(); });
youEl.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); youDown(); } });
youEl.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); youUp(); } });
youEl.addEventListener("blur", youUp);
youEl.addEventListener("contextmenu", (e) => e.preventDefault());

// Both held at the same moment: the cards gather in the middle of the mat, held until both arrive.
function liveShake() {
  lv.bothT = 0;
  if (!tbl.on || !tbl.live || !lv.you || lv.her !== "hold" || tbl.phase !== "open" || !tbl.give.length || !tbl.get.length) { checkBoth(); return; }
  const t = tbl.t, now = Date.now(), give = tbl.give.map((c) => c.id), get = tbl.get.map((c) => c.id), s = (k) => h32(`${t.id}|${now}|${k}`);
  const rec = { t: t.id, at: now, state: "held", online: true, by: "both", give, get, log: [{ by: "both", kind: "shook", give, get, at: now }],
    lt: { at: now, skip0: liveSkip, them: { send: s("send") < 0.5 ? 0 : 1, transit: s("their") < 0.45 ? 3 : 2 }, you: { transit: s("yours") < 0.45 ? 3 : 2, sent: null } } };
  trades.push(rec); persistTrades();
  lv.you = false; lv.her = "off"; lv.tok++; handsEl.classList.remove("both"); fadeTo(0, 200);
  for (const c of [...tbl.get, ...tbl.give]) c.tcur ||= targetRect(c);
  tbl.rec = rec; tbl.phase = "held"; threadKey = "";
  updateTradeBar(); tick(30); kick(); drawList(); startClock();
  toast(`You and ${t.name} shook on it`);
}

// ----- the mail: a demo clock, a day every 20 seconds -----
let clockT = 0;
const lastDay = new Map(), releasing = new Set();
function startClock() { if (!clockT) clockT = setInterval(liveTick, 1000); }
function liveTick() {
  const held = trades.filter((r) => isLive(r) && r.state === "held");
  if (!held.length) { clearInterval(clockT); clockT = 0; return; }
  for (const r of held) advance(r);
}
function advance(r) {
  const t = traderOf(r); if (!t) return;
  const L = r.lt, d = liveDay(r), due = [];
  const add = (by, what, day) => { if (d >= day && !shipped(r, by, what)) due.push({ by, kind: "ship", what, day, at: Date.now() }); };
  add("them", "sent", L.them.send); add("them", "mail", L.them.send + 1); add("them", "arrived", L.them.send + L.them.transit);
  if (L.you.sent != null) { add("you", "mail", L.you.sent + 1); add("you", "arrived", L.you.sent + L.you.transit); }
  due.sort((a, b) => a.day - b.day);
  if (due.length) { r.log.push(...due); persistTrades(); }
  const both = shipped(r, "you", "arrived") && shipped(r, "them", "arrived"), dayMoved = lastDay.get(r) !== d;
  lastDay.set(r, d);
  if (due.length || dayMoved) { if (onTable(t)) { threadKey = ""; updateTradeBar(); kick(); } drawList(); }
  if (!both && !onTable(t) && due.some((e) => e.by === "them" && e.what === "arrived")) { const g = toCards(r.get); toast(`${names(g)} from ${t.name} arrived`, () => showThread(t), "Open"); }
  if (both) release(r);
}
// Both arrived: the cards cross onto both walls.
function release(r) {
  if (r.state !== "held" || releasing.has(r)) return;
  const t = traderOf(r);
  if (replyBusy(r)) { releasing.add(r); setTimeout(() => { releasing.delete(r); release(r); }, 600); return; }
  r.state = "accepted"; r.by = "both"; r.log.push({ by: "both", kind: "arrived", at: Date.now() }); persistTrades();
  if (onTable(t)) { tbl.rec = r; threadKey = ""; playAccept("both"); }
  else { replyEvent(r, t, ""); crossOnWall(r, t); }
  drawList();
}
function sentMine(r) {
  if (!isLive(r) || r.state !== "held" || r.lt.you.sent != null) return;
  const d = liveDay(r), t = traderOf(r);
  r.lt.you.sent = d; r.log.push({ by: "you", kind: "ship", what: "sent", day: d, at: Date.now() }); persistTrades(); tick(6);
  if (onTable(t)) { threadKey = ""; updateTradeBar(); kick(); }
  drawList(); startClock();
}
function skipDay() { liveSkip++; try { localStorage.setItem("wall-live-days", String(liveSkip)); } catch { /* fine */ } tick(4); liveTick(); syncSkip(); }
function shipLine(r, t) {
  const yours = r.lt.you.sent == null ? "Send yours" : shipped(r, "you", "arrived") ? `Yours reached ${t.name}` : "Yours are in the mail";
  const theirs = shipped(r, "them", "arrived") ? `${t.name}'s arrived` : shipped(r, "them", "sent") ? `${t.name}'s are in the mail` : `${t.name} is packing`;
  return `${yours}. ${theirs}.`;
}
function waitText(r, t) {
  if (r.lt.you.sent == null) return `Send ${names(toCards(r.give))} to ${t.name} in ${t.where}`;
  const a = shipped(r, "you", "arrived"), b = shipped(r, "them", "arrived");
  return a && b ? "Both arrived" : a ? `Waiting on ${t.name}'s` : b ? `Waiting on yours to reach ${t.name}` : "Both in the mail";
}

// ----- Settings: Skip a day -----
const mailBox = document.createElement("div");
mailBox.id = "lv-mail"; mailBox.hidden = true;
mailBox.innerHTML = `<p class="lbl">In the mail</p><div class="row lv-skiprow"><span class="lv-skipnote" id="lv-skipnote"></span><button class="btn" id="lv-skip" type="button">Skip a day</button></div>`;
document.getElementById("prefs-close").closest(".row").before(mailBox);
const skipNote = mailBox.querySelector("#lv-skipnote");
mailBox.querySelector("#lv-skip").onclick = skipDay;
function syncSkip() {
  const held = trades.filter((r) => isLive(r) && r.state === "held");
  mailBox.hidden = !held.length;
  if (held.length === 1) { const r = held[0], t = traderOf(r); skipNote.textContent = `Day ${liveDay(r)} of your trade with ${t?.name || "them"}. A day here is 20 seconds.`; }
  else if (held.length) skipNote.textContent = `${held.length} trades in the mail. A day here is 20 seconds.`;
}
document.getElementById("settings").addEventListener("click", syncSkip);
document.getElementById("reset").addEventListener("click", () => { try { localStorage.removeItem("wall-live-days"); } catch { /* fine */ } }, true);

// ----- How to trade: Online is real now -----
{
  const b = howEl.querySelector('[data-how="online"]');
  b.removeAttribute("aria-disabled");
  b.querySelector("small").textContent = "Live at the same table, then you both ship";
  b.querySelector(".soon")?.replaceWith(Object.assign(document.createElement("span"), { className: "tick", textContent: "›" }));
  b.lastElementChild.setAttribute("aria-hidden", "true");
  b.onclick = () => { const p = howPend; hideHow(); if (p) openTable(p.t, p.from, null, true); };
  const li = [...document.querySelectorAll("#about li")].find((x) => /^Trade\b/.test(x.textContent));
  if (li) li.insertAdjacentHTML("beforeend", " Choose <b>Online</b> and they're at the same table live: their hand moves the cards, you both hold the handshake to agree, and the cards are held until both arrive in the mail.");
}

// ----- redefined from 75-trade.js and 76-reply.js (the in-person branches are the base code, unchanged) -----
// A thread in flight (an offer out, or a trade in the mail) opens straight onto its table; otherwise the question.
function startTrade(t, from) {
  if (tbl.on || state.trans) return;
  if (activeOf(t) || heldOf(t)) { openTable(t, from); return; }
  howPend = { t, from }; howHead.textContent = `Trade with ${t.name}`; howEl.hidden = false; tick(4);
  howEl.querySelector('[data-how="person"]').focus();
}
function openTable(t, from, give = null, live = false) {
  if (tbl.on || state.trans) return;
  hideCaption(); cancelPress(); closePop(true);
  tbl.on = true; tbl.t = t; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.flights = []; tbl.shake = null; tbl.drag = null; tbl.pend = null; tbl.pinch = null;
  tbl.their.sx = 0; tbl.their.v = 0; tbl.your.sx = 0; tbl.your.v = 0;
  tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.handed = []; tbl.landing = 0; tbl.settled = false; tbl.done = null;
  const held = heldOf(t);
  tbl.live = Boolean(live || held); liveReset(t);
  threadKey = ""; renderThread(t); tbl.botH = null;
  tbl.L = tableLayout();
  tbl.theirs = t.spares.slice().sort((a, b) => (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  // a spare that's in the mail to someone else isn't on offer again
  const away = new Set(trades.filter((r) => isLive(r) && r.state === "held" && r !== held).flatMap((r) => r.give));
  tbl.yours = cards.filter(isSpare).filter((c) => !away.has(c.id) || sparesOf(c) > 1).sort((a, b) => (t.chaseSet.has(b) ? 1 : 0) - (t.chaseSet.has(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.origin = from ? { x: from.x + 11, y: from.y - mScroll + 17, w: 32, h: 32 } : { x: vw / 2 - 18, y: topPad(), w: 36, h: 36 };
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.yours) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); }
  const rec = held ? null : activeOf(t), last = lastOf(t);
  if (held) { // a trade in the mail: its cards held in the middle of the mat
    tbl.rec = held;
    for (const c of toCards(held.get)) if (tbl.theirs.includes(c)) { c.spot = "table"; tbl.get.push(c); }
    for (const c of toCards(held.give)) { if (!tbl.yours.includes(c)) { tbl.yours.push(c); c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); } c.spot = "table"; tbl.give.push(c); }
    tbl.phase = "held";
  } else if (rec) {
    tbl.rec = rec;
    for (const c of toCards(rec.get)) if (tbl.theirs.includes(c)) { c.spot = "table"; tbl.get.push(c); }
    for (const c of toCards(rec.give)) { if (!tbl.yours.includes(c)) { tbl.yours.push(c); c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = tbHome(c); } c.spot = "table"; tbl.give.push(c); }
    tbl.phase = rec.state === "countered" ? "countered" : "waiting";
    if (rec.state === "proposed") scheduleReply(rec);
  } else {
    if (!tbl.live && last?.state === "declined" && last.by === "them" && last.reason) tbl.note = last.reason;
    for (const c of give || []) if (tbl.yours.includes(c) && c.spot !== "table") { c.spot = "table"; tbl.give.push(c); }
  }
  document.body.classList.add("trading"); document.body.classList.toggle("livetable", tbl.live); setChrome(); updateTradeBar();
  tbl.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 680 };
  if (reduced) tbl.q = 1;
  tick(8); kick();
  if (tbl.live && tbl.phase === "open") liveRun(lv.tok);
}
function endTable() {
  for (const c of tbl.yours) { c.away = false; c.e = 1; c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.theirs) { c.away = false; c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  tbl.on = false; tbl.closing = false; tbl.anim = null; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.handed = []; tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.done = null;
  tbl.live = false; lv.tok++; lv.carry = null; lv.you = false; lv.her = "off"; clearTimeout(lv.bothT); lv.bothT = 0; handsEl.hidden = true; handsEl.classList.remove("both");
  tradebarEl.classList.remove("three");
  document.body.classList.remove("trading", "livetable"); setChrome(); kick();
}
function place(c, toTable, from) {
  const side = sideOf(c), list = side === "their" ? tbl.get : tbl.give, moved = (c.spot === "table") !== toTable;
  tbl.flights = tbl.flights.filter((f) => f.c !== c);
  if (toTable && c.spot !== "table") list.push(c);
  if (!toTable && c.spot === "table") list.splice(list.indexOf(c), 1);
  c.spot = toTable ? "table" : "binder"; c.held = true; c.tcur = null;
  const done = () => { c.held = false; if (c.spot === "table") c.tcur = targetRect(c); kick(); };
  if (reduced) done(); else tbl.flights.push({ c, from, t0: performance.now(), dur: 340, done });
  if (tbl.live && tbl.phase === "open" && moved) liveSaw(c, toTable);
  updateTradeBar(); kick();
}
// The pocket a card left: "In Maya's hand" while they carry it, "Held" once it's in the middle of the mat.
function drawPocket(c, r, alpha, label = "On the table") {
  if (tbl.live && lv.carry?.c === c) label = `In ${tbl.t.name}'s hand`;
  else if (tbl.live && tbl.phase === "held" && c.spot === "table") label = "Held";
  ctx.globalAlpha = alpha;
  rr(r.x, r.y, r.w, r.h, r.w * 0.045); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (r.w < 44) return;
  const pad = r.w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, r.w * 0.088, true); ctx.fillText(fitText(c.name, r.w - pad * 2), r.x + pad, r.y + r.h - pad - r.w * 0.075);
  font(500, r.w * 0.064); ctx.fillText(fitText(label, r.w - pad * 2), r.x + pad, r.y + r.h - pad);
}
// Held: one row in the middle of the mat, theirs then yours with a gap between.
function heldGeom() {
  const S = tbl.L.strip, h = S.h - 62, w = h * TW / TH, nG = tbl.get.length, nY = tbl.give.length, N = Math.max(1, nG + nY), sp = nG && nY ? 14 : 0;
  const avail = S.w - 2 * PG - 70, step = N > 1 ? Math.min(w + 6, (avail - w - sp) / (N - 1)) : 0, total = w + step * (N - 1) + sp;
  return { x0: S.x + S.w / 2 - total / 2, y: S.y + 30, w, h, step, sp, nG, total };
}
function tableSlot(side, i, n) {
  const S = tbl.L.strip;
  if (tbl.live && tbl.phase === "held" && !tbl.shake) { const G = heldGeom(), j = side === "their" ? i : G.nG + i; return { x: G.x0 + j * G.step + (side === "your" ? G.sp : 0), y: G.y, w: G.w, h: G.h }; }
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
function drawStrip(now, alpha) {
  const S = tbl.L.strip, t = tbl.t, waiting = tbl.phase === "waiting", accepting = tbl.phase === "accepting", held = tbl.live && tbl.phase === "held";
  const get = accepting && tbl.done ? tbl.done.get : tbl.get, give = accepting && tbl.done ? tbl.done.give : tbl.give;
  ctx.globalAlpha = alpha;
  rr(S.x + PG, S.y + 4, S.w - PG * 2, S.h - 8, 12); ctx.fillStyle = felt(); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = tbl.phase === "countered" ? t.ink : theme["slot-line"]; ctx.stroke();
  if (!waiting && !held) { ctx.fillStyle = theme["slot-line"]; ctx.fillRect(S.x + S.w / 2 - 0.5, S.y + 14, 1, S.h - 28); }
  ctx.textBaseline = "alphabetic";
  const theyL = held ? `${t.name} sends` : `${t.name} gives`, youL = held ? "You send" : "You give";
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(theyL, S.x + 14, S.y + 22);
  const gl = textW(theyL);
  ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(get)), S.x + 14 + gl + 8, S.y + 22);
  ctx.textAlign = "right"; ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(money(sumOf(give)), S.x + S.w - 14, S.y + 22);
  const yw = textW(money(sumOf(give)));
  ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(youL, S.x + S.w - 14 - yw - 8, S.y + 22);
  if (held) { // the middle zone: a dashed box around the cards, and what it means
    const G = heldGeom();
    ctx.setLineDash([5, 4]); rr(G.x0 - 10, G.y - 6, G.total + 20, G.h + 12, 8); ctx.lineWidth = 1.2; ctx.strokeStyle = theme.gold; ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = "center"; ctx.fillStyle = theme.gold; font(700, 12); ctx.fillText("Held until both arrive", S.x + S.w / 2, S.y + S.h - 11);
    ctx.globalAlpha = 1; return;
  }
  if (waiting) { ctx.textAlign = "center"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(`Waiting on ${t.name}`, S.x + S.w / 2, S.y + S.h - 14); ctx.globalAlpha = 1; return; }
  if (!give.length && !get.length && !tbl.flights.length && !(tbl.live && lv.carry)) {
    const note = tbl.live ? null : tbl.note;
    ctx.textAlign = "center"; ctx.fillStyle = note ? theme.ink : theme.muted; font(note ? 600 : 500, 13);
    ctx.fillText(fitText(note || (tbl.live ? `Drag a card onto the table. ${t.name} sees it too` : "Drag a card from either side onto the table"), S.w - 40), S.x + S.w / 2, S.y + S.h / 2 + (note ? 4 : 10));
    if (note) { ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText("Put something else on the table and try again", S.x + S.w / 2, S.y + S.h / 2 + 22); }
  } else if (give.length || get.length) {
    const txt = accepting ? (tbl.acceptBy === "you" ? "Done" : tbl.acceptBy === "both" ? "Both arrived" : `${t.name} accepted`) : balanceText(get, give, t);
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
  const handOn = tbl.live && q >= 1 && lv.t;
  if (handOn) { const h = handTick(now); if (h.moving || lv.carry || lv.pulses.length) foilOff = true; } // no foil while their hand moves
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = q; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  if (q >= 1) {
    if (tbl.live) { binderCached("their", now, value); drawHere(); binderCached("your", now, value); } // their hand moves over still binders
    else { drawBinder("their", now, 1, value); drawBinder("your", now, 1, value); }
    drawStrip(now, 1);
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
    if (handOn && drawHand(now)) more = true;
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
  foilOff = false;
  ctx.globalAlpha = 1;
  if (more || tbl.anim || tbl.pinch) kick();
}
// While their hand moves the binders don't change: each is drawn once into the canvas, copied aside, and blitted back
// until a card in view, the scroll, the layout or the theme changes (the trade binder's trick, 78-trade-binder.js).
const bCache = {};
function binderCached(side, now, value) {
  const L = tbl.L, R = sideRegion(side), S = side === "their" ? tbl.their : tbl.your, list = sideList(side), t = tbl.t;
  const c0 = Math.max(0, Math.floor((S.sx - 12) / (L.cw + L.gap))), c1 = Math.ceil((S.sx + R.w) / (L.cw + L.gap));
  const lit = side === "their" ? list.filter(isChase).length : list.filter((c) => t.chaseSet.has(c)).length;
  let sig = `${t.id}|${lv.carry?.c.id || ""}|${S.sx.toFixed(2)}|${L.cw}|${L.ch}|${L.rows}|${R.x}|${R.y}|${R.w}|${R.h}|${dpr}|${theme.bg}|${theme.ink}|${theme.paper}|${value}|${tbl.phase}|${list.length}|${lit}|`;
  for (let k = c0 * L.rows; k < Math.min(list.length, (c1 + 1) * L.rows); k++) { const c = list[k]; sig += `${c.id}${c.spot === "table" ? 1 : 0}${c.held ? 1 : 0}${c.handed ? 1 : 0},`; }
  const X = Math.round(R.x * dpr), Y = Math.round(R.y * dpr), W = Math.min(canvas.width - X, Math.ceil(R.w * dpr)), H = Math.min(canvas.height - Y, Math.ceil(R.h * dpr));
  let e = bCache[side];
  if (e && e.sig === sig && W > 0 && H > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(e.cv, X, Y); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return; }
  drawBinder(side, now, 1, value);
  if (W <= 0 || H <= 0) return;
  if (!e) e = bCache[side] = { cv: document.createElement("canvas"), sig: "" };
  if (e.cv.width !== W || e.cv.height !== H) { e.cv.width = W; e.cv.height = H; }
  const x2 = e.cv.getContext("2d"); x2.clearRect(0, 0, W, H); x2.drawImage(canvas, X, Y, W, H, 0, 0, W, H);
  e.sig = sig;
}
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
  if (locked && !tbl.shake && zone === "table" && tbl.phase !== "accepting") { tick(3); toast(tbl.phase === "held" ? `These are held until both arrive. ${tbl.rec ? shipLine(tbl.rec, tbl.t) : ""}` : tbl.phase === "waiting" ? `${tbl.t.name} has the cards. Take back to move them.` : `${tbl.t.name}'s counter is on the table. Accept it, or Counter to move cards.`); }
}
function updateTradeBar() {
  const t = tbl.t; if (!t) return;
  renderThread(t);
  const ph = tbl.phase, give = tbl.give.length, get = tbl.get.length, bal = give && get ? balanceText(tbl.get, tbl.give, t) : "";
  handsEl.hidden = !(tbl.live && ph === "open");
  if (tbl.live && (ph === "open" || ph === "held")) {
    tradebarEl.classList.remove("three"); tbTake.hidden = tbDec.hidden = tbAlt.hidden = true;
    if (ph === "open") {
      tbGo.hidden = true;
      tbHead.textContent = give && get ? bal : !give && !get ? `${t.name} is at the table` : get ? `${get} of ${t.name}'s on the table` : `${give} of yours on the table`;
      tbSub.textContent = lv.line || `Move cards onto the table. ${t.name} sees every move`;
      refreshHands();
    } else {
      const r = tbl.rec;
      tbHead.textContent = "Held until both arrive"; tbSub.textContent = r ? `Day ${liveDay(r)}. ${shipLine(r, t)}` : "";
      tbGo.hidden = !r || r.lt.you.sent != null; tbGo.disabled = false; tbGo.textContent = "I sent mine";
    }
    return;
  }
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
tbGo.onclick = () => {
  if (tbl.live) { if (tbl.phase === "held" && tbl.rec) sentMine(tbl.rec); return; }
  if (tbl.phase === "countered" && tbl.rec) acceptCounter(tbl.rec); else shake();
};
// The thread: a live trade reads as the shake, then the mail, a line a day.
function rowsOf(rec, t) {
  const rows = [];
  if (isLive(rec)) {
    const give = toCards(rec.give), get = toCards(rec.get), is = (l) => (l.length === 1 ? "is" : "are");
    for (const e of rec.log) {
      if (e.kind === "shook") { const g = toCards(e.give), k = toCards(e.get); rows.push({ who: "them", lead: `You and ${t.name} shook on it`, text: `${names(g)} for ${names(k)}. ${balanceText(k, g, t)}.`, at: e.at }); }
      else if (e.kind === "ship") {
        const you = e.by === "you", l = you ? give : get;
        const text = e.what === "sent" ? (you ? `You sent ${names(l)}.` : `${t.name} sent ${names(l)}.`) : e.what === "mail" ? `${names(l)} ${is(l)} in the mail${you ? ` to ${t.where}` : ""}.` : e.what === "arrived" ? (you ? `${names(l)} reached ${t.name}.` : `${names(l)} arrived.`) : "";
        if (text) rows.push({ who: you ? "you" : "them", lead: "", text, at: e.at, when: `Day ${e.day}` });
      }
    }
    if (rec.state === "done" || rec.state === "accepted") rows.push({ who: "sys", lead: "", text: `Both arrived. Traded ${dayOf(rec.doneAt || Date.now())}.`, at: null });
    else if (rec.state === "held") rows.push({ who: "wait", lead: "", text: waitText(rec, t), at: null, when: `Day ${liveDay(rec)}` });
    return rows;
  }
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
  return `<${tag} class="trow ${r.who}${fresh}">${r.who === "wait" ? `<i class="tdot" aria-hidden="true"></i>` : ""}<span class="tt">${lead}${esc(r.text)}</span>${r.when || r.at ? `<time>${r.when || agoText(r.at, now)}</time>` : ""}</${tag}>`;
}
function chipState(t) {
  const held = heldOf(t);
  if (held) return held.lt.you.sent == null ? { text: "Send yours", col: theme.gold, dot: true } : { text: `In the mail, day ${liveDay(held)}`, col: theme.gold };
  const rec = lastOf(t), wants = wantsOf(t).length, has = offersOf(t).length;
  if (rec?.state === "proposed") return { text: `Waiting on ${t.name}`, col: theme.gold };
  if (rec?.state === "countered") return { text: `${t.name} countered`, col: theme.deal, dot: true };
  if (rec?.state === "done" || rec?.state === "accepted") return { text: `Traded ${dayOf(rec.doneAt || Date.now())}`, col: theme.deal };
  if (wants) return { text: `Wants ${wants} of yours`, col: theme.gold };
  return { text: `Has ${has} you chase`, col: theme.deal };
}
function tradeListHTML() {
  const now = Date.now();
  const ts = TRADERS.filter((t) => wantsOf(t).length || threadOf(t).length).sort((a, b) => (activeOf(b) || heldOf(b) ? 1 : 0) - (activeOf(a) || heldOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length);
  const bl = tbList(), binder = `<section><h2>Trade binder</h2><p class="lsub">${bl.length ? `${bl.length} ${bl.length === 1 ? "card" : "cards"} you have a spare of, the most wanted first.` : "Empty for now. On a card you have, + adds a spare."}</p><ul>${bl.map((c) => {
    const st = sets[c.si], who = wantedBy(c), s = sparesOf(c);
    return `<li class="lwrow"><div class="lrow"><span class="lname">${esc(c.name)}</span><span class="lmeta">${esc(st.name)} #${c.num}, ${c.rname}</span><span class="lprice">${money(c.price)}</span><span class="lstate">${s > 1 ? `${s} spares. ` : ""}${who.length ? `${people(who)} ${who.length === 1 ? "wants" : "want"} it` : "No takers yet"}</span></div></li>`;
  }).join("")}</ul></section>`;
  return binder + `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase. Each trade is a thread.</p><ul>${ts.map((t) => {
    const want = wantsOf(t), has = offersOf(t), rec = activeOf(t), held = heldOf(t), recs = threadOf(t);
    const thread = recs.length ? `<ul class="lthread">${recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now, "li")).join("")).join("")}</ul>` : "";
    const acts = held ? (held.lt.you.sent == null ? `<button type="button" class="pill-btn primary" data-sent="${recKey(held)}">I sent mine</button>` : "")
      : rec?.state === "proposed" ? `<button type="button" class="pill-btn" data-back="${recKey(rec)}">Take back</button>`
      : rec?.state === "countered" ? `<button type="button" class="pill-btn primary" data-accept="${recKey(rec)}">Accept</button><button type="button" class="pill-btn" data-decline="${recKey(rec)}">Decline</button>`
      : want.length && has.length ? `<button type="button" class="pill-btn" data-propose="${t.id}">Propose ${want.length} for ${has.length}</button>` : "";
    return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">${want.length ? `Wants ${names(want)} (${money(sumOf(want))}).` : "Wants nothing of yours right now."}${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length && want.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${chipState(t).text}</span>${thread}${acts ? `<div class="lacts">${acts}</div>` : ""}</div></li>`;
  }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-sent]"); if (!b) return; const r = recOf(b.dataset.sent); if (r) sentMine(r); });

// On load: the mail catches up once the wall has inked in (a trade whose cards both arrived while you were away lands then).
setTimeout(() => {
  if (trades.some((r) => isLive(r) && r.state === "held")) setTimeout(() => { liveTick(); startClock(); }, reduced ? 1200 : 3200);
  if (window.__w) Object.defineProperties(window.__w, { lv: { get: () => lv }, liveShake: { value: liveShake }, skipDay: { value: skipDay }, sentMine: { value: sentMine }, heldOf: { value: heldOf }, liveDay: { value: liveDay }, liveTick: { value: liveTick }, youDown: { value: youDown }, youUp: { value: youUp }, verdict: { value: verdict }, openLive: { value: (t) => openTable(t, null, null, true) } });
}, 0);
