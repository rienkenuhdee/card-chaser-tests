// ---------- drawing ----------
const canvas = document.getElementById("wall");
const ctx = canvas.getContext("2d");
let dpr = 1, theme = {};
const FONT = '"Archivo", "Helvetica Neue", Arial, system-ui, sans-serif';
// Archivo has a width axis: condensed for names and titles, normal for numbers.
// Setting a canvas font is slow, so it's only set when it changes (sizes rounded to half a pixel).
let curFont = "";
function font(weight, size, narrow = false) {
  const px = Math.round(size * 2) / 2, key = `${weight}|${px}|${narrow}`;
  if (key === curFont) return;
  curFont = key; ctx.font = `${weight} ${px}px ${FONT}`;
  if ("fontStretch" in ctx) ctx.fontStretch = narrow ? "semi-condensed" : "normal";
}
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "slot", "slot-line", "ink", "muted", "deal", "gold", "panel", "panel-solid", "paper", "paper-ink"]) theme[k] = cs.getPropertyValue(`--${k}`).trim();
  theme.panelFill = cs.getPropertyValue("--panel-fill").trim();
  if (typeof heatCache !== "undefined") heatCache.clear();
  theme.dark = cs.colorScheme === "dark" || matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
}
function resize() {
  vw = innerWidth; vh = innerHeight; dpr = Math.min(3, devicePixelRatio || 1);
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  layoutAll();
  if (view === "set" && state.g) { const f = fitCam(state.g); if (!state.focus) { cam.s = Math.max(cam.s, f.s); } clampCam(state.g); }
  kick();
}

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const shade = (h, t) => mix(h, t > 0 ? "#FFFFFF" : "#000000", Math.abs(t));
let engravingPattern = null;
function engraving() {
  if (engravingPattern) return engravingPattern;
  const c = document.createElement("canvas"); c.width = c.height = 8;
  const x = c.getContext("2d"); x.strokeStyle = "rgb(255 255 255 / .09)"; x.lineWidth = 1;
  x.beginPath(); x.moveTo(0, 8); x.lineTo(8, 0); x.moveTo(-4, 4); x.lineTo(4, -4); x.moveTo(4, 12); x.lineTo(12, 4); x.stroke();
  return (engravingPattern = ctx.createPattern(c, "repeat"));
}
const lightCache = new Map();
const lighter = (h) => { let v = lightCache.get(h); if (!v) { v = shade(h, 0.18); lightCache.set(h, v); } return v; };
const typeColor = (c) => (TYPE[c.type] || TYPE.C)[1];
// Value lens: cheap is cool and quiet, expensive glows gold to hot.
const heatCache = new Map();
function heat(p) { const k = Math.round(p * 20); let v = heatCache.get(k); if (!v) { v = heat0(p); heatCache.set(k, v); } return v; }
function heat0(p) {
  const t = clamp((Math.log10(Math.max(p, 0.1)) + 1) / 3.9, 0, 1);
  return t < 0.5 ? mix(theme.dark ? "#5C66A8" : "#9AA5D4", "#E8B53A", t * 2) : mix("#E8B53A", "#FF4F2E", (t - 0.5) * 2);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
// Fitting a name into a width, remembered per font and width (measuring text every frame is slow).
const fitCache = new Map();
function fitText(t, max) {
  const key = `${curFont}|${Math.round(max)}|${t}`;
  let v = fitCache.get(key);
  if (v != null) return v;
  if (ctx.measureText(t).width <= max) v = t;
  else { let s = t; while (s.length > 2 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1); v = s + "…"; }
  if (fitCache.size > 6000) fitCache.clear();
  fitCache.set(key, v); return v;
}

const state = { lens: "have", value: false, time: false, q: "", matches: null, focus: null, dimAll: 0, introT0: 0, trans: null, press: null, g: null };
// Where you are: the mosaic of everything, or inside one group (a set, a region, a price band).
let view = "mosaic";
try { const l = localStorage.getItem("wall-lens"); if (["have", "need", "chase", "trade"].includes(l)) state.lens = l; state.value = localStorage.getItem("wall-value") === "1"; } catch { /* default */ }
function emphasis(c) {
  if (c.away) return 0; // out on the trade table: its tile is empty
  if (preview) return preview.has(c.base || c) ? (c.owned ? 0.42 : 1) : 0.1; // the New chase form: what it would match
  if (state.matches) return state.matches.has(c.base || c) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.1 : 1;
  if (state.lens === "chase") return isChase(c) ? 1 : 0.18;
  if (state.lens === "trade") return isSpare(c) ? 1 : 0.18;
  return 1;
}

function drawTile(c, sx, sy, w, h, now, mult = 1) {
  // A deal just landed on this card: a flash (a pop, or two pulses for a price drop; still when motion is reduced).
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  drawTile0(c, sx, sy, w, h, now, mult);
  // Inside a set the cards people chase wear a gold corner.
  if (c.pop && view === "set" && groups[c.g]?.set && w >= 14 && c.e > 0.3 && (!state.focus || state.focus === c)) {
    const s = clamp(w * 0.36, 4, 18), r = w >= 26 ? w * 0.045 : 0;
    ctx.globalAlpha = Math.min(1, mult) * c.e * 0.8; ctx.fillStyle = theme.gold;
    ctx.beginPath(); ctx.moveTo(sx + w - s, sy); ctx.lineTo(sx + w - r, sy); ctx.lineTo(sx + w, sy + r); ctx.lineTo(sx + w, sy + s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // In the Need lens the cards you're chasing stand out further still: a gold ring.
  if (state.lens === "need" && !c.owned && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
    ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
  }
  // The green: the flash on the card that changed, and the ripple's tint on its neighbours.
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = col; ctx.globalAlpha = a * tint;
  if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
  if (fp) { // a ring spreads from the card, so it can be found in a dense wall
    const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col;
    rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawTile0(c, sx, sy, w, h, now, mult = 1) {
  const a0 = mult * c.e * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1);
  if (a0 < 0.02) return;
  let scale = 1;
  // The ripple when a card in this block is marked: it travels out from the card that changed.
  const st = groups[c.g];
  if (st.ripple) {
    const d = Math.hypot(c.col - st.ripple.col, c.row - st.ripple.row);
    const t = (now - st.ripple.t0 - d * 38) / 300;
    if (t > 0 && t < 1) scale = 1 + 0.075 * Math.sin(Math.PI * t);
  }
  if (state.press?.c === c) scale *= 1 - 0.07 * clamp((now - state.press.t0) / 420, 0, 1);
  let intro = 1;
  if (state.introT0 && !reduced) intro = clamp((now - state.introT0 - c.intro) / 360, 0, 1);
  if (intro <= 0) return;
  const alpha = a0 * intro;
  if (scale !== 1 || intro < 1) {
    const k = scale * (0.86 + 0.14 * intro);
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  ctx.globalAlpha = alpha;
  // A chased card out in front: while its tile is wider than it is tall it reads as a feed tile (the deal, or the
  // most you'd pay); as it grows into the binder it becomes the card.
  if (c.lift && w > h * 1.05) { if (c.owned) drawSpareTile(c, sx, sy, w, h, alpha, now); else drawFeedTile(c, sx, sy, w, h, alpha, now); ctx.globalAlpha = 1; return; }
  const value = state.value && !state.matches;
  // Marking animation: the owned face floods in from the middle.
  let flood = c.owned ? 1 : 0;
  // The Time lens: a card floods in over the two weeks after you got it, so scrubbing reads as the wall filling up.
  if (state.time) flood = c.owned && c.got ? clamp((state.t - c.got) / (14 * 86400e3), 0, 1) : 0;
  else if (c.anim) {
    const p = clamp((now - c.anim.t0) / 460, 0, 1);
    const e = 1 - Math.pow(1 - p, 3);
    flood = c.anim.to ? e : 1 - e;
    if (p >= 1) c.anim = null;
  }
  if (w < 5) { // a heat map: one dot per card
    ctx.fillStyle = value ? (c.owned ? heat(c.price) : theme.slot) : flood > 0.5 ? typeColor(c) : theme.slot;
    if (!c.owned && c.deal && isChase(c) && (state.lens === "chase" || state.lens === "have")) ctx.fillStyle = theme.deal;
    ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1));
    return;
  }
  if (w < 26) { // binder at arm's length: shapes and colour (kept cheap: this draws a thousand times a frame)
    const r = w * 0.09, round = w >= 12;
    const dealOn = !c.owned && c.deal && isChase(c) && state.lens !== "need" && !state.time; // a deal is a property of a chase
    if (flood < 1) {
      ctx.fillStyle = theme.slot;
      if (round) { rr(sx, sy, w, h, r); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = dealOn ? theme.deal : theme["slot-line"]; ctx.stroke(); }
      else { ctx.fillRect(sx, sy, w, h); if (dealOn) { ctx.strokeStyle = theme.deal; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1); } }
    }
    if (flood > 0) {
      const col = value ? heat(c.price) : typeColor(c);
      const partial = flood < 1;
      if (partial) { ctx.save(); ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, Math.hypot(w, h) / 2 * flood, 0, Math.PI * 2); ctx.clip(); }
      ctx.fillStyle = col;
      if (round) { rr(sx, sy, w, h, r); ctx.fill(); } else ctx.fillRect(sx, sy, w, h);
      ctx.fillStyle = lighter(col); ctx.fillRect(sx + r * 0.3, sy + r * 0.3, w - r * 0.6, h * 0.22);
      if (w > 12) { ctx.fillStyle = theme.paper; ctx.fillRect(sx + r * 0.3, sy + h * 0.78, w - r * 0.6, h * 0.2); }
      if (partial) ctx.restore();
    }
    if (value && !c.owned) { ctx.lineWidth = Math.max(1, w * 0.08); ctx.strokeStyle = heat(c.price); ctx.strokeRect(sx, sy, w, h); }
    if (dealOn && w > 9) { ctx.fillStyle = theme.deal; ctx.beginPath(); ctx.arc(sx + w * 0.8, sy + w * 0.2, Math.max(2, w * 0.12), 0, Math.PI * 2); ctx.fill(); }
    return;
  }
  // Close up: a card face for what you own, an empty pocket with its price for what you don't.
  if (flood < 1) emptyPocket(c, sx, sy, w, h, value);
  if (flood > 0) {
    ctx.save();
    if (flood < 1) { ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, Math.hypot(w, h) / 2 * flood, 0, Math.PI * 2); ctx.clip(); }
    cardFace(c, sx, sy, w, h, now, value);
    ctx.restore();
  }
}

