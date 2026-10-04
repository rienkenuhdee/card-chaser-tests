// ---------- mark mode: a stack of cards in one go ----------
// A Select mode inside a set, modelled on Photos. "Mark" in the set header (or press and hold on any card) enters it:
// a tap on a card toggles it owned, with the same ripple as before; a drag that starts sideways across cards paints
// every card it crosses to the state of the first one (the way Photos drag-selects); a drag that starts downward
// still scrolls, and a pinch still zooms or closes the set. A bar along the bottom takes the lens bar's place with
// the running count, Undo (the whole session goes back) and Done, which sums the session up in one toast.
let marking = false;
const session = new Map(); // card -> whether you owned it when the session began

// The Mark button, next to Back in the set header, and the bar along the bottom.
const markBtn = document.createElement("button");
markBtn.id = "mark"; markBtn.type = "button"; markBtn.textContent = "Mark"; markBtn.hidden = true;
markBtn.setAttribute("aria-label", "Mark several cards");
document.getElementById("arrange").after(markBtn);
const markBar = document.createElement("div");
markBar.id = "markbar"; markBar.className = "markbar glass"; markBar.setAttribute("role", "group"); markBar.setAttribute("aria-label", "Marking");
markBar.innerHTML = `<div class="mtext" aria-live="polite"><b id="m-head">Mark cards</b><span id="m-sub">Tap a card, or drag across a row</span></div>
<button type="button" class="mbtn" id="m-undo" disabled>Undo</button><button type="button" class="mbtn primary" id="m-done">Done</button>`;
document.getElementById("toast").before(markBar);
const mHead = markBar.querySelector("#m-head"), mSub = markBar.querySelector("#m-sub"), mUndo = markBar.querySelector("#m-undo");
about.querySelector("ul").insertAdjacentHTML("beforeend", "<li><b>Mark</b> (top, inside a set) marks a handful at once: tap cards, or drag across a row. Done sums it up.</li>");

// What this session has done so far: how many in, how many out, and where that leaves the set.
function tally() {
  let added = 0, out = 0; const setsIn = new Set();
  for (const [c, was] of session) { if (c.owned === was) continue; if (c.owned) added++; else out++; setsIn.add(c.si); }
  const head = [added ? `${added} added` : "", out ? `${out} taken out` : ""].filter(Boolean).join(", ");
  const one = setsIn.size === 1 ? sets[[...setsIn][0]] : null;
  const sub = one ? `${ownedIn(one.cards)} of ${one.cards.length} in ${one.name}` : setsIn.size ? `Across ${setsIn.size} sets` : "";
  return { n: added + out, head, sub };
}
function updateBar() {
  const t = tally();
  mHead.textContent = t.n ? t.head : "Mark cards";
  mSub.textContent = t.n ? t.sub : "Tap a card, or drag across a row";
  mUndo.disabled = !t.n;
}
function enterMark() {
  if (marking || view !== "set") return;
  if (state.focus) unfocus();
  marking = true; session.clear();
  document.body.classList.add("marking"); markBtn.hidden = true;
  updateBar(); updateCount(); hideCaption(); tick(5); kick();
}
// Leaving the mode (Done, Back, a pinch out, a rearrange): one toast for the whole session, and Undo puts it all back.
function leaveMark() {
  if (!marking) return;
  marking = false; document.body.classList.remove("marking"); markBtn.hidden = view !== "set";
  const t = tally(), changes = [...session]; session.clear();
  if (t.n) toast(`${t.head}.${t.sub ? ` ${t.sub}.` : ""}`, () => revert(changes));
  updateCount(); kick();
}
function revert(changes) { for (const [c, was] of changes) if (c.owned !== was) setOwned(c, was, { quiet: true }); updateBar(); }
function markCard(c, on) {
  if (c.owned === on) return;
  if (!session.has(c)) session.set(c, c.owned);
  setOwned(c, on, { quiet: true });
  if (session.get(c) === c.owned) session.delete(c); // back where it started: not a change any more
  updateBar();
}
markBtn.onclick = () => enterMark();
markBar.querySelector("#m-done").onclick = () => leaveMark();
mUndo.onclick = () => { if (!session.size) return; revert([...session]); session.clear(); updateBar(); tick(6); toast("Put back as it was"); };

