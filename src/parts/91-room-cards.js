// ---------- rooms, part two: the cards on the map (round 21) ----------
// Every room's card is a picture of its live state, painted once into a card-sized canvas (at most 2x, one per card,
// reused) and kept until what it shows changes (a find, a count, the theme), so the map and a held pinch into it are
// a few drawImage calls. What moves on a card is drawn over its picture each frame: the Feed's newest listing sliding
// in, Source's clock and pulse, the Chase card's picture of the wall flashing where a deal landed. Under each room's
// name is its count line, as production's tabs have them: "8 new", "786 to go", "174 spares, 27 wanted", "30 earned",
// and Source's last and next look.

// ----- painting a card once (on the wall's canvas, at its corner, then copied into its own canvas and kept) -----
const baked = new Map();
function bake(id, key, w, h, paint) {
  const had = baked.get(id);
  if (had?.key === key) return had;
  const k = Math.min(dpr, 2), W0 = Math.ceil(w * dpr), H0 = Math.ceil(h * dpr), W = Math.max(1, Math.ceil(w * k)), H = Math.max(1, Math.ceil(h * k));
  const cv = had?.cv || document.createElement("canvas");
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w + 2, h + 2);
  ART.far = ART.still = true; const extra = paint(w, h) || null; ART.far = ART.still = false; // the map is far out: pictures only if already in
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = "left";
  const x = cv.getContext("2d"); x.clearRect(0, 0, W, H); x.drawImage(canvas, 0, 0, W0, H0, 0, 0, W, H);
  const v = { key, cv, w, h, extra }; baked.set(id, v); return v;
}
// A card is a field of the painting (round 23): flat, square, its frame the map's rules (drawn by dsFrame).
function cardFrame(id, w, h, fill = theme["panel-solid"]) { ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h); }
// A room's name, large, and its count line; a count that starts with a number can stand big at the field's foot.
function dsTitle(name, x, w, ink, sub, line, foot = 0) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = ink; font(700, 24); ctx.fillText(fitText(name, w), x, 33);
  if (!line) return;
  const m = foot ? /^([\d,]+)\s(.+)$/.exec(line) : null;
  if (m) {
    ctx.fillStyle = ink; font(700, 44); ctx.fillText(fitText(m[1], w), x, foot - 30);
    ctx.fillStyle = sub; font(600, 13.5); ctx.fillText(fitText(m[2], w), x, foot - 12);
  } else { ctx.fillStyle = sub; font(600, w < 170 ? 12 : 13.5); ctx.fillText(fitText(line, w), x, 52); }
}
function cardTitle(id, w, line, { ink = theme.ink, muted = theme.muted, col = null } = {}) { dsTitle(ROOM_NAME[id], 14, w - 28, ink, col || muted, line); }
// Each room's count line: production's tabs carry the same.
function countLine(id) {
  if (id === "feed") { const F = feedData(); return F.fresh ? { t: `${F.fresh} new`, col: theme["c-blue"] } : { t: F.list.length ? plural1(F.list.length, "listing") : F.chased ? "Looking" : "Nothing to look for yet" }; }
  if (id === "chase") return { t: `${cards.filter((c) => !c.owned).length.toLocaleString()} to go` };
  if (id === "trade") { tbList(); const s = spareCount(), w = tbMemo.wanted; return { t: s ? `${plural1(s, "spare")}${w ? `, ${w} wanted` : ""}` : "No spares yet", col: s && w ? theme.gold : null }; }
  if (id === "medal") { const n = medalCount(); return { t: n ? `${n} earned` : "None earned yet" }; }
  return { t: "" };
}
// Each card's key: what it shows, so it is painted again only when that changes.
function cardKey(id, w, h) {
  const base = `${Math.round(w)}|${Math.round(h)}|${dpr}|${theme.bg}|${theme.dark ? 1 : 0}|${countLine(id).t}`;
  if (id === "feed") { const F = feedData(), now = Date.now(); return `${base}|${F.list.slice(0, 4).map((L) => `${L.id}.${L.price}.${isNewL(L) ? 1 : 0}.${agoText(L.seen, now)}`).join(",")}`; }
  if (id === "trade") { const l = tbList(); return `${base}|${copiesKey}|${l.slice(0, 9).map((c) => c.id).join(",")}|${trades.length}`; }
  if (id === "medal") { const L = medalList(); return `${base}|${L.sig}|${mdVer}|${theme["m-surface"]}`; }
  if (id === "source") { const F = feedData(), f = finds[0]; return `${base}|${srcState.ver}|${srcState.alerts}|${SRC.map((s) => F.counts[s.id] || 0).join(",")}|${F.chased}|${f ? `${f.L.id}${f.L.price}${agoText(f.at, Date.now())}` : ""}`; }
  return base;
}
function prepCards() {
  const L = mapLayout();
  for (const id of ["feed", "trade", "medal", "source"]) { const r = L.r[id]; bake(id, cardKey(id, r.w, r.h), r.w, r.h, (w, h) => PAINT[id](w, h)); }
}
const PAINT = {
  // Feed: a blue field with the count standing in it, and the newest listings in the white beside it, cut by rules.
  feed(w, h) {
    const RW = mapLayout().RW, vert = h > w * 1.3, F = feedData(), n = F.list.length, cl = countLine("feed");
    cardFrame("feed", w, h);
    const bw = vert ? w : Math.round(clamp(w * 0.3, 104, 150)), bh = vert ? DS.HEAD : h;
    ctx.fillStyle = theme["c-blue"]; ctx.fillRect(0, 0, bw, bh);
    ctx.fillStyle = theme.rule; if (vert) ctx.fillRect(0, bh, w, RW); else ctx.fillRect(bw, 0, RW, h);
    dsTitle("Feed", 14, bw - 24, "#FFFFFF", "rgb(255 255 255 / .82)", cl.t, vert || h < 110 ? 0 : h);
    const fx = vert ? 0 : bw + RW, fy = vert ? bh + RW : 0, fw = w - fx, fh = h - fy, thin = 3;
    if (!n) {
      ctx.fillStyle = theme.muted; font(500, 13.5);
      wrapLines(F.chased ? `Every listing found for the ${plural1(F.chased, "card")} you chase lands here, newest first.` : "Chase a card and every listing found for it lands here, newest first.", fw - 28, vert ? 6 : 4).forEach((l, i) => ctx.fillText(l, fx + 14, fy + 26 + i * 19));
      return { fx, fy, fw, fh, step: 0, vert, tw: 0, th: 0 };
    }
    const now = performance.now(), th = vert ? 74 : fh, tw = vert ? fw : Math.min(186, Math.max(156, th * 1.7)), step = (vert ? th : tw) + thin;
    for (let i = 0; i < n; i++) {
      const x = vert ? fx : fx + i * step, y = vert ? fy + i * step : fy;
      if (vert ? y + th > h : x >= w) break;
      feedChip(F.list[i], x, y, tw, th, now);
      ctx.fillStyle = theme.rule; if (vert) ctx.fillRect(fx, y + th, fw, thin); else ctx.fillRect(x + tw, fy, thin, fh);
    }
    return { fx, fy, fw, fh, step, vert, tw, th };
  },
  trade(w, h) {
    cardFrame("trade", w, h);
    const list = tbList(), cl = countLine("trade");
    cardTitle("trade", w, cl.t, { col: cl.col });
    // the binder's first page, small: what grows into the binder when you open it from the room
    const open = trades.filter((r) => r.state === "proposed" || r.state === "countered").length;
    const G = tbGeom(false, 1, false), gh = clamp(h - CARD_HEAD - (open ? 44 : 16), 44, 150), gw = gh * G.pw / G.ph, gx = Math.round((w - gw) / 2), gy = CARD_HEAD + 4, k = gw / G.pw; // the page takes the card, less a line for trades waiting
    ctx.fillStyle = theme.slot; ctx.fillRect(gx, gy, gw, gh); ctx.lineWidth = 2; ctx.strokeStyle = theme.rule; ctx.strokeRect(gx + 1, gy + 1, gw - 2, gh - 2);
    ctx.fillStyle = theme.rule; ctx.fillRect(gx, gy, 5, gh); // the spine
    for (let i = 0; i < 9; i++) {
      const p = tbPocket(G, 0, i), px = gx + p.x * k, py = gy + p.y * k, pw = p.w * k, ph = p.h * k, c = list[i];
      if (!c) { ctx.fillStyle = theme.bg; ctx.fillRect(px, py, pw, ph); continue; }
      const col = typeColor(c);
      ctx.fillStyle = col; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = lighter(col); ctx.fillRect(px + 1, py + 1, pw - 2, ph * 0.22);
      ctx.fillStyle = theme.paper; ctx.fillRect(px + 1, py + ph * 0.76, pw - 2, ph * 0.2);
    }
    ctx.textAlign = "left"; ctx.fillStyle = open ? theme[ROOM_COL.trade] : theme.muted; font(open ? 700 : 500, 12.5);
    if (open) ctx.fillText(fitText(`${plural1(open, "trade")} waiting`, w - 28), 14, h - 14);
  },
  medal(w, h) { // Trophies: a yellow field with the name, then the rarest you've earned standing on a rule, then what's next
    const RW = mapLayout().RW, L = medalList(), E = L.earned;
    cardFrame("medal", w, h);
    ctx.fillStyle = theme["c-yellow"]; ctx.fillRect(0, 0, w, DS.HEAD); ctx.fillStyle = theme.rule; ctx.fillRect(0, DS.HEAD, w, RW);
    dsTitle("Trophies", 14, w - 28, "#121212", "rgb(18 18 18 / .78)", countLine("medal").t);
    const top = DS.HEAD + RW + 12, mw = clamp((w - 28) / 3.4, 26, 44), n = Math.max(1, Math.min(E.length, Math.floor((w - 20) / (mw + 8)))), sy = top + mw * 1.16;
    const next = L.list.filter((t) => !t.earned && t.goal > 1).map((t) => ({ t, left: t.goal - t.have, frac: t.have / t.goal })).filter((x) => x.left > 0).sort((a, b) => b.frac - a.frac || a.left - b.left)[0];
    if (E.length) { const span = n * mw + (n - 1) * 8, x0 = (w - span) / 2 + mw / 2; for (let i = 0; i < n; i++) drawMedal(ctx, E[i], x0 + i * (mw + 8), top, mw); }
    else if (next) drawMedal(ctx, next.t, w / 2, top, mw, "locked");
    ctx.fillStyle = theme.rule; ctx.fillRect(0, sy, w, 3);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let y = sy + 24;
    if (y > h - 8) return;
    ctx.fillStyle = theme.ink; font(700, 13.5, true);
    // Its lead names a trophy, not a section: "Rarest: Trophy Cabinet, Critical" (the luck goes first when the name needs the room).
    const best = E.length ? `Rarest: ${E[0].name}${MD_RANK[E[0].rank] ? `, ${MD_RANK[E[0].rank]}` : ""}` : "Fill a set to earn one";
    const lead = wrapLines(best, w - 28, 2); // on a narrow card it takes a second line
    lead.forEach((l, i) => { if (!i || y + 17 < h - 8) ctx.fillText(l, 14, y + i * 17); });
    if (lead.length > 1) y += 17;
    if (next && y + 34 < h) {
      y += 19; ctx.fillStyle = theme.muted; font(500, 12.5, true);
      wrapLines(`Next: ${next.t.name}, ${next.left} to go`, w - 28, 2).forEach((l, i) => { if (y + i * 16 < h - 6) ctx.fillText(l, 14, y + i * 16); });
    }
  },
  // Source: its switches in the white, and a small blue field at the end with the circle that looks (yellow while
  // alerts are on).
  source(w, h) {
    const RW = mapLayout().RW, vert = h > w * 1.3, bw = vert ? w : Math.round(clamp(w * 0.2, 64, 110)), bh = vert ? Math.round(clamp(h * 0.2, 60, 90)) : h;
    cardFrame("source", w, h);
    const ex = sourceChips(vert ? w : w - bw - RW, vert ? h - bh - RW : h);
    const bx = vert ? 0 : w - bw, by = vert ? h - bh : 0;
    ctx.fillStyle = theme.rule; if (vert) ctx.fillRect(0, by - RW, w, RW); else ctx.fillRect(bx - RW, 0, RW, h);
    ctx.fillStyle = theme["c-blue"]; ctx.fillRect(bx, by, bw, bh);
    ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh / 2, Math.min(bw, bh) * 0.26, 0, Math.PI * 2); ctx.fillStyle = srcState.alerts ? theme["c-yellow"] : "#FFFFFF"; ctx.fill();
    return ex;
  },
};
// Source's switches: a chip for each place it looks, and its latest find.
function sourceChips(w, h) {
  const F = feedData();
  cardTitle("source", w, ""); // its clock is drawn live, on top, as its count line
  const chips = [], groups0 = [["ebay"], ["tcgplayer"], ["reddit"], ["local"], ["shop-a", "shop-b"]];
  let x = 14, y = CARD_HEAD + 2;
  font(600, 13);
  for (const ids of groups0) {
    const s = SRC_BY.get(ids[0]), on = ids.some(srcOn), n = ids.reduce((a, id) => a + (srcOn(id) ? F.counts[id] || 0 : 0), 0);
    const label = ids.length > 1 ? "Shops" : s.short || s.name, cnt = on ? String(n) : "off", cw = 30 + textW(label) + textW(cnt);
    if (x + cw > w - 12) { x = 14; y += 34; }
    chips.push({ ids, x, y, w: cw, h: 28, label, cnt, on });
    x += cw + 6;
  }
  { const label = "Alerts", cnt = srcState.alerts ? "on" : "off", cw = 30 + textW(label) + textW(cnt); if (x + cw > w - 12) { x = 14; y += 34; } chips.push({ ids: ["alerts"], x, y, w: cw, h: 28, label, cnt, on: srcState.alerts }); }
  for (const c of chips) {
    if (c.y + c.h > h - 6) continue;
    ctx.fillStyle = theme.slot; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.lineWidth = 2; ctx.strokeStyle = theme.rule; ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    ctx.beginPath(); ctx.arc(c.x + 12, c.y + 14, 3.5, 0, Math.PI * 2); ctx.fillStyle = c.on ? theme.deal : theme["slot-line"]; ctx.fill();
    font(600, 13); ctx.textAlign = "left"; ctx.fillStyle = c.on ? theme.ink : theme.muted; ctx.fillText(c.label, c.x + 21, c.y + 18.5);
    ctx.fillStyle = theme.muted; ctx.fillText(c.cnt, c.x + 25 + textW(c.label), c.y + 18.5);
  }
  const f = finds[0];
  if (f && w < 260 && h - (y + 28) >= 42) { ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText("Latest find", 14, h - 31); ctx.fillStyle = theme.ink; font(700, 13, true); ctx.fillText(fitText(`${f.L.c.name} ${short(f.L.price)}`, w - 28), 14, h - 14); } // a narrow card: two short lines
  else if (f && w >= 260 && h - (y + 28) > 30) { ctx.fillStyle = theme.ink; font(600, 12.5); ctx.fillText(fitText(`Latest: ${f.L.c.name} ${short(f.L.price)} from ${srcName(f.L.src)}, ${agoText(f.at, Date.now())}`, w - 28), 14, h - 14); }
  return { chips };
}
// A listing on the Feed's card: the card, the asking price, how far under, where and when.
function feedChip(L, x, y, w, h, now) {
  const c = L.c, bare = h < 80 && w < 160, ch = h - 20, cw = bare ? -10 : ch * TW / TH; // bare: a narrow chip in a stack keeps its words and leaves out the card
  if (!bare) { foilOff = true; cardFace(c, x + 10, y + 10, cw, ch, now, false); foilOff = false; }
  ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tx = x + 10 + cw + 10, tw = x + w - 8 - tx, low = h < 80, fresh = isNewL(L);
  if (fresh) { ctx.fillStyle = theme["c-blue"]; ctx.fillRect(x + w - 14, y + 6, 8, 8); } // new: a blue square in the corner (the count line says how many)
  ctx.fillStyle = theme.deal; font(700, 18, true); ctx.fillText(fitText(short(L.price), tw - 10), tx, y + (low ? 23 : 28));
  font(600, 12); ctx.fillText(fitText(`${pctOf(L)}% under`, tw), tx, y + (low ? 38 : 45));
  ctx.fillStyle = theme.ink; font(700, 13, true); ctx.fillText(fitText(c.name, tw), tx, y + h - (low ? 21 : 26));
  ctx.fillStyle = theme.muted; font(500, 11); const src = srcName(L.src, true), full = `${src} · ${agoText(L.seen, Date.now())}`; ctx.fillText(textW(full) <= tw ? full : fitText(src, tw), tx, y + h - (low ? 7 : 10)); // the age goes first when it doesn't fit
}
function pill(text, x, y, fill, ink) { // a small square tag; x is its right edge
  font(700, 10); const w = textW(text) + 12, px = x - w;
  ctx.fillStyle = fill; ctx.fillRect(px, y, w, 17);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = ink; ctx.fillText(text, px + w / 2, y + 12.5); ctx.textAlign = "left";
  return w;
}
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

