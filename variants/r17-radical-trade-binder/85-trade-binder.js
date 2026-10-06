// ---------- the trade binder (round 17, radical) ----------
// Real collectors keep a trade binder: nine-pocket pages of the cards they'll part with, flipped through across a
// table at a show. Here your spares live in that object.
//   Copies are the source. A card you own has a count (wall-copies); the import brings realistic doubles, seeded by
//   card id and weighted toward commons and uncommons, and every card with an extra copy starts in the binder. On the
//   wall a card you have more than one of wears its count in the corner ("×3"), gold while a copy is in the binder.
//   The binder is the first thing in the Trade lens: a cover above the traders with its first page in small. The wall
//   under it stays the wall, your spares lit where they sit. Tap the cover (or spread on it) and its page grows into
//   the binder, a level of its own like the trophy room: nine pockets a page, the most wanted first, each pocket
//   naming who chases it in small type under the card. Swipe sideways to turn the page (it scrubs under the finger,
//   then snaps by speed first, distance second). Tap a pocket and the trade table opens with that person, the card
//   already on it; hold a pocket to take it out. Back or a pinch returns to the Trade lens.
//   Filling it from the wall: in the Trade lens, Mark picks instead of marking (tap or sweep the cards you have
//   extras of, then Into the trade binder, and a copy of each lifts out through the top); or drag a card you own
//   down out of its close-up onto the card panel's To binder button.
//   Show mode: one button turns the binder into a clean, dark, full-screen spread to hand across a table. No chrome,
//   big pockets, prices shown or hidden, swipe to turn. The other person taps the pockets they'd like; when you take
//   the phone back, Done asks who it was and builds the trade on the table with those cards.
// While the binder is up it owns every touch on the canvas (like the table). Pages are painted once, copied
// offscreen and kept; a frame in the binder is a handful of drawImage calls.

// ----- copies: how many of each card you have -----
let copies = {};
try { copies = JSON.parse(localStorage.getItem("wall-copies") || "{}") || {}; } catch { copies = {}; }
let tbImported = false;
try { tbImported = Boolean(localStorage.getItem("wall-imported")); } catch { /* fresh */ }
const tbMemo = { at: -1, list: [], wanted: 0, dirty: true };
const persistCopies = () => { tbMemo.dirty = true; try { localStorage.setItem("wall-copies", JSON.stringify(copies)); } catch { /* private mode */ } };
// The extras an import brings (made up, seeded by card id): doubles pile up in the commons and uncommons.
const DUP_RATE = [0.3, 0.22, 0.1, 0.04, 0.02, 0.02, 0.02], DUP_MOST = [3, 2, 1, 1, 1, 1, 1];
for (const c of cards) c.dup0 = h32(`${c.id}|dup`) < DUP_RATE[c.tier] ? 1 + Math.floor(Math.pow(h32(`${c.id}|many`), 1.8) * DUP_MOST[c.tier]) : 0;
function copiesOf(c) {
  const b = c.base || c;
  if (!b.owned) return 0;
  const n = copies[b.id];
  return n != null ? Math.max(1, n) : 1 + (tbImported && b.own0 ? b.dup0 || 0 : 0);
}
// A card with an extra copy is in the binder unless you took it out: the base's spare flag reads the count.
for (const c of cards) Object.defineProperty(c, "spare0", { get: () => copiesOf(c) > 1, configurable: true });

// ----- the binder: which cards are in it (wall-binder); every path that sets a spare lands here -----
let binder = {};
try { binder = JSON.parse(localStorage.getItem("wall-binder") || "{}") || {}; } catch { binder = {}; }
const persistBinder = () => { try { localStorage.setItem("wall-binder", JSON.stringify(binder)); } catch { /* private mode */ } };
const baseSpares = spares; // the base wall's own key (wall-spares) is left as it was
spares = new Proxy(binder, {
  get: (t, k) => (k === "toJSON" ? () => baseSpares : t[k]),
  set: (t, k, v) => {
    t[k] = v;
    const c = byId.get(k);
    if (v && c?.owned && copiesOf(c) < 2) { copies[k] = 2; persistCopies(); } // into the binder means you have a double
    persistBinder(); tbMemo.dirty = true; return true;
  },
  deleteProperty: (t, k) => { delete t[k]; persistBinder(); tbMemo.dirty = true; return true; },
});
// The binder's cards, most wanted first (then the dearest), recomputed once a frame or after a change.
function tbList() {
  if (!tbMemo.dirty && tbMemo.at === lastFrame) return tbMemo.list;
  const list = cards.filter(isSpare), w = new Map();
  for (const c of list) w.set(c, wantedBy(c).length);
  list.sort((a, b) => w.get(b) - w.get(a) || b.price - a.price || a.i - b.i);
  tbMemo.list = list; tbMemo.wanted = list.filter((c) => w.get(c) > 0).length; tbMemo.at = lastFrame; tbMemo.dirty = false;
  return list;
}
const tbPageCount = () => Math.max(1, Math.ceil(tbList().length / 9));
const plural1 = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ----- geometry: a page is three by three pockets, each a card with two lines of small type under it -----
const SHOW_BG = "#0B0C0F", SHOW_PAGE = "#15171C", SHOW_SLEEVE = "#22262E", SHOW_LINE = "#2C313B", SHOW_MUTED = "#9AA0AD", SHOW_PICK = "#3BD597";
const safeEl = document.createElement("div"); safeEl.id = "tb-safe"; document.body.append(safeEl);
function safeInsets() { const r = safeEl.getBoundingClientRect(); return { top: Math.max(0, r.top || 0), bottom: Math.max(0, vh - (r.bottom || vh)) }; }
function tbGeom(show) {
  const S = safeInsets(), spread = vw >= 820 && vh >= 600 ? 2 : 1;
  const top = show ? S.top + 78 : topPad() + 62, bottom = show ? S.bottom + 96 : 112;
  const lh = show ? 24 : 22, g = show ? 6 : 8, ring = show ? 8 : 20, edge = show ? 8 : 10, pad = 8;
  const availW = (vw - (show ? 10 : 20) - (spread - 1) * 4) / spread, availH = vh - top - bottom;
  const byW = (availW - ring - edge - g * 2) / 3, byH = ((availH - pad * 2 - g * 2) / 3 - lh) * TW / TH;
  const cw = Math.floor(clamp(Math.min(byW, byH), 36, show ? 230 : 172)), ch = Math.round(cw * TH / TW);
  const pw = ring + cw * 3 + g * 2 + edge, ph = pad * 2 + (ch + lh) * 3 + g * 2;
  const total = pw * spread + (spread - 1) * 4, x0 = Math.round((vw - total) / 2), y0 = Math.round(top + Math.max(0, (availH - ph) / 2));
  return { show, spread, cw, ch, lh, g, ring, edge, pad, pw, ph, x0, y0, top, pages: Array.from({ length: spread }, (_, j) => ({ x: x0 + j * (pw + 4), y: y0 })) };
}
const tbSpreadRect = (G) => ({ x: G.x0, y: G.y0, w: G.pw * G.spread + (G.spread - 1) * 4, h: G.ph });
// On a two-page spread the rings sit at the spine: a left page has them on its right.
const tbLeft = (G, i) => G.spread === 2 && i % 2 === 0;
function tbPocket(G, i, k) {
  const ox = tbLeft(G, i) ? G.edge : G.ring;
  return { x: ox + (k % 3) * (G.cw + G.g), y: G.pad + Math.floor(k / 3) * (G.ch + G.lh + G.g), w: G.cw, h: G.ch };
}
const bnd = { on: false, q: 0, anim: null, closing: false, vi: 0, turn: 0, tAnim: null, show: false, sq: 0, sa: null, prices: true, picks: new Set(), L: null, pinch: null, drag: null, rest: false, swallow: false, press: null, cache: new Map() };
const tbViews = () => Math.max(1, Math.ceil(tbPageCount() / (bnd.L?.spread || 1)));
const tbCan = (d) => bnd.vi + d >= 0 && bnd.vi + d < tbViews();

