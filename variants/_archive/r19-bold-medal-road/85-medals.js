// ---------- medals: production's trophies, earned on the bar (round 19, bold: the medal road) ----------
// Production's trophy catalogue lives in the trophy room, and its milestones live on the bar where you earn them.
// Every set and chase panel's progress bar carries its medals as pins: the milestones (half, three quarters, the last
// three, complete) at their points, the goals inside the chase (Holo hunter, Chase cards, Clean sweep) and its
// signature medals hung at the end of the bar. Far out a pin is a couple of pixels of tier colour; up close (the set's
// header) it's the medal itself, small, hanging from the bar on a thread. The next one to earn is faintly lit, so the
// wall says what's next without a Next up list. Marking the card that tips one mints it there: it pops off the bar,
// its luck shows in that moment (a Critical starburst, a Shiny shimmer, about 1 in 10 and 1 in 100, rolled once per
// medal, seeded by its id), then it flies to the trophy room's door at the end of the wall and the door's count
// ticks. The pin stays on the bar, earned. The room hangs each finished plaque's medals beneath it on ribbons, gives
// the medals of unfinished chases, the Dex and Across everything shelves of their own, and keeps the hidden ones as a
// "?" with how many are left to find. Tapping a medal (in the room, or a pin up close) shows the cards behind it,
// missing ones first. Earned medals are kept in localStorage wall-medals; anything already true on load is earned
// quietly. The artwork is production's medal.js, drawn with the same paths onto offscreen canvases, kept per look.

