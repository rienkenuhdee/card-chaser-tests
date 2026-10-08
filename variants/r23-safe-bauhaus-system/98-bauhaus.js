// ---------- round 23, safe: the Bauhaus system on the canvas ----------
// Futura (or the nearest geometric sans the phone has), square corners or perfect circles, flat colour.
const BH_FONT = '"Futura", "Futura PT", "Avenir Next", "Avenir", "Century Gothic", "Jost", "Helvetica Neue", Arial, sans-serif';
function font(weight, size, narrow = false) {
  const px = Math.round(size * 2) / 2, key = `${weight}|${px}|${narrow}`;
  if (key === curFont) return;
  curFont = key; ctx.font = `${weight} ${px}px ${BH_FONT}`;
  if ("fontStretch" in ctx) ctx.fontStretch = narrow ? "semi-condensed" : "normal";
}
function fontOn(x, weight, size, narrow = false) { x.font = `${weight} ${Math.round(size * 2) / 2}px ${BH_FONT}`; if ("fontStretch" in x) x.fontStretch = narrow ? "semi-condensed" : "normal"; }
// A rounded rectangle is a square one, unless it's square and fully rounded: then it's a circle. (Square is also the
// cheaper path: roundRect was the costliest part of a far-out frame.)
function rr(x, y, w, h, r) { ctx.beginPath(); bhRect(ctx, x, y, w, h, r); }
function rrOn(x, px, py, w, h, r) { x.beginPath(); bhRect(x, px, py, w, h, r); }
function bhRect(x, px, py, w, h, r) {
  if (r > 0 && Math.abs(w - h) < 0.5 && r >= w / 2 - 0.5) x.arc(px + w / 2, py + h / 2, w / 2, 0, Math.PI * 2);
  else x.rect(px, py, w, h);
}
// No soft shadow under a card: it sits flat on the page.
function faceShadow() {}
// Value, in four flat steps rather than a blend: cheap is quiet paper grey, then blue, yellow, and red for the most.
function heat0(p) {
  const t = clamp((Math.log10(Math.max(p, 0.1)) + 1) / 3.9, 0, 1);
  return t < 0.36 ? (theme.dark ? "#4A4740" : "#C9C1AE") : t < 0.56 ? (theme.dark ? "#5A8BE6" : "#1F4FA0") : t < 0.74 ? "#F2B705" : (theme.dark ? "#EC4636" : "#D7261E");
}
// Medals: a black ribbon for what mdFour can't place (black sets), and the primaries for everything else.
function mdFour(h) {
  const [r, g, b] = hex(h).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx < 0.35) return "green"; // the black token (the Trade room's colour)
  if (d < 0.25 * mx) return "blue";
  let hu = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hu = (hu * 60 + 360) % 360;
  return hu < 20 || hu >= 330 ? "red" : hu < 70 ? "yellow" : hu < 170 ? "green" : "blue";
}
const BH_BANDS = [[0, "#D7261E"], [0.333, "#D7261E"], [0.333, "#F2B705"], [0.666, "#F2B705"], [0.666, "#1F4FA0"], [1, "#1F4FA0"]]; // shiny: three hard bands
// Inks for saved chases, a medal's tiers, the shiny ring, the binder's cover: primaries and black, flat.
CHASE_INKS.splice(0, CHASE_INKS.length, "#F2B705", "#D7261E", "#1F4FA0", "#141414", "#D7261E", "#1F4FA0");
Object.assign(MD_TIERS, { bronze: ["#C9692C", "#7A3B12"], silver: ["#C8C9CC", "#6D7078"], gold: ["#F2B705", "#9C7300"], holo: ["#1F4FA0", "#141414"] });
MD_RAINBOW.splice(0, MD_RAINBOW.length, [0, "#D7261E"], [0.25, "#F2B705"], [0.5, "#1F4FA0"], [0.75, "#141414"], [1, "#D7261E"]);
Object.assign(MD_SHAPE, { set: "square", pokemon: "circle", artist: "triangle", region: "octagon", type: "diamond", rarity: "star", custom: "circle", dex: "square", global: "badge" });
COVER.light = ["#1A1A1A", "#1A1A1A", "#1A1A1A"]; COVER.dark = ["#2A2925", "#2A2925", "#2A2925"];


