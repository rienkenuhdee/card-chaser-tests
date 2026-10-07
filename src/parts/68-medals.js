// ---------- medals: production's trophies, in the trophy room (round 19) ----------
// Production's trophy catalog lives in the room the plaques already live in. Every set and saved chase earns its
// medals as it fills (named for the kind of chase: Half a Binder, Fan Club, Gallery Opening...), with the goals inside
// it (Holo hunter, Chase cards, Clean sweep), the signature medals a set or a kind of chase uniquely offers (a gold
// crown), hidden ones (a purple "?", out of sight until earned), the Dex (Kanto master, 50 and 151 Pokémon) and Across
// everything (cards owned, trades). Luck is rolled once per medal, seeded by its id: 1 in 100 Shiny, otherwise about 1 in
// 10 Critical. Earned medals are kept in localStorage wall-medals (Reset the demo clears it); whatever is already true
// when the wall loads is earned quietly, dated from the cards that earned it.
// The room is production's Medal tab in the room's skin: a summary, the Showcase (the rarest), Next up, the filters,
// then one shelf per set or chase. A finished set's plaque stands at the head of its shelf with its Binder Complete
// medal mounted on it, and the rest of its medals hang beneath on ribbons. Locked medals fold behind one line per shelf.
// Tapping a medal opens its trophy sheet: what it's for and the cards behind it, missing ones first.
// Inside an open set, the header carries the next medal to earn as one pin at its point on the bar; marking the card
// that tips a medal mints it there, its luck revealed, and it flies off to the Medal room (the rooms button, top left). Outside a set, or more than
// four at once (an import, Select all), one celebration card says so instead.

// ----- production's words, shapes and colours (public/app.js and public/medal.js) -----
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
const MD_STARTERS = [[1, 9], [152, 160], [252, 260], [387, 395], [495, 503], [650, 658], [722, 730], [810, 818], [906, 914]];
const MD_LEGENDS = [[144, 146], [150, 151], [243, 245], [249, 251], [377, 386], [480, 494], [638, 649], [716, 721], [772, 773], [785, 809], [888, 898], [905, 905], [1001, 1010], [1014, 1025]];
const MD_EEVEE = new Set([133, 134, 135, 136, 196, 197, 470, 471, 700]);
const MD_ERAS = [["mega", 2025.6], ["sv", 2023.2], ["swsh", 2020.1], ["wotc", 0]]; // the wall's sets span four of production's eras
const mdInRanges = (n, rs) => rs.some(([a, b]) => n >= a && n <= b);
const mdYear = (st) => { const d = new Date(st.released); return d.getUTCFullYear() + (d.getUTCMonth() + 1) / 12; };
const mdEra = (c) => { const y = mdYear(sets[c.si]); return MD_ERAS.find((e) => y >= e[1])[0]; };
const mdTierIdx = (t) => ["bronze", "silver", "gold", "holo"].indexOf(t);
const mdScore = (t) => (t.rank === "shiny" ? 1000 : t.rank === "crit" ? 500 : 0) + mdTierIdx(t.tier) * 10; // production's rankScore
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
// Luck: rolled once per medal, seeded by its id, so it can't be rerolled (a chase is keyed by its rule, not its name).
const mdRoll = (id) => { const r = h32(`${Math.floor(h32(`luck|${id}`) * 1e9)}|${id}|roll`); return r < 0.01 ? "shiny" : r < 0.11 ? "crit" : "normal"; };
// Which shelf a set or chase panel's medals are on.
const mdSecOf = (g) => (g.set ? `set:${g.set.id}` : g.chase ? `chase:${ruleKey(g.chase)}` : "");

// ----- signature medals: what a set or a kind of chase uniquely offers -----
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

// ----- the catalog, worked out from the wall (cached until a card, a chase, a trade or a medal changes; never per frame) -----
let mdStore = null; // id -> { at, rank, name, chase, sec, kind, color, plate, tier, sig, hidden }
try { mdStore = JSON.parse(localStorage.getItem("wall-medals") || "null"); } catch { mdStore = null; }
const mdFirst = !mdStore || typeof mdStore !== "object";
if (mdFirst) mdStore = {};
const mdPersist = () => { try { localStorage.setItem("wall-medals", JSON.stringify(story ? { ...story.held, ...mdStore } : mdStore)); } catch { /* private mode */ } }; // the import's story holds its trophies back until their dates: still saved
const mdTradesDone = () => (typeof trades === "undefined" ? [] : trades.filter((r) => r.state === "done" || r.state === "accepted"));
const mdUnitOwned = (u) => (Array.isArray(u) ? u.some((c) => c.owned) : u.owned);
const medalCount = () => Object.keys(mdStore).length;
function mdCompute() {
  const out = [];
  const mk = (base, o) => {
    const t = { ...base, ...o };
    let have = 0;
    if (t.units) { for (const u of t.units) if (mdUnitOwned(u)) have++; } else have = t.haveN || 0;
    t.earned = have >= t.need; t.have = Math.min(have, t.need); t.goal = t.need;
    out.push(t); return t;
  };
  // Per chase, in production's order: its signature medals, the four milestones, then the goals inside it.
  const chase = (c) => {
    const cs = c.cards, total = cs.length; if (!total) return;
    const N = MD_NAMES[c.kind] || MD_NAMES.custom, base = { chase: c.name, sec: c.key, kind: c.kind, color: c.color, plate: c.plate, open: c.open };
    for (const s of mdSigs(c)) mk(base, { id: `${c.key}:sig-${s.id}`, name: s.name, desc: `${s.desc} (${c.name})`, tier: s.tier, sig: true, plate: s.plate, units: s.units, need: s.need });
    mk(base, { id: `${c.key}:half`, name: N.half, desc: `Own half of ${c.name}.`, tier: "silver", units: cs, need: Math.ceil(total * 0.5), mile: true });
    mk(base, { id: `${c.key}:three-quarters`, name: N.tq, desc: `Own 75% of ${c.name}.`, tier: "gold", units: cs, need: Math.ceil(total * 0.75), mile: true });
    if (total >= 6) mk(base, { id: `${c.key}:last3`, name: N.last3, desc: `Get ${c.name} down to its final three cards.`, tier: "gold", units: cs, need: total - 3, mile: true });
    mk(base, { id: `${c.key}:complete`, name: N.complete, desc: `Every card in ${c.name}.`, tier: "holo", units: cs, need: total, mile: true, complete: true });
    for (const [bucket, name, desc, tier] of [["holo", "Holo hunter", "Every holo rare", "silver"], ["chase", "Chase cards", "Every chase-rarity card", "gold"], ["easy", "Clean sweep", "Every common and uncommon", "bronze"]]) {
      const grp = cs.filter((x) => mdBucket(x) === bucket);
      if (grp.length < 3 || grp.length === total) continue;
      mk(base, { id: `${c.key}:${bucket}`, name, desc: `${desc} in ${c.name}.`, tier, units: grp, need: grp.length });
    }
  };
  for (const st of sets) chase({ key: `set:${st.id}`, name: st.name, kind: "set", color: mdFour(st.ink), plate: st.code, cards: st.cards, setId: st.id, open: { set: st.id } });
  for (const r of chases) {
    if (r.kind === "natdex") { mdNatdex(r, mk); continue; } // a filtered Dex's milestones (85-natdex.js); the Complete Dex carries the Dex medals below
    const kind = mdKindOf(r); if (kind === "set") continue; // "All of a set" is the set, which has its own
    chase({ key: `chase:${ruleKey(r)}`, name: r.label, kind, color: kind === "pokemon" ? "blue" : kind === "artist" ? "green" : "yellow", plate: mdPlate(kind, r, r.label), cards: ruleCards(r), open: { chase: r.id } });
  }
  // The Dex: Kanto (the one region the wall's sets fill) and how many Pokémon overall.
  // With the Complete Dex on the wall they are its medals, on its shelf; Johto to Paldea and 500 or 1,000 Pokémon stay
  // out: the wall's sets reach 450 Pokémon and fill no region but Kanto (see 85-natdex.js).
  const dx = chases.find(isFullDex);
  const D = dx ? { chase: dx.label, sec: `chase:${ruleKey(dx)}`, kind: "dex", color: "red", plate: "DEX", open: { chase: dx.id } } : { chase: "Dex", sec: "dex", kind: "dex", color: "red", plate: "DEX" }, all = [...MD_SPECIES.values()];
  const kanto = []; for (let d = 1; d <= 151; d++) if (MD_SPECIES.has(d)) kanto.push(MD_SPECIES.get(d));
  mk(D, { id: "dex:gen1", name: "Kanto master", desc: kanto.length === 151 ? "Every Kanto Pokémon." : `Every Kanto Pokémon on the wall (${kanto.length}).`, tier: "gold", units: kanto, need: kanto.length });
  for (const n of [50, 151]) mk(D, { id: `dex:count${n}`, name: `${n} Pokémon`, desc: `Have a card for ${n} different Pokémon.`, tier: n >= 151 ? "gold" : "silver", units: all, need: n, noCards: true });
  // Across everything: collecting and trading (production's buying ones need purchases the wall doesn't have), and the hidden ones.
  const G = { chase: "Across everything", sec: "global", kind: "global", color: "yellow", plate: "★" };
  for (const n of [100, 500, 1000]) mk(G, { id: `g:own-${n}`, name: `${n.toLocaleString()} cards`, desc: `Own ${n.toLocaleString()} cards across your sets.`, tier: n >= 1000 ? "holo" : n >= 500 ? "gold" : "silver", units: cards, need: n, noCards: true });
  const H = (o) => mk(G, { hidden: true, ...o });
  const one = (id) => [mdCardById.get(id)].filter(Boolean);
  H({ id: "g:moonbreon", name: "Moonbreon", desc: "Umbreon VMAX, Evolving Skies #215.", tier: "holo", plate: "MOON", units: one("swsh7-215"), need: 1 });
  H({ id: "g:secret-agent", name: "Secret Agent", desc: "Dark Raichu, Team Rocket #83.", tier: "holo", plate: "RAICHU", units: one("base5-83"), need: 1 });
  H({ id: "g:fan-club", name: "Pikachu Fan Club", desc: "25 Pikachu cards.", tier: "gold", plate: "PIKA25", units: MD_SPECIES.get(25) || [], need: 25 });
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
  out.forEach((t, i) => { t.ord = i; });
  return out;
}
// Earned: true now, or remembered (even if a card went out since, or the chase was taken off the wall).
let mdCache = null, mdVer = 0;
function mdSig() {
  let n = 0, h = 0;
  for (const c of cards) if (c.owned) { n++; h = (Math.imul(h, 31) + c.i) | 0; }
  return `${n}|${h}|${chases.map(ruleKey).join(",")}|${mdTradesDone().length}|${medalCount()}|${mdVer}`;
}
function medalList() {
  const sig = mdSig();
  if (mdCache?.sig === sig) return mdCache;
  const live = mdCompute(), ids = new Set(live.map((t) => t.id));
  for (const t of live) { const s = mdStore[t.id]; t.rank = s ? s.rank : ""; t.at = s ? s.at : null; if (s) t.earned = true; }
  for (const [id, s] of Object.entries(mdStore)) if (!ids.has(id)) live.push({ id, name: s.name, chase: s.chase, sec: s.sec || "global", kind: s.kind || "custom", color: s.color || "blue", plate: s.plate || "", tier: s.tier, sig: Boolean(s.sig), hidden: Boolean(s.hidden), earned: true, at: s.at, rank: s.rank, desc: "Earned earlier.", have: 1, goal: 1, noCards: true, ord: 1e5 });
  const list = live.filter((t) => !t.hidden || t.earned); // hidden ones stay out of sight until earned
  const earned = list.filter((t) => t.earned).sort((a, b) => mdScore(b) - mdScore(a) || (b.at || 0) - (a.at || 0));
  mdCache = { sig, list, earned, hiddenLeft: live.length - list.length, byId: new Map(list.map((t) => [t.id, t])) };
  return mdCache;
}
// When a medal earned quietly came true: the moment its last needed card came in.
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

