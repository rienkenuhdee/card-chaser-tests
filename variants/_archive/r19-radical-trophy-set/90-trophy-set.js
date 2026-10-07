// ---------- round 19, radical: trophies are a set you collect ----------
// Production's trophy catalog (per-chase milestones named by kind, in-chase goals, signature trophies, Dex trophies,
// the global ones and the hidden ones, with luck) becomes one more set on the wall: "Trophies", a panel near the end,
// before the trophy room's door, in the same grammar as a set of cards. Each medal is a card-shaped pocket: earned ones
// are a card face with the medal on it, unearned ones are empty pockets with the medal greyed and what they need
// ("12 to go"), hidden ones are "?" pockets that stay blank until found. Luck is the set's rarity: a Critical medal
// carries the starburst and a gold rule, a Shiny one the rainbow rim and the card foil (only while still, as cards do).
// The lenses read it like a set: Have shows what you've earned, Need what's left, sorted by how close (Next up). A
// pocket opened up close shows the cards behind it, missing first; tapping one flies to it in its set. Earning one
// mid-session lands it in its pocket the way a marked card lands, its luck revealed as it lands.
//
// Medals are pseudo-cards (c.medal is the trophy) living only in the trophy group: never in `cards` or `pool`, so
// the count, search, Time, Value, chases, trades, copies and the trade binder never see them. Earned trophies live in
// localStorage wall-medals ({ id: { at, rank, ...look } }); once earned, a trophy stays earned (as in production).
// The medal artwork is production's medalSVG, rasterized once per look, size bucket, dpr and theme to an offscreen
// canvas; at mosaic size a pocket is a flat fill in its tier colour and the artwork is never drawn.