// The chrome: the Mark button lives with Back; leaving the set ends the session.
function setChrome() {
  document.body.classList.toggle("inset", view === "set");
  backBtn.hidden = view !== "set"; arrBtn0.hidden = view === "set";
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = view === "set" && state.g ? state.g.name : "";
  if (marking && view !== "set") leaveMark();
  updateCount();
}
// The count in the search box, with a shorter placeholder where Mark shares the strip with it on a narrow screen.
function updateCount() {
  const n = state.lens === "time" ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 420 ? `Search ${TOTAL.toLocaleString()} cards` : view === "set" && !marking ? "Search" : "Search cards";
}
// The list has its own way to mark (tap a row), so opening it ends the session.
function setListMode(on) {
  if (on) leaveMark();
  document.body.classList.toggle("listmode", on);
  try { localStorage.setItem("wall-list", on ? "1" : ""); } catch { /* fine */ }
  unfocus(); drawList();
  if (on) listEl.querySelector("h1")?.focus(); else { kick(); canvas.focus(); }
}

// ----- painting: a stroke across cards -----
function beginStroke(card, p) {
  cancelPress();
  const on = !card.owned;
  gesture.stroke = { on, seen: new Set([card]), last: { x: p.x, y: p.y } };
  gesture.moved = true;
  markCard(card, on);
}
// Every card between the last point and this one gets the stroke's state, so a fast sweep skips none.
function paintTo(p) {
  const s = gesture.stroke, a = s.last, n = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / 10));
  for (let i = 1; i <= n; i++) {
    const h = hit(a.x + (p.x - a.x) * i / n, a.y + (p.y - a.y) * i / n);
    if (h?.card && !s.seen.has(h.card)) { s.seen.add(h.card); markCard(h.card, s.on); }
  }
  s.last = { x: p.x, y: p.y };
}

