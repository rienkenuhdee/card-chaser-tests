// ---------- the import's reveal: the wall gives you a tour of itself (round 20, bold) ----------
// The familiar part stays: the imported cards flood into the wall set by set. The new part comes when the flood
// settles. The camera takes over for a few composed stops, like a photo app's memories gliding between moments, with
// one plain caption at the bottom where the lens bar was:
//   1. the whole wall, from the top ("541 cards, worth $13,420.37")
//   2. the set closest to done, opened, its missing pockets lit ("Fossil: 5 to go")
//   3. the Trade lens with its binder's cover in a spotlight, the first page lifting ("75 spares, 27 wanted")
//   4. the Complete Dex, if it is on the wall
//   5. the trophy room's door at the end of the wall, its rarest medals in a row ("30 trophies")
//   6. home: the top of the wall in Have, with the one summary line
// Every stop is a view the wall already has (the mosaic scrolled, a set framed and scrolled, a lens, the door): the
// camera only moves the way a tap, a lens or a scroll would move it. Each stop holds about two seconds. A tap on the
// caption goes there for real (stays in the set, opens the binder, the room, the Dex); a touch anywhere else, a key or
// the wheel ends the tour on the spot, the wall exactly where it is, and the touch carries on as it would have. Skip is
// always there. The tour replaces the import's toast and its trophy card: one summary line says it all at the end
// (or as a toast, when the tour is cut short). Reduced motion cuts between the stops instead of gliding.

const TOUR_HOLD = 2300, TOUR_LAST = 3400;
const tour = { wait: false, on: false, imp: null, token: 0, stops: [], i: -1, medals: [], lit: null, glide: null, said: false, timer: 0 };

// ----- the caption: a glass bar where the lens bar sits, a segment per stop along its top -----
const tourEl = document.createElement("div");
tourEl.className = "tour glass blank"; tourEl.id = "tour";
tourEl.innerHTML = `<div class="tr-segs" aria-hidden="true"></div><button type="button" class="tr-go" id="tour-go"><span class="tr-text" aria-live="polite"><b class="tr-big"></b><span class="tr-small"></span></span><span class="tr-act" aria-hidden="true"></span></button><button type="button" class="tr-skip" id="tour-skip">Skip</button>`;
document.body.append(tourEl);
const tourSegs = tourEl.querySelector(".tr-segs"), tourBig = tourEl.querySelector(".tr-big"), tourSmall = tourEl.querySelector(".tr-small"), tourAct = tourEl.querySelector(".tr-act"), tourGo = tourEl.querySelector("#tour-go");

