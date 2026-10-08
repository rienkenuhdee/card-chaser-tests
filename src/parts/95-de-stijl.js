// ---------- round 23, radical: De Stijl. The app is one painting ----------
// The rooms map is a single Mondrian: black rules, white fields, a few primary fields, each room one rectangle of it.
// Pinching out of the wall resolves it into the painting along straight lines (across first, then up and down); a
// pinch into a rectangle carries its rules out to the screen's edges, and the rules carry on inside: the wall's
// panels, the trophy room's shelves and the pages are fields cut by the same black rules. Trophies are Bauhaus
// primitives. Type is a geometric system sans. Nothing moves on a diagonal, nothing bounces.

// ----- type: a geometric system sans, no web fonts; one width (the geometry is the point), but a name that would be cut short steps down first -----
const DS_FONT = '"Futura", "Futura PT", "Avenir Next", "Avenir", "Century Gothic", "URW Gothic", "TeX Gyre Adventor", "Helvetica Neue", Arial, sans-serif';
// A narrower setting, only for a name that would otherwise be cut short.
const DS_NARROW = `"Avenir Next Condensed", "Futura Condensed", "Roboto Condensed", "sans-serif-condensed", "Arial Narrow", ${DS_FONT}`;
let dsReq = null; // a name's font (font(w, size, true)): fitText steps down from it before it cuts the name short
function font(weight, size, name = false) {
  const px = Math.round(size * 2) / 2, key = `${weight}|${px}`;
  dsReq = name && px <= 17 ? { weight: weight > 700 ? 700 : weight, px, key } : null; // big headers stay as they are
  if (key === curFont) return;
  curFont = key; ctx.font = `${weight > 700 ? 700 : weight} ${px}px ${DS_FONT}`;
}
// A name that doesn't fit at its size steps down a little (to 85%), then takes the narrower setting (down to 80%),
// and only then is cut short. A name that fits is drawn exactly as before. Decided once per name, size and width.
const dsFits = new Map();
function fitText(t, max) {
  const R = dsReq;
  if (!R) return fitPlain(t, max);
  const key = `${R.key}|${Math.round(max)}|${t}`;
  let v = dsFits.get(key);
  if (!v) { // measured with as few font changes as can be (setting ctx.font is the expensive part): widths scale with size
    const at = (fam, px, n) => { const k = `${R.weight}|${px}${n ? "|n" : ""}`; if (k !== curFont) { curFont = k; ctx.font = `${R.weight} ${px}px ${fam}`; } return { k, f: `${R.weight} ${px}px ${fam}` }; };
    const wd = () => ctx.measureText(t).width;
    const step = (fam, n, cur, from, lo) => { // the largest half-pixel size from `from` down to lo that fits, or null (cur: the size set now)
      let px = Math.min(from, Math.floor(((cur * max) / wd()) * 2) / 2);
      while (px >= lo) { const f = at(fam, px, n); if (wd() <= max) return { t, ...f }; px -= 0.5; }
      return null;
    };
    v = { t, ...at(DS_FONT, R.px, false) };
    if (wd() > max) {
      const lo = Math.max(8, Math.round(R.px * 0.85 * 2) / 2), lo2 = Math.max(8, Math.round(R.px * 0.8 * 2) / 2);
      v = step(DS_FONT, false, R.px, R.px - 0.5, lo);
      if (!v) { at(DS_NARROW, lo, true); v = step(DS_NARROW, true, lo, lo, lo2); }
      if (!v) { v = { t, ...at(DS_NARROW, lo2, true) }; v.t = fitPlain(t, max).replace(/\s+…$/, "…"); }
    }
    if (dsFits.size > 4000) dsFits.clear();
    dsFits.set(key, v);
  }
  if (curFont !== v.k) { ctx.font = v.f; curFont = v.k; }
  return v.t;
}
function fitPlain(t, max) { // the base's fit: cut short with an ellipsis, in the font that's set
  const key = `${curFont}|${Math.round(max)}|${t}`;
  let v = fitCache.get(key);
  if (v != null) return v;
  if (ctx.measureText(t).width <= max) v = t;
  else { let s = t; while (s.length > 2 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1); v = s + "…"; }
  if (fitCache.size > 6000) fitCache.clear();
  fitCache.set(key, v); return v;
}
document.fonts?.ready.then(() => { dsFits.clear(); fitCache.clear(); dsPlates.clear(); });
function fontOn(x, weight, size) { x.font = `${weight > 700 ? 700 : weight} ${Math.round(size * 2) / 2}px ${DS_FONT}`; }

// ----- every corner a right angle (circles stay circles: they're drawn with arc) -----
function rr(x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); }
function rrOn(x, px, py, w, h) { x.beginPath(); x.rect(px, py, w, h); }