// ----- the artwork (ported from production's public/medal.js: same outlines, tiers, crown, "?" and luck marks) -----
const TROPHY_SHAPE = { set: "shield", pokemon: "hex", artist: "rosette", region: "octagon", type: "diamond", rarity: "star", custom: "circle", dex: "squircle", global: "badge" };
const RANK_LABEL = { shiny: "Shiny", crit: "Critical" };
const TIER_COLORS = { bronze: ["#F0B27A", "#9A5B21"], silver: ["#EEF1F7", "#8E99AD"], gold: ["#FFE066", "#C99A00"], holo: ["#9BE0FF", "#C9A8FF"] };
const TIER_DOT = { bronze: "#C47B38", silver: "#9DA8BC", gold: "#E3B000", holo: "#86B9FF" }; // a pin far out: one colour per tier
const OFF_COLORS = ["#DADDE3", "#959BA6"];
const TIER_ORDER = ["bronze", "silver", "gold", "holo"];
/** The outline of a medal. Each kind of chase has its own. */
function shapePath(shape, r, cx = 50, cy = 50) {
  const P = (pts) => "M" + pts.map(([x, y]) => `${(cx + x).toFixed(2)} ${(cy + y).toFixed(2)}`).join(" L") + " Z";
  const ring = (n, rot, f) => P(Array.from({ length: n }, (_, i) => { const a = (((i / n) * 360) + rot) * Math.PI / 180, rr = f(i); return [Math.cos(a) * rr, Math.sin(a) * rr]; }));
  switch (shape) {
    case "hex": return ring(6, -90, () => r);
    case "octagon": return ring(8, -22.5, () => r);
    case "diamond": return ring(4, -90, () => r * 1.1);
    case "star": return ring(16, -90, (i) => (i % 2 ? r * 0.76 : r));
    case "badge": return ring(24, -90, (i) => (i % 2 ? r * 0.9 : r));
    case "rosette": return P(Array.from({ length: 140 }, (_, i) => { const a = (i / 140) * Math.PI * 2; const rr = r * (0.93 + 0.07 * Math.cos(14 * a)); return [Math.cos(a) * rr, Math.sin(a) * rr]; }));
    case "shield": return `M${cx} ${cy - r} L${cx + r * 0.86} ${cy - r * 0.72} L${cx + r * 0.86} ${cy + r * 0.1} Q${cx + r * 0.86} ${cy + r * 0.78} ${cx} ${cy + r} Q${cx - r * 0.86} ${cy + r * 0.78} ${cx - r * 0.86} ${cy + r * 0.1} L${cx - r * 0.86} ${cy - r * 0.72} Z`;
    case "squircle": { const k = r * 0.36; return `M${cx - r + k} ${cy - r} H${cx + r - k} Q${cx + r} ${cy - r} ${cx + r} ${cy - r + k} V${cy + r - k} Q${cx + r} ${cy + r} ${cx + r - k} ${cy + r} H${cx - r + k} Q${cx - r} ${cy + r} ${cx - r} ${cy + r - k} V${cy - r + k} Q${cx - r} ${cy - r} ${cx - r + k} ${cy - r} Z`; }
    default: return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  }
}
const pathMemo = new Map();
const P2 = (d) => { let p = pathMemo.get(d); if (!p) { p = new Path2D(d); pathMemo.set(d, p); } return p; };
const M_RIB_L = "M30 70 L22 118 L38 108 L46 120 L52 76 Z", M_RIB_R = "M70 70 L78 118 L62 108 L54 120 L48 76 Z";
const M_STAR = "M50 29 L56.5 43.5 L72 45 L60.5 55.5 L63.8 71 L50 63 L36.2 71 L39.5 55.5 L28 45 L43.5 43.5 Z";
const M_CROWN = "M38 13 L42 4 L46 10 L50 2 L54 10 L58 4 L62 13 Z", M_CRIT = "M84 8 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z";
const M_RAYS = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, p = (rr, da = 0) => `${(50 + Math.cos(a + da) * rr).toFixed(1)} ${(50 + Math.sin(a + da) * rr).toFixed(1)}`; return `M${p(40, -0.11)} L${p(49)} L${p(40, 0.11)} Z`; });
const sparkleD = (x, y, k) => `M${x} ${y - 7 * k} L${x + 2 * k} ${y - 2 * k} L${x + 7 * k} ${y} L${x + 2 * k} ${y + 2 * k} L${x} ${y + 7 * k} L${x - 2 * k} ${y + 2 * k} L${x - 7 * k} ${y} L${x - 2 * k} ${y - 2 * k} Z`;
const RAINBOW = [[0, "#FF6B6B"], [0.25, "#FFD93D"], [0.5, "#6BCB77"], [0.75, "#4D96FF"], [1, "#C77DFF"]];
function linOn(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
// Paints one medal in its 100 × 124 box on any context. v: "on" (earned), "lit" (the next one), "ghost" (a pin not
// earned yet: its own colours, faint), "off" (locked, grey: the sheet and the hidden ones).
function paintMedal(x, t, rank, v, px) {
  const off = v === "off", [hi, lo] = off ? OFF_COLORS : TIER_COLORS[t.tier] || TIER_COLORS.bronze;
  const shape = TROPHY_SHAPE[t.kind] || "circle", col = off ? "#A7ACB6" : t.color || "#4D7FC4";
  rank = v === "on" ? rank || "" : "";
  if (v === "lit") x.globalAlpha = 0.85;
  if (v === "ghost") x.globalAlpha = 0.4;
  x.lineJoin = "round";
  x.fillStyle = col; x.fill(P2(M_RIB_L));
  x.fillStyle = mix(col, "#1B1D2E", 0.45); x.fill(P2(M_RIB_R));
  if (rank === "crit") { x.fillStyle = "#FFCB05"; x.strokeStyle = "#9A6A00"; x.lineWidth = 0.6; for (const d of M_RAYS) { x.fill(P2(d)); x.stroke(P2(d)); } }
  const b = shape === "diamond" ? 41.8 : 38;
  if (v === "lit") { x.save(); x.shadowColor = hi; x.shadowBlur = Math.max(4, px * 0.3) * dpr; }
  x.fillStyle = linOn(x, 50 - b, 50 - b, 50 + b, 50 + b, rank === "shiny" ? RAINBOW : [[0, hi], [1, lo]]);
  x.fill(P2(shapePath(shape, 38)));
  if (v === "lit") x.restore();
  x.strokeStyle = "rgb(255 255 255 / .55)"; x.lineWidth = 2; x.stroke(P2(shapePath(shape, 33.5)));
  x.fillStyle = theme["panel-solid"] || "#FAFBFD"; x.fill(P2(shapePath(shape, 29)));
  x.fillStyle = linOn(x, 28, 29, 72, 71, [[0, hi], [1, lo]]); x.fill(P2(M_STAR));
  const a0 = x.globalAlpha; x.globalAlpha = a0 * 0.6; x.strokeStyle = lo; x.lineWidth = 1.5; x.stroke(P2(shapePath(shape, 28.5))); x.globalAlpha = a0;
  if (t.plate) {
    const w = Math.max(26, String(t.plate).length * 7.4 + 12);
    x.beginPath(); x.roundRect ? x.roundRect(50 - w / 2, 61, w, 15, 7.5) : x.rect(50 - w / 2, 61, w, 15); x.fillStyle = "rgb(0 0 0 / .66)"; x.fill();
    x.fillStyle = "#fff"; x.font = `800 10px ${FONT}`; x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText(String(t.plate), 50, 72);
  }
  if (t.hidden) {
    x.beginPath(); x.arc(82, 14, 10, 0, Math.PI * 2); x.fillStyle = off ? "#8C80A8" : "#6B3FD1"; x.fill(); x.lineWidth = 2; x.strokeStyle = "#fff"; x.stroke();
    x.fillStyle = "#fff"; x.font = "800 13px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("?", 82, 18.5);
  }
  if (t.sig) { x.fillStyle = "#FFCB05"; x.strokeStyle = "#9A6A00"; x.lineWidth = 1.2; x.fill(P2(M_CROWN)); x.stroke(P2(M_CROWN)); x.beginPath(); x.arc(50, 2.8, 1.6, 0, Math.PI * 2); x.fillStyle = "#E3350D"; x.fill(); }
  if (rank === "crit") { x.fillStyle = "#FFCB05"; x.strokeStyle = "#9A6A00"; x.lineWidth = 1; x.fill(P2(M_CRIT)); x.stroke(P2(M_CRIT)); }
  if (rank === "shiny") { x.fillStyle = "#FFF7B0"; x.strokeStyle = "#C99A00"; x.lineWidth = 0.8; for (const d of [sparkleD(14, 20, 1.2), sparkleD(88, 34, 1), sparkleD(76, 92, 0.9)]) { x.fill(P2(d)); x.stroke(P2(d)); } }
  x.globalAlpha = 1;
}
// Rasterised once per look, size step, dpr and theme; drawn scaled from the nearest step (never painted per frame).
const MEDAL_STEPS = [12, 16, 20, 24, 32, 48, 64, 96, 128];
const medalArt = new Map();
function medalImg(t, S, v, rank) {
  rank = v === "on" ? rank || "" : "";
  const key = `${t.kind}|${t.tier}|${t.color}|${t.plate || ""}|${t.sig ? 1 : 0}|${t.hidden ? 1 : 0}|${rank}|${v}|${S}|${dpr}|${theme["panel-solid"]}`;
  let e = medalArt.get(key);
  if (e) return e;
  const pad = Math.ceil(S * 0.16), h = S * 1.24, cv = document.createElement("canvas");
  cv.width = Math.ceil((S + pad * 2) * dpr); cv.height = Math.ceil((h + pad * 2) * dpr);
  const x = cv.getContext("2d"); x.scale(dpr, dpr); x.translate(pad, pad); x.scale(S / 100, S / 100);
  paintMedal(x, t, rank, v, S);
  e = { cv, pad, S };
  if (medalArt.size > 1200) medalArt.clear();
  medalArt.set(key, e);
  return e;
}
// Draws a medal w wide, its top at `top`, centred on cx. cropU: how much of the 124-unit height to show (92 drops the
// ribbon tails, for the pins on the bar).
function drawMedalAt(c2, t, rank, cx, top, w, v = "on", cropU = 124) {
  const S = MEDAL_STEPS.find((s) => s >= w * 1.15) || 128, e = medalImg(t, S, v, rank), k = w / S;
  const srcH = Math.min(e.cv.height, Math.ceil((e.pad + cropU * S / 100) * dpr));
  c2.drawImage(e.cv, 0, 0, e.cv.width, srcH, cx - w / 2 - e.pad * k, top - e.pad * k, (S + e.pad * 2) * k, (srcH / dpr) * k);
}
document.fonts?.ready.then(() => { medalArt.clear(); medURL.clear(); kick(); }); // the plates were drawn before Archivo arrived
const medURL = new Map(); // a medal as a picture for the sheet and the list
function medalURL(t, rank, w, v = "on") {
  const key = `${t.kind}|${t.tier}|${t.color}|${t.plate}|${t.sig ? 1 : 0}|${t.hidden ? 1 : 0}|${rank}|${v}|${w}|${theme["panel-solid"]}`;
  let u = medURL.get(key);
  if (u) return u;
  const cv = document.createElement("canvas"), d = Math.max(2, dpr);
  cv.width = Math.ceil(w * d); cv.height = Math.ceil(w * 1.24 * d);
  const x = cv.getContext("2d"); x.scale(d * w / 100, d * w / 100);
  paintMedal(x, t, rank, v, w);
  u = cv.toDataURL(); medURL.set(key, u);
  return u;
}

// ----- the catalogue (production's computeTrophies, signatureTrophies and collectionTrophies, on the Wall's data) -----
const TROPHY_NAMES = {
  set:     { half: "Half a Binder", tq: "Nearly Full", last3: "Last Pockets", complete: "Binder Complete" },
  pokemon: { half: "Fan Club", tq: "Superfan", last3: "Shrine Builder", complete: "Hall of Fame" },
  artist:  { half: "Gallery Opening", tq: "Curator", last3: "Final Frame", complete: "Full Exhibit" },
  region:  { half: "Road Trip", tq: "Cross Country", last3: "Last Stop", complete: "Grand Tour" },
  type:    { half: "Attuned", tq: "Resonant", last3: "On the Edge", complete: "Perfect Match" },
  rarity:  { half: "Treasure Hunter", tq: "Collector's Eye", last3: "Last Gem", complete: "Full Hoard" },
  custom:  { half: "Halfway", tq: "Home stretch", last3: "Last three", complete: "Complete" },
};
const STARTER_LINES = [[1, 9], [152, 160], [252, 260], [387, 395], [495, 503], [650, 658], [722, 730], [810, 818], [906, 914]];
const LEGEND_RANGES = [[144, 146], [150, 151], [243, 245], [249, 251], [377, 386], [480, 494], [638, 649], [716, 721], [772, 773], [785, 809], [888, 898], [905, 905], [1001, 1010], [1014, 1025]];
const EEVEE_FAMILY = new Set([133, 134, 135, 136, 196, 197, 470, 471, 700]);
const GENS = [[1, 1, 151, "Kanto"], [2, 152, 251, "Johto"], [3, 252, 386, "Hoenn"], [4, 387, 493, "Sinnoh"], [5, 494, 649, "Unova"], [6, 650, 721, "Kalos"], [7, 722, 809, "Alola"], [8, 810, 905, "Galar"], [9, 906, 1025, "Paldea"]];
const inRanges = (n, rs) => rs.some(([a, b]) => n >= a && n <= b);
const initialsOf = (t) => String(t || "").split(/[\s,.-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
const MED_RED = "#E8603C", MED_YELLOW = "#E9B524";
const isArt = (c) => /illustration rare/i.test(c.rname);
const eraOfYear = (y) => (y < 2004 ? "Wizards" : y < 2019 ? "Middle years" : y < 2023 ? "Sword & Shield" : y < 2026 ? "Scarlet & Violet" : "Mega Evolution");
const isSpecialEnergy = (c) => c.type === "e" && !/^(Basic )?(Grass|Fire|Water|Lightning|Psychic|Fighting|Fairy) Energy$/.test(c.name) && !(sets[c.si].year >= 2003 && /^(Darkness|Metal) Energy$/.test(c.name));
function rarityBucket(c) {
  const r = c.rname || "";
  if (/^(common|uncommon)$/i.test(r)) return "easy";
  if (/secret|illustration|hyper|special|rainbow|gold|shiny|amazing|radiant|ultra|double|ace spec|v\b|vmax|vstar|ex\b|gx/i.test(r)) return "chase";
  if (/holo/i.test(r)) return "holo";
  return "other";
}
// What kind of chase a rule is: it decides the medal's shape and its words.
function medKind(r) {
  if (!r || r.popular) return "custom";
  if (r.dex && !r.set && !r.type) return "pokemon";
  if (r.artist && !r.dex && !r.set && !r.type && !r.rarity) return "artist";
  if (r.type && !r.dex && !r.artist) return "type";
  if (r.rarity && !r.dex && !r.artist && !r.type) return "rarity";
  if (r.set && !r.dex && !r.artist && !r.type && !r.rarity) return "set";
  return "custom";
}
function medPlate(kind, g) {
  const r = g.chase;
  if (g.set) return g.set.code;
  if (kind === "set") return setById(r.set)?.code || "SET";
  if (kind === "pokemon") return `#${r.dex}`;
  if (kind === "artist") return initialsOf(r.artist);
  if (kind === "type") return (TYPE[r.type] || TYPE.C)[0].slice(0, 3).toUpperCase();
  if (kind === "rarity") return "★";
  return String(g.name || "").slice(0, 2).toUpperCase();
}
const medOwnerOf = (g) => (g.set ? `set:${g.set.id}` : g.chase ? `chase:${ruleKey(g.chase)}` : null);
// Signature medals: what a set or a kind of chase uniquely offers. Four shapes, as in production: every card of a
// group (list), one from each group (groups), any N of a pool (pool), and (not here: no evolution data) one whole line.
function sigsFor(kind, setId, base) {
  const out = [];
  const sig = (sid, name, desc, tier, plate, group, min = 2) => { if (group.length >= min && group.length < base.length) out.push({ sid, name, desc, tier, plate, list: group }); };
  const anyOf = (sid, name, desc, tier, plate, groups, min, need) => { if (groups.length >= min) out.push({ sid, name, desc, tier, plate, groups, need }); };
  const named = (...ns) => base.filter((x) => ns.some((n) => x.name.toLowerCase() === n.toLowerCase()));
  const holo = (x) => /holo/i.test(x.rname);
  const rar = (re) => base.filter((x) => re.test(x.rname));
  if (kind === "set" || kind === "custom") {
    if (setId === "base1") {
      sig("big-three", "The Big Three", "Charizard, Blastoise and Venusaur.", "holo", "BIG3", named("Charizard", "Blastoise", "Venusaur"), 3);
      sig("professors", "Professor's Lab", "Professor Oak and the Impostor.", "silver", "OAK", named("Professor Oak", "Impostor Professor Oak"), 2);
    }
    if (setId === "base3") sig("birds", "Legendary Birds", "Articuno, Zapdos and Moltres.", "gold", "BIRD", named("Articuno", "Zapdos", "Moltres").filter(holo), 3);
    if (setId === "base2") sig("eevee", "Jungle Eeveelutions", "Eevee and its three evolutions, holo and non-holo.", "gold", "EEV", base.filter((x) => EEVEE_FAMILY.has(x.dex)), 4);
    if (setId === "me55") sig("rgb", "Red, Green and Blue", "All three Mews: R, G and B.", "holo", "RGB", base.filter((x) => /^[RGB]$/i.test(x.num)), 3);
    if (setId === "base5") sig("dark", "Dark Side", "Every Dark Pokémon card.", "gold", "DARK", base.filter((x) => /^Dark /.test(x.name) && x.type !== "t" && x.type !== "e"), 3);
    if (setId === "neo1") anyOf("johto", "Johto Starters", "A holo Meganium, Typhlosion and Feraligatr.", "holo", "JOHTO", ["Meganium", "Typhlosion", "Feraligatr"].map((n) => named(n).filter(holo)).filter((g) => g.length), 3);
    if (setId === "swsh7") sig("dragons", "Dragon's Hoard", "Every Dragon-type card.", "gold", "DRAGON", base.filter((x) => x.type === "N"), 3);
    if (setId === "sv8pt5") sig("prism", "Prismatic Nine", "Eevee and the eight Eeveelutions as Special Illustration Rares.", "holo", "PRISM", base.filter((x) => x.rname === "Special Illustration Rare" && EEVEE_FAMILY.has(x.dex)), 9);
    if (setId === "sv3pt5") { const byDex = []; for (let d = 1; d <= 151; d++) { const g = base.filter((x) => x.dex === d); if (g.length) byDex.push(g); } anyOf("kanto", "Kanto Complete", "One card of every Pokémon from #1 to #151.", "holo", "151", byDex, 100); }
    if (setId !== "base3") sig("legends", "Legends", "Every legendary and mythical Pokémon card.", "gold", "LEG", base.filter((x) => x.dex && inRanges(x.dex, LEGEND_RANGES)), 2);
    sig("starters", "Starter Squad", "Every starter Pokémon card, evolutions included.", "silver", "STR", base.filter((x) => x.dex && inRanges(x.dex, STARTER_LINES)), 3);
    if (setId !== "base2") sig("eevee", "Eeveelutions", "Eevee and every evolution.", "silver", "EEV", base.filter((x) => EEVEE_FAMILY.has(x.dex)), 3);
    sig("trainers", "Trainer's Toolbox", "Every Trainer card.", "bronze", "TRN", base.filter((x) => x.type === "t"), 5);
    const printed = setId ? setById(setId)?.printed || 0 : 0;
    if (printed) sig("secret", "Secret Stash", "Every card numbered past the set's printed total.", "gold", "SECRET", base.filter((x) => /^\d+$/.test(x.num) && Number(x.num) > printed), 2);
    sig("holo-wall", "Holo Wall", "Every Rare Holo.", "silver", "HOLO", base.filter((x) => x.rname === "Rare Holo"), 3);
    sig("shiny", "Shiny Vault", "Every shiny card.", "gold", "SHINY", rar(/^(Rare Shiny|Shiny Rare|Shiny Ultra Rare)/i), 2);
    sig("shining", "Shining Collection", "Every Shining card.", "holo", "SHINE", rar(/^Rare Shining$/i), 2);
    sig("gold-star", "Gold Star", "Every Gold Star.", "holo", "STAR", rar(/^Rare Holo Star$/i), 2);
    sig("rainbow", "Rainbow Road", "Every Rainbow Rare and Hyper Rare.", "gold", "RAINBW", rar(/^(Rainbow Rare|Hyper Rare)$/i), 3);
    sig("ace", "Ace in the Hole", "Every ACE SPEC card.", "silver", "ACE", rar(/^ACE SPEC/i), 2);
    sig("tag", "Tag Team", "Every TAG TEAM card.", "gold", "TAG", base.filter((x) => / & /.test(x.name) && / GX$/.test(x.name)), 2);
    sig("radiant", "Radiant", "Every Radiant Rare.", "silver", "RAD", base.filter((x) => /^Radiant /.test(x.name)), 2);
    sig("special-energy", "Special Delivery", "Every Special Energy.", "bronze", "NRG", base.filter(isSpecialEnergy), 2);
    sig("gallery", "Gallery Wall", "Every Illustration Rare and Special Illustration Rare.", "gold", "ART", base.filter(isArt), 3);
  }
  const bySet = () => { const m = new Map(); for (const x of base) { if (!m.has(x.si)) m.set(x.si, []); m.get(x.si).push(x); } return m; };
  if (kind === "pokemon") {
    const shiny = base.filter((x) => /shiny|shining|holo star/i.test(x.rname) || /★/.test(x.name));
    if (shiny.length) out.push({ sid: "shiny-hunter", name: "Shiny Hunter", desc: "A shiny, Shining or Gold Star card of it.", tier: "gold", plate: "SHINY", pool: shiny, need: 1 });
    const forms = new Map(); for (const x of base) { const n = x.name.trim(); if (!forms.has(n)) forms.set(n, []); forms.get(n).push(x); }
    if (forms.size >= 4) out.push({ sid: "forms", name: "Every Form", desc: `A card of each form it comes in (${forms.size}).`, tier: "gold", plate: "FORMS", groups: [...forms.values()] });
    const art = base.filter(isArt);
    if (art.length) out.push({ sid: "art-piece", name: "Art Piece", desc: "An Illustration Rare or Special Illustration Rare of it.", tier: "silver", plate: "ART", pool: art, need: 1 });
  }
  if (kind === "type" && base.length >= 60) out.push({ sid: "mono", name: "Mono Deck", desc: "Sixty cards of the type: a whole deck's worth.", tier: "gold", plate: "60", pool: base, need: 60 });
  if (kind === "rarity") { const m = bySet(); if (m.size >= 10) out.push({ sid: "ten-sets", name: "Ten Sets Deep", desc: "Cards from ten different sets.", tier: "silver", plate: "10", groups: [...m.values()], need: 10 }); }
  if (kind === "artist") {
    const dated = base.slice().sort((a, b) => sets[a.si].released - sets[b.si].released || String(a.num).localeCompare(String(b.num), undefined, { numeric: true }));
    if (dated.length >= 2) out.push({ sid: "first-brush", name: "First Brushstroke", desc: `Their earliest card: ${dated[0].name}.`, tier: "silver", plate: "1ST", list: [dated[0]] });
    const art = base.filter(isArt);
    if (art.length >= 3) out.push({ sid: "showpiece", name: "Showpiece", desc: "Three of their Illustration Rares or Special Illustration Rares.", tier: "gold", plate: "ART", pool: art, need: 3 });
  }
  const byEra = new Map();
  for (const x of base) { const e = eraOfYear(sets[x.si].year); if (!byEra.has(e)) byEra.set(e, []); byEra.get(e).push(x); }
  if (["pokemon", "type", "rarity"].includes(kind) && byEra.size >= 4) out.push({ sid: "eras", name: "Through the Ages", desc: `A card from every era it appears in (${byEra.size} eras).`, tier: "gold", plate: "ERA", groups: [...byEra.values()] });
  if (kind === "pokemon" && base.length >= 6) {
    const dated = base.slice().sort((a, b) => sets[a.si].year - sets[b.si].year);
    if (sets[dated[0].si].year !== sets[dated[dated.length - 1].si].year) out.push({ sid: "then-now", name: "Then and Now", desc: "Its oldest card and its newest.", tier: "silver", plate: "THEN", list: [dated[0], dated[dated.length - 1]] });
  }
  if (kind === "artist") {
    const decades = new Map();
    for (const x of base) { const d = Math.floor(sets[x.si].year / 10) * 10; if (!decades.has(d)) decades.set(d, []); decades.get(d).push(x); }
    if (decades.size >= 3) out.push({ sid: "decades", name: "Across the Decades", desc: `A card from each decade they've illustrated in (${[...decades.keys()].sort().map((d) => `${d}s`).join(", ")}).`, tier: "gold", plate: "DEC", groups: [...decades.values()] });
    const m = bySet(); if (m.size >= 10) out.push({ sid: "ten-sets", name: "Ten Sets Deep", desc: "Their cards from ten different sets.", tier: "silver", plate: "10", groups: [...m.values()], need: 10 });
  }
  return out;
}
// Every medal one panel carries, in road order: the milestones, the goals inside it, its signature medals. Cached on
// the group until its cards change.
function defsOf(g) {
  const st = g.set, r = g.chase, n = g.base.length;
  const key = `${st ? `${st.id}|${scopeOf(st)}` : ruleKey(r)}|${n}|${g.ink}|${g.name}`;
  if (g.md?.key === key) return g.md.list;
  const kind = st ? "set" : medKind(r), N = TROPHY_NAMES[kind] || TROPHY_NAMES.custom, owner = medOwnerOf(g), name = st ? trophyName(g) : g.name;
  const look = { owner, ownerName: g.name, kind: TROPHY_SHAPE[kind] ? kind : "custom", color: g.ink, plate: medPlate(kind, g) };
  const mid = st ? `${owner}|${scopeOf(st)}` : owner, list = [];
  const ms = (k, nm, desc, tier, goal) => list.push({ ...look, id: `${mid}:${k}`, name: nm, desc, tier, where: "bar", frac: goal / n, goal, list: g.base, scopeName: name });
  if (n) {
    ms("half", N.half, `Own half of ${name}.`, "silver", Math.ceil(n * 0.5));
    ms("three-quarters", N.tq, `Own 75% of ${name}.`, "gold", Math.ceil(n * 0.75));
    if (n >= 6) ms("last3", N.last3, `Get ${name} down to its final three cards.`, "gold", n - 3);
    ms("complete", N.complete, `Every card in ${name}.`, "holo", n);
  }
  const base = st ? st.cards : g.base.map(rootOf);
  for (const [bucket, nm, desc, tier] of [["holo", "Holo hunter", "Every holo rare", "silver"], ["chase", "Chase cards", "Every chase-rarity card", "gold"], ["easy", "Clean sweep", "Every common and uncommon", "bronze"]]) {
    const grp = base.filter((c) => rarityBucket(c) === bucket);
    if (grp.length < 3 || grp.length === base.length) continue;
    list.push({ ...look, id: `${owner}:${bucket}`, name: nm, desc: `${desc} in ${g.name}.`, tier, where: "end", goal: grp.length, list: grp });
  }
  for (const s of sigsFor(kind, st ? st.id : r.set || null, base)) {
    const shape = s.list ? { list: s.list, goal: s.list.length } : s.pool ? { pool: s.pool, goal: s.need } : { groups: s.groups, goal: s.need || s.groups.length };
    list.push({ ...look, id: `${owner}:sig-${s.sid}`, name: s.name, desc: s.desc, tier: s.tier, plate: s.plate, sig: true, where: "end", ...shape });
  }
  g.md = { key, list };
  return list;
}
// The Dex and the medals across everything don't belong to a panel: they mint from the card that earned them.
let dexMemo = null, globMemo = null;
function dexDefs() {
  if (dexMemo) return dexMemo;
  const look = { owner: "dex", ownerName: "Dex", kind: "dex", color: MED_RED, plate: "DEX", where: "off" }, byDex = new Map(), out = [];
  for (const c of cards) if (c.dex) { if (!byDex.has(c.dex)) byDex.set(c.dex, []); byDex.get(c.dex).push(c); }
  for (const [g, a, b, nm] of GENS) { // a region only where the Wall's sets have every one of its Pokémon
    const groups = [];
    for (let d = a; d <= b; d++) { const x = byDex.get(d); if (!x) { groups.length = 0; break; } groups.push(x); }
    if (groups.length) out.push({ ...look, id: `dex:gen${g}`, name: `${nm} master`, desc: `Every ${nm} Pokémon.`, tier: "gold", groups, goal: groups.length });
  }
  const all = [...byDex.values()];
  for (const n of [50, 151, 500, 1000]) if (n <= all.length) out.push({ ...look, id: `dex:count${n}`, name: `${n} Pokémon`, desc: `Have a card for ${n} different Pokémon.`, tier: n >= 500 ? "holo" : n >= 151 ? "gold" : "silver", groups: all, goal: n });
  return (dexMemo = out);
}
const tradesDone = () => (typeof trades === "undefined" ? 0 : trades.filter((t) => t.state === "done" || t.state === "accepted").length);
function globalDefs() {
  if (globMemo) return globMemo;
  const out = [];
  const G = (id, name, desc, tier, plate, extra, hidden = false) => out.push({ id: `g:${id}`, owner: "g", ownerName: "Across everything", kind: "global", color: MED_YELLOW, plate, name, desc, tier, hidden, where: "off", ...extra });
  for (const n of [100, 500, 1000, 2500]) if (n <= cards.length) G(`own-${n}`, `${n.toLocaleString()} cards`, `Own ${n.toLocaleString()} cards across your sets.`, n >= 1000 ? "holo" : n >= 500 ? "gold" : "silver", "★", { pool: cards, goal: n, quietCards: true });
  for (const [n, name] of [[1, "First trade"], [5, "Trader"], [25, "Dealmaker"]]) G(`trade-${n}`, name, `Finish ${n === 1 ? "a trade" : `${n} trades`}.`, n >= 25 ? "gold" : n >= 5 ? "silver" : "bronze", "★", { fn: () => ({ have: Math.min(tradesDone(), n), goal: n }) });
  // Hidden: invisible until earned. Only the ones the Wall's ten sets can actually give.
  const byId = (id) => cards.find((c) => c.id === id);
  const one = (id, cid, name, desc, tier, plate) => { const c = byId(cid); if (c) G(id, name, desc, tier, plate, { list: [c], goal: 1 }, true); };
  one("moonbreon", "swsh7-215", "Moonbreon", "Umbreon VMAX, Evolving Skies #215.", "holo", "MOON");
  one("secret-agent", "base5-83", "Secret Agent", "Dark Raichu, Team Rocket #83.", "holo", "RAICHU");
  const many = (id, dex, n, name, desc, tier, plate) => { const p = cards.filter((c) => c.dex === dex); if (p.length >= n) G(id, name, desc, tier, plate, { pool: p, goal: n }, true); };
  many("fan-club", 25, 25, "Pikachu Fan Club", "25 Pikachu cards.", "gold", "PIKA25");
  many("splash", 129, 10, "Splash!", "10 Magikarp cards.", "bronze", "SPLASH");
  many("unown", 201, 10, "Unown Alphabet", "10 different Unown cards.", "silver", "UNOWN");
  const kanto = []; for (let d = 1; d <= 151; d++) { const g = cards.filter((c) => c.dex === d); if (g.length) kanto.push(g); }
  if (kanto.length === 151) G("gotta-catch", "Gotta Catch 'Em All", "A card of every Pokémon from #1 to #151, across your whole collection.", "holo", "151", { groups: kanto, goal: 151 }, true);
  const newest = sets.slice().sort((a, b) => b.released - a.released)[0], first = setById("base1");
  if (first && newest && newest !== first) G("full-circle", "Full Circle", `A card from Base Set and a card from the newest set (${newest.name}).`, "silver", "CIRCLE", { groups: [first.cards, newest.cards], goal: 2 }, true);
  const firsts = sets.map((s) => s.cards.filter((c) => /^0*1$/.test(c.num))).filter((g) => g.length);
  if (firsts.length >= 10) G("first-pick", "First Pick", "Card #1 from ten different sets.", "silver", "#1", { groups: firsts, goal: 10 }, true);
  const lasts = sets.map((s) => { const cs = s.cards.filter((c) => /^\d+$/.test(c.num)); return cs.length ? [cs.reduce((a, b) => (Number(b.num) > Number(a.num) ? b : a))] : []; }).filter((g) => g.length);
  if (lasts.length >= 5) G("last-page", "Last Page", "The highest-numbered card in five different sets.", "gold", "LAST", { groups: lasts, goal: 5 }, true);
  G("crown-collector", "Crown Collector", "Earn five signature medals.", "gold", "CROWN", { fn: () => ({ have: Math.min(5, Object.values(medals).filter((m) => m.sig).length), goal: 5 }) }, true);
  G("trophy-cabinet", "Trophy Cabinet", "Earn 25 medals of any kind.", "holo", "CABNET", { fn: () => ({ have: Math.min(25, Object.keys(medals).length), goal: 25 }) }, true);
  return (globMemo = out);
}
// The panels that carry medals: every set (in its current view) and every chase, whatever the arrangement.
const pseudoOwners = new Map();
function medalOwners() {
  const out = [];
  for (const st of sets) {
    let g = setGroups?.find((x) => x.set === st);
    if (!g) { g = pseudoOwners.get(st.id) || { key: st.id, set: st }; pseudoOwners.set(st.id, g); Object.assign(g, { name: st.name, ink: st.ink, base: scopedCards(st) }); }
    out.push(g);
  }
  chases.forEach((r, i) => {
    let g = chaseGroups.get(r.id);
    if (!g) { g = pseudoOwners.get(r.id) || { key: `chase:${r.id}`, chase: r }; pseudoOwners.set(r.id, g); Object.assign(g, { chase: r, name: r.label, ink: CHASE_INKS[i % CHASE_INKS.length], base: ruleCards(r) }); }
    out.push(g);
  });
  return out;
}
const allMedalDefs = () => [...medalOwners().flatMap(defsOf), ...dexDefs(), ...globalDefs()];
function prog(d) {
  if (d.fn) return d.fn();
  if (d.groups) { let have = 0; for (const grp of d.groups) if (grp.some((c) => c.owned)) have++; return { have: Math.min(have, d.goal), goal: d.goal }; }
  let have = 0;
  for (const c of d.pool || d.list) if (c.owned) have++;
  return { have: Math.min(have, d.goal), goal: d.goal };
}

// ----- earning: checked whenever a card changes (with the finish), luck rolled once per medal -----
let medals = {};
try { medals = JSON.parse(localStorage.getItem("wall-medals") || "{}") || {}; } catch { medals = {}; }
const persistMedals = () => { try { localStorage.setItem("wall-medals", JSON.stringify(medals)); } catch { /* private mode */ } };
let medVer = 0, medInit = false, medReady = false;
// Luck, seeded by the medal's id: 1 in 100 Shiny, otherwise about 1 in 10 Critical (h32, then a finaliser so ids
// that differ only at the end don't land side by side).
function luckOf(id) {
  let h = Math.floor(h32(`luck|${id}`) * 4294967296);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  const r = (h >>> 0) / 4294967296;
  return r < 0.01 ? "shiny" : r < 0.11 ? "crit" : "";
}
const medalCount = () => Object.keys(medals).length;
const hiddenLeft = () => globalDefs().filter((d) => d.hidden && !medals[d.id]).length;
const lookOf = (id) => medals[id]; // a stored medal carries its own look, so one whose chase is gone still draws
function syncDone(opts = {}) { const r = syncDone0(opts); syncMedals(opts); return r; }
function syncMedals({ quiet = false } = {}) {
  if (!medReady) return; // the opening check does the first one, quietly
  const first = !medInit; medInit = true;
  const defs = allMedalDefs(), fresh = [], had = medalCount() > 0;
  for (let pass = 0; pass < 3; pass++) { // twice more for the medals about medals
    let more = 0;
    for (const d of defs) {
      if (medals[d.id]) continue;
      const p = prog(d); if (!(p.goal > 0 && p.have >= p.goal)) continue;
      medals[d.id] = { at: Date.now(), rank: luckOf(d.id), name: d.name, owner: d.owner, ownerName: d.ownerName, tier: d.tier, kind: d.kind, color: d.color, plate: d.plate, sig: d.sig || undefined, hidden: d.hidden || undefined, desc: d.desc };
      fresh.push(d); more++;
    }
    if (!more) break;
  }
  if (!fresh.length) return;
  persistMedals(); medVer++;
  if (!first) queueMints(fresh, quiet);
  if (!had) { layoutAll(); kick(); } // the door appears at the end of the wall
  if (!first) drawList();
}
setTimeout(() => { medReady = true; syncMedals({ quiet: true }); kick(); }, 0);
// Reset the demo clears the medals too.
{ const rb = document.getElementById("reset"), r0 = rb.onclick; rb.onclick = (e) => { try { localStorage.removeItem("wall-medals"); } catch { /* fine */ } r0?.(e); }; }
document.querySelector("#about ul")?.insertAdjacentHTML("beforeend", "<li><b>Medals</b> hang on every progress bar where you earn them: half, three quarters, the last three, complete, and the set's own at the end. The next one is lit. Tap one in an open set to see the cards behind it. Earned medals go to the trophy room at the end of the wall.</li>");

// ----- the pins on the bar -----
// The medals one bar carries, earned or not, and the next one to earn (fewest cards to go). Cached per group until a
// count or a medal changes.
function pinsOf(g, owned) {
  if (!(g.set || g.chase) || !g.base) return null;
  const defs = defsOf(g), key = `${g.md.key}|${owned}|${medVer}`;
  if (g.pins?.key === key) return g.pins;
  const bar = [], end = [];
  let next = null, best = Infinity;
  for (const d of defs) {
    const p = prog(d), on = Boolean(medals[d.id]), pin = { d, on, left: Math.max(0, p.goal - p.have) };
    (d.where === "bar" ? bar : end).push(pin);
    if (!on && pin.left > 0 && pin.left < best) { best = pin.left; next = pin; }
  }
  bar.sort((a, b) => a.d.frac - b.d.frac);
  return (g.pins = { key, bar, end, next });
}
const pinAt = new Map(); // where each pin was last drawn on screen: a mint starts there
// The bar, now with its medals. Far out (the mosaic) a pin is a 3px dot of tier colour hanging under the bar; up
// close (head: the set's header) it's the medal, hanging on a thread. The bar stops short of its end goals.
function drawBar(g, x, y, w, h, now, k = 1, head = false) {
  const timed = state.time, t = ticksOf(g), f = finishOf(g);
  const P = mode === "set" && !picking() ? pinsOf(g, t.owned) : null;
  let bw = w, pw = 0;
  if (P) {
    if (head) { pw = clamp(19 * k, 12, 28); bw = w - (P.end.length ? Math.min(w * 0.34, pw * 0.5 + 9 * k + pw + (P.end.length - 1) * pw * 0.8) : pw * 0.5); } // past a few, the end medals overlap like a stack
    else bw = w - (P.end.length ? P.end.length * 4 + 6 : 2);
  }
  const owned = timed ? ownedNow(g.cards) : t.owned, n = timed ? g.cards.length : t.n;
  let frac = n ? owned / n : 0;
  if (f && g.finT && !reduced) { const p = clamp((now - g.finT) / 600, 0, 1); frac = g.finFrom + (1 - g.finFrom) * (1 - Math.pow(1 - p, 3)); }
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, y, bw, h);
  ctx.fillStyle = owned === n ? "#E2B33C" : g.ink; ctx.fillRect(x, y, bw * frac, h);
  if (!timed && t.chased && owned < n && !picking()) {
    ctx.fillStyle = theme.gold;
    const th = h + 4 * k, ty = y - 2 * k;
    if (t.ticks.length > 8) ctx.fillRect(x + bw * owned / n, ty, bw * t.chased / n, th);
    else { const tw = Math.max(1, Math.min(2, (bw / n) * 0.5)); for (const p of t.ticks) ctx.fillRect(x + bw * p - tw / 2, ty, tw, th); }
  }
  if (f && g.finT && !reduced) {
    const p = (now - g.finT - 350) / 900;
    if (p > 0 && p < 1) {
      const gx = x - bw * 0.3 + p * bw * 1.6, gr = ctx.createLinearGradient(gx, 0, gx + bw * 0.3, 0);
      gr.addColorStop(0, "rgb(255 255 255 / 0)"); gr.addColorStop(0.5, "rgb(255 255 255 / .85)"); gr.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.fillStyle = gr; ctx.fillRect(x, y - 1 * k, bw, h + 2 * k);
    }
    if (now - g.finT < 1400) kick();
  }
  if (P) drawPins(g, P, x, y, bw, w, h, now, k, head, pw, timed ? owned : -1);
}
function drawPins(g, P, x, y, bw, w, h, now, k, head, pw, tOwned) {
  const A = ctx.globalAlpha, timed = tOwned >= 0;
  const isOn = (p) => (timed ? tOwned >= p.d.goal : p.on), next = timed ? null : P.next;
  const bar = P.bar, ends = timed ? [] : P.end, xs = new Array(bar.length), gap = head ? pw * 0.92 : 3.5, half = head ? pw / 2 : 1.5;
  // the milestones sit at their points, nudged left when two would overlap (the last three and complete, on a big set)
  for (let i = bar.length - 1; i >= 0; i--) xs[i] = Math.min(x + bw * bar[i].d.frac, i === bar.length - 1 ? x + bw : xs[i + 1] - gap);
  for (let i = 0; i < bar.length; i++) xs[i] = Math.max(xs[i], i ? xs[i - 1] + gap : x + half);
  if (!head) {
    const dy = y + h;
    const dot = (p, cx) => {
      const on = isOn(p), lit = p === next, col = TIER_DOT[p.d.tier];
      if (lit) { ctx.globalAlpha = A * 0.32; ctx.fillStyle = col; ctx.fillRect(cx - 3.5, dy - 2, 7, 8); }
      ctx.globalAlpha = A; ctx.fillStyle = on || lit ? col : theme["slot-line"];
      if (on || lit) ctx.fillRect(cx - 1.5, dy, 3, 4); else ctx.fillRect(cx - 1, dy, 2, 3);
      pinAt.set(p.d.id, { x: cx, y: dy + 1.5, w: 3, t: now });
    };
    for (let i = 0; i < bar.length; i++) dot(bar[i], xs[i]);
    for (let j = 0; j < ends.length; j++) dot(ends[j], x + bw + 5.5 + j * 4);
    ctx.globalAlpha = A;
    return;
  }
  const top = y + h + 1.5 * k, mh = pw * 0.92, pins = g.pinR = [];
  ctx.lineWidth = 1;
  const one = (p, cx, tx) => { // a notch where it's earned, the thread from the bar, then the medal
    const on = isOn(p), lit = p === next;
    ctx.globalAlpha = A * (on || lit ? 1 : 0.7); ctx.strokeStyle = ctx.fillStyle = on || lit ? TIER_DOT[p.d.tier] : theme["slot-line"];
    if (Math.abs(tx - cx) > 1) { ctx.fillRect(tx - 1, y - 1.5 * k, 2, h + 3 * k); ctx.beginPath(); ctx.moveTo(tx, y + h); ctx.lineTo(cx, top + pw * 0.14); ctx.stroke(); }
    else ctx.fillRect(cx - 0.5, y + h, 1, pw * 0.14 + 1.5 * k);
    ctx.globalAlpha = A;
    drawMedalAt(ctx, p.d, on ? medals[p.d.id]?.rank : "", cx, top, pw, on ? "on" : lit ? "lit" : "ghost", on ? 100 : 90); // an earned one shows the top of its ribbons
    pins.push({ d: p.d, x: cx - pw / 2, y: top, w: pw, h: mh });
    pinAt.set(p.d.id, { x: cx, y: top + pw * 0.45, w: pw, t: now });
  };
  for (let i = 0; i < bar.length; i++) one(bar[i], xs[i], x + bw * bar[i].d.frac);
  if (ends.length) {
    const ex = x + bw + pw * 0.5 + 6 * k, room = x + w - ex - pw, step = ends.length > 1 ? Math.min(pw + 2 * k, room / (ends.length - 1)) : 0;
    ctx.globalAlpha = A * 0.7; ctx.fillStyle = theme["slot-line"]; ctx.fillRect(ex - 2 * k, y + h / 2 - 0.5, x + w - ex + 2 * k, 1); // the road goes on past complete
    for (let j = ends.length - 1; j >= 0; j--) { const cx = ex + pw / 2 + j * step; one(ends[j], cx, cx); }
  }
  ctx.globalAlpha = A;
}
// A pin up close under a finger (in the open set's header).
function pinHit(sx, sy) {
  if (view !== "set" || !state.g?.pinR || state.trans) return null;
  let best = null, bd = Infinity;
  for (const r of state.g.pinR) {
    const cx = r.x + r.w / 2, dx = Math.abs(sx - cx);
    if (dx > Math.max(r.w / 2, 12) || sy < r.y - 10 || sy > r.y + r.h + 10) continue;
    if (dx < bd) { bd = dx; best = r.d; }
  }
  return best;
}

// ----- the mint: the medal pops off the bar, shows its luck, and flies to the door -----
const mintQ = [], mintsOn = [];
let doorBump = 0, medCause = null;
const luckScore = (d) => { const r = medals[d.id]?.rank; return (r === "shiny" ? 1000 : r === "crit" ? 500 : 0) + TIER_ORDER.indexOf(d.tier) * 10 + (d.sig ? 3 : 0) + (/:complete$/.test(d.id) ? 5 : 0); };
const listShown = () => document.body.classList.contains("listmode");
// Up to four at once each get their moment; past that (a set filled in one go, an import) the three luckiest do, and
// the rest rise off their bars together and stream to the door.
function queueMints(list, quiet) {
  if (listShown()) { doorBump = performance.now(); return; }
  const ranked = list.slice().sort((a, b) => luckScore(b) - luckScore(a)), big = new Set(list.length > 4 ? ranked.slice(0, 3) : list);
  const smalls = reduced ? [] : list.filter((d) => !big.has(d)), bigs = list.filter((d) => big.has(d)).sort((a, b) => luckScore(a) - luckScore(b)); // the luckiest last
  let at = performance.now() + (quiet ? 1300 : 420);
  for (const d of smalls) { mintQ.push({ d, at, big: false, cause: medCause }); at += 55; }
  if (smalls.length) at += 350;
  const many2 = bigs.length > 1; // one at a time: the next rises as the last one leaves for the door
  for (const d of bigs) { mintQ.push({ d, at, big: true, cause: medCause, brief: many2 }); at += reduced ? 1900 : 380 + (medals[d.id]?.rank ? 1500 : many2 ? 850 : 1000); }
  mintQ.sort((a, b) => a.at - b.at);
  medCause = null; kick();
}
const canMint = () => !tbl.on && !wel.on && !bnd.on && !room.on && !listShown();
const shownMedals = () => medalCount() - (reduced ? 0 : mintQ.length + mintsOn.length); // the door counts one when it lands
function mintFrom(q, now) {
  const p = pinAt.get(q.d.id);
  if (p && now - p.t < 300 && p.y > 0 && p.y < vh) return { x: p.x, y: p.y, w: Math.max(6, p.w) };
  const r = q.cause && tileRectOf(q.cause);
  if (r && r.y + r.h > 0 && r.y < vh && r.x + r.w > 0 && r.x < vw) return { x: r.x + r.w / 2, y: clamp(r.y + Math.min(r.h * 0.3, 40), 80, vh - 120), w: clamp(r.w * 0.4, 10, 28) };
  return { x: vw / 2, y: vh * 0.5, w: 12 };
}
function doorTarget() {
  if (view === "mosaic" && trophyCase && mode === "set") {
    const m = mr(trophyCase), x = m.x + m.w - 70, y = m.y + m.h / 2;
    if (y > vh - botPad()) return { x: clamp(x, 40, vw - 40), y: vh + 50, off: true };
    if (y < topPad()) return { x, y: -50, off: true };
    return { x, y, off: false };
  }
  return { x: vw / 2, y: vh + 50, off: true }; // inside a set: down and away, toward the end of the wall
}
function startMint(q, now) {
  const from = mintFrom(q, now), W = q.big ? 78 : 22;
  const tb = toastEl.classList.contains("show") ? toastEl.getBoundingClientRect().bottom : 0;
  const up = from.y - 100, lo = Math.max(topPad() + 110, tb + 70), hi = vh - botPad() - 110; // clear of the toast and the lens bar
  const hold = q.big ? { x: clamp(from.x, 104, vw - 104), y: up >= lo ? up : clamp(from.y + 120, lo, hi) } : { x: from.x, y: from.y - 26 };
  if (reduced && q.big) { hold.x = clamp(vw / 2, 104, vw - 104); hold.y = clamp(vh * 0.42, lo, hi); }
  const rank = medals[q.d.id]?.rank || "";
  q.d.lookRank = rank;
  if (q.big && !reduced) setTimeout(() => tick(rank === "shiny" ? [12, 40, 12, 40, 60] : rank === "crit" ? [16, 50, 30] : 18), 500);
  return { ...q, t0: now, from, hold, W, rank, A: q.big ? 380 : 210, H: q.big ? (rank ? 1500 : q.brief ? 850 : 1000) : 130, F: q.big ? 640 : 600 };
}
const backOut = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOut3 = (t) => 1 - Math.pow(1 - t, 3);
function drawMints(now) {
  if (!mintQ.length && !mintsOn.length) return;
  if (listShown()) { mintQ.length = 0; mintsOn.length = 0; return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (canMint()) while (mintQ.length && mintQ[0].at <= now) mintsOn.push(startMint(mintQ.shift(), now));
  for (let i = mintsOn.length - 1; i >= 0; i--) if (drawMint(mintsOn[i], now)) { mintsOn.splice(i, 1); doorBump = now; }
  ctx.globalAlpha = 1;
  kick();
}
function drawMint(m, now) {
  const p = now - m.t0, d = m.d;
  if (reduced) { // a still: it appears above the bar with its luck, and fades; nothing moves
    const total = 1800; if (p >= total) return true;
    const a = clamp(Math.min(p / 200, (total - p) / 300), 0, 1);
    ctx.globalAlpha = a; drawMedalAt(ctx, d, m.rank, m.hold.x, m.hold.y - m.W * 0.5, m.W, "on");
    mintLabel(m, m.hold.x, m.hold.y + m.W * 0.62, a, true);
    return false;
  }
  const { A, H, F, W, from, hold } = m;
  if (p >= A + H + F) return true;
  let cx, cy, size, alpha = 1, fx = 0, la = 0;
  if (p < A) { const e = clamp(backOut(p / A), 0, 1.2), u = easeOut3(p / A); size = from.w + (W - from.w) * e; cx = from.x + (hold.x - from.x) * u; cy = from.y + (hold.y - from.y) * u; }
  else if (p < A + H) { size = W; cx = hold.x; cy = hold.y + Math.sin((p - A) / 260) * (m.big ? 1.5 : 0); la = m.big ? clamp((p - A) / 180, 0, 1) : 0; fx = 1; }
  else {
    const q = (p - A - H) / F, e = q * q * (3 - 2 * q), T = doorTarget(), c = { x: hold.x + (T.x - hold.x) * 0.2, y: Math.min(hold.y, T.y) - 50 };
    const s = 1 - e; cx = s * s * hold.x + 2 * s * e * c.x + e * e * T.x; cy = s * s * hold.y + 2 * s * e * c.y + e * e * T.y;
    size = W + (14 - W) * e; alpha = q > 0.86 ? (1 - q) / 0.14 : 1; fx = clamp(1 - q * 5, 0, 1); la = m.big ? clamp(1 - q * 6, 0, 1) : 0;
  }
  const revealed = !m.big || p > A + 120, rv = p - A - 120;
  if (m.big && fx > 0) mintBurst(m, cx, cy, size, rv, fx, now);
  ctx.globalAlpha = alpha;
  drawMedalAt(ctx, d, revealed ? m.rank : "", cx, cy - size * 0.5, size, "on");
  if (m.big && la > 0) mintLabel(m, cx, cy + size * 0.68, la, revealed);
  return false;
}
// What sits behind the medal while it's up: a glow, then its luck (a starburst for Critical; a turning rainbow and
// sparkles for Shiny; a ring for an ordinary one).
function mintBurst(m, cx, cy, size, rv, fx, now) {
  const [hi] = TIER_COLORS[m.d.tier] || TIER_COLORS.gold, rank = m.rank;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.95);
  g.addColorStop(0, `${hi}AA`); g.addColorStop(1, `${hi}00`);
  ctx.globalAlpha = fx * 0.8; ctx.fillStyle = g; ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  if (rv <= 0) return;
  if (rv < 420) { const q = rv / 420; ctx.globalAlpha = fx * (1 - q); ctx.lineWidth = 3 * (1 - q) + 1; ctx.strokeStyle = rank === "crit" ? "#FFCB05" : rank === "shiny" ? "#C77DFF" : hi; ctx.beginPath(); ctx.arc(cx, cy, size * (0.5 + q * 0.75), 0, Math.PI * 2); ctx.stroke(); }
  if (rank === "crit") {
    const q = clamp(rv / 240, 0, 1), R = size * (0.55 + 0.5 * easeOut3(q)), r0 = size * 0.44, rot = now * 0.0007;
    ctx.globalAlpha = fx * q; ctx.fillStyle = "#FFCB05"; ctx.strokeStyle = "#9A6A00"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = rot + (i / 12) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a - 0.13) * r0, cy + Math.sin(a - 0.13) * r0); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a + 0.13) * r0, cy + Math.sin(a + 0.13) * r0); }
    ctx.fill(); ctx.stroke();
  } else if (rank === "shiny") {
    const q = clamp(rv / 300, 0, 1), rot = now * 0.002, R = size * 0.66;
    ctx.globalAlpha = fx * q; ctx.lineWidth = 4; ctx.lineCap = "round";
    RAINBOW.forEach(([, col], i) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, rot + i * 1.2566, rot + i * 1.2566 + 0.95); ctx.stroke(); });
    ctx.lineCap = "butt";
    for (let i = 0; i < 5; i++) {
      const a = -rot * 0.6 + i * 1.2566, s = 0.45 + 0.4 * Math.sin(now * 0.008 + i * 1.7), x = cx + Math.cos(a) * size * 0.86, y = cy + Math.sin(a) * size * 0.86;
      ctx.globalAlpha = fx * q * clamp(s + 0.2, 0, 1); ctx.save(); ctx.translate(x, y); ctx.scale(s * size / 100, s * size / 100);
      ctx.fillStyle = "#FFF7B0"; ctx.strokeStyle = "#C99A00"; ctx.lineWidth = 1; const sp = P2(sparkleD(0, 0, 1.6)); ctx.fill(sp); ctx.stroke(sp); ctx.restore();
    }
  }
}
function mintLabel(m, cx, y, a, revealed) {
  const d = m.d, rank = revealed ? m.rank : "";
  const l1 = d.name, l2 = rank ? `${RANK_LABEL[rank]} · 1 in ${rank === "shiny" ? 100 : 10}` : d.ownerName || "";
  font(800, 15, true); const w1 = textW(l1); font(600, 11.5); const w2 = textW(l2);
  const w = Math.max(w1, w2) + 26, x = clamp(cx - w / 2, 8, vw - 8 - w);
  ctx.globalAlpha = a * 0.96; rr(x, y, w, 40, 10); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = rank === "crit" ? "#E0B000" : rank === "shiny" ? "#B58BF0" : theme["slot-line"]; ctx.stroke();
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.ink; font(800, 15, true); ctx.fillText(l1, x + w / 2, y + 18);
  ctx.fillStyle = rank === "crit" ? theme.gold : rank === "shiny" ? "#8E5BE8" : theme.muted; font(rank ? 700 : 600, 11.5); ctx.fillText(l2, x + w / 2, y + 33);
  ctx.textAlign = "left";
}
function drawMarks() { drawMints(performance.now()); drawMarks0(); }
function drawMarks0() {
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

// ----- the medal sheet: what a medal is, and the cards behind it, missing ones first -----
const medSheet = document.createElement("dialog");
medSheet.id = "medal-sheet"; medSheet.className = "msheet"; medSheet.setAttribute("aria-labelledby", "ms-h");
document.body.append(medSheet);
medSheet.addEventListener("click", (e) => { if (e.target === medSheet) medSheet.close(); });
addEventListener("keydown", (e) => { if (medSheet.open && e.key === "Escape") e.stopImmediatePropagation(); }, true); // Escape closes the sheet, not the room behind it
function cardsBehind(d) {
  if (!d || d.quietCards || d.fn) return [];
  if (d.groups) return d.groups.map((g) => g.find((c) => c.owned) || g[0]);
  const seen = new Set(), out = [];
  for (const c of d.pool || d.list || []) { const b = rootOf(c); if (!seen.has(b)) { seen.add(b); out.push(b); } }
  return out;
}
function openMedal(d0) {
  const d = typeof d0 === "string" ? allMedalDefs().find((x) => x.id === d0) || { id: d0, ...medals[d0] } : d0;
  const rec = medals[d.id], earned = Boolean(rec), rank = rec?.rank || "", look = earned ? { ...d, ...rec } : d;
  const p = d.fn || d.goal ? prog(d) : { have: 1, goal: 1 }, behind = cardsBehind(d);
  const missing = behind.filter((c) => !c.owned), have = behind.filter((c) => c.owned), shown = [...missing, ...have].slice(0, 24);
  const owner = medalOwners().find((g) => medOwnerOf(g) === d.owner);
  const row = (c) => `<li class="${c.owned ? "own" : "miss"}"><i style="background:${typeColor(c)}"></i><span><b>${esc(c.name)}</b><small>${esc(sets[c.si].name)} #${esc(c.num)}${c.variant ? `, ${esc(c.variant)}` : ""}</small></span><em>${c.owned ? "✓" : short(c.price)}</em></li>`;
  const status = earned ? `Earned ${dayOf(rec.at)}.${rank ? "" : " Its luck roll came up plain."}` : `${Math.max(0, p.goal - p.have)} more to go.`;
  medSheet.innerHTML = `
    <div class="ms-medal${rank ? ` ${rank}` : ""}"><img src="${medalURL(look, rank, 120, earned ? "on" : "off")}" alt="" width="120" height="149"></div>
    ${earned && rank ? `<p class="ms-rank ${rank}">${rank === "shiny" ? "Shiny · 1 in 100" : "Critical · 1 in 10"}</p>` : ""}
    <h2 id="ms-h">${esc(d.name || "Medal")}</h2>
    <p class="ms-owner">${esc(d.ownerName || "")}${d.sig ? " · Signature" : ""}${d.hidden ? " · Hidden" : ""}</p>
    <p class="ms-desc">${esc(d.desc || "")}</p>
    ${shown.length ? `<p class="lbl">${missing.length ? `${missing.length} missing, ${have.length} yours` : `All ${have.length} yours`}</p><ul class="ms-cards">${shown.map(row).join("")}</ul>${behind.length > shown.length ? `<p class="ms-more">and ${behind.length - shown.length} more</p>` : ""}` : ""}
    <p class="ms-status">${esc(status)}</p>
    <div class="row">${owner && !(view === "set" && state.g === owner) && groups.includes(owner) ? `<button class="btn" data-ms-open>Open ${esc(owner.name)}</button>` : ""}<button class="btn primary" data-ms-close>Close</button></div>`;
  medSheet.querySelector("[data-ms-close]").onclick = () => medSheet.close();
  const ob = medSheet.querySelector("[data-ms-open]");
  if (ob) ob.onclick = () => { medSheet.close(); if (room.on && !inCase(owner)) closeRoom(true); if (view === "mosaic" && !state.trans) enterGroup(owner); }; // a plaque in the room opens its album from the room
  cancelPress(); tick(5);
  medSheet.showModal();
}

// ----- the door: the medals count there, and tick up as they land -----
const roomHas = () => caseList().length > 0 || medalCount() > 0;
function caseLayout(R, y) {
  const dn = caseList();
  room.slots = [];
  if (!dn.length && !medalCount()) { trophyCase = null; DOOR.m = null; return 0; }
  trophyCase = { x: R.x, y, w: R.w, h: DOOR_H }; DOOR.m = trophyCase; caseSeries();
  const n = dn.length, gap = 5, x0 = R.x + PG + 12, w = R.w - PG * 2 - 24, sw = (w - gap * (n - 1)) / n, ey = y + DOOR_H - PG - 17;
  dn.forEach((g, i) => { const m = { x: x0 + i * (sw + gap), y: ey, w: sw, h: ENGR_H }; room.slots.push({ g, ...m }); g.plq = plaqueInfo(g); if (!room.on) { g.m = m; packStrip(g, m); } });
  return DOOR_H;
}
const doorStrip = {};
function doorMedalsImage(w, h) { // the newest medals in a row, small, along the bottom of the door
  const list = Object.entries(medals).sort((a, b) => b[1].at - a[1].at), n = Math.min(list.length, Math.floor(w / 13));
  return cachedImage(doorStrip, `${medVer}|${medalCount()}|${Math.round(w)}|${dpr}|${theme["panel-solid"]}`, w, h, (x) => {
    for (let i = 0; i < n; i++) { const [, r] = list[i]; drawMedalAt(x, r, r.rank, 5 + i * 13, -1, 11, "on", 92); }
  });
}
function drawDoor(now, alpha) {
  const t = trophyCase; if (!t || state.trans) return;
  const m = mr(t); if (m.y > vh || m.y + m.h < 0) return;
  const x = m.x + PG, y = m.y + PG, w = m.w - PG * 2, h = m.h - PG * 2, s = room.sum || caseSeries(), nm = shownMedals(), bump = clamp(1 - (now - doorBump) / 800, 0, 1);
  ctx.globalAlpha = alpha;
  rr(x, y, w, h, 12); ctx.fillStyle = theme.door; ctx.fill();
  ctx.save(); rr(x, y, w, h, 12); ctx.clip(); ctx.fillStyle = theme["door-hi"]; ctx.fillRect(x, y, w, 1.5); ctx.restore();
  if (bump > 0) { ctx.globalAlpha = alpha * bump; ctx.lineWidth = 2; ctx.strokeStyle = "#FFCB05"; rr(x - 1, y - 1, w + 2, h + 2, 13); ctx.stroke(); ctx.globalAlpha = alpha; kick(); }
  if (state.press?.g === DOOR) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; rr(x, y, w, h, 12); ctx.stroke(); }
  const parts = [];
  if (s.n) parts.push(`${s.n} ${s.n === 1 ? "trophy" : "trophies"}`);
  if (nm) parts.push(`${nm} ${nm === 1 ? "medal" : "medals"}`);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "right"; ctx.fillStyle = bump > 0.3 ? "#FFCB05" : theme["door-muted"]; font(600, 13);
  const stat = `${parts.join(" · ")}  ›`;
  ctx.fillText(stat, x + w - 12, y + 22);
  const sw = textW(stat);
  ctx.textAlign = "left"; ctx.fillStyle = theme["door-ink"]; font(800, 15.5, true); ctx.fillText(fitText("Trophy room", w - sw - 32), x + 12, y + 22);
  if (room.slots.length) for (const sl of room.slots) { ctx.fillStyle = "rgb(0 0 0 / .35)"; ctx.fillRect(sl.x - 1, sl.y - mScroll - 1, sl.w + 2, sl.h + 2); ctx.drawImage(engravingOf(sl.g, sl.w, sl.h), sl.x, sl.y - mScroll, sl.w, sl.h); }
  else if (medalCount()) { const sw2 = w - 24, sh = 14; ctx.drawImage(doorMedalsImage(sw2, sh), x + 12 - PADR, y + h - 21 - PADR, sw2 + PADR * 2, sh + PADR * 2); }
  ctx.globalAlpha = 1;
}
function openRoom() {
  if (room.on || state.trans || tbl.on || bnd.on || view !== "mosaic" || !roomHas()) return;
  hideCaption(); cancelPress(); closePop(true); tick(8);
  room.on = true; room.closing = false; room.wallScroll = mScroll; room.fan = null; room.pinch = null; mScroll = 0;
  layoutAll();
  document.body.classList.add("inroom"); setChrome();
  room.q = reduced ? 1 : 0; room.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 520 };
  kick();
}
function layoutAll() {
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); }
  groups.forEach(binderLayout);
  const keep = mScroll;
  if (lifted) { newPanel = null; liftedLayout(); } else mosaicLayout();
  if (room.on) { if (!roomHas()) { endRoom(); return; } if (room.fan && !inCase(room.fan)) room.fan = null; mScroll = keep; strip = null; roomLayout(); }
  if (bnd.on) { bnd.L = tbGeom(bnd.show); bnd.vi = clamp(bnd.vi, 0, tbViews() - 1); }
}

