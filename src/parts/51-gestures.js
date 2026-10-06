// ---------- gestures ----------
// Fingers come from Touch Events: the browser's own list of touches is read on every event, so a dropped event can
// never leave a ghost finger behind (which made scrolling hit or miss). The mouse uses pointer events.
let gesture = null, vel = { x: 0, y: 0 }, samples = [], inertia = false, firstTouch = false;
function stepInertia(dt) {
  let moving = false;
  if (shuffle) { if (performance.now() >= shuffle.end) shuffle = null; else moving = true; }
  if (!inertia || state.trans) return moving;
  if (view === "mosaic") {
    mScroll = clamp(mScroll - vel.y * dt, 0, mMax);
    vel.y *= Math.pow(0.95, dt / 16);
    if (Math.abs(vel.y) < 0.02 || mScroll <= 0 || mScroll >= mMax) inertia = false;
    return true;
  }
  cam.x -= vel.x * dt / cam.s; cam.y -= vel.y * dt / cam.s;
  const k = Math.pow(0.94, dt / 16);
  vel.x *= k; vel.y *= k;
  if (Math.hypot(vel.x, vel.y) < 0.02) inertia = false;
  return true;
}
function hit(sx, sy, nearest = false) {
  if (state.trans) return null;
  if (view === "mosaic") {
    if (room.on && room.closing) return null;
    if (room.on && room.anim) finishRoomAnim();
    const y = sy + mScroll;
    if (room.on) {
      for (const it of room.L?.hits || []) if (inR(it, sx, y)) return { block: it.blk }; // a medal, a filter, a fold line
      for (const g of room.plaques) {
        if (g.fanR && inR(g.fanR, sx, y)) return { block: g.fanBtn };
        if (g === room.fan) for (const r of fanRows(g)) if (inR(r.m, sx, y)) return { block: r };
        if (inR(g.m, sx, y)) return { block: g };
      }
      if (!nearest) return null;
      let best = null, bd = Infinity;
      for (const g of room.plaques) { const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
      return best && bd < 60 ? { block: best } : null;
    }
    if (COVER.m && inR(COVER.m, sx, y)) return { block: COVER }; // the trade binder, at the top of the Trade lens
    if (inR(DOOR.m, sx, y)) return { block: DOOR };
    for (const g of groups) if (g.m && !inCase(g) && inR(g.m, sx, y)) return { block: g };
    if (!nearest) return null;
    let best = null, bd = Infinity;
    for (const g of groups) { if (!g.m || inCase(g)) continue; const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
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
function cancelPress() { if (state.press) { clearTimeout(state.press.timer); state.press = null; kick(); } }
function toggleWithUndo(c) { const was = c.owned; setOwned(c, !was, { undo: () => setOwned(c, was, { quiet: true }) }); }
function hideCaption() { if (!firstTouch) { firstTouch = true; document.getElementById("caption").classList.add("gone"); } }
// A new touch never waits for an animation: whatever is playing jumps to its end and the touch takes over.
function finishTransition() {
  const T = state.trans; if (!T || !(T.anim || T.t0)) return;
  if (T.kind === "open" && T.anim) T.q = T.anim.to;
  state.trans = null; T.done?.(T);
}
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
function startTwo(pts) {
  cancelPress(); finishTransition();
  const [a, b] = pts, m = mid(a, b);
  gesture = { kind: "two", d0: dist(a, b), m0: m, cam: { ...cam }, qs: [], m, r: 1 };
  // A pinch from a card up close lands on the set, never past it: closing the set takes a second pinch.
  // From a card, the set is already on its way: the pinch itself does nothing more.
  if (state.focus && view === "set" && state.g) { unfocus(); gesture.noClose = true; gesture.snap = true; flyTo(fitCam(state.g), 380); return; }
  if (view === "set" && state.g && cam.s > fitCam(state.g).s * 1.6) { fly = null; gesture.noClose = true; }
  // Spreading on (or near) a panel starts opening it, under your fingers.
  if (view === "mosaic") { const h = hit(m.x, m.y, true); if (h?.block) gesture.g = h.block; }
}
let evT = 0; // when the current input event happened (its own timestamp, not when we got round to it)
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
  // At the framed size a clearly sideways drag is the slide between sets; anything else scrolls the binder.
  const framed = cam.s <= fitCam(state.g).s * 1.02;
  if (!g.moved) g.axis = framed && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 2 ? "x" : "free";
  g.moved = true;
  if (g.axis === "x") return;
  cam.y = g.cam.y - dy / cam.s;
  if (!framed) cam.x = g.cam.x - dx / cam.s;
  kick();
}
function pinchMove(a, b) {
  const g = gesture, d = dist(a, b), m = mid(a, b), r = d / g.d0, now = evT || performance.now();
  if (g.snap) return;
  if (view === "mosaic") {
    if (room.on) {
      if (room.pinch || (r < 1 && !state.trans)) {
        if (!room.pinch) { room.pinch = { q0: room.q, qs: [] }; room.anim = null; }
        room.q = clamp(room.pinch.q0 - (1 - r) / 0.55, 0, 1); room.pinch.qs.push({ q: room.q, t: now }); kick(); return;
      }
      if (!g.g?.done) return;
    } else if (g.g?.door) { if (r > 1.12) { g.snap = true; openRoom(); } return; }
    else if (g.g?.tbCover) { if (r > 1.12) { g.snap = true; openBinder(); } return; }
    else if (g.g && (g.g.fan || g.g.pick)) return;
    if (!g.g) return;
    const q = clamp((r - 1) / 1.1, 0, 1);
    if (!state.trans && q > 0.01) state.trans = openTrans(g.g, 0, fitCam(g.g));
    if (state.trans?.kind === "open" && !state.trans.anim) { state.trans.q = q; g.qs.push({ q, t: now }); kick(); }
    return;
  }
  if (state.trans && state.trans.kind !== "open") return;
  const f = fitCam(state.g), s = g.cam.s * r;
  g.m = m; g.r = r;
  if (s < f.s * 0.995) {
    if (g.noClose) { Object.assign(cam, f); kick(); return; }
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
// Letting go of a pinch: a quick spread opens and a quick pinch closes, whatever the distance; a slow release goes
// to whichever end is nearer (a little more than halfway is needed to close a set, so a small pinch never does).
function releasePinch() {
  const g = gesture, T = state.trans;
  if (g.snap) return;
  if (room.pinch) {
    const qs = room.pinch.qs, last = qs[qs.length - 1]; room.pinch = null;
    let first = qs.find((s) => last && last.t - s.t < 160);
    if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
    const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
    const to = Math.abs(v) > 0.0011 ? (v > 0 ? 1 : 0) : room.q > 0.5 ? 1 : 0;
    if (to === 0) closeRoom(); else { room.anim = { from: room.q, to: 1, t0: performance.now(), dur: 160 + 300 * (1 - room.q) }; kick(); }
    return;
  }
  if (T?.kind === "open" && !T.anim) {
    const qs = g.qs, last = qs[qs.length - 1];
    let first = qs.find((s) => last && last.t - s.t < 160);
    if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
    const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
    let to;
    if (Math.abs(v) > 0.0011) to = v > 0 ? 1 : 0;
    else to = T.q > (view === "mosaic" ? 0.35 : 0.65) ? 1 : 0;
    settle(to);
  } else if (view === "set" && state.g && cam.s < fitCam(state.g).s) flyTo(fitCam(state.g), 260);
  else if (view === "set" && state.g && !g.noClose && g.r > 1.15 && g.m && cam.s > fitCam(state.g).s * 1.8) {
    const h = hit(g.m.x, g.m.y);
    let c = h?.card || null;
    if (!c) { let bd = Infinity; for (const x of state.g.cards) { const r = binderRect(x, cam), d = Math.hypot(r.x + r.w / 2 - g.m.x, r.y + r.h / 2 - g.m.y); if (d < bd) { bd = d; c = x; } } }
    if (c) focus(c);
  }
}
function onUp(remaining, end, cancelled = false) {
  const g = gesture; if (!g) return;
  if (cancelled && g.kind === "one" && !remaining.length) { gesture = null; cancelPress(); return; } // the system took the touch: no tap
  cancelPress();
  if (g.kind === "two") {
    if (remaining.length >= 2) return;
    releasePinch();
    // A finger still down after a pinch just rests; it doesn't scroll or tap.
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
const touchPts = (list) => [...list].map((t) => ({ x: t.clientX, y: t.clientY }));
for (const [type, fn] of [["touchstart", (e) => onDown(touchPts(e.touches))], ["touchmove", (e) => onMove(touchPts(e.touches))],
  ["touchend", (e) => onUp(touchPts(e.touches), touchPts(e.changedTouches)[0])], ["touchcancel", (e) => onUp(touchPts(e.touches), touchPts(e.changedTouches)[0], true)]]) {
  canvas.addEventListener(type, (e) => { e.preventDefault(); evT = e.timeStamp; fn(e); }, { passive: false });
}
let mouseDown = false;
canvas.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; mouseDown = true; canvas.setPointerCapture(e.pointerId); onDown([{ x: e.clientX, y: e.clientY }]); });
canvas.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !mouseDown) return; onMove([{ x: e.clientX, y: e.clientY }]); });
const mouseUp = (e) => { if (e.pointerType !== "mouse" || !mouseDown) return; mouseDown = false; onUp([], { x: e.clientX, y: e.clientY }); };
canvas.addEventListener("pointerup", mouseUp);
canvas.addEventListener("pointercancel", mouseUp);
canvas.addEventListener("wheel", (e) => {
  e.preventDefault(); hideCaption();
  if (state.trans) finishTransition();
  if (view === "mosaic") {
    if (e.ctrlKey && e.deltaY < -2) { const h = hit(e.clientX, e.clientY, true); if (h?.block) enterGroup(h.block); return; }
    mScroll = clamp(mScroll + e.deltaY, 0, mMax); kick(); return;
  }
  fly = null; inertia = false;
  if (state.focus) unfocus();
  if (e.ctrlKey || e.metaKey) {
    const f = fitCam(state.g).s, s = clamp(cam.s * Math.exp(-e.deltaY * 0.012), f * 0.6, maxS());
    if (s < f * 0.8) return exitToMosaic();
    const w = toWorld(e.clientX, e.clientY); cam.s = Math.max(s, f); cam.x = w.x - e.clientX / cam.s; cam.y = w.y - e.clientY / cam.s;
  } else { cam.y += e.deltaY / cam.s; cam.x += (e.shiftKey ? e.deltaY : e.deltaX) / cam.s; }
  kick();
}, { passive: false });

// A tap means the next level in: a panel opens its set; a card you can read comes up close; a small card brings you closer.
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block); // which sets do you collect?
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch); // a trader: how to trade, then the table
    if (h?.block && lifted && !h.block.done) { // a plaque is sealed: a tap opens the album, never a tile in its engraving
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") { // a spare: the table with whoever wants it
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m)); // a chased card: every offer online
    }
    if (h?.block) enterGroup(h.block);
    else if (newPanelAt(sx, sy)) { tick(4); openSheet(); }
    return;
  }
  if (!h?.card) {
    if (!state.focus && !marking) { const t = pinHit(sx, sy); if (t) return openMedal(t.id); } // the next medal on the bar
    if (h?.block && !marking && !fly && !shuffle) { const p = headAt(h.block, sx, sy); if (p) { tick(4); if (p.seg) setScope(h.block.set, p.seg); else if (p.btn) { if (p.btn.shelf) toggleShelf(h.block); else if (p.btn.away) putAway(h.block); else if (p.btn.pop) chasePopular(h.block.set); else if (p.btn.remove) removeSet(h.block.set); else removeChase(h.block.chase); } else focus(p.c); } }
    return;
  }
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned); // in mark mode a tap toggles the card
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}