// ----- colour -----
// The rule, read with the rest of the theme.
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "slot", "slot-line", "ink", "muted", "deal", "gold", "panel", "panel-solid", "paper", "paper-ink", "plaque", "plaque-ink", "plaque-hi", "plaque-lo", "room-bg", "room-bg2", "room-wood", "room-wood-hi", "room-ink", "room-muted", "room-plaque", "room-plaque-ink", "room-plaque-lo", "room-up", "room-down", "c-red", "c-yellow", "c-green", "c-blue", "m-surface", "rule"]) theme[k] = cs.getPropertyValue(`--${k}`).trim();
  theme.panelFill = cs.getPropertyValue("--panel-fill").trim();
  theme.rule ||= "#121212";
  if (typeof heatCache !== "undefined") heatCache.clear();
  theme.dark = cs.colorScheme === "dark" || matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
  TYPE.D[1] = theme.dark ? "#4A4A56" : "#1F1F25"; // Darkness stays black in the light, and is still seen in the dark
}
// Color by type needs eleven hues, so it uses the Bauhaus's own answer, Itten's colour wheel: the three elemental
// types are the primaries, the next three the secondaries, two more tertiaries, and the colourless ones black and greys.
// Flat, unmodulated, as a painter mixes them.
for (const [k, c] of Object.entries({ F: "#D1281D", W: "#1E4C9E", L: "#F2C300", G: "#2F8F46", P: "#6E3F9E", X: "#E5731A", N: "#2E8A86", Y: "#C23A78", D: "#1F1F25", M: "#7C8B99", C: "#B3AB97", t: "#6B675F", e: "#999488" })) TYPE[k][1] = c;
// Color by value: four fields, not a gradient. Under a dollar grey, then blue, yellow and red by the decade.
function heat0(p) {
  if (p < 1) return theme.dark ? "#5A5650" : "#BDB6A6";
  return p < 10 ? theme["c-blue"] || "#1E4C9E" : p < 100 ? theme["c-yellow"] || "#F2C300" : theme["c-red"] || "#D1281D";
}
// Medal tiers in the primaries (the bar's notch and the mint's flash read these).
MD_TIERS.bronze = ["#1E4C9E", "#1E4C9E"]; MD_TIERS.silver = ["#D1281D", "#D1281D"]; MD_TIERS.gold = ["#F2C300", "#C99A00"]; MD_TIERS.holo = ["#F2C300", "#1E4C9E"];
// The nearest primary to a colour (a set's ink), or none: green and the greys stay white fields.
const dsHue = new Map();
function dsPrimaryOf(col) {
  let v = dsHue.get(col); if (v !== undefined) return v;
  v = null;
  if (/^#[0-9a-f]{6}$/i.test(col || "")) {
    const [r, g, b] = hex(col), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d > 46) {
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
      v = h < 42 || h >= 300 ? "c-red" : h < 80 ? "c-yellow" : h < 170 ? null : "c-blue";
    }
  }
  dsHue.set(col, v); return v;
}
const dsOn = (field) => (field === "c-yellow" ? "#121212" : "#FFFFFF"); // type on a primary field
const dsLerp = (a, b, k) => a + (b - a) * k;
// A move in two straight lines: across first, then up or down (sizes follow the whole move). k: 0 to 1, not eased.
function dsLerpL(A, B, k) {
  const kx = ease(clamp(k / 0.6, 0, 1)), ky = ease(clamp((k - 0.4) / 0.6, 0, 1)), ks = ease(k);
  return { x: A.x + (B.x - A.x) * kx, y: A.y + (B.y - A.y) * ky, w: A.w + (B.w - A.w) * ks, h: A.h + (B.h - A.h) * ks };
}

// ---------- the wall: panels are fields, the gutters between them are rules ----------
const DS_WR = 4; // the wall's rule
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m), k = 1;
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) { const raw = clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1); k = ease(raw); m = dsLerpL(mr(g.pm), m, raw); }
  if (m.y > vh || m.y + m.h < 0) return;
  if (inCase(g)) {
    if (room.on) { drawRoomPlaque(g, m, now, alpha, labelAlpha); return; }
    if (k < 1 && m.h >= 30) drawPlaque(g, m, now, alpha * (1 - k), 0);
    return;
  }
  if (g.done || g.minting) { drawPlaque(g, m, now, alpha, labelAlpha); return; }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.panelFill; ctx.fillRect(m.x, m.y, m.w, m.h);
  if (g.unmint && k < 1) drawPlaque(g, m, now, alpha * (1 - k), 0);
  const x = m.x + PG + 10, w = m.w - PG * 2 - 20, size = clamp(m.w * 0.075, 12, 17), hb = PG + LABEL - 4;
  let beat = null;
  if (g.beat) { const p = (now - g.beat.t0) / 3000; if (p < 1) beat = { text: g.beat.text, col: g.beat.col || theme.deal, a: Math.min(1, p * 10, (1 - p) * 4) }; else g.beat = null; }
  font(beat ? 700 : 600, size * 0.82);
  const stat = beat ? fitText(beat.text, w * 0.72) : panelStat(g), sw = stat ? textW(stat) : 0;
  // the stat's field in the panel's corner: the set's colour, if it has a primary in it
  const bw = Math.min(m.w * 0.5, Math.max(44, sw + 22)), bx = m.x + m.w - bw, field = beat ? null : dsPrimaryOf(g.ink);
  ctx.globalAlpha = alpha * labelAlpha;
  if (field) { ctx.fillStyle = theme[field]; ctx.fillRect(bx, m.y, bw, hb); }
  ctx.fillStyle = theme.rule; ctx.fillRect(bx - DS_WR / 2, m.y, DS_WR, hb); ctx.fillRect(bx, m.y + hb - DS_WR / 2, bw, DS_WR);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(700, size, true); ctx.fillText(fitText(g.name, bx - x - 8), x, m.y + PG + 22);
  if (stat) {
    ctx.textAlign = "center"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? beat.col : field ? dsOn(field) : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, bx + bw / 2, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha; ctx.textAlign = "left";
  }
  drawBar(g, x, m.y + PG + 30, bx - x - 12, 3, now);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = DS_WR; ctx.strokeStyle = theme.rule; ctx.strokeRect(m.x, m.y, m.w, m.h); // half in this field, half in the next: one rule
  if (state.press?.g === g) { ctx.lineWidth = 3; ctx.strokeStyle = theme["c-red"]; ctx.strokeRect(m.x + 4, m.y + 4, m.w - 8, m.h - 8); }
  ctx.globalAlpha = 1;
}

// A deal landing on a card: the tint and a square spreading from it, but no pop (nothing bounces).
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  drawTile0(c, sx, sy, w, h, now, mult);
  if (c.reg && w >= 34 && view === "set") dexRegionTag(c, sx, sy, w, mult);
  if (c.pop && view === "set" && groups[c.g]?.set && w >= 14 && c.e > 0.3 && (!state.focus || state.focus === c)) { // a chased favourite: a triangle in the corner
    const s = clamp(w * 0.36, 4, 18);
    ctx.globalAlpha = Math.min(1, mult) * c.e * 0.9; ctx.fillStyle = theme.gold;
    ctx.beginPath(); ctx.moveTo(sx + w - s, sy); ctx.lineTo(sx + w, sy); ctx.lineTo(sx + w, sy + s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (showNow() === "missing" && !c.owned && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
    ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = c.deal && !state.time ? theme.deal : theme.gold;
    ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1); ctx.globalAlpha = 1;
  }
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = col; ctx.globalAlpha = a * tint;
  ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1));
  if (fp) { const e = reduced ? 4 : 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.strokeRect(sx - e, sy - e, w + e * 2, h + e * 2); }
  ctx.globalAlpha = 1;
}