// ----- painting a page (once, into the corner of the wall's canvas, then copied offscreen and kept) -----
function tbKey(i, G) {
  const items = tbList().slice(i * 9, i * 9 + 9);
  return `${G.show}|${G.pw}|${G.ph}|${G.cw}|${G.spread}|${dpr}|${theme.bg}|${theme["panel-solid"]}|${theme.gold}|${bnd.prices}|${i}|${items.map((c) => `${c.id}.${copiesOf(c)}.${c.away ? 1 : 0}.${G.show && bnd.picks.has(c.id) ? 1 : 0}`).join(",")}`;
}
function tbPaint(i, G) {
  const items = tbList().slice(i * 9, i * 9 + 9), show = G.show;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, G.pw + 2, G.ph + 2);
  const fill = show ? SHOW_PAGE : theme["panel-solid"], line = show ? SHOW_LINE : theme["slot-line"], sleeve = show ? SHOW_SLEEVE : theme.slot;
  const ink = show ? "#FFFFFF" : theme.ink, muted = show ? SHOW_MUTED : theme.muted;
  rr(0.5, 0.5, G.pw - 1, G.ph - 1, 10); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke();
  const left = tbLeft(G, i), rx = left ? G.pw - G.ring / 2 : G.ring / 2;
  if (!show) for (const f of [0.17, 0.5, 0.83]) { ctx.beginPath(); ctx.arc(rx, G.ph * f, 3.6, 0, Math.PI * 2); ctx.fillStyle = theme.bg; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke(); }
  ctx.textBaseline = "alphabetic";
  for (let k = 0; k < 9; k++) {
    const r = tbPocket(G, i, k), c = items[k];
    rr(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6); ctx.fillStyle = sleeve; ctx.fill(); // the sleeve
    ctx.fillStyle = line; ctx.fillRect(r.x - 1, r.y - 3, r.w + 2, 1); // its opening along the top
    if (!c) continue;
    if (c.away) { // out on the trade table: the pocket keeps its name
      ctx.setLineDash([4, 4]); rr(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, r.w * 0.045); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = "center"; ctx.fillStyle = muted; font(600, 11); ctx.fillText("On the table", r.x + r.w / 2, r.y + r.h / 2 + 4);
    } else { // the card, drawn at a size whose face carries no price (the price is under it, or hidden)
      const W0 = Math.min(r.w, 108), s = r.w / W0;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * r.x, dpr * r.y);
      foilOff = true; cardFace(c, 0, 0, W0, W0 * TH / TW, 0, false); foilOff = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    }
    const n = copiesOf(c) - 1;
    if (!show && n >= 2 && !c.away) { // more than one spare copy in the pocket
      font(800, 11); const t = `×${n}`, tw = textW(t) + 10;
      rr(r.x + 5, r.y + 5, tw, 18, 9); ctx.fillStyle = theme.gold; ctx.fill();
      ctx.textAlign = "center"; ctx.fillStyle = "#1A1405"; ctx.fillText(t, r.x + 5 + tw / 2, r.y + 18);
    }
    if (show && bnd.picks.has(c.id)) { // picked across the table
      ctx.lineWidth = 3.5; ctx.strokeStyle = SHOW_PICK; rr(r.x - 2.5, r.y - 2.5, r.w + 5, r.h + 5, r.w * 0.045 + 2.5); ctx.stroke();
      const R = 13, cx = r.x + r.w - R - 5, cy = r.y + R + 5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = SHOW_PICK; ctx.fill();
      ctx.lineWidth = 2.6; ctx.strokeStyle = "#0B0C0F"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      ctx.moveTo(cx - R * 0.45, cy + R * 0.02); ctx.lineTo(cx - R * 0.12, cy + R * 0.36); ctx.lineTo(cx + R * 0.48, cy - R * 0.36); ctx.stroke(); ctx.lineCap = "butt"; ctx.lineJoin = "miter";
    }
    // under the card, yours: who chases it, and the price. Across the table: its name, and the price if shown.
    const ly = r.y + r.h + 4, price = show && !bnd.prices ? "" : short(c.price);
    ctx.textAlign = "right"; font(600, show ? 12.5 : 11.5); ctx.fillStyle = show ? "rgb(255 255 255 / .72)" : muted;
    const pw = price ? textW(price) + 6 : 0;
    if (price) ctx.fillText(price, r.x + r.w, ly + 13);
    ctx.textAlign = "left";
    if (show) { ctx.fillStyle = "#FFFFFF"; font(700, 13.5, true); ctx.fillText(fitText(c.name, r.w - pw), r.x, ly + 13); }
    else {
      const who = wantedBy(c);
      if (who.length) { ctx.fillStyle = theme.gold; font(700, 12.5, true); ctx.fillText(fitText(who.map((t) => t.name).join(", "), r.w - pw), r.x, ly + 13); }
      else { ctx.fillStyle = muted; font(500, 11.5); ctx.fillText(fitText("No takers yet", r.w - pw), r.x, ly + 13); }
    }
  }
  ctx.textAlign = "center"; ctx.fillStyle = muted; font(600, 10); ctx.fillText(String(i + 1), rx, G.ph - 8); // the page number, by the rings
}
function tbEnsure(i, G) {
  if (i < 0) return;
  const key = tbKey(i, G), slot = `${G.show ? "s" : "o"}${i}`, had = bnd.cache.get(slot), now = performance.now();
  if (had?.key === key) { had.used = now; return; }
  tbPaint(i, G);
  const W = Math.ceil(G.pw * dpr), H = Math.ceil(G.ph * dpr);
  let cv = had?.cv;
  if (!cv || cv.width !== W || cv.height !== H) { cv = document.createElement("canvas"); cv.width = W; cv.height = H; }
  const x = cv.getContext("2d"); x.clearRect(0, 0, W, H); x.drawImage(canvas, 0, 0, W, H, 0, 0, W, H);
  bnd.cache.set(slot, { key, cv, used: now });
  if (bnd.cache.size > 6) { const old = [...bnd.cache].sort((a, b) => a[1].used - b[1].used)[0]; bnd.cache.delete(old[0]); }
}
const tbImg = (i, G) => bnd.cache.get(`${G.show ? "s" : "o"}${i}`)?.cv || null;

// ----- the level: drawing -----
function tbStep(now) {
  let more = false;
  if (bnd.anim) {
    const a = bnd.anim, p = clamp((now - a.t0) / a.dur, 0, 1); bnd.q = a.from + (a.to - a.from) * ease(p);
    if (p >= 1) { bnd.anim = null; bnd.q = a.to; if (a.to === 0) { tbEnd(); return false; } } else more = true;
  }
  if (bnd.tAnim) {
    const a = bnd.tAnim, p = clamp((now - a.t0) / a.dur, 0, 1); bnd.turn = a.from + (a.to - a.from) * (1 - Math.pow(1 - p, 3));
    if (p >= 1) tbTurnDone(a.to); else more = true;
  }
  if (bnd.sa) { const a = bnd.sa; a.k = clamp((now - a.t0) / a.dur, 0, 1); bnd.sq = bnd.show ? a.k : 1 - a.k; if (a.k >= 1) bnd.sa = null; else more = true; }
  return more;
}
function tbDraw(now) {
  live.line = null; // a deal landing on the wall flashes there; its line to the lens bar has nowhere to go here
  const G = bnd.L || (bnd.L = tbGeom(bnd.show)), views = tbViews();
  bnd.vi = clamp(bnd.vi, 0, views - 1);
  // the pages on show, and while a turn is under way the ones it reveals
  const need = new Set(), addView = (v) => { if (v >= 0 && v < views) for (let j = 0; j < G.spread; j++) need.add(v * G.spread + j); };
  addView(bnd.vi);
  if (bnd.turn > 0 || bnd.drag?.axis === "x") addView(bnd.vi + 1);
  if (bnd.turn < 0 || bnd.drag?.axis === "x") addView(bnd.vi - 1);
  for (const i of need) tbEnsure(i, G);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  const q = bnd.q, sq = bnd.sq, bg = sq > 0.001 ? mix(theme.bg, SHOW_BG, sq) : theme.bg;
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  if (q < 1) { // opening or closing: the wall is under it, and the page grows out of the cover
    drawWall(now, 1);
    drawCover(now, 1 - q);
    if (strip) for (const ch of strip.chips) drawChip(ch, now, 1 - q);
    ctx.globalAlpha = Math.min(1, q * 1.15); ctx.fillStyle = bg; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  } else if (sq > 0.001) { ctx.fillStyle = bg; ctx.fillRect(0, 0, vw, vh); }
  let S = tbSpreadRect(G);
  if (q < 1 && COVER.grid) { const k = ease(q); S = lerpRect(mr(COVER.grid), S, k); }
  if (bnd.sa) S = lerpRect(bnd.sa.from, S, ease(bnd.sa.k));
  const ha = clamp((q - 0.72) / 0.28, 0, 1);
  tbHeader(G, ha, sq);
  tbPages(G, S, q);
  if (bnd.press && !bnd.turn && q >= 1) { const r = tbPocketRect(bnd.press); if (r) { ctx.lineWidth = 2; ctx.strokeStyle = G.show ? "#fff" : theme.ink; rr(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6); ctx.stroke(); } }
  tbDots(G, S, ha);
  ctx.globalAlpha = 1;
}
function tbHeader(G, a, sq) {
  if (a <= 0.01) return;
  const list = tbList(), n = list.length, pages = tbPageCount(), x = G.x0 + 2;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  if (sq < 0.999) {
    ctx.globalAlpha = a * (1 - sq);
    const y = topPad() + 26;
    ctx.fillStyle = theme.ink; font(800, 25, true); ctx.fillText("Trade binder", x, y);
    ctx.fillStyle = theme.muted; font(500, 13);
    ctx.fillText(fitText(n ? `${plural1(n, "card")} on ${plural1(pages, "page")}. ${tbMemo.wanted ? `${tbMemo.wanted} someone wants.` : "Nobody has asked for one yet."}` : "Empty for now. In the Trade lens, open a set and tap Mark.", vw - x - 12), x, y + 21);
  }
  if (sq > 0.001) {
    ctx.globalAlpha = a * sq;
    const y = safeInsets().top + 40, v = bnd.vi + 1, views = tbViews();
    ctx.fillStyle = "#FFFFFF"; font(800, 25, true); ctx.fillText("Trade binder", x, y);
    ctx.fillStyle = SHOW_MUTED; font(500, 13.5);
    ctx.fillText(fitText(`Page ${G.spread === 2 ? (v * 2 > tbPageCount() ? v * 2 - 1 : `${v * 2 - 1} and ${v * 2}`) : v} of ${tbPageCount()}. Tap the cards you'd like.`, vw - x - 140), x, y + 21);
  }
  ctx.globalAlpha = 1;
}
// The page (or the spread) in rect S. A turn folds the page about its rings: forward from view a to a + 1 at p,
// a turn back being the same fold played backwards.
function tbPages(G, S, q) {
  const k = S.h / G.ph, pw = G.pw * k, ph = S.h, at = (j) => S.x + j * (G.pw + 4) * k, sp = G.spread;
  const page = (i, x, w, dark = 0) => {
    const img = tbImg(i, G); if (!img || w < 0.5) return;
    ctx.drawImage(img, x, S.y, w, ph);
    if (dark > 0.01) { ctx.globalAlpha = dark; ctx.fillStyle = "#000"; rr(x, S.y, w, ph, 10 * k); ctx.fill(); ctx.globalAlpha = 1; }
  };
  const shade = (x, dir, a) => { // the shadow the lifting page casts on the one under it
    if (a <= 0.01) return;
    const w = Math.min(40, pw * 0.25), g = ctx.createLinearGradient(x, 0, x + dir * w, 0);
    g.addColorStop(0, `rgb(0 0 0 / ${a.toFixed(3)})`); g.addColorStop(1, "rgb(0 0 0 / 0)");
    ctx.fillStyle = g; ctx.fillRect(dir > 0 ? x : x - w, S.y, w, ph);
  };
  const t = bnd.turn, v = bnd.vi;
  if (!t || q < 1) { for (let j = 0; j < sp; j++) page(v * sp + j, at(j), pw); return; }
  const a = t > 0 ? v : v - 1, p = t > 0 ? t : 1 + t;
  if (sp === 1) {
    page(a + 1, at(0), pw);
    const w = pw * Math.cos((p * Math.PI) / 2);
    shade(at(0) + w, 1, 0.28 * (1 - p));
    page(a, at(0), w, 0.3 * p);
    return;
  }
  const L0 = a * 2, R0 = L0 + 1, L1 = L0 + 2, R1 = L0 + 3, spine = at(0) + pw;
  page(L0, at(0), pw); page(R1, at(1), pw);
  if (p < 0.5) { const w = pw * Math.cos(p * Math.PI); shade(at(1) + w, 1, 0.25 * (1 - p * 2)); page(R0, at(1), w, 0.3 * p * 2); }
  else { const w = pw * -Math.cos(p * Math.PI); shade(spine - w, -1, 0.25 * (p * 2 - 1)); page(L1, spine - w, w, 0.3 * (1 - p) * 2); }
}
function tbDots(G, S, a) {
  const views = tbViews(); if (views < 2 || a <= 0.01) return;
  const y = S.y + S.h + 16, on = G.show ? "#FFFFFF" : theme.ink, off = G.show ? "#3A3F4A" : theme["slot-line"];
  ctx.globalAlpha = a;
  if (views > 24) { ctx.textAlign = "center"; ctx.fillStyle = G.show ? SHOW_MUTED : theme.muted; font(600, 12); ctx.fillText(`${bnd.vi + 1} of ${views}`, vw / 2, y + 4); ctx.globalAlpha = 1; return; }
  const gap = 12, x0 = vw / 2 - ((views - 1) * gap) / 2, cur = bnd.vi + clamp(bnd.turn, -1, 1);
  for (let i = 0; i < views; i++) { ctx.beginPath(); ctx.arc(x0 + i * gap, y, 3, 0, Math.PI * 2); ctx.fillStyle = off; ctx.fill(); }
  ctx.beginPath(); ctx.arc(x0 + cur * gap, y, 3.6, 0, Math.PI * 2); ctx.fillStyle = on; ctx.fill();
  ctx.globalAlpha = 1;
}
// The pocket under a point on screen, and where a card's pocket is.
function tbPocketAt(x, y) {
  const G = bnd.L; if (!G || bnd.turn || bnd.q < 1 || bnd.sa) return null;
  const list = tbList();
  for (let j = 0; j < G.spread; j++) {
    const P = G.pages[j], i = bnd.vi * G.spread + j;
    for (let k = 0; k < 9; k++) {
      const r = tbPocket(G, i, k), X = P.x + r.x, Y = P.y + r.y;
      if (x >= X - 3 && x <= X + r.w + 3 && y >= Y - 3 && y <= Y + r.h + G.lh) { const c = list[i * 9 + k]; return c ? { c, r: { x: X, y: Y, w: r.w, h: r.h } } : null; }
    }
  }
  return null;
}
function tbPocketRect(c) {
  const G = bnd.L; if (!G) return null;
  const i = tbList().indexOf(c); if (i < 0) return null;
  const page = Math.floor(i / 9), j = page - bnd.vi * G.spread; if (j < 0 || j >= G.spread) return null;
  const r = tbPocket(G, page, i % 9), P = G.pages[j];
  return { x: P.x + r.x, y: P.y + r.y, w: r.w, h: r.h };
}

