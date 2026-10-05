// ---------- ten flicks: the first screen is one card ----------
// A new collector's first 30 seconds. Instead of a seeded wall and a caption, the first screen is one card alone in an
// empty field with "Got this one?" above it: Base Set Charizard. Flick it up for yes (it leaves owned), down for no,
// sideways to chase it (it leaves wearing a gold tag). The next card deals in from behind: ten well-known cards, one
// from each set, old and new by turns, so ten flicks touch the whole collection. After the tenth, or Skip, the wall
// assembles itself from nothing: the arrange flight from an empty field, every panel growing from a point, the cards
// you said yes to flying in from where they left, the ones you're chasing wearing their tags. From then on it is the
// Wall as today, and the caption is gone for good (persisted as "wall-flicked").

// ----- the shared rule this round: nothing is seeded. Every card starts unowned; only your own marks persist. -----
for (const c of cards) {
  if (saved[c.id] == null) { c.owned = false; c.got = null; }
  c.chase0 = false; c.spare0 = false;
}

// The ten, in the order they're dealt: the most iconic card first, then old and new by turns.
const DECK_IDS = ["base1-4", "sv3pt5-205", "base2-11", "swsh7-218", "base3-4", "sv8pt5-161", "neo1-9", "me5-120", "base5-4", "me55-149"];
const byId = new Map(cards.map((c) => [c.id, c]));
const deck = {
  on: false, cards: DECK_IDS.map((id) => byId.get(id)).filter(Boolean), stage: "choose", grow: null, moving: false, held: false,
  where: new Map(), // card -> "yes" | "no" | "chase"
  history: [], drag: null, fly: null, spring: null, deal: null, landed: 0, hinted: false, lastR: "",
};
let flicked = false;
try { flicked = localStorage.getItem("wall-flicked") === "1"; } catch { /* fine */ }

// ----- markup: the question above the card, the answers and the count below. The card itself is on the canvas. -----
document.body.insertAdjacentHTML("beforeend", `
<div class="deck" id="deck" hidden>
  <div class="deck-top"><p class="deck-q" id="deck-q">Got this one?</p><p class="deck-sub" id="deck-sub"></p></div>
  <div class="deck-bot choose" id="deck-choose">
    <button type="button" class="pill-btn primary big" id="deck-import">Import from TCGplayer or Collectr</button>
    <p class="deck-or">or</p>
    <button type="button" class="pill-btn big" id="deck-flicks">Flick through ten cards</button>
  </div>
  <div class="deck-bot" id="deck-flick" hidden>
    <div class="deck-acts"><button type="button" class="pill-btn" data-f="no">Not yet</button><button type="button" class="pill-btn gold" data-f="chase">Chase it</button><button type="button" class="pill-btn primary" data-f="yes">Got it</button></div>
    <p class="deck-n"><span id="deck-n"></span><button type="button" class="deck-link" id="deck-undo" hidden>Undo</button><button type="button" class="deck-link" id="deck-skip">Skip the rest</button></p>
    <p class="deck-hint" id="deck-hint">Flick it up if you have it, down if not, sideways to chase it</p>
  </div>
</div>
<dialog id="imp" aria-labelledby="imp-h">
  <h2 id="imp-h">Import your collection</h2>
  <p class="imp-sub">Where does it live? In this demo a sample collection stands in for your file.</p>
  <div class="imp-choices"><button type="button" class="btn imp-src" data-src="TCGplayer">TCGplayer</button><button type="button" class="btn imp-src" data-src="Collectr">Collectr</button></div>
  <p class="imp-prog" id="imp-prog" hidden><span class="imp-bar" aria-hidden="true"></span><span id="imp-prog-t">Looking for your collection</span></p>
  <div class="row"><button type="button" class="btn" id="imp-cancel">Not now</button></div>
</dialog>`);
const impDlg = document.getElementById("imp"), impProg = document.getElementById("imp-prog"), impChoices = document.getElementById("imp").querySelectorAll(".imp-src");
const deckEl = document.getElementById("deck"), deckChoose0 = document.getElementById("deck-choose"), deckFlick0 = document.getElementById("deck-flick"), deckQ = document.getElementById("deck-q"), deckSub = document.getElementById("deck-sub"), deckN = document.getElementById("deck-n"), deckHint = document.getElementById("deck-hint"), deckUndo = document.getElementById("deck-undo");