// ----- the room: each plaque with its medals hung beneath it, then shelves for the rest -----
const MROW = 112, MCELL = 72, LABEL_H = 30; // a row of medals (a shelf strip, then the hang), a medal's width, a shelf's label
const roomHeadH = () => (caseList().length ? ROOM_HEAD : 70);
const medalBlocks = new Map(); // one block per medal id, so a press stays on it across layouts
const blockOf = (id) => { let b = medalBlocks.get(id); if (!b) { b = { medal: id, lead: [], cards: [], m: null }; medalBlocks.set(id, b); } return b; };
const TEASE = { tease: true, lead: [], cards: [], m: null };
function medalSections() {
  const defs = allMedalDefs(), order = new Map(defs.map((d, i) => [d.id, i])), byOwner = new Map(), totals = new Map();
  for (const d of defs) if (!d.hidden) totals.set(d.owner, (totals.get(d.owner) || 0) + 1);
  for (const [id, r] of Object.entries(medals)) {
    let s = byOwner.get(r.owner);
    if (!s) { s = { owner: r.owner, title: r.ownerName, items: [] }; byOwner.set(r.owner, s); }
    s.items.push(id);
  }
  for (const s of byOwner.values()) s.items.sort((a, b) => (order.get(a) ?? 1e6) - (order.get(b) ?? 1e6) || medals[a].at - medals[b].at);
  const left = hiddenLeft();
  if (left && !byOwner.has("g")) byOwner.set("g", { owner: "g", title: "Across everything", items: [] });
  if (byOwner.has("g")) byOwner.get("g").tease = left;
  for (const s of byOwner.values()) { const nh = s.items.filter((id) => !medals[id].hidden).length; s.sub = totals.get(s.owner) ? `${nh} of ${totals.get(s.owner)}` : `${nh}`; }
  // the panels' own names win over a stored one (a chase renamed, a set in another view)
  for (const g of medalOwners()) { const s = byOwner.get(medOwnerOf(g)); if (s) s.title = g.set ? g.set.name : g.name; }
  return byOwner;
}
function layoutSection(sec, x, y, w, labelled) {
  const pad = PG + 6, cols = Math.max(1, Math.floor((w - pad * 2) / MCELL)), cw = (w - pad * 2) / cols;
  const n = sec.items.length + (sec.tease ? 1 : 0), rows = Math.max(1, Math.ceil(n / cols));
  const base = labelled ? LABEL_H : -12; // a plaque's first row hangs from the plaque's own shelf
  sec.m = { x, y, w, h: base + rows * MROW + 4 }; sec.labelled = labelled; sec.pad = pad; sec.base = base; sec.rows = rows;
  sec.cells = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols), id = sec.items[i];
    const cell = { x: x + pad + col * cw, y: y + base + row * MROW + 12, w: cw, h: MROW - 12, id: id || null };
    const blk = id ? blockOf(id) : TEASE; blk.m = cell; cell.blk = blk;
    sec.cells.push(cell);
  }
  return sec.m.h;
}
function roomLayout() {
  const dn = caseList(), W = Math.min(vw, 760), R = { x: (vw - W) / 2 + 8, w: W - 16 };
  const cols = R.w >= 560 ? 2 : 1, cw = R.w / cols, y0 = topPad() + roomHeadH(), rows = [], secs = medalSections();
  room.secs = [];
  let y = y0;
  for (let i = 0; i < dn.length; i += cols) {
    const row = dn.slice(i, i + cols), fan = row.find((g) => g === room.fan), h = ROW_H + (fan ? stackOf(fan).length * SUB_H : 0);
    let hm = 0;
    row.forEach((g, j) => {
      g.m = { x: R.x + j * cw, y, w: cw, h: ROW_H }; g.plq = plaqueInfo(g); packRoomPlaque(g);
      g.fanR = stackOf(g).length ? { x: g.m.x + g.m.w - PG - 12 - 150, y: g.m.y + 8, w: 150, h: 34 } : null;
      g.fanBtn ||= { fan: g, lead: [], cards: [] };
      if (g === room.fan) fanRows(g).forEach((r, k) => { r.m = { x: g.m.x, y: y + ROW_H + k * SUB_H, w: cw, h: SUB_H }; });
      const sec = secs.get(medOwnerOf(g));
      if (sec?.items.length) { secs.delete(sec.owner); hm = Math.max(hm, layoutSection(sec, g.m.x, y + h - 4, cw, false)); room.secs.push(sec); }
    });
    rows.push({ y: y + h - SHELF_H - 4, h: SHELF_H });
    y += h + (hm ? hm + 8 : 0);
  }
  // the rest: panels with medals and no plaque here (in wall order), anything left from a chase that's gone, the Dex, then everything else
  const rank = (s) => (s.owner === "g" ? 3 : s.owner === "dex" ? 2 : 0);
  const wallOrder = new Map(medalOwners().map((g, i) => [medOwnerOf(g), i]));
  const rest = [...secs.values()].sort((a, b) => rank(a) - rank(b) || (wallOrder.get(a.owner) ?? 900) - (wallOrder.get(b.owner) ?? 900));
  if (rest.length) y += 10;
  for (let i = 0; i < rest.length; i += cols) {
    let hh = 0;
    rest.slice(i, i + cols).forEach((sec, j) => { hh = Math.max(hh, layoutSection(sec, R.x + j * cw, y, cw, true)); room.secs.push(sec); });
    y += hh + 10;
  }
  room.L = { R, cols, rows, y0 };
  mMax = Math.max(0, y + botPad() + 10 - vh);
  mScroll = clamp(mScroll, 0, mMax);
}
const secArt = new Map(); // a shelf of medals, drawn once and kept
function sectionImage(sec) {
  const holder = secArt.get(sec.owner) || {}; secArt.set(sec.owner, holder);
  const { m, pad } = sec, key = `${Math.round(m.w)}|${Math.round(m.h)}|${sec.items.map((id) => `${id}${medals[id].rank}`).join(",")}|${sec.tease || 0}|${sec.title}|${sec.sub}|${look()}|${theme["panel-solid"]}`;
  return cachedImage(holder, key, m.w, m.h, (x) => {
    if (sec.labelled) {
      x.textBaseline = "alphabetic"; x.textAlign = "left"; x.fillStyle = theme["room-ink"]; fontOn(x, 800, 15, true);
      x.fillText(fitOn(x, sec.title, m.w - pad * 2 - 70), pad, 20);
      x.textAlign = "right"; x.fillStyle = theme["room-muted"]; fontOn(x, 600, 11.5); x.fillText(sec.sub, m.w - pad, 20);
    }
    for (let r = 0; r < sec.rows; r++) { // a shelf strip for every row but a plaque's first (its plaque's shelf is above it)
      if (!sec.labelled && r === 0) continue;
      const sy = sec.base + r * MROW;
      x.fillStyle = theme["room-wood"]; x.fillRect(pad - 6, sy, m.w - pad * 2 + 12, SHELF_H);
      x.fillStyle = theme["room-wood-hi"]; x.fillRect(pad - 6, sy, m.w - pad * 2 + 12, 1.5);
      x.fillStyle = "rgb(0 0 0 / .35)"; x.fillRect(pad - 6, sy + SHELF_H, m.w - pad * 2 + 12, 5);
    }
    for (const c of sec.cells) {
      const cx = c.x - m.x + c.w / 2, top = c.y - m.y, r = c.id ? medals[c.id] : null;
      if (r) {
        x.fillStyle = mix(r.color || MED_YELLOW, "#000000", 0.3); x.fillRect(cx - 3, top - 1, 6, 15); // the ribbon it hangs on
        x.fillStyle = r.color || MED_YELLOW; x.fillRect(cx - 3, top - 1, 2, 15);
        drawMedalAt(x, r, r.rank, cx, top + 6, 46, "on");
        x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillStyle = theme["room-ink"]; fontOn(x, 700, 11, true);
        x.fillText(fitOn(x, r.name, c.w - 4), cx, top + 76);
        x.fillStyle = r.rank === "crit" ? "#FFCB05" : r.rank === "shiny" ? "#D2B4FF" : theme["room-muted"]; fontOn(x, r.rank ? 700 : 500, 10);
        x.fillText(r.rank ? RANK_LABEL[r.rank] : dayOf(r.at), cx, top + 89);
      } else { // the hidden ones still out there
        x.globalAlpha = 0.6; drawMedalAt(x, { kind: "global", tier: "bronze", hidden: true, plate: "?" }, "", cx, top + 6, 46, "off"); x.globalAlpha = 1;
        x.textAlign = "center"; x.fillStyle = theme["room-ink"]; fontOn(x, 700, 11, true); x.fillText(`${sec.tease} left to find`, cx, top + 76);
        x.fillStyle = theme["room-muted"]; fontOn(x, 500, 10); x.fillText("Hidden", cx, top + 89);
      }
    }
  });
}
function drawRoom(now, alpha = 1, except = null) {
  const L = room.L; if (!L) return;
  live.line = null;
  ctx.globalAlpha = alpha; ctx.fillStyle = theme["room-bg"]; ctx.fillRect(0, 0, vw, vh);
  const R = L.R, hy = topPad() - mScroll, H = roomHeadH();
  if (hy + H > 0) ctx.drawImage(headerImage(R.w), R.x - PADR, hy - PADR, R.w + PADR * 2, H + PADR * 2);
  for (const row of L.rows) {
    const y = row.y - mScroll; if (y > vh || y + row.h < 0) continue;
    ctx.fillStyle = theme["room-wood"]; ctx.fillRect(R.x - 6, y, R.w + 12, row.h);
    ctx.fillStyle = theme["room-wood-hi"]; ctx.fillRect(R.x - 6, y, R.w + 12, 1.5);
    ctx.fillStyle = "rgb(0 0 0 / .35)"; ctx.fillRect(R.x - 6, y + row.h, R.w + 12, 6);
  }
  for (const sec of room.secs || []) {
    const m = mr(sec.m); if (m.y > vh || m.y + m.h < 0) continue;
    ctx.globalAlpha = alpha; ctx.drawImage(sectionImage(sec), m.x - PADR, m.y - PADR, m.w + PADR * 2, m.h + PADR * 2);
    const pg = state.press?.g;
    if (pg && (pg.medal || pg.tease)) for (const c of sec.cells) if (c.blk === pg) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme["room-ink"]; rr(c.x + 4, c.y - mScroll + 2, c.w - 8, c.h - 6, 8); ctx.stroke(); }
  }
  for (const g of caseList()) {
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h + (g === room.fan ? stackOf(g).length * SUB_H : 0) - mScroll < 0) continue;
    drawPanel(g, now, alpha);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha);
  }
  ctx.globalAlpha = 1;
}
function headerImage(w) {
  const s = room.sum || caseSeries(), nm = medalCount(), H = roomHeadH();
  const crit = Object.values(medals).filter((m) => m.rank === "crit").length, shiny = Object.values(medals).filter((m) => m.rank === "shiny").length;
  const parts = [s.n ? `${s.n} ${s.n === 1 ? "trophy" : "trophies"}` : "", nm ? `${nm} ${nm === 1 ? "medal" : "medals"}` : "", shiny ? `${shiny} shiny` : "", crit ? `${crit} critical` : ""].filter(Boolean);
  return cachedImage(room, `${Math.round(w)}|${s.key}|${H}|${parts.join(",")}|${look()}`, w, H, (x) => {
    x.textBaseline = "alphabetic"; x.textAlign = "left"; x.fillStyle = theme["room-ink"]; fontOn(x, 800, 26, true);
    x.fillText("Trophy room", 10, 30);
    if (s.n) { x.textAlign = "right"; fontOn(x, 800, 22); x.fillText(short(s.worth), w - 10, 30); }
    x.textAlign = "left"; x.fillStyle = theme["room-muted"]; fontOn(x, 600, 12.5);
    x.fillText(parts.join(", "), 10, 48);
    if (!s.n) return;
    x.textAlign = "right"; x.fillStyle = s.delta >= 0 ? theme["room-up"] : theme["room-down"]; fontOn(x, 600, 12.5);
    x.fillText(deltaText(s.delta), w - 10, 48);
    drawWorthLine(x, s.pts, 10, 60, w - 20, 44, theme["room-plaque"], "rgb(230 192 80 / .12)");
    x.fillStyle = theme["room-muted"]; fontOn(x, 500, 10.5); x.textAlign = "left"; x.fillText("A year ago", 10, 116); x.textAlign = "right"; x.fillText("Now", w - 10, 116);
  });
}

