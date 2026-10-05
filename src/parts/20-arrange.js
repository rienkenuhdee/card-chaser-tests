// ---------- arrangements ----------
// The same cards, three ways to lay them out. A group is a block on the wall with a title and a grid of cards.
const GEN = [[1, 151, "Kanto"], [152, 251, "Johto"], [252, 386, "Hoenn"], [387, 493, "Sinnoh"], [494, 649, "Unova"], [650, 721, "Kalos"], [722, 809, "Alola"], [810, 905, "Galar"], [906, 1025, "Paldea"]];
const GEN_INK = ["#E8603C", "#E9B524", "#45A866", "#3D8BE8", "#4A4F72", "#E27AB3", "#BF6E3E", "#A35BD6", "#BF9428"];
const BANDS = [[100, Infinity, "$100 and up", 2], [20, 100, "$20 to $100", 1.5], [5, 20, "$5 to $20", 1], [1, 5, "$1 to $5", 1], [0, 1, "Under $1", 1]];
const BAND_INK = ["#FF4F2E", "#E8B53A", "#BF9428", "#5C66A8", "#7A88A8"];
const worthOf = (list) => list.reduce((a, c) => a + (c.owned ? c.price : 0), 0);
const ownedIn = (list) => list.filter((c) => c.owned).length;
let mode = "set";
try { mode = ["set", "pokemon", "artist", "value"].includes(localStorage.getItem("wall-mode")) ? localStorage.getItem("wall-mode") : "set"; } catch { /* default */ }
let groups = [];
function arrange(m) {
  mode = m;
  if (m === "set") {
    groups = sets.map((st) => ({ key: st.id, name: st.name, ink: st.ink, cards: st.cards, set: st,
      sub: () => state.value ? `${st.year}. Yours is worth ${money(worthOf(st.cards))}` : state.lens === "need" ? `${st.year}. ${st.cards.length - ownedIn(st.cards)} to go` : `${st.year}. ${ownedIn(st.cards)} of ${st.cards.length}` }));
  } else if (m === "pokemon") {
    // The Dex view: every Pokémon card by region and Dex number, oldest print first. A Pokémon counts once you own any card of it.
    const byGen = GEN.map(([lo, hi, name], i) => ({ key: name, name, ink: GEN_INK[i], cards: cards.filter((c) => c.dex >= lo && c.dex <= hi).sort((a, b) => a.dex - b.dex || sets[a.si].year - sets[b.si].year || a.i - b.i) }));
    const rest = { key: "other", name: "Trainers and Energy", ink: "#7A88A8", cards: cards.filter((c) => !c.dex) };
    groups = [...byGen, rest].filter((g) => g.cards.length);
    for (const g of groups) g.sub = () => {
      if (!g.cards[0].dex) return `${ownedIn(g.cards)} of ${g.cards.length} cards`;
      const species = new Set(g.cards.map((c) => c.dex)), have = new Set(g.cards.filter((c) => c.owned).map((c) => c.dex));
      return state.value ? `Yours is worth ${money(worthOf(g.cards))}` : `${have.size} of ${species.size} Pokémon, ${ownedIn(g.cards)} of ${g.cards.length} cards`;
    };
  } else if (m === "artist") {
    // The artist chase: every illustrator's cards together, most cards first.
    groups = ARTISTS.map((name, i) => ({ key: name, name, ink: GEN_INK[i % GEN_INK.length], cards: cards.filter((c) => c.artist === name).sort((a, b) => sets[a.si].year - sets[b.si].year || a.i - b.i) })).filter((g) => g.cards.length).sort((a, b) => b.cards.length - a.cards.length);
    for (const g of groups) g.sub = () => state.value ? `Yours is worth ${money(worthOf(g.cards))}` : `${ownedIn(g.cards)} of ${g.cards.length} cards`;
  } else {
    // Size is worth: the cards that cost the most take up the most wall.
    groups = BANDS.map(([lo, hi, name, sz], i) => ({ key: name, name, sz, ink: BAND_INK[i], cards: cards.filter((c) => c.price >= lo && c.price < hi).sort((a, b) => b.price - a.price) })).filter((g) => g.cards.length);
    for (const g of groups) g.sub = () => `${ownedIn(g.cards)} of ${g.cards.length}. Yours is worth ${money(worthOf(g.cards))}`;
  }
  groups.forEach((g, gi) => { g.gi = gi; g.sz ||= 1; g.cols = Math.max(1, Math.floor(COLS / g.sz)); g.cards.forEach((c, k) => { c.g = gi; c.k = k; }); });
  try { localStorage.setItem("wall-mode", m); } catch { /* fine */ }
}