// Where the card sits at rest: big, in the middle, with room for the question above and the answers below.
function deckRect() {
  const w = Math.min(vw * 0.64, 300, (vh - 330) * TW / TH), h = w * TH / TW;
  return { x: (vw - w) / 2, y: vh / 2 - 10 - h / 2, w, h };
}
// The question and the answers sit just above and below wherever the card is.
const scaleRect = (R, k) => ({ x: R.x + (R.w - R.w * k) / 2, y: R.y + (R.h - R.h * k) / 2, w: R.w * k, h: R.h * k });
const STACK = 0.6; // the ten as a stack on the first screen, before they grow into the deck
function deckPlace() {
  const R0 = deckRect(), R = deck.stage === "choose" ? scaleRect(R0, STACK) : R0, key = `${R.y}|${R.y + R.h}`;
  if (key !== deck.lastR) { deck.lastR = key; deckEl.style.setProperty("--deck-top", `${R.y}px`); deckEl.style.setProperty("--deck-bot", `${R.y + R.h}px`); }
  return R0;
}
// The current card is the first one unanswered (the list can answer them in any order); the count is how many are done.
const deckCard = () => deck.cards.find((c) => !deck.where.has(c)) || null;
const deckNext = () => { const cur = deckCard(); return cur ? deck.cards.find((c, i) => i > deck.cards.indexOf(cur) && !deck.where.has(c)) || null : null; };
function deckText() {
  deckChoose0.hidden = deck.stage !== "choose"; deckFlick0.hidden = deck.stage === "choose";
  if (deck.stage === "choose") { deckQ.textContent = "Start your wall"; deckSub.textContent = `${TOTAL.toLocaleString()} cards from ${sets.length} sets, none marked yet.`; return; }
  const c = deckCard(); if (!c) return;
  const st = sets[c.si], n = deck.where.size;
  deckQ.textContent = n ? (n === deck.cards.length - 1 ? "Last one. Got it?" : "And this one?") : "Got this one?";
  deckSub.textContent = `${c.name}. ${st.name}, ${st.year}.`;
  deckN.textContent = `${n + 1} of ${deck.cards.length}`;
  deckUndo.hidden = !deck.history.length;
  deckHint.classList.toggle("gone", deck.hinted);
}

