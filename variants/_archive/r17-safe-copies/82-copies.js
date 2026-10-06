// ---------- copies: how many of each card you have; any beyond the first is a spare (round 17, safe) ----------
// The way every inventory app does it. A card you own has a count (1 unless you say otherwise). The card panel shows
// a stepper beside In your collection ("You have 2", − and +), and every copy past the first is a spare, up for
// trade, unless you choose Keep both. The import brings realistic doubles, seeded by card id and weighted toward
// commons and uncommons, so the Trade lens is full from the first open. A spare finds someone in plain words: the
// card panel and the spare tile say who wants it, with Trade with Maya one tap away. An empty Trade lens offers a
// review of your likely doubles instead of a dead end. A done trade takes one copy, not the card.
//
// The base keeps spares as a flag map (`spares`, read by the const isSpare everywhere). Here that map becomes a view
// of the counts: a Proxy whose every key is computed from `copies`, so isSpare, wantsOf, the Trade lift, the table
// and the replies all follow the counts without being touched.

let copies = {}; // id -> { n, got, keep }: n copies of the card you got at `got` (a re-added card starts again at 1)
try { copies = JSON.parse(localStorage.getItem("wall-copies") || "{}") || {}; } catch { copies = {}; }
// The flag map is written too, as the counts see it, so a build without counts on this device still finds your spares.
const persistCopies = () => { try { localStorage.setItem("wall-copies", JSON.stringify(copies)); localStorage.setItem("wall-spares", JSON.stringify(spares)); } catch { /* private mode */ } };
const poolById = new Map(pool.map((c) => [c.id, c]));
let copiesKey = 0; // bumps on every change, for anything that caches
const recOf2 = (b) => { const r = copies[b.id]; return r && r.got === b.got ? r : null; };
function nOf(c) { const b = c.base || c; if (!b.owned) return 0; const r = recOf2(b); return r ? Math.max(1, r.n) : 1; }
const keptOf = (c) => Boolean(recOf2(c.base || c)?.keep);
const sparesOf = (c) => (keptOf(c) ? 0 : Math.max(0, nOf(c) - 1));
function setN(c, n, keep) {
  const b = c.base || c; if (!b.owned) return;
  n = clamp(Math.round(n), 1, 99);
  const k = keep ?? keptOf(b);
  if (n <= 1) delete copies[b.id]; else copies[b.id] = k ? { n, got: b.got, keep: true } : { n, got: b.got };
  copiesKey++;
}
// Spares from before counts (the base's Spare flag, or another build on this device) become a second copy, once.
let fresh = false;
try { fresh = localStorage.getItem("wall-copies") == null; } catch { /* fine */ }
if (fresh) for (const [id, on] of Object.entries(spares)) { const c = poolById.get(id); if (on && c?.owned && !recOf2(c)) setN(c, 2, false); }
spares = new Proxy({}, {
  get: (_, id) => { const c = typeof id === "string" ? poolById.get(id) : null; return c ? sparesOf(c) > 0 : undefined; },
  has: (_, id) => { const c = typeof id === "string" ? poolById.get(id) : null; return Boolean(c && sparesOf(c) > 0); },
  set: (_, id, v) => { const c = poolById.get(id); if (c?.owned) { if (v) setN(c, Math.max(2, nOf(c)), false); else if (nOf(c) > 1) setN(c, nOf(c), true); persistCopies(); } return true; },
  deleteProperty: () => true, // a trade takes one copy: completeTrade below says how many
  ownKeys: () => pool.filter((c) => sparesOf(c) > 0).map((c) => c.id),
  getOwnPropertyDescriptor: (_, id) => { const c = poolById.get(id); return c && sparesOf(c) > 0 ? { value: true, writable: true, enumerable: true, configurable: true } : undefined; },
});
if (fresh) persistCopies();
const people = (list) => (list.length <= 1 ? list.map((t) => t.name).join("") : `${list.slice(0, -1).map((t) => t.name).join(", ")} and ${list[list.length - 1].name}`);
// The layout of the Trade lens follows the spares; while a card is up close or Mark is on, it waits for you to finish.
let layoutDirty = false;
function relayoutSoon() {
  if (!lifted) return;
  if (state.focus || marking) { layoutDirty = true; return; }
  liftLayout(true);
}
function flushLayout() { if (!layoutDirty) return; layoutDirty = false; if (lifted) setTimeout(() => { if (!state.focus && !marking) liftLayout(true); }, 0); }

