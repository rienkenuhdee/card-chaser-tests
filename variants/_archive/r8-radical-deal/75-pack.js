// ---------- the pack: pull down on a binder to open a booster of what you're missing ----------
// Inside a set, pulling down past the top of the binder (with resistance, like pull to refresh) brings a sealed pack
// out from behind the top strip, in the set's colour with its name on it. Keep pulling past the line and let go (or
// swipe across it while you hold) and it tears open: the set's missing cards deal out as a stack of full-size cards
// in number order, one on top, the next peeking behind. Swipe right to keep one (it flies out of the stack to its
// slot in the binder behind and marks owned, with the usual ripple), left to pass (it slides away). A number index
// along the right edge lets a thumb scrub straight to a number. Done, the last card, or pulling the stack down closes
// the pack; one toast sums it up with Undo for the whole pack. Reduced motion: no flights, cards simply appear.
const PULL_T = 150; // how far you pull (in screen px) before the pack opens
const pullDrop = (p) => 110 * (1 - Math.exp(-p / 150)); // the binder gives under the pull, with resistance
const pack = { phase: "closed", pull: 0, drop: 0, g: null, list: [], i: 0, kept: [], t0: 0, pr: null, drag: null, settle: null, promote: 0, flights: [], armed: false, hinted: false, done: 0 };
try { pack.hinted = localStorage.getItem("wall-pack-hint") === "1"; } catch { /* fine */ }
let packFoil = false; // true only while the top card of the stack is being drawn: the one face allowed foil while things move

// ----- the HUD: the running count, Done, and the number index -----
document.body.insertAdjacentHTML("beforeend", `
<div class="pack-hud glass" id="pack-hud" role="group" aria-label="Pack" hidden><div class="pk-count"><b id="pk-kept">0 kept</b><span id="pk-left"></span></div><button class="pill-btn" id="pk-done">Done</button></div>
<div class="pack-index" id="pack-index" aria-label="Jump to a number" hidden></div>
<div class="pack-bubble" id="pack-bubble" aria-hidden="true" hidden></div>
<p class="pack-hint" id="pack-hint" aria-hidden="true" hidden>Swipe right to keep, left to pass</p>`);
const hudEl = document.getElementById("pack-hud"), idxEl = document.getElementById("pack-index"), bubbleEl = document.getElementById("pack-bubble"), hintEl = document.getElementById("pack-hint");
const packOpen = () => pack.phase === "open" || pack.phase === "tearing" || pack.phase === "closing";
const groupList = (g) => (g.base || g.cards).filter((c) => !c.owned);
function hud() {
  const n = pack.kept.length;
  document.getElementById("pk-kept").textContent = `${n} kept`;
  document.getElementById("pk-left").textContent = pack.list.length ? `${pack.list.length} left` : "";
}
// The index: up to 14 numbers spread along the edge, evenly over the cards still in the pack.
function buildIndex() {
  const n = pack.list.length, labels = Math.min(14, n);
  idxEl.innerHTML = Array.from({ length: labels }, (_, j) => { const i = Math.round((j / Math.max(1, labels - 1)) * (n - 1)); return `<b>${pack.list[i]?.num ?? ""}</b>`; }).join("");
  const sr = stackRect();
  idxEl.style.left = `${Math.min(vw - 40, sr.x + sr.w + 26)}px`;
  idxEl.style.top = `${sr.y - 10}px`; idxEl.style.height = `${sr.h + 20}px`;
  hintEl.style.top = `${sr.y + sr.h + 16}px`;
}
function scrub(y, show = true) {
  const n = pack.list.length; if (!n) return;
  const r = idxEl.getBoundingClientRect();
  const i = clamp(Math.floor(((y - r.top) / r.height) * n), 0, n - 1);
  if (i !== pack.i) { pack.i = i; pack.promote = 0; pack.settle = null; tick(3); kick(); }
  if (show) { bubbleEl.hidden = false; bubbleEl.textContent = `#${pack.list[i].num}`; bubbleEl.style.top = `${clamp(y, r.top + 16, r.bottom - 16)}px`; bubbleEl.style.left = `${r.left - 10}px`; }
}
idxEl.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); scrub(e.touches[0].clientY); }, { passive: false });
idxEl.addEventListener("touchmove", (e) => { e.preventDefault(); e.stopPropagation(); scrub(e.touches[0].clientY); }, { passive: false });
for (const t of ["touchend", "touchcancel"]) idxEl.addEventListener(t, (e) => { e.stopPropagation(); bubbleEl.hidden = true; });
idxEl.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; idxEl.setPointerCapture(e.pointerId); idxEl.scrubbing = true; scrub(e.clientY); });
idxEl.addEventListener("pointermove", (e) => { if (idxEl.scrubbing) scrub(e.clientY); });
for (const t of ["pointerup", "pointercancel"]) idxEl.addEventListener(t, () => { idxEl.scrubbing = false; bubbleEl.hidden = true; });
document.getElementById("pk-done").onclick = () => closePack();