// ----- the numbers the captions read -----
const tourN = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
function tourFacts() {
  const own = cards.filter((c) => c.owned), worth = own.reduce((a, c) => a + c.price, 0);
  const sp = cards.filter(isSpare), spares = sp.reduce((a, c) => a + sparesOf(c), 0), wanted = sp.filter((c) => wantedBy(c).length).length;
  return { n: tour.imp?.n ?? own.length, worth, spares, wanted, trophies: medalCount(), chase: tour.imp?.chaseAll ? tour.imp.k : 0 };
}
function tourSummary(f = tourFacts(), imported = false) {
  const bits = [`${tourN(f.n, "card")}${imported ? " imported" : ""}`];
  if (f.spares) bits.push(tourN(f.spares, "spare"));
  if (f.trophies) bits.push(tourN(f.trophies, "trophy", "trophies"));
  if (f.chase) bits.push(`${f.chase.toLocaleString()} to chase`);
  return bits;
}
const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// ----- the stops -----
// Where a rectangle of the mosaic sits best on screen: centred between the top strip and the caption, or its top
// near the top if it is taller than that.
function tourFrame(r) {
  const top = topPad() + 8, bot = vh - botPad() - 8;
  return clamp(r.h > bot - top ? r.y - top : r.y + r.h / 2 - (top + bot) / 2, 0, mMax);
}
function tourLens(l) {
  if (state.lens === l) return;
  setLens(l);
  toastEl.classList.remove("show"); clearTimeout(toast.t); // the lens's own toast: the caption says it instead
}
const tourOut = () => { if (state.focus) unfocus(); if (view === "set") exitToMosaic(); };
// The set closest to done: the fewest cards to go, among the sets you have started and not finished.
function tourNearest() {
  let best = null;
  for (const g of groups) {
    if (!g.set || g.done || !g.base?.length || !g.m) continue;
    const have = ownedIn(g.base), left = g.base.length - have;
    if (!have || !left) continue;
    if (!best || left < best.left || (left === best.left && have / g.base.length > best.have / best.g.base.length)) best = { g, left, have };
  }
  return best;
}
// Inside the set: frame its missing pockets (the binder scrolled, at the framed size).
function tourMissingCam(g) {
  const f = fitCam(g), miss = g.cards.filter((c) => !c.owned && !c.ph);
  if (!miss.length) return f;
  const s = f.s, y0 = Math.min(...miss.map((c) => c.y)), y1 = Math.max(...miss.map((c) => c.y + TH * c.sz));
  const top = topPad() + 8, bot = vh - botPad() - 8;
  let y = (y1 - y0) * s > bot - top ? y0 - (top + 24) / s : (y0 + y1) / 2 - (top + bot) / 2 / s;
  const lo = -(topPad() + 6) / s, hi = g.h + (botPad() + 20) / s - vh / s;
  y = hi < lo ? lo : clamp(y, lo, hi);
  return { s, x: f.x, y };
}
function tourStops() {
  const f = tourFacts(), stops = [];
  stops.push({
    go: [tourOut, () => tourLens("have"), () => tourGlide(0)],
    big: `${tourN(f.n, "card")}, worth ${money(f.worth)}`, small: "Your collection, set by set.",
  });
  const near = tourNearest();
  if (near) {
    const g = near.g, miss = g.base.filter((c) => !c.owned);
    stops.push({
      go: [() => tourGlide(tourFrame(g.m)), () => enterGroup(g), () => flyTo(tourMissingCam(g), 760)],
      big: `${g.name}: ${near.left} to go`,
      small: miss.length <= 3 ? `Missing ${andList(miss.map((c) => c.name))}.` : `${near.have} of ${g.base.length}. The gaps are lit.`,
      act: "Stay here", run: () => {},
      lit: () => ({ kind: "missing", g, cards: g.cards.filter((c) => !c.owned && !c.ph) }),
    });
  }
  if (f.spares && tbList().length) {
    stops.push({
      go: [tourOut, () => tourGlide(0), () => tourLens("trade"), () => tourGlide(0)],
      big: `${tourN(f.spares, "spare")}, ${f.wanted.toLocaleString()} wanted`, small: `In your trade binder, on ${tourN(tbPageCount(), "page")}.`,
      act: "Open", run: () => tbOpenFromAnywhere(),
      lit: () => ({ kind: "cover", rect: () => COVER.m }),
    });
  }
  const dex = groups.find((g) => g.natdex && g.m && !g.done);
  if (dex) {
    const have = ownedIn(dex.base);
    stops.push({
      go: [tourOut, () => tourLens("have"), () => tourGlide(tourFrame(dex.m))],
      big: `${dex.name}: ${have.toLocaleString()} of ${dex.base.length.toLocaleString()}`, small: "One pocket for every Pokémon.",
      act: "Open", run: () => tourWhenStill(() => { if (view === "mosaic" && !room.on && !bnd.on) enterGroup(dex); }),
      lit: () => ({ kind: "panel", rect: () => dex.m }),
    });
  }
  if (f.trophies) {
    const E = medalList().earned, top = E.slice(0, 2).map((t) => t.name), lucky = E.filter((t) => t.rank === "shiny").length;
    stops.push({
      go: [tourOut, () => tourLens("have"), () => { layoutAll(); if (trophyCase) tourGlide(tourFrame(trophyCase)); }],
      big: `${tourN(f.trophies, "trophy", "trophies")}${lucky ? `, ${lucky} shiny` : ""}`,
      small: `${top.join(", ")}${E.length > 2 ? ` and ${E.length - 2} more` : ""}.`,
      act: "Open", run: () => tourWhenStill(() => { if (view === "set") { exitToMosaic(); tourWhenStill(() => openRoom()); } else openRoom(); }),
      lit: () => ({ kind: "panel", rect: () => trophyCase, door: true }),
    });
  }
  stops.push({
    go: [tourOut, () => tourLens("have"), () => tourGlide(0)],
    big: tourSummary(f).join(" · "), small: "Your wall. Tap a set to open it.", hold: TOUR_LAST, last: true,
  });
  return stops;
}

