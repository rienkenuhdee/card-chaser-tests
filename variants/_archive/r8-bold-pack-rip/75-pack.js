// ---------- open a pack: type the numbers, the cards fly into your hand, Done deals them in ----------
// Inside a set, "Open a pack" is a mode. A number pad rises from the bottom; you type the number printed at the
// bottom of each card you pulled. Each number pulls that card's tile out of the binder (it flips over as it goes)
// into a fanned stack above your thumb: the pack's pulls. A number you already own is a spare: it joins the stack,
// tagged, and isn't marked again. A holo or better flashes as it lands. Wrong number: Backspace with nothing typed,
// or tap the card in the stack, and it flies back to its slot. Done deals the stack into the set: every card flies
// home, marks as owned with the ripple, and one toast sums the pack up, with Undo for the whole thing.
const PK_W = 68, PK_H = 95, PK_STEP_MAX = 22, PK_STEP_MIN = 11;
const pk = { active: false, g: null, typed: "", items: [], out: [], h: 0, l: 0, r: 0 };
// Where the sheet sits on screen: the stack and its count line up with it (it's narrower than a wide screen).
function pkMeasure() { const b = pkEl.getBoundingClientRect(); pk.h = pkEl.offsetHeight; pk.l = b.left; pk.r = b.right; }
const listMode = () => document.body.classList.contains("listmode");

// ----- chrome: the pill inside a set, and the pack sheet -----
const pkPill = document.createElement("button");
pkPill.type = "button"; pkPill.className = "pk-pill glass"; pkPill.id = "pk-pill";
pkPill.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5v11h13v-11M5.5 8.5l1.6-3.2 1.6 3.2 1.65-3.2 1.65 3.2 1.65-3.2 1.65 3.2 1.6-3.2 1.6 3.2M9 13.5h6"/></svg>Open a pack';
document.body.append(pkPill);
const pkEl = document.createElement("section");
pkEl.className = "pack glass"; pkEl.id = "pack"; pkEl.setAttribute("aria-label", "Open a pack"); pkEl.hidden = true;
pkEl.innerHTML = `
  <div class="pk-head">
    <button class="ib" id="pk-close" type="button" aria-label="Close the pack without marking anything"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="pk-t"><b>Open a pack</b><small id="pk-sub"></small></div>
    <button class="pk-done" id="pk-done" type="button">Done</button>
  </div>
  <div class="pk-show" id="pk-show"><span class="pk-num" id="pk-num"></span><span class="pk-match" id="pk-match" aria-live="polite"></span></div>
  <div class="pk-pulls" id="pk-pulls"></div>
  <div class="pk-keys" id="pk-keys" aria-label="Card number">
    <button type="button" data-k="1">1</button><button type="button" data-k="2">2</button><button type="button" data-k="3">3</button>
    <button type="button" data-k="4">4</button><button type="button" data-k="5">5</button><button type="button" data-k="6">6</button>
    <button type="button" data-k="7">7</button><button type="button" data-k="8">8</button><button type="button" data-k="9">9</button>
    <button type="button" data-k="bs" aria-label="Backspace"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11v12H9l-5-6zM12 9.5l5 5M17 9.5l-5 5"/></svg></button><button type="button" data-k="0">0</button><button type="button" data-k="add" id="pk-add">Add</button>
  </div>`;
document.body.append(pkEl);
const pkNum = pkEl.querySelector("#pk-num"), pkMatch = pkEl.querySelector("#pk-match"), pkSub = pkEl.querySelector("#pk-sub"), pkAdd = pkEl.querySelector("#pk-add"), pkShowEl = pkEl.querySelector("#pk-show"), pkPulls = pkEl.querySelector("#pk-pulls"), pkKeys = pkEl.querySelector("#pk-keys");

