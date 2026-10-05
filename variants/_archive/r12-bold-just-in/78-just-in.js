// ---------- just in: a deal arrives as the card itself ----------
// Nothing announces a deal. When a live copy appears on a card you chase, the card's tile lifts out of its panel (or
// its slot in the binder), flies up to a "Just in" shelf that slides down under the search bar, and settles there as
// a chip: its mini face, the asking price in green, how far under. A faint ghost stays where it came from, so the
// shelf says what arrived and the ghost says where it lives. Tap a chip and the card pops up with its offers (and is
// marked seen); swipe a chip up and it flies home. The shelf holds the session's arrivals, newest left, and folds away
// when it's empty. The Chase lens button counts the ones you haven't looked at.
//
// The feed is simulated (the shared rule for round 12): 6 s after load, then every 9 s, one arrival on a chased card,
// in an order seeded by card id. A chased card without a deal gets one; once every chased card has one, the oldest
// deal drops 10%. On a fresh wall nothing is chased, so nothing arrives.
//
// The shelf and the flight are DOM (the shelf scrolls and taps like any strip; the flight is one element with a
// snapshot of the tile), so the wall's canvas only gains the ghosts. The wall makes room: topPad grows by the shelf's
// height while it's out (30-layout.js), so no panel ever sits under it.

// ----- the feed -----
const FEED_FIRST = 6000, FEED_EVERY = 9000;
for (const c of cards) { c.r = h32(c.id + "r"); c.dealAt = null; c.dealSeen = true; c.shelf = null; c.gone = false; }
const dealPrice = (c) => Math.max(0.25, Math.round(c.price * (0.55 + 0.3 * h32(c.id + "e")) * 100) / 100);
// The next arrival: a chased card without a deal (under market), or, failing that, the oldest deal dropping 10%.
function nextArrival() {
  const chased = cards.filter(isChase).sort((a, b) => a.r - b.r);
  if (!chased.length) return null;
  const fresh = chased.find((c) => !c.deal && dealPrice(c) < c.price);
  if (fresh) { fresh.deal = dealPrice(fresh); return fresh; }
  let old = null;
  for (const c of chased) if (c.deal && (!old || (c.dealAt || 0) < (old.dealAt || 0))) old = c;
  if (!old) return null;
  const drop = Math.max(0.25, Math.round(old.deal * 0.9 * 100) / 100);
  if (drop >= old.deal) return null;
  old.deal = drop; return old;
}
function feedTick() {
  if (wel.on) return; // the welcome is up: arrivals wait
  const c = nextArrival(); if (!c) return;
  c.dealAt = Date.now(); c.dealSeen = false;
  arrive(c);
}
setTimeout(() => { feedTick(); setInterval(feedTick, FEED_EVERY); }, FEED_FIRST);
const ago = (t) => { const s = Math.max(0, Date.now() - (t || Date.now())) / 1000; return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };

// ----- the shelf -----
const SHELF_H = 100, FACE_W = 40, FACE_H = 56, FACE_X = 2; // chips' faces are drawn at 2x so the pocket's print survives
var shelfK = 0; // how far out the shelf is, 0 to 1 (a var: topPad may be asked before this part has run)
function shelfPad() { return shelfK > 0 ? Math.round((SHELF_H + 6) * shelfK) : 0; }
const shelf = { on: false, items: [], queue: [], hinted: false, swipedAt: 0 };
const shelfEl = document.createElement("section");
shelfEl.className = "shelf glass"; shelfEl.id = "shelf"; shelfEl.setAttribute("aria-label", "Just in");
shelfEl.innerHTML = `<div class="sh-head"><b>Just in</b><span id="sh-hint">Tap to look. Swipe up to put back.</span></div><div class="sh-row" id="sh-row"></div>`;
document.body.append(shelfEl);
const shRow = shelfEl.querySelector("#sh-row"), shHint = shelfEl.querySelector("#sh-hint");
const flierEl = document.createElement("div"), flierCv = document.createElement("canvas");
flierEl.className = "flier"; flierEl.hidden = true; flierEl.setAttribute("aria-hidden", "true"); flierEl.append(flierCv); document.body.append(flierEl);
const itemOf = (el) => shelf.items.find((it) => it.el === el) || null;
const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const faceOf = (it) => rectOf(it.el.firstChild);
function fillChip(it) {
  const c = it.c, el = it.el, st = sets[c.si];
  el.querySelector(".cprice").textContent = short(c.deal);
  el.querySelector(".cunder").textContent = `${dealPct(c)}% under`;
  el.querySelector(".cname").textContent = c.name;
  el.querySelector(".cwhen").textContent = ago(c.dealAt);
  el.classList.toggle("unseen", !c.dealSeen);
  el.setAttribute("aria-label", `${c.name}, ${st.code} ${c.num}. ${money(c.deal)}, ${dealPct(c)}% under market, ${ago(c.dealAt)}. Tap to look, swipe up to put back.`);
}
function makeChip(c) {
  const el = document.createElement("button"); el.type = "button"; el.className = "chip new enter"; el.dataset.i = String(c.i);
  const cv = document.createElement("canvas"); cv.className = "face"; cv.setAttribute("aria-hidden", "true");
  el.append(cv);
  el.insertAdjacentHTML("beforeend", `<span class="ctext"><b class="cprice"></b><span class="cunder"></span><span class="cname"></span><span class="cwhen"></span></span>`);
  return el;
}
function pulse(el) { el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse"); }
const chaseBtn = lensBox.querySelector('[data-lens="chase"]'), badge = document.createElement("b");
badge.className = "badge"; badge.hidden = true; badge.setAttribute("aria-label", "new deals"); chaseBtn.append(badge);
let lastBadge = 0;
function updateBadge() {
  const n = shelf.items.filter((it) => !it.c.dealSeen).length;
  if (n === lastBadge) return;
  if (n > lastBadge) { badge.classList.remove("tick"); void badge.offsetWidth; badge.classList.add("tick"); }
  lastBadge = n; badge.textContent = String(n); badge.hidden = !n;
}
setInterval(() => { for (const it of shelf.items) it.el.querySelector(".cwhen").textContent = ago(it.c.dealAt); }, 30000);

// Where the card's home is on screen right now (its tile in the panel or the binder), or null when it's off this view.
function homeRect(c, now) {
  const g = groups[c.g], T = state.trans;
  if (tbl.on) return null;
  if (T?.kind === "open") {
    if (T.g === g) { const k = clamp(T.q * 1.15 - (c.k / g.cards.length) * 0.15, 0, 1), kk = ease(k), B = binderRect(c, T.cam), A = mr(c.m); return { x: A.x + (B.x - A.x) * kk, y: A.y + (B.y - A.y) * kk, w: A.w + (B.w - A.w) * kk, h: A.h + (B.h - A.h) * kk, a: 1 }; }
    return { ...mr(c.m), a: 1 - T.q };
  }
  if (T?.kind === "morph") { if (!c.pm) return null; const k = ease(clamp((now - T.t0 - c.delay) / (T.dur - 520), 0, 1)), a = mr(c.pm), b = mr(c.m); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, a: 1 }; }
  if (T?.kind === "slide") return null;
  if (view === "mosaic") return { ...mr(c.m), a: 1 };
  if (state.g === g) return { ...binderRect(c, cam), a: 1 };
  return null;
}
// The card's face inside its home: the whole tile, or the card drawn in a feed tile under the Chase lens.
function faceRectOf(c, r) {
  if (!(c.lift && r.w > r.h * 1.05)) return r;
  const pad = Math.max(8, r.w * 0.05), mh = r.h - pad * 2, mw = mh * TW / TH;
  return { x: r.x + pad, y: r.y + pad, w: mw, h: mh, a: r.a };
}

// ----- faces: a chip's mini face is the tile itself, drawn on the wall's canvas just before a frame paints over it -----
const snaps = [];
function snapFace(cv, c) {
  const W = FACE_W * FACE_X, H = FACE_H * FACE_X;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H); // transparent corners: the chip's own background shows round the pocket
  const e0 = c.e, l0 = c.lift, f0 = state.focus, p0 = state.press; c.e = 1; c.lift = 0; state.focus = null; state.press = null;
  foilOff = true; drawTile(c, 0, 0, W, H, performance.now()); foilOff = false;
  c.e = e0; c.lift = l0; state.focus = f0; state.press = p0;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.getContext("2d").drawImage(canvas, 0, 0, cv.width, cv.height, 0, 0, cv.width, cv.height);
}

