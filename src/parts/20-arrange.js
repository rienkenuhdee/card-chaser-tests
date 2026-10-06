// ---------- arrangements ----------
// The same cards, two ways to lay them out: the sets (and your chases), or price bands. A group is a block on the wall with a title and a grid of cards.
const BANDS = [[100, Infinity, "$100 and up", 2], [20, 100, "$20 to $100", 1.5], [5, 20, "$5 to $20", 1], [1, 5, "$1 to $5", 1], [0, 1, "Under $1", 1]];
const BAND_INK = ["#FF4F2E", "#E8B53A", "#BF9428", "#5C66A8", "#7A88A8"];
const worthOf = (list) => list.reduce((a, c) => a + (c.owned ? c.price : 0), 0);
const ownedIn = (list) => list.filter((c) => c.owned).length;
let mode = "set";
try { mode = ["set", "value"].includes(localStorage.getItem("wall-mode")) ? localStorage.getItem("wall-mode") : "set"; } catch { /* default */ }
let groups = [], setGroups = null, drawnCards = cards; // drawnCards: every card on the wall, a chase's twins included
function arrange(m) {
  mode = m;
  if (m === "set") {
    // The set panels are the same objects every time (an open binder stays valid); your chases follow them as panels of their own.
    setGroups ||= sets.map((st) => ({ key: st.id, name: st.name, ink: st.ink, cards: st.cards, set: st,
      sub: () => state.value ? `${st.year}. Yours is worth ${money(worthOf(st.cards))}` : state.lens === "need" ? `${st.year}. ${st.cards.length - ownedIn(st.cards)} to go` : `${st.year}. ${ownedIn(st.cards)} of ${st.cards.length}` }));
    groups = [...setGroups, ...chases.map((r, i) => chaseGroup(r, i))];
  } else {
    // Size is worth: the cards that cost the most take up the most wall.
    groups = BANDS.map(([lo, hi, name, sz], i) => ({ key: name, name, sz, ink: BAND_INK[i], cards: cards.filter((c) => c.price >= lo && c.price < hi).sort((a, b) => b.price - a.price) })).filter((g) => g.cards.length);
    for (const g of groups) g.sub = () => `${ownedIn(g.cards)} of ${g.cards.length}. Yours is worth ${money(worthOf(g.cards))}`;
  }
  groups.forEach((g, gi) => { g.gi = gi; g.sz ||= 1; g.cols = Math.max(1, Math.floor(COLS / g.sz)); g.cards.forEach((c, k) => { c.g = gi; c.k = k; }); });
  drawnCards = m === "set" && chases.length ? groups.flatMap((g) => g.base || g.cards) : cards;
  try { localStorage.setItem("wall-mode", m); } catch { /* fine */ }
}