// ----- the catalog's vocabulary (ported from production's app.js and medal.js) -----
const TROPHY_NAMES = {
  set: { half: "Half a Binder", tq: "Nearly Full", last3: "Last Pockets", complete: "Binder Complete" },
  pokemon: { half: "Fan Club", tq: "Superfan", last3: "Shrine Builder", complete: "Hall of Fame" },
  artist: { half: "Gallery Opening", tq: "Curator", last3: "Final Frame", complete: "Full Exhibit" },
  type: { half: "Attuned", tq: "Resonant", last3: "On the Edge", complete: "Perfect Match" },
  rarity: { half: "Treasure Hunter", tq: "Collector's Eye", last3: "Last Gem", complete: "Full Hoard" },
  custom: { half: "Halfway", tq: "Home stretch", last3: "Last three", complete: "Complete" },
};
const TROPHY_SHAPE = { set: "shield", pokemon: "hex", artist: "rosette", region: "octagon", type: "diamond", rarity: "star", custom: "circle", dex: "squircle", global: "badge" };
const TIER_COLORS = { bronze: ["#F0B27A", "#9A5B21"], silver: ["#EEF1F7", "#8E99AD"], gold: ["#FFE066", "#C99A00"], holo: ["#9BE0FF", "#C9A8FF"] };
const TIER_FLAT = { bronze: "#C68A52", silver: "#B4BCCB", gold: "#E2B33C", holo: "#A9B8FF" }; // a pocket at mosaic size
const TIER_FACE = { bronze: "#8A5632", silver: "#5A6578", gold: "#977311", holo: "#5651A6" }; // an earned pocket's card face
const TIER_LABEL = { bronze: "Bronze", silver: "Silver", gold: "Gold", holo: "Holo" };
const FOUR = { light: { red: "#C0392B", yellow: "#B8892A", green: "#2E8B57", blue: "#3B4CCA" }, dark: { red: "#E5685B", yellow: "#E3B341", green: "#4CBF86", blue: "#8D9BFF" } };
const RANK_TEXT = { crit: "Critical, 1 in 10", shiny: "Shiny, 1 in 100" };
const STARTER_LINES = [[1, 9], [152, 160], [252, 260], [387, 395], [495, 503], [650, 658], [722, 730], [810, 818], [906, 914]];
const LEGEND_RANGES = [[144, 146], [150, 151], [243, 245], [249, 251], [377, 386], [480, 494], [638, 649], [716, 721], [772, 773], [785, 809], [888, 898], [905, 905], [1001, 1010], [1014, 1025]];
const EEVEE_FAMILY = new Set([133, 134, 135, 136, 196, 197, 470, 471, 700]);
const GENS = [[1, "Kanto", 1, 151], [2, "Johto", 152, 251], [3, "Hoenn", 252, 386], [4, "Sinnoh", 387, 493], [5, "Unova", 494, 649], [6, "Kalos", 650, 721], [7, "Alola", 722, 809], [8, "Galar", 810, 905], [9, "Paldea", 906, 1025]];
const ERAS = [["mega", 2025.6], ["sv", 2023.2], ["swsh", 2020.1], ["sm", 2017.1], ["xy", 2014.1], ["bw", 2011.2], ["hgss", 2010.1], ["dp", 2007.4], ["ex", 2003.5], ["wotc", 1990]];
const inRanges = (n, rs) => rs.some(([a, b]) => n >= a && n <= b);
const eraOfSet = (st) => { const d = new Date(st.released || Date.UTC(st.year, 0, 1)), y = d.getUTCFullYear() + (d.getUTCMonth() + 1) / 12; return (ERAS.find((e) => y >= e[1]) || ERAS[ERAS.length - 1])[0]; };
const initials = (t) => String(t || "").split(/[\s,.-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
function rarityBucket(c) {
  const r = c.rname || "";
  if (/^(common|uncommon)$/i.test(r)) return "easy";
  if (/secret|illustration|hyper|special|rainbow|gold|shiny|amazing|radiant|ultra|double|ace spec|v\b|vmax|vstar|ex\b|gx/i.test(r)) return "chase";
  if (/holo/i.test(r)) return "holo";
  return "other";
}
// The four colours: a set folds into the nearest one (purple and grey become blue), as in production.
function fourOf(hexc) {
  const [r, g, b] = hex(hexc).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  if (s < 0.25) return "blue";
  let h = !d ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h < 30 || h >= 330 ? "red" : h < 75 ? "yellow" : h < 170 ? "green" : "blue";
}
// Luck: rolled once per trophy, seeded by its id (prefix keys: the hash correlates keys that differ only at the end).
const luckOf = (id) => (h32(`luck|shiny|${id}`) < 0.01 ? "shiny" : h32(`luck|crit|${id}`) < 0.1 ? "crit" : "");

// ----- earned trophies, kept on this device -----
var medals = {};
try { medals = JSON.parse(localStorage.getItem("wall-medals") || "{}") || {}; } catch { medals = {}; }
const persistMedals = () => { try { localStorage.setItem("wall-medals", JSON.stringify(medals)); } catch { /* private mode */ } };
// Reset the demo clears them too (this runs before the base's handler reloads the page).
document.addEventListener("click", (e) => { if (e.target.closest?.("#reset")) { try { localStorage.removeItem("wall-medals"); } catch { /* fine */ } } }, true);

// ----- the catalog: built from the wall's sets and chases, rebuilt when they change -----
// A trophy is { id, name, desc, tier, kind, color, plate, sig, hidden, chase, section } and one way to count it:
// cards (own `goal` of them), anyOf (own a card in `goal` of the groups) or count (a number to reach `goal`).
function sourcesOf() {
  const out = sets.map((st) => ({ key: st.id, name: st.name, kind: "set", color: fourOf(st.ink), plate: st.code, cards: st.cards, setId: st.id, printed: Number(st.printed) || 0 }));
  for (const r of chases) {
    const on = ["dex", "artist", "rarity", "type", "popular", "set"].filter((k) => r[k]);
    if (on.length === 1 && on[0] === "set") continue; // "All of 151" is the set itself, which has its own trophies
    const kind = on.length !== 1 ? "custom" : { dex: "pokemon", artist: "artist", rarity: "rarity", type: "type", popular: "custom" }[on[0]];
    const plate = kind === "pokemon" ? `#${r.dex}` : kind === "artist" ? initials(r.artist) : kind === "type" ? (TYPE[r.type] || TYPE.C)[0].slice(0, 3).toUpperCase() : kind === "rarity" ? "★" : String(r.label || "").slice(0, 2).toUpperCase();
    out.push({ key: `c:${ruleKey(r)}`, name: r.label || labelOf(r), kind, color: kind === "pokemon" ? "blue" : kind === "artist" ? "green" : "yellow", plate, cards: ruleCards(r) });
  }
  return out;
}
// The run: halfway, three quarters, the last three, complete; then the goals inside it (production's computeTrophies).
function runOf(src) {
  const out = [], N = TROPHY_NAMES[src.kind] || TROPHY_NAMES.custom, cards = src.cards, total = cards.length;
  if (!total) return out;
  const look = { kind: src.kind, color: src.color, plate: src.plate, chase: src.name, section: "run" };
  out.push({ ...look, id: `${src.key}:half`, name: N.half, desc: `Own half of ${src.name}.`, tier: "silver", cards, goal: Math.ceil(total * 0.5) });
  out.push({ ...look, id: `${src.key}:three-quarters`, name: N.tq, desc: `Own 75% of ${src.name}.`, tier: "gold", cards, goal: Math.ceil(total * 0.75) });
  if (total >= 6) out.push({ ...look, id: `${src.key}:last3`, name: N.last3, desc: `Get ${src.name} down to its final three cards.`, tier: "gold", cards, goal: total - 3 });
  out.push({ ...look, id: `${src.key}:complete`, name: N.complete, desc: `Every card in ${src.name}.`, tier: "holo", cards, goal: total });
  for (const [bucket, name, desc, tier] of [["holo", "Holo hunter", "Every holo rare", "silver"], ["chase", "Chase cards", "Every chase-rarity card", "gold"], ["easy", "Clean sweep", "Every common and uncommon", "bronze"]]) {
    const grp = cards.filter((x) => rarityBucket(x) === bucket);
    if (grp.length < 3 || grp.length === total) continue;
    out.push({ ...look, id: `${src.key}:${bucket}`, name, desc: `${desc} in ${src.name}.`, tier, cards: grp, goal: grp.length });
  }
  return out;
}
// Signature trophies: what a set or a kind of chase uniquely offers (production's signatureTrophies, where the wall's
// data has what it needs).
function sigsOf(src) {
  const out = [], kind = src.kind, base = src.cards, n = base.length, sid = src.setId;
  const look = { kind, color: src.color, chase: src.name, section: "sig", sig: true };
  const sig = (id, name, desc, tier, plate, group, min = 2) => { if (group.length >= min && group.length < n) out.push({ ...look, id: `${src.key}:sig-${id}`, name, desc, tier, plate, cards: group, goal: group.length }); };
  const anyOf = (id, name, desc, tier, plate, groups, min, need = 0) => { if (groups.length >= min) out.push({ ...look, id: `${src.key}:sig-${id}`, name, desc, tier, plate, anyOf: groups, goal: need || groups.length }); };
  const pool = (id, name, desc, tier, plate, list, need) => { if (list.length >= need) out.push({ ...look, id: `${src.key}:sig-${id}`, name, desc, tier, plate, cards: list, goal: need }); };
  const named = (...names) => base.filter((x) => names.some((s) => s.toLowerCase() === x.name.trim().toLowerCase()));
  const holo = (x) => /holo/i.test(x.rname || ""), art = (x) => /illustration rare/i.test(x.rname || ""), rar = (re) => base.filter((x) => re.test(x.rname || ""));
  if (kind === "set" || kind === "custom") {
    if (sid === "base1") {
      sig("big-three", "The Big Three", "Charizard, Blastoise and Venusaur.", "holo", "BIG3", named("Charizard", "Blastoise", "Venusaur"), 3);
      sig("professors", "Professor's Lab", "Professor Oak and the Impostor.", "silver", "OAK", named("Professor Oak", "Impostor Professor Oak"), 2);
    }
    if (sid === "base3") sig("birds", "Legendary Birds", "Articuno, Zapdos and Moltres.", "gold", "BIRD", named("Articuno", "Zapdos", "Moltres").filter(holo), 3);
    if (sid === "base2") sig("eevee", "Jungle Eeveelutions", "Eevee and its three evolutions, holo and non-holo.", "gold", "EEV", base.filter((x) => EEVEE_FAMILY.has(x.dex)), 4);
    if (sid === "me55") sig("rgb", "Red, Green and Blue", "All three Mews: R, G and B.", "holo", "RGB", base.filter((x) => /^[RGB]$/i.test(String(x.num))), 3);
    if (sid === "base5") sig("dark", "Dark Side", "Every Dark Pokémon card.", "gold", "DARK", base.filter((x) => /^Dark /.test(x.name) && x.type !== "t"), 3);
    if (sid === "neo1") anyOf("johto", "Johto Starters", "A holo Meganium, Typhlosion and Feraligatr.", "holo", "JOHTO", ["Meganium", "Typhlosion", "Feraligatr"].map((s) => named(s).filter(holo)).filter((g) => g.length), 3);
    if (sid === "swsh7") sig("dragons", "Dragon's Hoard", "Every Dragon-type card.", "gold", "DRAGON", base.filter((x) => x.type === "N"), 3);
    if (sid === "sv8pt5") sig("prism", "Prismatic Nine", "Eevee and the eight Eeveelutions as Special Illustration Rares.", "holo", "PRISM", base.filter((x) => /special illustration rare/i.test(x.rname || "") && EEVEE_FAMILY.has(x.dex)), 9);
    if (sid === "sv3pt5") { const byDex = []; for (let d = 1; d <= 151; d++) { const g = base.filter((x) => x.type !== "t" && x.dex === d); if (g.length) byDex.push(g); } anyOf("kanto", "Kanto Complete", "One card of every Pokémon from #1 to #151.", "holo", "151", byDex, 100); }
    if (sid !== "base3") sig("legends", "Legends", "Every legendary and mythical Pokémon card.", "gold", "LEG", base.filter((x) => x.dex && inRanges(x.dex, LEGEND_RANGES)), 2);
    sig("starters", "Starter Squad", "Every starter Pokémon card, evolutions included.", "silver", "STR", base.filter((x) => x.dex && inRanges(x.dex, STARTER_LINES)), 3);
    if (sid !== "base2") sig("eevee", "Eeveelutions", "Eevee and every evolution.", "silver", "EEV", base.filter((x) => EEVEE_FAMILY.has(x.dex)), 3);
    sig("trainers", "Trainer's Toolbox", "Every Trainer card.", "bronze", "TRN", base.filter((x) => x.type === "t"), 5);
    if (src.printed) sig("secret", "Secret Stash", "Every card numbered past the set's printed total.", "gold", "SECRET", base.filter((x) => /^\d+$/.test(String(x.num)) && Number(x.num) > src.printed), 2);
    sig("holo-wall", "Holo Wall", "Every Rare Holo.", "silver", "HOLO", base.filter((x) => x.rname === "Rare Holo"), 3);
    sig("shiny", "Shiny Vault", "Every shiny card.", "gold", "SHINY", rar(/^(Rare Shiny|Shiny Rare|Shiny Ultra Rare)/i), 2);
    sig("rainbow", "Rainbow Road", "Every Rainbow Rare and Hyper Rare.", "gold", "RAINBW", rar(/^(Rare Rainbow|Rainbow Rare|Hyper Rare)$/i), 3);
    sig("ace", "Ace in the Hole", "Every ACE SPEC card.", "silver", "ACE", rar(/ACE SPEC|^Rare ACE$/i), 2);
    sig("gallery", "Gallery Wall", "Every Illustration Rare and Special Illustration Rare.", "gold", "ART", base.filter(art), 3);
  }
  if (kind === "pokemon") {
    const forms = new Map(); for (const x of base) { const s = x.name.trim(); if (!forms.has(s)) forms.set(s, []); forms.get(s).push(x); }
    if (forms.size >= 4) anyOf("forms", "Every Form", `A card of each form it comes in (${forms.size}: base, Dark, ex, V...).`, "gold", "FORMS", [...forms.values()], 4);
    pool("art-piece", "Art Piece", "An Illustration Rare or Special Illustration Rare of it.", "silver", "ART", base.filter(art), 1);
  }
  if (kind === "type" && n >= 60) pool("mono", "Mono Deck", "Sixty cards of the type: a whole deck's worth.", "gold", "60", base, 60);
  const bySet = new Map(); for (const x of base) { if (!bySet.has(x.si)) bySet.set(x.si, []); bySet.get(x.si).push(x); }
  if (kind === "rarity" && bySet.size >= 10) anyOf("ten-sets", "Ten Sets Deep", "Cards from ten different sets.", "silver", "10", [...bySet.values()], 10, 10);
  if (kind === "artist") {
    const dated = base.slice().sort((a, b) => sets[a.si].released - sets[b.si].released || String(a.num).localeCompare(String(b.num), undefined, { numeric: true }));
    if (dated.length >= 2) out.push({ ...look, id: `${src.key}:sig-first-brush`, name: "First Brushstroke", desc: `Their earliest card here: ${dated[0].name}.`, tier: "silver", plate: "1ST", cards: [dated[0]], goal: 1 });
    pool("showpiece", "Showpiece", "Three of their Illustration Rares or Special Illustration Rares.", "gold", "ART", base.filter(art), 3);
  }
  const byEra = new Map(); for (const x of base) { const e = eraOfSet(sets[x.si]); if (!byEra.has(e)) byEra.set(e, []); byEra.get(e).push(x); }
  if (["pokemon", "type", "rarity"].includes(kind) && byEra.size >= 4) anyOf("eras", "Through the Ages", `A card from every era it appears in (${byEra.size} eras).`, "gold", "ERA", [...byEra.values()], 4);
  if (kind === "pokemon" && n >= 6) {
    const dated = base.slice().sort((a, b) => sets[a.si].year - sets[b.si].year);
    if (sets[dated[0].si].year !== sets[dated[n - 1].si].year) out.push({ ...look, id: `${src.key}:sig-then-now`, name: "Then and Now", desc: "Its oldest card and its newest.", tier: "silver", plate: "THEN", cards: [dated[0], dated[n - 1]], goal: 2 });
  }
  if (kind === "artist") {
    const decades = new Map(); for (const x of base) { const d = Math.floor(sets[x.si].year / 10) * 10; if (!decades.has(d)) decades.set(d, []); decades.get(d).push(x); }
    if (decades.size >= 3) anyOf("decades", "Across the Decades", `A card from each decade they've illustrated in (${[...decades.keys()].sort().map((d) => `${d}s`).join(", ")}).`, "gold", "DEC", [...decades.values()], 3);
    if (bySet.size >= 10) anyOf("ten-sets", "Ten Sets Deep", "Their cards from ten different sets.", "silver", "10", [...bySet.values()], 10, 10);
  }
  return out;
}
// The Dex (the Pokémon on the wall, by region and in all), the global ones, and the hidden ones.
const ownedCount = () => { let n = 0; for (const c of cards) if (c.owned) n++; return n; };
const doneTrades = () => (typeof trades !== "undefined" ? trades.filter((r) => r.state === "done").length : 0);
const buys = () => Object.keys(paid).map((id) => ({ c: poolById.get(id), p: paid[id] })).filter((b) => b.c?.owned);
function speciesGroups() {
  const by = new Map();
  for (const c of cards) if (c.dex) { if (!by.has(c.dex)) by.set(c.dex, []); by.get(c.dex).push(c); }
  return by;
}
function restOf() {
  const out = [], by = speciesGroups(), dexLook = { kind: "dex", color: "red", plate: "DEX", chase: "Dex", section: "dex" };
  for (const [g, name, a, b] of GENS) {
    const groups = [...by.keys()].filter((d) => d >= a && d <= b).sort((x, y) => x - y).map((d) => by.get(d));
    if (groups.length) out.push({ ...dexLook, id: `dex:gen${g}`, name: `${name} master`, desc: `A card of every ${name} Pokémon on the wall (${groups.length}).`, tier: "gold", anyOf: groups, goal: groups.length });
  }
  const ownedSpecies = () => { let n = 0; for (const list of by.values()) if (list.some((c) => c.owned)) n++; return n; };
  for (const n of [50, 151, 500, 1000]) if (n <= by.size) out.push({ ...dexLook, id: `dex:count${n}`, name: `${n} Pokémon`, desc: `Have a card for ${n} different Pokémon.`, tier: n >= 500 ? "holo" : n >= 151 ? "gold" : "silver", count: ownedSpecies, goal: n });
  const G = { kind: "global", color: "yellow", plate: "★", chase: "Across everything", section: "global" };
  out.push({ ...G, id: "g:first-find", name: "First find", desc: "Get a card off your chase list with Got it.", tier: "bronze", count: () => buys().length, goal: 1 });
  out.push({ ...G, id: "g:sharp-eye", name: "Sharp eye", desc: "Pay 30% or more under market for a card.", tier: "silver", count: () => (buys().some((b) => b.p != null && b.p <= b.c.price * 0.7) ? 1 : 0), goal: 1 });
  out.push({ ...G, id: "g:bargain-100", name: "Bargain hunter", desc: "Save $100 against market, all told.", tier: "gold", count: () => Math.max(0, Math.round(buys().reduce((t, b) => t + (b.p != null ? b.c.price - b.p : 0), 0))), goal: 100 });
  for (const n of [100, 500, 1000, 2500]) if (n <= TOTAL) out.push({ ...G, id: `g:own-${n}`, name: `${n.toLocaleString()} cards`, desc: `Own ${n.toLocaleString()} cards across your sets.`, tier: n >= 1000 ? "holo" : n >= 500 ? "gold" : "silver", count: ownedCount, goal: n });
  for (const [n, name] of [[1, "First trade"], [5, "Trader"], [25, "Dealmaker"]]) out.push({ ...G, id: `g:trade-${n}`, name, desc: `Finish ${n === 1 ? "a trade" : `${n} trades`} at the trade table.`, tier: n >= 25 ? "gold" : n >= 5 ? "silver" : "bronze", count: doneTrades, goal: n });
  // Hidden: invisible until earned. Splash! and Unown Alphabet are left out: the wall has 3 Magikarp and 1 Unown.
  const H = { ...G, section: "hidden", hidden: true }, card = (id) => poolById.get(id);
  if (card("swsh7-215")) out.push({ ...H, id: "g:moonbreon", name: "Moonbreon", desc: "Umbreon VMAX, Evolving Skies #215.", tier: "holo", plate: "MOON", cards: [card("swsh7-215")], goal: 1 });
  if (card("base5-83")) out.push({ ...H, id: "g:secret-agent", name: "Secret Agent", desc: "Dark Raichu, Team Rocket #83.", tier: "holo", plate: "RAICHU", cards: [card("base5-83")], goal: 1 });
  if ((by.get(25) || []).length >= 25) out.push({ ...H, id: "g:fan-club", name: "Pikachu Fan Club", desc: "25 Pikachu cards.", tier: "gold", plate: "PIKA25", cards: by.get(25), goal: 25 });
  const kanto = [...by.keys()].filter((d) => d >= 1 && d <= 151).sort((x, y) => x - y).map((d) => by.get(d));
  if (kanto.length === 151) out.push({ ...H, id: "g:gotta-catch", name: "Gotta Catch 'Em All", desc: "A card of every Pokémon from #1 to #151, across your whole collection.", tier: "holo", plate: "151", anyOf: kanto, goal: 151 });
  const newest = sets.slice().sort((a, b) => b.released - a.released)[0], first = sets.find((s) => s.id === "base1");
  if (first && newest && newest !== first) out.push({ ...H, id: "g:full-circle", name: "Full Circle", desc: `A card from Base Set and a card from the newest set, ${newest.name}.`, tier: "silver", plate: "CIRCLE", anyOf: [first.cards, newest.cards], goal: 2 });
  const firsts = sets.map((s) => s.cards.filter((c) => /^0*1$/.test(String(c.num)))).filter((g) => g.length);
  if (firsts.length >= 10) out.push({ ...H, id: "g:first-pick", name: "First Pick", desc: "Card #1 from ten different sets.", tier: "silver", plate: "#1", anyOf: firsts, goal: 10 });
  const lasts = sets.map((s) => { const num = s.cards.filter((c) => /^\d+$/.test(String(c.num))); return num.length ? [num.reduce((a, b) => (Number(b.num) > Number(a.num) ? b : a))] : null; }).filter(Boolean);
  if (lasts.length >= 5) out.push({ ...H, id: "g:last-page", name: "Last Page", desc: "The highest-numbered card in five different sets.", tier: "gold", plate: "LAST", anyOf: lasts, goal: 5 });
  out.push({ ...H, id: "g:crown-collector", name: "Crown Collector", desc: "Earn five signature trophies.", tier: "gold", plate: "CROWN", count: () => Object.values(medals).filter((t) => t.sig).length, goal: 5 });
  out.push({ ...H, id: "g:trophy-cabinet", name: "Trophy Cabinet", desc: "Earn 25 trophies of any kind.", tier: "holo", plate: "CABNET", count: () => Object.keys(medals).length, goal: 25 });
  return out;
}
// Everything, in checklist order: each set's and chase's run, the signature trophies, the Dex, across everything,
// anything earned earlier whose chase is gone, and the hidden ones last.
function catalog() {
  const srcs = sourcesOf(), all = [...srcs.flatMap(runOf), ...srcs.flatMap(sigsOf)], rest = restOf();
  const hidden = rest.filter((t) => t.hidden), shown = rest.filter((t) => !t.hidden);
  const ids = new Set([...all, ...rest].map((t) => t.id));
  const earlier = Object.entries(medals).filter(([id]) => !ids.has(id)).map(([id, r]) => ({ id, name: r.name || "Trophy", desc: "Earned earlier, for a chase that's no longer on the wall.", tier: r.tier || "gold", kind: r.kind || "custom", color: r.color || "yellow", plate: r.plate || "", sig: Boolean(r.sig), hidden: Boolean(r.hidden), chase: r.chase || "Earlier", section: "earlier", count: () => 1, goal: 1 }));
  return [...all, ...shown, ...earlier, ...hidden];
}

// ----- the medals: pseudo-cards, one per trophy, kept across rebuilds so a flight or an open binder stays valid -----
const medalObjs = new Map();
let medalSeq = 0;
function medalObj(t) {
  let m = medalObjs.get(t.id);
  if (!m) { m = { i: 1e6 + medalSeq++, id: `trophy|${t.id}`, num: "", rname: "Trophy", type: "C", dex: 0, tier: 0, price: 0, deal: null, own0: false, pop: false, owned: false, got: null, x: 0, y: 0, sz: 1, col: 0, row: 0, e: 1, anim: null, intro: 0, m: null, pm: null, g: 0, k: 0, lift: 0, delay: 0, flash: null, away: false, have: 0, goal: 1 }; medalObjs.set(t.id, m); }
  m.medal = t; m.name = t.name;
  return m;
}
function progress(t) {
  if (t.count) return t.count();
  if (t.anyOf) { let n = 0; for (const g of t.anyOf) if (g.some((c) => c.owned)) n++; return n; }
  let n = 0; for (const c of t.cards) if (c.owned) n++; return n;
}
const recOfMedal = (m) => medals[m.medal.id] || null;
const isHiddenLocked = (m) => m.medal.hidden && !m.owned;
var TG = null; // the trophy group
let medalsReady = false;
function trophyGroup() {
  const list = catalog().map(medalObj);
  if (!TG) {
    TG = { key: "trophies", name: "Trophies", ink: "#C9962B", trophies: true, cards: list, base: list };
    TG.sub = () => {
      const n = TG.base.length, e = TG.base.filter((m) => m.owned).length, hid = TG.base.filter(isHiddenLocked).length, crit = TG.base.filter((m) => m.owned && recOfMedal(m)?.rank).length;
      if (state.lens === "need") return `${n - e} to go${hid ? `, ${hid} of them hidden` : ""}`;
      return `${e} of ${n}${crit ? `, ${crit} lucky` : ""}.${hid ? ` ${hid} hidden to find.` : ""}`;
    };
  }
  TG.cards = TG.base = list;
  list.forEach((m, k) => { m.intro = 14 * 140 + k * 2.2; });
  evalMedals();
  if (!medalsReady) { medalsReady = true; storeEarned(); } // on load: what's already true is stored quietly
  return TG;
}
function evalMedals() {
  if (!TG) return;
  for (const m of TG.base) { const t = m.medal; m.goal = t.goal; m.have = Math.min(progress(t), t.goal); m.owned = Boolean(medals[t.id]); m.got = m.owned ? 1 : null; } // got: Time leaves the trophies as they are
}
function recFor(t) { return { at: Date.now(), rank: luckOf(t.id), name: t.name, chase: t.chase, tier: t.tier, kind: t.kind, color: t.color, plate: t.plate, sig: Boolean(t.sig), hidden: Boolean(t.hidden) }; }
// Newly true trophies are stored (twice round, so the trophies about trophies count the ones just earned).
function storeEarned() {
  const fresh = [];
  for (let pass = 0; pass < 2; pass++) {
    for (const m of TG.base) { const t = m.medal; if (medals[t.id]) continue; if (Math.min(progress(t), t.goal) >= t.goal) { medals[t.id] = recFor(t); fresh.push(m); } }
  }
  if (fresh.length) persistMedals();
  evalMedals();
  return fresh;
}

// ----- earning one mid-session: it lands in its pocket the way a marked card lands -----
let medalTimer = 0;
function scheduleMedals() { if (medalTimer || !TG) return; medalTimer = setTimeout(() => { medalTimer = 0; syncMedals(); }, 0); }
function syncMedals() {
  if (!TG || mode !== "set") return;
  const fresh = storeEarned();
  if (!fresh.length) return;
  landMedals(fresh);
  if (document.body.classList.contains("listmode")) drawList();
}
function landMedals(fresh) {
  const now = performance.now(), one = fresh[0];
  fresh.forEach((m, i) => {
    if (reduced) return;
    const t0 = now + 220 + i * 110;
    m.anim = { t0, to: true }; m.flash = { t0, gold: true }; m.reveal = t0 + 460; // the luck shows once it has landed
  });
  if (!reduced) TG.ripple = { t0: now + 220, col: one.col, row: one.row };
  TG.beat = { t0: now, text: fresh.length === 1 ? `${one.medal.name} earned` : `${fresh.length} earned`, col: theme.gold };
  if (view === "set" && state.g && state.g !== TG && !state.g.popChips) { live.beat = { t0: now, text: fresh.length === 1 ? `New trophy: ${one.medal.name}` : `${fresh.length} new trophies`, col: theme.gold, g: state.g }; live.until = Math.max(live.until, now + 3200); }
  pumpUntil(now + 220 + fresh.length * 110 + 1500);
  setTimeout(() => { tick(24); announce(fresh); }, reduced ? 0 : 700);
}
const listNames = (ms) => (ms.length <= 3 ? ms.map((m) => m.medal.name).join(", ").replace(/, ([^,]*)$/, " and $1") : `${ms.slice(0, 2).map((m) => m.medal.name).join(", ")} and ${ms.length - 2} more`);
function announce(fresh) {
  const one = fresh[0], rk = recOfMedal(one)?.rank, lucky = fresh.filter((m) => recOfMedal(m)?.rank), riding = toastEl.classList.contains("show");
  const luck = (m) => (recOfMedal(m).rank === "shiny" ? "Shiny" : "Critical");
  let text;
  if (fresh.length === 1) text = `New trophy: ${one.medal.name}${riding ? "" : `, ${one.medal.hidden ? "a hidden one" : one.medal.chase}`}${rk ? `. It came up ${luck(one)}` : ""}.`;
  else if (riding || fresh.length > 3) text = `${fresh.length} new trophies${lucky.length === 1 ? `, one of them ${luck(lucky[0])}` : lucky.length ? `, ${lucky.length} of them lucky` : ""}.`;
  else text = `New trophies: ${listNames(fresh)}.${lucky.length ? ` ${lucky.length === 1 ? `${lucky[0].medal.name} came up ${luck(lucky[0])}` : `${lucky.length} came up lucky`}.` : ""}`;
  addToToast(text, () => goToMedal(one), "Show");
}
// A trophy rides along on the toast that's already up (a card added, an import), so its Undo stays.
function addToToast(text, action, label) {
  if (toastEl.classList.contains("show") && toastEl.firstChild?.nodeType === 3 && !toastEl.querySelector(".toast-btn")) { toast(`${toastEl.firstChild.nodeValue} ${text}`, action, label); return; }
  if (toastEl.classList.contains("show") && toastEl.firstChild?.nodeType === 3) {
    toastEl.firstChild.nodeValue = `${toastEl.firstChild.nodeValue.replace(/\s+$/, "")} ${text} `;
    clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), 5200); return;
  }
  toast(text, action, label);
}