// ----- a card on the map: its picture, and what moves on it -----
function drawCard(id, r, now, a) {
  if (id === "chase") return drawChaseCard(r, now, a);
  const b = baked.get(id); if (!b) return false;
  const k = r.w / b.w;
  ctx.globalAlpha = a;
  let more = false;
  ctx.drawImage(b.cv, r.x, r.y, r.w, r.h);
  if (id === "feed" && mapUI.feedIn && b.extra?.step && !reduced) { // the newest listing slides in along the strip, the others making room
    const p = clamp((now - mapUI.feedIn.t0) / 650, 0, 1), e = ease(p), E = b.extra;
    if (p < 1) {
      more = true;
      const kk = b.cv.width / b.w, bx = r.x + E.fx * k, by = r.y + E.fy * k, bw = E.fw * k, bh = E.fh * k;
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(bx, by, bw, bh);
      ctx.drawImage(b.cv, Math.round(E.fx * kk), Math.round(E.fy * kk), Math.round(E.fw * kk), Math.round(E.fh * kk), bx - (E.vert ? 0 : E.step * k * (1 - e)), by - (E.vert ? E.step * k * (1 - e) : 0), bw, bh);
      ctx.restore(); curFont = "";
      ctx.globalAlpha = a * (1 - p); ctx.lineWidth = 3; ctx.strokeStyle = theme.deal; ctx.strokeRect(bx + 1.5, by + 1.5, E.tw * k - 3, E.th * k - 3);
    } else mapUI.feedIn = null;
  } else if (id === "feed" && mapUI.feedIn && (reduced || !b.extra?.step)) mapUI.feedIn = null;
  if (id === "source") { // its clock as its count line, and a pulse on the source that just found something
    ctx.globalAlpha = a; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.muted; font(600, r.w / k < 190 ? 12 : 13.5);
    ctx.fillText(fitText(clockText(true), r.w / k - 28), r.x + 14 * k, r.y + 52 * k);
    const P = mapUI.pulse;
    if (P && b.extra) {
      const p = (now - P.t0) / 1600, sid = P.L.src, chip = b.extra.chips.find((c) => c.ids.includes(sid));
      if (p >= 1 || !chip || !srcOn(sid)) { if (p >= 1) mapUI.pulse = null; }
      else {
        more = true;
        const cx = r.x + chip.x * k, cy = r.y + chip.y * k, cw = chip.w * k, chh = chip.h * k, g = reduced ? 3 : 3 + 12 * p;
        ctx.globalAlpha = a * (reduced ? 1 : 1 - p); ctx.lineWidth = 2; ctx.strokeStyle = theme[ROOM_COL.source];
        ctx.strokeRect(cx - g, cy - g, cw + g * 2, chh + g * 2);
        ctx.globalAlpha = a * Math.min(1, (1 - p) * 2); ctx.fillStyle = theme.deal; font(700, 12); ctx.fillText("+1", cx + cw + 6, cy + chh / 2 + 4 - (reduced ? 0 : 8 * p));
      }
    }
  }
  ctx.globalAlpha = 1;
  return more;
}
// The Chase card: a red field with its name, the wall itself under a rule (a picture of what you left), and the lenses.
function dsChaseGeom(r) { // the picture of the wall inside a Chase card drawn at r
  const L = mapLayout(), A = L.r.chase, kx = r.w / A.w, ky = r.h / A.h;
  return { x: r.x + (L.thumb.x - A.x) * kx, y: r.y + (L.thumb.y - A.y) * ky, w: L.thumb.w * kx, h: L.thumb.h * ky };
}
function drawChaseCard(r, now, a) {
  const D = dsChaseGeom(r);
  ctx.globalAlpha = a; ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(r.x, r.y, r.w, r.h);
  wallThumb(D, now); // the kept picture (drawn live the first time, or when the wall has changed)
  chaseChrome(r, now, a, D);
  // a deal landing on the wall flashes in the picture, where its tile is
  let more = false;
  const P = mapUI.pulse, c = P?.L.c;
  if (P && c?.m && !room.on) {
    const p = (now - P.t0) / 1400, S = wallBand();
    if (p < 1) {
      const kx = D.w / S.w, ky = D.h / S.h, tx = D.x + (c.m.x - S.x) * kx, ty = D.y + (c.m.y - mScroll - S.y) * ky;
      if (ty > D.y - 4 && ty < D.y + D.h + 4) {
        more = true; const g = reduced ? 4 : 3 + 10 * p, tw = Math.max(3, c.m.w * kx), th = Math.max(4, c.m.h * ky);
        ctx.globalAlpha = a * (reduced ? 1 : 1 - p); ctx.fillStyle = theme.deal; ctx.fillRect(tx, ty, tw, th);
        ctx.lineWidth = 2; ctx.strokeStyle = theme.deal; ctx.strokeRect(tx - g, ty - g, tw + g * 2, th + g * 2);
      }
    }
  }
  ctx.globalAlpha = 1;
  return more;
}
// The set closest to done (the one the import's summary leads with): what a tall Chase card says under its lenses.
let nearMemo = { key: -1, v: null };
function nearestSet() {
  if (nearMemo.key === wallVer) return nearMemo.v;
  let best = null;
  for (const g of groups) { if (!g.set || g.done || !g.base?.length) continue; const have = ownedIn(g.base), left = g.base.length - have; if (have > 0 && left > 0 && (!best || left < best.left)) best = { g, left }; }
  nearMemo = { key: wallVer, v: best }; return best;
}
// The Chase card's chrome around its picture of the wall: a red field with its name, the wall under a rule, and the lens
// strip under another, the lens the wall is in a black block. head: how far its red field has come down (1 at rest).
function chaseChrome(R, now, a, D = null, head = 1) {
  const RW = mapLayout().RW, hy = R.y - (DS.HEAD + RW) * (1 - head);
  ctx.globalAlpha = a;
  ctx.fillStyle = theme["c-red"]; ctx.fillRect(R.x, hy, R.w, DS.HEAD); ctx.fillStyle = theme.rule; ctx.fillRect(R.x, hy + DS.HEAD, R.w, RW);
  ctx.save(); ctx.translate(R.x, hy); dsTitle("Chase", 14, R.w - 28, "#FFFFFF", "rgb(255 255 255 / .85)", countLine("chase").t); ctx.restore(); curFont = "";
  if (!D) { ctx.globalAlpha = 1; return; }
  const by = D.y + D.h + RW, bh = DS.LENS, sw = R.w / LENSES.length;
  ctx.fillStyle = theme.rule; ctx.fillRect(R.x, D.y + D.h, R.w, RW);
  ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(R.x, by, R.w, bh);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "center"; font(700, 14);
  LENSES.forEach((k, i) => {
    const on = state.lens === k, cx = R.x + i * sw;
    if (on) { ctx.fillStyle = theme.ink; ctx.fillRect(cx, by, sw, bh); }
    if (i) { ctx.fillStyle = theme.rule; ctx.fillRect(cx - RW / 2, by, RW, bh); }
    ctx.fillStyle = on ? theme.bg : theme.muted; ctx.fillText(fitText(LENS_NAMES[k], sw - 8), cx + sw / 2, by + bh / 2 + 5);
  });
  ctx.textAlign = "left";
  const near = R.y + R.h - (by + bh) >= 56 ? nearestSet() : null; // a phone on its side leaves room under the lenses
  if (near) {
    ctx.fillStyle = theme.rule; ctx.fillRect(R.x, by + bh, R.w, RW);
    ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(fitText("Closest to done", R.w - 28), R.x + 14, by + bh + RW + 20);
    ctx.fillStyle = theme.ink; font(700, 14, true); ctx.fillText(fitText(`${near.g.name}, ${near.left} to go`, R.w - 28), R.x + 14, by + bh + RW + 39);
  }
  ctx.globalAlpha = 1;
}