// ----- the import brings doubles (seeded by card id; commons and uncommons come in twos and threes) -----
function importCopies(c) {
  const p = [0.2, 0.15, 0.06, 0.03, 0.015, 0.01, 0.005][clamp(c.tier, 0, 6)];
  if (h32(`${c.id}|copies`) >= p) return 1; // the id leads: keys that differ only at the end hash alike
  const q = h32(`${c.id}|more`);
  return c.tier <= 1 ? (q < 0.1 ? 4 : q < 0.34 ? 3 : 2) : 2;
}
function finishImport(src) {
  if (!wel.on) return;
  const now = performance.now(), chaseAll = wChase.checked;
  let n = 0, k = 0, d = 0;
  for (const c of pool) {
    if (c.owned || !c.own0) { if (chaseAll && !c.owned) { chasing[c.id] = true; k++; } continue; }
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; n++;
    if (!c.of) { const x = importCopies(c); if (x > 1) { copies[c.id] = { n: x, got: c.got }; d++; } }
    if (!reduced) c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true };
  }
  copiesKey++; persist(); persistCopies(); if (chaseAll) persistChase();
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  updateCount(); drawList();
  const sync = syncDone({ quiet: true });
  if (lifted && !sync) liftLayout(true);
  tick(14);
  setTimeout(() => toast(`${n.toLocaleString()} cards imported from ${src}, ${d} with spare copies.${chaseAll ? ` ${k.toLocaleString()} on your chase list.` : ""}`), reduced ? 100 : 500);
  kick();
}