// ----- going places: to a medal's pocket, and from a medal to a card behind it -----
// A slide between any two binders (the sideways flick's transition, to a set that isn't next door).
function slideTo(n, then) {
  if (state.trans || view !== "set" || !n) return;
  const prev = state.g, d = groups.indexOf(n) >= groups.indexOf(prev) ? 1 : -1;
  fly = null; inertia = false;
  const fromCam = { ...cam };
  state.g = n; Object.assign(cam, fitCam(n));
  state.trans = { kind: "slide", from: prev, fromCam, g: n, dir: d, t0: performance.now(), dur: reduced ? 1 : 460, done: () => { kick(); then?.(); } };
  setChrome(); kick();
}
function dropFocus() { if (!state.focus) return; state.focus = null; document.body.classList.remove("focused"); }
function goToCard(c) {
  const g = groups[c.g]; if (!g || state.trans) return;
  tick(6); dropFocus();
  if (view !== "set") { enterGroup(g, { then: () => focus(c) }); return; }
  if (state.g === g) { focus(c); return; }
  slideTo(g, () => focus(c));
}
function goToMedal(m) {
  if (!TG || mode !== "set" || bnd.on || tbl.on || document.body.classList.contains("listmode")) return;
  if (state.trans) finishTransition();
  if (view === "set") { dropFocus(); if (state.g === TG) focus(m); else slideTo(TG, () => focus(m)); return; }
  if (room.on) closeRoom(true);
  if (TG.m) mScroll = clamp(TG.m.y - topPad() - 10, 0, mMax);
  enterGroup(TG, { then: () => focus(m) });
}