// ----- running it -----
const tourBusy = () => Boolean(state.trans || fly || tour.glide || shuffle || room.anim || bnd.anim);
// After whatever is moving has landed (never inside the tour's own token: used by the caption's actions too).
function tourWhenStill(fn, tries = 0) { if (tourBusy() && tries < 80) { setTimeout(() => tourWhenStill(fn, tries + 1), 50); return; } fn(); }
function tourRun(steps, done) {
  const tk = tour.token;
  const next = (k) => {
    if (tk !== tour.token) return;
    if (k >= steps.length) { done(); return; }
    steps[k]();
    const wait = () => { if (tk !== tour.token) return; if (tourBusy()) { setTimeout(wait, 40); return; } next(k + 1); };
    wait();
  };
  next(0);
}
// The scroll glide between stops: the mosaic's own scroll, eased (a cut when motion is reduced).
function tourGlide(to) {
  to = clamp(to, 0, mMax);
  if (Math.abs(to - mScroll) < 2 || reduced) { mScroll = to; kick(); return; }
  tour.glide = { a: mScroll, b: to, t0: performance.now(), dur: clamp(Math.abs(to - mScroll) * 1.1, 480, 1100) };
  requestAnimationFrame(tourGlideStep);
}
function tourGlideStep() {
  const G = tour.glide; if (!G) return;
  const p = clamp((performance.now() - G.t0) / G.dur, 0, 1);
  mScroll = G.a + (G.b - G.a) * ease(p); kick();
  if (p >= 1) tour.glide = null; else requestAnimationFrame(tourGlideStep);
}
function tourSoon(ms) {
  tour.wait = true; tour.said = false; tour.medals = [];
  document.body.classList.add("touring");
  clearTimeout(tour.timer); tour.timer = setTimeout(tourStart, ms);
}
function tourStart() {
  if (!tour.wait) return;
  if (document.body.classList.contains("listmode") || wel.on || tbl.on || bnd.on || room.on) { endTour(true); return; } // the list has no camera: just the line
  tour.wait = false; tour.on = true; tour.token++;
  clearTimeout(mdTimer); checkMedals(false); // the import's trophies, counted now rather than a beat later
  tour.stops = tourStops();
  tourSegs.innerHTML = tour.stops.map(() => "<i><b></b></i>").join("");
  tourEl.classList.add("on", "blank");
  tourStop(0);
}
function tourStop(i) {
  const tk = tour.token, s = tour.stops[i];
  if (!s) { endTour(false); return; }
  tour.i = i; tour.lit = null;
  tourEl.classList.add("blank");
  [...tourSegs.children].forEach((seg, k) => { const b = seg.firstChild; b.style.transition = "none"; b.style.width = k < i ? "100%" : "0%"; });
  kick();
  tourRun(s.go, () => {
    tourBig.textContent = s.big; tourSmall.textContent = s.small || "";
    tourAct.textContent = s.act ? `${s.act}  ›` : ""; tourEl.classList.toggle("acts", Boolean(s.act));
    tourGo.setAttribute("aria-label", `${s.big}. ${s.small || ""}${s.act ? ` ${s.act}.` : ""}`);
    tourEl.classList.remove("blank");
    if (s.lit) tour.lit = { ...s.lit(), t0: performance.now() };
    tick(4);
    const hold = s.hold || TOUR_HOLD, b = tourSegs.children[i]?.firstChild;
    if (b) { void b.offsetWidth; b.style.transition = reduced ? "none" : `width ${hold}ms linear`; b.style.width = "100%"; }
    kick();
    setTimeout(() => { if (tk !== tour.token) return; if (s.last) { tour.said = true; endTour(false); } else tourStop(i + 1); }, hold);
  });
}
// The tour ends wherever the wall is: nothing is put back, nothing jumps. say: the summary as a toast, when the
// tour didn't get to say it.
function endTour(say) {
  if (!tour.on && !tour.wait) return;
  clearTimeout(tour.timer);
  if (tour.wait) { clearTimeout(mdTimer); checkMedals(false); } // cut short during the flood: its trophies go in the summary too
  tour.token++; tour.on = false; tour.wait = false; tour.glide = null; tour.lit = null;
  document.body.classList.remove("touring"); tourEl.classList.remove("on");
  if (say && !tour.said) { tour.said = true; toast(`${tourSummary(tourFacts(), true).join(", ")}.`); }
  kick();
}
tourEl.querySelector("#tour-skip").onclick = () => endTour(true);
tourGo.onclick = () => {
  const s = tour.on && !tourEl.classList.contains("blank") ? tour.stops[tour.i] : null;
  endTour(!s);
  if (s?.run) { tick(6); s.run(); }
};
// Any touch outside the caption ends the tour first, then carries on as it would have (the round 6 rule: a touch
// during an animation takes over).
const tourTouch = (e) => { if ((tour.on || tour.wait) && !e.target?.closest?.("#tour")) endTour(true); };
addEventListener("touchstart", tourTouch, { capture: true, passive: true });
addEventListener("pointerdown", tourTouch, true);
addEventListener("wheel", tourTouch, { capture: true, passive: true });
addEventListener("keydown", (e) => {
  if (!tour.on && !tour.wait) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); endTour(true); return; }
  if (!e.target?.closest?.("#tour")) endTour(true);
}, true);