// ----- geometry -----
const packSize = () => { const w = clamp(vw * 0.42, 140, 190); return { w, h: w * 1.45 }; };
function packRect(pull) { const { w, h } = packSize(); const reveal = Math.min(h * 0.82, pull * 1.3); return { x: (vw - w) / 2, y: topPad() + 4 - h + reveal, w, h }; }
function stackRect() {
  const aw = vw - 46 - 24, cw = Math.min(aw * 0.8, (vh - 260) * TW / TH, 320), ch = cw * TH / TW;
  const top = 128, avail = vh - 90 - top;
  return { x: 12 + (aw - cw) / 2, y: top + Math.max(0, avail - ch) * 0.42, w: cw, h: ch };
}
const camTop = () => -(topPad() + 6) / cam.s;
const canPull = () => view === "set" && state.g && !state.trans && !state.focus && !packOpen();

// ----- the pull: dragging down from the top of the binder (a copy of the base onMove, plus the pull) -----
function onMove(pts) {
  if (!gesture) { if (pts.length) onDown(pts); return; }
  if (gesture.kind === "one" && pts.length >= 2) { if (pack.phase === "pull") { pack.phase = "closed"; pack.pull = 0; } return startTwo(pts); }
  if (gesture.kind === "two") { if (pts.length >= 2) pinchMove(pts[0], pts[1]); return; }
  const p = pts[0]; if (!p) return;
  const g = gesture, now = performance.now();
  const dx = p.x - g.x, dy = p.y - g.y, dt = now - g.t;
  samples.push({ x: p.x, y: p.y, t: now }); if (samples.length > 8) samples.shift();
  if (!g.moved && Math.hypot(dx, dy) < 8) return;
  cancelPress();
  if (view === "mosaic") { g.moved = true; mScroll = clamp(g.my - dy, 0, mMax); kick(); return; }
  if (g.held) {
    if (Math.abs(dx) > Math.abs(dy) && dt < 240) return;
    g.held = false; unfocus();
    g.x = p.x; g.y = p.y; g.cam = { ...cam }; return;
  }
  const framed = cam.s <= fitCam(state.g).s * 1.02;
  if (!g.moved) g.axis = framed && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 2 ? "x" : "free";
  g.moved = true;
  if (g.axis === "x") return;
  const top = camTop(), y = g.cam.y - dy / cam.s;
  // Already at the top and pulling further down: the pack comes out, the binder gives a little under the pull.
  if (y < top && g.cam.y <= top + 2 / cam.s && (pack.phase === "pull" || canPull())) {
    if (pack.phase !== "pull") { pack.phase = "pull"; pack.g = state.g; pack.armed = false; }
    pack.pull = (top - y) * cam.s; pack.drop = pullDrop(pack.pull);
    const armed = pack.pull >= PULL_T;
    if (armed !== pack.armed) { pack.armed = armed; tick(armed ? 12 : 4); }
    cam.y = top - pack.drop / cam.s;
    if (armed && Math.abs(dx) > 56) { gesture = null; pullRelease(false); return; } // a swipe across the pack tears it
    kick(); return;
  }
  if (pack.phase === "pull") { pack.phase = "closed"; pack.pull = 0; }
  cam.y = y;
  if (!framed) cam.x = g.cam.x - dx / cam.s;
  kick();
}
// While the binder is pulled down, its top edge sits lower than usual.
function clampCam(g) {
  if (!g) return;
  const left = -12 / cam.s, right = g.w + 12 / cam.s - vw / cam.s;
  cam.x = right < left ? (left + right) / 2 : clamp(cam.x, left, right);
  const top = camTop() - pack.drop / cam.s, bottom = g.h + (botPad() + 20) / cam.s - vh / cam.s;
  cam.y = bottom < top ? top : clamp(cam.y, top, bottom);
}
function pullRelease(cancelled) {
  if (pack.phase !== "pull") return;
  inertia = false;
  const ok = !cancelled && pack.pull >= PULL_T;
  pack.pull = 0;
  if (ok && !groupList(pack.g).length) { pack.phase = "closed"; toast(`Nothing left to open in ${pack.g.name}.`); kick(); return; }
  if (ok) tearOpen(pack.g, packRect(PULL_T)); else pack.phase = "closed";
  kick();
}
for (const t of ["touchend", "touchcancel"]) canvas.addEventListener(t, (e) => { if (!e.touches.length) pullRelease(t === "touchcancel"); });
for (const t of ["pointerup", "pointercancel"]) canvas.addEventListener(t, (e) => { if (e.pointerType === "mouse") pullRelease(t === "pointercancel"); });