// ----- drawing: the current card, the next one behind it, and a label that grows with the flick -----
const LABEL_OF = { yes: ["Got it", "deal"], no: ["Not yet", "muted"], chase: ["Chasing", "gold"] };
function deckIntent(dx, dy) {
  const d = Math.hypot(dx, dy); if (d < 24) return null;
  if (Math.abs(dx) > Math.abs(dy)) return "chase";
  return dy < 0 ? "yes" : "no";
}
function drawDeckLabel(kind, R, a, rot) {
  if (!kind || a <= 0) return;
  const [text, tone] = LABEL_OF[kind];
  const col = tone === "deal" ? theme.deal : tone === "gold" ? theme.gold : theme.muted;
  const size = Math.max(14, R.w * 0.085);
  font(800, size, true); const tw = ctx.measureText(text).width, pw = tw + size * 1.4, ph = size * 1.9;
  const x = kind === "chase" ? R.x + R.w - pw - R.w * 0.07 : R.x + R.w * 0.07, y = R.y + R.w * 0.07;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x + pw / 2, y + ph / 2); ctx.rotate(rot); ctx.translate(-(x + pw / 2), -(y + ph / 2));
  rr(x, y, pw, ph, 6); ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = tone === "gold" ? "#1a1406" : "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, x + pw / 2, y + ph / 2 + size * 0.06); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.restore();
}
// The back of the card behind: a quiet pocket, so the deal-in reads as a reveal.
function drawDeckBack(R, k, alpha) {
  const w = R.w * k, h = R.h * k, x = R.x + (R.w - w) / 2, y = R.y + (R.h - h) / 2 + (1 - k) * 160;
  ctx.globalAlpha = alpha; rr(x, y, w, h, w * 0.045); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  rr(x + w * 0.08, y + w * 0.08, w * 0.84, h - w * 0.16, w * 0.03); ctx.stroke(); ctx.globalAlpha = 1;
}
function drawDeckFace(c, R, dx, dy, rot, alpha, foil, label, labelA, now) {
  ctx.save(); ctx.globalAlpha = alpha;
  const cx = R.x + R.w / 2 + dx, cy = R.y + R.h / 2 + dy;
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);
  const was = foilOff; foilOff = !foil;
  cardFace(c, R.x + dx, R.y + dy, R.w, R.h, now, state.value && !state.matches);
  foilOff = was;
  drawDeckLabel(label, { x: R.x + dx, y: R.y + dy, w: R.w, h: R.h }, labelA, label === "chase" ? 0.1 : -0.1);
  ctx.restore(); ctx.globalAlpha = 1;
}
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
// The first screen: the ten as a stack, the top one showing. Tap or drag it and it grows into the deck.
function drawStack(now, R0) {
  const R = scaleRect(R0, STACK), c = deck.cards[0];
  for (let i = 3; i >= 1; i--) { const k = 1 - i * 0.035, w = R.w * k, h = R.h * k; const x = R.x + (R.w - w) / 2, y = R.y + (R.h - h) / 2 - i * 9; ctx.globalAlpha = 1; rr(x, y, w, h, w * 0.045); ctx.fillStyle = theme.slot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  if (c) drawDeckFace(c, R, 0, 0, 0, 1, true, null, 0, now);
}
function drawDeck(now) {
  let R = deckPlace(); const c = deckCard(), next = deckNext();
  // While the card is in hand or on its way, the question and the answers step back.
  const moving = Boolean(deck.drag || deck.fly || deck.spring || deck.grow), held = Boolean(deck.drag || deck.spring);
  if (moving !== deck.moving) { deck.moving = moving; deckEl.classList.toggle("moving", moving); }
  if (held !== deck.held) { deck.held = held; deckEl.classList.toggle("held", held); }
  if (deck.stage === "choose") { drawStack(now, R); return; }
  let busy = false;
  if (deck.grow) { // the stack growing into the deck
    const p = clamp((now - deck.grow.t0) / 320, 0, 1);
    R = scaleRect(R, STACK + (1 - STACK) * easeOut(p));
    if (p < 1) busy = true; else deck.grow = null;
  }
  // The card that just left, still on its way out.
  const F = deck.fly;
  let dealK = 1; // how far the current card has dealt in
  if (F) {
    const p = clamp((now - F.t0) / 420, 0, 1);
    if (p < 1) {
      busy = true;
      const e = p * p * (3 - 2 * p), far = Math.max(vw, vh) * 1.1;
      drawDeckFace(F.c, R, F.dx + F.dir.x * far * e, F.dy + F.dir.y * far * e, F.rot + F.spin * e, 1 - Math.pow(p, 3) * 0.4, false, F.kind, 1, now);
    } else deck.fly = null;
    dealK = clamp((now - F.t0 - 40) / 380, 0, 1);
    if (dealK < 1) busy = true;
  }
  if (c) {
    const k = reduced ? 1 : easeOut(dealK);
    if (next && k > 0.3) drawDeckBack(R, 0.94, Math.min(1, (k - 0.3) / 0.7));
    let dx = 0, dy = 0, rot = 0, label = null, la = 0;
    if (deck.drag) {
      const d = deck.drag; dx = d.x - d.x0; dy = d.y - d.y0; rot = dx * 0.0016;
      label = deckIntent(dx, dy); la = clamp((Math.hypot(dx, dy) - 24) / 70, 0, 1);
    } else if (deck.spring) {
      const p = clamp((now - deck.spring.t0) / 260, 0, 1), e = 1 - easeOut(p), s = deck.spring;
      dx = s.dx * e; dy = s.dy * e; rot = s.rot * e;
      if (p < 1) busy = true; else deck.spring = null;
    }
    if (k < 1) { // dealing in from behind: grows from the back's size and fades up
      busy = true;
      const s = 0.94 + 0.06 * k, w = R.w * s, h = R.h * s;
      const Rk = { x: R.x + (R.w - w) / 2, y: R.y + (R.h - h) / 2 + (1 - k) * 10, w, h };
      drawDeckBack(R, s, 1 - k);
      drawDeckFace(c, Rk, 0, 0, 0, k, false, null, 0, now);
    } else drawDeckFace(c, R, dx, dy, rot, 1, !deck.fly, label, la, now);
  }
  if (busy || deck.drag) kick();
}

// ----- the flick -----
function deckChoose(kind, from = null) {
  const c = deckCard(); if (!c || !deck.on) return;
  if (!reduced) {
    const dir = from?.dir || (kind === "yes" ? { x: 0, y: -1 } : kind === "no" ? { x: 0, y: 1 } : { x: 1, y: 0 });
    deck.fly = { c, kind, t0: performance.now(), dx: from?.dx || 0, dy: from?.dy || 0, rot: from?.rot || 0, dir, spin: kind === "chase" ? 0.5 * Math.sign(dir.x || 1) : (from?.rot || 0) * 2 };
  }
  deck.spring = null; deck.drag = null; deck.hinted = true;
  deckAnswer(c, kind);
}
function deckAnswer(c, kind) {
  if (!deck.on || deck.where.has(c)) return;
  deck.where.set(c, kind); deck.history.push(c);
  tick(kind === "yes" ? 12 : kind === "chase" ? 10 : 5);
  deckText(); deckListRender(); kick();
  if (deck.where.size >= deck.cards.length) { if (reduced || !deck.fly) deckFinish(false); else setTimeout(() => deckFinish(false), 300); }
}
function deckUndoLast() {
  const c = deck.history.pop(); if (!c || !deck.on) return;
  deck.where.delete(c); deck.fly = null; deck.spring = null; deck.drag = null;
  tick(4); deckText(); deckListRender(); kick();
}
// A one-finger drag anywhere on the field moves the card; letting go decides by speed first, distance second.
function deckBegin() {
  if (!deck.on || deck.stage !== "choose") return;
  deck.stage = "flick"; deck.grow = reduced ? null : { t0: performance.now() }; deck.lastR = "";
  tick(5); deckPlace(); deckText(); kick();
}
function deckDown(x, y) {
  let began = false;
  if (deck.stage === "choose") { deckBegin(); began = true; }
  if (deck.fly && performance.now() - deck.fly.t0 < 120) return;
  deck.spring = null; deck.drag = { x0: x, y0: y, x, y, t0: performance.now(), began, samples: [{ x, y, t: performance.now() }] }; kick();
}
function deckMove(x, y) {
  const d = deck.drag; if (!d) return;
  d.x = x; d.y = y; const now = performance.now();
  d.samples.push({ x, y, t: now }); if (d.samples.length > 8) d.samples.shift();
  kick();
}
function deckUp() {
  const d = deck.drag; if (!d) return;
  deck.drag = null;
  const now = performance.now(), dx = d.x - d.x0, dy = d.y - d.y0, dist = Math.hypot(dx, dy);
  const s0 = d.samples.find((s) => now - s.t < 100) || d.samples[0];
  const dt = Math.max(1, now - s0.t), vx = (d.x - s0.x) / dt, vy = (d.y - s0.y) / dt, speed = Math.hypot(vx, vy);
  if (dist < 8 && now - d.t0 < 300) { // a tap: a nudge and the hint (a tap that began the flicks has done its job)
    if (d.began) { kick(); return; }
    deck.hinted = false; deckText(); if (!reduced) deck.spring = { t0: now, dx: 0, dy: -18, rot: 0 }; tick(3); kick(); return;
  }
  const quick = speed > 0.5, far = dist > Math.min(120, vh * 0.16);
  if (quick || far) {
    const ax = quick ? vx : dx, ay = quick ? vy : dy;
    const kind = Math.abs(ax) > Math.abs(ay) ? "chase" : ay < 0 ? "yes" : "no";
    const len = Math.hypot(ax, ay) || 1;
    deckChoose(kind, { dx, dy, rot: dx * 0.0016, dir: { x: ax / len, y: ay / len } });
    return;
  }
  if (reduced) { kick(); return; }
  deck.spring = { t0: now, dx, dy, rot: dx * 0.0016 }; kick();
}
const dpt = (t) => ({ x: t.clientX, y: t.clientY });
canvas.addEventListener("touchstart", (e) => { if (!deck.on) return; if (e.touches.length >= 2) { deck.drag = null; deckFinish(true); return; } deckDown(dpt(e.touches[0]).x, dpt(e.touches[0]).y); }, { passive: false });
canvas.addEventListener("touchmove", (e) => { if (!deck.on) return; if (e.touches.length >= 2) { deck.drag = null; deckFinish(true); return; } const p = dpt(e.touches[0]); deckMove(p.x, p.y); }, { passive: false });
canvas.addEventListener("touchend", (e) => { if (!deck.on) return; if (!e.touches.length) deckUp(); });
canvas.addEventListener("touchcancel", () => { if (!deck.on) return; deck.drag = null; kick(); });
let deckMouse = false;
canvas.addEventListener("pointerdown", (e) => { if (!deck.on || e.pointerType !== "mouse") return; deckMouse = true; deckDown(e.clientX, e.clientY); });
canvas.addEventListener("pointermove", (e) => { if (!deck.on || e.pointerType !== "mouse" || !deckMouse) return; deckMove(e.clientX, e.clientY); });
for (const t of ["pointerup", "pointercancel"]) canvas.addEventListener(t, (e) => { if (e.pointerType !== "mouse" || !deckMouse) return; deckMouse = false; if (deck.on) deckUp(); });
deckEl.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => deckChoose(b.dataset.f)));
document.getElementById("deck-skip").onclick = () => deckFinish(true);
document.getElementById("deck-flicks").onclick = () => deckBegin();
document.getElementById("deck-import").onclick = () => importOpen();
deckUndo.onclick = () => deckUndoLast();
// Keys: the arrows flick, Escape skips.
addEventListener("keydown", (e) => {
  if (!deck.on || (e.target !== document.body && e.target !== canvas)) return;
  const k = e.key;
  if (impDlg.open) return;
  if (deck.stage === "choose") { if (k === "Enter" || k === " ") deckBegin(); else if (k === "Escape") deckFinish(true); else return; e.preventDefault(); return; }
  if (k === "ArrowUp") deckChoose("yes"); else if (k === "ArrowDown") deckChoose("no"); else if (k === "ArrowLeft" || k === "ArrowRight") deckChoose("chase");
  else if (k === "Escape") deckFinish(true); else if (k === "z" && (e.metaKey || e.ctrlKey)) deckUndoLast(); else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
// Reaching for the wall's own controls skips the rest (settings and about are dialogs, so they don't).
const skipOnChrome = (e) => { if (deck.on && !e.target.closest("#settings, #info")) deckFinish(true); };
for (const el of [document.querySelector(".top .strip"), lensBox]) { el.addEventListener("pointerdown", skipOnChrome, true); el.addEventListener("click", skipOnChrome, true); }
qIn.addEventListener("focus", () => { if (deck.on) deckFinish(true); });

// ----- the list: the same ten as rows, for a screen reader or a keyboard -----
let deckList = null;
function deckListRender() {
  if (!deck.on) { deckList?.remove(); deckList = null; return; }
  if (!deckList) { deckList = document.createElement("section"); deckList.id = "deck-list"; listEl.querySelector("#list-body").before(deckList); }
  const rest = deck.cards.filter((c) => !deck.where.has(c)), n = deck.where.size;
  deckList.innerHTML = `<h2>Start your wall</h2><p class="lsub">Nothing is marked yet.</p><p class="deck-list-imp"><button type="button" class="pill-btn primary" data-dimport>Import from TCGplayer or Collectr</button></p><h2>Or start with ten</h2><p class="lsub">Ten well-known cards, one from each set. Say which you have.</p><ul>${rest.map((c) => {
    const st = sets[c.si];
    return `<li class="lwrow ldeck"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${money(c.price)}</span></div><span class="ldeck-acts"><button type="button" class="pill-btn" data-df="no" data-c="${c.i}">Not yet</button><button type="button" class="pill-btn" data-df="chase" data-c="${c.i}">Chase it</button><button type="button" class="pill-btn primary" data-df="yes" data-c="${c.i}">Got it</button></span></li>`;
  }).join("")}</ul><p class="lsub deck-list-foot"><span>${n} of ${deck.cards.length} answered</span> <button type="button" class="pill-btn" data-dskip>${n ? "That's enough" : "Skip the rest"}</button></p>`;
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-df], [data-dskip], [data-dimport]"); if (!b || !deck.on) return;
  if (b.hasAttribute("data-dskip")) return deckFinish(true);
  if (b.hasAttribute("data-dimport")) return importOpen();
  deckAnswer(cards[Number(b.dataset.c)], b.dataset.df);
});

