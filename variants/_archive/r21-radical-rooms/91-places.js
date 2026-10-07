// ---------- rooms, part two: the cards on the map, the Feed and the Source (round 21, radical) ----------
// Every room's card is a picture of its live state, painted once into an offscreen image and kept until what it shows
// changes (a find, a count, the theme), so the map and a held pinch into it are a few drawImage calls. What moves on
// a card is drawn over its picture each frame: the Feed's newest listing sliding in, the Source's clock and pulse,
// the Chase card's thumbnail flashing where a deal landed.

// ----- where it looks (made up for the demo, seeded by card id) -----
const SRC = [
  { id: "ebay", name: "eBay", chip: "eBay", group: "Marketplaces", w: 0.5, desc: "Every card you chase, and your favourite sellers' newest listings" },
  { id: "tcgplayer", name: "TCGplayer lowest listing", chip: "TCGplayer", group: "Marketplaces", w: 0.2, desc: "The cheapest copy on TCGplayer, when it beats market by 15% or more" },
  { id: "reddit", name: "Reddit trade posts", chip: "Reddit", group: "Marketplaces", w: 0.1, desc: "New [H] posts on the card trading subreddits, read line by line" },
  { id: "local", name: "Local listings", chip: "Local", group: "Marketplaces", w: 0.05, desc: "Garage sales and for-sale posts near you" },
  { id: "shop-a", name: "Northside Cards", chip: "Shops", group: "Card shops", w: 0.08, desc: "Reading their product feed, 214 Pokémon items" },
  { id: "shop-b", name: "Sleeve & Binder Co.", chip: "Shops", group: "Card shops", w: 0.07, desc: "Watching their site for new links" },
];
const SRC_BY = new Map(SRC.map((s) => [s.id, s]));
const srcState = { off: new Set(), alerts: false, ver: 0 };
try { const s = JSON.parse(localStorage.getItem("wall-sources-off") || "null"); if (s) { srcState.off = new Set(s.off || []); srcState.alerts = Boolean(s.alerts); } } catch { /* fresh */ }
const saveSources = () => { srcState.ver++; try { localStorage.setItem("wall-sources-off", JSON.stringify({ off: [...srcState.off], alerts: srcState.alerts })); } catch { /* private mode */ } };
function srcOf(c) {
  let r = h32(`${c.id}|src`), acc = 0;
  for (const s of SRC) { acc += s.w; if (r < acc) return s.id; }
  return "ebay";
}
const srcOn = (id) => !srcState.off.has(id);
// production's deal score, made up from how far under market and how rare
const dealScore = (c) => clamp(Math.round(38 + dealPct(c) * 1.05 + (c.tier || 0) * 3), 1, 99);
const isNewFind = (c) => (c.dealAt || 0) > map.seenAt;
map.seenAt = 0; map.scan.last = Date.now(); map.scan.next = map.scan.last + 6000; map.feedN = 0;

// The Feed's listings (a deal on a card you chase, from a source that's on), newest first, and the cards still looked for.
let feedMemo = { key: "", v: null };
function feedData() {
  const key = `${lastFrame}|${map.feedN}|${srcState.ver}|${map.wallVer}|${copiesKey}`;
  if (feedMemo.key === key) return feedMemo.v;
  const list = [], watching = [], counts = {};
  let chased = 0;
  for (const c of cards) {
    if (!isChase(c)) continue;
    chased++;
    if (c.deal && c.dealAt) { const s = srcOf(c); counts[s] = (counts[s] || 0) + 1; if (srcOn(s)) { list.push(c); continue; } }
    watching.push(c);
  }
  list.sort((a, b) => b.dealAt - a.dealAt);
  watching.sort((a, b) => a.si - b.si || b.price - a.price);
  const v = { list, watching, counts, chased, fresh: list.filter(isNewFind).length };
  feedMemo = { key, v };
  return v;
}
function feedSeen() { map.seenAt = Date.now(); map.feedN++; }