// ----- opening and closing -----
function tearOpen(g, pr) {
  const now = performance.now();
  if (state.focus) unfocus();
  pack.g = g; pack.list = groupList(g); pack.i = 0; pack.kept = []; pack.flights = []; pack.drag = null; pack.settle = null; pack.promote = 0;
  pack.pr = pr; pack.phase = "tearing"; pack.t0 = now; pack.done = 0;
  tick(22);
  document.body.classList.add("packing");
  if (reduced) { pack.phase = "open"; showHud(); }
  kick();
}
function showHud() { hudEl.hidden = false; idxEl.hidden = false; hintEl.hidden = false; hud(); buildIndex(); }
function removeTop(now) {
  pack.list.splice(pack.i, 1);
  if (pack.i >= pack.list.length) pack.i = 0;
  pack.promote = now; pack.settle = null; pack.drag = null;
  hud(); buildIndex();
  if (!pack.list.length) closePack();
}
function keepTop(from, now) {
  const c = pack.list[pack.i]; if (!c) return;
  pack.kept.push(c);
  tick(10);
  if (reduced) land(c); else pack.flights.push({ c, from, t0: now, dur: 480, keep: true });
  // Bring the slot into view behind the stack, so the card has somewhere to land that you can see.
  const r = binderRect(c, cam);
  if (r.y < 110 || r.y + r.h > vh - 60) { const g = pack.g, bottom = g.h + (botPad() + 20) / cam.s - vh / cam.s; flyTo({ ...cam, y: clamp(c.y + TH * c.sz / 2 - vh * 0.6 / cam.s, camTop(), Math.max(camTop(), bottom)) }, 440); }
  removeTop(now);
}
function passTop(from, now) {
  const c = pack.list[pack.i]; if (!c) return;
  tick(4);
  if (!reduced) pack.flights.push({ c, from, t0: now, dur: 300, keep: false });
  removeTop(now);
}
const land = (c) => { if (!c.owned) setOwned(c, true, { quiet: true }); };
function closePack() {
  if (!packOpen() || pack.phase === "closing") return;
  const now = performance.now();
  for (const f of pack.flights) if (f.keep) land(f.c);
  pack.flights = [];
  pack.phase = "closing"; pack.t0 = now; pack.drag = null; pack.settle = null;
  document.body.classList.remove("packing");
  hudEl.hidden = true; idxEl.hidden = true; bubbleEl.hidden = true; hintEl.hidden = true;
  const kept = pack.kept.slice(), g = pack.g;
  if (kept.length) {
    const complete = ownedIn(g.cards) === g.cards.length;
    if (!complete) toast(`${kept.length} card${kept.length === 1 ? "" : "s"} added to ${g.name}.`, () => { for (const c of kept) if (c.owned) setOwned(c, false, { quiet: true }); });
  }
  tick(6);
  if (reduced) pack.phase = "closed";
  kick();
}
// Back closes the pack before it closes the set.
function exitToMosaic() {
  if (packOpen()) { closePack(); return; }
  if (state.trans || view !== "set") return;
  unfocus(); tick(6);
  inertia = false; fly = null;
  const m = state.g.m; if (m.y - mScroll < topPad() || m.y + m.h - mScroll > vh - botPad()) mScroll = clamp(m.y - topPad() - 10, 0, mMax);
  state.trans = openTrans(state.g, 1, cam);
  settle(0, 620);
}

