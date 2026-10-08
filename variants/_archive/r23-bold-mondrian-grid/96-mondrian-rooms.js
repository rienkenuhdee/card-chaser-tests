// ---------- round 23, bold: the Mondrian grid, part two (the map, the trophy room, the trade binder) ----------

// ----- the rooms map: one composition. The rooms touch, a heavy rule between each, and each room's size and colour
// field follow what's in it: Chase grows with what's left to chase, the Feed with what it has found, Trade and
// Trophies split their column by spares against trophies earned. -----
const MR = 4; // each room's half of the rule between rooms
let mapW = { t: -1e9, v: null };
function mapWeights() {
  const now = performance.now();
  if (mapW.v && now - mapW.t < 1500) return mapW.v;
  const q = (x) => Math.round(clamp(x, 0, 1) * 10) / 10; // in tenths, so the map doesn't shift with every card
  let v = { chase: 0.5, feed: 0.3, trade: 0, medal: 0 };
  try {
    const total = cards.length || 1, toGo = cards.filter((c) => !c.owned).length;
    v = { chase: q(toGo / total), feed: q(feedData().list.length / 60), trade: q(spareCount() / 120), medal: q(medalCount() / 25) };
  } catch { /* early: the map isn't up yet */ }
  mapW = { t: now, v };
  return v;
}
function mapLayout() {
  const Wt = mapWeights(), key = `${vw}|${vh}|${botPad()}|${SAFE.left}|${SAFE.right}|${Wt.chase}|${Wt.feed}|${Wt.trade}|${Wt.medal}`;
  if (mapUI.L?.key === key) return mapUI.L;
  if (landPhone()) return (mapUI.L = mapAcross(key));
  const W = Math.min(vw - 20, 1180), x0 = Math.round((vw - W) / 2), top = topPad() - 2, bottom = vh - 34, avail = bottom - top, s = Wt.chase;
  const fH = Math.round(clamp(avail * (0.15 + 0.09 * Wt.feed) * (1.15 - 0.3 * s), 128, 200)), sH = Math.round(clamp(avail * 0.16 * (1.1 - 0.3 * s), 112, 150));
  const my = top + fH, mh = avail - fH - sH;
  const B = wallBand(), asp = B.w / B.h, FOOT = 50, wide = vw >= 700;
  let thH = mh - CARD_HEAD - FOOT, thW = thH * asp;
  const cMax = Math.min(W - 160, W * ((wide ? 0.5 : 0.44) + 0.2 * s));
  if (thW + 16 > cMax) { thW = cMax - 16; thH = thW / asp; }
  const cw = Math.round(clamp(W * (0.38 + 0.22 * s), thW + 16, cMax)), rx = x0 + cw, rw = W - cw;
  const th = Math.round(mh * clamp(0.5 + 0.3 * (Wt.trade - Wt.medal), 0.34, 0.66));
  const r = {
    feed: { x: x0, y: top, w: W, h: fH },
    chase: { x: x0, y: my, w: cw, h: mh },
    trade: { x: rx, y: my, w: rw, h: th },
    medal: { x: rx, y: my + th, w: rw, h: mh - th },
    source: { x: x0, y: my + mh, w: W, h: sH },
  };
  const thumb = { x: x0 + (cw - thW) / 2, y: my + CARD_HEAD, w: thW, h: thH };
  return (mapUI.L = { key, r, thumb, hintY: vh - 14 });
}
function mapAcross(key) {
  const x0 = 10 + SAFE.left, W = vw - 20 - SAFE.left - SAFE.right, top = topPad() - 2, bottom = vh - SAFE.bottom - 30, h = bottom - top, Wt = mapWeights();
  const B = wallBand(), asp = B.w / B.h, FOOT = 50, U = W;
  let cw = Math.round(Math.min(U * (0.36 + 0.12 * Wt.chase), U - 3 * 150)), thW = cw - 16, thH = thW / asp;
  if (thH > h - CARD_HEAD - FOOT) { thH = h - CARD_HEAD - FOOT; thW = thH * asp; cw = Math.round(thW + 16); }
  const sw = Math.round((U - cw) / 3), fx = x0, cx = fx + sw, tx = cx + cw, sx = tx + sw, sW = x0 + W - sx, th = Math.round(h * clamp(0.5 + 0.3 * (Wt.trade - Wt.medal), 0.34, 0.66));
  const r = {
    feed: { x: fx, y: top, w: sw, h },
    chase: { x: cx, y: top, w: cw, h },
    trade: { x: tx, y: top, w: sw, h: th },
    medal: { x: tx, y: top + th, w: sw, h: h - th },
    source: { x: sx, y: top, w: sW, h },
  };
  const thumb = { x: cx + (cw - thW) / 2, y: top + CARD_HEAD, w: thW, h: thH };
  return { key, r, thumb, hintY: vh - SAFE.bottom - 12 };
}
// A room's colour field: its hue, and how much of its band it fills.
function roomField(id) {
  try {
    if (id === "feed") { const F = feedData(); return { col: theme["m-blue"], on: theme["m-on"], f: F.fresh ? clamp(0.15 + F.fresh / 30, 0, 1) : 0 }; } // something new
    if (id === "chase") return { col: theme["m-red"], on: theme["m-on"], f: mapWeights().chase }; // what's left to chase
    if (id === "trade") { tbList(); const s = spareCount(), w = tbMemo.wanted; return { col: theme.rule, on: theme.dark ? theme.bg : theme["m-on"], f: s ? clamp(0.15 + (w / s) * 1.6, 0, 1) : 0 }; } // spares someone wants
    if (id === "medal") { const L = medalList(); return { col: theme["m-yellow"], on: theme["m-on-yellow"], f: L.list.length ? clamp(L.earned.length / L.list.length * 3, 0, 1) : 0 }; } // trophies earned
  } catch { /* not ready */ }
  return { col: null, on: theme.ink, f: 0 };
}
const BAND = CARD_HEAD - 4;
let cardF = null; // the field of the card being painted, for its title
function cardFrame(id, w, h) {
  ctx.fillStyle = theme.panelFill; ctx.fillRect(0, 0, w, h);
  const R = roomField(id), fw = Math.round(w * R.f);
  if (fw > 0) { ctx.fillStyle = R.col; ctx.fillRect(0, 0, fw, BAND); if (fw < w - MR) { ctx.fillStyle = theme.rule; ctx.fillRect(fw - 1.5, 0, 3, BAND); } }
  ctx.fillStyle = theme.rule; ctx.fillRect(0, BAND - 2, w, 4);
  ctx.lineWidth = MR * 2; ctx.strokeStyle = theme.rule; ctx.strokeRect(0, 0, w, h); // half of it falls outside: MR inside
  cardF = { x: 0, y: 0, w: fw, h: BAND, on: R.on };
}
function cardTitle(id, w, line, { ink = theme.ink, muted = theme.muted, col = null } = {}) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  font(700, 19); const name = fitText(ROOM_NAME[id], w - 28);
  twoTone(() => ctx.fillText(name, 14, 27), cardF, ink);
  if (line) { font(col ? 700 : 600, w < 190 ? 11.5 : 12.5); const l = fitText(line, w - 28); twoTone(() => ctx.fillText(l, 14, 43), cardF, col && !cardF?.w ? col : muted); }
}
function drawChaseCard(r, now, a) {
  const L = mapLayout(), A = L.r.chase, kx0 = r.w / A.w, ky0 = r.h / A.h, D = { x: r.x + (L.thumb.x - A.x) * kx0, y: r.y + (L.thumb.y - A.y) * ky0, w: L.thumb.w * kx0, h: L.thumb.h * ky0 };
  ctx.globalAlpha = a; ctx.fillStyle = theme.panelFill; ctx.fillRect(r.x, r.y, r.w, r.h);
  wallThumb(D, now);
  ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.strokeStyle = theme.rule; ctx.strokeRect(D.x, D.y, D.w, D.h);
  chaseChrome(r, now, a, D);
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
function chaseChrome(R, now, a, D = null) {
  ctx.globalAlpha = a;
  const F = roomField("chase"), k = R.w / mapLayout().r.chase.w, bandH = Math.min(BAND * k, D ? D.y - R.y - 2 : BAND), fw = R.w * F.f;
  ctx.fillStyle = theme.panelFill; ctx.fillRect(R.x, R.y, R.w, bandH);
  if (fw > 0) { ctx.fillStyle = F.col; ctx.fillRect(R.x, R.y, fw, bandH); if (fw < R.w - MR) { ctx.fillStyle = theme.rule; ctx.fillRect(R.x + fw - 1.5, R.y, 3, bandH); } }
  ctx.fillStyle = theme.rule; ctx.fillRect(R.x, R.y + bandH - 2, R.w, 4);
  const FF = { x: R.x, y: R.y, w: fw, h: bandH, on: F.on };
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  font(700, 19); const t = fitText("Chase", R.w - 28); twoTone(() => ctx.fillText(t, R.x + 14, R.y + 27), FF, theme.ink);
  font(600, 12.5); const cl = fitText(countLine("chase").t, R.w - 28); twoTone(() => ctx.fillText(cl, R.x + 14, R.y + 43), FF, theme.muted);
  // the lens bar, small and square: the lenses live inside Chase, and this is the one the wall is in
  const bh = 28, bx = R.x + 12, bw = R.w - 24, by = D ? Math.min(D.y + D.h + 10, R.y + R.h - 12 - bh) : R.y + R.h - 12 - bh, sw = bw / LENSES.length;
  ctx.fillStyle = theme.panelFill; ctx.fillRect(bx, by, bw, bh); ctx.lineWidth = 2; ctx.strokeStyle = theme.rule; ctx.strokeRect(bx, by, bw, bh);
  font(600, 12); ctx.textAlign = "center";
  LENSES.forEach((key, i) => {
    const on = state.lens === key, cx = bx + i * sw;
    if (on) { ctx.fillStyle = theme.ink; ctx.fillRect(cx, by, sw, bh); }
    ctx.fillStyle = on ? theme.bg : theme.muted; ctx.fillText(fitText(LENS_NAMES[key], sw - 4), cx + sw / 2, by + 18.5);
  });
  ctx.textAlign = "left";
  const near = R.y + R.h - (by + bh) >= 52 ? nearestSet() : null;
  if (near) {
    ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(fitText("Closest to done", R.w - 28), R.x + 14, by + bh + 24);
    ctx.fillStyle = theme.ink; font(700, 14, true); ctx.fillText(fitText(`${near.g.name}, ${near.left} to go`, R.w - 28), R.x + 14, by + bh + 42);
  }
  ctx.lineWidth = MR * 2 * k; ctx.strokeStyle = theme.rule; ctx.strokeRect(R.x, R.y, R.w, R.h);
  ctx.globalAlpha = 1;
}
function drawMap(now) {
  prepCards();
  const L = mapLayout();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  let more = false;
  for (const id of ROOMS) if (drawCard(id, L.r[id], now, 1)) more = true;
  // the outer edge of the composition, as heavy as the rules inside it
  const u = Object.values(L.r).reduce((a, r) => ({ x0: Math.min(a.x0, r.x), y0: Math.min(a.y0, r.y), x1: Math.max(a.x1, r.x + r.w), y1: Math.max(a.y1, r.y + r.h) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
  ctx.lineWidth = MR * 2; ctx.strokeStyle = theme.rule; ctx.strokeRect(u.x0, u.y0, u.x1 - u.x0, u.y1 - u.y0);
  const pr = mapUI.press && L.r[mapUI.press];
  if (pr) { ctx.globalAlpha = 0.1; ctx.fillStyle = theme.ink; ctx.fillRect(pr.x, pr.y, pr.w, pr.h); ctx.globalAlpha = 1; }
  const kr = mapUI.kb >= 0 && L.r[ROOMS[mapUI.kb]];
  if (kr) { ctx.lineWidth = 3; ctx.strokeStyle = theme["m-red"]; ctx.strokeRect(kr.x + MR + 2, kr.y + MR + 2, kr.w - MR * 2 - 4, kr.h - MR * 2 - 4); }
  drawMapHint(1);
  return more;
}

// ----- Trophies: the room's panels as ruled boxes -----
function mdDrawItem(it, y, pressed) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.lineWidth = 1;
  const card = () => { ctx.fillStyle = pressed ? theme.slot : theme["panel-solid"]; ctx.fillRect(it.x, y, it.w, it.h); ctx.lineWidth = 3; ctx.strokeStyle = theme.rule; ctx.strokeRect(it.x + 1.5, y + 1.5, it.w - 3, it.h - 3); ctx.lineWidth = 1; };
  const sep = (x0) => { ctx.fillStyle = theme.rule; ctx.fillRect(x0, y - 0.75, it.x + it.w - x0, 1.5); };
  if (it.type === "box") card();
  else if (it.type === "head") {
    let x = it.x + (it.inset || 0);
    if (it.dot) { ctx.fillStyle = theme[`c-${it.dot}`] || theme["c-blue"]; ctx.fillRect(x, y + it.h / 2 - 4, 9, 9); x += 15; }
    font(600, 12.5); const rw = it.right ? textW(it.right) + 12 : 0, by = y + it.h / 2 + 6;
    ctx.textAlign = "right"; ctx.fillStyle = theme["room-muted"]; if (it.right) ctx.fillText(it.right, it.x + it.w - (it.inset || 0), by);
    ctx.textAlign = "left";
    if (it.inset) { ctx.fillStyle = theme["room-ink"]; font(700, 16, true); ctx.fillText(fitText(it.text, it.w - rw - (x - it.x) - (it.inset || 0)), x, by); }
    else { ctx.fillStyle = theme["room-ink"]; font(700, 13); ctx.fillText(fitText(it.text.toUpperCase(), it.w - rw), x + 2, by); ctx.fillStyle = theme.rule; ctx.fillRect(it.x, y + it.h - 1, it.w, 3); } // a section: capitals over a rule
  } else if (it.type === "nu") {
    const t = it.t;
    if (pressed) { ctx.fillStyle = theme.slot; ctx.fillRect(it.x + 3, y, it.w - 6, it.h); }
    if (it.sep) sep(it.x + 3);
    drawMedal(ctx, t, it.x + 12 + MD_NW / 2, y + (it.h - MD_NW * 1.24) / 2 + 1, MD_NW, "locked");
    const tx = it.x + 58, tw = it.w - 58 - 64;
    font(700, 14.5, true); ctx.fillStyle = theme["room-ink"]; ctx.fillText(fitText(t.name, tw), tx, y + 22);
    font(500, 12); ctx.fillStyle = theme["room-muted"]; ctx.fillText(fitText(t.chase, tw), tx, y + 36);
    ctx.fillStyle = theme.panelFill; ctx.fillRect(tx, y + 42, tw, 7);
    ctx.fillStyle = theme[`c-${t.color}`] || theme["c-blue"]; ctx.fillRect(tx, y + 42, tw * it.frac, 7);
    ctx.lineWidth = 1.5; ctx.strokeStyle = theme.rule; ctx.strokeRect(tx, y + 42, tw, 7);
    ctx.textAlign = "right"; ctx.fillStyle = theme["room-ink"]; font(700, 18); ctx.fillText(String(it.left), it.x + it.w - 14, y + 27);
    font(500, 11.5); ctx.fillStyle = theme["room-muted"]; ctx.fillText("to go", it.x + it.w - 14, y + 42);
  } else if (it.type === "chip") {
    if (it.on) { ctx.fillStyle = theme["room-ink"]; ctx.fillRect(it.x, y, it.w, it.h); }
    else { if (pressed) { ctx.fillStyle = theme.slot; ctx.fillRect(it.x, y, it.w, it.h); } ctx.lineWidth = 2; ctx.strokeStyle = theme.rule; ctx.strokeRect(it.x + 1, y + 1, it.w - 2, it.h - 2); }
    ctx.fillStyle = it.on ? theme["room-bg"] : theme["room-ink"]; font(600, 13.5); ctx.textAlign = "center"; ctx.fillText(it.label, it.x + it.w / 2, y + 21);
  } else if (it.type === "more") {
    if (pressed) { ctx.fillStyle = theme.slot; ctx.fillRect(it.x + 3, y, it.w - 6, it.h - 3); }
    if (it.sep) sep(it.x + 3);
    const my = y + it.h / 2 + 5;
    font(600, 13.5); ctx.fillStyle = theme["room-muted"]; ctx.fillText(it.text, it.x + 14, my);
    ctx.textAlign = "right"; ctx.fillText(it.open ? "‹" : "›", it.x + it.w - 14, my);
  } else if (it.type === "fold") {
    card();
    const my = y + it.h / 2 + 5;
    font(700, 15, true); ctx.fillStyle = theme["room-ink"]; ctx.fillText("Not started yet", it.x + 14, my);
    ctx.textAlign = "right"; ctx.fillStyle = theme["room-muted"]; font(600, 12.5); ctx.fillText(`${it.n} ${it.n === 1 ? "chase" : "chases"} ${it.open ? "▴" : "▾"}`, it.x + it.w - 14, my);
  } else if (it.type === "note") {
    font(700, 13); ctx.fillStyle = theme["room-ink"]; ctx.fillText(it.title, it.x + 4, y + 16);
    font(500, 12.5); ctx.fillStyle = theme["room-muted"];
    let ty = y + 34; for (const ln of mdWrap(it.text, it.w - 8)) { ctx.fillText(ln, it.x + 4, ty); ty += 17; }
  }
  ctx.textAlign = "left";
}

// ----- the trade binder: the page a black-ruled 3 by 3, the cover a composition -----
function tbPaint(i, G) {
  const items = tbList().slice(i * 9, i * 9 + 9), show = G.show, two = G.spread === 2, said = [];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, G.pw + 2, G.ph + 2);
  const fill = show ? SHOW_PAGE : theme.panelFill, rule = show ? "#E9E5DA" : theme.rule, hole = show ? SHOW_SLEEVE : theme.slot;
  const muted = show ? SHOW_MUTED : theme.muted, left = tbLeft(G, i);
  ctx.fillStyle = fill; ctx.fillRect(0, 0, G.pw, G.ph);
  const rx = left ? G.pw - G.ring / 2 : G.ring / 2;
  for (const f of [0.17, 0.5, 0.83]) { ctx.beginPath(); ctx.arc(rx, G.ph * f, two ? 3 : 3.4, 0, Math.PI * 2); ctx.fillStyle = show ? SHOW_BG : theme.bg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rule; ctx.stroke(); } // the ring holes: circles, the one curve on the page
  // the grid: a rule down every gap and across every gap, heavier round the outside
  const p0 = tbPocket(G, i, 0), p8 = tbPocket(G, i, 8), gx = G.gx, gy = G.gy + G.lh, lw = clamp(G.cw * 0.035, 2, 4);
  const xs = [0, 1, 2].map((k) => tbPocket(G, i, k).x - gx / 2).concat(p8.x + p8.w + gx / 2), ys = [0, 3, 6].map((k) => tbPocket(G, i, k).y - G.gy / 2).concat(p8.y + p8.h + G.lh + G.gy / 2);
  for (let k = 0; k < 9; k++) { const r = tbPocket(G, i, k); if (!items[k]) { ctx.fillStyle = hole; ctx.fillRect(r.x, r.y, r.w, r.h); } }
  ctx.fillStyle = rule;
  xs.forEach((x, k) => { const w = k === 0 || k === 3 ? lw * 1.6 : lw; ctx.fillRect(x - w / 2, ys[0] - lw * 0.8, w, ys[3] - ys[0] + lw * 1.6); });
  ys.forEach((y, k) => { const w = k === 0 || k === 3 ? lw * 1.6 : lw; ctx.fillRect(xs[0] - lw * 0.8, y - w / 2, xs[3] - xs[0] + lw * 1.6, w); });
  void p0; void gy;
  ctx.textBaseline = "alphabetic";
  for (let k = 0; k < 9; k++) {
    const r = tbPocket(G, i, k), c = items[k];
    if (!c) continue;
    if (c.away) {
      ctx.fillStyle = hole; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.textAlign = "center"; ctx.fillStyle = muted; font(600, 11); ctx.fillText("On the table", r.x + r.w / 2, r.y + r.h / 2 + 4);
      continue;
    }
    const pic = tbPic(c, r.w);
    if (pic) ctx.drawImage(pic.bmp, r.x, r.y, r.w, r.h);
    else {
      const W0 = Math.min(r.w, 108), s = r.w / W0;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * r.x, dpr * r.y);
      foilOff = true; drawnFace(c, 0, 0, W0, W0 * TH / TW, 0, false); foilOff = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    }
    if (show && bnd.picks.has(c.id)) {
      ctx.lineWidth = 4; ctx.strokeStyle = SHOW_PICK; ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      const R = clamp(r.w * 0.11, 9, 14), cx = r.x + r.w - R - 4, cy = r.y + R + 4;
      ctx.fillStyle = SHOW_PICK; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.lineWidth = Math.max(2, R * 0.2); ctx.strokeStyle = "#0B0C0F"; ctx.lineCap = "square"; ctx.beginPath();
      ctx.moveTo(cx - R * 0.45, cy + R * 0.02); ctx.lineTo(cx - R * 0.12, cy + R * 0.36); ctx.lineTo(cx + R * 0.48, cy - R * 0.36); ctx.stroke(); ctx.lineCap = "butt";
    }
    said.push(...tbOnCard(c, r, pic, show));
  }
  ctx.fillStyle = muted; font(600, 11);
  if (two) { ctx.textAlign = left ? "left" : "right"; ctx.fillText(String(i + 1), left ? 12 : G.pw - 12, G.ph - 6); }
  else { ctx.textAlign = "right"; ctx.fillText(String(i + 1), G.pw - 14, G.dotY + 4); }
  ctx.lineWidth = 2; ctx.strokeStyle = show ? SHOW_LINE : theme.rule; ctx.strokeRect(1, 1, G.pw - 2, G.ph - 2);
  bnd.labels.set(i, said);
}
function tbCoverPaint(G) {
  const w = G.pw, h = G.ph, spine = Math.max(10, w * 0.09), lw = clamp(w * 0.022, 4, 9);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w + 2, h + 2);
  ctx.fillStyle = theme.panelFill; ctx.fillRect(0, 0, w, h);
  const vx = spine + (w - spine) * 0.7, y1 = h * 0.2, y2 = h * 0.62, y3 = h * 0.36;
  ctx.fillStyle = theme["m-red"]; ctx.fillRect(spine, 0, vx - spine, y1); // the composition: red over the title,
  ctx.fillStyle = theme["m-yellow"]; ctx.fillRect(vx, y1, w - vx, y3 - y1); // a little yellow at its side,
  ctx.fillStyle = theme["m-blue"]; ctx.fillRect(vx, y2, w - vx, h - y2); // blue in the far corner
  ctx.fillStyle = theme.rule;
  ctx.fillRect(0, 0, spine, h); // the spine
  ctx.fillRect(vx - lw / 2, 0, lw, h);
  ctx.fillRect(spine, y1 - lw / 2, w - spine, lw);
  ctx.fillRect(spine, y2 - lw / 2, w - spine, lw);
  ctx.fillRect(vx, y3 - lw / 2, w - vx, lw);
  ctx.lineWidth = lw; ctx.strokeRect(lw / 2, lw / 2, w - lw, h - lw);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = theme.ink;
  const fs = clamp(w * 0.1, 13, 26), tw = vx - spine - lw - 24; font(700, fs);
  const words = ["Trade", "binder"]; // one word a line, set large
  words.forEach((t, k) => ctx.fillText(fitText(t, tw), spine + lw + 12, y1 + lw + fs * 1.15 * (k + 1)));
}
