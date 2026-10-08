// ---------- round 23, bold: the Mondrian grid ----------
// A Bauhaus base (primaries and black on off-white, a geometric sans, square corners) with one idea: thick black rules
// are the app's structure. The wall is divided into rectangles by heavy rules, a set's header is a solid colour field
// as wide as its progress, cards sit in thin-ruled cells, binder pockets and the trophy room are ruled grids, and the
// rooms map is one composition whose rectangles are sized by what's in them.
//
// Colour is rare and means something: red, blue or yellow is a set's progress (the hue rotates set to set, so the wall
// composes like a painting), a room's identity on the map, or something new. A card's Pokémon type (Color by: Type
// needs a dozen hues) is a small square field in the corner of its cell, never the whole cell.
//
// The rules cost almost nothing: one stroked rectangle per panel, one fill per grid line, never one per tile.

// ----- the face: a geometric sans (Futura on iOS and macOS, Jost from Google Fonts elsewhere) -----
const M_FONT = '"Futura", "Jost", "Avenir Next", "Century Gothic", "Trebuchet MS", system-ui, sans-serif';
{
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Jost:wght@400..800&display=swap";
  document.head.append(l);
  // measured widths were taken in the fallback face: forget them once the real one is in
  document.fonts?.addEventListener?.("loadingdone", () => { fitCache.clear(); lineCache.clear(); wCache.clear(); baked.clear(); curFont = ""; kick(); });
}
function font(weight, size, narrow = false) {
  const px = Math.round(size * (narrow ? 1.84 : 2)) / 2, key = `${weight}|${px}`; // no condensed cut: a name is set a little smaller instead
  if (key === curFont) return;
  curFont = key; ctx.font = `${weight >= 700 ? 700 : weight >= 600 ? 600 : 500} ${px}px ${M_FONT}`;
}
function fontOn(x, weight, size, narrow = false) { x.font = `${weight >= 700 ? 700 : 500} ${Math.round(size * (narrow ? 1.84 : 2)) / 2}px ${M_FONT}`; }
// Square corners, everywhere the canvas draws a box.
function rr(x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); }
function rrOn(x, px, py, w, h) { x.beginPath(); x.rect(px, py, w, h); }

// ----- the palette, read from the stylesheet with the rest of the theme -----
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "slot", "slot-line", "ink", "muted", "deal", "gold", "panel", "panel-solid", "paper", "paper-ink", "plaque", "plaque-ink", "plaque-hi", "plaque-lo", "room-bg", "room-bg2", "room-wood", "room-wood-hi", "room-ink", "room-muted", "room-plaque", "room-plaque-ink", "room-plaque-lo", "room-up", "room-down", "c-red", "c-yellow", "c-green", "c-blue", "m-surface", "rule", "m-red", "m-yellow", "m-blue", "m-on", "m-on-yellow"]) theme[k] = cs.getPropertyValue(`--${k}`).trim();
  theme.panelFill = cs.getPropertyValue("--panel-fill").trim();
  theme.hole = cs.getPropertyValue("--hole").trim(); // a card you don't have, far out: a cell a shade off the field
  if (typeof heatCache !== "undefined") heatCache.clear();
  theme.dark = cs.colorScheme === "dark" || matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
}
// The type hues, flattened toward poster colours (still twelve apart, so Color by: Type keeps working).
Object.assign(TYPE, { F: ["Fire", "#D9472B"], W: ["Water", "#2A63C4"], G: ["Grass", "#2F9455"], L: ["Lightning", "#E9B500"], P: ["Psychic", "#8A3FC0"], X: ["Fighting", "#A8582A"], D: ["Darkness", "#454A68"], M: ["Metal", "#7C8798"], N: ["Dragon", "#9C7A12"], Y: ["Fairy", "#D85C9E"], C: ["Colorless", "#A79F8A"], t: ["Trainer", "#56637F"], e: ["Energy", "#7E879E"] });
// Trade's field on the map is black: Mondrian's fourth colour.
ROOM_COL.trade = "ink";