// ----- earning: checked a beat after the count changes (updateCount); quietly on load -----
let mdBooted = false, mdTimer = 0, mdImp = null, mdCause = null;
const mdImported = () => { try { return localStorage.getItem("wall-imported"); } catch { return null; } };
function scheduleMedals() { if (!mdBooted || story) return; clearTimeout(mdTimer); mdTimer = setTimeout(() => checkMedals(false), 220); } // during the import's story its trophies are already earned, waiting for their dates
function checkMedals(quiet) {
  const imp = mdImported(), viaImport = !quiet && Boolean(imp) && imp !== mdImp; // the import just landed: its medals arrive in one card
  mdImp = imp;
  const had = medalCount(), fresh = [];
  for (let pass = 0; pass < 3; pass++) { // a medal can earn a medal (Crown Collector, Trophy Cabinet)
    const now = medalList().list.filter((t) => t.earned && !mdStore[t.id]);
    if (!now.length) break;
    for (const t of now) {
      mdStore[t.id] = { at: quiet ? mdWhen(t) : Date.now(), rank: mdRoll(t.id), name: t.name, chase: t.chase, sec: t.sec, kind: t.kind, color: t.color, plate: t.plate, tier: t.tier, sig: Boolean(t.sig), hidden: Boolean(t.hidden) };
      fresh.push(t.id);
    }
  }
  if (!fresh.length) return [];
  mdPersist(); mdVer++;
  const L = medalList(), got = fresh.map((id) => L.byId.get(id)).filter(Boolean);
  if (room.on || !had) layoutAll(); // the first medal changes the Medal room
  if (!quiet) mdAnnounce(got, viaImport);
  drawList(); kick();
  return got;
}
setTimeout(() => { mdBooted = true; checkMedals(true); mdImp = mdImported(); if (mdFirst) mdPersist(); }, 0); // after the wall has started: what's already true is earned quietly
// Inside an open set, up to four new medals mint on its bar; anywhere else, or more at once, one card says so.
function mdAnnounce(got, viaImport) {
  const cause = mdCause && performance.now() - mdCause.t < 2000 ? mdCause.c : null; mdCause = null;
  const inSet = view === "set" && state.g && !document.body.classList.contains("listmode") && !tbl.on && !bnd.on && !wel.on;
  if (!viaImport && got.length <= 4 && inSet) { queueMints(got, cause); return; }
  mdQueue.push(...got); mdQueue.via = viaImport ? "import" : mdQueue.via || ""; mdCelebrateSoon();
}
document.fonts?.ready.then(() => { mdArt.clear(); mdRows.clear(); mdVer++; kick(); }); // the nameplates were lettered before Archivo arrived

