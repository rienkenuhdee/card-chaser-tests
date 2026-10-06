// ---------- mark mode: a handful of cards in one go ----------
// A Select mode inside a set, modelled on Photos (round 8). "Mark" in the set header, or press and hold on any card,
// enters it: a tap on a card toggles it owned with the usual ripple; a drag that sets off sideways across cards paints
// every card it crosses to the state of the first one (the way Photos drag-selects); a drag that sets off downward
// still scrolls, and a pinch still zooms or closes the set. A bar along the bottom takes the lens bar's place with
// the running count, Undo (the whole session goes back) and Done, which sums the session up in one toast.
let marking = false;
const session = new Map(); // card -> whether you owned it when the session began
const markBtn = document.getElementById("mark"), markBar = document.getElementById("markbar");
const mHead = document.getElementById("m-head"), mSub = document.getElementById("m-sub"), mUndo = document.getElementById("m-undo");

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
  mSub.textContent = t.n ? t.sub : "Tap a card, drag across a row, or hold one to chase it";
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
// Select all: every card in the set you're in becomes yours (through the session, so Undo takes them all back).
function markAllInSet() {
  const g = state.g; if (!g || !marking) return;
  const todo = g.cards.filter((c) => !c.owned); if (!todo.length) { toast("You have all of them already."); return; }
  const now = performance.now();
  todo.forEach((c, i) => { const b = c.base || c; if (!session.has(c)) session.set(c, c.owned); b.owned = true; b.got = Date.now(); saved[b.id] = { on: true, at: b.got }; if (!reduced) for (const t of [b, ...twinsOf(b)]) t.anim = { t0: now + i * 5, to: true }; }); // the card itself, whichever place it was marked in
  persist(); updateBar(); updateCount(); drawList(); tick(14);
  const sync = syncDone();
  if (lifted && !sync) liftLayout(true);
  if (view === "set") g.burst = now;
  if (sync?.minted.length) { tick(40); toast(finishedText(sync.minted)); }
  kick();
}
document.getElementById("m-all").onclick = () => markAllInSet();
markBtn.onclick = () => enterMark();
document.getElementById("m-done").onclick = () => leaveMark();
mUndo.onclick = () => { if (!session.size) return; revert([...session]); session.clear(); updateBar(); tick(6); toast("Put back as it was"); };

// A stroke across cards: the first card decides whether it adds or takes out.
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

// What this session changed, drawn over the binder: a tick on each card added, a dash on each one taken out.
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