// ----- a group's field: its hue (red, blue, yellow, turn about) and how far along it is -----
const M_HUES = ["m-red", "m-blue", "m-yellow"];
function fieldOf(g) {
  if (g.mI == null) { const i = g.set ? sets.indexOf(g.set) : groups.indexOf(g); g.mI = (i < 0 ? 0 : i) % 3; }
  const k = M_HUES[g.mI];
  return { col: theme[k], on: k === "m-yellow" ? theme["m-on-yellow"] : theme["m-on"] };
}
const RULE = 5, HB = 38; // the heavy rule, and a panel's header band
// Text in two tones: ink over the off-white, the field's own ink where it runs over the colour.
function twoTone(draw, F, ink) {
  ctx.fillStyle = ink; draw();
  if (!F || F.w <= 0.5) return;
  ctx.save(); ctx.beginPath(); ctx.rect(F.x, F.y, F.w, F.h); ctx.clip(); ctx.fillStyle = F.on; draw(); ctx.restore(); curFont = "";
}

// ----- the wall: panels as ruled rectangles -----
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m), k = 1;
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)); const a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  if (inCase(g)) {
    if (room.on) { drawRoomPlaque(g, m, now, alpha, labelAlpha); return; }
    if (k < 1 && m.h >= 30) drawPlaque(g, m, now, alpha * (1 - k), 0);
    return;
  }
  if (g.done || g.minting) { drawPlaque(g, m, now, alpha, labelAlpha); return; }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.panelFill; ctx.fillRect(m.x, m.y, m.w, m.h);
  const folded = m.h < 64, bh = folded ? m.h : Math.min(HB, m.h);
  // the header band: a colour field as wide as what you own, a paler stretch for what you're chasing
  const t = ticksOf(g), timed = state.time, owned = timed ? ownedNow(g.cards) : t.owned, n = timed ? g.cards.length : t.n;
  let frac = n ? owned / n : 0;
  if (finishOf(g) && g.finT && !reduced) { const p = clamp((now - g.finT) / 600, 0, 1); frac = g.finFrom + (1 - g.finFrom) * (1 - Math.pow(1 - p, 3)); if (p < 1) kick(); }
  const P = fieldOf(g), fw = picking() ? 0 : m.w * frac;
  if (!timed && t.chased && owned < n && !picking()) { ctx.globalAlpha = alpha * 0.3; ctx.fillStyle = P.col; ctx.fillRect(m.x + fw, m.y, m.w * t.chased / n, bh); ctx.globalAlpha = alpha; }
  if (fw > 0) { ctx.fillStyle = P.col; ctx.fillRect(m.x, m.y, fw, bh); if (fw < m.w - 1) { ctx.fillStyle = theme.rule; ctx.fillRect(m.x + fw - 1.5, m.y, 3, bh); } }
  if (!folded) { ctx.fillStyle = theme.rule; ctx.fillRect(m.x, m.y + bh - RULE * 0.35, m.w, RULE * 0.7); }
  if (state.press?.g === g) { ctx.fillStyle = theme.ink; ctx.globalAlpha = alpha * 0.08; ctx.fillRect(m.x, m.y, m.w, m.h); ctx.globalAlpha = alpha; }
  if (g.unmint && k < 1) drawPlaque(g, m, now, alpha * (1 - k), 0);
  // the name and the count, in two tones across the field
  ctx.globalAlpha = alpha * labelAlpha;
  const x = m.x + RULE / 2 + 8, w = m.w - RULE - 16, size = clamp(m.w * 0.072, 12, 16.5), base = m.y + (folded ? Math.min(26, m.h * 0.62) : 24);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  let beat = null;
  if (g.beat) { const p = (now - g.beat.t0) / 3000; if (p < 1) beat = { text: g.beat.text, col: g.beat.col || theme.deal, a: Math.min(1, p * 10, (1 - p) * 4) }; else g.beat = null; }
  font(beat ? 700 : 600, size * 0.8);
  const stat = beat ? fitText(beat.text, w * 0.72) : panelStat(g), sw = stat ? textW(stat) + 8 : 0;
  const F = { x: m.x, y: m.y, w: fw, h: bh, on: P.on };
  font(700, size); const name = fitText(g.name, w - sw);
  twoTone(() => ctx.fillText(name, x, base), F, theme.ink);
  if (stat) {
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.8);
    if (beat) { ctx.globalAlpha = alpha * beat.a; ctx.fillStyle = beat.col; ctx.fillText(stat, x + w, base); }
    else twoTone(() => ctx.fillText(stat, x + w, base), F, theme.ink);
    ctx.globalAlpha = alpha * labelAlpha; ctx.textAlign = "left";
  }
  // the heavy rule round it: shared edges of neighbours fall on the same line
  ctx.globalAlpha = alpha; ctx.lineWidth = RULE; ctx.strokeStyle = theme.rule; ctx.strokeRect(m.x, m.y, m.w, m.h);
  ctx.globalAlpha = 1;
}
// A panel's cards in a ruled grid: each cell exactly a card's shape, the cells touching, thin rules between.
function packPanel(g) {
  const m = g.m, n = g.cards.length, inner = { x: m.x + RULE / 2 + 6, y: m.y + HB + RULE / 2 + 6, w: m.w - RULE - 12, h: m.h - HB - RULE - 12 };
  let best = { t: 0, cols: 1, rows: n };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols), t = Math.min(inner.w / cols, (inner.h / rows) * (TW / TH));
    if (t > best.t) best = { t, cols, rows };
  }
  const cw = best.t, ch = cw * TH / TW, gw = best.cols * cw, gh = best.rows * ch;
  const ox = inner.x + (inner.w - gw) / 2, oy = inner.y + Math.max(0, (inner.h - gh) / 2) * 0.5;
  g.cards.forEach((c, k) => { c.m = { x: ox + (k % best.cols) * cw, y: oy + Math.floor(k / best.cols) * ch, w: cw, h: ch }; });
  g.grid = { x: ox, y: oy, cols: best.cols, rows: best.rows, cw, ch, n };
}
function packFolded(g) {
  const m = g.m, x = m.x + RULE / 2 + 8, w = m.w - RULE - 16, n = g.cards.length;
  g.cards.forEach((c, k) => { c.m = { x: x + (w * k) / n, y: m.y + m.h - RULE / 2 - 7, w: Math.max(0.5, w / n), h: 3 }; });
  g.grid = null;
}
// The thin rules of a panel's grid: a line per row and per column, drawn over its cells.
function drawGrid(g, alpha) {
  const G = g.grid; if (!G || G.cw < 7 || lifted) return;
  const y0 = G.y - mScroll, W = G.cols * G.cw, H = G.rows * G.ch, lw = G.cw < 16 ? 1 : 1.5;
  if (y0 > vh || y0 + H < 0) return;
  ctx.globalAlpha = alpha * (G.cw < 10 ? 0.45 : 0.7); ctx.fillStyle = theme.rule;
  for (let i = 0; i <= G.cols; i++) ctx.fillRect(G.x + i * G.cw - lw / 2, y0 - lw / 2, lw, H + lw);
  for (let j = 0; j <= G.rows; j++) ctx.fillRect(G.x - lw / 2, y0 + j * G.ch - lw / 2, W + lw, lw);
  ctx.globalAlpha = 1;
}
function drawWall(now, alpha = 1, except = null) {
  const pick = picking() && wel.picks.size > 0;
  let settling = false;
  ART.far = true;
  for (const g of groups) {
    const t = pick && g.set && !wel.picks.has(g.set.id) ? 0.42 : 1;
    g.pe ??= 1;
    if (Math.abs(g.pe - t) > 0.01) { g.pe += (t - g.pe) * (reduced ? 1 : 0.16); settling = true; } else g.pe = t;
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    if (room.on && inCase(g)) continue;
    const a = alpha * g.pe;
    drawPanel(g, now, a);
    if (inCase(g)) continue;
    for (const c of g.cards) { const y = c.m.y - mScroll; if (y > vh || y + c.m.h < 0) continue; drawTile(c, c.m.x, y, c.m.w, c.m.h, now, a); }
    if (!g.done) drawGrid(g, a);
  }
  ART.far = false;
  if (!except && !state.trans) drawNewPanel(now, alpha);
  if (settling) kick();
}