// ----- the medal artwork: production's medalSVG, standalone, rasterized once per look and size -----
function shapePath(shape, r, cx = 50, cy = 50) {
  const P = (pts) => "M" + pts.map(([x, y]) => `${(cx + x).toFixed(2)} ${(cy + y).toFixed(2)}`).join(" L") + " Z";
  const ring = (n, rot, f) => P(Array.from({ length: n }, (_, i) => { const a = (((i / n) * 360) + rot) * Math.PI / 180, q = f(i); return [Math.cos(a) * q, Math.sin(a) * q]; }));
  switch (shape) {
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
const sEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// The CSS variables production reads (--c-red and the rest, --surface) are filled in from the theme; the glow and the
// greying production does with CSS filters are SVG filters here, so the picture is complete on its own.
const MV = { x: -8, y: -8, w: 116, h: 140 }; // a little room around production's 100 by 124 for the glow and the rays
function medalSVG(t, variant) {
  const locked = variant === "locked", rank = variant === "ranked" ? (medals[t.id]?.rank || "") : "";
  const [hi, lo] = TIER_COLORS[t.tier] || TIER_COLORS.bronze, shape = TROPHY_SHAPE[t.kind] || "circle";
  const col = FOUR[theme.dark ? "dark" : "light"][t.color] || FOUR.light.blue, col2 = mix(col, "#1B1D2E", 0.45), surface = theme["panel-solid"] || "#FAFBFD";
  const rays = rank === "crit" ? Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, p = (q, da = 0) => `${(50 + Math.cos(a + da) * q).toFixed(1)} ${(50 + Math.sin(a + da) * q).toFixed(1)}`; return `<path d="M${p(40, -0.11)} L${p(49)} L${p(40, 0.11)} Z" fill="#FFCB05" stroke="#9A6A00" stroke-width=".6"/>`; }).join("") : "";
  const sparkle = (x, y, k) => `<path d="M${x} ${y - 7 * k} L${x + 2 * k} ${y - 2 * k} L${x + 7 * k} ${y} L${x + 2 * k} ${y + 2 * k} L${x} ${y + 7 * k} L${x - 2 * k} ${y + 2 * k} L${x - 7 * k} ${y} L${x - 2 * k} ${y - 2 * k} Z" fill="#FFF7B0" stroke="#C99A00" stroke-width=".8"/>`;
  const plate = t.plate ? (() => { const w = Math.max(26, String(t.plate).length * 7.4 + 12); return `<rect x="${50 - w / 2}" y="61" width="${w}" height="15" rx="7.5" fill="#000" fill-opacity=".66"/><text x="50" y="72" text-anchor="middle" fill="#fff" font-size="10" font-weight="800" font-family="Archivo, 'Helvetica Neue', Arial, sans-serif">${sEsc(t.plate)}</text>`; })() : "";
  const body = `<path d="M30 70 L22 118 L38 108 L46 120 L52 76 Z" fill="${col}"/>
    <path d="M70 70 L78 118 L62 108 L54 120 L48 76 Z" fill="${col2}"/>
    ${rays}
    <path d="${shapePath(shape, 38)}" fill="url(#${rank === "shiny" ? "h" : "g"})"/>
    <path d="${shapePath(shape, 33.5)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
    <path d="${shapePath(shape, 29)}" fill="${surface}"/>
    <path d="M50 29 L56.5 43.5 L72 45 L60.5 55.5 L63.8 71 L50 63 L36.2 71 L39.5 55.5 L28 45 L43.5 43.5 Z" fill="url(#g)"/>
    <path d="${shapePath(shape, 28.5)}" fill="none" stroke="${lo}" stroke-width="1.5" opacity=".6"/>
    ${plate}
    ${t.hidden && !locked ? `<circle cx="82" cy="14" r="10" fill="#6B3FD1" stroke="#FFFFFF" stroke-width="2"/><text x="82" y="18.5" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui, sans-serif" fill="#FFFFFF">?</text>` : ""}
    ${t.sig ? `<path d="M38 13 L42 4 L46 10 L50 2 L54 10 L58 4 L62 13 Z" fill="#FFCB05" stroke="#9A6A00" stroke-width="1.2" stroke-linejoin="round"/><circle cx="50" cy="2.8" r="1.6" fill="#E3350D"/>` : ""}
    ${rank === "crit" ? `<path d="M84 8 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="#FFCB05" stroke="#9A6A00" stroke-width="1"/>` : ""}
    ${rank === "shiny" ? sparkle(14, 20, 1.2) + sparkle(88, 34, 1) + sparkle(76, 92, 0.9) : ""}`;
  const glow = locked ? "" : rank === "crit" ? `<feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#FFCB05" flood-opacity=".75"/>` : rank === "shiny" ? `<feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#A078FF" flood-opacity=".7"/>` : `<feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".22"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MV.w}" height="${MV.h}" viewBox="${MV.x} ${MV.y} ${MV.w} ${MV.h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
      <linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B6B"/><stop offset=".25" stop-color="#FFD93D"/><stop offset=".5" stop-color="#6BCB77"/><stop offset=".75" stop-color="#4D96FF"/><stop offset="1" stop-color="#C77DFF"/></linearGradient>
      ${locked ? `<filter id="f"><feColorMatrix type="saturate" values="0"/></filter>` : `<filter id="f" x="-30%" y="-30%" width="160%" height="160%">${glow}</filter>`}
    </defs>
    <g filter="url(#f)"${locked ? ` opacity="${theme.dark ? 0.42 : 0.38}"` : ""}>${body}</g>
  </svg>`;
}
// One Image per distinct picture (many medals share a look); one canvas per size bucket and dpr, made on demand, at
// most a few per frame so a pinch that crosses a bucket never stalls (until then the nearest size is scaled).
const ART = new Map(), BUCKETS = [24, 32, 48, 64, 96, 128, 192, 256, 384, 512];
let artFrame = -1, artBudget = 0;
const themeKey = () => `${theme.dark ? 1 : 0}|${theme["panel-solid"]}`;
function medalArt(m, variant, w, now) {
  const tk = `${variant}|${themeKey()}`;
  m.svgs ||= {};
  let e = m.svgs[tk];
  if (!e) { const svg = medalSVG(m.medal, variant); e = ART.get(svg); if (!e) { e = { img: null, ok: false, cv: new Map(), svg }; ART.set(svg, e); } m.svgs[tk] = e; }
  if (!e.img) { e.img = new Image(); e.img.onload = () => { e.ok = true; kick(); }; e.img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(e.svg)}`; }
  if (!e.ok) return null;
  const b = BUCKETS.find((x) => x >= w * 0.98) || BUCKETS[BUCKETS.length - 1], key = `${b}|${dpr}`;
  let cv = e.cv.get(key);
  if (cv) return cv;
  if (now !== artFrame) { artFrame = now; artBudget = 6; }
  if (artBudget > 0) {
    artBudget--;
    cv = document.createElement("canvas"); cv.width = Math.ceil(b * dpr); cv.height = Math.ceil(b * dpr * MV.h / MV.w);
    cv.getContext("2d").drawImage(e.img, 0, 0, cv.width, cv.height);
    e.cv.set(key, cv); return cv;
  }
  kick(); // the rest next frame
  let best = null; for (const v of e.cv.values()) if (!best || Math.abs(v.width - b * dpr) < Math.abs(best.width - b * dpr)) best = v;
  return best;
}

