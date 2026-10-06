// ---------- the trade binder (round 17) ----------
// Real collectors keep a trade binder: nine-pocket pages of the cards they'll part with, flipped through across a table
// at a show. Here it holds exactly the cards you have a spare copy of (sparesOf > 0, from the copies model in
// 77-copies.js), most wanted first, each pocket naming who chases it under the card.
//   The cover sits at the top of the Trade lens, above the traders and the lifted spare tiles, with its first page in
//   small. Tap it (or spread on it) and that page grows into the binder: a level of its own like the trophy room. Swipe
//   sideways to turn the page (it folds about the rings under your thumb, then snaps by speed first, distance second).
//   Tap a pocket and the trade table opens with whoever wants it, the card already on it. Back, a pinch or Escape
//   returns to the Trade lens.
//   Show mode turns the binder into a dark, full-screen spread to hand across a table: no chrome, prices shown or
//   hidden, swipe to turn. The other person taps what they'd like. Taking the phone back, Done asks who it was: a trader
//   opens the table with the picks on your side; someone new takes one copy of each (Undo puts them back).
// While the binder is up it owns every touch on the canvas (Touch Events for fingers, pointer events for the mouse),
// like the table. Pages are painted once into the corner of the wall's canvas, copied offscreen and kept, keyed on the
// counts, so a frame in the binder is a handful of drawImage calls.