// ----- the cover in the Trade lens: the binder closed, its first page in small -----
const COVER_H = 140;
const COVER = { door: true, tbCover: true, name: "Trade binder", cards: [], lead: [], base: [], m: null, grid: null, G: null };
function tradeTop(R, y) {
  if (state.lens !== "trade") { COVER.m = null; COVER.grid = null; strip = null; return 0; }
  const G = (COVER.G = tbGeom(false)), gh = COVER_H - PG * 2 - 22, gw = gh * G.pw / G.ph;
  COVER.m = { x: R.x, y, w: R.w, h: COVER_H };
  COVER.grid = { x: R.x + R.w - PG - 14 - gw, y: y + PG + 11, w: gw, h: gh };
  return COVER_H + stripLayout({ x: R.x, y: y + COVER_H, w: R.w });
}
function drawCover(now, alpha) {
  const M = COVER.m; if (!M || !COVER.grid || alpha <= 0.01) return;
  const m = mr(M); if (m.y > vh || m.y + m.h < 0) return;
  const x = m.x + PG, y = m.y + PG, w = m.w - PG * 2, h = m.h - PG * 2, list = tbList(), n = list.length, pages = tbPageCount();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = alpha;
  rr(x, y, w, h, 12); ctx.fillStyle = theme.panelFill; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (state.press?.g === COVER) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.fillStyle = theme.gold; rr(x, y + 12, 4, h - 24, 2); ctx.fill(); // the spine
  const gr = mr(COVER.grid), tx = x + 18, tw = gr.x - 16 - tx;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.ink; font(800, 19, true); ctx.fillText(fitText("Trade binder", tw), tx, y + 31);
  ctx.fillStyle = theme.muted; font(500, 13); ctx.fillText(fitText(n ? `${plural1(n, "card")} on ${plural1(pages, "page")}` : "Empty for now", tw), tx, y + 52);
  ctx.fillStyle = n && tbMemo.wanted ? theme.gold : theme.muted; font(700, 13, true);
  ctx.fillText(fitText(n ? (tbMemo.wanted ? `${tbMemo.wanted} someone wants` : "Nobody has asked yet") : "Open a set and tap Mark to fill it", tw), tx, y + 70);
  ctx.fillStyle = theme.ink; font(700, 13.5); ctx.fillText(fitText(n ? "Open the binder  ›" : "Open it  ›", tw), tx, y + h - 16);
  // the first page, small: the thing that grows into the binder when you open it
  const G = COVER.G, k = gr.w / G.pw;
  rr(gr.x, gr.y, gr.w, gr.h, 5); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const p = tbPocket(G, 0, i), px = gr.x + p.x * k, py = gr.y + p.y * k, pw = p.w * k, ph = p.h * k, c = list[i];
    if (!c) { ctx.fillStyle = theme.slot; ctx.fillRect(px, py, pw, ph); continue; }
    const col = typeColor(c);
    ctx.fillStyle = col; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = lighter(col); ctx.fillRect(px + 1, py + 1, pw - 2, ph * 0.22);
    ctx.fillStyle = theme.paper; ctx.fillRect(px + 1, py + ph * 0.76, pw - 2, ph * 0.2);
  }
  ctx.globalAlpha = 1;
}

// ----- opening and closing -----
function openBinder() {
  if (bnd.on || state.trans || tbl.on || view !== "mosaic" || room.on) return;
  hideCaption(); cancelPress(); closePop(true); hideWho(); tick(8);
  Object.assign(bnd, { on: true, closing: false, turn: 0, tAnim: null, pinch: null, drag: null, rest: false, swallow: false, press: null, show: false, sq: 0, sa: null, vi: 0 });
  tbMemo.dirty = true; bnd.L = tbGeom(false);
  bnd.q = reduced ? 1 : 0; bnd.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 560 };
  document.body.classList.add("inbinder"); setChrome(); tbSync(); kick();
}
function closeBinder(instant = false) {
  if (!bnd.on || bnd.closing) return;
  hideWho();
  if (bnd.show) { bnd.show = false; bnd.sq = 0; bnd.sa = null; bnd.L = tbGeom(false); document.body.classList.remove("showing"); }
  Object.assign(bnd, { closing: true, pinch: null, drag: null, tAnim: null, turn: 0, press: null });
  if (instant || reduced) { bnd.q = 0; bnd.anim = null; tbEnd(); return; }
  bnd.anim = { from: bnd.q, to: 0, t0: performance.now(), dur: 160 + 360 * bnd.q }; tick(6); kick();
}
function tbEnd() {
  Object.assign(bnd, { on: false, closing: false, anim: null, q: 0, pinch: null, drag: null, press: null, show: false, sq: 0, sa: null });
  document.body.classList.remove("inbinder", "showing"); setChrome(); kick();
}
// Turning: animate from wherever the page is to a whole turn (1 forward, -1 back) or back to rest (0).
function tbTurnTo(to) {
  if (to === bnd.turn && !bnd.tAnim) return;
  if (reduced) { bnd.tAnim = null; tbTurnDone(to); kick(); return; }
  bnd.tAnim = { from: bnd.turn, to, t0: performance.now(), dur: 150 + 300 * Math.abs(to - bnd.turn) }; kick();
}
function tbTurnDone(to) {
  bnd.tAnim = null; bnd.turn = 0;
  if (to === 1 || to === -1) { bnd.vi = clamp(bnd.vi + to, 0, tbViews() - 1); tick(4); }
  tbSync(); kick();
}
function tbTurn(d) { if (!bnd.on || bnd.q < 1) return; if (!tbCan(d)) { tick(2); return; } tbTurnTo(d); }
// Show mode: the same pages, dark and full screen, nothing else on it.
function tbEnterShow() {
  if (!bnd.on || bnd.show || bnd.q < 1 || !tbList().length) return;
  hideWho(); tick(8);
  const from = tbSpreadRect(bnd.L);
  bnd.show = true; bnd.L = tbGeom(true); bnd.turn = 0; bnd.tAnim = null;
  bnd.sa = reduced ? null : { t0: performance.now(), dur: 380, k: 0, from }; bnd.sq = reduced ? 1 : 0;
  document.body.classList.add("showing"); setChrome(); tbSync(); kick();
}
function tbExitShow() {
  if (!bnd.show) return;
  const from = tbSpreadRect(bnd.L);
  bnd.show = false; bnd.L = tbGeom(false); bnd.turn = 0; bnd.tAnim = null;
  bnd.sa = reduced ? null : { t0: performance.now(), dur: 340, k: 0, from }; bnd.sq = reduced ? 0 : 1;
  document.body.classList.remove("showing"); setChrome(); tbSync(); tick(6); kick();
}
// Taking the phone back: who was it? The picks go on the table with them.
function tbHandBack() {
  const picks = tbList().filter((c) => bnd.picks.has(c.id));
  tbExitShow();
  if (!picks.length) return;
  const rows = TRADERS.map((t) => ({ t, n: picks.filter((c) => t.chaseSet.has(c)).length })).sort((a, b) => b.n - a.n || TRADERS.indexOf(a.t) - TRADERS.indexOf(b.t));
  showWho(`${plural1(picks.length, "card")} picked. Who was it?`, [...rows.map((r) => ({ t: r.t, title: r.t.name, sub: r.n ? `Chases ${r.n} of ${picks.length === 1 ? "it" : "them"}` : `${r.t.where}. Chases none of them` })), { title: "Not now", sub: "Keep the picks for later" }],
    (r) => { if (!r.t) return; bnd.picks.clear(); tbTrade(r.t, picks); });
}