// ----- drawing a medal pocket -----
// drawTile is the base's, with the medal branch: a medal never takes a card's gold corner or the Need lens's ring.
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  if (c.medal) drawMedal(c, sx, sy, w, h, now, mult);
  else {
    drawTile0(c, sx, sy, w, h, now, mult);
    if (c.pop && view === "set" && groups[c.g]?.set && w >= 14 && c.e > 0.3 && (!state.focus || state.focus === c)) {
      const s = clamp(w * 0.36, 4, 18), r = w >= 26 ? w * 0.045 : 0;
      ctx.globalAlpha = Math.min(1, mult) * c.e * 0.8; ctx.fillStyle = theme.gold;
      ctx.beginPath(); ctx.moveTo(sx + w - s, sy); ctx.lineTo(sx + w - r, sy); ctx.lineTo(sx + w, sy + r); ctx.lineTo(sx + w, sy + s); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (state.lens === "need" && !c.owned && w >= 5 && c.e > 0.5 && !c.lift && isChase(c)) {
      ctx.globalAlpha = Math.min(1, mult); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
      rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g]?.ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = col; ctx.globalAlpha = a * tint;
  if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
  if (fp) {
    const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col;
    rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawMedal(c, sx, sy, w, h, now, mult) {
  const a0 = mult * c.e * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1);
  if (a0 < 0.02) return;
  let scale = 1;
  const g = groups[c.g];
  if (g?.ripple) { const t = (now - g.ripple.t0 - Math.hypot(c.col - g.ripple.col, c.row - g.ripple.row) * 38) / 300; if (t > 0 && t < 1) scale = 1 + 0.075 * Math.sin(Math.PI * t); }
  if (state.press?.c === c) scale *= 1 - 0.07 * clamp((now - state.press.t0) / 420, 0, 1);
  let intro = 1;
  if (state.introT0 && !reduced) intro = clamp((now - state.introT0 - c.intro) / 360, 0, 1);
  if (intro <= 0) return;
  const alpha = a0 * intro;
  if (scale !== 1 || intro < 1) { const k = scale * (0.86 + 0.14 * intro); sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k; }
  ctx.globalAlpha = alpha;
  let flood = c.owned ? 1 : 0;
  if (c.anim) {
    const p = clamp((now - c.anim.t0) / 460, 0, 1), e = 1 - Math.pow(1 - p, 3);
    flood = c.anim.to ? e : 1 - e;
    if (p >= 1) c.anim = null;
  }
  const t = c.medal, rec = recOfMedal(c), rank = rec?.rank && !(c.reveal && now < c.reveal) ? rec.rank : "";
  if (w < 5) { ctx.fillStyle = flood > 0.5 ? TIER_FLAT[t.tier] : theme.slot; ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); return; }
  if (w < 26) { // the mosaic and the binder at arm's length: a flat fill in the tier colour, never the artwork
    const r = w * 0.09, round = w >= 12;
    if (flood < 1) {
      ctx.fillStyle = theme.slot;
      if (round) { rr(sx, sy, w, h, r); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); } else ctx.fillRect(sx, sy, w, h);
    }
    if (flood > 0) {
      const partial = flood < 1;
      if (partial) { ctx.save(); ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, Math.hypot(w, h) / 2 * flood, 0, Math.PI * 2); ctx.clip(); }
      ctx.fillStyle = TIER_FLAT[t.tier];
      if (round) { rr(sx, sy, w, h, r); ctx.fill(); } else ctx.fillRect(sx, sy, w, h);
      if (w > 12) { ctx.fillStyle = theme.paper; ctx.fillRect(sx + r * 0.3, sy + h * 0.78, w - r * 0.6, h * 0.2); }
      if (rank && round) { ctx.lineWidth = 1.5; ctx.strokeStyle = rank === "shiny" ? "#C77DFF" : "#FFCB05"; rr(sx + 0.75, sy + 0.75, w - 1.5, h - 1.5, r); ctx.stroke(); }
      if (partial) ctx.restore();
    }
    return;
  }
  if (flood < 1) medalPocket(c, sx, sy, w, h, now, alpha);
  if (flood > 0) {
    ctx.save();
    if (flood < 1) { ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, Math.hypot(w, h) / 2 * flood, 0, Math.PI * 2); ctx.clip(); }
    medalFace(c, sx, sy, w, h, now, alpha, rank);
    ctx.restore();
  }
  // The luck, revealed as it lands: a burst from the medal, gold for Critical, the rainbow for Shiny.
  if (rec?.rank && c.reveal && !reduced) {
    const p = (now - c.reveal) / 900;
    if (p >= 1) c.reveal = 0;
    else if (p > 0) {
      const cx = sx + w / 2, cy = sy + h * 0.38, R = w * (0.25 + 0.5 * (1 - Math.pow(1 - p, 2)));
      const cols = rec.rank === "shiny" ? ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF"] : ["#FFCB05"];
      ctx.globalAlpha = alpha * (1 - p); ctx.lineWidth = Math.max(2, w * 0.03);
      cols.forEach((cc, i) => { ctx.strokeStyle = cc; ctx.beginPath(); ctx.arc(cx, cy, R * (1 - i * 0.06), 0, Math.PI * 2); ctx.stroke(); });
      if (rec.rank === "crit") { ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * R * 1.08, cy + Math.sin(a) * R * 1.08); ctx.lineTo(cx + Math.cos(a) * R * 1.3, cy + Math.sin(a) * R * 1.3); } ctx.stroke(); }
      kick();
    }
  }
  ctx.globalAlpha = 1;
}
// Where the medal sits on the pocket: centred in the part above the label.
function medalBox(sx, sy, w, h) { const mh = Math.min(h * 0.66, (w * 0.84) * MV.h / MV.w), mw = mh * MV.w / MV.h; return { x: sx + (w - mw) / 2, y: sy + h * 0.045, w: mw, h: mh }; }
function drawArt(m, variant, sx, sy, w, h, now, alpha) {
  const b = medalBox(sx, sy, w, h), cv = medalArt(m, variant, b.w, now);
  if (cv) ctx.drawImage(cv, b.x, b.y, b.w, b.h);
  else { ctx.globalAlpha = alpha * (variant === "locked" ? 0.3 : 1); ctx.fillStyle = TIER_FLAT[m.medal.tier]; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.w * 0.58, b.w * 0.33, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = alpha; }
}
// Not yet earned: an empty pocket with the medal greyed in it, and what it needs. Hidden: a "?" and nothing else.
function medalPocket(m, sx, sy, w, h, now, alpha) {
  const r = w * 0.045, t = m.medal;
  rr(sx, sy, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.008); ctx.strokeStyle = theme["slot-line"]; rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke();
  if (t.hidden) {
    ctx.fillStyle = theme.dark ? "#9C83F0" : "#6B3FD1"; ctx.globalAlpha = alpha * 0.55; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    font(800, w * 0.4); ctx.fillText("?", sx + w / 2, sy + h * 0.46);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.globalAlpha = alpha; return;
  }
  drawArt(m, "locked", sx, sy, w, h, now, alpha);
  if (w < 44) return;
  const pad = w * 0.075, nameY = sy + h - pad - w * 0.085, barY = nameY - w * 0.088 - w * 0.06, bw = w - pad * 2, bh = Math.max(1.5, w * 0.022);
  ctx.fillStyle = theme["slot-line"]; ctx.fillRect(sx + pad, barY, bw, bh);
  ctx.fillStyle = TIER_FLAT[t.tier]; ctx.fillRect(sx + pad, barY, bw * (m.goal ? m.have / m.goal : 0), bh);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, w * 0.088, true); ctx.fillText(fitText(t.name, w - pad * 2), sx + pad, nameY);
  font(500, w * 0.064); ctx.fillText(fitText(toGo(m), w - pad * 2), sx + pad, sy + h - pad);
}
const toGo = (m) => (m.medal.goal > 1 ? `${Math.max(0, m.goal - m.have)} to go` : "Not yet");
// Earned: a card face in the tier's colour with the medal on it and a printed label, like a card you own.
function medalFace(m, sx, sy, w, h, now, alpha, rank) {
  const t = m.medal, r = w * 0.045;
  if (w > 90) { ctx.save(); ctx.shadowColor = "rgb(0 0 0 / .32)"; ctx.shadowBlur = w * 0.09; ctx.shadowOffsetY = w * 0.035; rr(sx, sy, w, h, r); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore(); }
  ctx.save(); rr(sx, sy, w, h, r); ctx.clip();
  ctx.fillStyle = TIER_FACE[t.tier]; ctx.fillRect(sx, sy, w, h);
  if (w > 60) { ctx.fillStyle = engraving(); ctx.fillRect(sx, sy, w, h); }
  // Shiny: the card foil, while nothing moves (as on a card).
  if (rank === "shiny" && !reduced && !foilOff && !state.trans && !fly && !inertia && !(tbl.on && tableMoving())) {
    frameFoil = true;
    const phase = ((now * 0.00005 + (sx + cam.x * cam.s * 0.25) * 0.0011) % 1 + 1) % 1, fx = sx - w + phase * w * 3;
    const fg = ctx.createLinearGradient(fx, sy, fx + w * 0.9, sy + h);
    fg.addColorStop(0, "rgb(255 255 255 / 0)"); fg.addColorStop(0.38, "rgb(150 220 255 / .28)"); fg.addColorStop(0.5, "rgb(255 226 160 / .42)"); fg.addColorStop(0.62, "rgb(160 245 205 / .28)"); fg.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = fg; ctx.fillRect(sx, sy, w, h); ctx.globalCompositeOperation = "source-over";
  }
  const lh = h * 0.24, ly = sy + h - lh;
  ctx.fillStyle = theme.paper; ctx.fillRect(sx, ly, w, lh);
  ctx.fillStyle = "rgb(0 0 0 / .14)"; ctx.fillRect(sx, ly, w, Math.max(1, w * 0.006));
  ctx.restore();
  // Luck is the set's rarity: a gold rule for Critical, a rainbow one for Shiny.
  if (rank) {
    rr(sx + w * 0.03, sy + w * 0.03, w * 0.94, h - lh - w * 0.04, r * 0.7); ctx.lineWidth = Math.max(1, w * 0.014);
    if (rank === "shiny") { const g = ctx.createLinearGradient(sx, sy, sx + w, sy + h - lh); g.addColorStop(0, "#FF6B6B"); g.addColorStop(0.25, "#FFD93D"); g.addColorStop(0.5, "#6BCB77"); g.addColorStop(0.75, "#4D96FF"); g.addColorStop(1, "#C77DFF"); ctx.strokeStyle = g; }
    else ctx.strokeStyle = "rgb(255 210 80 / .95)";
    ctx.stroke();
  }
  drawArt(m, rank ? "ranked" : "plain", sx, sy, w, h - lh * 0.15, now, alpha);
  if (w < 40) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["paper-ink"];
  font(800, w * 0.092, true); ctx.fillText(fitText(t.name, w * 0.84), sx + pad, ly + lh * 0.46);
  font(500, w * 0.064); ctx.globalAlpha = alpha * 0.7;
  const right = rank === "shiny" ? "Shiny" : rank === "crit" ? "Critical" : TIER_LABEL[t.tier];
  ctx.fillText(fitText(t.chase, w * 0.56), sx + pad, ly + lh * 0.82);
  if (rank) { ctx.globalAlpha = alpha; ctx.fillStyle = rank === "shiny" ? "#7A3FD1" : "#9A6A00"; font(800, w * 0.064); }
  ctx.textAlign = "right"; ctx.fillText(right, sx + w - pad, ly + lh * 0.82);
  ctx.textAlign = "left"; ctx.globalAlpha = alpha;
}