// ----- the card panel: a stepper beside In your collection, and a line saying who wants the spare -----
const actsEl = panel.querySelector(".acts");
const stepEl = document.createElement("div");
stepEl.className = "copies"; stepEl.id = "p-copies"; stepEl.setAttribute("role", "group"); stepEl.setAttribute("aria-label", "Copies you have"); stepEl.hidden = true;
stepEl.innerHTML = `<button type="button" class="cbtn" id="p-less" aria-label="One fewer copy">−</button><output id="p-n" aria-live="polite"></output><button type="button" class="cbtn" id="p-more" aria-label="One more copy">+</button>`;
flagBtn.after(stepEl);
const pLess = stepEl.querySelector("#p-less"), pMore = stepEl.querySelector("#p-more"), pN = stepEl.querySelector("#p-n");
const spareEl = document.createElement("div");
spareEl.className = "spareline"; spareEl.id = "p-spare"; spareEl.hidden = true;
spareEl.innerHTML = `<p id="p-spare-t"></p><div class="sl-acts"><button type="button" class="pill-btn primary" id="p-trade"></button><button type="button" class="pill-btn" id="p-keep"></button></div>`;
actsEl.after(spareEl);
const pSpareT = spareEl.querySelector("#p-spare-t"), pTrade = spareEl.querySelector("#p-trade"), pKeep = spareEl.querySelector("#p-keep");
function updateFlag(c) {
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
function copiesChanged(c) {
  persistCopies(); tick(5);
  if (state.focus) fillPanel(state.focus, 0);
  drawList(); relayoutSoon(); kick();
}
pMore.onclick = () => { const c = state.focus; if (!c?.owned) return; setN(c, nOf(c) + 1); flashTile(c); copiesChanged(c); };
pLess.onclick = () => { const c = state.focus; if (!c?.owned || nOf(c) <= 1) return; setN(c, nOf(c) - 1); copiesChanged(c); };
pKeep.onclick = () => { const c = state.focus; if (!c?.owned || nOf(c) <= 1) return; setN(c, nOf(c), !keptOf(c)); copiesChanged(c); };
pTrade.onclick = () => { const t = TRADERS.find((x) => x.id === pTrade.dataset.t); if (t) tradeWith(t); };
// Trade with Maya, from the card: out of the set, into the Trade lens, then the table (the way Open does from a toast).
function tradeWith(t) {
  if (document.body.classList.contains("listmode") || wel.on || tbl.on) return;
  closePop(true); if (state.focus) unfocus();
  let tries = 0, step = 0;
  const go = () => {
    if (tbl.on || tries++ > 60) return;
    if (state.trans || shuffle || fly) { setTimeout(go, 120); return; }
    if (step === 0) { step = 1; if (view === "set") { exitToMosaic(); setTimeout(go, 120); return; } }
    if (step === 1) { step = 2; if (state.lens !== "trade") { setLens("trade"); setTimeout(go, 120); return; } }
    if (view === "mosaic") startTrade(t, strip?.chips.find((x) => x.t === t) || null);
  };
  go();
}
function flashTile(c) { const b = c.base || c, now = performance.now(); for (const x of [b, ...twinsOf(b)]) x.flash = { t0: now, gold: true }; live.until = Math.max(live.until, now + 1200); }
// The panel's own Chase it stays for cards you don't have; on a card you own the stepper takes its place.
flagBtn.onclick = () => {
  const c = state.focus; if (!c || c.owned) return;
  chasing[c.id] = !isChase(c); persistChase(); updateFlag(c); tick(5); drawList(); if (lifted) liftLayout(true); kick();
  toast(chasing[c.id] ? `${c.name} on your chase list. Pay up to ${money(capOf(c))}.` : `${c.name} off your chase list.`);
};
// Back from the card: the Trade lens takes the shape the counts left it in.
function unfocus() {
  if (!state.focus) return;
  state.focus = null;
  document.body.classList.remove("focused");
  if (view === "set" && state.g) { const f = fitCam(state.g); if (cam.s > f.s * 1.02) flyTo(f, 380); }
  flushLayout();
  kick();
}

// ----- Mark: hold a card you have to add a copy, and keep the finger down to sweep along the row -----
const copySession = new Map(); // card -> its copies record when the session first touched it
function addCopy(c) {
  const b = c.base || c; if (!b.owned) return;
  if (!copySession.has(b)) copySession.set(b, copies[b.id] ? { ...copies[b.id] } : null);
  setN(b, nOf(b) + 1); flashTile(b); persistCopies(); tick(6);
  updateBar(); drawList(); relayoutSoon(); kick();
}
function revertCopies(list) {
  for (const [b, rec] of list) { if (rec) copies[b.id] = rec; else delete copies[b.id]; }
  copiesKey++; persistCopies(); drawList(); relayoutSoon(); kick();
}
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
  if (view === "set" && !state.focus && h0?.card && TW * h0.card.sz * cam.s >= 14) {
    const card = h0.card;
    gesture.card = card;
    state.press = { c: card, t0: now, timer: setTimeout(() => {
      if (gesture?.kind !== "one" || gesture.moved || state.press?.c !== card) return;
      if (marking) { // already marking: a hold on a card you have adds a copy (sweep on for the next ones); else it's a chase
        cancelPress(); tick(8);
        if (card.owned) {
          const at = samples[samples.length - 1] || { x: gesture.x, y: gesture.y };
          gesture.stroke = { copy: true, seen: new Set([card]), last: { x: at.x, y: at.y } }; gesture.moved = true;
          addCopy(card); return;
        }
        gesture = null;
        chasing[card.id] = !isChase(card); persistChase(); toast(chasing[card.id] ? `${card.name} on your chase list.` : `${card.name} off your chase list.`);
        drawList(); kick(); return;
      }
      enterMark();
      beginStroke(card, samples[samples.length - 1] || { x: gesture.x, y: gesture.y });
    }, 430) };
    kick();
  }
}
function paintTo(p) {
  const s = gesture.stroke, a = s.last, n = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / 10));
  for (let i = 1; i <= n; i++) {
    const h = hit(a.x + (p.x - a.x) * i / n, a.y + (p.y - a.y) * i / n);
    if (h?.card && !s.seen.has(h.card)) { s.seen.add(h.card); if (s.copy) { if (h.card.owned) addCopy(h.card); } else markCard(h.card, s.on); }
  }
  s.last = { x: p.x, y: p.y };
}
function tally() {
  let added = 0, out = 0, more = 0; const setsIn = new Set();
  for (const [c, was] of session) { if (c.owned === was) continue; if (c.owned) added++; else out++; setsIn.add(c.si); }
  for (const [b, rec] of copySession) { const was = rec && rec.got === b.got ? rec.n : 1, d = nOf(b) - was; if (d > 0) { more += d; setsIn.add(b.si); } }
  const head = [added ? `${added} added` : "", out ? `${out} taken out` : "", more ? `${more} extra ${more === 1 ? "copy" : "copies"}` : ""].filter(Boolean).join(", ");
  const one = setsIn.size === 1 ? sets[[...setsIn][0]] : null;
  const sub = one ? `${ownedIn(one.cards)} of ${one.cards.length} in ${one.name}` : setsIn.size ? `Across ${setsIn.size} sets` : "";
  return { n: added + out + more, head, sub };
}
function updateBar() {
  const t = tally();
  mHead.textContent = t.n ? t.head : "Mark cards";
  mSub.textContent = t.n ? t.sub : "Tap to mark. Hold one you have to add a copy";
  mUndo.disabled = !t.n;
}
function leaveMark() {
  if (!marking) return;
  marking = false; document.body.classList.remove("marking"); markBtn.hidden = view !== "set";
  const t = tally(), changes = [...session], cs = [...copySession]; session.clear(); copySession.clear();
  if (t.n) toast(`${t.head}.${t.sub ? ` ${t.sub}.` : ""}`, () => { revert(changes); revertCopies(cs); });
  flushLayout();
  updateCount(); kick();
}
mUndo.onclick = () => { if (!session.size && !copySession.size) return; revert([...session]); revertCopies([...copySession]); session.clear(); copySession.clear(); updateBar(); tick(6); toast("Put back as it was"); };