// Rearranging inside a set: every card travels across, then down.
function drawSet(g, now, C = cam, ox = 0, alpha = 1) {
  drawHeader(g, now, C, ox, alpha);
  if (shuffle && shuffle.g === g) {
    for (const c of g.cards) {
      if (c === state.focus) continue;
      const raw = clamp((now - shuffle.t0 - c.delay) / shuffle.dur, 0, 1), kx = ease(clamp(raw / 0.6, 0, 1)), ky = ease(clamp((raw - 0.4) / 0.6, 0, 1));
      const x = c.px + (c.x - c.px) * kx, y = c.py + (c.y - c.py) * ky;
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

// The frame, as the base draws it, with the open and the rearrange moving every tile along two straight lines.
function frame(now) {
  raf = 0; frameFoil = false;
  if (roomsFrame(now)) return;
  if (tbl.on && tbl.q >= 1 && !tbl.anim) { drawTable(now); return; }
  const dt = Math.min(48, now - (lastFrame || now)); lastFrame = now;
  let more = stepFly(now);
  if (stepInertia(dt)) more = true;
  if (view === "set" && !state.trans && !fly) clampCam(state.g);
  for (const c of drawnCards) { const t = emphasis(c); if (Math.abs(c.e - t) > 0.005) { c.e += (t - c.e) * Math.min(1, dt / 90); more = true; } else c.e = t; }
  const dimT = state.focus ? 1 : 0;
  if (Math.abs(state.dimAll - dimT) > 0.01) { state.dimAll += (dimT - state.dimAll) * Math.min(1, dt / 110); more = true; } else state.dimAll = dimT;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  const T = state.trans;
  if (T) {
    let p = T.kind === "open" ? 0 : clamp((now - T.t0) / T.dur, 0, 1), e = ease(p);
    if (T.kind === "open") {
      if (T.anim) { const a = clamp((now - T.anim.t0) / T.anim.dur, 0, 1); T.q = T.anim.from + (T.anim.to - T.anim.from) * (1 - Math.pow(1 - a, 3)); p = a; } else p = 0;
      const q = T.q;
      drawMosaic(now, 1 - q, T.g);
      drawPanel(T.g, now, 1 - q, 1 - q);
      drawHeader(T.g, now, T.cam, 0, clamp((q - 0.6) / 0.4, 0, 1));
      for (const c of T.g.cards) {
        if (c === state.focus) continue;
        const k = clamp(q * 1.15 - (c.k / T.g.cards.length) * 0.15, 0, 1);
        const r = dsLerpL(mr(c.m), binderRect(c, T.cam), k);
        if (r.y > vh + 40 || r.y + r.h < -40) continue;
        drawTile(c, r.x, r.y, r.w, r.h, now);
      }
    } else if (T.kind === "slide") {
      drawSet(T.from, now, T.fromCam, -T.dir * vw * e, 1 - e * 0.6);
      drawSet(T.g, now, cam, T.dir * vw * (1 - e), 0.4 + e * 0.6);
      const sx = T.dir > 0 ? vw * (1 - e) : vw * e; ctx.globalAlpha = 1; ctx.fillStyle = theme.rule; ctx.fillRect(sx - DS_WR / 2, 0, DS_WR, vh); // the seam between two sets is a rule
    } else if (T.kind === "morph") {
      for (const g of groups) drawPanel(g, now, 1, clamp((p - 0.55) / 0.45, 0, 1));
      for (const c of drawnCards) {
        const raw = clamp((now - T.t0 - c.delay) / (T.dur - 520), 0, 1), r = dsLerpL(mr(c.pm), mr(c.m), raw);
        drawTile(c, r.x, r.y, r.w, r.h, now);
      }
    }
    if (p >= 1 && (T.kind !== "open" || T.anim)) { const done = T.done; state.trans = null; done?.(T); }
    more = true;
  } else if (view === "mosaic") {
    drawMosaic(now);
    for (const g of groups) if (g.ripple && now - g.ripple.t0 < 1600) more = true;
  } else if (state.g) {
    drawSet(state.g, now);
    if (state.g.burst || (state.g.ripple && now - state.g.ripple.t0 < 1600)) more = true;
    for (const c of state.g.cards) if (c.anim) { more = true; break; }
  }
  if (state.matches && view === "mosaic" && !T && !bnd.on) { // search hits: a square around each
    ctx.lineWidth = 2; ctx.strokeStyle = theme.ink;
    for (const c of state.matches) { const s = Math.max(6, c.m.h * 0.7); ctx.strokeRect(c.m.x + c.m.w / 2 - s, c.m.y - mScroll + c.m.h / 2 - s, s * 2, s * 2); }
  }
  if (state.focus) { const c = state.focus, r = binderRect(c, cam); ctx.globalAlpha = 1; drawTile(c, r.x, r.y, r.w, r.h, now); if (c.anim) more = true; if (c.owned && c.tier >= 3 && !reduced) more = true; }
  ctx.globalAlpha = 1;
  for (const c of drawnCards) if (c.anim) { more = true; break; }
  drawMarks(); drawPicks();
  if (drawRings(now)) more = true;
  if (drawMints(now)) more = true;
  if (drawLive(now)) more = true;
  if (drawPop(now)) more = true;
  if (drawFlights(now)) more = true;
  if (tbl.on) drawTable(now);
  if (frameFoil) more = true;
  if (state.press) more = true;
  if (state.introT0 && now - state.introT0 < 3000 && !reduced) more = true;
  if (more) kick();
}

// ---------- the trophy room: its panels are fields in the same rules ----------
function drawRoom(now, alpha = 1, except = null) {
  const L = room.L; if (!L) return;
  live.line = null;
  ctx.globalAlpha = alpha; ctx.fillStyle = theme["room-bg"]; ctx.fillRect(0, 0, vw, vh);
  const R = L.R, pg = state.press?.g;
  for (const it of L.items) {
    const y = it.y - mScroll; if (y > vh || y + it.h < 0) continue;
    if (it.type === "header") {
      ctx.drawImage(headerImage(R.w, it.h), R.x - PADR, y - PADR, R.w + PADR * 2, it.h + PADR * 2);
      const sy = y + it.h - 3; // the room's yellow field, as on the map, held between two rules
      ctx.fillStyle = theme.rule; ctx.fillRect(0, sy, vw, 14); ctx.fillStyle = theme["c-yellow"]; ctx.fillRect(0, sy + 3, vw, 8);
    } else if (it.type === "row") ctx.drawImage(mdRowImage(it), it.x - PADR, y - PADR, it.w + PADR * 2, it.h + PADR * 2);
    else mdDrawItem(it, y, pg && it.blk === pg);
    ctx.globalAlpha = alpha;
  }
  ctx.lineWidth = 3; ctx.strokeStyle = theme.rule;
  for (const it of L.items) { if (it.type !== "box") continue; const y = it.y - mScroll; if (y > vh || y + it.h < 0) continue; ctx.strokeRect(it.x + 1.5, y + 1.5, it.w - 3, it.h - 3); }
  for (const g of room.plaques) {
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h + (g === room.fan ? stackOf(g).length * SUB_H : 0) - mScroll < 0) continue;
    drawPanel(g, now, alpha);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha);
  }
  if (pg?.mdt) for (const h of L.hits) if (h.blk === pg && !h.type) { ctx.lineWidth = 2; ctx.strokeStyle = theme["room-ink"]; ctx.strokeRect(h.x + 2, h.y - mScroll + 2, h.w - 4, h.h - 4); }
  ctx.globalAlpha = 1;
}

// ---------- trophies: Bauhaus primitives ----------
// The role is the shape (Kandinsky's three), so every shelf has a mix: a signature trophy, one only that set or chase
// has, is a square; a milestone as it fills (half, 75%, the last three, complete) is a circle; a goal inside it (Holo
// hunter, Chase cards, Clean sweep) and anything else is a triangle. The tier is the colour, blue, red, yellow, and a
// holo is all three, and it's counted in notches under the shape: one, two, three, four. Each sits on a white plate in
// a black rule, on a black plinth with its short name. Luck changes the plate: Critical cuts a black corner, Shiny
// turns the ground black. A signature trophy wears a red block.
const dsShapeOf = (t) => (t.sig ? "square" : t.mile ? "circle" : "triangle");
const DS_TIER = { bronze: "c-blue", silver: "c-red", gold: "c-yellow" };
const DS_NOTCH = { bronze: 1, silver: 2, gold: 3, holo: 4 };
const DS_TIER_NAME = { bronze: "bronze", silver: "silver", gold: "gold", holo: "holo" };
// each notch's x: 6 square, 3 apart, centred under the shape at y 76 (clear of its foot, inside the plate)
const dsNotches = (t) => { const n = DS_NOTCH[t.tier] || 1, w = n * 6 + (n - 1) * 3; return Array.from({ length: n }, (_, i) => 50 - w / 2 + i * 9); };
function dsPrim(x, shape, cx, cy, s) {
  x.beginPath();
  if (shape === "circle") x.arc(cx, cy, s, 0, Math.PI * 2);
  else if (shape === "square") x.rect(cx - s * 0.9, cy - s * 0.9, s * 1.8, s * 1.8);
  else { x.moveTo(cx, cy - s * 1.1); x.lineTo(cx + s * 1.1, cy + s * 0.8); x.lineTo(cx - s * 1.1, cy + s * 0.8); x.closePath(); }
}
// The plinth's short name, fitted: as before when it fits (11, in a plinth 60 wide); else a smaller size (down to 9),
// then a wider plinth (up to the plate's width), then the narrower setting, and only then cut short. Measured once.
const dsPlates = new Map();
let dsPlateX = null;
function dsPlate(text) {
  let v = dsPlates.get(text); if (v) return v;
  const x = (dsPlateX ||= document.createElement("canvas").getContext("2d"));
  const W = (px, fam = DS_FONT) => { x.font = `700 ${px}px ${fam}`; return x.measureText(text).width; };
  const mk = (px, w, fam = DS_FONT, t = text) => ({ px, w, fam, narrow: fam !== DS_FONT, t, y: px === 11 ? 108.5 : 104 + px * 0.41 });
  for (let px = 11; px >= 9 && !v; px -= 0.5) if (W(px) <= 54) v = mk(px, 60);
  if (!v) { const w = W(9); if (w <= 82) v = mk(9, Math.min(88, 2 * Math.ceil((w + 6) / 2))); }
  if (!v) { const w = W(9, DS_NARROW); if (w <= 82) v = mk(9, Math.min(88, 2 * Math.ceil((w + 6) / 2)), DS_NARROW); }
  if (!v) { x.font = `700 9px ${DS_NARROW}`; v = mk(9, 88, DS_NARROW, fitOn(x, text, 82)); }
  dsPlates.set(text, v); return v;
}
function paintMedal(x, t, mode) {
  const locked = mode === "locked", C = (h) => (locked ? mdGrey(h) : h);
  const shape = dsShapeOf(t), rank = mode ? "" : MD_RANK[t.rank] ? t.rank : "", ink = "#121212";
  const red = C(theme["c-red"] || "#D1281D"), yel = C(theme["c-yellow"] || "#F2C300"), blu = C(theme["c-blue"] || "#1E4C9E");
  const ground = rank === "shiny" ? ink : C(theme["m-surface"] || "#FBFAF6");
  x.globalAlpha = locked ? 0.38 : mode === "lit" ? 0.78 : 1;
  x.fillStyle = ink; x.fillRect(6, 6, 88, 88);
  x.fillStyle = ground; x.fillRect(13, 13, 74, 74);
  if (t.tier === "holo") {
    x.save(); dsPrim(x, shape, 50, 50, 23); x.clip();
    x.fillStyle = red; x.fillRect(20, 20, 20, 60); x.fillStyle = yel; x.fillRect(40, 20, 20, 60); x.fillStyle = blu; x.fillRect(60, 20, 20, 60);
    x.restore();
  } else { x.fillStyle = { "c-blue": blu, "c-red": red, "c-yellow": yel }[DS_TIER[t.tier] || "c-blue"]; dsPrim(x, shape, 50, 50, 23); x.fill(); }
  x.fillStyle = rank === "shiny" ? "#FFFFFF" : ink; for (const nx of dsNotches(t)) x.fillRect(nx, 76, 6, 6); // the tier, counted
  if (rank === "crit") { x.fillStyle = ink; x.beginPath(); x.moveTo(62, 13); x.lineTo(87, 13); x.lineTo(87, 38); x.closePath(); x.fill(); }
  // the plinth, with its short name
  x.fillStyle = ink;
  if (t.plate) {
    const P = dsPlate(String(t.plate));
    x.fillRect(50 - P.w / 2, 94, P.w, 20);
    x.fillStyle = "#fff"; x.font = `700 ${P.px}px ${P.fam}`; x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText(P.t, 50, P.y);
  } else x.fillRect(40, 94, 20, 12);
  if (t.hidden) { x.beginPath(); x.arc(18, 18, 11, 0, Math.PI * 2); x.fillStyle = ink; x.fill(); x.fillStyle = "#fff"; fontOn(x, 700, 14); x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText("?", 18, 23); }
  if (t.sig) { x.fillStyle = red; x.fillRect(38, -4, 24, 12); x.lineWidth = 2; x.strokeStyle = ink; x.strokeRect(38, -4, 24, 12); }
  x.globalAlpha = 1; x.textAlign = "left";
}
function medalSvg(t, { locked = false, cls = "" } = {}) {
  const shape = dsShapeOf(t), rank = locked ? "" : MD_RANK[t.rank] ? t.rank : "", g = `md${++mdSvgN}`;
  const prim = (f, extra = "") => (shape === "circle" ? `<circle cx="50" cy="50" r="23" fill="${f}"${extra}/>` : shape === "square" ? `<rect x="29.3" y="29.3" width="41.4" height="41.4" fill="${f}"${extra}/>` : `<path d="M50 24.7 L75.3 68.4 L24.7 68.4 Z" fill="${f}"${extra}/>`);
  const body = t.tier === "holo"
    ? `<clipPath id="${g}c">${prim("#000")}</clipPath><g clip-path="url(#${g}c)"><rect x="20" y="20" width="20" height="60" fill="var(--c-red)"/><rect x="40" y="20" width="20" height="60" fill="var(--c-yellow)"/><rect x="60" y="20" width="20" height="60" fill="var(--c-blue)"/></g>`
    : prim(`var(--${DS_TIER[t.tier] || "c-blue"})`);
  const notches = dsNotches(t).map((nx) => `<rect x="${nx}" y="76" width="6" height="6" fill="${rank === "shiny" ? "#FFFFFF" : "#121212"}"/>`).join("");
  const P = t.plate ? dsPlate(String(t.plate)) : null;
  const plate = P ? `<rect x="${50 - P.w / 2}" y="94" width="${P.w}" height="20" fill="#121212"/><text x="50" y="${P.y.toFixed(2)}" text-anchor="middle" fill="#fff" font-size="${P.px}" font-weight="700" style="font-family:var(${P.narrow ? "--font-narrow" : "--font"})">${mdEsc(P.t)}</text>` : `<rect x="40" y="94" width="20" height="12" fill="#121212"/>`;
  const tier = DS_TIER_NAME[t.tier] || "";
  return `<svg class="medal ${cls} ${locked ? "locked" : ""} tier-${t.tier} ${rank ? `rank-${rank}` : ""}" viewBox="0 0 100 124" role="img" aria-label="${mdEsc(t.name)}, ${tier} trophy${locked ? " (not yet earned)" : rank ? `, ${MD_RANK[rank]}` : ""}">
    <rect x="6" y="6" width="88" height="88" fill="#121212"/><rect x="13" y="13" width="74" height="74" fill="${rank === "shiny" ? "#121212" : "var(--m-surface)"}"/>
    ${body}${notches}
    ${rank === "crit" ? `<path d="M62 13 L87 13 L87 38 Z" fill="#121212"/>` : ""}
    ${plate}
    ${t.hidden ? `<circle cx="18" cy="18" r="11" fill="#121212"/><text x="18" y="23" text-anchor="middle" font-size="14" font-weight="700" fill="#fff" style="font-family:var(--font)">?</text>` : ""}
    ${t.sig ? `<rect x="38" y="-4" width="24" height="12" fill="var(--c-red)" stroke="#121212" stroke-width="2"/>` : ""}</svg>`;
}
function mdPill(rank) { // Critical and Shiny, as flat tags
  const key = `${rank}|${dpr}|ds`; let p = mdPills.get(key); if (p) return p;
  const w = rank === "shiny" ? 44 : 54, h = 15, cv = document.createElement("canvas"); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  const x = cv.getContext("2d"); x.scale(dpr, dpr);
  x.fillStyle = rank === "shiny" ? "#121212" : theme["c-yellow"] || "#F2C300"; x.fillRect(0, 0, w, h);
  x.lineWidth = 1; x.strokeStyle = "#121212"; x.strokeRect(0.5, 0.5, w - 1, h - 1);
  x.fillStyle = rank === "shiny" ? "#fff" : "#121212"; fontOn(x, 700, 9); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(MD_RANK[rank].toUpperCase(), w / 2, h / 2 + 0.5);
  p = { cv, w, h }; mdPills.set(key, p); return p;
}

// ---------- the map: one painting ----------
const DS = { HEAD: 58, LENS: 46 };
const dsRW = () => (landPhone() ? 5 : 6);
function mapLayout() {
  const key = `${vw}|${vh}|${botPad()}|${SAFE.left}|${SAFE.right}|${SAFE.bottom}|ds`;
  if (mapUI.L?.key === key) return mapUI.L;
  if (landPhone()) return (mapUI.L = mapAcross(key));
  const RW = dsRW(), top = topPad() - 2, bottom = vh - 34, avail = bottom - top;
  const fH = Math.round(clamp(avail * 0.2, 128, 178)), sH = Math.round(clamp(avail * 0.155, 108, 142));
  const my = top + fH + RW, mh = avail - fH - sH - RW * 2;
  const B = wallBand(), asp = B.w / B.h;
  let thH = mh - DS.HEAD - DS.LENS - RW * 2, thW = thH * asp;
  const cMax = vw * (vw < 700 ? 0.58 : 0.62);
  if (thW > cMax) { thW = cMax; thH = thW / asp; }
  const cw = Math.round(thW), rx = cw + RW, rw = vw - rx, th = Math.round((mh - RW) * 0.5);
  const r = {
    feed: { x: 0, y: top, w: vw, h: fH },
    chase: { x: 0, y: my, w: cw, h: mh },
    trade: { x: rx, y: my, w: rw, h: th },
    medal: { x: rx, y: my + th + RW, w: rw, h: mh - th - RW },
    source: { x: 0, y: my + mh + RW, w: vw, h: sH },
  };
  const thumb = { x: 0, y: my + DS.HEAD + RW, w: cw, h: thH };
  return (mapUI.L = { key, r, thumb, RW, top, bottom, hintY: vh - 13 });
}
function mapAcross(key) {
  const RW = dsRW(), x0 = SAFE.left, W = vw - SAFE.left - SAFE.right, top = topPad() - 2, bottom = vh - SAFE.bottom - 28, h = bottom - top;
  const B = wallBand(), asp = B.w / B.h, U = W - RW * 3;
  let cw = Math.round(Math.min(U * 0.42, U - 3 * 150)), thW = cw, thH = thW / asp;
  const maxH = h - DS.HEAD - DS.LENS - RW * 2;
  if (thH > maxH) { thH = maxH; thW = thH * asp; cw = Math.round(thW); }
  const sw = Math.round((U - cw) / 3), fx = x0, cx = fx + sw + RW, tx = cx + cw + RW, sx = tx + sw + RW, sW = x0 + W - sx, th = Math.round((h - RW) / 2);
  const r = {
    feed: { x: fx, y: top, w: sw, h },
    chase: { x: cx, y: top, w: cw, h },
    trade: { x: tx, y: top, w: sw, h: th },
    medal: { x: tx, y: top + th + RW, w: sw, h: h - th - RW },
    source: { x: sx, y: top, w: sW, h },
  };
  const thumb = { x: cx, y: top + DS.HEAD + RW, w: cw, h: thH };
  return { key, r, thumb, RW, top, bottom, hintY: vh - SAFE.bottom - 10 };
}
// A field's frame: the rule around it, as wide as the painting's rules (adjacent frames make one rule).
function dsFrame(r, RW) { ctx.fillStyle = theme.rule; ctx.fillRect(r.x - RW, r.y - RW, r.w + RW * 2, r.h + RW * 2); }
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
function cardFrame(id, w, h, fill = theme["panel-solid"]) { ctx.fillStyle = fill; ctx.fillRect(0, 0, w, h); }
function cardTitle(id, w, line, { ink = theme.ink, muted = theme.muted, col = null } = {}) { dsTitle(ROOM_NAME[id], 14, w - 28, ink, col || muted, line); }
function pill(text, x, y, fill, ink) { // a small square tag; x is its right edge
  font(700, 10); const w = textW(text) + 12, px = x - w;
  ctx.fillStyle = fill; ctx.fillRect(px, y, w, 17);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = ink; ctx.fillText(text, px + w / 2, y + 12.5); ctx.textAlign = "left";
  return w;
}
// Feed: a blue field with the count standing in it, and the newest listings in the white beside it, cut by rules.
PAINT.feed = function (w, h) {
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
  ctx.fillStyle = theme.rule;
  for (let i = 0; i < n; i++) {
    const x = vert ? fx : fx + i * step, y = vert ? fy + i * step : fy;
    if (vert ? y + th > h : x >= w) break;
    feedChip(F.list[i], x, y, tw, th, now);
    ctx.fillStyle = theme.rule; if (vert) ctx.fillRect(fx, y + th, fw, thin); else ctx.fillRect(x + tw, fy, thin, fh);
  }
  return { fx, fy, fw, fh, step, vert, tw, th };
};
function feedChip(L, x, y, w, h, now) {
  const c = L.c, bare = h < 80 && w < 160, ch = h - 20, cw = bare ? -10 : ch * TW / TH;
  if (!bare) { foilOff = true; cardFace(c, x + 10, y + 10, cw, ch, now, false); foilOff = false; }
  ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const tx = x + 10 + cw + 10, tw = x + w - 8 - tx, low = h < 80, fresh = isNewL(L);
  if (fresh) { ctx.fillStyle = theme["c-blue"]; ctx.fillRect(x + w - 14, y + 6, 8, 8); } // new: a blue square in the corner
  ctx.fillStyle = theme.deal; font(700, 18); ctx.fillText(fitText(short(L.price), tw - 10), tx, y + (low ? 23 : 28));
  font(600, 12); ctx.fillText(fitText(`${pctOf(L)}% under`, tw), tx, y + (low ? 38 : 45));
  ctx.fillStyle = theme.ink; font(700, 13); ctx.fillText(fitText(c.name, tw), tx, y + h - (low ? 21 : 26));
  ctx.fillStyle = theme.muted; font(500, 11); const src = srcName(L.src, true), full = `${src} · ${agoText(L.seen, Date.now())}`; ctx.fillText(textW(full) <= tw ? full : fitText(src, tw), tx, y + h - (low ? 7 : 10));
}
// Trophies: a yellow field with the name, then the rarest you've earned standing on a rule.
PAINT.medal = function (w, h) {
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
  ctx.fillStyle = theme.ink; font(700, 13.5);
  const best = E.length ? `Rarest: ${E[0].name}${MD_RANK[E[0].rank] ? `, ${MD_RANK[E[0].rank]}` : ""}` : "Fill a set to earn one";
  const lead = wrapLines(best, w - 28, 2);
  lead.forEach((l, i) => { if (!i || y + 17 < h - 8) ctx.fillText(l, 14, y + i * 17); });
  if (lead.length > 1) y += 17;
  if (next && y + 34 < h) {
    y += 19; ctx.fillStyle = theme.muted; font(500, 12.5);
    wrapLines(`Next: ${next.t.name}, ${next.left} to go`, w - 28, 2).forEach((l, i) => { if (y + i * 16 < h - 6) ctx.fillText(l, 14, y + i * 16); });
  }
};
// Source: its switches in the white, and a small blue field at the end with the circle that looks.
const dsBaseSource = PAINT.source;
PAINT.source = function (w, h) {
  const RW = mapLayout().RW, vert = h > w * 1.3, bw = vert ? w : Math.round(clamp(w * 0.2, 64, 110)), bh = vert ? Math.round(clamp(h * 0.2, 60, 90)) : h;
  const ex = dsBaseSource(vert ? w : w - bw - RW, vert ? h - bh - RW : h);
  const bx = vert ? 0 : w - bw, by = vert ? h - bh : 0;
  ctx.fillStyle = theme.rule; if (vert) ctx.fillRect(0, by - RW, w, RW); else ctx.fillRect(bx - RW, 0, RW, h);
  ctx.fillStyle = theme["c-blue"]; ctx.fillRect(bx, by, bw, bh);
  ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh / 2, Math.min(bw, bh) * 0.26, 0, Math.PI * 2); ctx.fillStyle = srcState.alerts ? theme["c-yellow"] : "#FFFFFF"; ctx.fill();
  return ex;
};
// A card on the map: its picture, and what moves on it (the Feed's newest sliding in along its strip, Source's clock).
function drawCard(id, r, now, a) {
  if (id === "chase") return drawChaseCard(r, now, a);
  const b = baked.get(id); if (!b) return false;
  const k = r.w / b.w;
  ctx.globalAlpha = a;
  let more = false;
  ctx.drawImage(b.cv, r.x, r.y, r.w, r.h);
  if (id === "feed" && mapUI.feedIn && b.extra?.step && !reduced) {
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
  if (id === "source") {
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
// Chase: a red field with its name, the wall itself under a rule, and the lenses under another.
function dsChaseGeom(r) { // the thumbnail inside a Chase card drawn at r
  const L = mapLayout(), A = L.r.chase, kx = r.w / A.w, ky = r.h / A.h;
  return { x: r.x + (L.thumb.x - A.x) * kx, y: r.y + (L.thumb.y - A.y) * ky, w: L.thumb.w * kx, h: L.thumb.h * ky };
}
function drawChaseCard(r, now, a) {
  const D = dsChaseGeom(r);
  ctx.globalAlpha = a; ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(r.x, r.y, r.w, r.h);
  wallThumb(D, now);
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
// The Chase card's chrome around its picture of the wall. head: how far its red field has come down (1 at rest).
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
    if (on) { ctx.fillStyle = theme["c-yellow"]; ctx.fillRect(cx, by, sw, bh); }
    if (i) { ctx.fillStyle = theme.rule; ctx.fillRect(cx - RW / 2, by, RW, bh); }
    ctx.fillStyle = on ? "#121212" : theme.muted; ctx.fillText(fitText(LENS_NAMES[k], sw - 8), cx + sw / 2, by + bh / 2 + 5);
  });
  ctx.textAlign = "left";
  const near = R.y + R.h - (by + bh) >= 56 ? nearestSet() : null;
  if (near) {
    ctx.fillStyle = theme.rule; ctx.fillRect(R.x, by + bh, R.w, RW);
    ctx.fillStyle = theme.muted; font(600, 12); ctx.fillText(fitText("Closest to done", R.w - 28), R.x + 14, by + bh + RW + 20);
    ctx.fillStyle = theme.ink; font(700, 14); ctx.fillText(fitText(`${near.g.name}, ${near.left} to go`, R.w - 28), R.x + 14, by + bh + RW + 39);
  }
  ctx.globalAlpha = 1;
}
function chaseLensAt(x, y) {
  const L = mapLayout(), R = L.r.chase, by = L.thumb.y + L.thumb.h + L.RW;
  if (y < by || y > by + DS.LENS || x < R.x || x > R.x + R.w) return null;
  return LENSES[clamp(Math.floor(((x - R.x) / R.w) * LENSES.length), 0, LENSES.length - 1)];
}
// The map at rest: the painting.
function drawMap(now) {
  prepCards();
  const L = mapLayout(), RW = L.RW;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  for (const id of ROOMS) dsFrame(L.r[id], RW);
  let more = false;
  for (const id of ROOMS) if (drawCard(id, L.r[id], now, 1)) more = true;
  const pr = mapUI.press && L.r[mapUI.press];
  if (pr) { ctx.lineWidth = 4; ctx.strokeStyle = theme.ink; ctx.strokeRect(pr.x + 2, pr.y + 2, pr.w - 4, pr.h - 4); }
  const kr = mapUI.kb >= 0 && L.r[ROOMS[mapUI.kb]];
  if (kr) { ctx.lineWidth = 5; ctx.strokeStyle = theme["c-red"]; ctx.strokeRect(kr.x + 2.5, kr.y + 2.5, kr.w - 5, kr.h - 5); }
  drawMapHint(1);
  return more;
}

// ----- moving between a room and the map, along straight lines -----
// q: 0 the room, 1 the map. Up to the map the room narrows to its column first, then closes to its row; into a room
// it's the reverse (a room that already spans the screen one way moves in one phase). Every field carries its own
// rules, so the rules ride out to the screen's edges with it. The painting is never empty part way: while the room
// narrows it keeps its full size, cut by its edges like a window, and only shrinks into its card as it closes to its
// row; and the rest of the painting is cut along the room's column (dsPieces), so whatever stands beside the column
// arrives whole in the first phase, at its own height, and what is above and below the room comes in with its edges in
// the second.
function dsAxes(q, A) {
  if (reduced) { const s = q < 0.5 ? 0 : 1; return [s, s]; }
  if (A.w >= vw * 0.9 || A.h >= vh * 0.7) { const e = ease(q); return [e, e]; }
  return [ease(clamp(q / 0.6, 0, 1)), ease(clamp((q - 0.4) / 0.6, 0, 1))];
}
// The geometry of a move at q: the room's field R (the screen, narrowing, then closing to its card), what's drawn into
// it (D: the room at its own size until it closes, then shrinking to the card's width), and how far the card's own face
// has come up (fb).
function mapGeom(T, use) {
  const L = mapLayout(), A = L.r[T.room], q = clamp(T.q, 0, 1), [ex, ey] = dsAxes(q, A);
  const R = { x: A.x * ex, y: A.y * ey, w: dsLerp(vw, A.w, ex), h: dsLerp(vh, A.h, ey) };
  const k = dsLerp(1, A.w / vw, ey), D = { x: R.x, y: R.y - (topPad() - 8) * k * ey, w: vw * k, h: vh * k };
  const fb = reduced ? (q < 0.5 ? 0 : 1) : clamp((q - 0.55) / 0.4, 0, 1);
  use(R, D, fb, ease(q), L, A, ex, ey);
}
// Where another room stands while one moves (A its place on the map, R where it is now), as up to three pieces cut
// along A's column: the piece in the column moves up or down with R's edge, the pieces beside it sideways with R's
// sides. Each: the strip [x0, x1] of the room's frame on the map, and how far it has moved.
function dsPieces(r, A, R, RW) {
  const c0 = A.x - RW / 2, c1 = A.x + A.w + RW / 2, l = r.x - RW, rt = r.x + r.w + RW, out = [];
  const dxL = R.x - A.x, dxR = R.x + R.w - A.x - A.w, dy = r.y + r.h <= A.y ? R.y - A.y : R.y + R.h - A.y - A.h;
  if (l < c0) out.push({ x0: l, x1: Math.min(rt, c0), dx: dxL, dy: 0, w0: 0 });
  if (rt > c0 && l < c1) out.push({ x0: Math.max(l, c0), x1: Math.min(rt, c1), dx: dxL, dy, w0: rt > c1 ? R.w - A.w : 0 }); // stretched to R's width while it's still narrowing
  if (rt > c1) out.push({ x0: Math.max(l, c1), x1: rt, dx: dxR, dy: 0, w0: 0 });
  return out;
}
function drawPieces(k, r, A, R, RW, now) {
  const P = dsPieces(r, A, R, RW);
  for (const p of P) {
    const x0 = p.x0 + p.dx, x1 = p.x1 + p.dx + p.w0, y0 = r.y - RW + p.dy, y1 = r.y + r.h + RW + p.dy;
    if (x0 > vw || x1 < 0 || y0 > vh || y1 < 0) continue;
    const f = { x: r.x + p.dx, y: r.y + p.dy, w: r.w, h: r.h };
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    dsFrame(f, RW); drawCard(k, f, now, 1);
    ctx.restore(); curFont = "";
  }
  // Where two pieces of one room have parted, the cut between them is a rule.
  ctx.fillStyle = theme.rule;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i]; if (Math.abs(a.dy - b.dy) < 0.5) continue;
    ctx.fillRect(b.x0 + b.dx - RW / 2, r.y - RW + Math.min(a.dy, b.dy), RW, r.h + RW * 2 + Math.abs(a.dy - b.dy));
  }
}
function drawMapTrans(now, T) {
  prepCards();
  mapGeom(T, (R, D, fb, e, L, A, ex, ey) => {
    const id = T.room, RW = L.RW, q = clamp(T.q, 0, 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
    if (q > 0.005) for (const k of ROOMS) if (k !== id) drawPieces(k, L.r[k], A, R, RW, now);
    drawMapHint(clamp((q - 0.75) / 0.25, 0, 1));
    dsFrame(R, RW);
    if (id === "chase") { // the wall becomes the card's picture; its red field comes down from above and its lenses ride its foot
      const B = wallBand(), s = dsLerp(1, L.thumb.w / B.w, ey), Wd = { x: R.x + dsLerp(B.x, L.thumb.x - A.x, ey), y: dsLerp(B.y, L.thumb.y, ey), w: B.w * s, h: B.h * s };
      ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      ctx.save(); ctx.beginPath(); ctx.rect(Wd.x, Wd.y, Wd.w, Wd.h); ctx.clip();
      if (q >= 0.999) wallThumb(Wd, now); else drawRoomAt("chase", B, Wd, now);
      ctx.restore(); curFont = "";
      chaseChrome(R, now, 1, Wd, reduced ? (q < 0.5 ? 0 : 1) : ease(clamp(q / 0.35, 0, 1)));
      ctx.restore(); curFont = "";
      return;
    }
    // Another room: it narrows into its field, and the field's face comes up through it.
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    ctx.fillStyle = id === "medal" ? theme["room-bg"] : theme.bg; ctx.fillRect(R.x, R.y, R.w, R.h);
    if (fb > 0 || PAGES[id]) { const kk = R.w / A.w; ctx.fillStyle = theme["panel-solid"]; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.setTransform(dpr * kk, 0, 0, dpr * kk, dpr * R.x, dpr * R.y); drawCard(id, { x: 0, y: 0, w: A.w, h: A.h }, now, 1); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (id === "medal" && fb < 1) { ctx.globalAlpha = 1 - fb; drawRoomAt("medal", SCREEN(), D, now); }
    ctx.restore(); curFont = ""; ctx.globalAlpha = 1;
    if (PAGES[id]) pageAt(PAGES[id], R, D, 1 - fb);
  });
  ctx.globalAlpha = 1;
}
// A page in a move: scaled into D and cut square to its field R.
function pageAt(el, R, D, a) {
  const k = D.w / vw, l = (R.x - D.x) / k, t = (R.y - D.y) / k, w = R.w / k, h = R.h / k;
  el.style.transform = `translate(${D.x.toFixed(2)}px, ${D.y.toFixed(2)}px) scale(${k.toFixed(4)})`;
  el.style.clipPath = `inset(${t.toFixed(1)}px ${(vw - l - w).toFixed(1)}px ${(vh - t - h).toFixed(1)}px ${l.toFixed(1)}px)`;
  el.style.opacity = a.toFixed(3);
}
// Room to room sideways: the seam between them is a rule.
function drawHop(now, T) {
  const e = hopE(T, now);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, vw, vh);
  for (const [id, ox] of hopPos(T, e)) {
    if (PAGES[id]) PAGES[id].style.transform = `translateX(${ox.toFixed(1)}px)`;
    else if (ox > -vw && ox < vw) drawRoomAt(id, SCREEN(), { x: ox, y: 0, w: vw, h: vh }, now);
  }
  const sx = T.dir > 0 ? vw * (1 - e) : vw * e, RW = dsRW();
  ctx.fillStyle = theme.rule; ctx.fillRect(sx - RW / 2, 0, RW, vh);
}
// Debug builds only: the tests check every nameplate fits its plinth.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { medalSvg: { value: medalSvg }, dsPlate: { value: dsPlate } }); }, 0);