// ----- a card in its cell -----
function drawTile0(c, sx, sy, w, h, now, mult = 1) {
  const a0 = mult * c.e * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1);
  if (a0 < 0.02) return;
  let scale = 1;
  const st = groups[c.g];
  if (st.ripple) { const d = Math.hypot(c.col - st.ripple.col, c.row - st.ripple.row), t = (now - st.ripple.t0 - d * 38) / 300; if (t > 0 && t < 1) scale = 1 + 0.075 * Math.sin(Math.PI * t); }
  if (state.press?.c === c) scale *= 1 - 0.07 * clamp((now - state.press.t0) / 420, 0, 1);
  let intro = 1;
  if (state.introT0 && !reduced) intro = clamp((now - state.introT0 - c.intro) / 360, 0, 1);
  if (intro <= 0) return;
  const alpha = a0 * intro;
  if (scale !== 1 || intro < 1) { const k = scale * (0.86 + 0.14 * intro); sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k; }
  ctx.globalAlpha = alpha;
  if (c.ph) { dexPocket(c, sx, sy, w, h, alpha); return; }
  if (c.lift && w > h * 1.05) { drawFeedTile(c, sx, sy, w, h, alpha, now); ctx.globalAlpha = 1; return; }
  const value = state.value && !state.matches;
  let flood = c.owned ? 1 : 0;
  if (state.time) flood = c.owned && c.got ? clamp((state.t - c.got) / (14 * 86400e3), 0, 1) : 0;
  else if (c.anim) { const p = clamp((now - c.anim.t0) / 460, 0, 1), e = 1 - Math.pow(1 - p, 3); flood = c.anim.to ? e : 1 - e; if (p >= 1) c.anim = null; }
  const dealOn = !c.owned && c.deal && isChase(c) && !state.time;
  if (w < 5) { // far out: the cell is the colour
    ctx.fillStyle = flood > 0.5 ? (value ? heat(c.price) : typeColor(c)) : dealOn && state.lens !== "chase" ? theme.deal : theme.slot;
    if (dealOn && state.lens === "chase") ctx.fillStyle = theme.deal;
    ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1));
    return;
  }
  if (w < 26) { // a cell: off-white for a card you have, a grey hole for one you don't, the type a square in its corner
    ctx.fillStyle = flood >= 1 ? theme.panelFill : theme.hole; ctx.fillRect(sx, sy, w, h);
    if (flood > 0) {
      const s = Math.min(w, h) * 0.7 * (flood < 1 ? flood : 1);
      ctx.fillStyle = value ? heat(c.price) : typeColor(c); ctx.fillRect(sx, sy + h - s, s, s);
      if (w > 14 && flood >= 1 && c.tier >= 3) { ctx.fillStyle = theme.rule; ctx.fillRect(sx + w - w * 0.22, sy + w * 0.08, w * 0.14, w * 0.14); } // holo and up: a small black square
    } else if (value) { ctx.fillStyle = heat(c.price); ctx.fillRect(sx, sy + h - Math.max(1.5, h * 0.1), w, Math.max(1.5, h * 0.1)); }
    if (dealOn) { const s = Math.max(3, w * 0.4); ctx.fillStyle = theme.deal; ctx.fillRect(sx + w - s, sy, s, s); }
    return;
  }
  if (flood < 1) emptyPocket(c, sx, sy, w, h, value);
  if (flood > 0) {
    ctx.save();
    if (flood < 1) { ctx.beginPath(); ctx.rect(sx, sy + h * (1 - flood), w, h * flood); ctx.clip(); } // the card fills its pocket from the bottom up
    cardFace(c, sx, sy, w, h, now, value);
    ctx.restore(); curFont = "";
  }
}
// An empty pocket: a plain grey field (its rules are the grid's), and once you can read it, what it is and costs.
function emptyPocket(c, sx, sy, w, h, value) {
  const dealOn = c.deal && isChase(c) && !state.time;
  ctx.fillStyle = theme.slot; ctx.fillRect(sx, sy, w, h);
  if (dealOn || value) { ctx.lineWidth = Math.max(2, w * 0.025); ctx.strokeStyle = dealOn ? theme.deal : heat(c.price); ctx.strokeRect(sx + ctx.lineWidth / 2, sy + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth); }
  if (w < 44) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "right";
  if (dealOn) { ctx.fillStyle = theme.deal; font(700, w * 0.085); ctx.fillText(short(c.deal), sx + w - pad, sy + pad + w * 0.07); font(500, w * 0.06); ctx.fillText("live", sx + w - pad, sy + pad + w * 0.15); }
  else { ctx.fillStyle = value ? heat(c.price) : theme.muted; font(600, w * 0.08); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
  // the type, as on the wall: a square in the corner
  const s = w * 0.12; ctx.globalAlpha *= 0.5; ctx.fillStyle = typeColor(c); ctx.fillRect(sx + pad, sy + pad, s, s); ctx.globalAlpha /= 0.5;
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, w * 0.085); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - w * 0.075);
  font(500, w * 0.062); ctx.fillText(fitText(`${sets[c.si].code} ${c.num}/${sets[c.si].printed}${c.tag ? ` ${c.tag}` : ""}`, w - pad * 2), sx + pad, sy + h - pad);
}