// ----- the stack owns touches while it's open -----
const stackTop = () => { const sr = stackRect(); return { x: sr.x, y: sr.y, w: sr.w, h: sr.h, rot: 0 }; };
function stackDown(id, x, y) {
  const sr = stackRect(), on = x >= sr.x - 10 && x <= sr.x + sr.w + 10 && y >= sr.y - 10 && y <= sr.y + sr.h + 10;
  pack.drag = { id, x0: x, y0: y, dx: 0, dy: 0, on, samples: [{ x, y, t: performance.now() }] };
  pack.settle = null; kick();
}
function stackMove(x, y) {
  const d = pack.drag; if (!d) return;
  d.dx = x - d.x0; d.dy = y - d.y0;
  d.samples.push({ x, y, t: performance.now() }); if (d.samples.length > 8) d.samples.shift();
  const arm = d.on ? (d.dx > 90 ? 1 : d.dx < -90 ? -1 : 0) : 0;
  if (arm !== (d.arm || 0)) { d.arm = arm; if (arm) tick(6); }
  kick();
}
function stackUp(cancelled) {
  const d = pack.drag; if (!d) return;
  const now = performance.now();
  const s0 = d.samples.find((s) => now - s.t < 90) || d.samples[0], last = d.samples[d.samples.length - 1];
  const vx = s0 && last !== s0 ? (last.x - s0.x) / Math.max(1, last.t - s0.t) : 0;
  const from = stackTop(); from.x += d.dx; from.y += d.dy * 0.25; from.rot = clamp(d.dx / vw, -1, 1) * 0.28;
  if (cancelled) { pack.drag = null; kick(); return; }
  if (d.on && (d.dx > 90 || (vx > 0.6 && d.dx > 20))) return keepTop(from, now);
  if (d.on && (d.dx < -90 || (vx < -0.6 && d.dx < -20))) return passTop(from, now);
  if (d.dy > 140 && Math.abs(d.dx) < 80) { pack.drag = null; return closePack(); } // pulling the stack down puts the pack away
  pack.drag = null;
  if (Math.abs(d.dx) > 2 || Math.abs(d.dy) > 2) pack.settle = { dx: d.dx, dy: d.dy * 0.25, t0: now };
  kick();
}
document.addEventListener("touchstart", (e) => {
  if (!packOpen() || e.target !== canvas) return;
  e.stopPropagation(); e.preventDefault();
  if (pack.phase !== "open" || pack.drag || e.touches.length !== 1) return;
  const t = e.touches[0]; stackDown(t.identifier, t.clientX, t.clientY);
}, { capture: true, passive: false });
document.addEventListener("touchmove", (e) => {
  if (!packOpen() || e.target !== canvas) return;
  e.stopPropagation(); e.preventDefault();
  const d = pack.drag; if (!d || d.id === "mouse") return;
  const t = [...e.touches].find((t) => t.identifier === d.id);
  if (t) stackMove(t.clientX, t.clientY);
}, { capture: true, passive: false });
for (const type of ["touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!packOpen() || e.target !== canvas) return;
  e.stopPropagation(); e.preventDefault();
  const d = pack.drag; if (!d || d.id === "mouse") return;
  if (![...e.touches].some((t) => t.identifier === d.id)) stackUp(type === "touchcancel");
}, { capture: true, passive: false });
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !packOpen() || e.target !== canvas) return; e.stopPropagation(); if (pack.phase === "open" && !pack.drag) stackDown("mouse", e.clientX, e.clientY); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || pack.drag?.id !== "mouse") return; e.stopPropagation(); stackMove(e.clientX, e.clientY); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || pack.drag?.id !== "mouse") return; e.stopPropagation(); stackUp(type === "pointercancel"); }, true);
document.addEventListener("wheel", (e) => { if (packOpen() && e.target === canvas) { e.preventDefault(); e.stopPropagation(); } }, { capture: true, passive: false });
// Keyboard: right keeps, left passes, Escape closes the pack.
addEventListener("keydown", (e) => {
  if (!packOpen() || document.activeElement === qIn) return;
  const now = performance.now();
  if (e.key === "ArrowRight") keepTop(stackTop(), now); else if (e.key === "ArrowLeft") passTop(stackTop(), now);
  else if (e.key === "Escape" || e.key === "Backspace") closePack(); else return;
  e.preventDefault(); e.stopPropagation();
}, true);