// ----- a done trade takes one copy, not the card -----
function completeTrade(rec, t, landAt = 0) {
  const give = toCards(rec.give), get = toCards(rec.get), still = [];
  quietLayout = true;
  for (const c of give) {
    if (nOf(c) > 1) { setN(c, nOf(c) - 1); still.push(c); } else if (c.owned) setOwned(c, false, { quiet: true });
    if (landAt) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; }
  }
  for (const c of get) { delete chasing[c.id]; if (!c.owned) setOwned(c, true, { quiet: true }); else setN(c, nOf(c) + 1); if (landAt) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; } }
  quietLayout = false;
  persistCopies(); persistChase(); syncBadge(); updateCount();
  rec.state = "done"; rec.doneAt = Date.now(); persistTrades(); drawList();
  toast(`${rec.by === "them" ? `${t.name} accepted. ` : ""}${copyTradedText(get, give, still, t)}`);
}
const copyTradedText = (get, give, still, t) => `${names(get)} ${get.length === 1 ? "is" : "are"} yours. ${names(give)} went to ${t.name}.${still.length ? ` You still have ${still.length === give.length && give.length > 1 ? "one of each" : names(still)}.` : ""}`;
function crossOnWall(rec, t) {
  const give = toCards(rec.give).filter((c) => c.owned), get = toCards(rec.get).filter((c) => !c.owned);
  if (reduced || document.body.classList.contains("listmode") || crossing) { completeTrade(rec, t); if (lifted) liftLayout(true); kick(); return; }
  crossing = { rec, t, give, get, still: [], n: give.length + get.length };
  const now = performance.now(), step = () => { if (crossing && --crossing.n <= 0) finishCross(); };
  quietLayout = true;
  give.forEach((c, i) => {
    if (nOf(c) > 1) { setN(c, nOf(c) - 1); crossing.still.push(c); } // a copy leaves; the card stays on the wall
    else { setOwned(c, false, { quiet: true }); if (lifted) c.away = true; }
    flyCard(c, true, now + i * 80, 720, step);
  });
  quietLayout = false; persistCopies();
  get.forEach((c, i) => flyCard(c, false, now + 260 + i * 80, 780, () => { quietLayout = true; setOwned(c, true, { quiet: true }); quietLayout = false; delete chasing[c.id]; persistChase(); step(); }));
  if (!crossing.n) finishCross();
}
function finishCross() {
  const { rec, t, give, get, still } = crossing; crossing = null;
  for (const c of give) c.away = false;
  rec.state = "done"; rec.doneAt = Date.now(); persistTrades();
  syncBadge(); updateCount(); drawList();
  if (lifted) liftLayout(true);
  tick(14); kick();
  toast(`${rec.by === "them" ? `${t.name} accepted. ` : ""}${copyTradedText(get, give, still || [], t)}`);
}