// ----- the pack's numbers -----
const pkSet = () => pk.g?.set || sets[0];
const pkFind = (num) => pkSet().cards.find((c) => c.num === num) || null;
const pkOpenEnded = (num) => pkSet().cards.some((c) => c.num !== num && c.num.startsWith(num));
const pkValue = () => pk.items.reduce((t, it) => t + it.c.price, 0);
const inPack = (c) => pk.items.some((it) => it.c === c);
function pkKey(k) {
  if (!pk.active) return;
  if (k === "bs") {
    if (pk.typed) { pk.typed = pk.typed.slice(0, -1); tick(3); }
    else if (pk.items.length) pkPutBack(pk.items[pk.items.length - 1]);
    pkShow(); return;
  }
  if (k === "add") { const c = pkFind(pk.typed); if (c) pkPull(c); else if (pk.typed) pkMiss(`No card ${pk.typed} in ${pkSet().name}`); return; }
  const t = pk.typed + k;
  if (!pkSet().cards.some((c) => c.num.startsWith(t))) { pk.typed = t; pkMiss(`No card ${t} in ${pkSet().name}`); return; }
  pk.typed = t; tick(3);
  const c = pkFind(t);
  // Nothing else could follow (142 when there's no 1420): it's in, no Add needed.
  if (c && !pkOpenEnded(t)) { pkPull(c); return; }
  pkShow();
}
function pkMiss(msg) {
  pk.typed = ""; tick(20);
  if (!reduced) { pkShowEl.classList.remove("shake"); void pkShowEl.offsetWidth; pkShowEl.classList.add("shake"); }
  pkShow(msg);
}
function pkShow(msg = "") {
  const st = pkSet(), t = pk.typed, c = t ? pkFind(t) : null;
  pkNum.textContent = t;
  let m = msg, cls = msg ? "no" : "";
  if (!msg) {
    if (!t) m = pk.items.length ? "Next number" : "Type a card number";
    else if (c) { m = `${c.name}, ${c.rname}${inPack(c) ? ". Already in this pack" : c.owned ? ". A spare" : ""}`; cls = inPack(c) ? "no" : "ok"; }
    else m = "Keep typing";
  }
  pkMatch.textContent = m; pkMatch.className = `pk-match ${cls}`;
  pkAdd.classList.toggle("ready", Boolean(c) && !msg && !inPack(c));
  pkSub.textContent = `${st.name}, ${st.cards.length} cards`;
  pkChips();
}
// The list view has no stack to look at, so the pulls read as chips in the sheet (tap one to put it back).
function pkChips() {
  if (!listMode()) { pkPulls.innerHTML = ""; return; }
  const n = pk.items.length;
  pkPulls.innerHTML = n ? `<span class="pk-count">${n} pull${n === 1 ? "" : "s"}, ${money(pkValue())}</span>` + pk.items.map((it, i) => `<button type="button" class="pk-chip" data-n="${i}" aria-label="Put back ${it.c.name}">${it.c.num} ${it.c.name}${it.spare ? " (spare)" : ""} <span aria-hidden="true">×</span></button>`).join("") : "";
}