// ----- drawing -----
// A card you own (a copy of the base cardFace): foil only on the top card of the stack while a pack is out, so the
// binder behind never shimmers under a moving card.
function cardFace(c, sx, sy, w, h, now, value) {
  const st = sets[c.si];
  const col = value ? heat(c.price) : typeColor(c);
  const r = w * 0.045;
  if (w > 90 && !packFoil) { ctx.save(); ctx.shadowColor = "rgb(0 0 0 / .32)"; ctx.shadowBlur = w * 0.09; ctx.shadowOffsetY = w * 0.035; rr(sx, sy, w, h, r); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore(); }
  ctx.save(); rr(sx, sy, w, h, r); ctx.clip();
  const g = ctx.createLinearGradient(sx, sy, sx + w, sy + h);
  g.addColorStop(0, shade(col, 0.2)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.28));
  ctx.fillStyle = g; ctx.fillRect(sx, sy, w, h);
  if (w > 60) { ctx.fillStyle = engraving(); ctx.fillRect(sx, sy, w, h); }
  const quiet = pack.phase === "closed" && !pack.flights.length;
  if (c.tier >= 3 && !reduced && (packFoil || (quiet && !state.trans && !fly && !inertia))) {
    frameFoil = true;
    const phase = ((now * 0.00005 + (sx + cam.x * cam.s * 0.25) * 0.0011) % 1 + 1) % 1;
    const fx = sx - w + phase * w * 3;
    const fg = ctx.createLinearGradient(fx, sy, fx + w * 0.9, sy + h);
    fg.addColorStop(0, "rgb(255 255 255 / 0)"); fg.addColorStop(0.38, "rgb(150 220 255 / .28)"); fg.addColorStop(0.5, "rgb(255 226 160 / .42)"); fg.addColorStop(0.62, "rgb(160 245 205 / .28)"); fg.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = fg; ctx.fillRect(sx, sy, w, h); ctx.globalCompositeOperation = "source-over";
  }
  const lh = h * 0.24, ly = sy + h - lh;
  ctx.fillStyle = theme.paper; ctx.fillRect(sx, ly, w, lh);
  ctx.fillStyle = "rgb(0 0 0 / .14)"; ctx.fillRect(sx, ly, w, Math.max(1, w * 0.006));
  ctx.restore();
  if (c.tier >= 5) { rr(sx + w * 0.03, sy + w * 0.03, w * 0.94, h - lh - w * 0.04, r * 0.7); ctx.lineWidth = Math.max(1, w * 0.012); ctx.strokeStyle = "rgb(240 200 110 / .85)"; ctx.stroke(); }
  if (w < 40) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["paper-ink"];
  font(800, w * 0.092, true); ctx.fillText(fitText(c.name, w * 0.84), sx + pad, ly + lh * 0.46);
  font(500, w * 0.064); ctx.globalAlpha *= 0.7;
  ctx.fillText(`${st.code} ${c.num}/${st.printed}`, sx + pad, ly + lh * 0.82);
  ctx.textAlign = "right"; ctx.fillText(GLYPH[c.tier], sx + w - pad, ly + lh * 0.82);
  ctx.globalAlpha /= 0.7;
  if (value || w > 110) { ctx.textAlign = "right"; ctx.fillStyle = "rgb(255 255 255 / .92)"; font(700, w * 0.078); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
}
// A card in the stack: the card itself, the way it'll look in the binder once you keep it. The ones behind are
// drawn plain (no shadow or engraving) so the stack stays cheap.
function stackFace(c, x, y, w, h, now, top) {
  if (top) {
    // A blurred shadow is the costliest thing on a software canvas, so the top card wears a layered one instead.
    const a = ctx.globalAlpha;
    for (let i = 4; i >= 1; i--) { ctx.globalAlpha = a * 0.05; rr(x - i * 2, y + i * 2.5, w + i * 4, h + i * 4, w * 0.045 + i * 2); ctx.fillStyle = "#000"; ctx.fill(); }
    ctx.globalAlpha = a;
    packFoil = true; cardFace(c, x, y, w, h, now, false); packFoil = false; return;
  }
  const col = typeColor(c), r = w * 0.045;
  ctx.save(); rr(x, y, w, h, r); ctx.clip();
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = shade(col, 0.2); ctx.fillRect(x, y, w, h * 0.5);
  ctx.fillStyle = theme.paper; ctx.fillRect(x, y + h * 0.76, w, h * 0.24);
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgb(0 0 0 / .25)"; rr(x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
}
// The sealed pack: the set's colour, crimped top and bottom, its name and how many cards are inside.
function drawPack(g, R, now, alpha, tear) {
  const { x, y, w, h } = R, ink = g.ink, r = w * 0.05, crimp = w * 0.09;
  const n = groupList(g).length;
  ctx.save(); ctx.globalAlpha = alpha;
  const bodyY = y + crimp * (tear > 0 ? 1 : 0);
  if (!reduced) { ctx.shadowColor = "rgb(0 0 0 / .35)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; }
  rr(x, y, w, h, r); ctx.fillStyle = shade(ink, -0.35); ctx.fill();
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.save(); rr(x, y, w, h, r); ctx.clip();
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, shade(ink, 0.22)); grad.addColorStop(0.5, ink); grad.addColorStop(1, shade(ink, -0.32));
  ctx.fillStyle = grad; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = engraving(); ctx.fillRect(x, y, w, h);
  // A sheen across the foil wrapper.
  const sh = ctx.createLinearGradient(x, y + h, x + w, y);
  sh.addColorStop(0.3, "rgb(255 255 255 / 0)"); sh.addColorStop(0.5, "rgb(255 255 255 / .22)"); sh.addColorStop(0.7, "rgb(255 255 255 / 0)");
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h);
  // Crimps: a serrated band top and bottom.
  const serr = (yy, dir) => {
    ctx.beginPath(); ctx.moveTo(x, yy);
    for (let i = 0; i <= 10; i++) ctx.lineTo(x + (w * i) / 10, yy + (i % 2 ? dir * crimp * 0.45 : 0));
    ctx.lineTo(x + w, yy - dir * crimp); ctx.lineTo(x, yy - dir * crimp); ctx.closePath();
    ctx.fillStyle = "rgb(255 255 255 / .18)"; ctx.fill();
    ctx.strokeStyle = "rgb(0 0 0 / .2)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x, yy - dir * crimp * i * 0.3); ctx.lineTo(x + w, yy - dir * crimp * i * 0.3); ctx.stroke(); }
  };
  if (tear <= 0) serr(y + crimp, 1);
  serr(y + h - crimp, -1);
  // The tear line, under the top crimp.
  ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgb(255 255 255 / .45)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, bodyY + crimp * 1.3); ctx.lineTo(x + w, bodyY + crimp * 1.3); ctx.stroke(); ctx.setLineDash([]);
  // What's inside.
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const ey = y + h * 0.42;
  ctx.beginPath(); ctx.arc(x + w / 2, ey, w * 0.22, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = "rgb(255 255 255 / .55)"; ctx.stroke();
  ctx.fillStyle = "#fff"; font(800, w * 0.2); ctx.fillText(String(n), x + w / 2, ey + w * 0.07);
  ctx.fillStyle = "rgb(255 255 255 / .8)"; font(600, w * 0.065); ctx.fillText(n ? "to find" : "complete", x + w / 2, ey + w * 0.22 + w * 0.06);
  ctx.fillStyle = "rgb(255 255 255 / .7)"; font(700, w * 0.06); ctx.fillText("BOOSTER", x + w / 2, y + h * 0.74);
  ctx.fillStyle = "#fff"; font(800, w * 0.13, true); ctx.fillText(fitText(g.name, w - 20), x + w / 2, y + h * 0.74 + w * 0.14);
  ctx.restore();
  // The torn-off top: it shears away up and to the right.
  if (tear > 0 && tear < 1) {
    ctx.save(); ctx.globalAlpha = alpha * (1 - tear);
    ctx.translate(x + w / 2 + tear * w * 0.9, y + crimp - tear * h * 0.5); ctx.rotate(tear * 0.5);
    rr(-w / 2, -crimp, w, crimp * 1.4, r); ctx.fillStyle = shade(ink, 0.1); ctx.fill();
    ctx.fillStyle = "rgb(255 255 255 / .18)"; ctx.fillRect(-w / 2, -crimp, w, crimp * 0.8);
    ctx.restore();
  }
  ctx.restore();
}
function drawTag(x, y, w, h, keep, a) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  const tw = w * 0.36, th = w * 0.14, tx = keep ? x + w * 0.07 : x + w - w * 0.07 - tw, ty = y + w * 0.07;
  ctx.translate(tx + tw / 2, ty + th / 2); ctx.rotate(keep ? -0.18 : 0.18);
  rr(-tw / 2, -th / 2, tw, th, th * 0.2); ctx.lineWidth = 3; ctx.strokeStyle = keep ? "#2ECC80" : "#F0F2F6"; ctx.stroke();
  ctx.fillStyle = keep ? "#2ECC80" : "#F0F2F6"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; font(800, th * 0.62, true);
  ctx.fillText(keep ? "KEEP" : "PASS", 0, 1);
  ctx.restore();
}
// Where the card at a given depth in the stack sits: the top one in place, the ones behind peeking up from behind it.
function levelRect(sr, level) { const k = Math.pow(0.955, level); const w = sr.w * k, h = sr.h * k; return { x: sr.x + (sr.w - w) / 2, y: sr.y - level * 16 + (sr.h - h) * 0.1, w, h }; }