// The base gestures, with mark mode folded in: a hold starts a stroke (and enters the mode if you weren't in it).
function onDown(pts) {
  hideCaption(); fly = null; inertia = false;
  if (document.activeElement === qIn) qIn.blur();
  if (pts.length >= 2) return startTwo(pts);
  if (gesture) return;
  finishTransition();
  const p = pts[0], now = performance.now();
  gesture = { kind: "one", x: p.x, y: p.y, t: now, cam: { ...cam }, my: mScroll, moved: false, held: Boolean(state.focus), axis: null };
  samples = [{ x: p.x, y: p.y, t: now }];
  const h0 = hit(p.x, p.y);
  if (view === "mosaic" && h0?.block) { state.press = { g: h0.block, t0: now, timer: 0 }; kick(); }
  // Press and hold a card in a set to mark it; keep the finger down and sweep to mark the ones beside it.
  if (view === "set" && !state.focus && h0?.card && TW * h0.card.sz * cam.s >= 14) {
    const card = h0.card;
    gesture.card = card;
    state.press = { c: card, t0: now, timer: setTimeout(() => {
      if (gesture?.kind !== "one" || gesture.moved || state.press?.c !== card) return;
      if (!marking) enterMark();
      beginStroke(card, samples[samples.length - 1] || { x: gesture.x, y: gesture.y });
    }, 430) };
    kick();
  }
}
function onMove(pts) {
  if (!gesture) { if (pts.length) onDown(pts); return; }
  if (gesture.kind === "one" && pts.length >= 2) return startTwo(pts);
  if (gesture.kind === "two") { if (pts.length >= 2) pinchMove(pts[0], pts[1]); return; }
  const p = pts[0]; if (!p) return;
  const g = gesture, now = performance.now();
  if (g.stroke) { paintTo(p); return; }
  const dx = p.x - g.x, dy = p.y - g.y, dt = now - g.t;
  samples.push({ x: p.x, y: p.y, t: now }); if (samples.length > 8) samples.shift();
  if (!g.moved && Math.hypot(dx, dy) < 8) return;
  cancelPress();
  if (view === "mosaic") { g.moved = true; mScroll = clamp(g.my - dy, 0, mMax); kick(); return; }
  // In mark mode a drag that sets off sideways from a card paints the cards it crosses; downward still scrolls.
  if (marking && g.card && !g.moved && Math.abs(dx) > Math.abs(dy)) { beginStroke(g.card, { x: g.x, y: g.y }); paintTo(p); return; }
  if (g.held) {
    if (Math.abs(dx) > Math.abs(dy) && dt < 240) return;
    g.held = false; unfocus();
    g.x = p.x; g.y = p.y; g.cam = { ...cam }; return;
  }
  const framed = cam.s <= fitCam(state.g).s * 1.02;
  if (!g.moved) g.axis = framed && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 2 ? "x" : "free";
  g.moved = true;
  if (g.axis === "x") return;
  cam.y = g.cam.y - dy / cam.s;
  if (!framed) cam.x = g.cam.x - dx / cam.s;
  kick();
}
function onUp(remaining, end, cancelled = false) {
  const g = gesture; if (!g) return;
  if (cancelled && g.kind === "one" && !remaining.length) { gesture = null; cancelPress(); return; }
  cancelPress();
  if (g.kind === "two") {
    if (remaining.length >= 2) return;
    releasePinch();
    gesture = remaining.length === 1 ? { kind: "rest" } : null;
    return;
  }
  if (g.kind === "rest") { if (!remaining.length) gesture = null; return; }
  if (remaining.length) return;
  gesture = null;
  if (g.stroke) { kick(); return; } // the stroke is done; nothing else to do
  const p = end || samples[samples.length - 1];
  const dx = p.x - g.x, dy = p.y - g.y, dt = performance.now() - g.t;
  if (g.held) {
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 420) return step(dx < 0 ? 1 : -1);
    if (Math.hypot(dx, dy) < 8) return tap(p.x, p.y);
    return;
  }
  if (!g.moved) return tap(p.x, p.y);
  if (view === "set" && g.axis === "x") { if (Math.abs(dx) > 50) slideGroup(dx < 0 ? 1 : -1); return; }
  const s0 = samples.find((s) => performance.now() - s.t < 90) || samples[0];
  if (s0 && !reduced) {
    const t = Math.max(1, performance.now() - s0.t);
    vel = { x: view === "set" && cam.s > fitCam(state.g).s * 1.02 ? (p.x - s0.x) / t : 0, y: (p.y - s0.y) / t };
    if (Math.hypot(vel.x, vel.y) > 0.2) { inertia = true; kick(); }
  }
}
// A tap in mark mode toggles the card instead of bringing it up close.
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") { if (h?.block) enterGroup(h.block); return; }
  if (!h?.card) return;
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}

// ----- what this session changed, drawn over the binder -----
// A small badge in the corner of every card the session touched: a tick for added, a dash for taken out.
function drawMarks() {
  if (!marking || view !== "set" || !state.g || state.trans || !session.size) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [c, was] of session) {
    if (c.owned === was || groups[c.g] !== state.g) continue;
    const r = binderRect(c, cam);
    if (r.y > vh || r.y + r.h < 0 || r.x > vw || r.x + r.w < 0) continue;
    const R = clamp(r.w * 0.11, 5, 12), x = r.x + R + r.w * 0.07, y = r.y + R + r.w * 0.07;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = c.owned ? theme.deal : theme.muted; ctx.fill();
    ctx.lineWidth = Math.max(1.5, R * 0.24); ctx.strokeStyle = "#fff"; ctx.beginPath();
    if (c.owned) { ctx.moveTo(x - R * 0.45, y + R * 0.02); ctx.lineTo(x - R * 0.12, y + R * 0.36); ctx.lineTo(x + R * 0.48, y - R * 0.36); }
    else { ctx.moveTo(x - R * 0.42, y); ctx.lineTo(x + R * 0.42, y); }
    ctx.stroke();
  }
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}
// The frame loop is the base one; the badges go on after it (only in mark mode, so the budget is untouched).
function kick() {
  if (raf) return;
  raf = requestAnimationFrame(frameMarked);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; frameMarked(performance.now()); } }, 120);
}
function frameMarked(now) { frame(now); drawMarks(); }