// ----- pulling, putting back -----
const slotRect = (c) => binderRect(c, cam);
function pkPull(c) {
  if (inPack(c)) { pkMiss(`${c.name} is already in this pack`); return; }
  pkSettleOut();
  const now = performance.now(), spare = c.owned;
  const it = { c, spare, hit: !spare && c.tier >= 3, t0: now, dur: reduced || listMode() ? 0 : 520, land: 0, glint: 0 };
  c.pulled = true; c.e = 0;
  pk.items.push(it); pk.typed = "";
  if (!listMode()) pkReveal(c);
  tick(spare ? 5 : 10);
  pkShow(); kick();
}
// Bring the slot into the band above the sheet so you see where the card came from; the tile leaves as it arrives.
function pkReveal(c) {
  if (reduced) return;
  const band0 = topPad() + 10, band1 = vh - pk.h - PK_H - 30, r = slotRect(c);
  if (r.y >= band0 && r.y + r.h <= band1) return;
  const a = { ...cam };
  cam.y = c.y + TH * c.sz / 2 - (band0 + (band1 - band0) / 2) / cam.s;
  clampCam(state.g);
  const b = { ...cam }; Object.assign(cam, a);
  flyTo(b, 300);
}
function pkCurrent(it, i, n, now) {
  const R = pkStackRect(i, n);
  if (it.dur && now - it.t0 < it.dur) { const e = ease(clamp((now - it.t0) / it.dur, 0, 1)), A = slotRect(it.c); return { x: A.x + (R.x - A.x) * e, y: A.y + (R.y - A.y) * e, w: A.w + (R.w - A.w) * e, h: A.h + (R.h - A.h) * e, rot: R.rot * e }; }
  return R;
}
function pkPutBack(it) {
  const i = pk.items.indexOf(it); if (i < 0) return;
  const now = performance.now(), from = pkCurrent(it, i, pk.items.length, now);
  pk.items.splice(i, 1);
  const c = it.c, land = () => { c.pulled = false; c.e = 1; kick(); };
  if (reduced || listMode()) land();
  else pk.out.push({ c, spare: it.spare, kind: "back", from, t0: now, delay: 0, dur: 420, done: land });
  tick(6); pkShow(); kick();
}
function pkSettleOut() { for (const f of pk.out.splice(0)) f.done(); }

// ----- the mode -----
function packOpen(g) {
  if (!g?.set || pk.active) return;
  if (state.trans) finishTransition();
  pkSettleOut();
  if (state.focus) unfocus();
  hideCaption(); setMenu(false);
  pk.active = true; pk.g = g; pk.typed = ""; pk.items = [];
  document.body.classList.add("packing");
  pkEl.hidden = false; pkMeasure();
  if (reduced) pkEl.classList.add("up"); else requestAnimationFrame(() => pkEl.classList.add("up"));
  pkShow(); tick(8);
  if (!listMode() && view === "set") { const a = { ...cam }; clampCam(state.g); const b = { ...cam }; Object.assign(cam, a); if (b.y !== a.y) flyTo(b, 360); }
  kick();
}
function pkHide() {
  pk.active = false; pk.typed = "";
  document.body.classList.remove("packing"); pkEl.classList.remove("up");
  clearTimeout(pkHide.t); pkHide.t = setTimeout(() => { if (!pk.active) pkEl.hidden = true; }, reduced ? 0 : 450);
  kick();
}
// Close: everything flies back to its slot; nothing is marked.
function packClose() {
  if (!pk.active) return;
  const had = pk.items.length;
  while (pk.items.length) pkPutBack(pk.items[pk.items.length - 1]);
  pkHide();
  if (had) toast("Pack closed. Nothing marked.");
}
// Done: the stack deals into the set, oldest pull first; one toast for the lot, with Undo for the lot.
function packDone(instant = false) {
  if (!pk.active) return;
  const items = pk.items.slice(), g = pk.g, st = g.set, now = performance.now();
  pk.items = [];
  pkHide();
  if (!items.length) return;
  const fresh = items.filter((it) => !it.spare).map((it) => it.c);
  let ripple = null;
  const mark = (c) => { setOwned(c, true, { quiet: true }); c.anim = null; if (ripple) g.ripple = ripple; else ripple = g.ripple; };
  const finish = () => {
    const owned = ownedIn(st.cards), n = items.length, s = n === 1 ? "" : "s";
    if (!fresh.length) { toast(`${n} pull${s}, all spares. Nothing new to mark.`); return; }
    const undo = () => { for (const c of fresh) setOwned(c, false, { quiet: true }); };
    toast(owned === st.cards.length ? `${n} pull${s}, ${fresh.length} new. ${st.name} complete!` : `${n} pull${s}, ${fresh.length} new. ${st.name} ${owned} of ${st.cards.length}.`, undo);
    tick(fresh.length ? 14 : 6);
  };
  if (instant || reduced || listMode() || view !== "set" || state.g !== g) {
    for (const it of items) { it.c.pulled = false; it.c.e = 1; if (!it.spare) mark(it.c); }
    finish(); kick(); return;
  }
  pkSettleOut();
  const n = items.length;
  items.forEach((it, i) => {
    const from = pkCurrent(it, i, n, now);
    pk.out.push({ c: it.c, spare: it.spare, kind: "deal", from, t0: now, delay: i * 60, dur: 460, done: () => { it.c.pulled = false; it.c.e = 1; if (!it.spare) mark(it.c); if (i === n - 1) finish(); kick(); } });
  });
  tick(8); kick();
}