// ----- start, and the big bang -----
function deckStart() {
  deck.on = true; deck.stage = "choose"; deck.grow = null; deck.where.clear(); deck.history.length = 0;
  document.body.classList.add("decking"); deckEl.hidden = false;
  deckPlace(); deckText(); deckListRender(); kick();
}
// ----- the import, simulated: pick a source, a second of looking, and the seeded demo collection stands in for the file -----
function importOpen() { if (!deck.on) return; impProg.hidden = true; impChoices.forEach((b) => (b.disabled = false)); impDlg.showModal(); }
impChoices.forEach((b) => (b.onclick = () => {
  const src = b.dataset.src;
  impProg.hidden = false; impChoices.forEach((x) => (x.disabled = true)); tick(4);
  setTimeout(() => { impDlg.close(); importLand(src); }, reduced ? 700 : 1100);
}));
document.getElementById("imp-cancel").onclick = () => impDlg.close();
// The demo's seeded ownership, computed the way 10-model.js does (the same 541 cards in every variant).
const seeded = (c) => { const st = sets[c.si]; return h32(c.id + "o") < clamp(OWN_RATE[st.id] * (c.tier <= 1 ? 1.3 : c.tier === 2 ? 1 : c.tier === 3 ? 0.66 : 0.32), 0, 0.97); };
function seededGot(c) {
  const st = sets[c.si], START = Date.parse("2023-01-15"), NOW = Date.now(), BINDER = Date.parse("2024-03-09");
  if (st.year < 2003 && h32(c.id + "g") < 0.72) return BINDER + h32(c.id + "h") * 6 * 3600e3;
  const from = Math.max(START, st.released || START); return from + Math.pow(h32(c.id + "t"), 0.8) * Math.max(0, NOW - from - 86400e3);
}
function importLand(src) {
  if (!deck.on) return;
  const brought = new Set();
  for (const c of cards) { if (c.owned || !seeded(c)) continue; c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; brought.add(c); }
  deckFinish(true, { src, brought });
}
function deckFinish(skipped, imported = null) {
  if (!deck.on) return;
  deck.on = false; deck.fly = null; deck.drag = null; deck.spring = null; deck.grow = null;
  if (impDlg.open) impDlg.close();
  try { localStorage.setItem("wall-flicked", "1"); } catch { /* fine */ }
  const now = performance.now(), at = Date.now();
  let yes = 0, chase = 0;
  for (const [c, k] of deck.where) {
    if (k === "yes") { c.owned = true; c.got = at; saved[c.id] = { on: true, at }; yes++; }
    else if (k === "chase") { chasing[c.id] = true; chase++; }
  }
  persist(); persistChase();
  document.body.classList.remove("decking"); deckEl.hidden = true; deckListRender();
  mScroll = 0; inertia = false; cancelPress();
  layoutAll();
  // Every panel grows from a point; the cards you flicked fly in from where they left.
  const R = deckRect();
  for (const g of groups) { const m = g.m; g.pm = { x: m.x + m.w / 2 - 8, y: m.y + m.h / 2 - 8, w: 16, h: 16 }; g.ripple = null; g.burst = 0; }
  for (const c of cards) {
    const k = deck.where.get(c);
    if (k === "yes") c.pm = { x: R.x, y: -R.h - 80, w: R.w, h: R.h };
    else if (k === "no") c.pm = { x: R.x, y: vh + 80, w: R.w, h: R.h };
    else if (k === "chase") c.pm = { x: vw + 80, y: R.y, w: R.w, h: R.h };
    else if (imported?.brought.has(c)) c.pm = { x: vw * 0.1 + h32(c.id + "x") * vw * 0.8, y: vh + 30, w: 11, h: 15 }; // imported: pours in from the bottom
    else { const m = groups[c.g].pm; c.pm = { x: m.x + 8, y: m.y + 8, w: 0.5, h: 0.5 }; }
    c.delay = reduced ? 0 : k ? 0 : imported?.brought.has(c) ? Math.min(640, c.g * 44 + c.k * 1.6) : Math.min(520, 100 + c.g * 46 + c.k * 0.5);
  }
  const dur = reduced ? 1 : imported ? 1800 : 1600;
  deck.landed = now + dur;
  const what = yes || chase ? `${yes ? `${yes} on your wall` : ""}${yes && chase ? ", " : ""}${chase ? `${chase} to chase` : ""}.` : skipped ? "Your wall, empty for now." : "Nothing yet, and that's fine.";
  const next = document.body.classList.contains("listmode") ? "Tap a card to mark it." : "Tap a set to open it. Hold a card to mark it.";
  const line = imported ? `${imported.brought.size.toLocaleString()} cards imported from ${imported.src}. ${next.split(". ")[0].replace(/\.$/, "")}.` : `${what} ${next}`;
  state.trans = { kind: "morph", t0: now, dur, done: () => {
    for (const g of groups) g.pm = null; kick();
    toast(line); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), 6500);
  } };
  tick(10); updateCount(); drawList(); kick();
}
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-spares", "wall-paid", "wall-trades", "wall-flicked"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ----- hooks into the wall -----
// While the deck is up the mosaic isn't drawn or touched: the field is empty but for the card.
function drawMosaic(now, alpha = 1, except = null) {
  if (deck.on && !state.trans) { drawDeck(now); return; }
  for (const g of groups) {
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    drawPanel(g, now, alpha);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha);
  }
}
function hit(sx, sy, nearest = false) {
  if (state.trans || deck.on) return null;
  if (view === "mosaic") {
    const y = sy + mScroll;
    for (const g of groups) if (g.m && sx >= g.m.x && sx <= g.m.x + g.m.w && y >= g.m.y && y <= g.m.y + g.m.h) return { block: g };
    if (!nearest) return null;
    let best = null, bd = Infinity;
    for (const g of groups) { if (!g.m) continue; const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
    return best && bd < 60 ? { block: best } : null;
  }
  const g = state.g; if (!g) return null;
  const p = toWorld(sx, sy);
  if (p.x < g.x || p.x > g.x + g.w || p.y < g.y || p.y > g.y + g.h) return null;
  if (p.y < g.y + g.head) return { block: g };
  const col = Math.floor((p.x - g.x) / stepX(g)), row = Math.floor((p.y - g.y - g.head) / stepY(g));
  const inX = (p.x - g.x) - col * stepX(g) <= TW * g.sz, inY = (p.y - g.y - g.head) - row * stepY(g) <= TH * g.sz;
  const card = col < g.cols ? g.cards[row * g.cols + col] : null;
  return card && inX && inY ? { card, block: g } : { block: g };
}
function enterGroup(g, { then = null } = {}) {
  if (state.trans || deck.on) return;
  hideCaption(); tick(8);
  state.trans = openTrans(g, 0, fitCam(g)); state.trans.then = then;
  settle(1, 720);
}
// The cards you're chasing land wearing their gold tags, and keep them for a few seconds after the wall has settled.
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  drawTile0(c, sx, sy, w, h, now, mult);
  if (c.owned || w < 5 || c.e <= 0.5 || c.lift || !isChase(c)) return;
  let a = state.lens === "need" ? 1 : deck.landed ? clamp((deck.landed + 7000 - now) / 1500, 0, 1) : 0;
  if (a <= 0) return;
  if (state.lens !== "need") kick(); // keep drawing while the tags fade
  ctx.globalAlpha = Math.min(1, mult) * a; ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
  rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
}

