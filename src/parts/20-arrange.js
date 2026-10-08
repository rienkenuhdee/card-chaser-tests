// ---------- arrangements ----------
// The same cards, grouped four ways (Group by, in Filters): the sets (and your chases), price bands, rarity, or type. A
// group is a block on the wall with a title and a grid of cards, in the order picked for binders (60-lenses.js).
const BANDS = [[100, Infinity, "$100 and up", 2], [20, 100, "$20 to $100", 1.5], [5, 20, "$5 to $20", 1], [1, 5, "$1 to $5", 1], [0, 1, "Under $1", 1]];
const BAND_INK = ["#FF4F2E", "#E8B53A", "#BF9428", "#5C66A8", "#7A88A8"];
const worthOf = (list) => list.reduce((a, c) => a + (c.owned ? worthOne(c) : 0), 0); // a slab counts at its grade's ask (79-graded.js)
const ownedIn = (list) => list.filter((c) => c.owned).length;
const RARITY_GROUPS = [[6, "Special illustration rare", "#E8603C"], [5, "Secret rare", "#E9B524"], [4, "Ultra rare", "#A35BD6"], [3, "Holo rare", "#3D8BE8"], [2, "Rare", "#45A866"], [1, "Uncommon", "#5C66A8"], [0, "Common", "#7A88A8"]];
const showNow = () => (state.lens === "chase" ? "all" : state.show); // Show (Filters) is for the collection; Chase is its own view
let mode = "set"; // "value" is price bands
try { mode = ["set", "value", "rarity", "type"].includes(localStorage.getItem("wall-mode")) ? localStorage.getItem("wall-mode") : "set"; } catch { /* default */ }
const otherGroups = new Map(); // a price band, rarity or type keeps its object across arrangements, so an open binder stays the same group
function otherGroup(key, name, ink, list, sz = 1) {
  let g = otherGroups.get(key);
  if (!g) { g = { key }; otherGroups.set(key, g); g.sub = () => (state.value ? `Yours is worth ${money(worthOf(g.cards))}` : showNow() === "missing" ? `${g.cards.length - ownedIn(g.cards)} to go` : `${ownedIn(g.cards)} of ${g.cards.length}. Yours is worth ${money(worthOf(g.cards))}`); }
  Object.assign(g, { name, ink, sz, cards: list });
  return g;
}
let groups = [], setGroups = null, drawnCards = cards; // drawnCards: every card on the wall, a chase's twins included
function arrange(m) {
  mode = m;
  if (m === "set") {
    // The set panels are the same objects every time (an open binder stays valid); your chases follow them as panels of their own.
    setGroups ||= sets.map((st) => { const g = { key: st.id, name: st.name, ink: st.ink, cards: st.cards, base: st.cards, set: st }; g.sub = () => { const list = g.base, view = scopeOf(st) === "set" ? "" : scopeOf(st) === "master" ? " Master set." : " Grand set."; return state.value ? `${st.year}.${view} Yours is worth ${money(worthOf(list))}` : showNow() === "missing" ? `${st.year}.${view} ${list.length - ownedIn(list)} to go` : `${st.year}.${view} ${ownedIn(list)} of ${list.length}`; }; return g; });
    for (const g of setGroups) g.cards = g.base = scopedCards(g.set); // the set, its master set, or its grand set
    groups = [...setGroups, ...chases.map((r, i) => chaseGroup(r, i))];
  } else if (m === "value") {
    // Size is worth: the cards that cost the most take up the most wall.
    groups = BANDS.map(([lo, hi, name, sz], i) => otherGroup(`band:${name}`, name, BAND_INK[i], cards.filter((c) => c.price >= lo && c.price < hi).sort((a, b) => b.price - a.price), sz)).filter((g) => g.cards.length);
  } else if (m === "rarity") {
    // Rarest first, as production sorts rarity; each holds its cards in set order.
    groups = RARITY_GROUPS.map(([t, name, ink]) => otherGroup(`rarity:${t}`, name, ink, cards.filter((c) => c.tier === t))).filter((g) => g.cards.length);
  } else {
    // By type, in the order the cards print them, each panel in its type's colour.
    groups = Object.entries(TYPE).map(([k, [name, ink]]) => otherGroup(`type:${k}`, name, ink, cards.filter((c) => (TYPE[c.type] ? c.type : "C") === k))).filter((g) => g.cards.length);
  }
  // The order in a binder (Filters): number, price, name or rarity. The Complete Dex keeps Dex order.
  for (const g of groups) if (!g.natdex) { const s = binderSorted(g.base || g.cards); if (g.base) g.base = s; g.cards = s; }
  groups.forEach((g, gi) => { g.gi = gi; g.sz ||= 1; g.cols = Math.max(1, Math.floor(COLS / g.sz)); g.cards.forEach((c, k) => { c.g = gi; c.k = k; }); });
  drawnCards = m === "set" ? groups.flatMap((g) => g.base || g.cards) : cards;
  try { localStorage.setItem("wall-mode", m); } catch { /* fine */ }
}
