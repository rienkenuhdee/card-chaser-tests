// ---------- round 19 (safe): production's trophies, in the trophy room ----------
// The room keeps its plaques, and production's Medal tab moves in, laid out the way it is there: a summary in the
// header ("23 of 140 trophies · 2 hidden left to find"), a Showcase shelf (the rarest you've earned: Shiny, then
// Critical, then tier), Next up (closest to earning, with a bar), plain filters (All, Earned, To earn, Critical, Shiny),
// then a shelf per chase with its medals in a compact grid, earned in colour with the date and the rest grey with
// "12 to go". Chases with nothing earned fold away under "Not started yet". Tapping a medal opens production's trophy
// card: what it's for and the cards behind it, missing first; tap one to go to it.
// The catalog is production's (public/app.js, computeTrophies and friends), on the wall's cards: per-chase milestones
// named by kind, the in-chase goals, signature trophies (hand-made per set and generic), hidden ones, the Dex and the
// global ones. The medals are production's artwork (public/medal.js), rasterized once per trophy, size, dpr and theme
// from an SVG image into an offscreen canvas, and drawn from there; the nameplate is lettered on top in Archivo.
// Luck is rolled once per trophy, seeded by its id (1 in 100 Shiny, otherwise about 1 in 10 Critical). Earned trophies
// are kept in localStorage wall-medals (cleared by Reset the demo). Anything already true when the wall loads is
// earned quietly, dated from when its cards came in; anything earned while you use it pops in a toast-sized card.