// ----- Time with nothing owned yet: the range starts a month before your first card (or a month ago). -----
const tMin = () => { const gs = cards.filter((c) => c.owned && c.got).map((c) => c.got); return (gs.length ? Math.min(...gs) : Date.now()) - 30 * 86400e3; };
function setT(t, { user = false } = {}) {
  const lo = tMin();
  if (!Number.isFinite(t)) t = lo + (T_MAX() - lo) * Number(tRange.value) / 1000; // the base slider listener still fires with its stale range
  state.t = clamp(t, lo, T_MAX());
  const p = (state.t - lo) / Math.max(1, T_MAX() - lo);
  tRange.value = String(Math.round(p * 1000)); tRange.style.setProperty("--p", `${p * 100}%`);
  const m = monthOf(state.t);
  if (m !== lastMonth) { if (user || playing) tick(3); lastMonth = m; }
  const n = cards.filter((c) => c.owned && c.got && c.got <= state.t).length;
  tWhen.textContent = p > 0.995 ? "Now" : m; tCount.textContent = `${n.toLocaleString()} cards`;
  updateCount(); kick();
}
function playTime(fromStart = false) {
  if (reduced) { setT(T_MAX()); return; }
  const lo = tMin();
  const from = fromStart || state.t >= T_MAX() - 86400e3 ? lo : state.t;
  playing = { t0: performance.now(), from, dur: 7200 * (T_MAX() - from) / Math.max(1, T_MAX() - lo) };
  tPlay.setAttribute("aria-label", "Pause"); tPlay.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13M16 5.5v13" stroke-width="3"/></svg>';
  const stepT = (now) => {
    if (!playing) return;
    const p = clamp((now - playing.t0) / playing.dur, 0, 1);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    setT(playing.from + (T_MAX() - playing.from) * e);
    if (p < 1) requestAnimationFrame(stepT); else stopTime();
  };
  requestAnimationFrame(stepT);
}
function drawSpark() {
  const lo = tMin();
  const dates = cards.filter((c) => c.owned && c.got).map((c) => c.got).sort((a, b) => a - b);
  const N = 120, span = Math.max(1, T_MAX() - lo), pts = [];
  let k = 0;
  for (let i = 0; i <= N; i++) { const t = lo + span * i / N; while (k < dates.length && dates[k] <= t) k++; pts.push([i / N * 1000, 40 - (k / Math.max(1, dates.length)) * 38]); }
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  document.getElementById("t-line").setAttribute("d", line);
  document.getElementById("t-area").setAttribute("d", `${line}L1000,40L0,40Z`);
}
tRange.addEventListener("input", () => { stopTime(); setT(tMin() + (T_MAX() - tMin()) * Number(tRange.value) / 1000, { user: true }); });