// ----- the flight: one tile at a time, as an element above the shelf carrying the chip's face -----
let flight = null;
function startFlight(f) {
  const src = f.cv; flierCv.width = src.width; flierCv.height = src.height; flierCv.getContext("2d").drawImage(src, 0, 0);
  f.t0 = performance.now(); flight = f; flierEl.hidden = false; stepFlight(f.t0); kick();
}
function stepFlight(now) {
  const f = flight; if (!f) return false;
  const p = clamp((now - f.t0) / f.dur, 0, 1), e = ease(p);
  const a = f.from, b = f.to() || f.last || a; f.last = b;
  const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - Math.sin(Math.PI * p) * f.lift, w = a.w + (b.w - a.w) * e, h = a.h + (b.h - a.h) * e;
  flierEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(w / FACE_W).toFixed(3)}, ${(h / FACE_H).toFixed(3)})`;
  if (p >= 1) { flight = null; flierEl.hidden = true; f.done?.(); }
  return true;
}

// ----- arrivals -----
function arrive(c) {
  if (c.shelf) { // already on the shelf: the price dropped. The chip moves to the front and pulses again.
    const it = c.shelf; fillChip(it); shelf.items.splice(shelf.items.indexOf(it), 1); shelf.items.unshift(it);
    shRow.prepend(it.el); shRow.scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" }); pulse(it.el);
    updateBadge(); drawList(); tick(4); return;
  }
  shelf.queue.push(c); drain();
}
function drain() {
  if (flight || !shelf.queue.length) return;
  const c = shelf.queue.shift();
  if (!isChase(c) || c.shelf) { drain(); return; }
  if (state.focus === c) unfocus();
  const it = { c, el: makeChip(c) }; c.shelf = it; shelf.items.unshift(it); fillChip(it);
  shRow.prepend(it.el); shRow.scrollLeft = 0;
  void it.el.offsetWidth; it.el.classList.remove("enter"); // the chip's slot opens; the others slide right
  const first = !shelf.on; shelf.on = true; document.body.classList.add("shelved");
  if (reduced || document.body.classList.contains("listmode")) { c.gone = true; snaps.push({ cv: it.el.firstChild, c }); reveal(it); return; }
  // The first time, the shelf slides down and the wall makes room before the card leaves.
  setTimeout(() => { snaps.push({ cv: it.el.firstChild, c, then: () => launch(it) }); kick(); }, first ? 380 : 40);
}
function launch(it) {
  const c = it.c, now = performance.now();
  if (!c.shelf) return;
  const home = homeRect(c, now);
  c.gone = true;
  if (!home || flight) { reveal(it); return; }
  const from = faceRectOf(c, home);
  startFlight({ cv: it.el.firstChild, from, lift: 28, dur: 760, to: () => (it.el.isConnected ? faceOf(it) : null), done: () => { reveal(it); tick(4); } });
}
function reveal(it) {
  it.el.classList.remove("new"); it.el.classList.add("in"); pulse(it.el);
  updateBadge(); drawList(); kick();
  setTimeout(drain, 120);
}
// Put a card back: the chip leaves the shelf and the tile flies home to its ghost.
function putBack(it, why = "back") {
  const i = shelf.items.indexOf(it); if (i < 0) return;
  const c = it.c; shelf.items.splice(i, 1); c.shelf = null;
  const instant = reduced || document.body.classList.contains("listmode"), now = performance.now();
  const from = !instant && it.el.isConnected && !it.el.classList.contains("new") ? faceOf(it) : null;
  it.el.classList.add("gone"); it.el.style.transform = ""; setTimeout(() => it.el.remove(), 300);
  if (!shelf.items.length) { shelf.on = false; document.body.classList.remove("shelved"); }
  updateBadge();
  if (why === "owned" && c.anim && !reduced) c.anim.t0 = now + 420; // it inks in as it lands
  const home = from && !flight ? homeRect(c, now) : null;
  if (!home) { c.gone = false; kick(); return; }
  startFlight({ cv: it.el.firstChild, from, lift: 0, dur: 560, to: () => { const r = homeRect(c, performance.now()); return r && faceRectOf(c, r); }, done: () => {
    c.gone = false; c.e = 1;
    if (why === "back") groups[c.g].ripple = { t0: performance.now(), col: c.col, row: c.row };
    tick(3); kick(); drain();
  } });
}
// Chips whose card is no longer chased, or is yours now, go home (checked whenever the list would redraw).
function shelfSync() {
  for (const it of [...shelf.items]) if (!isChase(it.c)) putBack(it, it.c.owned ? "owned" : "back");
}
// Tap: the card pops up with its offers, and the arrival is seen.
function look(it) {
  if (tbl.on) return;
  const c = it.c; c.dealSeen = true; fillChip(it); updateBadge(); hint(false);
  if (state.focus) unfocus();
  if (pop.c) closePop(true);
  tick(5); popCard(c, faceOf(it));
}
function hint(on) { if (!on && !shelf.hinted) { shelf.hinted = true; shHint.hidden = true; } }

// ----- input on the shelf: scroll sideways, tap to look, swipe up to put back (never the wall's gesture) -----
let sw = null;
function swStart(el, x, y, id, mouse) { if (!el || el.classList.contains("new") || el.classList.contains("gone")) return; sw = { el, x, y, id, mouse, dy: 0, axis: null }; }
function swMove(x, y, e) {
  const s = sw; if (!s) return;
  const dx = x - s.x, dy = y - s.y;
  if (!s.axis) { if (Math.hypot(dx, dy) < 8) return; s.axis = dy < 0 && Math.abs(dy) > Math.abs(dx) * 1.2 ? "y" : "x"; if (s.axis === "x") { if (s.mouse) sw = null; return; } s.el.classList.add("lifting"); }
  if (s.axis !== "y") return;
  e?.preventDefault?.();
  const m = Math.max(0, -dy); s.dy = -(m > 30 ? 30 + (m - 30) * 0.22 : m); // the row clips above: the chip only needs to start leaving
  s.el.style.transform = `translateY(${s.dy.toFixed(1)}px)`; s.el.classList.toggle("armed", s.dy < -30);
}
function swEnd(cancelled) {
  const s = sw; if (!s) return; sw = null;
  s.el.classList.remove("lifting", "armed");
  if (s.axis) shelf.swipedAt = performance.now();
  if (!cancelled && s.axis === "y" && s.dy < -30) { hint(false); tick(6); putBack(itemOf(s.el)); drawList(); return; }
  s.el.style.transform = "";
}
shRow.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) { sw = null; return; } const t = e.touches[0]; swStart(e.target.closest(".chip"), t.clientX, t.clientY, t.identifier, false); }, { passive: true });
shRow.addEventListener("touchmove", (e) => { if (!sw || sw.mouse) return; const t = [...e.touches].find((t) => t.identifier === sw.id); if (t) swMove(t.clientX, t.clientY, e); }, { passive: false });
shRow.addEventListener("touchend", () => { if (sw && !sw.mouse) swEnd(false); });
shRow.addEventListener("touchcancel", () => { if (sw && !sw.mouse) swEnd(true); });
shRow.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") swStart(e.target.closest(".chip"), e.clientX, e.clientY, "mouse", true); });
addEventListener("pointermove", (e) => { if (sw?.mouse) swMove(e.clientX, e.clientY, null); });
addEventListener("pointerup", () => { if (sw?.mouse) swEnd(false); });
addEventListener("pointercancel", () => { if (sw?.mouse) swEnd(true); });
shRow.addEventListener("click", (e) => { if (performance.now() - shelf.swipedAt < 400) return; const el = e.target.closest(".chip"); const it = el && itemOf(el); if (it && !el.classList.contains("new")) look(it); });
shRow.addEventListener("keydown", (e) => { const el = e.target.closest(".chip"); if (!el) return; if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); const it = itemOf(el); if (it) { putBack(it); drawList(); } } });
shRow.addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { shRow.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });

// ----- the wall: the card up close sits below the shelf; a card on the shelf leaves only its ghost -----
function emphasis(c) {
  if (c.away || c.gone) return 0; // out on the trade table, or up on the shelf: its tile is empty
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.1 : 1;
  if (state.lens === "chase") return isChase(c) ? 1 : 0.18;
  if (state.lens === "trade") return isSpare(c) ? 1 : 0.18;
  return 1;
}
function focus(c, dir = 0) {
  state.focus = c;
  document.body.classList.add("focused");
  fillPanel(c, dir);
  const top = topPad(), avail = vh - panelH() - top - 12;
  const ch = Math.min(avail * 0.92, (vw * 0.78) * TH / TW);
  const S = TH * c.sz, s = Math.min(ch / S, maxS() * 1.4);
  const cy = top + avail / 2;
  flyTo({ s, x: c.x + TW * c.sz / 2 - vw / 2 / s, y: c.y + S / 2 - cy / s }, dir ? 360 : 520);
  tick(6);
}
function drawGhosts(now) {
  if (!shelf.items.length) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 1; ctx.strokeStyle = theme.deal;
  const dim = pop.c ? 0.4 : 1, strong = state.lens === "chase" && !state.matches;
  for (const it of shelf.items) {
    const c = it.c; if (!c.gone) continue;
    const r = homeRect(c, now);
    if (!r || r.w < 3 || r.y > vh || r.y + r.h < 0) continue;
    ctx.globalAlpha = r.a * (strong ? 0.9 : 0.6) * dim;
    const wide = c.lift && r.w > r.h * 1.05, rad = wide ? Math.min(12, r.w * 0.07) : r.w * 0.045;
    if (r.w >= 26) { const d = Math.max(2, Math.min(r.w, r.h) * 0.06); ctx.setLineDash([d, d]); rr(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, rad); ctx.stroke(); ctx.setLineDash([]); }
    else ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  ctx.globalAlpha = 1;
}
function relayout() {
  layoutAll();
  if (view === "set" && state.g && !state.trans) clampCam(state.g);
}
let jiLast = 0;
function kick() {
  welcomeSync();
  if (raf) return;
  raf = requestAnimationFrame(frameJI);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; frameJI(performance.now()); } }, 120);
}
function frameJI(now) {
  const dt = Math.min(48, now - (jiLast || now)); jiLast = now;
  let busy = false;
  // Faces for new chips: drawn on the wall's canvas, copied, then painted over by the frame.
  while (snaps.length) { const s = snaps.shift(); snapFace(s.cv, s.c); s.then?.(); }
  // The shelf slides down (or folds away) and the wall makes room as it goes.
  const kT = shelf.on ? 1 : 0;
  if (shelfK !== kT) {
    if (reduced || Math.abs(shelfK - kT) < 0.004) shelfK = kT; else { shelfK += (kT - shelfK) * Math.min(1, dt / 110); busy = true; }
    shelfEl.style.transform = `translate(-50%, ${(-(1 - shelfK) * (SHELF_H + 90)).toFixed(1)}px)`; shelfEl.style.opacity = shelfK.toFixed(3);
    relayout();
  }
  frame(now);
  if (!(tbl.on && tbl.q >= 1 && !tbl.anim) && !document.body.classList.contains("listmode")) drawGhosts(now);
  if (stepFlight(now)) busy = true;
  if (busy) kick();
}

// ----- the list: the arrivals as a row on top -----
function drawList() {
  shelfSync(); // every change on the wall (Got it, Chase it off, Undo, a lens) comes through here
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (shelf.items.length) {
    for (const it of shelf.items) it.c.dealSeen = true; // reading the row is looking at it
    updateBadge();
    top += `<section><h2>Just in</h2><p class="lsub">Live copies that just came in on cards you chase, newest first.</p><ul>${shelf.items.map(({ c }) => {
      const st = sets[c.si];
      return `<li class="lwrow ljust"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${ago(c.dealAt)}</span><span class="lprice"><b class="ldeal">${money(c.deal)}</b></span><span class="lstate">${dealPct(c)}% under market ${money(c.price)}</span></div><span class="lacts"><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button><button type="button" class="pill-btn" data-back="${c.i}">Put back</button></span></li>`;
    }).join("")}</ul></section>`;
  }
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top += `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") {
    const ts = TRADERS.filter((t) => wantsOf(t).length).sort((a, b) => wantsOf(b).length - wantsOf(a).length);
    top += `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase.</p><ul>${ts.map((t) => {
      const want = wantsOf(t), has = offersOf(t), prop = proposedTo(t);
      const names = (l) => l.map((c) => c.name).join(", ");
      return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">Wants ${names(want)} (${money(sumOf(want))}).${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${prop ? `Proposed ${prop.give.length} for ${prop.get.length}` : ""}</span></div>${has.length ? `<button type="button" class="pill-btn" data-trade="${t.id}">Propose</button>` : ""}</li>`;
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
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-back]"); if (!b) return; const it = cards[Number(b.dataset.back)].shelf; if (it) { putBack(it); drawList(); } });

// Test hook (debug builds): trigger the feed by hand.
setTimeout(() => { if (window.__w) Object.assign(window.__w, { feedTick, arrive, shelf, putBack, isChase, flight: () => flight }); }, 0);