// ----- the artwork: production's medalSVG for the page, and the same paths painted on the canvas -----
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
const MD_RIB_L = "M30 70 L22 118 L38 108 L46 120 L52 76 Z", MD_RIB_R = "M70 70 L78 118 L62 108 L54 120 L48 76 Z";
const MD_STAR = "M50 29 L56.5 43.5 L72 45 L60.5 55.5 L63.8 71 L50 63 L36.2 71 L39.5 55.5 L28 45 L43.5 43.5 Z";
const MD_CROWN = "M38 13 L42 4 L46 10 L50 2 L54 10 L58 4 L62 13 Z", MD_CRIT = "M84 8 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z";
const MD_RAYS = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, p = (q, da = 0) => `${(50 + Math.cos(a + da) * q).toFixed(1)} ${(50 + Math.sin(a + da) * q).toFixed(1)}`; return `M${p(40, -0.11)} L${p(49)} L${p(40, 0.11)} Z`; });
const mdSparkle = (x, y, s) => `M${x} ${y - 7 * s} L${x + 2 * s} ${y - 2 * s} L${x + 7 * s} ${y} L${x + 2 * s} ${y + 2 * s} L${x} ${y + 7 * s} L${x - 2 * s} ${y + 2 * s} L${x - 7 * s} ${y} L${x - 2 * s} ${y - 2 * s} Z`;
const MD_SPARKLES = [[14, 20, 1.2], [88, 34, 1], [76, 92, 0.9]];
const MD_RAINBOW = [[0, "#FF6B6B"], [0.25, "#FFD93D"], [0.5, "#6BCB77"], [0.75, "#4D96FF"], [1, "#C77DFF"]];
const mdEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let mdSvgN = 0;
// The page's medal (the sheet, the celebration, the list): production's medalSVG, its colours from CSS variables.
function medalSvg(t, { locked = false, cls = "" } = {}) {
  const [hi, lo] = MD_TIERS[t.tier] || MD_TIERS.bronze;
  const shape = MD_SHAPE[t.kind] || "circle", col = `var(--c-${t.color || "blue"})`;
  const rank = locked ? "" : MD_RANK[t.rank] ? t.rank : "", g = `md${++mdSvgN}`;
  const rays = rank === "crit" ? MD_RAYS.map((d) => `<path d="${d}" fill="#FFCB05" stroke="#9A6A00" stroke-width=".6"/>`).join("") : "";
  const sparkle = ([x, y, s], i) => `<path class="sparkle" style="animation-delay:${i * 0.5}s" d="${mdSparkle(x, y, s)}" fill="#FFF7B0" stroke="#C99A00" stroke-width=".8"/>`;
  const plate = t.plate ? (() => { const w = Math.max(26, String(t.plate).length * 7.4 + 12); return `<rect x="${50 - w / 2}" y="61" width="${w}" height="15" rx="7.5" fill="rgb(0 0 0 / .66)"/><text x="50" y="72" text-anchor="middle" fill="#fff" font-size="10" font-weight="800" style="font-family:var(--font)">${mdEsc(t.plate)}</text>`; })() : "";
  return `<svg class="medal ${cls} ${locked ? "locked" : ""} tier-${t.tier} ${rank ? `rank-${rank}` : ""}" viewBox="0 0 100 124" role="img" aria-label="${mdEsc(t.name)} ${locked ? "(not yet earned)" : `trophy${rank ? `, ${MD_RANK[rank]}` : ""}`}"><defs>
    <linearGradient id="${g}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    <linearGradient id="${g}h" x1="0" y1="0" x2="1" y2="1">${MD_RAINBOW.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient></defs>
    <path d="${MD_RIB_L}" style="fill:${col}"/><path d="${MD_RIB_R}" style="fill:color-mix(in srgb, ${col} 55%, #1B1D2E)"/>
    ${rays}
    <path class="rim" d="${mdShape(shape, 38)}" fill="url(#${g}${rank === "shiny" ? "h" : "g"})"/>
    <path d="${mdShape(shape, 33.5)}" fill="none" stroke="rgb(255 255 255 / .55)" stroke-width="2"/>
    <path d="${mdShape(shape, 29)}" fill="var(--m-surface)"/>
    <path d="${MD_STAR}" fill="url(#${g}g)"/>
    <path d="${mdShape(shape, 28.5)}" fill="none" stroke="${lo}" stroke-width="1.5" opacity=".6"/>
    ${plate}
    ${t.hidden ? `<circle cx="82" cy="14" r="10" fill="#6B3FD1" stroke="#FFFFFF" stroke-width="2"/><text x="82" y="18.5" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui, sans-serif" fill="#FFFFFF">?</text>` : ""}
    ${t.sig ? `<path d="${MD_CROWN}" fill="#FFCB05" stroke="#9A6A00" stroke-width="1.2" stroke-linejoin="round"/><circle cx="50" cy="2.8" r="1.6" fill="#E3350D"/>` : ""}
    ${rank === "crit" ? `<path d="${MD_CRIT}" fill="#FFCB05" stroke="#9A6A00" stroke-width="1"/>` : ""}
    ${rank === "shiny" ? MD_SPARKLES.map(sparkle).join("") : ""}</svg>`;
}
// The canvas's medal: the same paths with Path2D, painted once per look, size, dpr and theme and kept. A locked medal is
// production's grayscale at .38; the next one on a bar ("lit") is faint with a soft glow.
const mdPaths = new Map();
const mdP = (d) => { let p = mdPaths.get(d); if (!p) { p = new Path2D(d); mdPaths.set(d, p); } return p; };
const mdGrey = (h) => { const [r, g, b] = hex(h), v = Math.round(r * 0.299 + g * 0.587 + b * 0.114).toString(16).padStart(2, "0"); return `#${v}${v}${v}`; };
function paintMedal(x, t, mode, W = 100) {
  const locked = mode === "locked", C = (h) => (locked ? mdGrey(h) : h);
  const [hi0, lo0] = MD_TIERS[t.tier] || MD_TIERS.bronze, hi = C(hi0), lo = C(lo0);
  const shape = MD_SHAPE[t.kind] || "circle", col = C(theme[`c-${t.color}`] || theme["c-blue"] || "#3B4CCA");
  const rank = mode ? "" : MD_RANK[t.rank] ? t.rank : "";
  const lin = (stops) => { const g = x.createLinearGradient(12, 12, 88, 88); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
  x.globalAlpha = locked ? 0.38 : mode === "lit" ? 0.78 : 1; x.lineJoin = "round";
  x.fillStyle = col; x.fill(mdP(MD_RIB_L));
  x.fillStyle = mix(col, "#1B1D2E", 0.45); x.fill(mdP(MD_RIB_R));
  if (rank === "crit") { x.fillStyle = "#FFCB05"; x.strokeStyle = "#9A6A00"; x.lineWidth = 0.6; for (const d of MD_RAYS) { x.fill(mdP(d)); x.stroke(mdP(d)); } }
  const glow = Math.min(8, W * 0.12) * dpr; // inside the raster's margin, so the glow never shows an edge
  if (mode === "lit") { x.save(); x.shadowColor = hi; x.shadowBlur = glow; }
  else if (rank) { x.save(); x.shadowColor = rank === "crit" ? "rgb(255 203 5 / .75)" : "rgb(160 120 255 / .7)"; x.shadowBlur = glow; } // production's drop-shadow glow
  x.fillStyle = rank === "shiny" ? lin(MD_RAINBOW) : lin([[0, hi], [1, lo]]); x.fill(mdP(mdShape(shape, 38)));
  if (mode === "lit" || rank) x.restore();
  x.strokeStyle = "rgb(255 255 255 / .55)"; x.lineWidth = 2; x.stroke(mdP(mdShape(shape, 33.5)));
  x.fillStyle = C(theme["m-surface"] || "#FFFDF6"); x.fill(mdP(mdShape(shape, 29)));
  const sg = x.createLinearGradient(28, 29, 72, 71); sg.addColorStop(0, hi); sg.addColorStop(1, lo); x.fillStyle = sg; x.fill(mdP(MD_STAR));
  const a0 = x.globalAlpha; x.globalAlpha = a0 * 0.6; x.strokeStyle = lo; x.lineWidth = 1.5; x.stroke(mdP(mdShape(shape, 28.5))); x.globalAlpha = a0;
  if (t.plate) {
    const w = Math.max(26, String(t.plate).length * 7.4 + 12);
    rrOn(x, 50 - w / 2, 61, w, 15, 7.5); x.fillStyle = "rgb(0 0 0 / .66)"; x.fill();
    x.fillStyle = "#fff"; fontOn(x, 800, 10); x.textAlign = "center"; x.textBaseline = "alphabetic"; x.fillText(fitOn(x, String(t.plate), w - 4), 50, 72);
  }
  if (t.hidden) { x.beginPath(); x.arc(82, 14, 10, 0, Math.PI * 2); x.fillStyle = C("#6B3FD1"); x.fill(); x.lineWidth = 2; x.strokeStyle = "#fff"; x.stroke(); x.fillStyle = "#fff"; x.font = "800 13px system-ui, sans-serif"; x.textAlign = "center"; x.fillText("?", 82, 18.5); }
  if (t.sig) { x.fillStyle = C("#FFCB05"); x.strokeStyle = C("#9A6A00"); x.lineWidth = 1.2; x.fill(mdP(MD_CROWN)); x.stroke(mdP(MD_CROWN)); x.beginPath(); x.arc(50, 2.8, 1.6, 0, Math.PI * 2); x.fillStyle = C("#E3350D"); x.fill(); }
  if (rank === "crit") { x.fillStyle = "#FFCB05"; x.strokeStyle = "#9A6A00"; x.lineWidth = 1; x.fill(mdP(MD_CRIT)); x.stroke(mdP(MD_CRIT)); }
  if (rank === "shiny") { x.fillStyle = "#FFF7B0"; x.strokeStyle = "#C99A00"; x.lineWidth = 0.8; for (const [sx, sy, s] of MD_SPARKLES) { x.fill(mdP(mdSparkle(sx, sy, s))); x.stroke(mdP(mdSparkle(sx, sy, s))); } }
  x.globalAlpha = 1;
}
const mdArt = new Map();
const mdLookKey = (t, mode) => `${t.kind}|${t.tier}|${t.color}|${t.plate || ""}|${t.sig ? 1 : 0}|${t.hidden ? 1 : 0}|${mode ? "" : MD_RANK[t.rank] ? t.rank : ""}|${mode}`;
function medalArt(t, w, mode = "") {
  const W = Math.max(8, Math.round(w)), key = `${mdLookKey(t, mode)}|${W}|${dpr}|${theme["m-surface"]}|${theme[`c-${t.color}`]}`;
  let e = mdArt.get(key); if (e) return e;
  const pad = Math.ceil(W * 0.16), H = W * 1.24, cv = document.createElement("canvas");
  cv.width = Math.ceil((W + pad * 2) * dpr); cv.height = Math.ceil((H + pad * 2) * dpr);
  const x = cv.getContext("2d"); x.scale(dpr, dpr); x.translate(pad, pad); x.scale(W / 100, W / 100);
  paintMedal(x, t, mode, W);
  e = { cv, pad, W }; if (mdArt.size > 600) mdArt.clear(); mdArt.set(key, e);
  return e;
}
// A medal w wide, its top at `top`, centred on cx, on any context. crop: how much of its 124-unit height to show; S:
// the size it's painted at (a medal that changes size every frame draws one painting scaled).
function drawMedal(c2, t, cx, top, w, mode = "", crop = 124, S = w) {
  const e = medalArt(t, S, mode), k = w / e.W, sh = Math.min(e.cv.height, Math.ceil((e.pad + (crop * e.W) / 100) * dpr));
  c2.drawImage(e.cv, 0, 0, e.cv.width, sh, cx - w / 2 - e.pad * k, top - e.pad * k, (e.W + e.pad * 2) * k, (sh / dpr) * k);
}

// ----- the room's shelves: one per set or chase (laid out by roomLayout, 67-room) -----
const MD_FILTERS = [["all", "All"], ["earned", "Earned"], ["locked", "To earn"], ["crit", "Critical"], ["shiny", "Shiny"]];
const MD_MW = 50, MD_SW = 64, MD_NW = 38, MD_PW = 42, MD_NH = 62, MD_RIB = 9;
const MD_ROW = SHELF_H + MD_RIB + Math.round(MD_MW * 1.24) + 52; // a row of medals hanging from a rail, their labels under them
const MD_SROW = Math.round(MD_SW * 1.24) + 70; // the showcase: medals standing on a lit shelf
let mdFilter = "all", mdFoldAll = false;
const mdOpen = new Set(); // shelves whose locked medals are unfolded
const mdBlocks = new Map(); // stable tap targets, so the press shows on the thing under the finger
const mdBlock = (key, o) => { let b = mdBlocks.get(key); if (!b) { b = { md: true, lead: [], cards: [] }; mdBlocks.set(key, b); } return Object.assign(b, o); };
const mdShow = (t) => mdFilter === "all" || (mdFilter === "earned" && t.earned) || (mdFilter === "locked" && !t.earned) || (mdFilter === "crit" && t.earned && t.rank === "crit") || (mdFilter === "shiny" && t.earned && t.rank === "shiny");
// Every shelf: its medals (earned first, rarest first, then production's order), its plaque if it's finished and in the
// room, and when it last earned something. Started shelves first (newest first), then the Dex, Across everything, and
// the ones not started yet.
function mdShelves(fin = caseList()) {
  const L = medalList(), secs = new Map();
  const sec = (key, name, color) => { let s = secs.get(key); if (!s) { s = { sec: key, name, color, all: [], plaque: null, at: 0 }; secs.set(key, s); } return s; };
  for (const t of L.list) { const s = sec(t.sec, t.chase, t.color); s.all.push(t); if (t.earned && t.at) s.at = Math.max(s.at, t.at); }
  for (const g of fin) { const k = mdSecOf(g), s = sec(k, g.set ? g.set.name : g.name, g.set ? mdFour(g.set.ink) : "yellow"); s.plaque = g; s.at = Math.max(s.at, finishOf(g)?.at || 0); }
  for (const s of secs.values()) {
    s.all.sort((a, b) => b.earned - a.earned || mdScore(b) - mdScore(a) || a.ord - b.ord);
    s.earnedN = s.all.filter((t) => t.earned).length;
    s.started = s.earnedN > 0 || Boolean(s.plaque);
    s.rank = s.sec === "dex" ? 1 : s.sec === "global" ? 2 : 0;
    s.ride = s.plaque ? s.all.find((t) => t.complete && t.earned) || null : null; // Binder Complete rides on the plaque
  }
  const all = [...secs.values()];
  return { started: all.filter((s) => s.started).sort((a, b) => a.rank - b.rank || b.at - a.at), notYet: all.filter((s) => !s.started).sort((a, b) => a.rank - b.rank || b.all.reduce((m, t) => Math.max(m, t.have / t.goal), 0) - a.all.reduce((m, t) => Math.max(m, t.have / t.goal), 0)) };
}
const mdStatus = (t) => (t.earned ? (t.at ? mdDate(t.at) : "Earned") : t.goal > 1 ? `${t.goal - t.have} to go` : "Locked");
const mdDate = (at) => { const d = new Date(at), y = d.getFullYear() !== new Date().getFullYear(); return d.toLocaleDateString("en-US", y ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" }); };
// Lays out one shelf from y: the plaque at its head (or a heading), its medals in rows on ribbons, then the fold line.
function mdShelfLayout(s, R, y, items, hits, plaques, rails) {
  const plq = s.plaque && (mdFilter === "all" || mdFilter === "earned") ? s.plaque : null;
  const ts = s.all.filter((t) => mdShow(t) && !(plq && t === s.ride));
  const locked = ts.filter((t) => !t.earned), open = mdFilter === "locked" || mdOpen.has(s.sec);
  const shown = mdFilter === "all" && !open ? ts.filter((t) => t.earned) : ts, folded = mdFilter === "all" && !open ? locked.length : 0;
  if (!plq && !shown.length && !folded && !(mdFilter === "all" && locked.length)) return y;
  const total = s.all.length;
  let railY;
  if (plq) {
    y += 10;
    const fan = plq === room.fan ? stackOf(plq).length * SUB_H : 0, g = plq;
    g.m = { x: R.x, y, w: R.w, h: ROW_H }; g.plq = plaqueInfo(g); packRoomPlaque(g);
    g.fanR = stackOf(g).length ? { x: g.m.x + g.m.w - PG - 12 - 150, y: g.m.y + 8, w: 150, h: 34 } : null;
    g.fanBtn ||= { fan: g, lead: [], cards: [] };
    if (g === room.fan) fanRows(g).forEach((r, k) => { r.m = { x: g.m.x, y: y + ROW_H + k * SUB_H, w: R.w, h: SUB_H }; });
    g.ride = s.ride;
    if (s.ride) { const p = roomPlate(g.m); hits.push({ x: p.x + 4, y: p.y + 2, w: MD_PW + 14, h: p.h - 24, blk: mdBlock(`ride|${s.ride.id}`, { mdt: s.ride }) }); }
    plaques.push(g);
    railY = y + ROW_H + fan - SHELF_H - 4;
    y += ROW_H + fan;
  } else {
    y += 12;
    items.push({ type: "head", x: R.x, y, w: R.w, h: 30, text: s.name, right: `${s.earnedN} of ${total}`, dot: s.color });
    y += 30; railY = y;
  }
  const cols = R.w >= 700 ? 8 : R.w >= 520 ? 6 : 4, cw = R.w / cols;
  if (!shown.length && plq) { rails.push({ y: railY, h: SHELF_H }); y = Math.max(y, railY + SHELF_H + 4); }
  for (let i = 0; i < shown.length; i += cols) {
    const row = shown.slice(i, i + cols), ry = i ? y : railY;
    const it = { type: "row", x: R.x, y: ry, w: R.w, h: MD_ROW, cells: row.map((t, j) => ({ t, cx: (j + 0.5) * cw, cw })) };
    it.key = `h|${Math.round(R.w)}|${row.map((t) => `${t.id}:${t.earned ? t.rank || "n" : t.have}`).join(",")}`;
    items.push(it);
    row.forEach((t, j) => hits.push({ x: R.x + j * cw + 2, y: ry + SHELF_H, w: cw - 4, h: MD_ROW - SHELF_H - 4, blk: mdBlock(`m|${t.id}`, { mdt: t }) }));
    y = ry + MD_ROW;
  }
  if (folded || (open && locked.length && mdFilter === "all")) {
    y += shown.length || plq ? 2 : 0;
    const it = { type: "more", x: R.x, y, w: R.w, h: 40, text: folded ? `${folded} ${shown.length || plq ? "more " : ""}to earn` : `Hide the ${locked.length} to earn`, open: !folded, blk: mdBlock(`fold|${s.sec}`, { mdsec: s.sec }) };
    items.push(it); hits.push(it); y += 44;
  }
  return y;
}
// The room from the top: the summary, Showcase, Next up, the filters, then the shelves. Returns where it ends.
function mdRoomLayout(R, y0, items, hits, plaques, rails) {
  const L = medalList(), gcols = R.w >= 700 ? 8 : R.w >= 520 ? 6 : 4;
  let y = y0;
  const head = (text, right, gap = 8) => { y += gap; items.push({ type: "head", x: R.x, y, w: R.w, h: 30, text, right }); y += 30; };
  if (L.earned.length) { // the Showcase: the rarest you've earned, standing on a lit shelf
    const sh = L.earned.filter((t) => t.rank === "shiny").length, cr = L.earned.filter((t) => t.rank === "crit").length;
    head("Showcase", `${sh ? `${sh} shiny · ` : ""}${cr} critical`, 4);
    const n = gcols >= 6 ? 6 : 4, cw = R.w / n, row = L.earned.slice(0, n);
    items.push({ type: "row", stand: true, x: R.x, y, w: R.w, h: MD_SROW, cells: row.map((t, i) => ({ t, cx: (i + 0.5) * cw, cw })), key: `s|${Math.round(R.w)}|${row.map((t) => `${t.id}:${t.rank}`).join(",")}` });
    row.forEach((t, i) => hits.push({ x: R.x + i * cw + 2, y, w: cw - 4, h: MD_SROW - 4, blk: mdBlock(`sc|${t.id}`, { mdt: t }) }));
    y += MD_SROW;
  }
  // Next up: the closest to being earned (hidden ones never show here).
  const next = L.list.filter((t) => !t.earned && t.goal > 1).map((t) => ({ t, left: t.goal - t.have, frac: t.have / t.goal })).filter((x) => x.left > 0).sort((a, b) => b.frac - a.frac || a.left - b.left).slice(0, 4);
  if (next.length) {
    head("Next up", "");
    for (const x of next) { const it = { type: "nu", ...x, x: R.x, y, w: R.w, h: MD_NH, blk: mdBlock(`nu|${x.t.id}`, { mdt: x.t }) }; items.push(it); hits.push(it); y += MD_NH + 8; }
  }
  y += 10;
  let cx = R.x;
  for (const [v, label] of MD_FILTERS) {
    font(600, 13.5); const w = textW(label) + 28;
    if (cx + w > R.x + R.w) { cx = R.x; y += 40; }
    const it = { type: "chip", label, on: mdFilter === v, x: cx, y, w, h: 32, blk: mdBlock(`tf|${v}`, { mdf: v }) }; items.push(it); hits.push(it);
    cx += w + 8;
  }
  y += 36;
  const { started, notYet } = mdShelves();
  for (const s of started) y = mdShelfLayout(s, R, y, items, hits, plaques, rails);
  const later = notYet.filter((s) => s.all.some(mdShow));
  if (later.length) {
    y += 14; const it = { type: "fold", x: R.x, y, w: R.w, h: 48, n: later.length, open: mdFoldAll, blk: mdBlock("foldall", { mdfold: true }) }; items.push(it); hits.push(it); y += 52;
    if (mdFoldAll) for (const s of later) y = mdShelfLayout(s, R, y, items, hits, plaques, rails);
  }
  if (!plaques.length && !items.some((it) => (it.type === "row" && !it.stand) || it.type === "more" || it.type === "fold")) {
    y += 8; items.push({ type: "note", x: R.x, y, w: R.w, h: 64, title: mdFilter === "shiny" ? "No shiny trophies yet" : mdFilter === "crit" ? "No critical trophies yet" : "Nothing here yet", text: mdFilter === "shiny" || mdFilter === "crit" ? "Luck is decided when a trophy is earned. Keep collecting." : "Mark a few cards and your first trophies appear." }); y += 70;
  }
  y += 22;
  items.push({ type: "note", x: R.x, y, w: R.w, h: 136, title: "How trophies work", text: "Each set and chase earns its own trophies as you fill it, named for the kind of chase. A gold crown marks a signature trophy, something one set or chase uniquely offers. Hidden ones don't show until you earn them, then wear a purple question mark. Luck is rolled once, when a trophy is earned: about 1 in 10 come up Critical, with a gold starburst, and about 1 in 100 Shiny, with a rainbow rim. It stays with the trophy for good." });
  return y + 136;
}
// A row of medals, drawn once and kept (a few dozen at most; the oldest go first).
const mdRows = new Map();
let mdRowUse = 0;
function mdRowImage(it) {
  const key = `${it.key}|${dpr}|${look()}|${theme["m-surface"]}|${mdVer}`;
  let e = mdRows.get(key);
  if (e) { e.use = ++mdRowUse; return e.cv; }
  if (mdRows.size >= 48) { let old = null; for (const [k, v] of mdRows) if (!old || v.use < old[1].use) old = [k, v]; mdRows.delete(old[0]); }
  const holder = {};
  const cv = cachedImage(holder, key, it.w, it.h, (x) => {
    if (it.stand) { // the showcase: standing on a lit shelf, the label under the shelf's edge
      const mw = Math.min(MD_SW, it.cells[0].cw - 16), mh = mw * 1.24, sy = 6 + mh - 5;
      const lit = x.createLinearGradient(0, 0, 0, sy); lit.addColorStop(0, "rgb(255 220 150 / 0)"); lit.addColorStop(1, "rgb(255 220 150 / .09)"); x.fillStyle = lit; x.fillRect(-6, 0, it.w + 12, sy);
      x.fillStyle = theme["room-wood"]; x.fillRect(-6, sy, it.w + 12, 8); x.fillStyle = theme["room-wood-hi"]; x.fillRect(-6, sy, it.w + 12, 1.5); x.fillStyle = "rgb(0 0 0 / .35)"; x.fillRect(-6, sy + 8, it.w + 12, 5);
      for (const c of it.cells) { drawMedal(x, c.t, c.cx, 6, mw); mdLabel(x, c.t, c.cx, sy + 30, c.cw - 8, true); }
      return;
    }
    // hanging: a rail along the top, a ribbon down to each medal
    x.fillStyle = theme["room-wood"]; x.fillRect(-6, 0, it.w + 12, SHELF_H); x.fillStyle = theme["room-wood-hi"]; x.fillRect(-6, 0, it.w + 12, 1.5); x.fillStyle = "rgb(0 0 0 / .35)"; x.fillRect(-6, SHELF_H, it.w + 12, 5);
    for (const c of it.cells) {
      const t = c.t, col = t.earned ? theme[`c-${t.color}`] || theme["c-blue"] : "#5A4E44";
      x.globalAlpha = t.earned ? 1 : 0.7;
      x.fillStyle = mix(col, "#000000", 0.3); x.fillRect(c.cx - 3, SHELF_H - 1, 6, MD_RIB + 6);
      x.fillStyle = col; x.fillRect(c.cx - 3, SHELF_H - 1, 2, MD_RIB + 6);
      x.globalAlpha = 1;
      drawMedal(x, t, c.cx, SHELF_H + MD_RIB, MD_MW, t.earned ? "" : "locked");
      mdLabel(x, t, c.cx, SHELF_H + MD_RIB + MD_MW * 1.24 + 14, c.cw - 6, false);
    }
  });
  mdRows.set(key, { cv, use: ++mdRowUse });
  return cv;
}
// A medal's name (two lines at most), then its date, its luck tag, or how many to go.
function mdLabel(x, t, cx, y, w, big) {
  x.textAlign = "center"; x.textBaseline = "alphabetic";
  fontOn(x, t.earned ? 700 : 500, big ? 13 : 12, true); x.fillStyle = t.earned ? theme["room-ink"] : theme["room-muted"];
  for (const ln of wrapOn(x, t.name, w, 2)) { x.fillText(ln, cx, y); y += 13.5; }
  if (mdLucky(t)) { const p = mdPill(t.rank); x.drawImage(p.cv, cx - p.w / 2, y - 10, p.w, p.h); }
  else { fontOn(x, 500, 11); x.fillStyle = theme["room-muted"]; x.fillText(mdStatus(t), cx, y + 1); }
  x.textAlign = "left";
}
function wrapOn(x, text, w, max) {
  const words = text.split(" "), lines = [];
  let cur = "";
  for (const wd of words) { const t = cur ? `${cur} ${wd}` : wd; if (x.measureText(t).width <= w || !cur) cur = t; else { lines.push(cur); cur = wd; } }
  if (cur) lines.push(cur);
  return lines.length > max ? [...lines.slice(0, max - 1), fitOn(x, lines.slice(max - 1).join(" "), w)] : lines.map((l) => fitOn(x, l, w));
}
const mdPills = new Map();
function mdPill(rank) { // production's Critical and Shiny tags, drawn once
  const key = `${rank}|${dpr}`; let p = mdPills.get(key); if (p) return p;
  const w = rank === "shiny" ? 46 : 58, h = 16, cv = document.createElement("canvas"); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  const x = cv.getContext("2d"); x.scale(dpr, dpr);
  rrOn(x, 0.5, 0.5, w - 1, h - 1, 8);
  if (rank === "shiny") { const gr = x.createLinearGradient(0, 0, w, 0); ["#FFD6D6", "#FFF3B0", "#D3F5DC", "#D2E4FF", "#EBD6FF"].forEach((c, i) => gr.addColorStop(i / 4, c)); x.fillStyle = gr; x.strokeStyle = "#8A6BE0"; }
  else { x.fillStyle = "#FFF1B8"; x.strokeStyle = "#C99A00"; }
  x.fill(); x.lineWidth = 1; x.stroke();
  x.fillStyle = rank === "shiny" ? "#2A1F4D" : "#4A3500"; fontOn(x, 800, 9.5); x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(MD_RANK[rank].toUpperCase(), w / 2, h / 2 + 0.5);
  p = { cv, w, h }; mdPills.set(key, p); return p;
}
// The live pieces of the room (headings, Next up, the filters, the fold lines, the notes): a few per screen, text through font().
function mdDrawItem(it, y, pressed) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  if (it.type === "head") {
    let x = it.x + 4;
    if (it.dot) { ctx.beginPath(); ctx.arc(x + 4, y + 18, 4, 0, Math.PI * 2); ctx.fillStyle = theme[`c-${it.dot}`] || theme["c-blue"]; ctx.fill(); x += 14; }
    font(600, 12.5); const rw = it.right ? textW(it.right) + 12 : 0;
    ctx.textAlign = "right"; ctx.fillStyle = theme["room-muted"]; if (it.right) ctx.fillText(it.right, it.x + it.w - 4, y + 22);
    ctx.textAlign = "left"; ctx.fillStyle = theme["room-ink"]; font(800, 16, true); ctx.fillText(fitText(it.text, it.w - rw - (x - it.x) - 4), x, y + 22);
  } else if (it.type === "nu") {
    const t = it.t;
    rr(it.x, y, it.w, it.h, 10); ctx.fillStyle = pressed ? "rgb(255 236 210 / .12)" : "rgb(255 236 210 / .05)"; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgb(255 236 210 / .14)"; ctx.stroke();
    drawMedal(ctx, t, it.x + 10 + MD_NW / 2, y + (it.h - MD_NW * 1.24) / 2, MD_NW, "locked");
    const tx = it.x + 60, tw = it.w - 60 - 72;
    font(700, 14.5, true); ctx.fillStyle = theme["room-ink"]; ctx.fillText(fitText(t.name, tw), tx, y + 22);
    font(500, 12); ctx.fillStyle = theme["room-muted"]; ctx.fillText(fitText(t.chase, tw), tx, y + 38);
    ctx.fillStyle = "rgb(255 255 255 / .12)"; ctx.fillRect(tx, y + 46, tw, 4);
    ctx.fillStyle = theme[`c-${t.color}`] || theme["c-blue"]; ctx.fillRect(tx, y + 46, tw * it.frac, 4);
    ctx.textAlign = "center"; ctx.fillStyle = theme["room-ink"]; font(800, 20); ctx.fillText(String(it.left), it.x + it.w - 36, y + 31);
    font(500, 11); ctx.fillStyle = theme["room-muted"]; ctx.fillText("to go", it.x + it.w - 36, y + 46);
  } else if (it.type === "chip") {
    rr(it.x + 0.5, y + 0.5, it.w - 1, it.h - 1, 16);
    if (it.on) { ctx.fillStyle = theme["room-ink"]; ctx.fill(); }
    else { ctx.fillStyle = pressed ? "rgb(255 236 210 / .14)" : "rgb(255 236 210 / .04)"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgb(255 236 210 / .26)"; ctx.stroke(); }
    ctx.fillStyle = it.on ? theme["room-bg"] : theme["room-ink"]; font(600, 13.5); ctx.textAlign = "center"; ctx.fillText(it.label, it.x + it.w / 2, y + 21);
  } else if (it.type === "more" || it.type === "fold") { // a shelf's locked medals, or the chases not started yet
    rr(it.x, y + 2, it.w, it.h - 4, 10); ctx.fillStyle = pressed ? "rgb(255 236 210 / .12)" : "rgb(255 236 210 / .05)"; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgb(255 236 210 / .14)"; ctx.stroke();
    const my = y + it.h / 2 + 5;
    if (it.type === "more") { font(600, 13.5); ctx.fillStyle = theme["room-ink"]; ctx.fillText(it.text, it.x + 14, my); ctx.textAlign = "right"; ctx.fillStyle = theme["room-muted"]; ctx.fillText(it.open ? "‹" : "›", it.x + it.w - 14, my); }
    else { font(700, 14.5, true); ctx.fillStyle = theme["room-ink"]; ctx.fillText("Not started yet", it.x + 14, my); ctx.textAlign = "right"; ctx.fillStyle = theme["room-muted"]; font(600, 12.5); ctx.fillText(`${it.n} ${it.n === 1 ? "chase" : "chases"} ${it.open ? "▴" : "▾"}`, it.x + it.w - 14, my); }
  } else if (it.type === "note") {
    font(700, 13); ctx.fillStyle = theme["room-ink"]; ctx.fillText(it.title, it.x + 4, y + 16);
    font(500, 12.5); ctx.fillStyle = theme["room-muted"];
    let ty = y + 34; for (const ln of mdWrap(it.text, it.w - 8)) { ctx.fillText(ln, it.x + 4, ty); ty += 16; }
  }
  ctx.textAlign = "left";
}
const mdWrapCache = new Map();
function mdWrap(text, w) { const key = `${curFont}|${Math.round(w)}|${text}`; let v = mdWrapCache.get(key); if (!v) { v = wrapOn(ctx, text, w, 9); mdWrapCache.set(key, v); } return v; }
// A tap on a medal, a filter, a shelf's fold line, or the fold of chases not started yet.
function mdTap(b) {
  if (b.mdt) { openMedal(b.mdt.id); return; }
  tick(4);
  if (b.mdf) mdFilter = b.mdf;
  else if (b.mdfold) mdFoldAll = !mdFoldAll;
  else if (b.mdsec) { if (mdOpen.has(b.mdsec)) mdOpen.delete(b.mdsec); else mdOpen.add(b.mdsec); }
  layoutAll(); kick();
}

// ----- the next medal on an open set's bar: one pin at its point, lit faintly; tap it for its sheet -----
// Its point is where the bar will be when it's earned (the cards you have, plus the ones it still needs).
function mdNextOf(g) {
  const sec = mdSecOf(g), owned = ownedIn(g.base || g.cards), key = `${sec}|${owned}|${mdVer}|${medalCount()}`;
  if (g.mdNext?.key === key) return g.mdNext.v;
  let best = null;
  if (sec) for (const t of medalList().list) if (t.sec === sec && !t.earned && t.goal > 0 && t.have < t.goal && (!best || t.goal - t.have < best.goal - best.have)) best = t;
  g.mdNext = { key, v: best };
  return best;
}
const mdPinAt = new Map(); // where each pin was last drawn on screen: a mint starts there
function drawNextPin(g, x, y, w, h, now, k) {
  if (mode !== "set" || state.time || picking() || !(g.set || g.chase)) return;
  const owned = ownedIn(g.base || g.cards), n = (g.base || g.cards).length;
  g.barAt = { x: x + w * (n ? owned / n : 0), y: y + h / 2, t: now }; // the end of the fill: where a medal from this set rises
  const t = mdNextOf(g); g.pinR = null; if (!t || !n || k < 0.4) return;
  const frac = clamp((owned + t.goal - t.have) / n, 0, 1), pw = clamp(20 * k, 14, 30), cx = clamp(x + w * frac, x + pw / 2, x + w - pw / 2);
  const tx = x + w * frac, top = y + h + 2 * k;
  ctx.fillStyle = MD_TIERS[t.tier][1]; ctx.globalAlpha *= 0.7; ctx.fillRect(tx - 0.75, y - 2 * k, 1.5, h + 4 * k); ctx.globalAlpha /= 0.7; // its notch on the bar
  drawMedal(ctx, t, cx, top, pw, "lit", 92, 32);
  g.pinR = { t, x: cx - pw / 2, y: top, w: pw, h: pw * 0.92 };
  mdPinAt.set(t.id, { x: cx, y: top + pw * 0.45, w: pw, t: now });
}
function pinHit(sx, sy) {
  const r = view === "set" && !state.trans ? state.g?.pinR : null; if (!r) return null;
  return Math.abs(sx - (r.x + r.w / 2)) <= Math.max(r.w / 2, 16) && sy >= r.y - 12 && sy <= r.y + r.h + 12 ? r.t : null;
}

// ----- the mint: the medal pops off the bar, shows its luck, and flies to the Medal room (bold's moment) -----
const mintQ = [], mintsOn = [];
const mdLuck = (t) => (t.rank === "shiny" ? 1000 : t.rank === "crit" ? 500 : 0) + mdTierIdx(t.tier) * 10 + (t.sig ? 3 : 0) + (t.complete ? 5 : 0);
function queueMints(list, cause) {
  const many = list.length > 1;
  let at = performance.now() + 240;
  for (const t of list.slice().sort((a, b) => mdLuck(a) - mdLuck(b))) { // the luckiest last
    mintQ.push({ t, at, cause, brief: many });
    at += reduced ? 1900 : 380 + (MD_RANK[t.rank] ? 1500 : many ? 850 : 1000);
  }
  kick();
}
// Where it rises from: its pin, else the end of its set's fill, else the card that tipped it, else mid-screen.
function mintFrom(q, now) {
  const p = mdPinAt.get(q.t.id);
  if (p && now - p.t < 400 && p.y > 0 && p.y < vh) return { x: p.x, y: p.y, w: p.w };
  const g = state.g, b = g && mdSecOf(g) === q.t.sec ? g.barAt : null;
  if (b && now - b.t < 400 && b.y > 0 && b.y < vh) return { x: b.x, y: b.y + 8, w: 14 };
  const r = q.cause && tileRectOf(q.cause);
  if (r && r.y + r.h > 0 && r.y < vh && r.x + r.w > 0 && r.x < vw) return { x: r.x + r.w / 2, y: clamp(r.y + Math.min(r.h * 0.3, 40), 80, vh - 120), w: clamp(r.w * 0.4, 10, 28) };
  return { x: vw / 2, y: vh * 0.5, w: 12 };
}
// Where the medal flies once minted: into the button at the top left (the rooms button, or Back in a set, in its place),
// the way up to the Medal room.
function doorTarget() {
  const b = upBtn()?.getBoundingClientRect();
  return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : { x: 32, y: -60 };
}
function startMint(q, now) {
  const from = mintFrom(q, now), W = 78, rank = MD_RANK[q.t.rank] ? q.t.rank : "";
  const tb = toastEl.classList.contains("show") ? toastEl.getBoundingClientRect().bottom : 0;
  const up = from.y - 100, lo = Math.max(topPad() + 110, tb + 70), hi = vh - botPad() - 110; // clear of the toast and the bars
  const hold = reduced ? { x: vw / 2, y: clamp(vh * 0.42, lo, hi) } : { x: clamp(from.x, 104, vw - 104), y: up >= lo ? up : clamp(from.y + 120, lo, hi) };
  if (!reduced) setTimeout(() => tick(rank === "shiny" ? [12, 40, 12, 40, 60] : rank === "crit" ? [16, 50, 30] : 18), 500);
  return { ...q, t0: now, from, hold, W, rank, A: 380, H: rank ? 1500 : q.brief ? 850 : 1000, F: 640 };
}
const mdBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const mdOut3 = (t) => 1 - Math.pow(1 - t, 3);
function drawMints(now) {
  if (!mintQ.length && !mintsOn.length) return false;
  if (document.body.classList.contains("listmode")) { mintQ.length = 0; mintsOn.length = 0; return false; }
  const can = !tbl.on && !wel.on && !bnd.on && !room.on;
  if (!can && !mintsOn.length) return false; // waiting for the room or the table to close
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (can) while (mintQ.length && mintQ[0].at <= now) mintsOn.push(startMint(mintQ.shift(), now));
  for (let i = mintsOn.length - 1; i >= 0; i--) if (drawMint(mintsOn[i], now)) mintsOn.splice(i, 1);
  ctx.globalAlpha = 1;
  return true;
}
function drawMint(m, now) {
  const p = now - m.t0, t = m.t;
  if (reduced) { // a still: it shows above the bar with its luck, and fades; nothing moves
    const total = 1800; if (p >= total) return true;
    const a = clamp(Math.min(p / 200, (total - p) / 300), 0, 1);
    ctx.globalAlpha = a; drawMedal(ctx, t, m.hold.x, m.hold.y - m.W * 0.5, m.W, "", 124, 96);
    mintLabel(m, m.hold.x, m.hold.y + m.W * 0.72, a, true);
    return false;
  }
  const { A, H, F, W, from, hold } = m;
  if (p >= A + H + F) return true;
  let cx, cy, size, alpha = 1, fx = 0, la = 0;
  if (p < A) { const e = clamp(mdBack(p / A), 0, 1.2), u = mdOut3(p / A); size = from.w + (W - from.w) * e; cx = from.x + (hold.x - from.x) * u; cy = from.y + (hold.y - from.y) * u; }
  else if (p < A + H) { size = W; cx = hold.x; cy = hold.y + Math.sin((p - A) / 260) * 1.5; la = clamp((p - A) / 180, 0, 1); fx = 1; }
  else {
    const q = (p - A - H) / F, e = q * q * (3 - 2 * q), T = doorTarget(), c = { x: hold.x + (T.x - hold.x) * 0.2, y: Math.min(hold.y, T.y) - 50 };
    const s = 1 - e; cx = s * s * hold.x + 2 * s * e * c.x + e * e * T.x; cy = s * s * hold.y + 2 * s * e * c.y + e * e * T.y;
    size = W + (14 - W) * e; alpha = q > 0.86 ? (1 - q) / 0.14 : 1; fx = clamp(1 - q * 5, 0, 1); la = clamp(1 - q * 6, 0, 1);
  }
  const revealed = p > A + 120, rv = p - A - 120;
  if (fx > 0) mintBurst(m, cx, cy, size, rv, fx, now);
  ctx.globalAlpha = alpha;
  drawMedal(ctx, revealed ? t : { ...t, rank: "" }, cx, cy - size * 0.5, size, "", 124, 96);
  if (la > 0) mintLabel(m, cx, cy + size * 0.74, la, revealed);
  return false;
}
// Behind the medal while it's up: a glow, then its luck (a starburst for Critical; a turning rainbow and sparkles for
// Shiny; a ring for a plain one).
function mintBurst(m, cx, cy, size, rv, fx, now) {
  const [hi] = MD_TIERS[m.t.tier] || MD_TIERS.gold, rank = m.rank;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.95); g.addColorStop(0, `${hi}AA`); g.addColorStop(1, `${hi}00`);
  ctx.globalAlpha = fx * 0.8; ctx.fillStyle = g; ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
  if (rv <= 0) return;
  if (rv < 420) { const q = rv / 420; ctx.globalAlpha = fx * (1 - q); ctx.lineWidth = 3 * (1 - q) + 1; ctx.strokeStyle = rank === "crit" ? "#FFCB05" : rank === "shiny" ? "#C77DFF" : hi; ctx.beginPath(); ctx.arc(cx, cy, size * (0.5 + q * 0.75), 0, Math.PI * 2); ctx.stroke(); }
  if (rank === "crit") {
    const q = clamp(rv / 240, 0, 1), R = size * (0.55 + 0.5 * mdOut3(q)), r0 = size * 0.44, rot = now * 0.0007;
    ctx.globalAlpha = fx * q; ctx.fillStyle = "#FFCB05"; ctx.strokeStyle = "#9A6A00"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = rot + (i / 12) * Math.PI * 2; ctx.moveTo(cx + Math.cos(a - 0.13) * r0, cy + Math.sin(a - 0.13) * r0); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a + 0.13) * r0, cy + Math.sin(a + 0.13) * r0); }
    ctx.fill(); ctx.stroke();
  } else if (rank === "shiny") {
    const q = clamp(rv / 300, 0, 1), rot = now * 0.002, R = size * 0.66;
    ctx.globalAlpha = fx * q; ctx.lineWidth = 4; ctx.lineCap = "round";
    MD_RAINBOW.forEach(([, col], i) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, rot + i * 1.2566, rot + i * 1.2566 + 0.95); ctx.stroke(); });
    ctx.lineCap = "butt";
    for (let i = 0; i < 5; i++) {
      const a = -rot * 0.6 + i * 1.2566, s = 0.45 + 0.4 * Math.sin(now * 0.008 + i * 1.7), x = cx + Math.cos(a) * size * 0.86, y = cy + Math.sin(a) * size * 0.86;
      ctx.globalAlpha = fx * q * clamp(s + 0.2, 0, 1); ctx.save(); ctx.translate(x, y); ctx.scale(s * size / 100, s * size / 100);
      ctx.fillStyle = "#FFF7B0"; ctx.strokeStyle = "#C99A00"; ctx.lineWidth = 1; const sp = mdP(mdSparkle(0, 0, 1.6)); ctx.fill(sp); ctx.stroke(sp); ctx.restore();
    }
  }
}
function mintLabel(m, cx, y, a, revealed) {
  const t = m.t, rank = revealed ? m.rank : "";
  const l1 = t.name, l2 = rank ? `${MD_RANK[rank]} · 1 in ${rank === "shiny" ? 100 : 10}` : t.chase || "";
  font(800, 15, true); const w1 = textW(l1); font(600, 11.5); const w2 = textW(l2);
  const w = Math.max(w1, w2) + 26, x = clamp(cx - w / 2, 8, vw - 8 - w);
  ctx.globalAlpha = a * 0.96; rr(x, y, w, 40, 10); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = rank === "crit" ? "#E0B000" : rank === "shiny" ? "#B58BF0" : theme["slot-line"]; ctx.stroke();
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.ink; font(800, 15, true); ctx.fillText(l1, x + w / 2, y + 18);
  ctx.fillStyle = rank === "crit" ? theme.gold : rank === "shiny" ? "#8E5BE8" : theme.muted; font(rank ? 700 : 600, 11.5); ctx.fillText(l2, x + w / 2, y + 33);
  ctx.textAlign = "left";
}

