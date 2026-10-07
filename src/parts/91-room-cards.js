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
const plainInk = () => (theme.dark ? "#10131A" : "#FFFFFF");
function cardFrame(id, w, h, fill = theme["panel-solid"]) {
  rr(0.5, 0.5, w - 1, h - 1, 14); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  ctx.save(); rr(0.5, 0.5, w - 1, h - 1, 14); ctx.clip(); ctx.fillStyle = theme[ROOM_COL[id]]; ctx.fillRect(0, 0, w, 4); ctx.restore(); curFont = ""; // the room's colour along its top, as production's tabs have it
}
// The room's name, and its count line under it.
function cardTitle(id, w, line, { ink = theme.ink, muted = theme.muted, col = null } = {}) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = ink; font(800, 19, true); ctx.fillText(fitText(ROOM_NAME[id], w - 28), 14, 29);
  if (line) { ctx.fillStyle = col || muted; font(col ? 700 : 600, 12.5); ctx.fillText(fitText(line, w - 28), 14, 46); }
}
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
  feed(w, h) {
    cardFrame("feed", w, h);
    const F = feedData(), n = F.list.length, cl = countLine("feed");
    cardTitle("feed", w, cl.t, { col: cl.col });
    const y0 = CARD_HEAD + 2, th = h - y0 - 10, tw = Math.min(176, Math.max(150, th * 1.75)), step = tw + 8;
    if (!n) {
      ctx.fillStyle = theme.muted; font(500, 13.5);
      wrapLines(F.chased ? `Every listing found for the ${plural1(F.chased, "card")} you chase lands here, newest first.` : "Chase a card and every listing found for it lands here, newest first.", w - 28, 3).forEach((l, i) => ctx.fillText(l, 14, y0 + 16 + i * 19));
      return { step, y0, th, tw };
    }
    const now = performance.now();
    for (let i = 0; i < n && 12 + i * step < w; i++) feedChip(F.list[i], 12 + i * step, y0, tw, th, now);
    return { step, y0, th, tw };
  },
  trade(w, h) {
    cardFrame("trade", w, h);
    const list = tbList(), cl = countLine("trade");
    cardTitle("trade", w, cl.t, { col: cl.col });
    // the binder's first page, small: what grows into the binder when you open it from the room
    const G = tbGeom(false), gh = clamp(h - CARD_HEAD - 44, 44, 150), gw = gh * G.pw / G.ph, gx = Math.round((w - gw) / 2), gy = CARD_HEAD + 4, k = gw / G.pw;
    rr(gx, gy, gw, gh, 5); ctx.fillStyle = theme.slot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
    ctx.fillStyle = theme.gold; rr(gx + 3, gy + 8, 2.5, gh - 16, 1.2); ctx.fill(); // the spine
    for (let i = 0; i < 9; i++) {
      const p = tbPocket(G, 0, i), px = gx + p.x * k, py = gy + p.y * k, pw = p.w * k, ph = p.h * k, c = list[i];
      if (!c) { ctx.fillStyle = theme.bg; ctx.fillRect(px, py, pw, ph); continue; }
      const col = typeColor(c);
      ctx.fillStyle = col; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = lighter(col); ctx.fillRect(px + 1, py + 1, pw - 2, ph * 0.22);
      ctx.fillStyle = theme.paper; ctx.fillRect(px + 1, py + ph * 0.76, pw - 2, ph * 0.2);
    }
    const open = trades.filter((r) => r.state === "proposed" || r.state === "countered").length;
    ctx.textAlign = "left"; ctx.fillStyle = open ? theme[ROOM_COL.trade] : theme.muted; font(open ? 700 : 500, 12.5);
    ctx.fillText(fitText(open ? `${plural1(open, "trade")} waiting` : list.length ? "Binder, checker, table" : "The trade checker is here", w - 28), 14, h - 14);
  },
  medal(w, h) { // Trophies: the rarest you've earned standing on a hairline, then what's next
    cardFrame("medal", w, h);
    const L = medalList(), E = L.earned;
    cardTitle("medal", w, countLine("medal").t);
    const mw = clamp((w - 28) / 3.3, 28, 42), n = Math.max(1, Math.min(E.length, Math.floor((w - 20) / (mw + 6)))), top = CARD_HEAD, sy = top + mw * 1.24 - 3;
    const next = L.list.filter((t) => !t.earned && t.goal > 1).map((t) => ({ t, left: t.goal - t.have, frac: t.have / t.goal })).filter((x) => x.left > 0).sort((a, b) => b.frac - a.frac || a.left - b.left)[0];
    if (E.length) { const span = n * mw + (n - 1) * 6, x0 = (w - span) / 2 + mw / 2; for (let i = 0; i < n; i++) drawMedal(ctx, E[i], x0 + i * (mw + 6), top, mw); }
    else if (next) drawMedal(ctx, next.t, w / 2, top, mw, "locked");
    ctx.fillStyle = theme["slot-line"]; ctx.fillRect(14, sy, w - 28, 1);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let y = sy + 22;
    if (y > h - 8) return;
    ctx.fillStyle = theme.ink; font(700, 13.5, true);
    ctx.fillText(fitText(E.length ? `${E[0].name}${MD_RANK[E[0].rank] ? `, ${MD_RANK[E[0].rank]}` : ""}` : "Fill a set to earn one", w - 28), 14, y);
    if (next && y + 34 < h) {
      y += 18; ctx.fillStyle = theme.muted; font(500, 12.5);
      wrapLines(`Next: ${next.t.name}, ${next.left} to go`, w - 28, 2).forEach((l, i) => { if (y + i * 16 < h - 6) ctx.fillText(l, 14, y + i * 16); });
    }
  },
  source(w, h) {
    cardFrame("source", w, h);
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
      rr(c.x, c.y, c.w, c.h, 9); ctx.fillStyle = theme.slot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x + 12, c.y + 14, 3.5, 0, Math.PI * 2); ctx.fillStyle = c.on ? theme.deal : theme["slot-line"]; ctx.fill();
      font(600, 13); ctx.textAlign = "left"; ctx.fillStyle = c.on ? theme.ink : theme.muted; ctx.fillText(c.label, c.x + 21, c.y + 18.5);
      ctx.fillStyle = theme.muted; ctx.fillText(c.cnt, c.x + 25 + textW(c.label), c.y + 18.5);
    }
    const f = finds[0];
    if (f && h - (y + 28) > 30) { ctx.fillStyle = theme.ink; font(600, 12.5); ctx.fillText(fitText(`Latest: ${f.L.c.name} ${short(f.L.price)} from ${srcName(f.L.src)}, ${agoText(f.at, Date.now())}`, w - 28), 14, h - 14); }
    return { chips };
  },
};
// A listing on the Feed's card: the card, the asking price, how far under, where and when.
function feedChip(L, x, y, w, h, now) {
  const c = L.c;
  rr(x, y, w, h, 10); ctx.fillStyle = dealTint(); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme.deal; ctx.stroke();
  const ch = h - 14, cw = ch * TW / TH;
  foilOff = true; cardFace(c, x + 7, y + 7, cw, ch, now, false); foilOff = false;
  ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tx = x + 7 + cw + 8, tw = x + w - 8 - tx;
  ctx.fillStyle = theme.deal; font(800, 16.5); ctx.fillText(fitText(short(L.price), tw), tx, y + 23);
  font(700, 11.5); ctx.fillText(fitText(`${pctOf(L)}% under`, tw), tx, y + 38);
  ctx.fillStyle = theme.ink; font(700, 12.5, true); ctx.fillText(fitText(c.name, tw), tx, y + h - 22);
  ctx.fillStyle = theme.muted; font(500, 10.5); ctx.fillText(fitText(`${srcName(L.src, true)} · ${agoText(L.seen, Date.now())}`, tw), tx, y + h - 8);
  if (isNewL(L)) pill("NEW", x + w - 6, y + 6, theme["c-blue"], "#fff");
}
function pill(text, x, y, fill, ink) { // a small rounded tag; x is its right edge
  font(800, 10); const w = textW(text) + 12, px = x - w;
  rr(px, y, w, 17, 8.5); ctx.fillStyle = fill; ctx.fill();
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
  if (id === "feed" && mapUI.feedIn && b.extra && !reduced) { // the newest listing slides in from the left, the others making room
    const p = clamp((now - mapUI.feedIn.t0) / 650, 0, 1), e = 1 - Math.pow(1 - p, 3), E = b.extra;
    if (p < 1) {
      more = true;
      ctx.drawImage(b.cv, r.x, r.y, r.w, r.h); // the card stays put; inside its edges the strip moves
      const bx = r.x + 6 * k, by = r.y + (E.y0 - 4) * k, bw = r.w - 12 * k, bh = r.h - (E.y0 - 4) * k - 6 * k, kk = b.cv.width / b.w;
      ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
      ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(bx, by, bw, bh);
      const sx = Math.round(6 * kk), sy = Math.round((E.y0 - 4) * kk), sw = b.cv.width - sx * 2, sh = b.cv.height - sy - Math.round(6 * kk); // inside the card's edges only
      ctx.drawImage(b.cv, sx, sy, sw, sh, bx - E.step * k * (1 - e), by, bw, bh);
      ctx.restore(); curFont = "";
      ctx.globalAlpha = a * (1 - p); ctx.lineWidth = 2; ctx.strokeStyle = theme.deal; const g = 4 + 8 * p;
      rr(r.x + (12 - g) * k, r.y + (E.y0 - g) * k, (E.tw + g * 2) * k, (E.th + g * 2) * k, 12 + g); ctx.stroke();
    } else { mapUI.feedIn = null; ctx.drawImage(b.cv, r.x, r.y, r.w, r.h); }
  } else ctx.drawImage(b.cv, r.x, r.y, r.w, r.h);
  if (id === "source") { // its clock as its count line, and a pulse on the source that just found something
    ctx.globalAlpha = a; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.muted; font(600, 12.5);
    ctx.fillText(fitText(clockText(true), r.w / k - 28), r.x + 14 * k, r.y + 46 * k);
    const P = mapUI.pulse;
    if (P && b.extra) {
      const p = (now - P.t0) / 1600, sid = P.L.src, chip = b.extra.chips.find((c) => c.ids.includes(sid));
      if (p >= 1 || !chip || !srcOn(sid)) { if (p >= 1) mapUI.pulse = null; }
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
// The Chase card: the wall itself, as a picture of what you left, with its count line and lenses.
function drawChaseCard(r, now, a) {
  const L = mapLayout(), A = L.r.chase, kx0 = r.w / A.w, ky0 = r.h / A.h, D = { x: r.x + (L.thumb.x - A.x) * kx0, y: r.y + (L.thumb.y - A.y) * ky0, w: L.thumb.w * kx0, h: L.thumb.h * ky0 };
  ctx.globalAlpha = a; rr(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 14); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  wallThumb(D, now); // the kept picture (drawn live the first time, or when the wall has changed)
  ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; rr(D.x, D.y, D.w, D.h, 6); ctx.stroke();
  chaseChrome(r, now, a);
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
        ctx.lineWidth = 2; ctx.strokeStyle = theme.deal; ctx.beginPath(); ctx.arc(tx + tw / 2, ty + th / 2, g + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  return more;
}
function chaseChrome(R, now, a) {
  ctx.globalAlpha = a;
  ctx.save(); rr(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 14); ctx.clip(); ctx.fillStyle = theme[ROOM_COL.chase]; ctx.fillRect(R.x, R.y, R.w, 4); ctx.restore(); curFont = "";
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillStyle = theme.ink; font(800, 19, true); ctx.fillText(fitText("Chase", R.w - 28), R.x + 14, R.y + 29);
  ctx.fillStyle = theme.muted; font(600, 12.5); ctx.fillText(fitText(countLine("chase").t, R.w - 28), R.x + 14, R.y + 46);
  // the lens bar, small: the lenses live inside Chase, and this is the one the wall is in
  const bh = 28, bx = R.x + 12, bw = R.w - 24, by = R.y + R.h - 12 - bh, sw = bw / LENSES.length;
  rr(bx, by, bw, bh, 9); ctx.fillStyle = theme.slot; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  font(600, 12); ctx.textAlign = "center";
  LENSES.forEach((k, i) => {
    const on = state.lens === k, cx = bx + i * sw;
    if (on) { rr(cx + 2.5, by + 2.5, sw - 5, bh - 5, 7); ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
    ctx.fillStyle = on ? theme.ink : theme.muted; ctx.fillText(fitText(LENS_NAMES[k], sw - 4), cx + sw / 2, by + 18.5);
  });
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