// ----- what's in it: the cards you have a spare of, most wanted first (then the dearest) -----
const tbMemo = { key: "", list: [], wanted: 0 };
function tbList() {
  const key = `${copiesKey}|${lastFrame}`;
  if (tbMemo.key === key) return tbMemo.list;
  const list = cards.filter((c) => sparesOf(c) > 0).sort(spareOrder);
  tbMemo.key = key; tbMemo.list = list; tbMemo.wanted = list.filter((c) => wantedBy(c).length).length;
  return list;
}
const tbFresh = () => { tbMemo.key = ""; return tbList(); }; // after a change in this same frame
const tbPageCount = () => Math.max(1, Math.ceil(tbList().length / 9));
const plural1 = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ----- geometry: a page is three by three pockets, each a card with a line of small type under it -----
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
  return `${copiesKey}|${G.show}|${G.pw}|${G.ph}|${G.cw}|${G.spread}|${dpr}|${theme.bg}|${theme["panel-solid"]}|${theme.gold}|${bnd.prices}|${i}|${items.map((c) => `${c.id}.${sparesOf(c)}.${c.away ? 1 : 0}.${G.show && bnd.picks.has(c.id) ? 1 : 0}`).join(",")}`;
}
function tbPaint(i, G) {
  const items = tbList().slice(i * 9, i * 9 + 9), show = G.show;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, G.pw + 2, G.ph + 2);
  const fill = show ? SHOW_PAGE : theme["panel-solid"], line = show ? SHOW_LINE : theme["slot-line"], sleeve = show ? SHOW_SLEEVE : theme.slot;
  const muted = show ? SHOW_MUTED : theme.muted;
  rr(0.5, 0.5, G.pw - 1, G.ph - 1, 10); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke();
  const left = tbLeft(G, i), rx = left ? G.pw - G.ring / 2 : G.ring / 2;
  if (!show) for (const f of [0.17, 0.5, 0.83]) { ctx.beginPath(); ctx.arc(rx, G.ph * f, 3.6, 0, Math.PI * 2); ctx.fillStyle = theme.bg; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke(); } // the rings
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
      if (!show && sparesOf(c) >= 2) { // more than one spare in the pocket (in words: on the wall "×3" is how many you have)
        font(800, 11); const t = `${sparesOf(c)} spares`, tw = textW(t) + 12;
        rr(r.x + 5, r.y + 5, tw, 18, 9); ctx.fillStyle = theme.gold; ctx.fill();
        ctx.textAlign = "center"; ctx.fillStyle = theme.dark ? "#171920" : "#fff"; ctx.fillText(t, r.x + 5 + tw / 2, r.y + 18);
      }
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
  if (q < 1) { // opening or closing: the Trade lens is under it, and the page grows out of the cover
    drawWall(now, 1);
    drawCover(now, 1 - q);
    if (strip) for (const ch of strip.chips) drawChip(ch, now, 1 - q);
    ctx.globalAlpha = Math.min(1, q * 1.15); ctx.fillStyle = bg; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1;
  } else if (sq > 0.001) { ctx.fillStyle = bg; ctx.fillRect(0, 0, vw, vh); }
  let S = tbSpreadRect(G);
  if (q < 1 && COVER.grid) S = lerpRect(mr(COVER.grid), S, ease(q));
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
  const n = tbList().length, pages = tbPageCount(), x = G.x0 + 2;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  if (sq < 0.999) {
    ctx.globalAlpha = a * (1 - sq);
    const y = topPad() + 26;
    ctx.fillStyle = theme.ink; font(800, 25, true); ctx.fillText("Trade binder", x, y);
    ctx.fillStyle = theme.muted; font(500, 13);
    ctx.fillText(fitText(n ? `${plural1(n, "card")} on ${plural1(pages, "page")}. ${tbMemo.wanted ? `${tbMemo.wanted} someone wants.` : "Nobody has asked for one yet."}` : "Empty for now. On a card you have, + adds a spare.", vw - x - 12), x, y + 21);
  }
  if (sq > 0.001) {
    ctx.globalAlpha = a * sq;
    const y = safeInsets().top + 40, v = bnd.vi + 1;
    ctx.fillStyle = "#FFFFFF"; font(800, 25, true); ctx.fillText("Trade binder", x, y);
    ctx.fillStyle = SHOW_MUTED; font(500, 13.5);
    ctx.fillText(fitText(`Page ${G.spread === 2 ? (v * 2 > pages ? v * 2 - 1 : `${v * 2 - 1} and ${v * 2}`) : v} of ${pages}. Tap the cards you'd like.`, vw - x - 140), x, y + 21);
  }
  ctx.globalAlpha = 1;
}
// The page (or the spread) in rect S. A turn folds the page about its rings: forward from view a to a + 1 at p, a turn
// back being the same fold played backwards.
function tbPages(G, S, q) {
  const k = S.h / G.ph, pw = G.pw * k, ph = S.h, at = (j) => S.x + j * (G.pw + 4) * k, sp = G.spread;
  const page = (i, x, w, dark = 0) => {
    const img = tbImg(i, G); if (!img || w < 0.5) return;
    ctx.drawImage(img, x, S.y, w, ph);
    if (dark > 0.01) { ctx.globalAlpha = dark; ctx.fillStyle = "#000"; rr(x, S.y, w, ph, 10 * k); ctx.fill(); ctx.globalAlpha = 1; }
  };
  const shadeAt = (x, dir, a) => { // the shadow the lifting page casts on the one under it
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
    shadeAt(at(0) + w, 1, 0.28 * (1 - p));
    page(a, at(0), w, 0.3 * p);
    return;
  }
  const L0 = a * 2, R0 = L0 + 1, L1 = L0 + 2, R1 = L0 + 3, spine = at(0) + pw;
  page(L0, at(0), pw); page(R1, at(1), pw);
  if (p < 0.5) { const w = pw * Math.cos(p * Math.PI); shadeAt(at(1) + w, 1, 0.25 * (1 - p * 2)); page(R0, at(1), w, 0.3 * p * 2); }
  else { const w = pw * -Math.cos(p * Math.PI); shadeAt(spine - w, -1, 0.25 * (p * 2 - 1)); page(L1, spine - w, w, 0.3 * (1 - p) * 2); }
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
// Where a card of yours flies from and back to as the trade table opens and closes: its pocket while the binder is up
// (off the bottom edge if it isn't on this page), else its tile on the wall.
const tbHome = (c) => (bnd.on ? tbPocketRect(c) || { x: vw / 2 - 16, y: vh + 20, w: 32, h: 45 } : mr(c.m));

// ----- the cover at the top of the Trade lens: the binder closed, its first page in small -----
const COVER_H = 140;
const COVER = { tbCover: true, name: "Trade binder", cards: [], lead: [], base: [], m: null, grid: null, G: null };
function coverLayout(R) {
  const G = (COVER.G = tbGeom(false)), gh = COVER_H - PG * 2 - 22, gw = gh * G.pw / G.ph;
  COVER.m = { x: R.x, y: R.y, w: R.w, h: COVER_H };
  COVER.grid = { x: R.x + R.w - PG - 14 - gw, y: R.y + PG + 11, w: gw, h: gh };
  return COVER_H;
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
  ctx.fillText(fitText(n ? (tbMemo.wanted ? `${tbMemo.wanted} someone wants` : "Nobody has asked yet") : "+ on a card adds a spare", tw), tx, y + 70);
  if (n) { ctx.fillStyle = theme.ink; font(700, 13.5); ctx.fillText(fitText("Open the binder  ›", tw), tx, y + h - 16); }
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
  if (!tbFresh().length) { tick(3); cancelPress(); toast("Your trade binder is empty. On a card you have, + adds a spare."); return; } // nothing to leaf through
  hideCaption(); cancelPress(); closePop(true); hideHow(); hideWho(); tick(8);
  Object.assign(bnd, { on: true, closing: false, turn: 0, tAnim: null, pinch: null, drag: null, rest: false, swallow: false, press: null, show: false, sq: 0, sa: null, vi: 0 });
  tbFresh(); bnd.L = tbGeom(false);
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
  bnd.vi = clamp(bnd.vi, 0, tbViews() - 1);
  bnd.sa = reduced ? null : { t0: performance.now(), dur: 380, k: 0, from }; bnd.sq = reduced ? 1 : 0;
  document.body.classList.add("showing"); setChrome(); tbSync(); kick();
}
function tbExitShow() {
  if (!bnd.show) return;
  const from = tbSpreadRect(bnd.L);
  bnd.show = false; bnd.L = tbGeom(false); bnd.turn = 0; bnd.tAnim = null;
  bnd.vi = clamp(bnd.vi, 0, tbViews() - 1);
  bnd.sa = reduced ? null : { t0: performance.now(), dur: 340, k: 0, from }; bnd.sq = reduced ? 0 : 1;
  document.body.classList.remove("showing"); setChrome(); tbSync(); tick(6); kick();
}
// Taking the phone back: who was it? A trader opens the table with the picks on your side; someone new takes them.
function tbHandBack() {
  const picks = tbList().filter((c) => bnd.picks.has(c.id));
  tbExitShow();
  if (!picks.length) return;
  const them = picks.length === 1 ? "it" : "them";
  const rows = TRADERS.map((t) => ({ t, n: picks.filter((c) => t.chaseSet.has(c)).length })).sort((a, b) => b.n - a.n || TRADERS.indexOf(a.t) - TRADERS.indexOf(b.t));
  showWho(`${plural1(picks.length, "card")} picked. Who was it?`, [
    ...rows.map((r) => ({ t: r.t, title: r.t.name, sub: r.n ? `${r.t.where}. Chases ${picks.length === 1 ? "it" : `${r.n} of them`}` : `${r.t.where}. Chases none of ${them}`, go: true })),
    { id: "new", title: "Someone new", sub: `Give ${them} away, one copy each`, go: true },
    { title: "Not now", sub: "Keep the picks for later" },
  ], (r) => {
    if (r.t) { bnd.picks.clear(); tbTrade(r.t, picks); }
    else if (r.id === "new") { bnd.picks.clear(); tbGiveAway(picks); }
  });
}

// ----- trading from a pocket -----
function tbPocketTap(c) {
  const who = wantedBy(c);
  if (!who.length) { tick(3); toast(`Nobody is chasing ${c.name} yet.`); return; }
  if (who.length === 1) { tbTrade(who[0], [c]); return; }
  showWho(`Trade ${c.name} with`, who.map((t) => ({ t, title: t.name, sub: `${t.where}. Wants ${wantsOf(t).length} of yours`, go: true })), (r) => tbTrade(r.t, [c]));
}
// A binder is in person by nature, so the table opens without asking how.
function tbTrade(t, give) {
  if (tbl.on || state.trans) return;
  const had = activeOf(t);
  openTable(t, null, had ? null : give.filter(isSpare));
  if (had) toast(`You have a trade open with ${t.name}. Here it is.`);
}
// Someone new: no trader to open a table with, so the picks are given away the way a done trade gives a card (one copy
// off, or the card out with its last copy). Undo puts the counts and the cards back exactly as they were.
function tbGiveAway(list) {
  if (!list.length) return;
  const was = list.map((c) => ({ c, owned: c.owned, got: c.got, rec: copies[c.id] ? { ...copies[c.id] } : null }));
  quietLayout = true;
  for (const c of list) { if (nOf(c) > 1) setN(c, nOf(c) - 1); else if (c.owned) setOwned(c, false, { quiet: true }); }
  quietLayout = false;
  persistCopies(); tbChanged(); tick(14);
  toast(list.length === 1 ? `Gave ${list[0].name} to someone new.` : `Gave ${list.length} cards to someone new.`, () => {
    quietLayout = true;
    for (const w of was) {
      const c = w.c;
      if (w.owned && !c.owned) { setOwned(c, true, { quiet: true }); c.got = w.got; saved[c.id] = { on: true, at: w.got }; }
      if (w.rec) copies[c.id] = w.rec; else delete copies[c.id];
    }
    quietLayout = false;
    copiesKey++; persist(); persistCopies(); tbChanged(); tick(6);
  });
}
// The counts changed under the binder: the pages, the bar, the wall beneath and the list follow.
function tbChanged() { tbFresh(); syncBadge(); updateCount(); drawList(); relayoutSoon(); if (bnd.on) { bnd.vi = clamp(bnd.vi, 0, tbViews() - 1); tbSync(); } kick(); }

// ----- who: a small menu over the bar (who wants a pocket, or who was across the table) -----
const whoEl = document.createElement("div");
whoEl.className = "arrange-menu tradehow glass tbwho"; whoEl.id = "tb-who"; whoEl.setAttribute("role", "menu"); whoEl.hidden = true;
document.body.append(whoEl);
let whoPick = null, whoClosed = 0;
function showWho(head, rows, pick) {
  whoEl.innerHTML = `<p class="th-head">${esc(head)}</p>${rows.map((r, i) => `<button role="menuitem" data-w="${i}"><span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span><span class="tick" aria-hidden="true">${r.go ? "›" : ""}</span></button>`).join("")}`;
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
  const n = tbList().length, G = bnd.L, pages = tbPageCount(), v = bnd.vi + 1, k = bnd.picks.size;
  bbHead.textContent = n ? (G?.spread === 2 ? (v * 2 > pages ? `Page ${v * 2 - 1} of ${pages}` : `Pages ${v * 2 - 1} and ${v * 2} of ${pages}`) : `Page ${v} of ${pages}`) : "Nothing in it yet";
  bbSub.textContent = n ? "Most wanted first. Tap a card to trade it." : "On a card you have, + adds a spare";
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
  bnd.drag = { x: p.x, y: p.y, t: now, axis: null, samples: [{ x: p.x, y: p.y, t: now }], turn0: 0 };
  const h = tbPocketAt(p.x, p.y);
  if (h) { bnd.press = h.c; kick(); }
}
function bMove(pts) {
  if (bnd.swallow) return;
  if (bnd.pinch) { if (pts.length >= 2) bPinchMove(pts); return; }
  if (pts.length >= 2) { if (bnd.show) return; bnd.drag = null; bnd.press = null; return bPinchStart(pts); }
  const d = bnd.drag, p = pts[0]; if (!d || !p) return;
  const now = performance.now();
  d.samples.push({ x: p.x, y: p.y, t: now }); if (d.samples.length > 8) d.samples.shift();
  const dx = p.x - d.x, dy = p.y - d.y;
  if (!d.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    bnd.press = null;
    d.axis = Math.abs(dx) > Math.abs(dy) * 0.8 ? "x" : "y"; d.turn0 = bnd.turn;
  }
  if (d.axis !== "x" || bnd.q < 1) { kick(); return; }
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
  if (cancelled) { if (bnd.turn) tbTurnTo(0); kick(); return; }
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
function bPinchStart(pts) {
  if (bnd.show) return; // across the table a pinch does nothing: the other person can't close it by accident
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
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!bnd.on || tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (type === "touchstart") bDown(touchPts(e.touches));
  else if (type === "touchmove") bMove(touchPts(e.touches));
  else bUp(touchPts(e.touches), type === "touchcancel");
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
// Escape or Backspace closes it (in Show mode, it's the hand-back); the arrows turn the page; the wall's keys wait.
document.addEventListener("keydown", (e) => {
  if (!bnd.on || tbl.on || document.activeElement === qIn) return;
  if (e.key === "Escape" || e.key === "Backspace") { if (!whoEl.hidden) return; e.preventDefault(); e.stopImmediatePropagation(); if (bnd.show) tbHandBack(); else closeBinder(); }
  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); tbTurn(e.key === "ArrowRight" ? 1 : -1); }
  else if (e.target === canvas) e.stopImmediatePropagation();
}, true);
// The binder steps aside for anything that navigates the wall: a lens, a search, the list.
lensBox.addEventListener("click", () => { if (bnd.on) closeBinder(true); }, true);
qIn.addEventListener("input", () => { if (bnd.on) closeBinder(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (bnd.on) closeBinder(true); }, true);
// From anywhere (the import's toast): out of the set, into the Trade lens, then the binder.
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

// Debug builds only: the tests' hook learns about the binder.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { bnd: { get: () => bnd }, tbList: { value: tbList }, openBinder: { value: openBinder }, closeBinder: { value: closeBinder }, tbEnterShow: { value: tbEnterShow }, tbHandBack: { value: tbHandBack }, tbTurn: { value: tbTurn }, tbPocketRect: { value: tbPocketRect }, tbGiveAway: { value: tbGiveAway }, COVER: { value: COVER }, wantedBy: { value: wantedBy } }); }, 0);