// ----- the trophy sheet: what it's for and the cards behind it, missing first (production's trophy card) -----
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
  if (rooms.map || PAGES[rooms.at]) goWallNow(); // from the map or a page: the wall first
  if (room.on && !inCase(g)) closeRoom(true);
  enterGroup(g, { then: c ? () => focus(c) : null });
}
mdSheet.addEventListener("click", (e) => {
  if (e.target.closest("[data-ms-close]")) { closeMedal(); return; }
  if (e.target.closest("[data-ms-open]")) { const t = medalList().byId.get(mdOpenId); if (t?.open) mdGo(mdGroupOf(t.open)); return; }
  const b = e.target.closest("[data-ci]"); if (!b) return;
  const c = pool[Number(b.dataset.ci)]; if (!c || mode !== "set") return;
  const g = groups[c.g]?.cards.includes(c) ? groups[c.g] : groups.find((x) => x.cards.includes(c));
  tick(4); mdGo(g, c);
});
mdScrim.addEventListener("click", () => closeMedal());
addEventListener("keydown", (e) => { if (e.key === "Escape" && !mdSheet.inert) { e.preventDefault(); e.stopImmediatePropagation(); closeMedal(); } }, true);

// ----- the celebration card: outside a set, or more than four at once (safe's), above the bars at the bottom -----
// It sits low so it never covers the toast or a set's title; a tap opens the medal, or the room when there are several.
const mdPop = document.createElement("button");
mdPop.type = "button"; mdPop.className = "mpop glass"; mdPop.id = "mpop"; mdPop.setAttribute("aria-live", "polite"); mdPop.tabIndex = -1;
document.body.append(mdPop);
const mdQueue = [];
let mdPopT = 0, mdPopList = [];
function mdCelebrateSoon() {
  clearTimeout(mdCelebrateSoon.t);
  if (wel.on || tbl.on || revealing() || document.body.classList.contains("welcoming")) { mdCelebrateSoon.t = setTimeout(mdCelebrateSoon, 1200); return; } // nor over the import's story or summary
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
  if (room.on) { if (view === "set" && state.g) exitToMosaic(); mScroll = 0; kick(); return; }
  if (state.focus) unfocus();
  if (view === "set" && state.g) { leaveBinderThen(state.g, () => openRoom()); return; }
  if (state.trans) finishTransition();
  openRoom();
}