// ----- geometry: the fan above the thumb -----
function pkStackRect(i, n) {
  const top = vh - pk.h, maxW = pk.r - pk.l - 150;
  const step = n > 1 ? clamp((maxW - PK_W) / (n - 1), PK_STEP_MIN, PK_STEP_MAX) : 0;
  const k = n - 1 - i;
  return { x: pk.r - 16 - PK_W - k * step, y: top - 14 - PK_H - k * 0.6, w: PK_W, h: PK_H, rot: -k * 0.022 };
}
function pkHitStack(sx, sy) {
  const n = pk.items.length;
  for (let i = n - 1; i >= 0; i--) { const r = pkStackRect(i, n); if (sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 6 && sy <= r.y + r.h + 4) return pk.items[i]; }
  return null;
}

// ----- drawing: ghosts in the binder, the stack, the flights, every frame after the wall -----
function kick() {
  if (raf) return;
  raf = requestAnimationFrame(pkFrameAll);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; pkFrameAll(performance.now()); } }, 120);
}
function pkFrameAll(now) { frame(now); packFrame(now); }
function packFrame(now) {
  if (!pk.active && !pk.out.length) return;
  if (listMode()) return;
  if (view !== "set" || state.g !== pk.g || state.trans) { pkSettleOut(); if (pk.active) packDone(true); return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let busy = false;
  // Ghosts: a dashed pocket where each pulled card belongs, with its number.
  const away = [...pk.items.map((it) => it.c), ...pk.out.map((f) => f.c)];
  if (away.length) {
    ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.fillStyle = theme.muted; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const c of away) {
      const r = slotRect(c);
      if (r.w < 10 || r.y > vh || r.y + r.h < 0) continue;
      ctx.globalAlpha = 0.9; const d = Math.max(2, r.w * 0.06); ctx.setLineDash([d, d]); rr(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, r.w * 0.045); ctx.stroke(); ctx.setLineDash([]);
      if (r.w >= 30) { ctx.globalAlpha = 0.7; font(600, Math.max(9, r.w * 0.14)); ctx.fillText(c.num, r.x + r.w / 2, r.y + r.h / 2); }
    }
    ctx.globalAlpha = 1; ctx.textBaseline = "alphabetic";
  }
  // The shelf: the sheet's colour fades up behind the hand, so the fan and its count never fight the binder.
  if (pk.active) {
    const top = vh - pk.h, y0 = top - PK_H - 64, [R, G, B] = hex(theme.bg);
    const sg = ctx.createLinearGradient(0, y0, 0, top - PK_H - 10);
    sg.addColorStop(0, `rgb(${R} ${G} ${B} / 0)`); sg.addColorStop(1, `rgb(${R} ${G} ${B} / .92)`);
    ctx.globalAlpha = 1; rr(pk.l, y0, pk.r - pk.l, top - y0 + 20, [18, 18, 0, 0]); ctx.fillStyle = sg; ctx.fill();
    if (!pk.items.length && !pk.out.length) { ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.muted; font(600, 13.5); ctx.fillText("Your pulls land here", (pk.l + pk.r) / 2, top - PK_H / 2 - 10); }
  }
  const moving = pk.out.length > 0 || pk.items.some((it) => (it.dur && now - it.t0 < it.dur + 320) || (it.glint && now - it.glint < 900));
  // Foil is the costliest thing on a card and nobody sees it mid-flight: the base skips it while the wall moves,
  // and the stack borrows that switch while anything in it moves.
  const in0 = inertia; if (moving) inertia = true;
  // Flights out: back to the slot (wrong number) or dealing in (Done). Until its turn, a dealt card waits on the stack.
  for (const f of pk.out.slice()) {
    const p = reduced ? 1 : clamp((now - f.t0 - f.delay) / f.dur, 0, 1);
    const B = slotRect(f.c), e = ease(p), A = f.from;
    const r = { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e - Math.sin(Math.PI * p) * 22, w: A.w + (B.w - A.w) * e, h: A.h + (B.h - A.h) * e, rot: (A.rot || 0) * (1 - e) };
    if (p < 1) { drawPacked(f, r, p, 1, now); busy = true; }
    else { pk.out.splice(pk.out.indexOf(f), 1); f.done(); }
  }
  // The stack, oldest at the back.
  const n = pk.items.length;
  for (let i = 0; i < n; i++) {
    const it = pk.items[i];
    let p = 1, k = 1;
    const r = pkCurrent(it, i, n, now);
    if (it.dur && now - it.t0 < it.dur) { p = clamp((now - it.t0) / it.dur, 0, 1); r.y -= Math.sin(Math.PI * p) * 26; busy = true; }
    else if (!it.land) { it.land = now; if (it.hit) { it.glint = now; tick(30); toast(`${it.c.name}! ${it.c.rname}, ${money(it.c.price)}`); } }
    if (it.land && now - it.land < 320) { k = 1 + (it.hit ? 0.16 : 0.08) * Math.sin(Math.PI * (now - it.land) / 320); busy = true; }
    if (it.glint && now - it.glint < 900) busy = true;
    drawPacked(it, r, p, k, now);
  }
  inertia = in0;
  // The count and what it's worth, beside the fan.
  if (n) {
    const R0 = pkStackRect(0, n), spares = pk.items.filter((it) => it.spare).length;
    ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = theme.ink; font(800, 18, true); ctx.fillText(`${n} pull${n === 1 ? "" : "s"}`, pk.l + 16, R0.y + R0.h - 24);
    ctx.fillStyle = theme.muted; font(600, 13); ctx.fillText(`${money(pkValue())}${spares ? `, ${spares} spare${spares === 1 ? "" : "s"}` : ""}`, pk.l + 16, R0.y + R0.h - 6);
  }
  ctx.globalAlpha = 1; ctx.setLineDash([]);
  if (busy) kick();
}
// One card of the pack: a pocket that flips into a face on its way in, and back on its way out (a spare is a face
// both ways); a holo or better catches the light as it lands; a spare wears a tag.
function drawPacked(it, r, p, k, now) {
  const kind = it.kind || "in", c = it.c;
  const flip = kind === "deal" || it.spare || reduced ? -1 : Math.cos(Math.PI * p);
  const w = r.w * Math.max(0.06, Math.abs(flip)), h = r.h, rad = w * 0.045;
  const face = kind === "back" ? flip > 0 : flip <= 0;
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h); ctx.rotate(r.rot || 0); ctx.scale(k, k);
  ctx.globalAlpha = 1;
  ctx.shadowColor = "rgb(0 0 0 / .3)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  rr(-w / 2, -h, w, h, rad); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (face || it.spare) cardFace(c, -w / 2, -h, w, h, now, false); else emptyPocket(c, -w / 2, -h, w, h, false);
  if (it.glint) {
    const q = (now - it.glint) / 900;
    if (q < 1) {
      ctx.save(); rr(-w / 2, -h, w, h, rad); ctx.clip();
      const fx = -w / 2 - w + q * w * 3, fg = ctx.createLinearGradient(fx, -h, fx + w * 0.9, 0);
      fg.addColorStop(0, "rgb(255 255 255 / 0)"); fg.addColorStop(0.4, "rgb(170 225 255 / .55)"); fg.addColorStop(0.5, "rgb(255 236 170 / .85)"); fg.addColorStop(0.6, "rgb(170 250 210 / .55)"); fg.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.globalCompositeOperation = "screen"; ctx.fillStyle = fg; ctx.fillRect(-w / 2, -h, w, h); ctx.globalCompositeOperation = "source-over";
      ctx.restore();
      ctx.lineWidth = 2.5; ctx.strokeStyle = theme.gold; ctx.globalAlpha = 1 - q; rr(-w / 2 - 2, -h - 2, w + 4, h + 4, rad + 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  if (it.spare && w > 30) {
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; font(700, 9.5);
    rr(-w / 2 + 4, -h + 4, 36, 15, 3); ctx.fillStyle = theme.ink; ctx.fill(); ctx.fillStyle = theme.bg; ctx.fillText("Spare", -w / 2 + 8, -h + 15);
  }
  ctx.restore();
}

// ----- the wall around the mode: what a tap, a hold, a pinch, Back and the lenses do while a pack is open -----
function emphasis(c) {
  if (c.pulled) return 0;
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.16 : 1;
  if (state.lens === "deals") return !c.owned && c.deal ? 1 : 0.18;
  if (state.lens === "value") return c.owned ? 1 : 0.22;
  return 1;
}
// The binder stops above the sheet while a pack is open.
function clampCam(g) {
  if (!g) return;
  const left = -12 / cam.s, right = g.w + 12 / cam.s - vw / cam.s;
  cam.x = right < left ? (left + right) / 2 : clamp(cam.x, left, right);
  const pad = pk.active && !listMode() ? pk.h + PK_H + 44 : botPad();
  const top = -(topPad() + 6) / cam.s, bottom = g.h + (pad + 20) / cam.s - vh / cam.s;
  cam.y = bottom < top ? top : clamp(cam.y, top, bottom);
}
// In pack mode a tap on a binder card pulls it (the other way to enter a number); a tap on the stack puts one back.
function tap(sx, sy) {
  if (state.trans) return;
  if (pk.active) {
    const it = pkHitStack(sx, sy); if (it) return pkPutBack(it);
    const h = hit(sx, sy);
    if (h?.card && TW * h.card.sz * cam.s >= 14) pkPull(h.card);
    return;
  }
  const h = hit(sx, sy);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") { if (h?.block) enterGroup(h.block); return; }
  if (!h?.card) return;
  const w = TW * h.card.sz * cam.s;
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}
function toggleWithUndo(c) {
  if (pk.active) { if (!inPack(c)) pkPull(c); return; }
  const was = c.owned; setOwned(c, !was, { undo: () => setOwned(c, was, { quiet: true }) });
}
// Back deals the pack in (the safe way out: Undo covers it) and stays in the set; a second Back leaves.
function exitToMosaic() {
  if (pk.active) { packDone(); return; }
  pkSettleOut();
  if (state.trans || view !== "set") return;
  unfocus(); tick(6);
  inertia = false; fly = null;
  const m = state.g.m; if (m.y - mScroll < topPad() || m.y + m.h - mScroll > vh - botPad()) mScroll = clamp(m.y - topPad() - 10, 0, mMax);
  state.trans = openTrans(state.g, 1, cam);
  settle(0, 620);
}
function slideGroup(d) {
  if (pk.active) { bump(d); return; }
  pkSettleOut();
  if (state.trans || view !== "set") return;
  const i = groups.indexOf(state.g), n = groups[i + d];
  if (!n) { bump(d); return; }
  tick(6);
  const fromCam = { ...cam };
  const prev = state.g;
  state.g = n; Object.assign(cam, fitCam(n));
  state.trans = { kind: "slide", from: prev, fromCam, g: n, dir: d, t0: performance.now(), dur: reduced ? 1 : 460, done: () => kick() };
  setChrome(); kick();
}
// A pinch can zoom the binder while a pack is open, but not close the set under the sheet.
function pinchMove(a, b) {
  const g = gesture, d = dist(a, b), m = mid(a, b), r = d / g.d0, now = evT || performance.now();
  if (view === "mosaic") {
    if (!g.g) return;
    const q = clamp((r - 1) / 1.1, 0, 1);
    if (!state.trans && q > 0.01) state.trans = openTrans(g.g, 0, fitCam(g.g));
    if (state.trans?.kind === "open" && !state.trans.anim) { state.trans.q = q; g.qs.push({ q, t: now }); kick(); }
    return;
  }
  if (state.trans && state.trans.kind !== "open") return;
  const f = fitCam(state.g), s = pk.active ? Math.max(g.cam.s * r, f.s) : g.cam.s * r;
  if (s < f.s * 0.995) {
    if (!state.trans) { Object.assign(cam, f); state.trans = openTrans(state.g, 1, f); g.closeD = d * (f.s / s); }
    if (!state.trans.anim) { const q = clamp(1 - (1 - d / (g.closeD || d)) / 0.6, 0, 1); state.trans.q = q; g.qs.push({ q, t: now }); }
    kick(); return;
  }
  if (state.trans && !state.trans.anim) { state.trans = null; g.closeD = 0; g.qs = []; }
  const sc = Math.min(s, maxS());
  const wx = g.cam.x + g.m0.x / g.cam.s, wy = g.cam.y + g.m0.y / g.cam.s;
  cam.s = sc; cam.x = wx - m.x / sc; cam.y = wy - m.y / sc;
  clampCam(state.g);
  kick();
}
// The pill only makes sense laid out by set (a region or a price band isn't a pack).
function markMode() {
  arrMenu.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
  pkPill.hidden = mode !== "set";
}
// The list: each set gets its own "Open a pack".
function drawList() {
  if (!listMode()) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "deals" ? !c.owned && c.deal : true);
  listEl.querySelector("#list-body").innerHTML = groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const open = g.set ? `<button type="button" class="pill-btn pk-open" data-g="${g.gi}">Open a pack</button>` : "";
    return `<section><div class="lhead"><h2>${g.name}</h2>${open}</div><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? "Have it" : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

// ----- input -----
pkPill.onclick = () => packOpen(state.g);
pkEl.querySelector("#pk-done").onclick = () => packDone();
pkEl.querySelector("#pk-close").onclick = () => packClose();
// Keys answer on the way down (a number pad should feel instant); keyboard activation still comes through click.
pkKeys.addEventListener("pointerdown", (e) => { const b = e.target.closest("[data-k]"); if (!b) return; e.preventDefault(); pkKey(b.dataset.k); });
pkKeys.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b && e.detail === 0) pkKey(b.dataset.k); });
pkPulls.addEventListener("click", (e) => { const b = e.target.closest(".pk-chip"); if (b) pkPutBack(pk.items[Number(b.dataset.n)]); });
listEl.addEventListener("click", (e) => { const b = e.target.closest(".pk-open"); if (b) packOpen(groups[Number(b.dataset.g)]); });
// A physical keyboard types into the pack while it's open (unless you're in the search field).
addEventListener("keydown", (e) => {
  if (!pk.active || document.activeElement === qIn || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (/^\d$/.test(k)) pkKey(k); else if (k === "Backspace") pkKey("bs"); else if (k === "Enter") pkKey("add"); else if (k === "Escape") packClose(); else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
// Leaving the set another way (rearrange, search, the list) deals the pack in first, without the flights.
arrMenu.addEventListener("click", (e) => { if (pk.active && e.target.closest("[data-mode]")) packDone(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (pk.active) packDone(true); }, true);
document.getElementById("to-wall").addEventListener("click", () => { if (pk.active) packDone(true); }, true);
qIn.addEventListener("focus", () => { if (pk.active && !listMode()) packDone(true); });
addEventListener("resize", () => { if (pk.active) { pkMeasure(); kick(); } });