function drawnFace(c, sx, sy, w, h, now, value) {
  const st = sets[c.si];
  const col = value ? heat(c.price) : typeColor(c);
  const r = w * 0.045, full = c.tier >= 4, lh = h * 0.24, ly = sy + h - lh;
  if (w > 90) faceShadow(sx, sy, w, h);
  ctx.save(); rr(sx, sy, w, h, r); ctx.clip();
  // The art: a window inside the card's frame, or the whole card for a full art.
  const m = w * 0.075, energy = c.type === "e" && !full, trainer = c.type === "t" && !full;
  const ax = full ? sx : sx + m, ay = full ? sy : sy + m, aw = full ? w : w - m * 2, ah = full ? ly - sy : (ly - sy - m * 1.6) * (trainer ? 0.62 : 1);
  if (full) {
    // a full art: a flat field with one big disc off its centre, like a poster
    ctx.fillStyle = col; ctx.fillRect(sx, sy, w, h);
    ctx.beginPath(); ctx.arc(sx + w * 0.62, sy + (ly - sy) * 0.42, w * 0.42, 0, Math.PI * 2); ctx.fillStyle = darker(col); ctx.fill();
  } else {
    ctx.fillStyle = col; ctx.fillRect(sx, sy, w, h);
    if (energy) { // no window: the energy's symbol, a ring in the middle of the card
      const R = Math.min(w, ly - sy) * 0.3;
      ctx.beginPath(); ctx.arc(sx + w / 2, sy + (ly - sy) / 2, R, 0, Math.PI * 2); ctx.fillStyle = darker(col); ctx.fill();
      ctx.lineWidth = Math.max(1, R * 0.16); ctx.strokeStyle = "rgb(255 255 255 / .55)"; ctx.stroke();
    } else {
      ctx.fillStyle = darker(col); ctx.fillRect(ax, ay, aw, ah);
      ctx.fillStyle = "rgb(255 255 255 / .09)"; ctx.fillRect(ax, ay, aw, ah * 0.46); // light from above, so it reads as a picture
      if (trainer && w > 34) { ctx.fillStyle = "rgb(255 255 255 / .28)"; for (let i = 0; i < 3; i++) ctx.fillRect(ax, ay + ah + m * (0.9 + i * 0.75), aw * (i === 2 ? 0.55 : 1), Math.max(1, w * 0.018)); } // its text
    }
  }
  // A holo's window carries a sheen at rest; holos and up catch the light as the wall comes to rest under your finger.
  // (Skipped while things are moving: nobody sees foil mid-gesture, and it's the costliest thing on a card.)
  if (c.tier === 3 && !energy && w > 34) {
    ctx.fillStyle = "rgb(255 255 255 / .13)"; ctx.beginPath();
    ctx.moveTo(ax + aw * 0.3, ay); ctx.lineTo(ax + aw * 0.56, ay); ctx.lineTo(ax + aw * 0.26, ay + ah); ctx.lineTo(ax, ay + ah); ctx.closePath(); ctx.fill();
  }
  if (c.tier >= 3 && !reduced && !foilOff && !state.trans && !fly && !inertia && !(tbl.on && tableMoving())) {
    frameFoil = true;
    const phase = ((now * 0.00005 + (sx + cam.x * cam.s * 0.25) * 0.0011) % 1 + 1) % 1;
    const fx = ax - aw + phase * aw * 3;
    // foil as a hard-edged band of light crossing the window: flat, no blend
    ctx.save(); ctx.beginPath(); ctx.rect(ax, ay, aw, ah); ctx.clip();
    ctx.fillStyle = "rgb(255 255 255 / .26)"; ctx.beginPath();
    ctx.moveTo(fx + aw * 0.5, ay); ctx.lineTo(fx + aw * 0.78, ay); ctx.lineTo(fx + aw * 0.4, ay + ah); ctx.lineTo(fx + aw * 0.12, ay + ah); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (!full && !energy && w > 34) { ctx.lineWidth = 1; ctx.strokeStyle = "rgb(0 0 0 / .22)"; ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1); } // the window's edge
  // The label strip
  ctx.fillStyle = theme.paper; ctx.fillRect(sx, ly, w, lh);
  ctx.fillStyle = "rgb(0 0 0 / .14)"; ctx.fillRect(sx, ly, w, Math.max(1, w * 0.006));
  ctx.restore();
  // A full art wears a hairline inside its edge; secret and special rares wear it in gold.
  if (full) { rr(sx + w * 0.03, sy + w * 0.03, w * 0.94, h - lh - w * 0.045, r * 0.7); ctx.lineWidth = Math.max(1, w * 0.012); ctx.strokeStyle = c.tier >= 5 ? "#F2B705" : "rgb(255 255 255 / .5)"; ctx.stroke(); }
  if (w < 40) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["paper-ink"];
  font(800, w * 0.092, true); ctx.fillText(fitText(c.name, w * 0.84), sx + pad, ly + lh * 0.46);
  font(500, w * 0.064); ctx.globalAlpha *= 0.7;
  ctx.fillText(fitText(`${st.code} ${c.num}/${st.printed}${c.tag ? ` ${c.tag}` : ""}`, w * 0.62), sx + pad, ly + lh * 0.82);
  ctx.globalAlpha /= 0.7;
  // The rarity mark, printed where the card prints it: gold from holo up.
  ctx.textAlign = "right"; ctx.fillStyle = c.tier >= 3 ? theme.gold : theme["paper-ink"]; if (c.tier < 3) ctx.globalAlpha *= 0.7;
  ctx.fillText(GLYPH[c.tier], sx + w - pad, ly + lh * 0.82);
  if (c.tier < 3) ctx.globalAlpha /= 0.7;
  if (value || w > 110) { ctx.textAlign = "right"; ctx.fillStyle = "rgb(255 255 255 / .92)"; font(700, w * 0.078); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
}

function drawBar(g, x, y, w, h, now, k = 1) {
  const timed = state.time, t = ticksOf(g), f = finishOf(g);
  const owned = timed ? ownedNow(g.cards) : t.owned, n = timed ? g.cards.length : t.n;
  let frac = n ? owned / n : 0;
  if (f && g.finT && !reduced) { const p = clamp((now - g.finT) / 600, 0, 1); frac = g.finFrom + (1 - g.finFrom) * (1 - Math.pow(1 - p, 3)); }
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = owned === n ? theme.gold : g.ink === "#141414" ? theme.ink : g.ink; ctx.fillRect(x, y, w * frac, h);
  if (!timed && t.chased && owned < n && !picking()) {
    ctx.fillStyle = theme.gold;
    const th = h + 4 * k, ty = y - 2 * k;
    if (t.ticks.length > 8) ctx.fillRect(x + w * owned / n, ty, w * t.chased / n, th); // past a few, one gold stretch: this much of what's left is on your list
    else { const tw = Math.max(1, Math.min(2, (w / n) * 0.5)); for (const p of t.ticks) ctx.fillRect(x + w * p - tw / 2, ty, tw, th); }
  }
  if (f && g.finT && !reduced) { // a glint runs along the gold once
    const p = (now - g.finT - 350) / 900;
    if (p > 0 && p < 1) {
      const gx = x - w * 0.12 + p * w * 1.12, gw = Math.min(w * 0.12, x + w - gx); // a white block runs along the gold once
      if (gw > 0) { ctx.fillStyle = "rgb(255 255 255 / .85)"; ctx.fillRect(Math.max(x, gx), y - 1 * k, gw - Math.max(0, x - gx), h + 2 * k); }
    }
    if (now - g.finT < 1400) kick();
  }
}

function mdShape(shape, r, cx = 50, cy = 50) {
  const P = (pts) => "M" + pts.map(([x, y]) => `${(cx + x).toFixed(2)} ${(cy + y).toFixed(2)}`).join(" L") + " Z";
  const ring = (n, rot, f) => P(Array.from({ length: n }, (_, i) => { const a = (((i / n) * 360) + rot) * Math.PI / 180, q = f(i); return [Math.cos(a) * q, Math.sin(a) * q]; }));
  switch (shape) {
    case "square": return ring(4, -45, () => r * 1.18);
    case "triangle": return ring(3, -90, () => r * 1.22);
    case "hex": return ring(6, -90, () => r);
    case "octagon": return ring(8, -22.5, () => r);
    case "diamond": return ring(4, -90, () => r * 1.1);
    case "star": return ring(16, -90, (i) => (i % 2 ? r * 0.76 : r));
    case "badge": return ring(24, -90, (i) => (i % 2 ? r * 0.9 : r));
    case "rosette": return P(Array.from({ length: 140 }, (_, i) => { const a = (i / 140) * Math.PI * 2, q = r * (0.93 + 0.07 * Math.cos(14 * a)); return [Math.cos(a) * q, Math.sin(a) * q]; }));
    case "shield": return `M${cx} ${cy - r} L${cx + r * 0.86} ${cy - r * 0.72} L${cx + r * 0.86} ${cy + r * 0.1} Q${cx + r * 0.86} ${cy + r * 0.78} ${cx} ${cy + r} Q${cx - r * 0.86} ${cy + r * 0.78} ${cx - r * 0.86} ${cy + r * 0.1} L${cx - r * 0.86} ${cy - r * 0.72} Z`;
    case "squircle": { const k = r * 0.36; return `M${cx - r + k} ${cy - r} H${cx + r - k} Q${cx + r} ${cy - r} ${cx + r} ${cy - r + k} V${cy + r - k} Q${cx + r} ${cy + r} ${cx + r - k} ${cy + r} H${cx - r + k} Q${cx - r} ${cy + r} ${cx - r} ${cy + r - k} V${cy - r + k} Q${cx - r} ${cy - r} ${cx - r + k} ${cy - r} Z`; }
    default: return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  }
}

function medalSvg(t, { locked = false, cls = "" } = {}) {
  const [hi, lo] = MD_TIERS[t.tier] || MD_TIERS.bronze;
  const shape = MD_SHAPE[t.kind] || "circle", col = `var(--c-${t.color || "blue"})`;
  const rank = locked ? "" : MD_RANK[t.rank] ? t.rank : "", g = `md${++mdSvgN}`;
  const rays = rank === "crit" ? MD_RAYS.map((d) => `<path d="${d}" fill="#F2B705" stroke="#141414" stroke-width=".6"/>`).join("") : "";
  const sparkle = ([x, y, s], i) => `<path class="sparkle" style="animation-delay:${i * 0.5}s" d="${mdSparkle(x, y, s)}" fill="#FAF8F2" stroke="#141414" stroke-width=".8"/>`;
  const plate = t.plate ? (() => { const w = Math.max(26, String(t.plate).length * 7.4 + 12); return `<rect x="${50 - w / 2}" y="61" width="${w}" height="15" fill="#141414"/><text x="50" y="72" text-anchor="middle" fill="#fff" font-size="10" font-weight="800" style="font-family:var(--font)">${mdEsc(t.plate)}</text>`; })() : "";
  return `<svg class="medal ${cls} ${locked ? "locked" : ""} tier-${t.tier} ${rank ? `rank-${rank}` : ""}" viewBox="0 0 100 124" role="img" aria-label="${mdEsc(t.name)} ${locked ? "(not yet earned)" : `trophy${rank ? `, ${MD_RANK[rank]}` : ""}`}"><defs>
    <linearGradient id="${g}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${hi}"/></linearGradient>
    <linearGradient id="${g}h" x1="0" y1="0" x2="1" y2="1">${BH_BANDS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient></defs>
    <path d="${MD_RIB_L}" style="fill:${col}"/><path d="${MD_RIB_R}" style="fill:color-mix(in srgb, ${col} 55%, #141414)"/>
    ${rays}
    <path class="rim" d="${mdShape(shape, 38)}" fill="url(#${g}${rank === "shiny" ? "h" : "g"})"/>
    <path d="${mdShape(shape, 33.5)}" fill="none" stroke="rgb(255 255 255 / .55)" stroke-width="2"/>
    <path d="${mdShape(shape, 29)}" fill="var(--m-surface)"/>
    <path d="${MD_STAR}" fill="${hi}" stroke="${lo}" stroke-width="1.2" stroke-linejoin="miter"/>
    <path d="${mdShape(shape, 28.5)}" fill="none" stroke="${lo}" stroke-width="1.5" opacity=".6"/>
    ${plate}
    ${t.hidden ? `<circle cx="82" cy="14" r="10" fill="#1F4FA0" stroke="#FFFFFF" stroke-width="2"/><text x="82" y="18.5" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui, sans-serif" fill="#FFFFFF">?</text>` : ""}
    ${t.sig ? `<path d="${MD_CROWN}" fill="#F2B705" stroke="#141414" stroke-width="1.2" stroke-linejoin="round"/><circle cx="50" cy="2.8" r="1.6" fill="#D7261E"/>` : ""}
    ${rank === "crit" ? `<path d="${MD_CRIT}" fill="#F2B705" stroke="#141414" stroke-width="1"/>` : ""}
    ${rank === "shiny" ? MD_SPARKLES.map(sparkle).join("") : ""}</svg>`;
}

function paintMedal(x, t, mode, W = 100) {
  const locked = mode === "locked", C = (h) => (locked ? mdGrey(h) : h);
  const [hi0, lo0] = MD_TIERS[t.tier] || MD_TIERS.bronze, hi = C(hi0), lo = C(lo0);
  const shape = MD_SHAPE[t.kind] || "circle", col = C(theme[`c-${t.color}`] || theme["c-blue"] || "#3B4CCA");
  const rank = mode ? "" : MD_RANK[t.rank] ? t.rank : "";
  const lin = (stops) => { const g = x.createLinearGradient(12, 12, 88, 88); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
  x.globalAlpha = locked ? 0.38 : mode === "lit" ? 0.78 : 1; x.lineJoin = "round";
  x.fillStyle = col; x.fill(mdP(MD_RIB_L));
  x.fillStyle = mix(col, "#141414", 0.45); x.fill(mdP(MD_RIB_R));
  if (rank === "crit") { x.fillStyle = "#F2B705"; x.strokeStyle = "#141414"; x.lineWidth = 0.6; for (const d of MD_RAYS) { x.fill(mdP(d)); x.stroke(mdP(d)); } }
  x.fillStyle = rank === "shiny" ? lin(BH_BANDS) : hi; x.fill(mdP(mdShape(shape, 38))); // flat: no glow behind it
  x.strokeStyle = "rgb(255 255 255 / .55)"; x.lineWidth = 2; x.stroke(mdP(mdShape(shape, 33.5)));
  x.fillStyle = C(theme["m-surface"] || "#FFFDF6"); x.fill(mdP(mdShape(shape, 29)));
  x.fillStyle = hi; x.fill(mdP(MD_STAR)); x.strokeStyle = lo; x.lineWidth = 1.2; x.lineJoin = "miter"; x.stroke(mdP(MD_STAR));
  const a0 = x.globalAlpha; x.globalAlpha = a0 * 0.6; x.strokeStyle = lo; x.lineWidth = 1.5; x.stroke(mdP(mdShape(shape, 28.5))); x.globalAlpha = a0;
  if (t.plate) {
    const w = Math.max(26, String(t.plate).length * 7.4 + 12);
    rrOn(x, 50 - w / 2, 61, w, 15, 0); x.fillStyle = "#141414"; x.fill();
    x.fillStyle = "#fff"; fontOn(x, 800, 10); x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText(fitOn(x, String(t.plate), w - 4), 50, 72);
  }
  if (t.hidden) { x.beginPath(); x.arc(82, 14, 10, 0, Math.PI * 2); x.fillStyle = C("#1F4FA0"); x.fill(); x.lineWidth = 2; x.strokeStyle = "#fff"; x.stroke(); x.fillStyle = "#fff"; fontOn(x, 800, 13); x.textAlign = "center"; x.fillText("?", 82, 18.5); }
  if (t.sig) { x.fillStyle = C("#F2B705"); x.strokeStyle = C("#141414"); x.lineWidth = 1.2; x.fill(mdP(MD_CROWN)); x.stroke(mdP(MD_CROWN)); x.beginPath(); x.arc(50, 2.8, 1.6, 0, Math.PI * 2); x.fillStyle = C("#D7261E"); x.fill(); }
  if (rank === "crit") { x.fillStyle = "#F2B705"; x.strokeStyle = "#141414"; x.lineWidth = 1; x.fill(mdP(MD_CRIT)); x.stroke(mdP(MD_CRIT)); }
  if (rank === "shiny") { x.fillStyle = "#FAF8F2"; x.strokeStyle = "#141414"; x.lineWidth = 0.8; for (const [sx, sy, s] of MD_SPARKLES) { x.fill(mdP(mdSparkle(sx, sy, s))); x.stroke(mdP(mdSparkle(sx, sy, s))); } }
  x.globalAlpha = 1;
}

function mintBurst(m, cx, cy, size, rv, fx, now) {
  const [hi] = MD_TIERS[m.t.tier] || MD_TIERS.gold, rank = m.rank;
  ctx.globalAlpha = fx * 0.28; ctx.fillStyle = hi; ctx.beginPath(); ctx.arc(cx, cy, size * 0.8, 0, Math.PI * 2); ctx.fill(); // a flat disc, not a glow
  if (rv <= 0) return;
  if (rv < 420) { const q = rv / 420; ctx.globalAlpha = fx * (1 - q); ctx.lineWidth = 3 * (1 - q) + 1; ctx.strokeStyle = rank === "crit" ? "#F2B705" : rank === "shiny" ? "#1F4FA0" : hi; ctx.beginPath(); ctx.arc(cx, cy, size * (0.5 + q * 0.75), 0, Math.PI * 2); ctx.stroke(); }
  if (rank === "crit") {
    const q = clamp(rv / 240, 0, 1), R = size * (0.55 + 0.5 * mdOut3(q)), r0 = size * 0.44, rot = now * 0.0007;
    ctx.globalAlpha = fx * q; ctx.fillStyle = "#F2B705"; ctx.strokeStyle = "#141414"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = rot + (i / 12) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a - 0.13) * r0, cy + Math.sin(a - 0.13) * r0); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a + 0.13) * r0, cy + Math.sin(a + 0.13) * r0); }
    ctx.fill(); ctx.stroke();
  } else if (rank === "shiny") {
    const q = clamp(rv / 300, 0, 1), rot = now * 0.002, R = size * 0.66;
    ctx.globalAlpha = fx * q; ctx.lineWidth = 4; ctx.lineCap = "butt";
    MD_RAINBOW.forEach(([, col], i) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, rot + i * 1.2566, rot + i * 1.2566 + 0.95); ctx.stroke(); });
    ctx.lineCap = "butt";
    for (let i = 0; i < 5; i++) {
      const a = -rot * 0.6 + i * 1.2566, s = 0.45 + 0.4 * Math.sin(now * 0.008 + i * 1.7), x = cx + Math.cos(a) * size * 0.86, y = cy + Math.sin(a) * size * 0.86;
      ctx.globalAlpha = fx * q * clamp(s + 0.2, 0, 1); ctx.save(); ctx.translate(x, y); ctx.scale(s * size / 100, s * size / 100);
      ctx.fillStyle = "#FAF8F2"; ctx.strokeStyle = "#141414"; ctx.lineWidth = 1; const sp = mdP(mdSparkle(0, 0, 1.6)); ctx.fill(sp); ctx.stroke(sp); ctx.restore();
    }
  }
}

function tbCoverPaint(G) {
  const w = G.pw, h = G.ph, [c0, c1, c2] = theme.dark ? COVER.dark : COVER.light, spine = Math.max(10, w * 0.09);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w + 2, h + 2);
  rr(0, 0, w, h, 0); ctx.fillStyle = c0; ctx.fill();
  ctx.save(); rr(0, 0, w, h, 10); ctx.clip();
  ctx.fillStyle = "rgb(0 0 0 / .22)"; ctx.fillRect(0, 0, spine, h); // the spine, at the ring side
  ctx.fillStyle = "rgb(255 255 255 / .10)"; ctx.fillRect(spine, 0, 1.5, h);
  ctx.strokeStyle = "rgb(255 255 255 / .22)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(spine + 6, 8); ctx.lineTo(spine + 6, h - 8); ctx.stroke(); ctx.setLineDash([]); // stitching
  ctx.restore(); curFont = "";
  ctx.lineWidth = 1; ctx.strokeStyle = "rgb(0 0 0 / .25)"; rr(0.5, 0.5, w - 1, h - 1, 10); ctx.stroke();
  const cx = spine + (w - spine) / 2, gold = "#F2B705";
  rr(spine + 14, h * 0.3, w - spine - 28, h * 0.26, 6); ctx.lineWidth = 2; ctx.strokeStyle = gold; ctx.stroke(); // the label's frame
  ctx.beginPath(); ctx.arc(cx, h * 0.72, Math.min(w - spine, h) * 0.08, 0, Math.PI * 2); ctx.fillStyle = "#D7261E"; ctx.fill(); // one red disc below it
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = gold;
  const fs = clamp(w * 0.105, 13, 26); font(800, fs, true); ctx.fillText(fitText("Trade binder", w - spine - 36), cx, h * 0.43 + fs * 0.36); // the title alone in its frame (the count is beside it, on the page)
}