// ----- the arrangement: the trophy set joins the sets and chases (by set only; price bands are cards) -----
function arrange(m) {
  mode = m;
  if (m === "set") {
    setGroups ||= sets.map((st) => { const g = { key: st.id, name: st.name, ink: st.ink, cards: st.cards, base: st.cards, set: st }; g.sub = () => { const list = g.base, view = scopeOf(st) === "set" ? "" : scopeOf(st) === "master" ? " Master set." : " Grand set."; return state.value ? `${st.year}.${view} Yours is worth ${money(worthOf(list))}` : state.lens === "need" ? `${st.year}.${view} ${list.length - ownedIn(list)} to go` : `${st.year}.${view} ${ownedIn(list)} of ${list.length}`; }; return g; });
    for (const g of setGroups) g.cards = g.base = scopedCards(g.set);
    groups = [...setGroups, ...chases.map((r, i) => chaseGroup(r, i)), trophyGroup()];
  } else {
    groups = BANDS.map(([lo, hi, name, sz], i) => ({ key: name, name, sz, ink: BAND_INK[i], cards: cards.filter((c) => c.price >= lo && c.price < hi).sort((a, b) => b.price - a.price) })).filter((g) => g.cards.length);
    for (const g of groups) g.sub = () => `${ownedIn(g.cards)} of ${g.cards.length}. Yours is worth ${money(worthOf(g.cards))}`;
  }
  groups.forEach((g, gi) => { g.gi = gi; g.sz ||= 1; g.cols = Math.max(1, Math.floor(COLS / g.sz)); g.cards.forEach((c, k) => { c.g = gi; c.k = k; }); });
  drawnCards = m === "set" ? groups.flatMap((g) => g.base || g.cards) : cards;
  try { localStorage.setItem("wall-mode", m); } catch { /* fine */ }
}
// Need is Next up: what's left, closest first (the hidden ones last, then what you've earned).
function nextUp(list) {
  const idx = new Map(list.map((m, i) => [m, i])), key = (m) => (m.owned ? 3 : m.medal.hidden ? 2 : 1);
  return list.slice().sort((a, b) => key(a) - key(b) || b.have / b.goal - a.have / a.goal || (a.goal - a.have) - (b.goal - b.have) || idx.get(a) - idx.get(b));
}
function orderGroup(g) {
  if (g.trophies) {
    const list = state.lens === "need" ? nextUp(g.base) : g.base;
    const changed = g.cards.length !== list.length || g.cards.some((c, i) => c !== list[i]);
    if (changed && view === "set" && state.g === g && !state.trans && !state.focus && !reduced) { // the pockets travel to their new places, as cards do when a lens reorders a set
      const now = performance.now();
      for (const c of g.cards) { c.px = c.x; c.py = c.y; }
      list.forEach((c, k) => { c.delay = Math.min(240, k * 1.2); });
      shuffle = { g, t0: now, dur: 640, end: now + 900 };
    }
    g.lead = []; g.cards = list;
    list.forEach((c, k) => { c.k = k; c.lift = 0; });
    return;
  }
  g.base ||= g.cards;
  const key = state.lens === "trade" ? isSpare : isChase, ord = state.lens === "trade" ? spareOrder : chaseOrder;
  const lead = lifted ? g.base.filter(key).sort(ord) : [];
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !key(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}
// The mosaic: the trophy set is its own row at the end, after New chase and before the trophy room's door, packed as
// densely as the sets above it.
function trophyRowH(R0, fitH0, nCards) {
  if (!TG || mode !== "set") return 0;
  const n = TG.cards.length, iw = R0.w - PG * 2 - 12;
  const dens = Math.max(340, (R0.w * Math.max(fitH0, 200)) / Math.max(1, nCards + n));
  const cw = clamp(Math.sqrt(dens * TW / TH), 12, 40), cols = Math.max(1, Math.floor(iw / cw)), rows = Math.ceil(n / cols);
  return PG * 2 + LABEL + 6 + rows * cw * TH / TW + 4;
}
function mosaicLayout() {
  const R0 = { x: 8, y: topPad(), w: vw - 16 }, top = R0.y + shelfLayout(R0);
  const live = groups.filter((g) => !g.done && !g.trophies), tg = mode === "set" ? TG : null;
  const newH = mode === "set" && !picking() ? NEW_H : 0;
  newPanel = null; trophyCase = null; COVER.m = null;
  const fit0 = vh - top - botPad() - newH, tH = tg ? trophyRowH(R0, fit0, live.reduce((a, g) => a + g.cards.length, 0)) : 0;
  const fitH = Math.max(fit0 - tH, fit0 * 0.5);
  const tail = (y) => { if (newH) { newPanel = { x: R0.x, y, w: R0.w, h: newH }; y += newH; } if (tg) { tg.m = { x: R0.x, y, w: R0.w, h: tH }; y += tH; } return y; };
  if (mode === "set" && pickedSets.size && pickedSets.size < sets.length) {
    const mine = live.filter((g) => g.chase || pickedSets.has(g.set.id)), rest = live.filter((g) => g.set && !pickedSets.has(g.set.id));
    const n = mine.reduce((a, g) => a + g.cards.length, 0);
    const R = { x: R0.x, y: top, w: R0.w, h: mine.length ? Math.max(fitH - rest.length * W_FOLD, fitH * 0.62, (n * 340) / (vw - 16)) : 0 };
    const items = mine.map((g) => ({ g, v: Math.max(g.cards.length, 45) }));
    const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
    for (const i of items) i.v = Math.max(i.v, floor);
    if (items.length) stripTreemap(items, R);
    let y = R.y + R.h;
    for (const g of rest) { g.m = { x: R.x, y, w: R.w, h: W_FOLD }; y += W_FOLD; }
    y = tail(y);
    y += caseLayout(R0, y);
    mMax = Math.max(0, y + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    for (const g of mine) packPanel(g);
    for (const g of rest) packFolded(g);
    if (tg) packPanel(tg);
    return;
  }
  const n = live.reduce((a, g) => a + g.cards.length, 0);
  const R = { x: R0.x, y: top, w: R0.w, h: live.length ? Math.max(fitH, (n * 340) / (vw - 16)) : 0 };
  let y = tail(R.y + R.h);
  y += caseLayout(R0, y);
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  const items = live.map((g) => ({ g, v: mode === "value" ? Math.pow(g.cards.reduce((t, c) => t + c.price, 0), 0.7) : Math.max(g.cards.length, 45) }));
  const floor = items.reduce((t, i) => t + i.v, 0) * 0.06;
  for (const i of items) i.v = Math.max(i.v, floor);
  if (items.length) stripTreemap(items, R);
  for (const g of live) packPanel(g);
  if (tg) packPanel(tg);
}
// The panel's count reads like a set's; Value and search have nothing to say about trophies.
function panelStat(g) {
  if (picking()) return "  ";
  if (g.trophies) {
    const n = g.cards.length, e = g.cards.filter((m) => m.owned).length;
    if (state.matches || state.lens === "chase" || state.lens === "trade") return "";
    return state.lens === "need" ? `${n - e} to go` : `${e}/${n}`;
  }
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(rootOf(c))).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}

// ----- completion checks: every change of cards also checks the trophies (after the card's own toast) -----
function syncDone({ quiet = false } = {}) {
  scheduleMedals();
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

// ----- marking stays with cards: no Mark in the trophy set, and a hold on a medal does nothing -----
function setChrome() {
  if (marking && view === "set" && state.g?.trophies) leaveMark();
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on && !room.on && !bnd.on;
  backBtn.setAttribute("aria-label", bnd.on && !tbl.on ? "Back to the Trade lens" : room.on && view !== "set" ? "Back to the wall" : "Back to everything");
  markBtn.hidden = view !== "set" || marking || Boolean(state.g?.trophies);
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : bnd.on ? (bnd.show ? "Trade binder, Show mode" : "Trade binder") : room.on ? "Trophy room" : "";
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); updateCount();
}
function enterMark() {
  if (marking || view !== "set" || state.g?.trophies) return;
  if (state.focus) unfocus();
  marking = true; session.clear();
  document.body.classList.add("marking"); markBtn.hidden = true;
  updateBar(); updateCount(); hideCaption(); tick(5); kick();
}
function markCard(c, on) {
  if (c.medal || c.owned === on) return;
  if (!session.has(c)) session.set(c, c.owned);
  setOwned(c, on, { quiet: true });
  if (session.get(c) === c.owned) session.delete(c);
  updateBar();
}
function beginStroke(card, p) {
  cancelPress();
  if (card.medal) return;
  const on = !card.owned;
  gesture.stroke = { on, seen: new Set([card]), last: { x: p.x, y: p.y } };
  gesture.moved = true;
  markCard(card, on);
}
function markAllInSet() {
  const g = state.g; if (!g || !marking || g.trophies) return;
  const todo = g.cards.filter((c) => !c.owned); if (!todo.length) { toast("You have all of them already."); return; }
  const now = performance.now();
  todo.forEach((c, i) => { const b = c.base || c; if (!session.has(c)) session.set(c, c.owned); b.owned = true; b.got = Date.now(); saved[b.id] = { on: true, at: b.got }; if (!reduced) for (const t of [b, ...twinsOf(b)]) t.anim = { t0: now + i * 5, to: true }; });
  persist(); updateBar(); updateCount(); drawList(); tick(14);
  const sync = syncDone();
  if (lifted && !sync) liftLayout(true);
  if (view === "set") g.burst = now;
  if (sync?.minted.length) { tick(40); toast(finishedText(sync.minted)); }
  kick();
}

// ----- a medal up close: the cards behind it, missing first; tap one to fly to it -----
const mcEl = document.createElement("div");
mcEl.className = "mcards"; mcEl.hidden = true;
mcEl.innerHTML = `<p class="mc-head" id="mc-head"></p><div class="mc-row" id="mc-row" role="group" aria-label="The cards behind this trophy"></div>`;
document.getElementById("swap").after(mcEl);
const hintEl = panel.querySelector(".hint"), HINT0 = hintEl.textContent;
mcEl.addEventListener("click", (e) => { const b = e.target.closest("[data-mc]"); if (!b || !mcEl.list) return; const c = mcEl.list[Number(b.dataset.mc)]; if (c) goToCard(c); });
function cardsBehind(t) {
  let list = [];
  if (t.anyOf) list = t.anyOf.map((g) => g.find((c) => c.owned) || g[0]);
  else if (t.cards) list = t.cards;
  return [...new Set(list)].map((c, i) => [c, i]).sort((a, b) => Number(a[0].owned) - Number(b[0].owned) || a[1] - b[1]).map(([c]) => c);
}
function fillPanel(c, dir) {
  const swap = document.getElementById("swap");
  document.body.classList.toggle("medalfocus", Boolean(c.medal));
  const put = c.medal ? () => fillMedal(c) : () => {
    const st = sets[c.si];
    hintEl.textContent = HINT0; mcEl.hidden = true;
    document.getElementById("p-deal").classList.remove("luck");
    document.getElementById("p-name").textContent = c.name;
    document.getElementById("p-meta").textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. ${c.variant ? `${c.variant}. ` : ""}${c.rname}.${c.owned && c.got ? ` Yours since ${new Date(c.got).toLocaleDateString("en-US", { month: "short", year: "numeric" })}.` : ""}${!c.owned && isChase(c) ? ` Pay up to ${money(capOf(c))}.` : c.owned && isSpare(c) ? " You have a spare." : ""}`;
    document.getElementById("p-price").innerHTML = `${money(c.price)}<small>market</small>`;
    const dl = document.getElementById("p-deal");
    if (!c.owned && c.deal && isChase(c)) { dl.hidden = false; dl.textContent = `A copy on eBay for ${money(c.deal)} right now, ${Math.round((1 - c.deal / c.price) * 100)}% under.`; } else dl.hidden = true;
    const own = document.getElementById("p-own"), buy = document.getElementById("p-buy");
    own.textContent = c.owned ? "In your collection ✓" : "I have it";
    own.className = `act ${c.owned ? "owned" : "primary"}`;
    own.setAttribute("aria-pressed", String(c.owned));
    buy.textContent = c.owned ? "Back to the set" : c.deal && isChase(c) ? `Buy for ${money(c.deal)}` : "Find a copy";
    updateFlag(c);
    fillChips(panelMore, c);
  };
  if (dir && !reduced) { swap.classList.add("out"); setTimeout(() => { put(); swap.classList.remove("out"); }, 140); } else put();
}
function fillMedal(m) {
  const t = m.medal, rec = recOfMedal(m), hidden = isHiddenLocked(m), dl = document.getElementById("p-deal");
  hintEl.textContent = "Flick to move along the trophies.";
  document.getElementById("p-name").textContent = hidden ? "A hidden trophy" : t.name;
  document.getElementById("p-meta").textContent = hidden ? "It shows itself once you find it." : `${t.chase}${t.sig ? ", a signature trophy" : ""}${t.hidden ? ", a hidden trophy" : ""}. ${t.desc}`;
  const left = Math.max(0, m.goal - m.have);
  document.getElementById("p-price").innerHTML = rec ? `${esc(dayOf(rec.at))}<small>earned</small>` : hidden ? "?<small>hidden</small>" : t.goal > 1 ? `${left.toLocaleString()}<small>to go</small>` : "Not yet<small>&nbsp;</small>";
  dl.classList.add("luck");
  if (rec?.rank) { dl.hidden = false; dl.textContent = `${RANK_TEXT[rec.rank]}. Its luck was rolled the moment you earned it.`; }
  else if (rec) { dl.hidden = false; dl.textContent = `${TIER_LABEL[t.tier]}. Its luck roll came up plain.`; }
  else dl.hidden = true;
  const list = hidden ? [] : cardsBehind(t), MAX = 24, shown = list.slice(0, MAX), own = list.filter((c) => c.owned).length;
  mcEl.list = shown; mcEl.hidden = !list.length;
  if (list.length) {
    document.getElementById("mc-head").textContent = t.anyOf ? `${own} of ${list.length}, one card for each. ${own < list.length ? "Missing first. " : ""}Tap one to go to it.` : `You have ${own} of ${list.length === 1 ? "this card" : `these ${list.length}`}${t.goal < list.length ? `, ${t.goal} needed` : ""}. ${own < list.length ? "Missing first. " : ""}Tap one to go to it.`;
    const row = document.getElementById("mc-row");
    row.innerHTML = shown.map((c, i) => { const st = sets[c.si]; return `<button type="button" class="mc${c.owned ? " own" : ""}" data-mc="${i}" aria-label="${esc(`${c.name}, ${st.name} ${c.num}, ${c.owned ? "you have it" : "missing"}`)}"><i style="--c:${typeColor(c)}"></i><div><b>${esc(c.name)}</b><span>${esc(st.code)} ${esc(c.num)}</span></div></button>`; }).join("") + (list.length > MAX ? `<span class="mc-more">and ${list.length - MAX} more</span>` : "");
    row.scrollLeft = 0;
  }
}
// The close-up is a medal: Back to the set and the card actions don't apply; flicking still steps along.
document.getElementById("p-own").addEventListener("click", (e) => { if (state.focus?.medal) e.stopImmediatePropagation(); }, true);

// ----- the list: the trophy set as a section of its own -----
function medalListHTML() {
  if (!TG || state.matches || state.lens === "chase" || state.lens === "trade") return "";
  const items = TG.cards.filter((m) => state.lens !== "need" || !m.owned);
  if (!items.length) return "";
  return `<section><h2>Trophies</h2><p class="lsub">${esc(TG.sub())}</p><ul>${items.map((m) => {
    const t = m.medal, rec = recOfMedal(m), hid = isHiddenLocked(m);
    return `<li><div class="lrow lmedal"><span class="lname">${hid ? "A hidden trophy" : esc(t.name)}</span><span class="lmeta">${hid ? "Shows once you find it" : esc(`${t.chase}. ${t.desc}`)}</span><span class="lprice">${rec ? `Earned ${esc(dayOf(rec.at))}` : hid ? "" : esc(toGo(m))}</span><span class="lstate">${hid ? "Hidden" : `${TIER_LABEL[t.tier]}${rec?.rank ? `, ${rec.rank === "shiny" ? "Shiny" : "Critical"}` : ""}`}</span></div></li>`;
  }).join("")}</ul></section>`;
}
function drawList() {
  scheduleMedals();
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
    if (g.trophies) return medalListHTML();
    const items = g.cards.filter(show);
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}</p><ul>${items.map(row).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

// Debug builds only: the tests' hook sees the trophy set.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { TG: { get: () => TG }, medals: { get: () => medals }, syncMedals: { value: syncMedals }, goToMedal: { value: goToMedal }, goToCard: { value: goToCard }, medalArt: { value: medalArt }, medalSVG: { value: medalSVG }, ART: { value: ART } }); }, 0);