// ----- trading from a pocket -----
let tbPreGive = null; // cards to put on the table as it opens
function tbPocketTap(c) {
  const who = wantedBy(c);
  if (!who.length) { tick(3); toast(`Nobody is chasing ${c.name} yet.`); return; }
  if (who.length === 1) { tbTrade(who[0], [c]); return; }
  showWho(`Trade ${c.name} with`, who.map((t) => ({ t, title: t.name, sub: `${t.where}. Wants ${wantsOf(t).length} of yours` })), (r) => tbTrade(r.t, [c]));
}
function tbTrade(t, give) {
  if (tbl.on || state.trans) return;
  const had = activeOf(t);
  tbPreGive = had ? null : give.filter(isSpare);
  openTable(t, null);
  if (had) toast(`You have a trade open with ${t.name}. Here it is.`);
}

// ----- who: a small menu over the bar (one trader for a pocket, or who was across the table) -----
const whoEl = document.createElement("div");
whoEl.className = "arrange-menu tradehow glass tbwho"; whoEl.id = "tb-who"; whoEl.setAttribute("role", "menu"); whoEl.hidden = true;
document.body.append(whoEl);
let whoPick = null, whoClosed = 0;
function showWho(head, rows, pick) {
  whoEl.innerHTML = `<p class="th-head">${esc(head)}</p>${rows.map((r, i) => `<button role="menuitem" data-w="${i}"><span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span><span class="tick" aria-hidden="true">${r.t ? "›" : ""}</span></button>`).join("")}`;
  whoPick = (i) => pick(rows[i]);
  whoEl.hidden = false; tick(4);
  whoEl.querySelector("button")?.focus({ preventScroll: true });
}
function hideWho() { if (whoEl.hidden) return; whoEl.hidden = true; whoPick = null; }
whoEl.addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (!b) return; const f = whoPick; hideWho(); f?.(Number(b.dataset.w)); });
whoEl.addEventListener("keydown", (e) => { if (e.key === "Escape") hideWho(); });
addEventListener("pointerdown", (e) => { if (!whoEl.hidden && !e.target.closest("#tb-who")) { hideWho(); whoClosed = performance.now(); } }, true);

// ----- the bars: the binder's along the bottom, Show mode's, and the prices switch -----
const bbar = document.createElement("div");
bbar.className = "bbar glass"; bbar.id = "bbar"; bbar.setAttribute("role", "group"); bbar.setAttribute("aria-label", "Trade binder");
bbar.innerHTML = `<div class="mtext" aria-live="polite"><b id="bb-head"></b><span id="bb-sub"></span></div><button type="button" class="mbtn primary" id="bb-show">Show mode</button>`;
const sbar = document.createElement("div");
sbar.className = "showbar"; sbar.id = "showbar"; sbar.setAttribute("role", "group"); sbar.setAttribute("aria-label", "Show mode");
sbar.innerHTML = `<div class="mtext" aria-live="polite"><b id="sb-head"></b><span id="sb-sub"></span></div><button type="button" class="mbtn" id="sb-done">Done</button>`;
const sPrice = document.createElement("button");
sPrice.type = "button"; sPrice.className = "showpill"; sPrice.id = "sb-price";
document.body.append(bbar, sbar, sPrice);
const bbHead = bbar.querySelector("#bb-head"), bbSub = bbar.querySelector("#bb-sub"), bbShow = bbar.querySelector("#bb-show");
const sbHead = sbar.querySelector("#sb-head"), sbSub = sbar.querySelector("#sb-sub");
function tbSync() {
  const n = tbList().length, G = bnd.L, views = tbViews(), v = bnd.vi + 1, k = bnd.picks.size;
  bbHead.textContent = n ? (G?.spread === 2 ? (v * 2 > tbPageCount() ? `Page ${v * 2 - 1} of ${tbPageCount()}` : `Pages ${v * 2 - 1} and ${v * 2} of ${tbPageCount()}`) : `Page ${v} of ${views}`) : "Nothing in it yet";
  bbSub.textContent = n ? "Most wanted first. Tap a card to trade it." : "Open a set and tap Mark to fill it";
  bbShow.disabled = !n;
  sbHead.textContent = k ? `${plural1(k, "card")} picked` : "Tap the cards you'd like";
  sbSub.textContent = k ? "Tap one again to put it back" : "Swipe sideways for more pages";
  sPrice.textContent = bnd.prices ? "Prices shown" : "Prices hidden"; sPrice.setAttribute("aria-pressed", String(bnd.prices));
}
bbShow.onclick = () => tbEnterShow();
sbar.querySelector("#sb-done").onclick = () => tbHandBack();
sPrice.onclick = () => { bnd.prices = !bnd.prices; tick(4); tbSync(); kick(); };