// ----- the list: a medal as a row a screen reader can read -----
let mdListOpen = false;
const mdListRow = (t, svg = false) => `<li><button type="button" class="lmrow${t.earned ? "" : " locked"}" data-medal="${mdEsc(t.id)}">${svg ? medalSvg(t, { locked: !t.earned }) : `<i class="lm-dot tier-${t.tier}" aria-hidden="true"></i>`}<span class="lm-name">${mdEsc(t.name)}${t.sig ? ' <span class="lm-sig">signature</span>' : ""}</span><span class="lm-meta">${mdEsc(t.chase)}</span><span class="lm-state">${mdLucky(t) ? `<i class="rank-tag ${t.rank}">${MD_RANK[t.rank]}</i> ` : ""}${t.earned ? `Earned ${t.at ? mdDate(t.at) : ""}` : t.goal > 1 ? `${t.goal - t.have} to go` : "Not earned yet"}</span></button></li>`;
document.getElementById("list").addEventListener("click", (e) => { const b = e.target.closest("[data-medal]"); if (b) openMedal(b.dataset.medal); });
document.getElementById("list").addEventListener("toggle", (e) => { if (e.target.classList?.contains("lmed-later")) mdListOpen = e.target.open; }, true);
// Debug builds only: the tests' hook sees the medals.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { medals: { get: () => mdStore }, medalList: { value: medalList }, openMedal: { value: openMedal }, closeMedal: { value: closeMedal }, checkMedals: { value: checkMedals }, mdNextOf: { value: mdNextOf }, mdSecOf: { value: mdSecOf }, mintQ: { get: () => mintQ }, mintsOn: { get: () => mintsOn }, setMedalFilter: { value: (v) => { mdFilter = v; layoutAll(); kick(); } }, mdCelebrate: { value: mdCelebrate }, mdShelves: { value: mdShelves }, roomL: { get: () => room.L }, mdOpen: { get: () => mdOpen } }); }, 0);