// ----- small helpers -----
const lineCache = new Map();
function wrapLines(t, max, n) {
  const key = `${curFont}|${Math.round(max)}|${n}|${t}`;
  let v = lineCache.get(key); if (v) return v;
  v = []; let cur = "";
  for (const wd of t.split(" ")) {
    const nx = cur ? `${cur} ${wd}` : wd;
    if (!cur || ctx.measureText(nx).width <= max) cur = nx; else { v.push(cur); cur = wd; }
  }
  if (cur) v.push(cur);
  if (v.length > n) { const rest = v.slice(n - 1).join(" "); v.length = n - 1; v.push(fitText(rest, max)); }
  if (lineCache.size > 800) lineCache.clear();
  lineCache.set(key, v); return v;
}
function pill(text, x, y, fill, ink, right = true) { // a small rounded tag; x is its right edge when `right`
  font(800, 10); const w = textW(text) + 12, px = right ? x - w : x;
  rr(px, y, w, 17, 8.5); ctx.fillStyle = fill; ctx.fill();
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = ink; ctx.fillText(text, px + w / 2, y + 12.5); ctx.textAlign = "left";
  return w;
}
const plainInk = () => (theme.dark ? "#10131A" : "#FFFFFF");
function drawSwitch(x, y, on, a = 1) { // production's switch: a pill with a knob
  ctx.globalAlpha = a; rr(x, y, 44, 26, 13); ctx.fillStyle = on ? theme["c-blue"] : theme.slot; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = on ? theme["c-blue"] : theme["slot-line"]; ctx.stroke();
  ctx.beginPath(); ctx.arc(on ? x + 31 : x + 13, y + 13, 10, 0, Math.PI * 2); ctx.fillStyle = on ? plainInk() : theme["panel-solid"]; ctx.fill();
  if (!on) { ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// ----- painting a card once (on the wall's canvas, at its corner, then copied offscreen and kept) -----
const baked = new Map();
function bake(id, key, w, h, paint) {
  const had = baked.get(id);
  if (had?.key === key) return had;
  const W = Math.max(1, Math.ceil(w * dpr)), H = Math.max(1, Math.ceil(h * dpr));
  let cv = had?.cv; if (!cv || cv.width !== W || cv.height !== H) { cv = document.createElement("canvas"); cv.width = W; cv.height = H; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w + 2, h + 2);
  const extra = paint(w, h) || null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = "left";
  const x = cv.getContext("2d"); x.clearRect(0, 0, W, H); x.drawImage(canvas, 0, 0, W, H, 0, 0, W, H);
  const v = { key, cv, w, h, extra }; baked.set(id, v); return v;
}
function cardFrame(id, w, h, fill = theme["panel-solid"]) {
  rr(0.5, 0.5, w - 1, h - 1, 14); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = id === "medal" ? "rgb(255 220 170 / .16)" : theme["slot-line"]; ctx.stroke();
  ctx.save(); rr(0.5, 0.5, w - 1, h - 1, 14); ctx.clip(); ctx.fillStyle = theme[ROOM_COL[id]]; ctx.fillRect(0, 0, w, 4); ctx.restore(); // the room's colour along its top, as production's tabs do
}
function cardTitle(id, w, right = "", ink = theme.ink, muted = theme.muted) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "right"; font(600, 12.5); ctx.fillStyle = muted;
  const rw = right ? textW(right) : 0; if (right) ctx.fillText(right, w - 14, 29);
  ctx.textAlign = "left"; ctx.fillStyle = ink; font(800, 19, true); ctx.fillText(fitText(ROOM_NAME[id], w - 28 - rw - 8), 14, 30);
}
// Each card's key: what it shows, so it is painted again only when that changes.
function cardKey(id, w, h) {
  const base = `${Math.round(w)}|${Math.round(h)}|${dpr}|${theme.bg}|${theme.dark ? 1 : 0}`;
  if (id === "feed") { const F = feedData(), now = Date.now(); return `${base}|${F.chased}|${F.fresh}|${F.list.length}|${F.list.slice(0, 4).map((c) => `${c.id}.${c.deal}.${isNewFind(c) ? 1 : 0}.${agoText(c.dealAt, now)}`).join(",")}`; }
  if (id === "trade") { const l = tbList(); return `${base}|${copiesKey}|${l.length}|${tbMemo.wanted}|${l.slice(0, 9).map((c) => c.id).join(",")}|${trades.length}`; }
  if (id === "medal") { const L = medalList(); return `${base}|${L.sig}|${mdVer}|${theme["m-surface"]}`; }
  if (id === "source") { const F = feedData(), f = map.found[0]; return `${base}|${srcState.ver}|${srcState.alerts}|${SRC.map((s) => F.counts[s.id] || 0).join(",")}|${F.chased}|${f ? `${f.c.id}${f.price}${agoText(f.at, Date.now())}` : ""}`; }
  return base;
}
function prepCards() {
  const L = mapLayout();
  for (const id of ["feed", "trade", "medal", "source"]) { const r = L.r[id]; bake(id, cardKey(id, r.w, r.h), r.w, r.h, (w, h) => PAINT[id](w, h)); }
}
const PAINT = {
  feed(w, h) {
    cardFrame("feed", w, h);
    const F = feedData(), n = F.list.length;
    cardTitle("feed", w, n ? (F.fresh ? `${F.fresh} new · ${plural1(n, "listing")}` : plural1(n, "listing")) : F.chased ? "Looking" : "");
    if (F.fresh) { font(600, 12.5); const t = `${F.fresh} new`; ctx.textAlign = "right"; ctx.fillStyle = theme["c-blue"]; const all = F.fresh ? `${F.fresh} new · ${plural1(n, "listing")}` : ""; ctx.fillText(t, w - 14 - textW(all) + textW(t), 29); ctx.textAlign = "left"; }
    const y0 = 42, th = h - y0 - 12, tw = Math.min(176, Math.max(150, th * 1.75)), step = tw + 8;
    if (!n) {
      ctx.fillStyle = theme.muted; font(500, 13.5);
      const lines = wrapLines(F.chased ? `Looking for the ${plural1(F.chased, "card")} you chase. A listing under market lands here the moment it's found.` : "Chase a card and its listings land here, newest first, with how good a deal each one is.", w - 28, 3);
      lines.forEach((l, i) => ctx.fillText(l, 14, y0 + 20 + i * 19));
      return { step, y0, th, tw };
    }
    const now = performance.now();
    for (let i = 0; i < F.list.length && 12 + i * step < w; i++) feedChip(F.list[i], 12 + i * step, y0, tw, th, now);
    return { step, y0, th, tw };
  },
  trade(w, h) {
    cardFrame("trade", w, h);
    const list = tbList(), n = list.length, pages = tbPageCount();
    cardTitle("trade", w);
    // the binder's first page, small: the thing that grows into the binder when you go in
    const G = COVER.G || tbGeom(false), gh = clamp(h - 126, 56, 140), gw = gh * G.pw / G.ph, gx = Math.round((w - gw) / 2), gy = 44, k = gw / G.pw;
    rr(gx, gy, gw, gh, 5); ctx.fillStyle = theme.slot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
    ctx.fillStyle = theme[ROOM_COL.trade]; rr(gx + 3, gy + 8, 2.5, gh - 16, 1.2); ctx.fill(); // the spine
    for (let i = 0; i < 9; i++) {
      const p = tbPocket(G, 0, i), px = gx + p.x * k, py = gy + p.y * k, pw = p.w * k, ph = p.h * k, c = list[i];
      if (!c) { ctx.fillStyle = theme.bg; ctx.fillRect(px, py, pw, ph); continue; }
      const col = typeColor(c);
      ctx.fillStyle = col; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = lighter(col); ctx.fillRect(px + 1, py + 1, pw - 2, ph * 0.22);
      ctx.fillStyle = theme.paper; ctx.fillRect(px + 1, py + ph * 0.76, pw - 2, ph * 0.2);
    }
    const tx = 14, ty = gy + gh + 23;
    ctx.textAlign = "left"; ctx.fillStyle = theme.ink; font(700, 15, true);
    ctx.fillText(fitText(n ? plural1(n, "spare") : "Your trade binder", w - 28), tx, ty);
    font(600, 12.5); ctx.fillStyle = n && tbMemo.wanted ? theme.gold : theme.muted;
    ctx.fillText(fitText(n ? (tbMemo.wanted ? `${tbMemo.wanted} someone wants` : "Nobody has asked yet") : "Empty for now", w - 28), tx, ty + 18);
    const open = trades.filter((r) => r.state === "proposed" || r.state === "countered");
    ctx.fillStyle = open.length ? theme[ROOM_COL.trade] : theme.muted; font(open.length ? 600 : 500, 12);
    if (ty + 35 < h - 4) ctx.fillText(fitText(open.length ? `${plural1(open.length, "trade")} waiting` : n ? `On ${plural1(pages, "page")}` : "+ on a card adds one", w - 28), tx, ty + 35);
  },
  medal(w, h) {
    cardFrame("medal", w, h, theme["room-bg"]);
    const L = medalList(), E = L.earned;
    cardTitle("medal", w, `${E.length} of ${L.list.length}`, theme["room-ink"], theme["room-muted"]);
    // a shelf with the rarest you've earned standing on it (or the next one, greyed)
    const mw = clamp((w - 28) / 3.3, 30, 44), n = Math.max(1, Math.min(E.length, Math.floor((w - 20) / (mw + 6)))), sy = 50 + mw * 1.24 + 2;
    ctx.fillStyle = theme["room-wood"]; ctx.fillRect(10, sy, w - 20, 7); ctx.fillStyle = theme["room-wood-hi"]; ctx.fillRect(10, sy, w - 20, 1.2);
    const next = L.list.filter((t) => !t.earned && t.goal > 1).map((t) => ({ t, left: t.goal - t.have, frac: t.have / t.goal })).filter((x) => x.left > 0).sort((a, b) => b.frac - a.frac || a.left - b.left)[0];
    if (E.length) { const span = n * mw + (n - 1) * 6, x0 = (w - span) / 2 + mw / 2; for (let i = 0; i < n; i++) drawMedal(ctx, E[i], x0 + i * (mw + 6), 48, mw); }
    else if (next) drawMedal(ctx, next.t, w / 2, 48, mw, "locked");
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let y = sy + 30;
    ctx.fillStyle = theme["room-ink"]; font(700, 13.5, true);
    const head = E.length ? (E[0].rank ? `${MD_RANK[E[0].rank]}: ${E[0].name}` : `Latest: ${E[0].name}`) : "No trophies yet";
    ctx.fillText(fitText(E.length ? `${E[0].name}` : head, w - 28), 14, y);
    ctx.fillStyle = theme["room-muted"]; font(500, 12);
    const sub = E.length ? (E[0].rank ? `${MD_RANK[E[0].rank]}, your rarest` : "Your rarest") : "Fill a set to earn one";
    y += 17; ctx.fillText(fitText(sub, w - 28), 14, y);
    if (next && y + 38 < h) {
      y += 24; ctx.fillStyle = theme["room-plaque"]; font(700, 12.5, true);
      wrapLines(`Next: ${next.t.name}, ${next.left} to go`, w - 28, 2).forEach((l, i) => ctx.fillText(l, 14, y + i * 16));
    }
  },
  source(w, h) {
    cardFrame("source", w, h);
    const F = feedData();
    cardTitle("source", w); // its clock is drawn live, on top
    const chips = [];
    const groups0 = [["ebay"], ["tcgplayer"], ["reddit"], ["local"], ["shop-a", "shop-b"]];
    let x = 14, y = 42;
    font(600, 13);
    for (const ids of groups0) {
      const s = SRC_BY.get(ids[0]), on = ids.some(srcOn), n = ids.reduce((a, id) => a + (srcOn(id) ? F.counts[id] || 0 : 0), 0);
      const label = s.chip, cnt = on ? String(n) : "off", cw = 30 + textW(label) + textW(cnt);
      if (x + cw > w - 12) { x = 14; y += 34; }
      chips.push({ ids, x, y, w: cw, h: 28, label, cnt, on });
      x += cw + 6;
    }
    { const label = "Alerts", cnt = srcState.alerts ? "on" : "off", cw = 30 + textW(label) + textW(cnt); if (x + cw > w - 12) { x = 14; y += 34; } chips.push({ ids: ["alerts"], x, y, w: cw, h: 28, label, cnt, on: srcState.alerts }); }
    for (const c of chips) {
      rr(c.x, c.y, c.w, c.h, 9); ctx.fillStyle = theme.slot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x + 12, c.y + 14, 3.5, 0, Math.PI * 2); ctx.fillStyle = c.on ? theme.deal : theme["slot-line"]; ctx.fill();
      font(600, 13); ctx.textAlign = "left"; ctx.fillStyle = c.on ? theme.ink : theme.muted; ctx.fillText(c.label, c.x + 21, c.y + 18.5);
      ctx.fillStyle = theme.muted; ctx.fillText(c.cnt, c.x + 25 + textW(c.label), c.y + 18.5);
    }
    const f = map.found[0];
    if (f && h - (y + 28) > 60) { ctx.fillStyle = theme.ink; font(600, 12.5); ctx.fillText(fitText(`Latest: ${f.c.name} ${short(f.price)} from ${SRC_BY.get(f.src).name}, ${agoText(f.at, Date.now())}`, w - 28), 14, y + 28 + 26); }
    if (y + 28 + 24 <= h) { ctx.fillStyle = theme.muted; font(500, 12.5); ctx.fillText(fitText(F.chased ? `Looking for ${plural1(F.chased, "card")} you chase` : "Chase a card and it starts looking", w - 28), 14, h - 13); }
    return { chips };
  },
};
// A listing on the Feed's card: the card, the asking price, how far under, where and when.
function feedChip(c, x, y, w, h, now) {
  rr(x, y, w, h, 10); ctx.fillStyle = dealTint(); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme.deal; ctx.stroke();
  const ch = h - 14, cw = ch * TW / TH;
  foilOff = true; cardFace(c, x + 7, y + 7, cw, ch, now, false); foilOff = false;
  ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tx = x + 7 + cw + 8, tw = x + w - 8 - tx;
  ctx.fillStyle = theme.deal; font(800, 16.5); ctx.fillText(fitText(short(c.deal), tw), tx, y + 23);
  font(700, 11.5); ctx.fillText(fitText(`${dealPct(c)}% under`, tw), tx, y + 38);
  ctx.fillStyle = theme.ink; font(700, 12.5, true); ctx.fillText(fitText(c.name, tw), tx, y + h - 22);
  ctx.fillStyle = theme.muted; font(500, 10.5); ctx.fillText(fitText(`${SRC_BY.get(srcOf(c)).chip} · ${agoText(c.dealAt, Date.now())}`, tw), tx, y + h - 8);
  if (isNewFind(c)) pill("NEW", x + w - 6, y + 6, theme["c-blue"], plainInk());
}