// ----- what the stops light: drawn over the frame, only while the view is still -----
const tourCopy = document.createElement("canvas"), tourCopyCtx = tourCopy.getContext("2d");
function drawTour() {
  const L = tour.lit; if (!L || !tour.on || tourBusy() || bnd.on || room.on || tbl.on) return;
  const now = performance.now(), a = reduced ? 1 : clamp((now - L.t0) / 450, 0, 1), ea = ease(a);
  let more = a < 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  const hole = (x, y, w, h, r) => { if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  if (L.kind === "missing") {
    if (view !== "set" || state.g !== L.g) return;
    const g = L.g, hy = Math.max(0, (g.y + g.head - cam.y) * cam.s - 6);
    // The cards you have step back; the pockets still to fill stay bright, each with a gold edge.
    ctx.save(); ctx.beginPath(); ctx.rect(0, hy, vw, vh - hy); ctx.clip();
    ctx.beginPath(); ctx.rect(0, hy, vw, vh - hy);
    const rs = [];
    for (const c of L.cards) { const r = binderRect(c, cam); if (r.y > vh || r.y + r.h < 0) continue; rs.push(r); hole(r.x - 3, r.y - 3, r.w + 6, r.h + 6, Math.min(10, r.w * 0.09) + 3); }
    ctx.fillStyle = theme.bg; ctx.globalAlpha = 0.62 * ea; ctx.fill("evenodd");
    const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin((now - L.t0) / 260);
    ctx.globalAlpha = ea * pulse; ctx.lineWidth = 2; ctx.strokeStyle = theme.gold;
    for (const r of rs) { ctx.beginPath(); hole(r.x - 3, r.y - 3, r.w + 6, r.h + 6, Math.min(10, r.w * 0.09) + 3); ctx.stroke(); }
    ctx.restore();
    if (!reduced) more = true;
  } else {
    if (view !== "mosaic") return;
    const R0 = L.rect?.(); if (!R0) return;
    const m = mr(R0), x = m.x + PG - 3, y = m.y + PG - 3, w = m.w - PG * 2 + 6, h = m.h - PG * 2 + 6;
    // A spotlight: the rest of the wall steps back.
    ctx.beginPath(); ctx.rect(0, 0, vw, vh); hole(x, y, w, h, 15);
    ctx.fillStyle = theme.bg; ctx.globalAlpha = 0.6 * ea; ctx.fill("evenodd");
    ctx.globalAlpha = ea; ctx.lineWidth = 1.5; ctx.strokeStyle = theme.gold; ctx.beginPath(); hole(x, y, w, h, 15); ctx.stroke();
    if (L.kind === "cover" && COVER.grid) more = liftPage(mr(COVER.grid), now, L) || more;
  }
  ctx.globalAlpha = 1;
  if (more) kick();
}
// The binder's first page lifts off the stack on the cover: the page as drawn, raised, with the next pages under it.
function liftPage(gr, now, L) {
  const p = reduced ? 1 : clamp((now - L.t0 - 250) / 650, 0, 1), k = ease(p);
  if (p <= 0) return true;
  const W = Math.ceil(gr.w * dpr) + 2, H = Math.ceil(gr.h * dpr) + 2;
  if (tourCopy.width !== W || tourCopy.height !== H) { tourCopy.width = W; tourCopy.height = H; }
  tourCopyCtx.clearRect(0, 0, W, H);
  tourCopyCtx.drawImage(canvas, Math.floor(gr.x * dpr), Math.floor(gr.y * dpr), W, H, 0, 0, W, H);
  const pages = Math.min(3, tbPageCount());
  ctx.globalAlpha = 1; ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"];
  for (let j = pages - 1; j >= 1; j--) { // the pages under it, fanned a little
    const o = j * 3.5 * k;
    rr(gr.x + o, gr.y + o * 0.6, gr.w, gr.h, 5); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.stroke();
  }
  const lift = 6 * k, s = 1 + 0.05 * k, w = gr.w * s, h = gr.h * s, x = gr.x + (gr.w - w) / 2 - 2 * k, y = gr.y + (gr.h - h) / 2 - lift;
  ctx.save();
  ctx.shadowColor = "rgb(0 0 0 / .28)"; ctx.shadowBlur = 14 * k; ctx.shadowOffsetY = 6 * k;
  ctx.drawImage(tourCopy, 0, 0, W, H, x, y, (W / dpr) * s, (H / dpr) * s);
  ctx.restore();
  return p < 1;
}
// The cover and the traders are the last things the frame draws over the wall (75-trade.js), so the tour's light goes
// on after them: the same body, then drawTour.
function drawTraders(now) {
  drawTraders0(now);
  drawTour();
}
function drawTraders0(now) {
  if (view !== "mosaic" || state.lens !== "trade" || bnd.on || room.on) return;
  const T = state.trans;
  let alpha = 1;
  if (T?.kind === "morph") alpha = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1));
  else if (T?.kind === "open") alpha = 1 - T.q;
  else if (T) return;
  if (tbl.on) alpha *= 1 - tbl.q;
  if (alpha <= 0.01) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCover(now, alpha); // the trade binder, above the traders
  if (strip) for (const ch of strip.chips) drawChip(ch, now, alpha);
}