// ----- production's words, shapes and colours -----
const MD_NAMES = {
  set: { half: "Half a Binder", tq: "Nearly Full", last3: "Last Pockets", complete: "Binder Complete" },
  pokemon: { half: "Fan Club", tq: "Superfan", last3: "Shrine Builder", complete: "Hall of Fame" },
  artist: { half: "Gallery Opening", tq: "Curator", last3: "Final Frame", complete: "Full Exhibit" },
  region: { half: "Road Trip", tq: "Cross Country", last3: "Last Stop", complete: "Grand Tour" },
  type: { half: "Attuned", tq: "Resonant", last3: "On the Edge", complete: "Perfect Match" },
  rarity: { half: "Treasure Hunter", tq: "Collector's Eye", last3: "Last Gem", complete: "Full Hoard" },
  custom: { half: "Halfway", tq: "Home stretch", last3: "Last three", complete: "Complete" },
};
const MD_SHAPE = { set: "shield", pokemon: "hex", artist: "rosette", region: "octagon", type: "diamond", rarity: "star", custom: "circle", dex: "squircle", global: "badge" };
const MD_TIERS = { bronze: ["#F0B27A", "#9A5B21"], silver: ["#EEF1F7", "#8E99AD"], gold: ["#FFE066", "#C99A00"], holo: ["#9BE0FF", "#C9A8FF"] };
const MD_RANK = { shiny: "Shiny", crit: "Critical" };
const MD_FOUR = { light: { red: "#C0392B", yellow: "#B8892A", green: "#2E8B57", blue: "#3B4CCA" }, dark: { red: "#E5685B", yellow: "#E3B341", green: "#4CBF86", blue: "#8D9BFF" } };
const MD_STARTERS = [[1, 9], [152, 160], [252, 260], [387, 395], [495, 503], [650, 658], [722, 730], [810, 818], [906, 914]];
const MD_LEGENDS = [[144, 146], [150, 151], [243, 245], [249, 251], [377, 386], [480, 494], [638, 649], [716, 721], [772, 773], [785, 809], [888, 898], [905, 905], [1001, 1010], [1014, 1025]];
const MD_EEVEE = new Set([133, 134, 135, 136, 196, 197, 470, 471, 700]);
const MD_REGIONS = [["Kanto", 1, 151], ["Johto", 152, 251], ["Hoenn", 252, 386], ["Sinnoh", 387, 493], ["Unova", 494, 649], ["Kalos", 650, 721], ["Alola", 722, 809], ["Galar", 810, 905], ["Paldea", 906, 1025]];
const MD_ERAS = [["mega", 2025.6], ["sv", 2023.2], ["swsh", 2020.1], ["wotc", 0]]; // the wall's sets span four of production's eras
const mdInRanges = (n, rs) => rs.some(([a, b]) => n >= a && n <= b);
const mdYear = (st) => { const d = new Date(st.released); return d.getUTCFullYear() + (d.getUTCMonth() + 1) / 12; };
const mdEra = (c) => { const y = mdYear(sets[c.si]); return MD_ERAS.find((e) => y >= e[1])[0]; };
const mdTierIdx = (t) => ["bronze", "silver", "gold", "holo"].indexOf(t);
const mdScore = (t) => (t.rank === "shiny" ? 1000 : t.rank === "crit" ? 500 : 0) + mdTierIdx(t.tier) * 10;
const mdLucky = (t) => Boolean(t.earned && MD_RANK[t.rank]);
const MD_SPECIES = new Map(); // Dex number -> its cards across the wall
for (const c of cards) if (c.dex) { if (!MD_SPECIES.has(c.dex)) MD_SPECIES.set(c.dex, []); MD_SPECIES.get(c.dex).push(c); }
const mdCardById = new Map(cards.map((c) => [c.id, c]));
// A set's colour folds into the nearest of production's four (purple and grey become blue).
function mdFour(h) {
  const [r, g, b] = hex(h).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.25 * mx || mx < 0.35) return "blue";
  let hu = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hu = (hu * 60 + 360) % 360;
  return hu < 20 || hu >= 330 ? "red" : hu < 70 ? "yellow" : hu < 170 ? "green" : "blue";
}
// What kind of chase a saved rule is, as production reads it: one thing named is that kind; a mix is custom.
function mdKindOf(r) {
  if (r.popular) return "custom";
  const on = ["dex", "artist", "rarity", "type", "set"].filter((k) => r[k]);
  if (on.length !== 1) return "custom";
  return { dex: "pokemon", artist: "artist", rarity: "rarity", type: "type", set: "set" }[on[0]];
}
const mdInitials = (t) => String(t || "").split(/[\s,.-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
function mdPlate(kind, r, name) {
  if (kind === "pokemon") return `#${r.dex}`;
  if (kind === "artist") return mdInitials(r.artist);
  if (kind === "type") return (TYPE[r.type] || TYPE.C)[0].slice(0, 3).toUpperCase();
  if (kind === "rarity") return "★";
  return String(name || "").slice(0, 2).toUpperCase();
}
const mdBucket = (c) => { const r = c.rname; if (/^(common|uncommon)$/i.test(r)) return "easy"; if (/secret|illustration|hyper|special|rainbow|gold|shiny|amazing|radiant|ultra|double|ace spec|v\b|vmax|vstar|ex\b|gx/i.test(r)) return "chase"; if (/holo/i.test(r)) return "holo"; return "other"; };
// Luck: rolled once per trophy, seeded by its id, so it can't be rerolled (a chase is keyed by its rule, not its name).
const mdRoll = (id) => { const r = h32(`${Math.floor(h32(`luck|${id}`) * 1e9)}|${id}|roll`); return r < 0.01 ? "shiny" : r < 0.11 ? "crit" : "normal"; };

// ----- signature trophies: what a set or a kind of chase uniquely offers -----
// Each is units (cards, or groups of cards where any one counts) and how many of them are needed.
function mdSigs(c) {
  const out = [], base = c.cards, total = base.length, kind = c.kind, sid = c.setId;
  const sig = (id, name, desc, tier, plate, group, min = 2) => { if (group.length >= min && group.length < total) out.push({ id, name, desc, tier, plate, units: group, need: group.length }); };
  const anyOf = (id, name, desc, tier, plate, groups, min, need = 0) => { if (groups.length >= min) out.push({ id, name, desc, tier, plate, units: groups, need: need || groups.length }); };
  const pool = (id, name, desc, tier, plate, list, need) => out.push({ id, name, desc, tier, plate, units: list, need });
  const named = (...ns) => base.filter((x) => ns.includes(x.name));
  const trainer = (x) => x.type === "t", art = (x) => /illustration rare/i.test(x.rname);
  if (kind === "set" || kind === "custom") {
    if (sid === "base1") {
      sig("big-three", "The Big Three", "Charizard, Blastoise and Venusaur.", "holo", "BIG3", named("Charizard", "Blastoise", "Venusaur"), 3);
      sig("professors", "Professor's Lab", "Professor Oak and the Impostor.", "silver", "OAK", named("Professor Oak", "Impostor Professor Oak"), 2);
    }
    if (sid === "base3") sig("birds", "Legendary Birds", "Articuno, Zapdos and Moltres.", "gold", "BIRD", named("Articuno", "Zapdos", "Moltres").filter((x) => /holo/i.test(x.rname)), 3);
    if (sid === "base2") sig("eevee", "Jungle Eeveelutions", "Eevee and its three evolutions, holo and non-holo.", "gold", "EEV", base.filter((x) => MD_EEVEE.has(x.dex)), 4);
    if (sid === "me55") sig("rgb", "Red, Green and Blue", "All three Mews: R, G and B.", "holo", "RGB", base.filter((x) => /^[RGB]$/.test(x.num)), 3);
    if (sid === "base5") sig("dark", "Dark Side", "Every Dark Pokémon card.", "gold", "DARK", base.filter((x) => /^Dark /.test(x.name) && !trainer(x)), 3);
    if (sid === "neo1") anyOf("johto", "Johto Starters", "A holo Meganium, Typhlosion and Feraligatr.", "holo", "JOHTO", ["Meganium", "Typhlosion", "Feraligatr"].map((n) => named(n).filter((x) => /holo/i.test(x.rname))).filter((g) => g.length), 3);
    if (sid === "swsh7") sig("dragons", "Dragon's Hoard", "Every Dragon-type card.", "gold", "DRAGON", base.filter((x) => x.type === "N"), 3);
    if (sid === "sv8pt5") sig("prism", "Prismatic Nine", "Eevee and the eight Eeveelutions as Special Illustration Rares.", "holo", "PRISM", base.filter((x) => x.rname === "Special Illustration Rare" && MD_EEVEE.has(x.dex)), 9);
    if (sid === "sv3pt5") {
      const byDex = []; for (let d = 1; d <= 151; d++) { const g = base.filter((x) => !trainer(x) && x.dex === d); if (g.length) byDex.push(g); }
      anyOf("kanto", "Kanto Complete", "One card of every Pokémon from #1 to #151.", "holo", "151", byDex, 100);
    }
    if (sid !== "base3") sig("legends", "Legends", "Every legendary and mythical Pokémon card.", "gold", "LEG", base.filter((x) => x.dex && mdInRanges(x.dex, MD_LEGENDS)), 2);
    sig("starters", "Starter Squad", "Every starter Pokémon card, evolutions included.", "silver", "STR", base.filter((x) => x.dex && mdInRanges(x.dex, MD_STARTERS)), 3);
    if (sid !== "base2") sig("eevee", "Eeveelutions", "Eevee and every evolution.", "silver", "EEV", base.filter((x) => MD_EEVEE.has(x.dex)), 3);
    sig("trainers", "Trainer's Toolbox", "Every Trainer card.", "bronze", "TRN", base.filter(trainer), 5);
    const printed = sid ? setById(sid).printed : 0;
    if (printed) sig("secret", "Secret Stash", "Every card numbered past the set's printed total.", "gold", "SECRET", base.filter((x) => /^\d+$/.test(x.num) && Number(x.num) > printed), 2);
    sig("holo-wall", "Holo Wall", "Every Rare Holo.", "silver", "HOLO", base.filter((x) => x.rname === "Rare Holo"), 3);
    sig("rainbow", "Rainbow Road", "Every Rainbow Rare and Hyper Rare.", "gold", "RAINBW", base.filter((x) => /^(Rainbow Rare|Hyper Rare)$/.test(x.rname)), 3);
    sig("ace", "Ace in the Hole", "Every ACE SPEC card.", "silver", "ACE", base.filter((x) => /ACE SPEC/i.test(x.rname)), 2);
    sig("special-energy", "Special Delivery", "Every Special Energy.", "bronze", "NRG", base.filter((x) => x.type === "e" && !/^(Basic )?(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$/.test(x.name)), 2);
    sig("gallery", "Gallery Wall", "Every Illustration Rare and Special Illustration Rare.", "gold", "ART", base.filter(art), 3);
  }
  if (kind === "pokemon") {
    const forms = new Map(); for (const x of base) { if (!forms.has(x.name)) forms.set(x.name, []); forms.get(x.name).push(x); }
    if (forms.size >= 4) anyOf("forms", "Every Form", `A card of each form it comes in (${forms.size}: base, Dark, regional, ex, V...).`, "gold", "FORMS", [...forms.values()], 4);
    const a = base.filter(art); if (a.length) pool("art-piece", "Art Piece", "An Illustration Rare or Special Illustration Rare of it.", "silver", "ART", a, 1);
  }
  if (kind === "type" && total >= 60) pool("mono", "Mono Deck", "Sixty cards of the type: a whole deck's worth.", "gold", "60", base, 60);
  const bySet = new Map(); for (const x of base) { if (!bySet.has(x.si)) bySet.set(x.si, []); bySet.get(x.si).push(x); }
  if (kind === "rarity" && bySet.size >= 10) anyOf("ten-sets", "Ten Sets Deep", "Cards from ten different sets.", "silver", "10", [...bySet.values()], 10, 10);
  if (kind === "artist") {
    const dated = base.slice().sort((a, b) => sets[a.si].released - sets[b.si].released || a.n0 - b.n0);
    if (dated.length >= 2) out.push({ id: "first-brush", name: "First Brushstroke", desc: `Their earliest card: ${dated[0].name}.`, tier: "silver", plate: "1ST", units: [dated[0]], need: 1 });
    const a = base.filter(art); if (a.length >= 3) pool("showpiece", "Showpiece", "Three of their Illustration Rares or Special Illustration Rares.", "gold", "ART", a, 3);
  }
  const byEra = new Map(); for (const x of base) { const e = mdEra(x); if (!byEra.has(e)) byEra.set(e, []); byEra.get(e).push(x); }
  if (["pokemon", "type", "rarity"].includes(kind) && byEra.size >= 4) anyOf("eras", "Through the Ages", `A card from every era it appears in (${byEra.size} eras).`, "gold", "ERA", [...byEra.values()], 4);
  if (kind === "pokemon" && total >= 6) {
    const dated = base.slice().sort((a, b) => sets[a.si].year - sets[b.si].year);
    if (sets[dated[0].si].year !== sets[dated[dated.length - 1].si].year) out.push({ id: "then-now", name: "Then and Now", desc: "Its oldest card and its newest.", tier: "silver", plate: "THEN", units: [dated[0], dated[dated.length - 1]], need: 2 });
  }
  if (kind === "artist") {
    const dec = new Map(); for (const x of base) { const d = Math.floor(sets[x.si].year / 10) * 10; if (!dec.has(d)) dec.set(d, []); dec.get(d).push(x); }
    if (dec.size >= 3) anyOf("decades", "Across the Decades", `A card from each decade they've illustrated in (${[...dec.keys()].sort().map((d) => `${d}s`).join(", ")}).`, "gold", "DEC", [...dec.values()], 3);
    if (bySet.size >= 10) anyOf("ten-sets", "Ten Sets Deep", "Their cards from ten different sets.", "silver", "10", [...bySet.values()], 10, 10);
  }
  return out;
}

// ----- the catalog, computed from the wall (never per frame: cached until a card, a chase, a trade or a medal changes) -----
let mdStore = null; // id -> { at, rank, name, chase, sec, kind, color, plate, tier, sig, hidden }
try { mdStore = JSON.parse(localStorage.getItem("wall-medals") || "null"); } catch { mdStore = null; }
const mdFirst = !mdStore || typeof mdStore !== "object";
if (mdFirst) mdStore = {};
const mdPersist = () => { try { localStorage.setItem("wall-medals", JSON.stringify(mdStore)); } catch { /* private mode */ } };
const mdTradesDone = () => (typeof trades === "undefined" ? [] : trades.filter((r) => r.state === "done" || r.state === "accepted"));
const mdUnitOwned = (u) => (Array.isArray(u) ? u.some((c) => c.owned) : u.owned);
function mdCompute() {
  const out = [];
  const mk = (base, o) => {
    const t = { ...base, ...o };
    let have = 0;
    if (t.units) { for (const u of t.units) if (mdUnitOwned(u)) have++; } else have = t.haveN || 0;
    t.earned = have >= t.need; t.have = Math.min(have, t.need); t.goal = t.need;
    out.push(t); return t;
  };
  const chase = (c) => {
    const cs = c.cards, total = cs.length; if (!total) return;
    const N = MD_NAMES[c.kind] || MD_NAMES.custom, base = { chase: c.name, sec: c.key, kind: c.kind, color: c.color, plate: c.plate, open: c.open };
    for (const s of mdSigs(c)) mk(base, { id: `${c.key}:sig-${s.id}`, name: s.name, desc: `${s.desc} (${c.name})`, tier: s.tier, sig: true, plate: s.plate, units: s.units, need: s.need });
    mk(base, { id: `${c.key}:half`, name: N.half, desc: `Own half of ${c.name}.`, tier: "silver", units: cs, need: Math.ceil(total * 0.5) });
    mk(base, { id: `${c.key}:three-quarters`, name: N.tq, desc: `Own 75% of ${c.name}.`, tier: "gold", units: cs, need: Math.ceil(total * 0.75) });
    if (total >= 6) mk(base, { id: `${c.key}:last3`, name: N.last3, desc: `Get ${c.name} down to its final three cards.`, tier: "gold", units: cs, need: total - 3 });
    mk(base, { id: `${c.key}:complete`, name: N.complete, desc: `Every card in ${c.name}.`, tier: "holo", units: cs, need: total });
    for (const [bucket, name, desc, tier] of [["holo", "Holo hunter", "Every holo rare", "silver"], ["chase", "Chase cards", "Every chase-rarity card", "gold"], ["easy", "Clean sweep", "Every common and uncommon", "bronze"]]) {
      const grp = cs.filter((x) => mdBucket(x) === bucket);
      if (grp.length < 3 || grp.length === total) continue;
      mk(base, { id: `${c.key}:${bucket}`, name, desc: `${desc} in ${c.name}.`, tier, units: grp, need: grp.length });
    }
  };
  for (const st of sets) chase({ key: `set:${st.id}`, name: st.name, kind: "set", color: mdFour(st.ink), plate: st.code, cards: st.cards, setId: st.id, open: { set: st.id } });
  for (const r of chases) {
    const kind = mdKindOf(r); if (kind === "set") continue; // "All of a set" is the set, which has its own
    chase({ key: `chase:${ruleKey(r)}`, name: r.label, kind, color: kind === "pokemon" ? "blue" : kind === "artist" ? "green" : "yellow", plate: mdPlate(kind, r, r.label), cards: ruleCards(r), open: { chase: r.id } });
  }
  // The Dex: each region (the Pokémon the wall's sets have from it), and how many Pokémon overall.
  const D = { chase: "Dex", sec: "dex", kind: "dex", color: "red", plate: "DEX" }, all = [...MD_SPECIES.values()];
  for (const [name, a, b] of MD_REGIONS) {
    const gs = []; for (let d = a; d <= b; d++) if (MD_SPECIES.has(d)) gs.push(MD_SPECIES.get(d));
    if (gs.length) mk(D, { id: `dex:${name.toLowerCase()}`, name: `${name} master`, desc: `Every ${name} Pokémon on the wall (${gs.length}).`, tier: "gold", units: gs, need: gs.length });
  }
  for (const n of [50, 151]) mk(D, { id: `dex:count${n}`, name: `${n} Pokémon`, desc: `Have a card for ${n} different Pokémon.`, tier: n >= 151 ? "gold" : "silver", units: all, need: n, noCards: true });
  // Across everything: collecting and trading (production's buying ones need purchases the wall doesn't have), and the hidden ones.
  const G = { chase: "Across everything", sec: "global", kind: "global", color: "yellow", plate: "★" };
  for (const n of [100, 500, 1000]) mk(G, { id: `g:own-${n}`, name: `${n.toLocaleString()} cards`, desc: `Own ${n.toLocaleString()} cards across your sets.`, tier: n >= 1000 ? "holo" : n >= 500 ? "gold" : "silver", units: cards, need: n, noCards: true });
  const H = (o) => mk(G, { hidden: true, ...o });
  const one = (id) => [mdCardById.get(id)].filter(Boolean);
  H({ id: "g:moonbreon", name: "Moonbreon", desc: "Umbreon VMAX, Evolving Skies #215.", tier: "holo", plate: "MOON", units: one("swsh7-215"), need: 1 });
  H({ id: "g:secret-agent", name: "Secret Agent", desc: "Dark Raichu, Team Rocket #83.", tier: "holo", plate: "RAICHU", units: one("base5-83"), need: 1 });
  H({ id: "g:fan-club", name: "Pikachu Fan Club", desc: "25 Pikachu cards.", tier: "gold", plate: "PIKA25", units: MD_SPECIES.get(25) || [], need: 25 });
  const kanto = []; for (let d = 1; d <= 151; d++) if (MD_SPECIES.has(d)) kanto.push(MD_SPECIES.get(d));
  H({ id: "g:gotta-catch", name: "Gotta Catch 'Em All", desc: "A card of every Pokémon from #1 to #151, across your whole collection.", tier: "holo", plate: "151", units: kanto, need: 151 });
  const newest = sets.slice().sort((a, b) => b.released - a.released)[0], first = sets.find((s) => s.id === "base1");
  if (first && newest && first !== newest) H({ id: "g:full-circle", name: "Full Circle", desc: `A card from Base Set and a card from the newest set (${newest.name}).`, tier: "silver", plate: "CIRCLE", units: [first.cards, newest.cards], need: 2 });
  H({ id: "g:first-pick", name: "First Pick", desc: "Card #1 from ten different sets.", tier: "silver", plate: "#1", units: sets.map((s) => s.cards.filter((x) => /^0*1$/.test(x.num))).filter((g) => g.length), need: 10 });
  H({ id: "g:last-page", name: "Last Page", desc: "The highest-numbered card in five different sets.", tier: "gold", plate: "LAST", units: sets.map((s) => { const ns = s.cards.filter((x) => /^\d+$/.test(x.num)); return ns.length ? [ns.reduce((a, b) => (Number(b.num) > Number(a.num) ? b : a))] : []; }).filter((g) => g.length), need: 5 });
  const stored = Object.values(mdStore);
  H({ id: "g:crown-collector", name: "Crown Collector", desc: "Earn five signature trophies.", tier: "gold", plate: "CROWN", haveN: stored.filter((t) => t.sig).length, need: 5, noCards: true });
  H({ id: "g:trophy-cabinet", name: "Trophy Cabinet", desc: "Earn 25 trophies of any kind.", tier: "holo", plate: "CABNET", haveN: stored.length, need: 25, noCards: true });
  const dn = mdTradesDone();
  for (const [n, name] of [[1, "First trade"], [5, "Trader"], [25, "Dealmaker"]]) mk(G, { id: `g:trade-${n}`, name, desc: `Finish ${n === 1 ? "a trade" : `${n} trades`}.`, tier: n >= 25 ? "gold" : n >= 5 ? "silver" : "bronze", haveN: dn.length, need: n, noCards: true, dates: dn.map((r) => r.doneAt || r.at || Date.now()) });
  return out;
}
// Earned: true now, or remembered (even if a card went out since, or the chase was taken off the wall).
let mdCache = null;
function mdSig() {
  let n = 0, h = 0;
  for (const c of cards) if (c.owned) { n++; h = (Math.imul(h, 31) + c.i) | 0; }
  return `${n}|${h}|${chases.map(ruleKey).join(",")}|${mdTradesDone().length}|${Object.keys(mdStore).length}`;
}
function medalList() {
  const sig = mdSig();
  if (mdCache?.sig === sig) return mdCache;
  const live = mdCompute(), ids = new Set(live.map((t) => t.id));
  for (const t of live) { const s = mdStore[t.id]; t.rank = s ? s.rank : ""; t.at = s ? s.at : null; if (s) t.earned = true; }
  for (const [id, s] of Object.entries(mdStore)) if (!ids.has(id)) live.push({ id, name: s.name, chase: s.chase, sec: s.sec || "global", kind: s.kind || "custom", color: s.color || "blue", plate: s.plate || "", tier: s.tier, sig: Boolean(s.sig), hidden: Boolean(s.hidden), earned: true, at: s.at, rank: s.rank, desc: "Earned earlier.", have: 1, goal: 1, noCards: true });
  const list = live.filter((t) => !t.hidden || t.earned); // hidden ones stay out of sight until earned
  const earned = list.filter((t) => t.earned).sort((a, b) => mdScore(b) - mdScore(a) || (b.at || 0) - (a.at || 0));
  mdCache = { sig, list, earned, hiddenLeft: live.length - list.length, byId: new Map(list.map((t) => [t.id, t])) };
  return mdCache;
}
// When a trophy earned quietly came true: the moment its last needed card came in.
function mdWhen(t) {
  const ds = [];
  if (t.dates) ds.push(...t.dates);
  else if (t.units) for (const u of t.units) {
    if (Array.isArray(u)) { let m = Infinity; for (const c of u) if (c.owned && c.got) m = Math.min(m, c.got); if (m < Infinity) ds.push(m); }
    else if (u.owned && u.got) ds.push(u.got);
  }
  ds.sort((a, b) => a - b);
  const v = ds[t.need - 1];
  return v ? Math.min(v, Date.now()) : Date.now();
}

// ----- earning: checked a beat after the wall changes; quietly on load, with a small celebration after that -----
let mdBooted = false, mdTimer = 0, mdQueue = [], mdImp = null;
const mdImported = () => { try { return localStorage.getItem("wall-imported"); } catch { return null; } };
function scheduleMedals() { if (!mdBooted) return; clearTimeout(mdTimer); mdTimer = setTimeout(() => checkMedals(false), 650); }
function checkMedals(quiet) {
  const imp = mdImported(), viaImport = !quiet && Boolean(imp) && imp !== mdImp; // the import just landed: its trophies arrive in one celebration
  mdImp = imp;
  const doorWas = mdDoorKey(), fresh = [];
  for (let pass = 0; pass < 3; pass++) { // a trophy can earn a trophy (Crown Collector, Trophy Cabinet)
    const now = medalList().list.filter((t) => t.earned && !mdStore[t.id]);
    if (!now.length) break;
    for (const t of now) {
      mdStore[t.id] = { at: quiet ? mdWhen(t) : Date.now(), rank: mdRoll(t.id), name: t.name, chase: t.chase, sec: t.sec, kind: t.kind, color: t.color, plate: t.plate, tier: t.tier, sig: Boolean(t.sig), hidden: Boolean(t.hidden) };
      fresh.push(t.id);
    }
  }
  if (!fresh.length) return [];
  mdPersist();
  const L = medalList(), got = fresh.map((id) => L.byId.get(id)).filter(Boolean);
  if (room.on || mdDoorKey() !== doorWas) { layoutAll(); kick(); } else kick();
  if (!quiet) { mdQueue.push(...got); mdQueue.via = viaImport ? "import" : mdQueue.via || ""; mdCelebrateSoon(); }
  drawList();
  setTimeout(mdWarm, 200);
  return got;
}
// Every place a count changes calls updateCount: that's the hook for checking.
function updateCount() {
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
  scheduleMedals();
}
setTimeout(() => { mdBooted = true; checkMedals(true); if (mdFirst) mdPersist(); mdWarm(); }, 0); // after the wall has started: what's already true is earned quietly

// ----- the medal artwork: production's medalSVG, for the page (sheet, list, celebration) and as an image for the room -----
function mdShape(shape, r, cx = 50, cy = 50) {
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
const mdEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let mdSvgN = 0;
// img: { col, surface, pw } draws a standalone SVG for an Image (colours filled in, no nameplate: the canvas letters it).
function medalSvg(t, { locked = false, dim = false, img = null, cls = "" } = {}) {
  const [hi, lo] = MD_TIERS[t.tier] || MD_TIERS.bronze;
  const shape = MD_SHAPE[t.kind] || "circle", k = t.color || "blue";
  const col = img ? img.col : `var(--c-${k})`, col2 = img ? mix(img.col, "#1B1D2E", 0.45) : `color-mix(in srgb, var(--c-${k}) 55%, #1B1D2E)`;
  const rank = locked ? "" : MD_RANK[t.rank] ? t.rank : "", g = `md${++mdSvgN}`;
  const rays = rank === "crit" ? Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, p = (q, da = 0) => `${(50 + Math.cos(a + da) * q).toFixed(1)} ${(50 + Math.sin(a + da) * q).toFixed(1)}`; return `<path d="M${p(40, -0.11)} L${p(49)} L${p(40, 0.11)} Z" fill="#FFCB05" stroke="#9A6A00" stroke-width=".6"/>`; }).join("") : "";
  const sparkle = (x, y, s, d) => `<path class="sparkle" style="animation-delay:${d}s" d="M${x} ${y - 7 * s} L${x + 2 * s} ${y - 2 * s} L${x + 7 * s} ${y} L${x + 2 * s} ${y + 2 * s} L${x} ${y + 7 * s} L${x - 2 * s} ${y + 2 * s} L${x - 7 * s} ${y} L${x - 2 * s} ${y - 2 * s} Z" fill="#FFF7B0" stroke="#C99A00" stroke-width=".8"/>`;
  const plate = !img && t.plate ? (() => { const w = Math.max(26, String(t.plate).length * 7.4 + 12); return `<rect x="${50 - w / 2}" y="61" width="${w}" height="15" rx="7.5" fill="rgb(0 0 0 / .66)"/><text x="50" y="72" text-anchor="middle" fill="#fff" font-size="10" font-weight="800" style="font-family:var(--font)">${mdEsc(t.plate)}</text>`; })() : "";
  const filt = locked || dim ? `<filter id="${g}f"><feColorMatrix type="saturate" values="${locked ? 0 : 0.4}"/></filter>` : "";
  const head = img ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 124" width="${img.pw}" height="${Math.round(img.pw * 1.24)}">`
    : `<svg class="medal ${cls} ${locked ? "locked" : ""} tier-${t.tier} ${rank ? `rank-${rank}` : ""}" viewBox="0 0 100 124" role="img" aria-label="${mdEsc(t.name)} ${locked ? "(not yet earned)" : `trophy${rank ? `, ${MD_RANK[rank]}` : ""}`}">`;
  return `${head}<defs>
    <linearGradient id="${g}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    <linearGradient id="${g}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF6B6B"/><stop offset=".25" stop-color="#FFD93D"/><stop offset=".5" stop-color="#6BCB77"/><stop offset=".75" stop-color="#4D96FF"/><stop offset="1" stop-color="#C77DFF"/></linearGradient>${filt}</defs>
    <g${filt ? ` filter="url(#${g}f)" opacity="${locked ? 0.42 : 0.72}"` : ""}>
    <path d="M30 70 L22 118 L38 108 L46 120 L52 76 Z" style="fill:${col}"/>
    <path d="M70 70 L78 118 L62 108 L54 120 L48 76 Z" style="fill:${col2}"/>
    ${rays}
    <path d="${mdShape(shape, 38)}" fill="url(#${g}${rank === "shiny" ? "h" : "g"})"/>
    <path d="${mdShape(shape, 33.5)}" fill="none" stroke="rgb(255 255 255 / .55)" stroke-width="2"/>
    <path d="${mdShape(shape, 29)}" fill="${img ? img.surface : "var(--m-surface)"}"/>
    <path d="M50 29 L56.5 43.5 L72 45 L60.5 55.5 L63.8 71 L50 63 L36.2 71 L39.5 55.5 L28 45 L43.5 43.5 Z" fill="url(#${g}g)"/>
    <path d="${mdShape(shape, 28.5)}" fill="none" stroke="${lo}" stroke-width="1.5" opacity=".6"/>
    ${plate}
    ${t.hidden ? (() => { const hx = rank === "crit" ? 18 : 82; return `<circle cx="${hx}" cy="14" r="10" fill="#6B3FD1" stroke="#FFFFFF" stroke-width="2"/><text x="${hx}" y="18.5" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui, sans-serif" fill="#FFFFFF">?</text>`; })() : ""}
    ${t.sig ? `<path d="M38 13 L42 4 L46 10 L50 2 L54 10 L58 4 L62 13 Z" fill="#FFCB05" stroke="#9A6A00" stroke-width="1.2" stroke-linejoin="round"/><circle cx="50" cy="2.8" r="1.6" fill="#E3350D"/>` : ""}
    ${rank === "crit" ? `<path d="M84 8 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="#FFCB05" stroke="#9A6A00" stroke-width="1"/>` : ""}
    ${rank === "shiny" ? sparkle(14, 20, 1.2, 0) + sparkle(88, 34, 1, 0.5) + sparkle(76, 92, 0.9, 1) : ""}
    </g></svg>`;
}
// Rasterized once: one decoded SVG image per look (shared by every trophy that looks the same) and one small canvas
// per trophy, size, dpr and theme with its nameplate lettered on. Never per frame.
const mdLooks = new Map(), mdImgs = new Map();
function mdLook(t, mode, pw) {
  const dark = theme.dark, col = (dark ? MD_FOUR.dark : MD_FOUR.light)[t.color] || MD_FOUR.light.blue;
  const rank = mode === "locked" ? "" : MD_RANK[t.rank] ? t.rank : "";
  const key = `${t.kind}|${t.tier}|${col}|${rank}|${t.sig ? 1 : 0}|${t.hidden ? 1 : 0}|${mode}|${pw}|${dark ? 1 : 0}`;
  let e = mdLooks.get(key); if (e) return e;
  e = { cv: null, waiting: [] }; mdLooks.set(key, e);
  const im = new Image();
  im.onload = () => { // rasterized once, here; every trophy that looks like this copies the bitmap
    const cv = document.createElement("canvas"); cv.width = pw; cv.height = Math.round(pw * 1.24);
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    e.cv = cv; const w = e.waiting; e.waiting = null; for (const f of w) f();
  };
  im.onerror = () => { e.waiting = null; };
  im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(medalSvg(t, { locked: mode === "locked", dim: mode === "dim", img: { col, surface: dark ? "#20222E" : "#FFFDF6", pw } }));
  return e;
}
function medalImg(t, w, mode = "") {
  const pw = Math.max(8, Math.round(w * dpr)), key = `${t.id}|${pw}|${mode}|${t.rank || ""}|${theme.dark ? 1 : 0}`;
  const have = mdImgs.get(key); if (have) return have.cv;
  if (mdImgs.size > 900) mdImgs.clear();
  const L = mdLook(t, mode, pw), e = { cv: null }; mdImgs.set(key, e);
  const make = () => {
    const cv = document.createElement("canvas"); cv.width = pw; cv.height = Math.round(pw * 1.24);
    const x = cv.getContext("2d"); x.drawImage(L.cv, 0, 0);
    if (t.plate && w >= 34) { // the nameplate, lettered in Archivo
      const s = pw / 100; x.globalAlpha = mode === "locked" ? 0.42 : mode === "dim" ? 0.72 : 1;
      fontOn(x, 800, 10 * s); const tw = x.measureText(t.plate).width, rw = Math.max(26 * s, tw + 11 * s);
      rrOn(x, 50 * s - rw / 2, 61 * s, rw, 15 * s, 7.5 * s); x.fillStyle = "rgb(0 0 0 / .66)"; x.fill();
      x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText(t.plate, 50 * s, 72 * s);
    }
    e.cv = cv; kick();
  };
  if (L.cv) { make(); return e.cv; }
  if (L.waiting) L.waiting.push(make);
  return null;
}
// Ahead of the room opening: the showcase, the door's row and the first shelves get their images while nothing moves.
// Every look is decoded in the background (a few dozen small SVGs); the per-trophy copies are made a handful at a time.
function mdWarm() {
  if (!mdBooted || !roomHas()) return;
  const L = medalList(), px = (w) => Math.max(8, Math.round(w * dpr)), jobs = [];
  for (const t of L.list) { mdLook(t, t.earned ? "" : "locked", px(MD_GW)); if (!t.earned && t.goal > 1) mdLook(t, "dim", px(MD_NW)); }
  for (const t of L.earned.slice(0, 16)) jobs.push(() => medalImg(t, MD_DW), () => medalImg(t, MD_SW));
  for (const t of L.list) jobs.push(() => medalImg(t, MD_GW, t.earned ? "" : "locked"));
  clearTimeout(mdWarm.t);
  const step = () => { const end = performance.now() + 4; while (jobs.length && performance.now() < end) jobs.shift()(); if (jobs.length) mdWarm.t = setTimeout(step, 30); };
  mdWarm.t = setTimeout(step, 60);
}

// ----- the room: the plaques, and production's Medal tab laid out on its shelves -----
const MD_GW = 54, MD_SW = 68, MD_NW = 38, MD_DW = 21, MD_NH = 62;
const MD_GH = Math.round(MD_GW * 1.24) + 72, MD_SH = Math.round(MD_SW * 1.24) + 74; // a medal standing on its shelf, its label under the shelf's edge
const MD_FILTERS = [["all", "All"], ["earned", "Earned"], ["locked", "To earn"], ["crit", "Critical"], ["shiny", "Shiny"]];
let mdFilter = "all", mdFold = false;
const mdBlocks = new Map(); // stable tap targets, so the press shows on the thing under the finger
const mdBlock = (key, o) => { let b = mdBlocks.get(key); if (!b) { b = { md: true, lead: [], cards: [] }; mdBlocks.set(key, b); } return Object.assign(b, o); };
const mdEarnedN = () => Object.keys(mdStore).length;
const roomHas = () => mode === "set" && (caseList().length > 0 || mdEarnedN() > 0);
const mdDoorKey = () => `${caseList().length > 0}|${mdEarnedN() > 0}`;
const mdShow = (t) => mdFilter === "all" || (mdFilter === "earned" && t.earned) || (mdFilter === "locked" && !t.earned) || (mdFilter === "crit" && t.earned && t.rank === "crit") || (mdFilter === "shiny" && t.earned && t.rank === "shiny");
function roomLayout() {
  const dn = caseList(), W = Math.min(vw, 760), R = { x: (vw - W) / 2 + 8, w: W - 16 }, L = medalList(), items = [];
  const gcols = R.w >= 700 ? 8 : R.w >= 520 ? 6 : 4, gw = R.w / gcols;
  const y0 = topPad();
  let y = y0;
  const headH = dn.length ? 140 : 62;
  items.push({ type: "header", x: R.x, y, w: R.w, h: headH }); y += headH;
  const head = (text, right, dot = null, gap = 8) => { y += gap; items.push({ type: "head", x: R.x, y, w: R.w, h: 30, text, right, dot }); y += 30; };
  // The showcase: the rarest you've earned, on a lit shelf.
  if (L.earned.length) {
    const sh = L.earned.filter((t) => t.rank === "shiny").length, cr = L.earned.filter((t) => t.rank === "crit").length;
    head("Showcase", `${sh ? `${sh} shiny · ` : ""}${cr} critical`, null, 4);
    const n = gcols >= 6 ? 6 : 4, cw = R.w / n;
    items.push({ type: "shelf", x: R.x, y: y + 6 + Math.min(MD_SW, cw - 16) * 1.24 - 5, w: R.w, h: 8 });
    L.earned.slice(0, n).forEach((t, i) => items.push({ type: "tile", big: true, t, x: R.x + i * cw, y, w: cw, h: MD_SH, blk: mdBlock(`sc|${t.id}`, { mdt: t }) }));
    y += MD_SH;
  }
  // The plaques: finished sets and chases, sealed (round 16's room, unchanged).
  const cols = R.w >= 560 ? 2 : 1, cw = R.w / cols, rows = [];
  if (dn.length) {
    head("Finished", `${dn.length} sealed`);
    for (let i = 0; i < dn.length; i += cols) {
      const row = dn.slice(i, i + cols), fan = row.find((g) => g === room.fan), h = ROW_H + (fan ? stackOf(fan).length * SUB_H : 0);
      row.forEach((g, j) => {
        g.m = { x: R.x + j * cw, y, w: cw, h: ROW_H }; g.plq = plaqueInfo(g); packRoomPlaque(g);
        g.fanR = stackOf(g).length ? { x: g.m.x + g.m.w - PG - 12 - 150, y: g.m.y + 8, w: 150, h: 34 } : null;
        g.fanBtn ||= { fan: g, lead: [], cards: [] };
        if (g === room.fan) fanRows(g).forEach((r, k) => { r.m = { x: g.m.x, y: y + ROW_H + k * SUB_H, w: cw, h: SUB_H }; });
      });
      rows.push({ y: y + h - SHELF_H - 4, h: SHELF_H });
      y += h;
    }
  }
  // Next up: the closest to being earned.
  const next = L.list.filter((t) => !t.earned && t.goal > 1).map((t) => ({ t, left: t.goal - t.have, frac: t.have / t.goal })).filter((x) => x.left > 0).sort((a, b) => b.frac - a.frac || a.left - b.left).slice(0, 4);
  if (next.length) {
    head("Next up", "");
    for (const x of next) { items.push({ type: "nu", ...x, x: R.x, y, w: R.w, h: MD_NH, blk: mdBlock(`nu|${x.t.id}`, { mdt: x.t }) }); y += MD_NH + 8; }
  }
  // The filters, then a shelf per chase.
  y += 10;
  let cx = R.x;
  for (const [v, label] of MD_FILTERS) {
    font(600, 13.5); const w = textW(label) + 28;
    if (cx + w > R.x + R.w) { cx = R.x; y += 40; }
    items.push({ type: "chip", label, on: mdFilter === v, x: cx, y, w, h: 32, blk: mdBlock(`tf|${v}`, { mdf: v }) });
    cx += w + 8;
  }
  y += 44;
  const secs = new Map();
  for (const t of L.list) { if (!secs.has(t.sec)) secs.set(t.sec, { name: t.chase, color: t.color, all: [], ts: [] }); const s = secs.get(t.sec); s.all.push(t); if (mdShow(t)) s.ts.push(t); }
  const shown = [...secs.values()].filter((s) => s.ts.length).sort((a, b) => (a.name === "Across everything") - (b.name === "Across everything") || b.all.filter((t) => t.earned).length - a.all.filter((t) => t.earned).length);
  const started = shown.filter((s) => s.all.some((t) => t.earned)), notYet = shown.filter((s) => !s.all.some((t) => t.earned));
  const shelfOf = (s) => {
    head(s.name, `${s.all.filter((t) => t.earned).length} of ${s.all.length}`, s.color, 6);
    const ts = s.ts.slice().sort((a, b) => b.earned - a.earned || mdScore(b) - mdScore(a));
    for (let i = 0; i < ts.length; i += gcols) {
      items.push({ type: "shelf", x: R.x, y: y + 6 + Math.min(MD_GW, gw - 14) * 1.24 - 5, w: R.w, h: 8 });
      ts.slice(i, i + gcols).forEach((t, j) => items.push({ type: "tile", t, x: R.x + j * gw, y, w: gw, h: MD_GH, blk: mdBlock(`g|${t.id}`, { mdt: t }) }));
      y += MD_GH;
    }
  };
  started.forEach(shelfOf);
  if (notYet.length) {
    y += 8; items.push({ type: "fold", x: R.x, y, w: R.w, h: 48, n: notYet.length, open: mdFold, blk: mdBlock("fold", { mdfold: true }) }); y += 56;
    if (mdFold) notYet.forEach(shelfOf);
  }
  if (!shown.length) { y += 6; items.push({ type: "note", x: R.x, y, w: R.w, h: 64, title: mdFilter === "shiny" ? "No shiny trophies yet" : mdFilter === "crit" ? "No critical trophies yet" : "Nothing here yet", text: mdFilter === "shiny" || mdFilter === "crit" ? "Luck is decided when a trophy is earned. Keep collecting." : "Mark a few cards and your first trophies appear." }); y += 70; }
  y += 18;
  items.push({ type: "note", x: R.x, y, w: R.w, h: 120, title: "How trophies work", text: "Each set and chase earns its own trophies as you fill it, named for the kind of chase. A gold crown marks a signature trophy, something one set or chase uniquely offers. Hidden ones don't show until you earn them, then wear a purple question mark. Luck is rolled once, when a trophy is earned: about 1 in 10 come up Critical, with a gold starburst, and about 1 in 100 Shiny, with a rainbow rim. It stays with the trophy for good." });
  y += 120;
  room.L = { R, cols, rows, y0, items, headH, L };
  mMax = Math.max(0, y + botPad() + 10 - vh);
  mScroll = clamp(mScroll, 0, mMax);
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
// The door at the end of the wall: its line counts the trophies too, with the rarest as a row of small medals.
function caseLayout(R, y) {
  const dn = caseList(), n = mdEarnedN();
  room.slots = [];
  if (mode !== "set" || (!dn.length && !n)) { trophyCase = null; DOOR.m = null; return 0; }
  const H = (dn.length ? DOOR_H : 44) + (n ? 30 : 0);
  trophyCase = { x: R.x, y, w: R.w, h: H, minis: n > 0 }; DOOR.m = trophyCase; if (dn.length) caseSeries();
  const k = dn.length, gap = 5, x0 = R.x + PG + 12, w = R.w - PG * 2 - 24, sw = (w - gap * (k - 1)) / Math.max(1, k), ey = y + H - PG - 17;
  dn.forEach((g, i) => { const m = { x: x0 + i * (sw + gap), y: ey, w: sw, h: ENGR_H }; room.slots.push({ g, ...m }); g.plq = plaqueInfo(g); if (!room.on) { g.m = m; packStrip(g, m); } });
  return H;
}
function drawDoor(now, alpha) {
  const t = trophyCase; if (!t || state.trans) return;
  const m = mr(t); if (m.y > vh || m.y + m.h < 0) return;
  const x = m.x + PG, y = m.y + PG, w = m.w - PG * 2, h = m.h - PG * 2, plaques = room.slots.length, n = mdEarnedN();
  ctx.globalAlpha = alpha;
  rr(x, y, w, h, 12); ctx.fillStyle = theme.door; ctx.fill();
  ctx.save(); rr(x, y, w, h, 12); ctx.clip(); ctx.fillStyle = theme["door-hi"]; ctx.fillRect(x, y, w, 1.5); ctx.restore();
  if (state.press?.g === DOOR) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; rr(x, y, w, h, 12); ctx.stroke(); }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "right"; ctx.fillStyle = theme["door-muted"]; font(600, 13);
  const s = plaques ? room.sum || caseSeries() : null;
  const stat = `${n} ${n === 1 ? "trophy" : "trophies"}${plaques ? ` · ${plaques} sealed · ${short(s.worth)}` : ""}  ›`;
  ctx.fillText(stat, x + w - 12, y + 22);
  const sw = textW(stat);
  ctx.textAlign = "left"; ctx.fillStyle = theme["door-ink"]; font(800, 15.5, true); ctx.fillText(fitText("Trophy room", w - sw - 32), x + 12, y + 22);
  if (t.minis) { // the rarest, standing in a row
    const E = medalList().earned, step = MD_DW + 6, fit = Math.floor((w - 24 + 6) / step);
    for (let i = 0; i < Math.min(fit, E.length); i++) { const im = medalImg(E[i], MD_DW); if (im) ctx.drawImage(im, x + 12 + i * step, y + 31, MD_DW, MD_DW * 1.24); }
  }
  for (const sl of room.slots) { ctx.fillStyle = "rgb(0 0 0 / .35)"; ctx.fillRect(sl.x - 1, sl.y - mScroll - 1, sl.w + 2, sl.h + 2); ctx.drawImage(engravingOf(sl.g, sl.w, sl.h), sl.x, sl.y - mScroll, sl.w, sl.h); }
  ctx.globalAlpha = 1;
}
function drawRoom(now, alpha = 1, except = null) {
  const L = room.L; if (!L) return;
  live.line = null;
  ctx.globalAlpha = alpha; ctx.fillStyle = theme["room-bg"]; ctx.fillRect(0, 0, vw, vh);
  const R = L.R;
  for (const row of L.rows) {
    const y = row.y - mScroll; if (y > vh || y + row.h < 0) continue;
    mdWood(R.x, y, R.w, row.h);
  }
  for (const g of caseList()) {
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h + (g === room.fan ? stackOf(g).length * SUB_H : 0) - mScroll < 0) continue;
    drawPanel(g, now, alpha);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha);
  }
  ctx.globalAlpha = alpha;
  for (const it of L.items) {
    const y = it.y - mScroll; if (y > vh || y + it.h < 0) continue;
    const pressed = it.blk && state.press?.g === it.blk;
    switch (it.type) {
      case "header": ctx.drawImage(mdHeaderImage(R.w, it.h), R.x - PADR, y - PADR, R.w + PADR * 2, it.h + PADR * 2); break;
      case "head": mdDrawHead(it, y); break;
      case "shelf": mdWood(it.x, y, it.w, it.h); break;
      case "tile": mdDrawTile(it, y, pressed); break;
      case "nu": mdDrawNext(it, y, pressed); break;
      case "chip": mdDrawChip(it, y, pressed); break;
      case "fold": mdDrawFold(it, y, pressed); break;
      case "note": mdDrawNote(it, y); break;
    }
  }
  ctx.globalAlpha = 1; ctx.textAlign = "left";
}
function mdWood(x, y, w, h) {
  ctx.fillStyle = theme["room-wood"]; ctx.fillRect(x - 6, y, w + 12, h);
  ctx.fillStyle = theme["room-wood-hi"]; ctx.fillRect(x - 6, y, w + 12, 1.5);
  ctx.fillStyle = "rgb(0 0 0 / .35)"; ctx.fillRect(x - 6, y + h, w + 12, 5);
}
function mdHeaderImage(w, h) {
  const L = room.L.L, dn = caseList(), s = dn.length ? room.sum || caseSeries() : null;
  const sum = `${L.earned.length} of ${L.list.length} trophies`, hid = L.hiddenLeft ? `${L.hiddenLeft} hidden left to find` : "";
  return cachedImage(room, `md|${Math.round(w)}|${h}|${sum}|${hid}|${s ? s.key : ""}|${look()}`, w, h, (x) => {
    x.textBaseline = "alphabetic"; x.textAlign = "left"; x.fillStyle = theme["room-ink"]; fontOn(x, 800, 26, true);
    x.fillText("Trophy room", 10, 30);
    fontOn(x, 600, 13); x.fillStyle = theme["room-muted"]; x.fillText(sum, 10, 50);
    if (hid) { const sw = x.measureText(`${sum} · `).width; x.fillText(" · ", 10 + x.measureText(sum).width, 50); x.fillStyle = "#C3A8FF"; x.fillText(hid, 10 + sw, 50); }
    if (!s) return;
    x.textAlign = "right"; x.fillStyle = theme["room-ink"]; fontOn(x, 800, 22); x.fillText(short(s.worth), w - 10, 30);
    x.textAlign = "left"; x.fillStyle = theme["room-muted"]; fontOn(x, 600, 12.5);
    x.fillText(`${s.n} finished and sealed`, 10, 72);
    x.textAlign = "right"; x.fillStyle = s.delta >= 0 ? theme["room-up"] : theme["room-down"]; x.fillText(deltaText(s.delta), w - 10, 72);
    drawWorthLine(x, s.pts, 10, 82, w - 20, 36, theme["room-plaque"], "rgb(230 192 80 / .12)");
    x.fillStyle = theme["room-muted"]; fontOn(x, 500, 10.5); x.textAlign = "left"; x.fillText("A year ago", 10, 132); x.textAlign = "right"; x.fillText("Now", w - 10, 132);
  });
}
function mdDrawHead(it, y) {
  ctx.textBaseline = "alphabetic";
  let x = it.x + 4;
  if (it.dot) { ctx.beginPath(); ctx.arc(x + 4, y + 18, 4, 0, Math.PI * 2); ctx.fillStyle = MD_FOUR.dark[it.dot] || MD_FOUR.dark.blue; ctx.fill(); x += 14; }
  font(600, 12.5); const rw = it.right ? textW(it.right) + 12 : 0;
  ctx.textAlign = "right"; ctx.fillStyle = theme["room-muted"]; if (it.right) ctx.fillText(it.right, it.x + it.w - 4, y + 22);
  ctx.textAlign = "left"; ctx.fillStyle = theme["room-ink"]; font(800, 16, true); ctx.fillText(fitText(it.text, it.w - rw - (x - it.x) - 4), x, y + 22);
}
const mdWrapCache = new Map();
function mdWrap(text, w, max) {
  const key = `${curFont}|${Math.round(w)}|${max}|${text}`;
  let v = mdWrapCache.get(key); if (v) return v;
  const words = text.split(" "), lines = [];
  let cur = "";
  for (const wd of words) {
    const t = cur ? `${cur} ${wd}` : wd;
    if (ctx.measureText(t).width <= w || !cur) cur = t; else { lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  v = lines.length > max ? [...lines.slice(0, max - 1), fitText(lines.slice(max - 1).join(" "), w)] : lines.map((l) => (ctx.measureText(l).width > w ? fitText(l, w) : l));
  if (mdWrapCache.size > 3000) mdWrapCache.clear();
  mdWrapCache.set(key, v); return v;
}
const mdDate = (at) => { const d = new Date(at), y = d.getFullYear() !== new Date().getFullYear(); return d.toLocaleDateString("en-US", y ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" }); };
const mdStatus = (t) => (t.earned ? (t.at ? mdDate(t.at) : "Earned") : t.goal > 1 ? `${t.goal - t.have} to go` : "Locked");
const mdPills = new Map();
function mdPill(rank) { // the Critical and Shiny tags, drawn once
  const key = `${rank}|${dpr}`; let cv = mdPills.get(key); if (cv) return cv;
  const w = rank === "shiny" ? 46 : 58, h = 16; cv = document.createElement("canvas"); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  const x = cv.getContext("2d"); x.scale(dpr, dpr);
  rrOn(x, 0.5, 0.5, w - 1, h - 1, 8);
  if (rank === "shiny") { const gr = x.createLinearGradient(0, 0, w, 0); ["#FFD6D6", "#FFF3B0", "#D3F5DC", "#D2E4FF", "#EBD6FF"].forEach((c, i) => gr.addColorStop(i / 4, c)); x.fillStyle = gr; x.strokeStyle = "#8A6BE0"; }
  else { x.fillStyle = "#FFF1B8"; x.strokeStyle = "#C99A00"; }
  x.fill(); x.lineWidth = 1; x.stroke();
  x.fillStyle = rank === "shiny" ? "#2A1F4D" : "#4A3500"; fontOn(x, 800, 9.5); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(MD_RANK[rank].toUpperCase(), w / 2, h / 2 + 0.5);
  mdPills.set(key, { cv, w, h }); return mdPills.get(key);
}
function mdDrawTile(it, y, pressed) {
  const t = it.t, mw = it.big ? Math.min(MD_SW, it.w - 16) : Math.min(MD_GW, it.w - 14), mh = mw * 1.24, cx = it.x + it.w / 2;
  if (pressed) { rr(it.x + 3, y + 1, it.w - 6, it.h - 4, 10); ctx.fillStyle = "rgb(255 236 210 / .1)"; ctx.fill(); }
  const im = medalImg(t, mw, t.earned ? "" : "locked");
  if (im) ctx.drawImage(im, cx - mw / 2, y + 6, mw, mh);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  font(t.earned ? 700 : 500, it.big ? 13 : 12, true); ctx.fillStyle = t.earned ? theme["room-ink"] : theme["room-muted"];
  let ty = y + 6 + mh + 24;
  for (const ln of mdWrap(t.name, it.w - 8, 2)) { ctx.fillText(ln, cx, ty); ty += 13.5; }
  if (mdLucky(t)) { const p = mdPill(t.rank); ctx.drawImage(p.cv, cx - p.w / 2, ty - 10, p.w, p.h); }
  else { font(500, 11); ctx.fillStyle = theme["room-muted"]; ctx.fillText(mdStatus(t), cx, ty + 1); }
  ctx.textAlign = "left";
}
function mdDrawNext(it, y, pressed) {
  const t = it.t;
  rr(it.x, y, it.w, it.h, 10); ctx.fillStyle = pressed ? "rgb(255 236 210 / .12)" : "rgb(255 236 210 / .05)"; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgb(255 236 210 / .14)"; ctx.stroke();
  const im = medalImg(t, MD_NW, "dim"); if (im) ctx.drawImage(im, it.x + 10, y + (it.h - MD_NW * 1.24) / 2, MD_NW, MD_NW * 1.24);
  const tx = it.x + 60, tw = it.w - 60 - 72;
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  font(700, 14.5, true); ctx.fillStyle = theme["room-ink"]; ctx.fillText(fitText(t.name, tw), tx, y + 22);
  font(500, 12); ctx.fillStyle = theme["room-muted"]; ctx.fillText(fitText(t.chase, tw), tx, y + 38);
  ctx.fillStyle = "rgb(255 255 255 / .12)"; ctx.fillRect(tx, y + 46, tw, 4);
  ctx.fillStyle = MD_FOUR.dark[t.color] || MD_FOUR.dark.blue; ctx.fillRect(tx, y + 46, tw * it.frac, 4);
  ctx.textAlign = "center"; ctx.fillStyle = theme["room-ink"]; font(800, 20); ctx.fillText(String(it.left), it.x + it.w - 36, y + 31);
  font(500, 11); ctx.fillStyle = theme["room-muted"]; ctx.fillText("to go", it.x + it.w - 36, y + 46);
  ctx.textAlign = "left";
}
function mdDrawChip(it, y, pressed) {
  rr(it.x + 0.5, y + 0.5, it.w - 1, it.h - 1, 16);
  if (it.on) { ctx.fillStyle = theme["room-ink"]; ctx.fill(); }
  else { ctx.fillStyle = pressed ? "rgb(255 236 210 / .14)" : "rgb(255 236 210 / .04)"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgb(255 236 210 / .26)"; ctx.stroke(); }
  ctx.fillStyle = it.on ? theme["room-bg"] : theme["room-ink"]; font(600, 13.5); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(it.label, it.x + it.w / 2, y + 21); ctx.textAlign = "left";
}
function mdDrawFold(it, y, pressed) {
  rr(it.x, y, it.w, it.h, 10); ctx.fillStyle = pressed ? "rgb(255 236 210 / .12)" : "rgb(255 236 210 / .05)"; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgb(255 236 210 / .14)"; ctx.stroke();
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["room-ink"]; font(700, 14.5, true); ctx.fillText("Not started yet", it.x + 14, y + 29);
  ctx.textAlign = "right"; ctx.fillStyle = theme["room-muted"]; font(600, 12.5); ctx.fillText(`${it.n} ${it.n === 1 ? "chase" : "chases"} ${it.open ? "▴" : "▾"}`, it.x + it.w - 14, y + 29);
  ctx.textAlign = "left";
}
function mdDrawNote(it, y) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  font(700, 13); ctx.fillStyle = theme["room-ink"]; ctx.fillText(it.title, it.x + 4, y + 16);
  font(500, 12.5); ctx.fillStyle = theme["room-muted"];
  let ty = y + 34; for (const ln of mdWrap(it.text, it.w - 8, 8)) { ctx.fillText(ln, it.x + 4, ty); ty += 16; }
}
// A tap in the room: medals, filters and the fold first, then the plaques as before.
function hit(sx, sy, nearest = false) {
  if (state.trans) return null;
  if (view === "mosaic") {
    if (room.on && room.closing) return null;
    if (room.on && room.anim) finishRoomAnim();
    const y = sy + mScroll;
    if (room.on) {
      for (const it of room.L?.items || []) if (it.blk && inR(it, sx, y)) return { block: it.blk };
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
  if (g.md) { mdTap(g); return; }
  if (g.tbCover) { openBinder(); return; }
  if (g.door) { openRoom(); return; }
  if (g.fan) { toggleFan(g.fan); return; }
  if (g.pick) { openScope(g.pick.g, g.pick.scope); return; }
  hideCaption(); tick(8);
  state.trans = openTrans(g, 0, fitCam(g)); state.trans.then = then;
  settle(1, 720);
}
function mdTap(b) {
  if (b.mdt) { openMedal(b.mdt.id); return; }
  tick(4);
  if (b.mdf) { mdFilter = b.mdf; layoutAll(); kick(); return; }
  if (b.mdfold) { mdFold = !mdFold; layoutAll(); kick(); }
}

// ----- the trophy card: what it's for and the cards behind it (production's trophy sheet) -----
const mdSheet = document.createElement("div");
mdSheet.className = "msheet glass"; mdSheet.id = "msheet"; mdSheet.setAttribute("role", "dialog"); mdSheet.setAttribute("aria-modal", "true"); mdSheet.setAttribute("aria-labelledby", "ms-name"); mdSheet.inert = true;
const mdScrim = document.createElement("div"); mdScrim.className = "ms-scrim";
document.body.append(mdScrim, mdSheet);
let mdOpenId = null;
function mdCardsOf(t) {
  if (t.noCards || !t.units) return [];
  const list = t.units.map((u) => (Array.isArray(u) ? u.find((c) => c.owned) || u[0] : u)).filter(Boolean);
  return [...new Set(list)].sort((a, b) => Number(a.owned) - Number(b.owned) || a.si - b.si || a.n0 - b.n0);
}
function openMedal(id) {
  const t = medalList().byId.get(id); if (!t) return;
  mdOpenId = id; tick(5); cancelPress();
  const lucky = mdLucky(t), cs = mdCardsOf(t), MAX = 24, have = cs.filter((c) => c.owned).length, groupsU = t.units && t.units.some((u) => Array.isArray(u));
  const openable = t.open && mode === "set" && mdGroupOf(t.open);
  mdSheet.innerHTML = `<div class="ms-scroll">
      <div class="ms-medal${t.earned ? "" : " locked"}">${medalSvg(t, { locked: !t.earned, cls: "big" })}</div>
      ${lucky ? `<p class="rank-tag ${t.rank} big">${t.rank === "shiny" ? "Shiny · 1 in 100" : "Critical · 1 in 10"}</p>` : ""}
      <h2 id="ms-name">${mdEsc(t.name)}</h2>
      <p class="ms-chase">${mdEsc(t.chase)}${t.sig ? " · signature" : ""}${t.hidden ? " · hidden" : ""}</p>
      <p class="ms-desc">${mdEsc(t.desc || "")}</p>
      ${cs.length ? `<p class="ms-count">${groupsU ? `${have} of ${cs.length} groups` : `${have} of ${cs.length} cards`} · tap a card to go to it</p>
      <div class="ms-cards">${cs.slice(0, MAX).map((c) => { const st = sets[c.si]; return `<button type="button" class="ms-card${c.owned ? " own" : ""}" data-ci="${c.i}" style="--tc:${typeColor(c)}" aria-label="${mdEsc(`${c.name}, ${st.name} ${c.num}, ${c.owned ? "owned" : "missing"}`)}"><span class="ms-face"><b>${mdEsc(c.name)}</b><small>${mdEsc(st.code)} ${mdEsc(c.num)}</small></span>${c.owned ? `<i class="ms-check" aria-hidden="true">✓</i>` : ""}</button>`; }).join("")}</div>
      ${cs.length > MAX ? `<p class="ms-more">and ${cs.length - MAX} more${openable ? " in the binder" : ""}.</p>` : ""}` : ""}
      <p class="ms-when">${t.earned ? `Earned${t.at ? ` ${new Date(t.at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}.${t.rank === "normal" ? " Its luck roll came up plain." : ""}` : t.goal > 1 ? `${t.goal - t.have} more to go.` : "Not earned yet."}</p>
    </div>
    <div class="ms-foot">${openable ? `<button type="button" class="mbtn" data-ms-open>Open the binder</button>` : ""}<button type="button" class="mbtn primary" data-ms-close>Close</button></div>`;
  mdSheet.inert = false; document.body.classList.add("medaling");
  requestAnimationFrame(() => mdSheet.querySelector("[data-ms-close]")?.focus({ preventScroll: true }));
}
function closeMedal() {
  if (mdSheet.inert) return;
  mdSheet.inert = true; document.body.classList.remove("medaling"); mdOpenId = null; kick();
}
function mdGroupOf(open) {
  if (open.set) return groups.find((g) => g.set?.id === open.set) || null;
  if (open.chase) return chaseGroups.get(open.chase) && groups.includes(chaseGroups.get(open.chase)) ? chaseGroups.get(open.chase) : null;
  return null;
}
// Going to a card (or a binder) from the sheet: out of the room unless it's a sealed album in the room, into its set.
function mdGo(g, c = null) {
  closeMedal();
  if (document.body.classList.contains("listmode")) setListMode(false);
  if (!g || tbl.on || bnd.on || wel.on) return;
  if (state.trans) finishTransition();
  if (view === "set") { if (state.g === g) { if (c) focus(c); return; } if (state.focus) unfocus(); view = "mosaic"; state.g = null; setChrome(); }
  if (room.on && !inCase(g)) closeRoom(true);
  enterGroup(g, { then: c ? () => focus(c) : null });
}
mdSheet.addEventListener("click", (e) => {
  if (e.target.closest("[data-ms-close]")) { closeMedal(); return; }
  if (e.target.closest("[data-ms-open]")) { const t = medalList().byId.get(mdOpenId); if (t?.open) mdGo(mdGroupOf(t.open)); return; }
  const b = e.target.closest("[data-ci]"); if (!b) return;
  const c = pool[Number(b.dataset.ci)]; if (!c) return;
  const g = groups[c.g]?.cards.includes(c) ? groups[c.g] : groups.find((x) => x.cards.includes(c));
  tick(4); mdGo(g, c);
});
mdScrim.addEventListener("click", () => closeMedal());
addEventListener("keydown", (e) => { if (e.key === "Escape" && !mdSheet.inert) { e.preventDefault(); e.stopImmediatePropagation(); closeMedal(); } }, true);

// ----- earning one: a toast-sized card, the medal popping in (with the Critical or Shiny look when the roll says so) -----
const mdPop = document.createElement("button");
mdPop.type = "button"; mdPop.className = "mpop glass"; mdPop.id = "mpop"; mdPop.setAttribute("aria-live", "polite"); mdPop.tabIndex = -1;
document.body.append(mdPop);
let mdPopT = 0, mdPopList = [];
function mdCelebrateSoon() {
  clearTimeout(mdCelebrateSoon.t);
  if (wel.on || tbl.on || document.body.classList.contains("welcoming")) { mdCelebrateSoon.t = setTimeout(mdCelebrateSoon, 1200); return; }
  const list = mdQueue.splice(0), via = mdQueue.via; mdQueue.via = "";
  if (list.length) mdCelebrate(list, via);
}
function mdCelebrate(fresh, via) {
  const top = fresh.slice().sort((a, b) => mdScore(b) - mdScore(a)), one = top.length === 1, t = top[0];
  const shiny = top.some((x) => x.rank === "shiny"), crit = top.some((x) => x.rank === "crit");
  mdPopList = top;
  const kicker = via === "import" ? "Your collection arrived" : shiny ? "A shiny appeared" : crit ? "Critical" : one ? "New trophy" : "New trophies";
  mdPop.className = `mpop glass${shiny ? " shiny" : crit ? " crit" : ""}${one ? "" : " many"}`;
  mdPop.innerHTML = one
    ? `<span class="mp-medal">${medalSvg(t)}</span><span class="mp-text"><small class="mp-kick">${kicker}</small><b>${mdEsc(t.name)}</b><span>${mdEsc(t.chase)}${mdLucky(t) ? (t.rank === "shiny" ? " · a 1 in 100 roll" : " · a 1 in 10 roll") : ""}</span></span>`
    : `<span class="mp-row">${top.slice(0, 4).map((x) => `<span class="mp-medal">${medalSvg(x)}</span>`).join("")}</span><span class="mp-text"><small class="mp-kick">${kicker}</small><b>${top.length} trophies earned</b><span>${mdEsc(top.slice(0, 2).map((x) => x.name).join(", "))}${top.length > 2 ? ` and ${top.length - 2} more` : ""}</span></span>`;
  mdPop.setAttribute("aria-label", one ? `${kicker}: ${t.name}, ${t.chase}. Tap to see it.` : `${kicker}: ${top.length} trophies earned. Tap to see them in the trophy room.`);
  const tr = toastEl.classList.contains("show") ? toastEl.getBoundingClientRect() : null;
  mdPop.style.top = tr && tr.height ? `${Math.round(tr.bottom + 8)}px` : "";
  mdPop.classList.remove("show"); void mdPop.offsetWidth; mdPop.classList.add("show");
  tick(shiny ? 60 : crit ? 30 : 14);
  clearTimeout(mdPopT); mdPopT = setTimeout(() => mdPop.classList.remove("show"), one ? 5200 : 6500);
}
mdPop.addEventListener("click", () => {
  mdPop.classList.remove("show"); clearTimeout(mdPopT);
  if (mdPopList.length === 1) { openMedal(mdPopList[0].id); return; }
  mdToRoom();
});
// "See them": the trophy room, from wherever you are.
function mdToRoom() {
  if (document.body.classList.contains("listmode")) setListMode(false);
  if (tbl.on || bnd.on || wel.on || mode !== "set") { if (mdPopList[0]) openMedal(mdPopList[0].id); return; }
  if (room.on) { if (view === "set" && state.g) { exitToMosaic(); } mScroll = 0; kick(); return; }
  if (state.focus) unfocus();
  if (view === "set" && state.g) { leaveBinderThen(state.g, () => openRoom()); return; }
  if (state.trans) finishTransition();
  openRoom();
}

// ----- the list: the trophies, as text a screen reader can read -----
let mdListOpen = false;
function trophyListHTML(show, rows) {
  const fin = groups.filter((g) => g.done).sort(byFinish), L = mdBooted ? medalList() : null;
  let html = "";
  if (L && L.list.length) {
    const row = (t, svg = false) => `<li><button type="button" class="lmrow${t.earned ? "" : " locked"}" data-medal="${mdEsc(t.id)}">${svg ? medalSvg(t, { locked: !t.earned, dim: !t.earned }) : `<i class="lm-dot tier-${t.tier}" aria-hidden="true"></i>`}<span class="lm-name">${mdEsc(t.name)}${t.sig ? ' <span class="lm-sig">signature</span>' : ""}</span><span class="lm-meta">${mdEsc(t.chase)}</span><span class="lm-state">${mdLucky(t) ? `<i class="rank-tag ${t.rank}">${MD_RANK[t.rank]}</i> ` : ""}${t.earned ? `Earned ${t.at ? mdDate(t.at) : ""}` : t.goal > 1 ? `${t.goal - t.have} to go` : "Not earned yet"}</span></button></li>`;
    const next = L.list.filter((t) => !t.earned && t.goal > 1 && t.have < t.goal).sort((a, b) => b.have / b.goal - a.have / a.goal || (a.goal - a.have) - (b.goal - b.have)).slice(0, 4);
    const secs = new Map(); for (const t of L.list) { if (!secs.has(t.sec)) secs.set(t.sec, { name: t.chase, ts: [] }); secs.get(t.sec).ts.push(t); }
    html += `<section class="lshelf lmedals"><h2>Trophies</h2><p class="lsub">${L.earned.length} of ${L.list.length} earned.${L.hiddenLeft ? ` ${L.hiddenLeft} hidden left to find.` : ""} Tap one to see the cards behind it.</p>
      ${L.earned.length ? `<h3 class="lfin">Showcase</h3><ul class="lmed">${L.earned.slice(0, 6).map((t) => row(t, true)).join("")}</ul>` : ""}
      ${next.length ? `<h3 class="lfin">Next up</h3><ul class="lmed">${next.map((t) => row(t, true)).join("")}</ul>` : ""}
      <details class="lmed-all"${mdListOpen ? " open" : ""}><summary>Every trophy, by chase</summary>${[...secs.values()].map((s) => `<h3 class="lfin">${mdEsc(s.name)} <span class="lm-of">${s.ts.filter((t) => t.earned).length} of ${s.ts.length}</span></h3><ul class="lmed">${s.ts.slice().sort((a, b) => b.earned - a.earned || mdScore(b) - mdScore(a)).map((t) => row(t)).join("")}</ul>`).join("")}</details></section>`;
  }
  if (fin.length) html += `<section class="lshelf"><h2>Finished</h2><p class="lsub">Finished and sealed. On the shelf for a day, then in the trophy room. Back to the wall puts one among the others again.</p>${fin.map((g) => {
    const f = finishOf(g), items = g.cards.filter(show), s = seriesOf(g);
    return `<h3 class="lfin">${esc(trophyName(g))}</h3><p class="lsub lfin-line"><span>Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. ${deltaText(s.delta)}.${onShelf(g) ? " On the shelf today." : " In the trophy room."}</span><button type="button" class="pill-btn" data-shelf="${esc(doneKey(g))}">Back to the wall</button></p>${items.length ? rows(items) : ""}`;
  }).join("")}</section>`;
  return html;
}
document.getElementById("list").addEventListener("click", (e) => { const b = e.target.closest("[data-medal]"); if (b) openMedal(b.dataset.medal); });
document.getElementById("list").addEventListener("toggle", (e) => { if (e.target.classList?.contains("lmed-all")) mdListOpen = e.target.open; }, true);
// Reset the demo clears the trophies too.
document.getElementById("reset").addEventListener("click", () => { try { localStorage.removeItem("wall-medals"); } catch { /* fine */ } }, true);
// Debug builds only: the tests' hook sees the medals.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { medals: { get: () => mdStore }, medalList: { value: medalList }, openMedal: { value: openMedal }, closeMedal: { value: closeMedal }, checkMedals: { value: checkMedals }, mdRoll: { value: mdRoll }, mdItems: { get: () => room.L?.items || [] }, mdCelebrate: { value: mdCelebrate }, setMedalFilter: { value: (v) => { mdFilter = v; layoutAll(); kick(); } } }); }, 0);