function drawStack(now, openness) {
  const sr = stackRect();
  let shift = 0, busy = false;
  if (pack.promote && !reduced) { const p = clamp((now - pack.promote) / 220, 0, 1); shift = 1 - ease(p); if (p < 1) busy = true; else pack.promote = 0; }
  // Dealing out of the pack: each of the first few cards flies from inside the pack to its place in the stack.
  const dealP = pack.phase === "tearing" ? clamp((now - pack.t0 - 180) / 420, 0, 1) : 1;
  const pr = pack.pr;
  const n = Math.min(4, pack.list.length - pack.i);
  for (let k = n - 1; k >= 0; k--) {
    const c = pack.list[pack.i + k]; if (!c) continue;
    // Just after a card leaves, every card is still one level deeper and rises into place.
    let R = levelRect(sr, k + shift);
    if (dealP < 1 && pr) {
      const d = ease(clamp((dealP * 1.3 - k * 0.1), 0, 1)), from = { x: pr.x + pr.w * 0.1, y: pr.y + pr.h * 0.18, w: pr.w * 0.8, h: pr.w * 0.8 * TH / TW };
      R = { x: from.x + (R.x - from.x) * d, y: from.y + (R.y - from.y) * d, w: from.w + (R.w - from.w) * d, h: from.h + (R.h - from.h) * d };
      busy = true;
    }
    ctx.globalAlpha = openness * (k === 0 ? 1 : 1 - k * 0.12);
    if (k === 0 && dealP >= 1) {
      let ox = 0, oy = 0, rot = 0, tag = 0;
      const d = pack.drag;
      if (d?.on) { ox = d.dx; oy = d.dy * 0.25; rot = clamp(d.dx / vw, -1, 1) * 0.28; tag = clamp(d.dx / 90, -1, 1); }
      else if (pack.settle && !reduced) { const p = clamp((now - pack.settle.t0) / 260, 0, 1), e = 1 - Math.pow(1 - p, 3); ox = pack.settle.dx * (1 - e); oy = pack.settle.dy * (1 - e); rot = clamp(ox / vw, -1, 1) * 0.28; if (p >= 1) pack.settle = null; else busy = true; }
      ctx.save(); ctx.translate(R.x + R.w / 2 + ox, R.y + R.h / 2 + oy); ctx.rotate(rot);
      stackFace(c, -R.w / 2, -R.h / 2, R.w, R.h, now, true);
      drawTag(-R.w / 2, -R.h / 2, R.w, R.h, tag > 0, Math.abs(tag));
      ctx.restore();
    } else stackFace(c, R.x, R.y, R.w, R.h, now, false);
  }
  ctx.globalAlpha = 1;
  return busy;
}
function drawFlights(now) {
  let busy = false;
  for (const f of pack.flights) {
    const p = clamp((now - f.t0) / f.dur, 0, 1), e = f.keep ? ease(p) : 1 - Math.pow(1 - p, 2);
    const A = f.from;
    let R, rot, a = 1;
    if (f.keep) { const B = binderRect(f.c, cam); R = { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e, w: A.w + (B.w - A.w) * e, h: A.h + (B.h - A.h) * e }; rot = A.rot * (1 - e); a = 1; }
    else { R = { x: A.x - vw * 1.1 * e, y: A.y + 40 * e, w: A.w, h: A.h }; rot = A.rot - 0.5 * e; a = 1 - e * 0.6; }
    ctx.save(); ctx.globalAlpha = a; ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.rotate(rot);
    stackFace(f.c, -R.w / 2, -R.h / 2, R.w, R.h, now, f.keep && R.w > 60);
    ctx.restore();
    if (p >= 1) { f.done = true; if (f.keep) land(f.c); } else busy = true;
  }
  pack.flights = pack.flights.filter((f) => !f.done);
  ctx.globalAlpha = 1;
  return busy;
}
let packLast = 0;
function packFrame(now) {
  const dt = Math.min(48, now - (packLast || now)); packLast = now;
  if (document.body.classList.contains("listmode")) return;
  // A one-time hint the first time a set is open.
  if (!pack.hinted && view === "set" && !state.trans && pack.phase === "closed") { pack.hinted = true; try { localStorage.setItem("wall-pack-hint", "1"); } catch { /* fine */ } if (groupList(state.g).length) toast("Pull down for a pack of what you're missing"); }
  // Anything that leaves the set behind the pack closes it.
  if (packOpen() && pack.phase !== "closing" && (view !== "set" || state.g !== pack.g || state.trans || state.focus)) closePack();
  let busy = false;
  // The binder springs back up once the pull lets go.
  if (pack.phase !== "pull" && pack.drop > 0) { pack.drop = reduced ? 0 : pack.drop * Math.pow(0.82, dt / 16); if (pack.drop < 0.5) pack.drop = 0; clampCam(state.g); busy = true; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (pack.phase === "pull") {
    const R = packRect(pack.pull), armed = pack.pull >= PULL_T;
    drawPack(pack.g, R, now, 1, 0);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.ink; font(700, 13);
    ctx.fillText(armed ? "Let go to open" : groupList(pack.g).length ? "Keep pulling" : "Nothing left to open", vw / 2, R.y + R.h + 22);
  } else if (packOpen()) {
    const t = now - pack.t0;
    let openness = 1;
    if (pack.phase === "tearing") { const p = clamp(t / 600, 0, 1); openness = reduced ? 1 : clamp(t / 400, 0, 1); if (p >= 1 || reduced) { pack.phase = "open"; showHud(); } busy = true; }
    if (pack.phase === "closing") { const p = reduced ? 1 : clamp(t / 320, 0, 1); openness = 1 - p; if (p >= 1) { pack.phase = "closed"; pack.g = null; pack.list = []; } else busy = true; }
    ctx.globalAlpha = 0.6 * openness; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
    if (pack.phase === "tearing" && pack.pr) {
      const p = clamp(t / 600, 0, 1), tear = clamp(p / 0.4, 0, 1), fall = clamp((p - 0.35) / 0.65, 0, 1);
      const R = { ...pack.pr }; R.y += fall * fall * vh * 0.8;
      drawPack(pack.g, R, now, 1 - fall * 0.6, tear);
    }
    if (pack.phase !== "closed") {
      if (pack.phase === "closing") { ctx.save(); ctx.translate(0, (1 - openness) * (1 - openness) * vh * 0.6); }
      if (drawStack(now, openness)) busy = true;
      if (pack.phase === "closing") ctx.restore();
    }
  }
  if (pack.flights.length) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (drawFlights(now)) busy = true; }
  idxEl.classList.toggle("under", Boolean(pack.drag?.on && Math.abs(pack.drag.dx) > 6) || pack.flights.some((f) => f.keep));
  if (pack.drag) busy = true;
  if (busy) kick();
}
function kick() {
  if (raf) return;
  raf = requestAnimationFrame(frameWithPack);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; frameWithPack(performance.now()); } }, 120);
}
function frameWithPack(now) { frame(now); packFrame(now); }

// ----- the list: an Open a pack button per set, which goes to the wall and opens it -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "deals" ? !c.owned && c.deal : true);
  listEl.querySelector("#list-body").innerHTML = groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const left = groupList(g).length;
    return `<section><div class="lhead"><h2>${g.name}</h2>${left ? `<button class="pill-btn lpack" data-pack="${g.gi}">Open a pack</button>` : ""}</div><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? "Have it" : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pack]"); if (!b) return;
  const g = groups[Number(b.dataset.pack)]; if (!g) return;
  setListMode(false);
  const open = () => { const { w, h } = packSize(); tearOpen(g, { x: (vw - w) / 2, y: topPad() + 12, w, h }); };
  if (view === "set" && state.g === g) { open(); return; }
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  enterGroup(g, { then: open });
});