// ----- input: while the binder is up it owns every touch on the canvas -----
function bDown(pts) {
  hideCaption();
  if (!whoEl.hidden) { hideWho(); bnd.swallow = true; return; } // a touch outside the menu just closes it
  if (performance.now() - whoClosed < 350) { bnd.swallow = true; return; }
  if (bnd.closing) { const a = bnd.anim; if (a) { bnd.anim = null; bnd.q = a.to; } tbEnd(); return; } // the close finishes; the wall takes the next touch
  if (bnd.anim) { const a = bnd.anim; bnd.anim = null; bnd.q = a.to; }
  if (bnd.sa) { bnd.sa = null; bnd.sq = bnd.show ? 1 : 0; }
  if (pts.length >= 2) return bPinchStart(pts);
  if (bnd.drag || bnd.pinch || bnd.rest) return;
  if (bnd.tAnim) tbTurnDone(bnd.tAnim.to); // a touch during a turn: the turn lands and the touch takes over
  const p = pts[0], now = performance.now();
  bnd.drag = { x: p.x, y: p.y, t: now, axis: null, samples: [{ x: p.x, y: p.y, t: now }], held: false, timer: 0, turn0: 0 };
  if (!bnd.show) {
    const h = tbPocketAt(p.x, p.y);
    if (h) { bnd.press = h.c; bnd.drag.timer = setTimeout(() => tbHold(h.c), 460); kick(); }
  }
}
function bMove(pts) {
  if (bnd.swallow) return;
  if (bnd.pinch) { if (pts.length >= 2) bPinchMove(pts); return; }
  if (pts.length >= 2) { if (bnd.show) return; if (bnd.drag) { clearTimeout(bnd.drag.timer); bnd.drag = null; bnd.press = null; } return bPinchStart(pts); }
  const d = bnd.drag, p = pts[0]; if (!d || !p || d.held) return;
  const now = performance.now();
  d.samples.push({ x: p.x, y: p.y, t: now }); if (d.samples.length > 8) d.samples.shift();
  const dx = p.x - d.x, dy = p.y - d.y;
  if (!d.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    clearTimeout(d.timer); bnd.press = null;
    d.axis = Math.abs(dx) > Math.abs(dy) * 0.8 ? "x" : "y"; d.turn0 = bnd.turn;
  }
  if (d.axis !== "x" || bnd.q < 1) return;
  const G = bnd.L, span = G.spread === 2 ? G.pw * 1.5 : G.pw * 0.85;
  let t = d.turn0 - dx / span;
  if ((t > 0 && !tbCan(1)) || (t < 0 && !tbCan(-1))) t = 0;
  bnd.turn = clamp(t, -1, 1); kick();
}
function bUp(remaining, cancelled) {
  if (bnd.swallow) { if (!remaining.length) bnd.swallow = false; return; }
  if (bnd.pinch) { if (remaining.length >= 2) return; bPinchEnd(cancelled); bnd.rest = remaining.length > 0; return; }
  if (bnd.rest) { if (!remaining.length) bnd.rest = false; return; }
  if (remaining.length) return;
  const d = bnd.drag; bnd.drag = null; bnd.press = null;
  if (!d) { kick(); return; }
  clearTimeout(d.timer);
  if (cancelled) { if (bnd.turn) tbTurnTo(0); kick(); return; }
  if (d.held) { kick(); return; }
  if (!d.axis) { tbTap(d.x, d.y); kick(); return; }
  if (d.axis !== "x") { kick(); return; }
  const now = performance.now(), s0 = d.samples.find((s) => now - s.t < 100) || d.samples[0], last = d.samples[d.samples.length - 1];
  const vx = s0 && last !== s0 ? (last.x - s0.x) / Math.max(1, last.t - s0.t) : 0;
  let to = 0;
  if (Math.abs(vx) > 0.3) to = vx < 0 ? 1 : -1; // a flick turns the page, however short
  else if (Math.abs(bnd.turn) > 0.4) to = Math.sign(bnd.turn); // a slow drag turns it past halfway
  if (to && bnd.turn && Math.sign(bnd.turn) !== to && Math.abs(bnd.turn) > 0.05) to = 0;
  if (to && !tbCan(to)) to = 0;
  tbTurnTo(to);
}
function tbTap(x, y) {
  if (bnd.q < 1) return;
  const h = tbPocketAt(x, y); if (!h) return;
  if (bnd.show) {
    const id = h.c.id; if (bnd.picks.has(id)) bnd.picks.delete(id); else bnd.picks.add(id);
    tick(bnd.picks.has(id) ? 10 : 4); tbSync(); kick(); return;
  }
  tbPocketTap(h.c);
}
// Hold a pocket: the card comes out of the binder (Undo puts it back).
function tbHold(c) {
  const d = bnd.drag; if (!d || d.axis || bnd.show) return;
  d.held = true; bnd.press = null; tick(12);
  spares[c.id] = false; tbSync(); drawList(); kick();
  toast(`${c.name} is out of your trade binder.`, () => { spares[c.id] = true; tbSync(); drawList(); kick(); });
}
function bPinchStart(pts) {
  if (bnd.show) return;
  bnd.drag = null; bnd.press = null; bnd.tAnim = null; bnd.turn = 0;
  bnd.pinch = { d0: dist(pts[0], pts[1]), q0: bnd.q, qs: [] }; kick();
}
function bPinchMove(pts) {
  const g = bnd.pinch, d = dist(pts[0], pts[1]);
  bnd.q = clamp(g.q0 - (1 - d / g.d0) / 0.55, 0, 1); g.qs.push({ q: bnd.q, t: performance.now() }); kick();
}
// Letting go: a quick pinch closes whatever the distance; a slow one goes to whichever end is nearer.
function bPinchEnd(cancelled) {
  const g = bnd.pinch; bnd.pinch = null; if (!g) return;
  const qs = g.qs, last = qs[qs.length - 1];
  let first = qs.find((s) => last && last.t - s.t < 160);
  if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
  const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
  const to = cancelled ? 1 : Math.abs(v) > 0.0011 ? (v > 0 ? 1 : 0) : bnd.q > 0.5 ? 1 : 0;
  if (to === 0) closeBinder();
  else if (reduced) { bnd.q = 1; kick(); }
  else { bnd.anim = { from: bnd.q, to: 1, t0: performance.now(), dur: 160 + 300 * (1 - bnd.q) }; kick(); }
}
const tbPts = (list) => [...list].map((t) => ({ x: t.clientX, y: t.clientY }));
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!bnd.on || tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (type === "touchstart") bDown(tbPts(e.touches));
  else if (type === "touchmove") bMove(tbPts(e.touches));
  else bUp(tbPts(e.touches), type === "touchcancel");
}, { capture: true, passive: false });
let bMouse = false;
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !bnd.on || tbl.on || e.target !== canvas) return; e.stopImmediatePropagation(); bMouse = true; bDown([{ x: e.clientX, y: e.clientY }]); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !bMouse) return; e.stopImmediatePropagation(); bMove([{ x: e.clientX, y: e.clientY }]); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !bMouse) return; bMouse = false; e.stopImmediatePropagation(); bUp([], type === "pointercancel"); }, true);
let wheelAcc = 0;
document.addEventListener("wheel", (e) => {
  if (!bnd.on || tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (bnd.q < 1 || bnd.tAnim) return;
  if ((e.ctrlKey || e.metaKey) && !bnd.show) { if (e.deltaY > 2) closeBinder(); return; }
  wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(wheelAcc) > 60) { tbTurn(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
}, { capture: true, passive: false });
document.addEventListener("keydown", (e) => {
  if (!bnd.on || tbl.on || document.activeElement === qIn) return;
  if (e.key === "Escape" || e.key === "Backspace") { if (!whoEl.hidden) return; e.preventDefault(); e.stopImmediatePropagation(); if (bnd.show) tbHandBack(); else closeBinder(); }
  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); tbTurn(e.key === "ArrowRight" ? 1 : -1); }
}, true);
// The binder steps aside for anything that navigates the wall: a lens, a search, the list.
lensBox.addEventListener("click", () => { if (bnd.on) closeBinder(true); }, true);
qIn.addEventListener("input", () => { if (bnd.on) closeBinder(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (bnd.on) closeBinder(true); }, true);
document.getElementById("count").addEventListener("click", () => { if (bnd.on) closeBinder(); });
backBtn.onclick = () => { if (tbl.on) closeTable(); else if (bnd.on) { if (bnd.show) tbHandBack(); else closeBinder(); } else if (view === "set") exitToMosaic(); else if (room.on) closeRoom(); };
// From anywhere (the import's toast, a Mark session): out of the set, into the Trade lens, then the binder.
function tbOpenFromAnywhere() {
  if (document.body.classList.contains("listmode") || wel.on || tbl.on || bnd.on) return;
  closePop(true); if (state.focus) unfocus(); if (room.on) closeRoom(true);
  let tries = 0;
  const go = () => {
    if (bnd.on || tries++ > 60) return;
    if (state.trans || shuffle || fly) { setTimeout(go, 120); return; }
    if (view === "set") { exitToMosaic(); setTimeout(go, 120); return; }
    if (state.lens !== "trade") { setLens("trade"); setTimeout(go, 120); return; }
    mScroll = 0; openBinder();
  };
  go();
}

// ----- on the wall: copies in the corner, Mark that picks for the binder, a card dragged into it -----
const tbPicks = new Set(); // cards picked for the binder in this Mark session (in the Trade lens)
const binderMark = () => marking && state.lens === "trade";
const tbGhosts = []; // copies flying into the binder button: { c, from, to, t0, dur }
const fd = { a: null, back: null }; // a card being dragged out of its close-up, and one going back
function tbOverlay(now) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (fd.back) { // a card let go short of the button settles back into place
    const B = fd.back, p = clamp((now - B.t0) / 220, 0, 1), e = ease(p);
    B.c.x = B.from.x + (B.to.x - B.from.x) * e; B.c.y = B.from.y + (B.to.y - B.from.y) * e; B.c.sz = B.from.sz + (B.to.sz - B.from.sz) * e;
    if (p >= 1) fd.back = null; kick();
  }
  if (view === "set" && state.g && !state.trans && !shuffle) {
    const g = state.g, cs = TW * g.sz * cam.s;
    if (cs >= 30) {
      const bm = binderMark(), y0 = cam.y, y1 = cam.y + vh / cam.s;
      const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
      for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
        const c = g.cards[k], b = c.base || c;
        if (state.focus && c !== state.focus) continue;
        if (!state.focus && c === fd.a?.c) continue;
        const r = binderRect(c, cam); if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
        if (bm && tbPicks.has(b)) { // picked for the binder: a gold ring and a tick
          ctx.globalAlpha = 1; ctx.lineWidth = clamp(r.w * 0.035, 2, 4); ctx.strokeStyle = theme.gold; rr(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3, r.w * 0.05); ctx.stroke();
          const R = clamp(r.w * 0.1, 7, 13), x = r.x + r.w - R - r.w * 0.06, y = r.y + R + r.w * 0.06;
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fillStyle = theme.gold; ctx.fill();
          ctx.lineWidth = Math.max(1.6, R * 0.24); ctx.strokeStyle = "#fff"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
          ctx.moveTo(x - R * 0.45, y + R * 0.02); ctx.lineTo(x - R * 0.12, y + R * 0.36); ctx.lineTo(x + R * 0.48, y - R * 0.36); ctx.stroke(); ctx.lineCap = "butt"; ctx.lineJoin = "miter";
        }
        const n = b.owned ? copiesOf(b) : 0;
        if (n > 1 && c.e > 0.4 && r.w >= 30) { // how many you have, gold while a copy is in the binder
          const h = clamp(r.w * 0.13, 12, 24); font(800, h * 0.62); const t = `×${n}`, tw = textW(t) + h * 0.7, x = r.x + r.w * 0.06, y = r.y + r.w * 0.06;
          ctx.globalAlpha = Math.min(1, c.e) * (state.focus ? 1 : 1 - state.dimAll * 0.7);
          rr(x, y, tw, h, h / 2); ctx.fillStyle = isSpare(b) ? theme.gold : "rgb(0 0 0 / .6)"; ctx.fill();
          ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = isSpare(b) ? "#1A1405" : "#fff"; ctx.fillText(t, x + tw / 2, y + h * 0.72);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  if (tbGhosts.length) {
    for (const f of tbGhosts.slice()) {
      const p = clamp((now - f.t0) / f.dur, 0, 1), r = lerpRect(f.from, f.to, ease(p));
      ctx.globalAlpha = 1 - Math.max(0, p - 0.65) / 0.35;
      foilOff = true; drawCardAt(f.c, r, now, false, 6 * (1 - p)); foilOff = false;
      if (p >= 1) tbGhosts.splice(tbGhosts.indexOf(f), 1);
    }
    ctx.globalAlpha = 1; kick();
  }
}
function tbPick(c, on) {
  const b = c.base || c;
  if (!b.owned) { if (on) { tick(2); if (!tbPick.told) { tbPick.told = true; toast("Only cards you have go in the trade binder."); } } return; }
  if (on === tbPicks.has(b)) return;
  if (on) tbPicks.add(b); else tbPicks.delete(b);
  tick(on ? 6 : 3); updateBar(); kick();
}
// Into the trade binder: a copy of each picked card lifts out of its pocket through the top of the screen.
function tbIntoBinder() {
  const list = [...tbPicks]; tbPicks.clear();
  const now = performance.now(), g = state.g;
  list.forEach((b, i) => {
    if (isSpare(b)) { copies[b.id] = copiesOf(b) + 1; persistCopies(); } // already in: another copy
    else spares[b.id] = true;
    const shown = g?.cards.find((x) => (x.base || x) === b);
    if (shown && !reduced) flyCard(shown, true, now + i * 60, 680, null);
  });
  tbMemo.dirty = true; drawList();
  leaveMark();
  const wanted = list.filter((c) => wantedBy(c).length).length;
  tick(14);
  toast(`${plural1(list.length, "card")} into your trade binder.${wanted ? ` ${wanted === list.length && wanted > 1 ? "Someone wants all of them" : `${wanted} ${wanted === 1 ? "is" : "are"} wanted`}.` : ""}`, () => tbOpenFromAnywhere(), "Open");
}
// The card panel's To binder: the button, or the card dragged down onto it.
function tbPut(c, on, { quiet = false } = {}) {
  const b = c.base || c;
  if (!b.owned) return;
  spares[b.id] = on;
  tick(on ? 10 : 5); drawList(); if (state.focus === c) fillPanel(c, 0); kick();
  if (quiet) return;
  if (on) {
    const i = tbList().indexOf(b), who = wantedBy(b);
    toast(`${b.name} is in your trade binder, page ${Math.floor(Math.max(0, i) / 9) + 1}.${who.length ? ` ${names(who)} ${who.length === 1 ? "wants" : "want"} it.` : ""}`, () => tbPut(c, false, { quiet: true }));
  } else toast(`${b.name} is out of your trade binder.`, () => tbPut(c, true, { quiet: true }));
}
const btnTarget = () => { const b = flagBtn.getBoundingClientRect(); return { x: b.x + b.width / 2 - 12, y: b.y + b.height / 2 - 17, w: 24, h: 34 }; };
flagBtn.onclick = () => {
  const c = state.focus; if (!c) return;
  if ((c.base || c).owned) {
    const on = !isSpare(c);
    if (on && !reduced) tbGhosts.push({ c, from: binderRect(c, cam), to: btnTarget(), t0: performance.now(), dur: 460 });
    tbPut(c, on); return;
  }
  chasing[c.id] = !isChase(c); persistChase(); fillPanel(c, 0); tick(5); drawList(); if (lifted) liftLayout(true); kick();
  toast(chasing[c.id] ? `${c.name} on your chase list. Pay up to ${money(capOf(c))}.` : `${c.name} off your chase list.`);
};
const hintEl = panel.querySelector(".hint"), HINT0 = hintEl.textContent;
// Dragging a card you own down out of its close-up carries it to the button; let go over it and a copy goes in.
function fdArm(x, y) {
  fd.a = null;
  const c = state.focus;
  if (!c || !(c.base || c).owned || view !== "set" || marking || tbl.on || bnd.on || state.trans || pop.c || fly || fd.back) return;
  const r = binderRect(c, cam); if (!inR(r, x, y)) return;
  fd.a = { c, x0: x, y0: y, cx: c.x, cy: c.y, sz: c.sz, r0: r, claimed: false, over: false };
}
function fdMove(x, y) {
  const a = fd.a; if (!a) return false;
  const dx = x - a.x0, dy = y - a.y0;
  if (!a.claimed) {
    if (Math.hypot(dx, dy) < 8) return false;
    if (!(dy > 0 && dy > Math.abs(dx) * 1.1)) { fd.a = null; return false; } // sideways or up: the base's flick and leave
    a.claimed = true; gesture = null; cancelPress(); inertia = false; fly = null;
    document.body.classList.add("tbdrag"); tick(5);
  }
  // the card shrinks around the finger as it is pulled down, and stays above the panel's edge (the glass would hide it)
  const top = panel.getBoundingClientRect().top, k = clamp(dy / 150, 0, 1), sz = a.sz * (1 - 0.6 * k);
  const fx = (a.x0 - a.r0.x) / a.r0.w, fy = (a.y0 - a.r0.y) / a.r0.h, w = TW * sz * cam.s, h = TH * sz * cam.s;
  const sy = Math.min(y - fy * h, top - 8 - h);
  a.c.sz = sz; a.c.x = cam.x + (x - fx * w) / cam.s; a.c.y = cam.y + sy / cam.s;
  a.over = k > 0.55 || y > top;
  flagBtn.classList.toggle("drop", a.over);
  kick(); return true;
}
function fdEnd(cancelled) {
  const a = fd.a; fd.a = null; if (!a?.claimed) return false;
  const c = a.c, r = binderRect(c, cam);
  document.body.classList.remove("tbdrag"); flagBtn.classList.remove("drop");
  if (a.over && !cancelled) {
    c.x = a.cx; c.y = a.cy; c.sz = a.sz;
    if (!reduced) tbGhosts.push({ c, from: r, to: btnTarget(), t0: performance.now(), dur: 380 });
    if (isSpare(c)) { const b = c.base || c; copies[b.id] = copiesOf(b) + 1; persistCopies(); tick(10); fillPanel(c, 0); drawList(); toast(`Another ${b.name} in your trade binder.`); }
    else tbPut(c, true);
  } else if (reduced) { c.x = a.cx; c.y = a.cy; c.sz = a.sz; }
  else fd.back = { c, from: { x: c.x, y: c.y, sz: c.sz }, to: { x: a.cx, y: a.cy, sz: a.sz }, t0: performance.now() };
  kick(); return true;
}
document.addEventListener("touchstart", (e) => {
  if (e.target !== canvas || tbl.on || bnd.on) return;
  if (fd.a?.claimed) fdEnd(true);
  if (e.touches.length === 1) fdArm(e.touches[0].clientX, e.touches[0].clientY); else fd.a = null;
}, { capture: true, passive: false });
document.addEventListener("touchmove", (e) => {
  if (!fd.a || e.target !== canvas) return;
  if (e.touches.length !== 1) { if (fd.a.claimed) fdEnd(true); fd.a = null; return; }
  if (fdMove(e.touches[0].clientX, e.touches[0].clientY)) { e.stopImmediatePropagation(); e.preventDefault(); }
}, { capture: true, passive: false });
for (const type of ["touchend", "touchcancel"]) document.addEventListener(type, (e) => { if (!fd.a || e.target !== canvas || e.touches.length) return; if (!fdEnd(type === "touchcancel")) fd.a = null; }, { capture: true, passive: false });
document.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.target === canvas && !tbl.on && !bnd.on) fdArm(e.clientX, e.clientY); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && fd.a && fdMove(e.clientX, e.clientY)) e.stopImmediatePropagation(); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType === "mouse" && fd.a && !fdEnd(type === "pointercancel")) fd.a = null; }, true);