// ----- a card on the map: its picture, and what moves on it -----
function drawCard(id, r, now, a) {
  if (id === "chase") return drawChaseCard(r, now, a);
  const b = baked.get(id); if (!b) return false;
  const k = r.w / b.w;
  ctx.globalAlpha = a;
  let more = false;
  if (id === "feed" && map.feedIn && b.extra && !reduced) { // the newest listing slides in from the left, the others making room
    const p = clamp((now - map.feedIn.t0) / 650, 0, 1), e = 1 - Math.pow(1 - p, 3), E = b.extra;
    if (p < 1) {
      more = true;
      ctx.drawImage(b.cv, r.x, r.y, r.w, r.h); // the card stays put; inside its edges the strip moves
      const bx = r.x + 6 * k, by = r.y + (E.y0 - 4) * k, bw = r.w - 12 * k, bh = r.h - (E.y0 - 4) * k - 8 * k;
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(bx, by, bw, bh);
      const sx = Math.round(6 * dpr), sy = Math.round((E.y0 - 4) * dpr), sw = b.cv.width - sx * 2, sh = b.cv.height - sy - Math.round(8 * dpr); // inside the card's edges only
      ctx.drawImage(b.cv, sx, sy, sw, sh, bx - E.step * k * (1 - e), by, bw, bh);
      ctx.restore();
      ctx.globalAlpha = a * (1 - p); ctx.lineWidth = 2; ctx.strokeStyle = theme.deal; const g = 4 + 8 * p;
      rr(r.x + (12 - g) * k, r.y + (E.y0 - g) * k, (E.tw + g * 2) * k, (E.th + g * 2) * k, 12 + g); ctx.stroke();
    } else { map.feedIn = null; ctx.drawImage(b.cv, r.x, r.y, r.w, r.h); }
  } else ctx.drawImage(b.cv, r.x, r.y, r.w, r.h);
  if (id === "source") { // its clock, and a pulse on the source that just found something
    const s = map.scan, t = Date.now(), ago = Math.max(0, Math.round((t - s.last) / 1000)), left = Math.max(0, Math.round((s.next - t) / 1000));
    ctx.globalAlpha = a; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.muted; font(600, 12.5);
    ctx.fillText(feedData().chased ? (left ? `Looked ${ago}s ago · next in ${left}s` : "Looking now") : "Waiting for a chase", r.x + (r.w - 14) * k, r.y + 29 * k);
    ctx.textAlign = "left";
    const P = map.pulse;
    if (P && b.extra) {
      const p = (now - P.t0) / 1600, sid = srcOf(P.c), chip = b.extra.chips.find((c) => c.ids.includes(sid));
      if (p >= 1 || !chip || !srcOn(sid)) { if (p >= 1) map.pulse = null; }
      else {
        more = true;
        const cx = r.x + chip.x * k, cy = r.y + chip.y * k, cw = chip.w * k, chh = chip.h * k, g = reduced ? 3 : 3 + 12 * p;
        ctx.globalAlpha = a * (reduced ? 1 : 1 - p); ctx.lineWidth = 2; ctx.strokeStyle = theme[ROOM_COL.source];
        rr(cx - g, cy - g, cw + g * 2, chh + g * 2, 9 + g); ctx.stroke();
        ctx.globalAlpha = a * Math.min(1, (1 - p) * 2); ctx.fillStyle = theme.deal; font(800, 12); ctx.fillText("+1", cx + cw + 6, cy + chh / 2 + 4 - (reduced ? 0 : 8 * p));
      }
    }
  }
  ctx.globalAlpha = 1;
  return more;
}
// The Chase card: the wall itself, as a picture of what you left, with its count and lens.
function drawChaseCard(r, now, a) {
  const L = mapLayout(), snap = map.wall;
  ctx.globalAlpha = a; rr(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 14); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  const A = L.r.chase, kx0 = r.w / A.w, ky0 = r.h / A.h, D = { x: r.x + (L.thumb.x - A.x) * kx0, y: r.y + (L.thumb.y - A.y) * ky0, w: L.thumb.w * kx0, h: L.thumb.h * ky0 };
  if (snap) { ctx.save(); rr(D.x, D.y, D.w, D.h, 6); ctx.clip(); ctx.fillStyle = theme.bg; ctx.fillRect(D.x, D.y, D.w, D.h); ctx.drawImage(snapFor(snap, D.w), D.x, D.y, D.w, D.h); ctx.restore(); }
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; rr(D.x, D.y, D.w, D.h, 6); ctx.stroke();
  chaseChrome(r, now, a);
  // a deal landing on the wall flashes in the picture, where its tile is
  let more = false;
  const P = map.pulse;
  if (P && snap && P.c.m && !room.on && !bnd.on) {
    const p = (now - P.t0) / 1400;
    if (p < 1) {
      const S = snap.S, kx = D.w / S.w, ky = D.h / S.h, tx = D.x + (P.c.m.x - S.x) * kx, ty = D.y + (P.c.m.y - mScroll - S.y) * ky;
      if (ty > D.y - 4 && ty < D.y + D.h + 4) {
        more = true; const g = reduced ? 4 : 3 + 10 * p, tw = Math.max(3, P.c.m.w * kx), th = Math.max(4, P.c.m.h * ky);
        ctx.globalAlpha = a * (reduced ? 1 : 1 - p); ctx.fillStyle = theme.deal; ctx.fillRect(tx, ty, tw, th);
        ctx.lineWidth = 2; ctx.strokeStyle = theme.deal; ctx.beginPath(); ctx.arc(tx + tw / 2, ty + th / 2, g + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  return more;
}
function chaseChrome(R, now, a) {
  ctx.globalAlpha = a;
  ctx.save(); rr(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 14); ctx.clip(); ctx.fillStyle = theme[ROOM_COL.chase]; ctx.fillRect(R.x, R.y, R.w, 4); ctx.restore();
  const n = cards.filter((c) => c.owned).length, right = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "right"; ctx.fillStyle = theme.muted; font(600, 12.5); ctx.fillText(right, R.x + R.w - 14, R.y + 29);
  const rw = textW(right);
  ctx.textAlign = "left"; ctx.fillStyle = theme.ink; font(800, 19, true); ctx.fillText(fitText("Chase", R.w - 36 - rw), R.x + 14, R.y + 30);
  // the lens bar, small: the lenses live inside Chase, and this is the one the wall is in
  const bh = 28, bx = R.x + 12, bw = R.w - 24, by = R.y + R.h - 12 - bh, sw = bw / 4, d = live.badgeN;
  rr(bx, by, bw, bh, 9); ctx.fillStyle = theme.slot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  font(600, 12); ctx.textAlign = "center";
  [["have", "Have"], ["need", "Need"], ["chase", "Chase"], ["trade", "Trade"]].forEach(([k, label], i) => {
    const on = state.lens === k, cx = bx + i * sw;
    if (on) { rr(cx + 2.5, by + 2.5, sw - 5, bh - 5, 7); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
    ctx.fillStyle = on ? theme.ink : theme.muted; ctx.fillText(fitText(label, sw - 4), cx + sw / 2, by + 18.5);
    if (k === "chase" && d) { const t = d > 99 ? "99+" : String(d); font(800, 9.5); const pw = Math.max(15, textW(t) + 8); rr(cx + sw - pw + 2, by - 6, pw, 15, 7.5); ctx.fillStyle = theme.deal; ctx.fill(); ctx.fillStyle = plainInk(); ctx.fillText(t, cx + sw - pw / 2 + 2, by + 4.5); font(600, 12); }
  });
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}

// A listing in the Feed: the card, the asking price and how far under market, what it is; where, when and its score.
function feedRow(c, x, y, w, h, a, now) {
  const st = sets[c.si];
  ctx.globalAlpha = a;
  rr(x, y, w, h, 12); ctx.fillStyle = dealTint(); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = theme.deal; ctx.stroke();
  const ch = h - 22, cw = ch * TW / TH;
  foilOff = true; cardFace(c, x + 11, y + 11, cw, ch, now, false); foilOff = false;
  ctx.globalAlpha = a; ctx.textBaseline = "alphabetic";
  const rx = x + w - 12, rw = Math.min(130, w * 0.34), tx = x + 11 + cw + 12, tw = rx - rw - 8 - tx;
  ctx.textAlign = "left"; ctx.fillStyle = theme.deal; font(800, 23); const price = short(c.deal); ctx.fillText(price, tx, y + 34);
  { const pw = textW(price); font(600, 12.5); const old = c.dealWas ? short(c.dealWas) : `was ${short(c.price)}`, ow = textW(old); if (pw + 8 + ow < tw) { ctx.fillStyle = theme.muted; ctx.fillText(old, tx + pw + 8, y + 34); if (c.dealWas) ctx.fillRect(tx + pw + 8, y + 29.5, ow, 1); } } // a drop strikes the old asking price; else what it's worth
  ctx.fillStyle = theme.deal; font(700, 13); ctx.fillText(fitText(`${dealPct(c)}% under market`, tw), tx, y + 53);
  ctx.fillStyle = theme.ink; font(700, 16, true); ctx.fillText(fitText(c.name, tw), tx, y + h - 30);
  ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText(fitText(`${st.name} ${c.num}/${st.printed}`, tw), tx, y + h - 13);
  ctx.textAlign = "right";
  if (isNewFind(c)) pill("NEW", rx, y + 11, theme["c-blue"], plainInk());
  ctx.textAlign = "right"; ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(fitText(SRC_BY.get(srcOf(c)).name, rw), rx, y + 50);
  font(500, 12); ctx.fillText(fitText(`${c.dealWas ? "dropped " : ""}${agoText(c.dealAt, Date.now())}`, rw), rx, y + 66);
  ctx.fillStyle = theme.deal; font(700, 12); ctx.fillText(fitText(`Deal score ${dealScore(c)}`, rw), rx, y + h - 13);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
  if (!c.dealSeen && Date.now() - c.dealAt > 3000 && y >= topPad() - 2 && y + h <= vh + 2) lookedAt(c); // a listing you've seen is no longer news on the Chase lens
}

// ----- the Feed, as a room: every listing for your chases, newest first, and what it's still looking for -----
const feedView = { scroll: 0, max: 0, rows: [] };
const FEED_W = () => Math.min(vw - 24, 640), FEED_X = () => Math.round((vw - FEED_W()) / 2);
function drawFeedRoom(now) {
  const F = feedData(), x = FEED_X(), w = FEED_W(), rows = [];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  const S = feedView.scroll;
  let y = topPad() + 6;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.ink; font(800, 26, true); ctx.fillText("Feed", x, y + 26 - S);
  ctx.fillStyle = theme[ROOM_COL.feed]; ctx.fillRect(x, y + 35 - S, 30, 3.5);
  ctx.fillStyle = theme.muted; font(500, 13.5);
  const sub = F.list.length ? `${plural1(F.list.length, "listing")} for your chases, newest first.${F.fresh ? ` ${F.fresh} new since you last looked.` : ""}` : F.chased ? `Nothing yet. It looks for the ${plural1(F.chased, "card")} you chase, and a listing under market lands here the moment it's found.` : "Nothing to look for yet. Chase a card (on the wall, tap a card, then Chase it) and its listings land here.";
  const lines = wrapLines(sub, w, 3);
  lines.forEach((l, i) => ctx.fillText(l, x, y + 58 + i * 19 - S));
  y += 58 + (lines.length - 1) * 19 + 18;
  // a new listing slides in at the top; the rest move down to make room
  const fi = map.feedIn && !reduced ? clamp((now - map.feedIn.t0) / 650, 0, 1) : 1, fe = 1 - Math.pow(1 - fi, 3), RH = 112, GAP = 10;
  let more = fi < 1;
  F.list.forEach((c, i) => {
    const ry = y + i * (RH + GAP) - (i > 0 && fi < 1 ? (RH + GAP) * (1 - fe) : 0), sy = ry - S;
    rows.push({ c, x, y: ry, w, h: RH });
    if (sy > vh || sy + RH < 0) return;
    const a = i === 0 && fi < 1 ? fe : 1;
    feedRow(c, x, sy, w, RH, a, now);
    if (feedView.press === c) { ctx.lineWidth = 2; ctx.strokeStyle = theme.ink; rr(x - 1, sy - 1, w + 2, RH + 2, 12); ctx.stroke(); }
  });
  y += F.list.length * (RH + GAP);
  if (F.watching.length) { // still looking: the cards you chase with nothing under market yet
    y += 14;
    ctx.fillStyle = theme.ink; font(800, 18, true); ctx.fillText("Still looking", x, y + 18 - S);
    ctx.fillStyle = theme.muted; font(500, 12.5); ctx.textAlign = "right"; ctx.fillText(`${F.watching.length} ${F.watching.length === 1 ? "card" : "cards"}`, x + w, y + 18 - S); ctx.textAlign = "left";
    y += 30;
    const WH = 58, N = Math.min(F.watching.length, 80);
    for (let i = 0; i < N; i++) {
      const c = F.watching[i], sy = y - S;
      rows.push({ c, x, y, w, h: WH });
      if (sy < vh && sy + WH > 0) {
        if (i) { ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, sy, w, 1); }
        const ch = WH - 14, cw = ch * TW / TH;
        cardFace(c, x, sy + 7, cw, ch, now, false); ctx.globalAlpha = 1;
        const st = sets[c.si], tx = x + cw + 12, tw = w - cw - 12 - 110;
        ctx.textAlign = "left"; ctx.fillStyle = theme.ink; font(700, 14.5, true); ctx.fillText(fitText(c.name, tw), tx, sy + 26);
        ctx.fillStyle = theme.muted; font(500, 12); ctx.fillText(fitText(`${st.name} ${c.num}/${st.printed}`, tw), tx, sy + 43);
        ctx.textAlign = "right"; ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(short(capOf(c)), x + w, sy + 26);
        ctx.fillStyle = theme.muted; font(500, 11.5); ctx.fillText("the most you'd pay", x + w, sy + 43); ctx.textAlign = "left";
        if (feedView.press === c) { ctx.lineWidth = 2; ctx.strokeStyle = theme.ink; rr(x - 4, sy + 2, w + 8, WH - 4, 8); ctx.stroke(); }
      }
      y += WH;
    }
    if (F.watching.length > N) { ctx.fillStyle = theme.muted; font(500, 12.5); ctx.fillText(`And ${F.watching.length - N} more on the wall, in the Chase lens.`, x, y + 24 - S); y += 36; }
  }
  feedView.rows = rows;
  feedView.max = Math.max(0, y + 24 - vh);
  feedView.scroll = clamp(feedView.scroll, 0, feedView.max);
  return more;
}
function feedRowAt(px, py) { const y = py + feedView.scroll; return feedView.rows.find((r) => px >= r.x - 4 && px <= r.x + r.w + 4 && y >= r.y && y <= r.y + r.h) || null; }
function feedTap(x, y) {
  const r = feedRowAt(x, y); if (!r) return;
  tick(5); popCard(r.c, { x: r.x, y: r.y - feedView.scroll, w: r.w, h: r.h });
}

// ----- the Source, as a room: where it looks, each with a switch, and the clock -----
const srcView = { scroll: 0, max: 0, rows: [] };
function drawSourceRoom(now) {
  const F = feedData(), x = FEED_X(), w = FEED_W(), rows = [], S = srcView.scroll;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  let y = topPad() + 6;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.ink; font(800, 26, true); ctx.fillText("Source", x, y + 26 - S);
  ctx.fillStyle = theme[ROOM_COL.source]; ctx.fillRect(x, y + 35 - S, 30, 3.5);
  ctx.fillStyle = theme.muted; font(500, 13.5);
  const lines = wrapLines("Where Card Chaser looks for the cards you chase. Switch one off and its listings leave your feed.", w, 3);
  lines.forEach((l, i) => ctx.fillText(l, x, y + 58 + i * 19 - S));
  y += 58 + (lines.length - 1) * 19 + 18;
  // the clock: when it last looked, when it looks next, what it found
  let more = false;
  { const sy = y - S, h = 84;
    rr(x, sy, w, h, 12); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
    const cx = x + 34, cy = sy + h / 2, t = Date.now(), s = map.scan, left = Math.max(0, (s.next - t) / 1000), ago = Math.max(0, Math.round((t - s.last) / 1000));
    if (!reduced && F.chased) { const p = ((now / 1600) % 1); ctx.globalAlpha = 1 - p; ctx.lineWidth = 1.5; ctx.strokeStyle = theme[ROOM_COL.source]; ctx.beginPath(); ctx.arc(cx, cy, 8 + 16 * p, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; more = true; }
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fillStyle = F.chased ? theme[ROOM_COL.source] : theme["slot-line"]; ctx.fill();
    const tx = x + 64, tw = w - 76;
    ctx.fillStyle = theme.ink; font(700, 15, true); ctx.fillText(fitText(F.chased ? `Looking for ${plural1(F.chased, "card")}` : "Nothing to look for yet", tw), tx, sy + 28);
    ctx.fillStyle = theme.muted; font(500, 12.5); ctx.fillText(fitText(F.chased ? `Last look ${ago}s ago. Next in ${Math.round(left)}s.` : "Chase a card and it starts looking.", tw), tx, sy + 47);
    const found = map.found.length;
    ctx.fillStyle = found ? theme.deal : theme.muted; font(600, 12.5); ctx.fillText(fitText(found ? `${plural1(found, "find")} since you opened the app` : "No finds yet this visit", tw), tx, sy + 66);
    y += h + 10;
  }
  const P = map.pulse, pp = P ? (now - P.t0) / 1600 : 1;
  if (pp < 1) more = true;
  let group = "";
  const row = (r) => {
    if (r.group !== group) { group = r.group; y += 16; ctx.fillStyle = theme.ink; font(800, 16, true); ctx.fillText(group, x, y + 14 - S); y += 24; }
    const sy = y - S, h = r.h || 74;
    rows.push({ ...r, x, y, w, h });
    if (sy < vh && sy + h > 0) {
      rr(x, sy, w, h - 6, 12); ctx.fillStyle = r.lit && pp < 1 ? mix(theme["panel-solid"], theme.deal, (theme.dark ? 0.22 : 0.14) * (reduced ? 1 : 1 - pp)) : theme["panel-solid"]; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
      if (srcView.press === r.id) { ctx.lineWidth = 2; ctx.strokeStyle = theme.ink; rr(x, sy, w, h - 6, 12); ctx.stroke(); }
      const tw = w - 28 - (r.toggle ? 56 : 0);
      ctx.textAlign = "left"; ctx.fillStyle = r.on === false ? theme.muted : theme.ink; font(700, 15, true); ctx.fillText(fitText(r.name, tw), x + 14, sy + 25);
      ctx.fillStyle = theme.muted; font(500, 12.5);
      wrapLines(r.desc, tw, 2).forEach((l, i) => ctx.fillText(l, x + 14, sy + 44 + i * 16));
      if (r.toggle) drawSwitch(x + w - 58, sy + (h - 6) / 2 - 13, r.on);
    }
    y += h;
  };
  for (const s of SRC) {
    const n = F.counts[s.id] || 0, on = srcOn(s.id);
    row({ id: s.id, group: s.group, name: s.name, desc: `${s.desc}${on ? (n ? `. ${n} in your feed.` : ".") : ". Off: its listings stay out of your feed."}`, toggle: true, on, lit: P && srcOf(P.c) === s.id && on });
  }
  let imp = null; try { imp = localStorage.getItem("wall-imported"); } catch { /* fine */ }
  const owned = cards.filter((c) => c.owned).length;
  row({ id: "import", group: "Imports", name: imp && imp !== "1" ? `${imp} import` : imp ? "Your import" : "Nothing imported yet", desc: imp ? `${owned.toLocaleString()} cards on your wall now.` : "Import from TCGplayer or Collectr when you start, or pick your sets in Settings.", toggle: false });
  row({ id: "alerts", group: "Alerts", name: "Phone alerts", desc: "A find 40% or more under market pings your phone.", toggle: true, on: srcState.alerts });
  srcView.rows = rows;
  srcView.max = Math.max(0, y + 24 - vh);
  srcView.scroll = clamp(srcView.scroll, 0, srcView.max);
  return more;
}
function sourceTap(px, py) {
  const y = py + srcView.scroll, r = srcView.rows.find((q) => px >= q.x && px <= q.x + q.w && y >= q.y && y <= q.y + q.h - 6);
  if (!r || !r.toggle) return;
  if (r.id === "alerts") { srcState.alerts = !srcState.alerts; toast(srcState.alerts ? "Phone alerts on." : "Phone alerts off."); }
  else { if (srcState.off.has(r.id)) srcState.off.delete(r.id); else srcState.off.add(r.id); toast(srcOn(r.id) ? `${r.name} on.` : `${r.name} off. Its listings leave your feed.`); }
  tick(6); saveSources(); kick();
}
// A finger down on a row: the row shows it; lifting or moving off clears it.
function pPress(x, y) {
  if (spot === "feed") { const r = feedRowAt(x, y); feedView.press = r ? r.c : null; }
  else if (spot === "source") { const yy = y + srcView.scroll, r = srcView.rows.find((q) => x >= q.x && x <= q.x + q.w && yy >= q.y && yy <= q.y + q.h - 6); srcView.press = r?.toggle ? r.id : null; }
  kick();
}
function pPressOff() { if (feedView.press || srcView.press) { feedView.press = null; srcView.press = null; kick(); } }