// ----- the import: the flood as before, then the tour instead of the toast and the trophy card -----
function finishImport(src) {
  if (!wel.on) return;
  const now = performance.now(), chaseAll = wChase.checked;
  let n = 0, k = 0, d = 0, last = now;
  for (const c of pool) {
    if (c.owned || !c.own0) { if (chaseAll && !c.owned) { chasing[c.id] = true; k++; } continue; }
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; if (!c.of) n++; // the count says cards, as the counter does (printings ride along)
    if (!c.of) { const x = importCopies(c); if (x > 1) { copies[c.id] = { n: x, got: c.got }; d++; } }
    if (!reduced) { c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true }; if (Number.isFinite(c.anim.t0)) last = Math.max(last, c.anim.t0); } // printings ride along without a place of their own
  }
  copiesKey++; persist(); persistCopies(); if (chaseAll) persistChase();
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  tour.imp = { n, k, d, src, chaseAll };
  // The chrome waits through the flood; the tour starts as the last set lands.
  tourSoon(reduced ? 350 : clamp(last - now + 460 + 450, 900, 4500));
  updateCount(); drawList();
  const sync = syncDone({ quiet: true });
  if (lifted && !sync) liftLayout(true);
  tick(14);
  kick();
}
// The import's trophies are said by the tour (its door stop and its summary), not by a card of their own. If the
// tour was already over when they were counted, the card says so as before.
function mdAnnounce(got, viaImport) {
  if (viaImport && (tour.on || tour.wait)) { tour.medals.push(...got); return; }
  const cause = mdCause && performance.now() - mdCause.t < 2000 ? mdCause.c : null; mdCause = null;
  const inSet = view === "set" && state.g && !document.body.classList.contains("listmode") && !tbl.on && !bnd.on && !wel.on;
  if (!viaImport && got.length <= 4 && inSet) { queueMints(got, cause); return; }
  mdQueue.push(...got); mdQueue.via = viaImport ? "import" : mdQueue.via || ""; mdCelebrateSoon();
}

// Debug builds only: the tests' hook sees the tour.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { tour: { get: () => tour }, endTour: { value: endTour }, tourStops: { value: tourStops } }); }, 0);