// ----- redefinitions: the base's functions with the binder in them -----
// The Trade lens keeps the wall as a wall (the spares lit where they sit) with the binder's cover and the traders
// on top; Chase still lifts. Copied from 30-layout.js with the trade header added.
let tradeLaid = false;
function layoutAll() {
  lifted = state.lens === "chase"; liftKey = lifted ? state.lens : null;
  tradeLaid = state.lens === "trade";
  for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); }
  groups.forEach(binderLayout);
  const keep = mScroll;
  if (lifted) { newPanel = null; COVER.m = null; liftedLayout(); } else mosaicLayout();
  if (room.on) { if (!caseList().length) { endRoom(); return; } if (room.fan && !inCase(room.fan)) room.fan = null; mScroll = keep; strip = null; roomLayout(); }
  if (bnd.on) { bnd.L = tbGeom(bnd.show); bnd.vi = clamp(bnd.vi, 0, tbViews() - 1); }
}
function mosaicLayout() {
  const R0 = { x: 8, y: topPad(), w: vw - 16 };
  let top = R0.y + shelfLayout(R0); // the shelf first: trophies finished today
  top += tradeTop(R0, top); // in the Trade lens: the binder's cover and the traders
  const live = groups.filter((g) => !g.done);
  const newH = mode === "set" && !picking() ? NEW_H : 0;
  newPanel = null; trophyCase = null;
  const fitH = vh - top - botPad() - newH;
  if (mode === "set" && pickedSets.size && pickedSets.size < sets.length) {
    const mine = live.filter((g) => g.chase || pickedSets.has(g.set.id)), rest = live.filter((g) => g.set && !pickedSets.has(g.set.id));
    const n = mine.reduce((a, g) => a + g.cards.length, 0);
    const R = { x: R0.x, y: top, w: R0.w, h: mine.length ? Math.max(fitH - rest.length * W_FOLD, fitH * 0.62, (n * 340) / (vw - 16)) : 0 };
    const items = mine.map((g) => ({ g, v: Math.max(g.cards.length, 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    if (items.length) stripTreemap(items, R);
    let y = R.y + R.h;
    for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
    if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
    y += caseLayout(R0, y);
    mMax = Math.max(0, y + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    for (const g of mine) packPanel(g);
    for (const g of rest) packFolded(g);
    return;
  }
  const n = live.reduce((a, g) => a + g.cards.length, 0);
  const R = { x: R0.x, y: top, w: R0.w, h: live.length ? Math.max(fitH, (n * 340) / (vw - 16)) : 0 };
  let y = R.y + R.h;
  if (newH) { newPanel = { x: R.x, y, w: R.w, h: newH }; y += newH; }
  y += caseLayout(R0, y);
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  const items = live.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  if (items.length) stripTreemap(items, R);
  for (const g of live) packPanel(g);
}
// Copied from 60-lenses.js: a change of lens is a flight whenever the layout's shape changes (Trade has a header now).
function liftLayout(force = false) {
  const want = state.lens === "chase";
  const same = want === lifted && (!want || state.lens === liftKey) && (state.lens === "trade") === tradeLaid;
  if (same && !(force && lifted)) { layoutAll(); return; }
  if (tbl.on) { layoutAll(); kick(); return; }
  const T = state.trans;
  if (T && !(T.anim || T.t0)) { layoutAll(); return; }
  if (T) finishTransition();
  const now = performance.now();
  if (view === "set" && state.g) {
    const g = state.g;
    if (state.focus) unfocus();
    for (const c of g.cards) { c.px = c.x; c.py = c.y; }
    layoutAll();
    if (!reduced) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.4); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
    tick(8); kick(); return;
  }
  for (const c of drawnCards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  layoutAll();
  for (const c of drawnCards) c.delay = reduced ? 0 : Math.min(400, (c.lift ? 0 : 90) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
// Copied from 60-lenses.js: the Trade lens names the binder.
function setLens(lens) {
  if (lens === state.lens) return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "have") { const n = cards.filter((c) => c.owned).length; toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection`); }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  const news = lens === "chase" && live.news.some((c) => c.deal && isChase(c) && !c.owned);
  if (lens === "chase" && !news) { const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length; toast(n ? `${n} on your chase list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your chase list yet. Open a card and choose Chase it."); }
  if (lens === "trade") { tbMemo.dirty = true; const n = tbList().length; toast(n ? `${plural1(n, "card")} in your trade binder${tbMemo.wanted ? `, ${tbMemo.wanted} someone wants` : ""}` : "Your trade binder is empty. Open a set and tap Mark to pick your doubles."); }
  if (was === "chase") closePop(true);
  if (news) showDealBar(); else hideDealBar();
  liftLayout(); drawList(); updateCount(); kick();
}
// Copied from 40-render.js: in the Trade lens your spares are lit where they sit; marking there, everything you own is.
function emphasis(c) {
  if (c.away) return 0;
  if (c === state.focus) return 1; // the card up close is never dimmed by a lens
  if (preview) return preview.has(c.base || c) ? (c.owned ? 0.42 : 1) : 0.1;
  if (state.matches) return state.matches.has(rootOf(c)) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.1 : 1;
  if (state.lens === "chase") return isChase(c) ? 1 : 0.18;
  if (state.lens === "trade") return marking && view === "set" ? ((c.base || c).owned ? 1 : 0.16) : isSpare(c) ? 1 : 0.18;
  return 1;
}
function panelStat(g) {
  if (picking()) return "  ";
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(rootOf(c))).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
// Copied from 50-navigation.js: Back and the live region know the binder.
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on && !room.on && !bnd.on;
  backBtn.setAttribute("aria-label", bnd.on && !tbl.on && view !== "set" ? "Back to the Trade lens" : room.on && view !== "set" ? "Back to the wall" : "Back to everything");
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : bnd.on ? (bnd.show ? "Trade binder, Show mode" : "Trade binder") : room.on ? "Trophy room" : "";
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); updateCount();
}
// Copied from 50-navigation.js: the cover opens the binder.
function enterGroup(g, { then = null } = {}) {
  if (state.trans) return;
  if (g === COVER) { openBinder(); return; }
  if (g.door) { openRoom(); return; }
  if (g.fan) { toggleFan(g.fan); return; }
  if (g.pick) { openScope(g.pick.g, g.pick.scope); return; }
  hideCaption(); tick(8);
  state.trans = openTrans(g, 0, fitCam(g)); state.trans.then = then;
  settle(1, 720);
}
// Copied from 67-room.js: a spread on the cover reaches here through the door's path.
function openRoom() {
  if (gesture?.g === COVER) { openBinder(); return; }
  if (room.on || state.trans || tbl.on || view !== "mosaic" || !caseList().length) return;
  hideCaption(); cancelPress(); closePop(true); tick(8);
  room.on = true; room.closing = false; room.wallScroll = mScroll; room.fan = null; room.pinch = null; mScroll = 0;
  layoutAll();
  document.body.classList.add("inroom"); setChrome();
  room.q = reduced ? 1 : 0; room.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 520 };
  kick();
}
// Copied from 51-gestures.js: the cover is something to tap or spread on.
function hit(sx, sy, nearest = false) {
  if (state.trans) return null;
  if (view === "mosaic") {
    if (room.on && room.closing) return null;
    if (room.on && room.anim) finishRoomAnim();
    const y = sy + mScroll;
    if (room.on) {
      for (const g of caseList()) {
        if (g.fanR && inR(g.fanR, sx, y)) return { block: g.fanBtn };
        if (g === room.fan) for (const r of fanRows(g)) if (inR(r.m, sx, y)) return { block: r };
        if (inR(g.m, sx, y)) return { block: g };
      }
      if (!nearest) return null;
      let best = null, bd = Infinity;
      for (const g of caseList()) { const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
      return best && bd < 60 ? { block: best } : null;
    }
    if (COVER.m && state.lens === "trade" && inR(COVER.m, sx, y)) return { block: COVER };
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
// Copied from 40-render.js: the binder is a level of its own on the wall's canvas, like the room.
function drawMosaic(now, alpha = 1, except = null) {
  if (bnd.on) { if (tbStep(now)) kick(); if (bnd.on) { tbDraw(now); return; } }
  if (!room.on) { drawWall(now, alpha, except); return; }
  if (stepRoomAnim(now)) kick();
  if (!room.on) { drawWall(now, alpha, except); return; }
  const q = room.q;
  if (q >= 1) { drawRoom(now, alpha, except); return; }
  const keep = mScroll; mScroll = room.wallScroll;
  ctx.save(); ctx.translate(-vw * 0.3 * q, 0); drawWall(now, alpha, null); ctx.restore();
  mScroll = keep;
  ctx.fillStyle = `rgb(0 0 0 / ${(0.45 * q).toFixed(3)})`; ctx.fillRect(0, 0, vw, vh);
  ctx.save(); ctx.translate(vw * (1 - q), 0);
  ctx.shadowColor = "rgb(0 0 0 / .5)"; ctx.shadowBlur = 30; ctx.fillStyle = theme["room-bg"]; ctx.fillRect(0, 0, vw, vh); ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
  drawRoom(now, alpha, except);
  ctx.restore();
  kick();
}
// Copied from 75-trade.js: the cover joins the traders along the top of the Trade lens.
function drawTraders(now) {
  if (view !== "mosaic" || state.lens !== "trade" || room.on || bnd.on) return;
  const T = state.trans;
  let alpha = 1;
  if (T?.kind === "morph") alpha = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1));
  else if (T?.kind === "open") alpha = 1 - T.q;
  else if (T) return;
  if (tbl.on) alpha *= 1 - tbl.q;
  if (alpha <= 0.01) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCover(now, alpha);
  if (strip) for (const ch of strip.chips) drawChip(ch, now, alpha);
}
// Copied from 53-mark.js: in the Trade lens a tap or a sweep picks for the binder instead of marking.
function markCard(c, on) {
  if (binderMark()) { tbPick(c, gesture?.stroke ? on : !tbPicks.has(c.base || c)); return; }
  if (c.owned === on) return;
  if (!session.has(c)) session.set(c, c.owned);
  setOwned(c, on, { quiet: true });
  if (session.get(c) === c.owned) session.delete(c);
  updateBar();
}
function beginStroke(card, p) {
  cancelPress();
  const on = binderMark() ? !tbPicks.has(card.base || card) : !card.owned;
  gesture.stroke = { on, seen: new Set([card]), last: { x: p.x, y: p.y } };
  gesture.moved = true;
  markCard(card, on);
}
const mAll = document.getElementById("m-all"), mDone = document.getElementById("m-done"), undo0 = mUndo.onclick;
function updateBar() {
  const bm = binderMark();
  mAll.hidden = bm;
  if (bm) {
    const n = tbPicks.size;
    mHead.textContent = n ? `${n} picked` : "Pick your doubles";
    mSub.textContent = n ? "A copy of each goes in" : "Tap or sweep your extras";
    mUndo.textContent = "Clear"; mUndo.disabled = !n;
    mDone.textContent = n ? "Into the trade binder" : "Done";
    return;
  }
  mUndo.textContent = "Undo"; mDone.textContent = "Done";
  const t = tally();
  mHead.textContent = t.n ? t.head : "Mark cards";
  mSub.textContent = t.n ? t.sub : "Tap a card, drag across a row, or hold one to chase it";
  mUndo.disabled = !t.n;
}
function leaveMark() {
  if (!marking) return;
  marking = false; document.body.classList.remove("marking"); markBtn.hidden = view !== "set";
  tbPicks.clear(); mAll.hidden = false; mUndo.textContent = "Undo"; mDone.textContent = "Done";
  const t = tally(), changes = [...session]; session.clear();
  if (t.n) toast(`${t.head}.${t.sub ? ` ${t.sub}.` : ""}`, () => revert(changes));
  updateCount(); kick();
}
mUndo.onclick = () => { if (binderMark()) { if (!tbPicks.size) return; tbPicks.clear(); updateBar(); tick(4); kick(); return; } undo0(); };
mDone.onclick = () => { if (binderMark() && tbPicks.size) tbIntoBinder(); else leaveMark(); };
// Copied from 53-mark.js, with the binder's overlay first: the copy count, the picks, the copies flying in.
function drawMarks() {
  tbOverlay(performance.now());
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
// Copied from 64-chase.js: on a card you own the button is the binder; the panel says how many you have.
function updateFlag(c) {
  const b = c.base || c, on = b.owned ? isSpare(b) : isChase(c);
  flagBtn.textContent = b.owned ? (on ? "In binder ✓" : "To binder") : on ? "Chasing ✓" : "Chase it";
  flagBtn.classList.toggle("on", on); flagBtn.setAttribute("aria-pressed", String(on));
  const meta = document.getElementById("p-meta"), n = copiesOf(b);
  meta.textContent = meta.textContent.replace(" You have a spare.", "") + (b.owned && n > 1 ? ` You have ${n}${on ? `, ${n - 1} in your trade binder` : ""}.` : "");
  hintEl.textContent = b.owned ? "Drag the card down onto To binder, or flick it along the set." : HINT0;
}
// Copied from 76-reply.js: a trade gives away a copy. You keep the card while you have another.
function tbGiveCopy(c) {
  const n = copiesOf(c);
  delete spares[c.id];
  if (n > 1) copies[c.id] = n - 1;
  else { copies[c.id] = 1; if (c.owned) setOwned(c, false, { quiet: true }); }
  persistCopies();
}
function completeTrade(rec, t, landAt = 0) {
  const give = toCards(rec.give), get = toCards(rec.get);
  quietLayout = true;
  for (const c of give) { const last = copiesOf(c) <= 1; tbGiveCopy(c); if (landAt && last) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; } }
  for (const c of get) { delete chasing[c.id]; if (!c.owned) { setOwned(c, true, { quiet: true }); copies[c.id] = 1; } if (landAt) { if (c.anim) c.anim.t0 = landAt; if (groups[c.g].ripple) groups[c.g].ripple.t0 = landAt; } }
  quietLayout = false;
  persistCopies(); persistSpares(); persistChase(); syncBadge(); updateCount();
  rec.state = "done"; rec.doneAt = Date.now(); persistTrades(); drawList();
  toast(`${rec.by === "them" ? `${t.name} accepted. ` : ""}${tradedText(get, give, t)}`);
}
function crossOnWall(rec, t) {
  const give = toCards(rec.give).filter((c) => c.owned), get = toCards(rec.get).filter((c) => !c.owned);
  if (reduced || document.body.classList.contains("listmode") || crossing || bnd.on) { completeTrade(rec, t); if (lifted) liftLayout(true); kick(); return; }
  crossing = { rec, t, give, get, n: give.length + get.length };
  const now = performance.now(), step = () => { if (crossing && --crossing.n <= 0) finishCross(); };
  quietLayout = true;
  give.forEach((c, i) => { const last = copiesOf(c) <= 1; tbGiveCopy(c); if (lifted && last) c.away = true; flyCard(c, true, now + i * 80, 720, step); });
  quietLayout = false; persistSpares();
  get.forEach((c, i) => flyCard(c, false, now + 260 + i * 80, 780, () => { quietLayout = true; setOwned(c, true, { quiet: true }); copies[c.id] = 1; persistCopies(); quietLayout = false; delete chasing[c.id]; persistChase(); step(); }));
  if (!crossing.n) finishCross();
}
// Copied from 75-trade.js: from the binder the table opens with the card (or Show mode's picks) already on it, and
// your cards fly out of their pockets.
function openTable(t, from) {
  if (tbl.on || state.trans) return;
  hideCaption(); cancelPress(); closePop(true); hideWho();
  tbl.on = true; tbl.t = t; tbl.q = 0; tbl.give = []; tbl.get = []; tbl.flights = []; tbl.shake = null; tbl.drag = null; tbl.pend = null; tbl.pinch = null;
  tbl.their.sx = 0; tbl.their.v = 0; tbl.your.sx = 0; tbl.your.v = 0;
  tbl.phase = "open"; tbl.rec = null; tbl.note = null; tbl.handed = []; tbl.landing = 0; tbl.settled = false; tbl.done = null;
  threadKey = ""; renderThread(t); tbl.botH = null;
  tbl.L = tableLayout();
  tbl.theirs = t.spares.slice().sort((a, b) => (isChase(b) ? 1 : 0) - (isChase(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.yours = cards.filter(isSpare).sort((a, b) => (t.chaseSet.has(b) ? 1 : 0) - (t.chaseSet.has(a) ? 1 : 0) || b.price - a.price || a.i - b.i);
  tbl.origin = from ? { x: from.x + 11, y: from.y - mScroll + 17, w: 32, h: 32 } : { x: vw / 2 - 18, y: topPad(), w: 36, h: 36 };
  for (const c of tbl.theirs) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; }
  for (const c of tbl.yours) { c.spot = "binder"; c.held = false; c.tcur = null; c.handed = false; c.o = bnd.on ? tbPocketRect(c) || { x: vw / 2 - 16, y: vh + 20, w: 32, h: 45 } : mr(c.m); c.away = true; c.e = 0; }
  const rec = activeOf(t), last = lastOf(t);
  if (rec) {
    tbl.rec = rec;
    for (const c of toCards(rec.get)) if (tbl.theirs.includes(c)) { c.spot = "table"; tbl.get.push(c); }
    for (const c of toCards(rec.give)) { if (!tbl.yours.includes(c)) { tbl.yours.push(c); c.held = false; c.tcur = null; c.handed = false; c.away = true; c.e = 0; c.o = mr(c.m); } c.spot = "table"; tbl.give.push(c); }
    tbl.phase = rec.state === "countered" ? "countered" : "waiting";
    if (rec.state === "proposed") scheduleReply(rec);
  } else {
    if (last?.state === "declined" && last.by === "them" && last.reason) tbl.note = last.reason;
    for (const c of tbPreGive || []) if (tbl.yours.includes(c) && c.spot !== "table") { c.spot = "table"; tbl.give.push(c); }
  }
  tbPreGive = null;
  document.body.classList.add("trading"); setChrome(); updateTradeBar();
  tbl.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 680 };
  if (reduced) tbl.q = 1;
  tick(8); kick();
}
// Copied from 80-welcome.js: the import brings your doubles, and says where they went.
function finishImport(src) {
  if (!wel.on) return;
  const now = performance.now(), chaseAll = wChase.checked;
  let n = 0, k = 0;
  for (const c of pool) {
    if (c.owned || !c.own0) { if (chaseAll && !c.owned) { chasing[c.id] = true; k++; } continue; }
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; n++;
    if (!reduced) c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true };
  }
  persist(); if (chaseAll) persistChase();
  tbImported = true; tbMemo.dirty = true;
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  updateCount(); drawList();
  const sync = syncDone({ quiet: true });
  if (lifted && !sync) liftLayout(true);
  else if (state.lens === "trade") layoutAll();
  tick(14);
  const d = tbList().length;
  setTimeout(() => toast(`${n.toLocaleString()} cards imported from ${src}.${chaseAll ? ` ${k.toLocaleString()} on your chase list.` : ""}${d ? ` ${d} doubles are in your trade binder.` : ""}`, d ? () => tbOpenFromAnywhere() : null, "Open"), reduced ? 100 : 500);
  kick();
}
// Copied from 75-trade.js: the list leads with the binder, in its order.
function tradeListHTML() {
  const now = Date.now(), list = tbList();
  const binderHTML = `<section><h2>Trade binder</h2><p class="lsub">${list.length ? `${plural1(list.length, "card")}, the most wanted first.` : "Empty for now. In the Trade lens, open a set and tap Mark to pick your doubles."}</p><ul>${list.map((c) => {
    const st = sets[c.si], who = wantedBy(c), n = copiesOf(c) - 1;
    return `<li class="lwrow"><div class="lrow"><span class="lname">${esc(c.name)}${n > 1 ? ` ×${n}` : ""}</span><span class="lmeta">${esc(st.name)} #${c.num}, ${c.rname}</span><span class="lprice">${money(c.price)}</span><span class="lstate">${who.length ? `${names(who)} ${who.length === 1 ? "wants" : "want"} it` : "No takers yet"}</span></div><button type="button" class="pill-btn lgot" data-tbout="${c.i}">Take out</button></li>`;
  }).join("")}</ul></section>`;
  const ts = TRADERS.filter((t) => wantsOf(t).length || threadOf(t).length).sort((a, b) => (activeOf(b) ? 1 : 0) - (activeOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length);
  return binderHTML + `<section><h2>Trade with</h2><p class="lsub">Collectors who want something of yours, and what they have that you chase. Each trade is a thread.</p><ul>${ts.map((t) => {
    const want = wantsOf(t), has = offersOf(t), rec = activeOf(t), recs = threadOf(t);
    const thread = recs.length ? `<ul class="lthread">${recs.map((r) => rowsOf(r, t).map((row) => rowHTML(row, t, now, "li")).join("")).join("")}</ul>` : "";
    const acts = rec?.state === "proposed" ? `<button type="button" class="pill-btn" data-back="${recKey(rec)}">Take back</button>`
      : rec?.state === "countered" ? `<button type="button" class="pill-btn primary" data-accept="${recKey(rec)}">Accept</button><button type="button" class="pill-btn" data-decline="${recKey(rec)}">Decline</button>`
      : want.length && has.length ? `<button type="button" class="pill-btn" data-propose="${t.id}">Propose ${want.length} for ${has.length}</button>` : "";
    return `<li class="lwrow ltrade"><div class="lrow"><span class="lname">${t.name}, ${t.where}</span><span class="lmeta">${want.length ? `Wants ${names(want)} (${money(sumOf(want))}).` : "Wants nothing of yours right now."}${has.length ? ` Has ${names(has)} (${money(sumOf(has))}) that you chase.` : " Has nothing you chase."}</span><span class="lprice">${has.length && want.length ? balanceText(has, want, t) : ""}</span><span class="lstate">${chipState(t).text}</span>${thread}${acts ? `<div class="lacts">${acts}</div>` : ""}</div></li>`;
  }).join("")}</ul>${ts.length ? "" : `<p class="lsub">Nobody wants your spares yet.</p>`}</section>`;
}
listEl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tbout]"); if (!b) return;
  const c = pool[Number(b.dataset.tbout)]; if (!c) return;
  spares[c.id] = false; drawList(); tick(5);
  toast(`${c.name} is out of your trade binder.`, () => { spares[c.id] = true; drawList(); });
});
// Copied from 70-chrome.js: the base's own lines about spares (a hold while marking) speak of the binder.
function toast(t, action = null, label = "Undo") {
  t = String(t).replace(/ is a spare, up for trade\.$/, " is in your trade binder.").replace(/ is no longer a spare\.$/, " is out of your trade binder.");
  toastEl.textContent = t;
  if (action) {
    const b = document.createElement("button"); b.textContent = label; b.className = "toast-btn";
    b.onclick = () => { toastEl.classList.remove("show"); action(); };
    toastEl.append(" ", b);
  }
  toastEl.classList.toggle("act", Boolean(action));
  toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), action ? 4500 : 2200);
}
// Reset forgets the copies and the binder too.
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases", "wall-scope", "wall-done", "wall-spares", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value", "wall-copies", "wall-binder"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// Debug builds only: the tests' hook learns about the binder.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { bnd: { get: () => bnd }, tbList: { value: tbList }, copiesOf: { value: copiesOf }, openBinder: { value: openBinder }, closeBinder: { value: closeBinder }, tbEnterShow: { value: tbEnterShow }, tbHandBack: { value: tbHandBack }, tbTurn: { value: tbTurn }, tbPocketRect: { value: tbPocketRect }, COVER: { value: COVER }, tbPicks: { value: tbPicks }, enterMark: { value: enterMark }, setLens: { value: setLens }, focus: { value: focus }, wantedBy: { value: wantedBy }, spares: { get: () => spares } }); }, 0);