// ----- the spare tile in the Trade lens: the count on the card, and who wants it -----
function drawSpareTile(c, x, y, w, h, a, now) {
  const st = sets[c.si], b = c.base || c, who = wantedBy(b), want = who.length > 0, rad = Math.min(12, w * 0.07);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = want ? goldTint() : theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = want ? 1.5 : 1; ctx.strokeStyle = want ? theme.gold : theme["slot-line"]; ctx.stroke();
  if (w < 60) { ctx.globalAlpha = 1; return; }
  const pad = Math.max(8, w * 0.05), s = clamp(w / 177, 0.6, 1.3);
  const mh = h - pad * 2, mw = mh * TW / TH;
  foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  countPill(nOf(b), true, x + pad + 4, y + pad + 4, 10.5 * s);
  const tx = x + pad + mw + pad, tw = x + w - pad - tx;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.ink; font(800, 20 * s); ctx.fillText(short(c.price), tx, y + pad + 17 * s);
  if (want) {
    ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText("Wanted by", tw), tx, y + pad + 32 * s);
    ctx.fillStyle = theme.gold; font(700, 12.5 * s, true); ctx.fillText(fitText(who.length <= 2 ? who.map((t) => t.name).join(", ") : `${who[0].name} +${who.length - 1}`, tw), tx, y + pad + 46 * s);
  } else { ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText("No takers yet", tw), tx, y + pad + 32 * s); }
  ctx.fillStyle = theme.ink; font(700, 14 * s, true); ctx.fillText(fitText(c.name, tw), tx, y + h - pad - 13 * s);
  ctx.fillStyle = theme.muted; font(500, 11 * s); ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}