// ----- input: a medal in the room is a block a tap lands on; a pin up close opens its sheet -----
function hit(sx, sy, nearest = false) {
  if (state.trans) return null;
  if (view === "mosaic") {
    if (room.on && room.closing) return null;
    if (room.on && room.anim) finishRoomAnim();
    const y = sy + mScroll;
    if (room.on) {
      for (const sec of room.secs || []) if (inR(sec.m, sx, y)) for (const c of sec.cells) if (inR(c, sx, y)) return { block: c.blk };
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
    if (COVER.m && inR(COVER.m, sx, y)) return { block: COVER };
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
function enterGroup(g, { then = null } = {}) {
  if (state.trans) return;
  if (g.medal) { openMedal(g.medal); return; }
  if (g.tease) { tick(3); toast(`${hiddenLeft()} hidden ${hiddenLeft() === 1 ? "medal is" : "medals are"} still out there. They show once you earn them.`); return; }
  if (g.tbCover) { openBinder(); return; }
  if (g.door) { openRoom(); return; }
  if (g.fan) { toggleFan(g.fan); return; }
  if (g.pick) { openScope(g.pick.g, g.pick.scope); return; }
  hideCaption(); tick(8);
  state.trans = openTrans(g, 0, fitCam(g)); state.trans.then = then;
  settle(1, 720);
}
function tap(sx, sy) {
  if (state.trans) return;
  if (view === "set" && !state.focus && !marking) { const pd = pinHit(sx, sy); if (pd) return openMedal(pd); } // a medal on the bar: the cards behind it
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch);
    if (h?.block && lifted && !h.block.done && !h.block.medal && !h.block.tease) {
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") {
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m));
    }
    if (h?.block) enterGroup(h.block);
    else if (newPanelAt(sx, sy)) { tick(4); openSheet(); }
    return;
  }
  if (!h?.card) {
    if (h?.block && !marking && !fly && !shuffle) { const p = headAt(h.block, sx, sy); if (p) { tick(4); if (p.seg) setScope(h.block.set, p.seg); else if (p.btn) { if (p.btn.shelf) toggleShelf(h.block); else if (p.btn.away) putAway(h.block); else if (p.btn.pop) chasePopular(h.block.set); else if (p.btn.remove) removeSet(h.block.set); else removeChase(h.block.chase); } else focus(p.c); } }
    return;
  }
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}
// The card that tipped a medal is remembered for a beat, so a medal with no pin (the Dex, across everything) rises from it.
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now(), b = c.base || c;
  if (on) medCause = c;
  b.owned = on; b.got = on ? Date.now() : null; saved[b.id] = { on, at: b.got }; persist();
  for (const t of [b, ...twinsOf(b)]) { t.anim = { t0: now, to: on }; const tg = groups[t.g]; if (tg && (t === c || tg.base?.includes(t) || tg.cards.includes(t))) tg.ripple = { t0: now, col: t.col, row: t.row }; }
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  let sync = null;
  if (quietLayout) doneDirty = true; else sync = syncDone();
  if (sync?.minted.length) { tick(40); toast(finishedText(sync.minted), undo); }
  else if (sync?.freed.length) toast(`${c.name} taken out. ${sync.freed.map(trophyName).join(" and ")} ${sync.freed.length === 1 ? "is" : "are"} back on the wall.`, undo);
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  if (lifted && !quietLayout && !sync) liftLayout(true);
  medCause = null;
  updateCount(); drawList(); kick();
}