// ----- a set's binder: the header a colour field, the pockets a ruled grid -----
function drawHeader(st, now, C = cam, ox = 0, alpha = 1) {
  const sx = (st.x - C.x) * C.s + ox, sy = (st.y - C.y) * C.s, sw = st.w * C.s;
  const k = (st.head * C.s) / (headH() + (st.popH || 0)), hh = headH() * k;
  const owned = ownedNow(st.cards), n = st.cards.length, f = finishOf(st);
  ctx.globalAlpha = alpha * (state.focus ? 1 - state.dimAll * 0.7 : 1);
  const a0 = ctx.globalAlpha;
  const flat = landPhone(), half = tight(st) ? 0 : (GAP * st.sz * C.s) / 2;
  // the band: from just under the top strip to just over the pockets
  const bx = sx - half, bw = sw + half * 2, by = sy + hh * (flat ? 0.08 : 0.16), bh = hh * (flat ? 0.66 : 0.72), lw = clamp(RULE * k, 2, 8);
  const t = ticksOf(st), timed = state.time, have = timed ? owned : t.owned, all = timed ? n : t.n;
  let frac = all ? have / all : 0;
  if (f && st.finT && !reduced) { const p = clamp((now - st.finT) / 600, 0, 1); frac = st.finFrom + (1 - st.finFrom) * (1 - Math.pow(1 - p, 3)); if (p < 1) kick(); }
  const P = fieldOf(st), fw = bw * frac;
  ctx.fillStyle = theme.panelFill; ctx.fillRect(bx, by, bw, bh);
  if (!timed && t.chased && have < all && !picking()) { ctx.globalAlpha = a0 * 0.3; ctx.fillStyle = P.col; ctx.fillRect(bx + fw, by, bw * t.chased / all, bh); ctx.globalAlpha = a0; }
  if (fw > 0) { ctx.fillStyle = P.col; ctx.fillRect(bx, by, fw, bh); if (fw < bw - 1) { ctx.fillStyle = theme.rule; ctx.fillRect(bx + fw - lw / 4, by, lw / 2, bh); } }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const F = { x: bx, y: by, w: fw, h: bh, on: P.on }, tx = sx + 12 * k;
  const title = clamp((flat ? 22 : 30) * k, 15, 58), sub = clamp(13 * k, 10, 22);
  let roomW = sw - 24 * k; if (flat) for (const b of [st.hdrBtn, st.hdrBtn2]) if (b && b.y < 0) roomW = Math.min(roomW, (b.x - 12) * k - 12 * k);
  font(700, title);
  const name = fitText(f ? trophyName(st) : st.name, roomW), nameW = flat ? textW(name) + 10 * k : 0;
  twoTone(() => ctx.fillText(name, tx, by + bh * (flat ? 0.62 : 0.5)), F, theme.ink);
  font(500, sub);
  const line = state.time ? `${owned} of ${n} by ${monthOf(state.t)}` : f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(st.base || st.cards))}.${f.put ? "" : " On the wall."}` : st.sub() + orderNote(st);
  if (!flat) { const l = fitText(line, roomW); twoTone(() => ctx.fillText(l, tx, by + bh * 0.8), F, theme.ink); }
  else if (roomW - nameW > 40 * k) { const l = fitText(line, roomW - nameW); twoTone(() => ctx.fillText(l, tx + nameW, by + bh * 0.62), F, theme.ink); }
  ctx.lineWidth = lw; ctx.strokeStyle = theme.rule; ctx.strokeRect(bx, by, bw, bh);
  drawNextPin(st, bx, by + bh - Math.max(1.5, 3 * k), bw, Math.max(1.5, 3 * k), now, k); // the next trophy hangs from the band's foot
  const ca = headChrome(k);
  if (ca > 0) {
    ctx.globalAlpha = a0 * ca;
    if (st.natdex && !f?.put && k >= 0.3) drawDexRow(st, sx, sy + hh, k, ctx.globalAlpha);
    if (st.popChips) drawPopRow(st, sx, sy + hh, k, ctx.globalAlpha);
    else if ((st.chase || f) && k >= 0.3) { for (const b of [st.hdrBtn, st.hdrBtn2]) if (b) drawHdrBtn(st, b, sx, sy + hh + b.y * k, k, ctx.globalAlpha); ctx.textBaseline = "alphabetic"; }
    ctx.globalAlpha = a0;
  }
  binderGrid(st, C, ox, a0);
  if (st.burst) {
    const p = (now - st.burst) / 1400;
    if (p < 1) { if (reduced) ctx.globalAlpha = 0; else ctx.globalAlpha = a0 * 0.35 * Math.sin(Math.PI * p); ctx.fillStyle = theme["m-yellow"]; ctx.fillRect(bx, by, bw, bh); } // a finish: the band flashes yellow (no sweep)
    else st.burst = 0;
  }
  ctx.globalAlpha = 1;
}
// The pockets' rules: a black line down every gap between columns and across every gap between visible rows. Under the
// cards (they never cover a gap), so a slide, a pinch or a card up close needs nothing more.
function binderGrid(g, C, ox, alpha) {
  if (tight(g) || alpha < 0.02) return;
  const gx = GAP * g.sz, sxS = stepX(g), syS = stepY(g), rows = Math.ceil(g.cards.length / g.cols);
  const X = (wx) => (wx - C.x) * C.s + ox, Y = (wy) => (wy - C.y) * C.s;
  const lw = clamp(gx * C.s * 0.42, 1.5, 9), x0 = X(-gx / 2), x1 = X(g.cols * sxS - gx / 2);
  if (x1 < 0 || x0 > vw) return;
  const r0 = Math.max(0, Math.floor((C.y - g.head) / syS)), r1 = Math.min(rows, Math.ceil((C.y + vh / C.s - g.head) / syS) + 1);
  const ya = Y(g.head + r0 * syS - gx / 2), yb = Y(g.head + Math.min(rows, r1) * syS - gx / 2);
  if (yb < 0 || ya > vh) return;
  ctx.globalAlpha = alpha; ctx.fillStyle = theme.rule;
  const top = Math.max(-lw, ya), bot = Math.min(vh + lw, yb);
  for (let i = 0; i <= g.cols; i++) { const x = X(i * sxS - gx / 2); if (x < -lw || x > vw + lw) continue; ctx.fillRect(x - lw / 2, top - lw / 2, lw, bot - top + lw); }
  for (let j = r0; j <= r1 && j <= rows; j++) { const y = Y(g.head + j * syS - gx / 2); if (y < -lw || y > vh + lw) continue; ctx.fillRect(x0 - lw / 2, y - lw / 2, x1 - x0 + lw, lw); }
  ctx.globalAlpha = 1;
}
function drawSet(g, now, C = cam, ox = 0, alpha = 1) {
  ctx.globalAlpha = alpha; ctx.fillStyle = theme.panelFill; // the binder's ground: off-white behind the pockets
  if (!tight(g)) { const gx = GAP * g.sz, a = { x: (-gx / 2 - C.x) * C.s + ox, y: (g.head - gx / 2 - C.y) * C.s }, b = { x: (g.cols * stepX(g) - gx / 2 - C.x) * C.s + ox, y: (g.h + gx / 2 - C.y) * C.s }; ctx.fillRect(a.x, Math.max(-10, a.y), b.x - a.x, Math.min(vh + 10, b.y) - Math.max(-10, a.y)); }
  ctx.globalAlpha = 1;
  drawHeader(g, now, C, ox, alpha);
  if (shuffle && shuffle.g === g) {
    for (const c of g.cards) {
      if (c === state.focus) continue;
      const k = ease(clamp((now - shuffle.t0 - c.delay) / shuffle.dur, 0, 1));
      const x = c.px + (c.x - c.px) * k, y = c.py + (c.y - c.py) * k;
      const r = { x: (x - C.x) * C.s + ox, y: (y - C.y) * C.s, w: TW * c.sz * C.s, h: TH * c.sz * C.s };
      if (r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
      drawTile(c, r.x, r.y, r.w, r.h, now, alpha);
    }
    return;
  }
  const y0 = C.y, y1 = C.y + vh / C.s;
  const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
  for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
    const c = g.cards[k];
    if (c === state.focus) continue;
    const r = binderRect(c, C, ox);
    if (r.x > vw || r.x + r.w < 0) continue;
    drawTile(c, r.x, r.y, r.w, r.h, now, alpha);
  }
}