// ----- the count on the wall: ×2 on a tile you can read, a second card peeking behind one you can't -----
const pillW = new Map();
function countPill(n, spare, x, y, size) {
  if (n < 2) return;
  const txt = `×${n}`, a0 = ctx.globalAlpha;
  font(800, size);
  const k = `${curFont}|${txt}`; let tw = pillW.get(k); if (tw == null) { tw = ctx.measureText(txt).width; pillW.set(k, tw); }
  const h = size + 6, w = tw + 8;
  rr(x, y, w, h, h / 2); ctx.fillStyle = spare ? theme.gold : theme["panel-solid"]; ctx.fill();
  if (!spare) { ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  ctx.fillStyle = spare ? (theme.dark ? "#171920" : "#fff") : theme.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(txt, x + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.globalAlpha = a0;
}
function stackEdge(x, y, w, h, gold) {
  const o = clamp(w * 0.12, 1.5, 4), t = Math.max(1, o * 0.55);
  ctx.fillStyle = gold ? theme.gold : theme.muted;
  ctx.fillRect(x + w, y + o, t, h); ctx.fillRect(x + o, y + h, w - o + t, t);
}
function copyTile(c, r, a) {
  const b = c.base || c, n = nOf(b); if (n < 2 || r.w < 5) return;
  const spare = !keptOf(b);
  // far out, a second card peeking from behind (gold in Trade, where it means up for trade); close up, the count
  if (r.w < 26) { ctx.globalAlpha = a * (state.lens === "trade" ? 0.9 : 0.55); stackEdge(r.x, r.y, r.w, r.h, spare && state.lens === "trade"); return; }
  ctx.globalAlpha = a;
  const marked = marking && session.has(c) && session.get(c) !== c.owned;
  const size = r.w >= 90 ? 13 : 10.5, inset = Math.max(3, r.w * 0.05);
  countPill(n, spare, r.x + inset + (marked ? clamp(r.w * 0.11, 5, 12) * 2 + 4 : 0), r.y + inset, size);
}
function drawCopies() {
  if (!(state.lens === "have" || state.lens === "trade") || state.time || state.trans || shuffle || room.on || tbl.on || preview) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const dim = 1 - state.dimAll * 0.72;
  if (view === "mosaic") {
    for (const g of groups) {
      if (g.done || g.minting || inCase(g) || !g.m) continue;
      if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
      const pe = g.pe ?? 1;
      for (const c of g.cards) {
        if (!c.owned || c.e < 0.3 || !c.m || c.m.h < 3) continue;
        if (c.lift && c.m.w > c.m.h * 1.05) continue; // a spare tile carries its own count
        const y = c.m.y - mScroll; if (y > vh || y + c.m.h < 0) continue;
        if (nOf(c) < 2) continue;
        copyTile(c, { x: c.m.x, y, w: c.m.w, h: c.m.h }, c.e * pe);
      }
    }
  } else if (state.g) {
    const g = state.g;
    const y0 = cam.y, y1 = cam.y + vh / cam.s;
    const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
    for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
      const c = g.cards[k];
      if (!c.owned || c.e < 0.3 || nOf(c) < 2) continue;
      const r = binderRect(c, cam);
      if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
      copyTile(c, r, c.e * (state.focus && state.focus !== c ? dim : 1));
    }
  }
  ctx.globalAlpha = 1;
}
// Drawn with the other overlays, after the wall (the welcome's set picks go on top).
function drawPicks() {
  drawCopies();
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

// ----- the Trade lens: what the spares add up to, or, with none yet, a review of your likely doubles -----
const spareCount = () => cards.reduce((a, c) => a + sparesOf(c), 0);
function setLens(lens) {
  if (lens === state.lens) return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "have") { const n = cards.filter((c) => c.owned).length, s = spareCount(); toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection${s ? `, ${s} spare${s === 1 ? "" : "s"}` : ""}`); }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  const news = lens === "chase" && live.news.some((c) => c.deal && isChase(c) && !c.owned);
  if (lens === "chase" && !news) { const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length; toast(n ? `${n} on your chase list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your chase list yet. Open a card and choose Chase it."); }
  if (lens === "trade") tradeToast();
  if (was === "chase") closePop(true);
  if (news) showDealBar(); else hideDealBar();
  liftLayout(); drawList(); updateCount(); kick();
}
function tradeToast() {
  const sp = cards.filter(isSpare), n = sp.reduce((a, c) => a + sparesOf(c), 0), w = sp.filter((c) => wantedBy(c).length).length;
  if (sp.length) toast(`${n} spare${n === 1 ? "" : "s"} to trade${w ? `, ${w} of them wanted` : ". Nobody wants them yet"}`);
  else if (cards.some((c) => c.owned)) toast("No spares yet");
  else toast("No spares yet. Mark the cards you have first.");
}
// The empty Trade lens: a bar at the top offers the review (a familiar empty state, not a dead end).
const ctaEl = document.createElement("div");
ctaEl.className = "dealbar sparebar glass"; ctaEl.id = "spare-cta"; ctaEl.hidden = true; ctaEl.setAttribute("role", "status");
ctaEl.innerHTML = `<button type="button" class="db-main" id="sc-main"><b>No spares yet</b><span id="sc-sub">Check the doubles you likely have</span></button><span class="sc-go" aria-hidden="true">Review</span>`;
document.getElementById("dealbar").after(ctaEl);
ctaEl.querySelector("#sc-main").onclick = () => openDoubles();
function syncCta() {
  const on = state.lens === "trade" && !tbl.on && !wel.on && !room.on && !cards.some(isSpare) && cards.some((c) => c.owned);
  if (on) { const k = likelyDoubles().length; ctaEl.querySelector("#sc-sub").textContent = k ? `${k} cards you likely have two of` : "Tap + on a card you have two of"; }
  ctaEl.hidden = !on;
}

// ----- the review: likely doubles, ticked, one tap to make them spares -----
// Likely: commons and uncommons you own (seeded by card id), the ones somebody wants first. Untick what you don't have.
function likelyDoubles() {
  const own = cards.filter((c) => c.owned && nOf(c) === 1);
  const odds = (c) => h32(`${c.id}|dup`);
  let list = own.filter((c) => c.tier <= 1 && odds(c) < 0.4);
  if (list.length < 8) list = list.concat(own.filter((c) => c.tier === 2 && odds(c) < 0.3));
  list = list.sort((a, b) => odds(a) - odds(b)).slice(0, 24); // the likeliest two dozen
  return list.sort((a, b) => wantedBy(b).length - wantedBy(a).length || a.si - b.si || a.n0 - b.n0);
}
const dblEl = document.createElement("dialog");
dblEl.id = "doubles"; dblEl.setAttribute("aria-labelledby", "dbl-h");
dblEl.innerHTML = `<h2 id="dbl-h">Your likely doubles</h2><p class="dbl-sub" id="dbl-sub"></p><ul class="dbl-list" id="dbl-list"></ul><div class="row"><button class="btn" id="dbl-no">Not now</button><button class="btn primary" id="dbl-go">Add spares</button></div>`;
document.body.append(dblEl);
const dblList = dblEl.querySelector("#dbl-list"), dblGo = dblEl.querySelector("#dbl-go");
let dblCards = [];
function openDoubles() {
  dblCards = likelyDoubles();
  if (!dblCards.length) { toast("Nothing looks doubled. Tap + on a card you have two of."); return; }
  const wanted = dblCards.filter((c) => wantedBy(c).length).length;
  dblEl.querySelector("#dbl-sub").textContent = `Commons and uncommons you have, the kind most collectors end up with two of${wanted ? `. ${wanted} of them are wanted by someone` : ""}. Untick any you only have one of.`;
  dblList.innerHTML = dblCards.map((c, i) => {
    const st = sets[c.si], who = wantedBy(c);
    return `<li><label><input type="checkbox" checked data-k="${i}"><span class="dn">${esc(c.name)}</span><span class="dm">${esc(st.name)} #${esc(c.num)}, ${esc(c.rname)}</span><span class="dp">${money(c.price)}</span><span class="dw">${who.length ? `${esc(people(who))} ${who.length === 1 ? "wants" : "want"} it` : ""}</span></label></li>`;
  }).join("");
  syncDblGo(); dblEl.showModal(); tick(4);
}
function syncDblGo() { const k = dblList.querySelectorAll("input:checked").length; dblGo.textContent = k ? `Add ${k} spare${k === 1 ? "" : "s"}` : "Add spares"; dblGo.disabled = !k; }
dblList.addEventListener("change", syncDblGo);
dblEl.querySelector("#dbl-no").onclick = () => dblEl.close();
dblGo.onclick = () => {
  const picked = [...dblList.querySelectorAll("input:checked")].map((x) => dblCards[Number(x.dataset.k)]).filter(Boolean);
  dblEl.close(); if (!picked.length) return;
  const before = picked.map((c) => [c, copies[c.id] ? { ...copies[c.id] } : null]);
  for (const c of picked) { setN(c, 2, false); flashTile(c); }
  persistCopies(); tick(14); drawList(); relayoutSoon(); kick();
  const w = picked.filter((c) => wantedBy(c).length).length;
  toast(`${picked.length} spare${picked.length === 1 ? "" : "s"} added${w ? `, ${w} wanted by someone` : ""}.`, () => revertCopies(before));
};

// ----- the list: counts in every row, and the review when there are no spares -----
function lstateOf(c) {
  if (!c.owned) return isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it";
  const b = c.base || c, n = nOf(b), s = sparesOf(b), who = wantedBy(b);
  if (n <= 1) return "Have it";
  if (!s) return `Have ${n}, keeping ${n === 2 ? "both" : "all"}`;
  return `Have ${n}, ${s} spare${who.length ? `, ${people(who)} want${who.length === 1 ? "s" : ""} it` : ""}`;
}
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  syncCta();
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}<p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
  }
  if (state.lens === "trade") {
    top = tradeListHTML();
    if (!cards.some(isSpare) && cards.some((c) => c.owned)) top = `<section><h2>No spares yet</h2><p class="lsub">A spare is any copy past your first. Tap a card you have two of, or check your likely doubles.</p><p class="lsub"><button type="button" class="pill-btn primary" data-dbl>Check likely doubles</button></p></section>` + top;
  }
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
listEl.addEventListener("click", (e) => { if (e.target.closest("[data-dbl]")) openDoubles(); });

// ----- Reset the demo forgets the counts too; About says how spares work now -----
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases", "wall-scope", "wall-done", "wall-spares", "wall-copies", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };
for (const li of about.querySelectorAll("li")) if (li.innerHTML.includes("<b>Spare</b>")) li.innerHTML = li.innerHTML.replace(/<b>Spare<\/b> on a card you own puts it up for trade\./, "On a card you own, <b>+</b> counts a copy: every copy past your first is a spare, up for trade.");
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { copies: { get: () => copies }, nOf: { value: nOf }, sparesOf: { value: sparesOf }, setN: { value: setN }, openDoubles: { value: openDoubles }, likelyDoubles: { value: likelyDoubles }, focus: { value: focus }, setLens: { value: setLens }, completeTrade: { value: completeTrade }, pool: { value: pool } }); }, 0);