// ----- the header up close: the same as before, with the bar drawn as the medal road -----
function drawHeader(st, now, C = cam, ox = 0, alpha = 1) {
  const sx = (st.x - C.x) * C.s + ox, sy = (st.y - C.y) * C.s, sw = st.w * C.s;
  const k = (st.head * C.s) / (132 + (st.popH || 0)), hh = 132 * k;
  const owned = ownedNow(st.cards), n = st.cards.length, f = finishOf(st);
  ctx.globalAlpha = alpha * (state.focus ? 1 - state.dimAll * 0.7 : 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const title = clamp(34 * k, 16, 64), sub = clamp(14 * k, 10, 24);
  ctx.fillStyle = theme.ink; font(800, title, true);
  ctx.fillText(fitText(f ? trophyName(st) : st.name, sw), sx, sy + hh * 0.5);
  const pct = `${Math.floor((owned / n) * 100)}%`;
  font(700, sub); const pw = ctx.measureText(pct).width;
  ctx.textAlign = "right"; ctx.fillStyle = f ? theme.gold : theme.ink; ctx.fillText(pct, sx + sw, sy + hh * 0.72);
  ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(500, sub);
  const line = state.time ? `${owned} of ${n} by ${monthOf(state.t)}` : f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(st.base || st.cards))}.${f.put ? "" : " On the wall."}` : st.sub();
  ctx.fillText(fitText(line, sw - pw - 12), sx, sy + hh * 0.72);
  drawBar(st, sx, sy + hh * 0.82, sw, Math.max(1.5, 3 * k), now, k, k >= 0.45);
  if (st.popChips) drawPopRow(st, sx, sy + hh, k, ctx.globalAlpha);
  else if ((st.chase || f) && k >= 0.3) { for (const b of [st.hdrBtn, st.hdrBtn2]) if (b) drawHdrBtn(st, b, sx, sy + hh + b.y * k, k, ctx.globalAlpha); ctx.textBaseline = "alphabetic"; }
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

// ----- the list: the medals in the Trophies section, and each set's next one -----
const nextMedalText = (g) => { if (mode !== "set") return ""; const P = pinsOf(g, ownedIn(g.base || g.cards)); return P?.next ? ` Next medal: ${P.next.d.name}, ${P.next.left} to go.` : ""; };
function trophyListHTML(show, rows) {
  const fin = groups.filter((g) => g.done).sort(byFinish), list = Object.entries(medals).sort((a, b) => b[1].at - a[1].at);
  if (!fin.length && !list.length) return "";
  const left = hiddenLeft(), crit = list.filter(([, m]) => m.rank === "crit").length, shiny = list.filter(([, m]) => m.rank === "shiny").length;
  const plaques = fin.map((g) => {
    const f = finishOf(g), items = g.cards.filter(show), s = seriesOf(g);
    return `<h3 class="lfin">${esc(trophyName(g))}</h3><p class="lsub lfin-line"><span>Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. ${deltaText(s.delta)}.${onShelf(g) ? " On the shelf today." : " In the trophy room."}</span><button type="button" class="pill-btn" data-shelf="${esc(doneKey(g))}">Back to the wall</button></p>${items.length ? rows(items) : ""}`;
  }).join("");
  const medalsHTML = list.length || left ? `<h3 class="lfin">Medals</h3><p class="lsub">${list.length} earned${shiny ? `, ${shiny} shiny` : ""}${crit ? `, ${crit} critical` : ""}.${left ? ` ${left} hidden left to find.` : ""}</p><ul class="lmedals">${list.map(([id, m]) => `<li><button type="button" class="lmedal" data-medal="${esc(id)}"><img src="${medalURL(m, m.rank, 32)}" alt="" width="32" height="40"><span><b>${esc(m.name)}</b><small>${esc(m.ownerName || "")}. Earned ${dayOf(m.at)}.${m.rank ? ` ${RANK_LABEL[m.rank]}.` : ""}</small></span></button></li>`).join("")}</ul>` : "";
  return `<section class="lshelf"><h2>Trophies</h2><p class="lsub">Finished sets and chases, and the medals earned along the way.</p>${plaques}${medalsHTML}</section>`;
}
document.getElementById("list").addEventListener("click", (e) => { const b = e.target.closest("[data-medal]"); if (b) openMedal(b.dataset.medal); });
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c))).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top = `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}<p class="lsub"><button type="button" class="pill-btn" data-lnew>New chase</button></p></section>`;
  }
  if (state.lens === "trade") top = tradeListHTML();
  const row = (c) => {
    const st = sets[c.si];
    return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${lstateOf(c)}</span></button></li>`;
  };
  const rows = (items) => `<ul>${items.map(row).join("")}</ul>`;
  listEl.querySelector("#list-body").innerHTML = top + trophyListHTML(show, rows) + groups.map((g) => {
    if (g.done) return "";
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}.${nextMedalText(g)}</p><ul>${items.map(row).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

// ----- the finish check, as before (66-trophy); syncDone above adds the medals to it -----
function syncDone0({ quiet = false } = {}) {
  const list = mode === "set" ? groups : [...(setGroups || []), ...chaseGroups.values()];
  const minted = [], freed = [], now = performance.now();
  for (const g of list) {
    if (!g.set && !g.chase || !g.base) continue;
    const key = doneKey(g), n = g.base.length, full = n > 0 && ownedIn(g.base) === n, e = done[key];
    if (full && !e) { done[key] = { at: Date.now(), put: true }; minted.push(g); g.finT = now; g.finFrom = (n - 1) / n; }
    else if (!full && e) { delete done[key]; g.finT = 0; if (e.put) freed.push(g); }
  }
  if (!minted.length && !freed.length) return null;
  persistDone();
  applyDone(minted, freed, quiet);
  return { minted, freed };
}
// Debug builds only: the tests' hook sees the medals.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { medals: { get: () => medals }, medalDefs: { value: allMedalDefs }, syncMedals: { value: syncMedals }, openMedal: { value: openMedal }, pinsOf: { value: pinsOf }, defsOf: { value: defsOf }, mintQ: { get: () => mintQ }, mintsOn: { get: () => mintsOn }, roomSecs: { get: () => room.secs }, pinAt: { value: pinAt }, luckOf: { value: luckOf }, sets: { value: sets }, toggleWithUndo: { value: toggleWithUndo } }); }, 0);