// An empty pocket: a hairline outline, and once you can read it, what it is and what it costs to fill.
function emptyPocket(c, sx, sy, w, h, value) {
  const r = w * 0.045;
  const dealOn = c.deal && isChase(c) && state.lens !== "need" && !state.time;
  rr(sx, sy, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.strokeStyle = value ? heat(c.price) : dealOn ? theme.deal : theme["slot-line"];
  rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke();
  if (w < 44) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic";
  // price, top right
  ctx.textAlign = "right";
  if (dealOn) { ctx.fillStyle = theme.deal; font(700, w * 0.085); ctx.fillText(short(c.deal), sx + w - pad, sy + pad + w * 0.07); font(500, w * 0.06); ctx.fillText("live", sx + w - pad, sy + pad + w * 0.15); }
  else { ctx.fillStyle = value ? heat(c.price) : theme.muted; font(600, w * 0.08); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
  // label, bottom left
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, w * 0.088, true); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - w * 0.075);
  font(500, w * 0.064); ctx.fillText(`${sets[c.si].code} ${c.num}/${sets[c.si].printed}`, sx + pad, sy + h - pad);
}

// A card you own: a full-bleed colour chip with a printed label strip, like a specimen in a catalogue.
function cardFace(c, sx, sy, w, h, now, value) {
  const st = sets[c.si];
  const col = value ? heat(c.price) : typeColor(c);
  const r = w * 0.045;
  if (w > 90) { ctx.save(); ctx.shadowColor = "rgb(0 0 0 / .32)"; ctx.shadowBlur = w * 0.09; ctx.shadowOffsetY = w * 0.035; rr(sx, sy, w, h, r); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore(); }
  ctx.save(); rr(sx, sy, w, h, r); ctx.clip();
  const g = ctx.createLinearGradient(sx, sy, sx + w, sy + h);
  g.addColorStop(0, shade(col, 0.2)); g.addColorStop(0.55, col); g.addColorStop(1, shade(col, -0.28));
  ctx.fillStyle = g; ctx.fillRect(sx, sy, w, h);
  // Fine engraving: a few diagonal hairlines, quieter than a pattern.
  if (w > 60) { ctx.fillStyle = engraving(); ctx.fillRect(sx, sy, w, h); }
  // Foil: holos and up catch the light as the wall moves under your finger.
  // (Skipped while things are moving: nobody sees foil mid-gesture, and it's the costliest thing on a card.)
  if (c.tier >= 3 && !reduced && !foilOff && !state.trans && !fly && !inertia && !(tbl.on && tableMoving())) {
    frameFoil = true;
    const phase = ((now * 0.00005 + (sx + cam.x * cam.s * 0.25) * 0.0011) % 1 + 1) % 1;
    const fx = sx - w + phase * w * 3;
    const fg = ctx.createLinearGradient(fx, sy, fx + w * 0.9, sy + h);
    fg.addColorStop(0, "rgb(255 255 255 / 0)"); fg.addColorStop(0.38, "rgb(150 220 255 / .28)"); fg.addColorStop(0.5, "rgb(255 226 160 / .42)"); fg.addColorStop(0.62, "rgb(160 245 205 / .28)"); fg.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = fg; ctx.fillRect(sx, sy, w, h); ctx.globalCompositeOperation = "source-over";
  }
  // The label strip
  const lh = h * 0.24, ly = sy + h - lh;
  ctx.fillStyle = theme.paper; ctx.fillRect(sx, ly, w, lh);
  ctx.fillStyle = "rgb(0 0 0 / .14)"; ctx.fillRect(sx, ly, w, Math.max(1, w * 0.006));
  ctx.restore();
  // Secret and special rares wear a thin gold rule.
  if (c.tier >= 5) { rr(sx + w * 0.03, sy + w * 0.03, w * 0.94, h - lh - w * 0.04, r * 0.7); ctx.lineWidth = Math.max(1, w * 0.012); ctx.strokeStyle = "rgb(240 200 110 / .85)"; ctx.stroke(); }
  if (w < 40) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["paper-ink"];
  font(800, w * 0.092, true); ctx.fillText(fitText(c.name, w * 0.84), sx + pad, ly + lh * 0.46);
  font(500, w * 0.064); ctx.globalAlpha *= 0.7;
  ctx.fillText(`${st.code} ${c.num}/${st.printed}`, sx + pad, ly + lh * 0.82);
  ctx.textAlign = "right"; ctx.fillText(GLYPH[c.tier], sx + w - pad, ly + lh * 0.82);
  ctx.globalAlpha /= 0.7;
  if (value || w > 110) { ctx.textAlign = "right"; ctx.fillStyle = "rgb(255 255 255 / .92)"; font(700, w * 0.078); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
}

// A set's title inside the set view, drawn with whichever camera is in use (they differ mid-transition).
function drawHeader(st, now, C = cam, ox = 0, alpha = 1) {
  const sx = (st.x - C.x) * C.s + ox, sy = (st.y - C.y) * C.s, sw = st.w * C.s;
  const k = (st.head * C.s) / (132 + (st.popH || 0)), hh = 132 * k; // 1 at the framed zoom; the title block is 132 of the header
  const owned = ownedNow(st.cards), n = st.cards.length;
  ctx.globalAlpha = alpha * (state.focus ? 1 - state.dimAll * 0.7 : 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = clamp(34 * k, 16, 64), sub = clamp(14 * k, 10, 24);
  ctx.fillStyle = theme.ink; font(800, title, true);
  ctx.fillText(fitText(st.name, sw), sx, sy + hh * 0.5);
  const pct = `${Math.floor((owned / n) * 100)}%`;
  font(700, sub); const pw = ctx.measureText(pct).width;
  ctx.textAlign = "right"; ctx.fillStyle = theme.ink; ctx.fillText(pct, sx + sw, sy + hh * 0.72);
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(500, sub);
  const line = state.time ? `${owned} of ${n} by ${monthOf(state.t)}` : st.sub();
  ctx.fillText(fitText(line, sw - pw - 12), sx, sy + hh * 0.72);
  const by = sy + hh * 0.82, bh = Math.max(1.5, 3 * k);
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(sx, by, sw, bh);
  ctx.fillStyle = owned === n ? "#E2B33C" : st.ink; ctx.fillRect(sx, by, sw * (owned / n), bh);
  if (st.popChips) drawPopRow(st, sx, sy + hh, k, ctx.globalAlpha);
  else if (st.chase && st.hdrBtn && k >= 0.3) { drawHdrBtn(st, sx, sy + hh + st.hdrBtn.y * k, k, ctx.globalAlpha); ctx.textBaseline = "alphabetic"; }
  if (st.burst) {
    const p = (now - st.burst) / 1400;
    if (p < 1) {
      const fx = sx - sw + p * sw * 3;
      const g = ctx.createLinearGradient(fx, sy, fx + sw * 0.6, sy + st.h * C.s);
      g.addColorStop(0, "rgb(255 255 255 / 0)"); g.addColorStop(0.5, "rgb(255 220 140 / .4)"); g.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.globalCompositeOperation = theme.dark ? "screen" : "multiply"; ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, st.h * C.s); ctx.globalCompositeOperation = "source-over";
    } else st.burst = 0;
  }
  ctx.globalAlpha = 1;
}
const ownedNow = (list) => (state.time ? list.filter((c) => c.owned && c.got && c.got <= state.t).length : ownedIn(list));

// A mosaic panel: the group's name and how it's going, over a field of its cards.
function panelStat(g) {
  if (picking()) return "\u2003\u2003"; // the tick's place
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(c.base || c)).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
const mr = (r) => ({ x: r.x, y: r.y - mScroll, w: r.w, h: r.h });
function drawPanel(g, now, alpha = 1, labelAlpha = 1) {
  if (!g.m) return;
  let m = mr(g.m);
  // During a lens flight the panel travels too, from where it was to where it's going.
  const T = state.trans;
  if (T?.kind === "morph" && g.pm) {
    const k = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1)), a = mr(g.pm);
    m = { x: a.x + (m.x - a.x) * k, y: a.y + (m.y - a.y) * k, w: a.w + (m.w - a.w) * k, h: a.h + (m.h - a.h) * k };
  }
  if (m.y > vh || m.y + m.h < 0) return;
  ctx.globalAlpha = alpha;
  rr(m.x + PG, m.y + PG, m.w - PG * 2, m.h - PG * 2, 12);
  ctx.fillStyle = theme.panelFill; ctx.fill();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; ctx.stroke(); }
  ctx.globalAlpha = alpha * labelAlpha;
  const x = m.x + PG + 10, w = m.w - PG * 2 - 20;
  const size = clamp(m.w * 0.075, 12, 17);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  // For three seconds after a deal arrives in this panel, its header shows the card and the price, in green.
  let beat = null;
  if (g.beat) { const p = (now - g.beat.t0) / 3000; if (p < 1) beat = { text: g.beat.text, col: g.beat.col || theme.deal, a: Math.min(1, p * 10, (1 - p) * 4) }; else g.beat = null; }
  font(beat ? 700 : 600, size * 0.82);
  const stat = beat ? fitText(beat.text, w * 0.72) : panelStat(g), sw = stat ? textW(stat) + 8 : 0;
  font(800, size, true); ctx.fillText(fitText(g.name, w - sw), x, m.y + PG + 22);
  if (stat) {
    ctx.textAlign = "right"; font(beat ? 700 : 600, size * 0.82); ctx.fillStyle = beat ? beat.col : theme.muted;
    if (beat) ctx.globalAlpha = alpha * beat.a;
    ctx.fillText(stat, x + w, m.y + PG + 22);
    ctx.globalAlpha = alpha * labelAlpha;
  }
  const owned = ownedNow(g.cards), n = g.cards.length;
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, m.y + PG + 30, w, 2);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, m.y + PG + 30, w * owned / n, 2);
  ctx.globalAlpha = 1;
}
function drawMosaic(now, alpha = 1, except = null) {
  // While you pick your sets, the ones you haven't ticked sit back a little once you've ticked one.
  const pick = picking() && wel.picks.size > 0;
  let settling = false;
  for (const g of groups) {
    const t = pick && g.set && !wel.picks.has(g.set.id) ? 0.42 : 1;
    g.pe ??= 1;
    if (Math.abs(g.pe - t) > 0.01) { g.pe += (t - g.pe) * (reduced ? 1 : 0.16); settling = true; } else g.pe = t;
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    const a = alpha * g.pe;
    drawPanel(g, now, a);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, a);
  }
  if (!except && !state.trans) drawNewPanel(now, alpha);
  if (settling) kick();
}
// One group's binder through a camera, offset sideways (for the slide between sets).
const binderRect = (c, C, ox = 0) => ({ x: (c.x - C.x) * C.s + ox, y: (c.y - C.y) * C.s, w: TW * c.sz * C.s, h: TH * c.sz * C.s });
function drawSet(g, now, C = cam, ox = 0, alpha = 1) {
  drawHeader(g, now, C, ox, alpha);
  // The lens changed inside this set: every card travels from its old slot to its new one.
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
const monthOf = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric" });

let raf = 0, started = false, lastFrame = 0;
// A watchdog behind requestAnimationFrame: if the browser doesn't deliver a frame (a throttled tab, a stalled
// compositor), the next frame still happens, so a transition can never freeze half-way.
let watchdog = 0;
function kick() {
  welcomeSync(); // the welcome sheet follows every change on the wall
  if (raf) return;
  raf = requestAnimationFrame(frame);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; frame(performance.now()); } }, 120);
}
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
let frameFoil = false;
function frame(now) {
  raf = 0; frameFoil = false;
  if (tbl.on && tbl.q >= 1 && !tbl.anim) { drawTable(now); return; } // the table is its own level: nothing of the wall shows
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
      // Opening a group: its tiles leave the mosaic and grow into the binder; everything else fades back. q is how
      // open it is: a finger can hold it anywhere in between, and letting go animates it to 0 or 1.
      if (T.anim) { const a = clamp((now - T.anim.t0) / T.anim.dur, 0, 1); T.q = T.anim.from + (T.anim.to - T.anim.from) * (1 - Math.pow(1 - a, 3)); p = a; } else p = 0;
      const q = T.q;
      drawMosaic(now, 1 - q, T.g);
      drawPanel(T.g, now, 1 - q, 1 - q);
      drawHeader(T.g, now, T.cam, 0, clamp((q - 0.6) / 0.4, 0, 1));
      for (const c of T.g.cards) {
        if (c === state.focus) continue;
        const k = clamp(q * 1.15 - (c.k / T.g.cards.length) * 0.15, 0, 1);
        const kk = ease(k), B = binderRect(c, T.cam), A = mr(c.m);
        const x = A.x + (B.x - A.x) * kk, y = A.y + (B.y - A.y) * kk, w = A.w + (B.w - A.w) * kk, h = A.h + (B.h - A.h) * kk;
        if (y > vh + 40 || y + h < -40) continue;
        drawTile(c, x, y, w, h, now);
      }
    } else if (T.kind === "slide") {
      drawSet(T.from, now, T.fromCam, -T.dir * vw * e, 1 - e * 0.6);
      drawSet(T.g, now, cam, T.dir * vw * (1 - e), 0.4 + e * 0.6);
    } else if (T.kind === "morph") {
      // Rearranging: every tile travels to its place in the new mosaic, a beat apart.
      for (const g of groups) drawPanel(g, now, 1, clamp((p - 0.55) / 0.45, 0, 1));
      for (const c of drawnCards) {
        const k = ease(clamp((now - T.t0 - c.delay) / (T.dur - 520), 0, 1)), a = mr(c.pm), b2 = mr(c.m);
        drawTile(c, a.x + (b2.x - a.x) * k, a.y + (b2.y - a.y) * k, a.w + (b2.w - a.w) * k, a.h + (b2.h - a.h) * k, now);
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
  // Search hits in the mosaic: a ring around each one so they're easy to spot.
  if (state.matches && view === "mosaic" && !T) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink;
    for (const c of state.matches) { ctx.beginPath(); ctx.arc(c.m.x + c.m.w / 2, c.m.y - mScroll + c.m.h / 2, Math.max(6, c.m.h * 0.7), 0, Math.PI * 2); ctx.stroke(); }
  }
  if (state.focus) { const c = state.focus, r = binderRect(c, cam); ctx.globalAlpha = 1; drawTile(c, r.x, r.y, r.w, r.h, now); if (c.anim) more = true; if (c.owned && c.tier >= 3 && !reduced) more = true; }
  ctx.globalAlpha = 1;
  for (const c of drawnCards) if (c.anim) { more = true; break; }
  drawMarks(); drawPicks();
  if (drawLive(now)) more = true;
  if (drawPop(now)) more = true;
  drawTraders(now);
  if (drawFlights(now)) more = true;
  if (tbl.on) drawTable(now);
  if (frameFoil) more = true; // foil keeps shimmering while a foil card is on screen
  if (state.press) more = true;
  if (state.introT0 && now - state.introT0 < 3000 && !reduced) more = true;
  if (more) kick();
}
