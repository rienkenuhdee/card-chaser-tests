// ---------- round 23, safe: Bauhaus inks (data, before anything reads it) ----------
// Pokémon types need a dozen hues to tell apart, more than three primaries can carry. They come from the Bauhaus's own
// colour theory instead (Itten's twelve-part wheel, plus black and greys): the primaries sit where the types already
// were (Fire red, Water blue, Lightning yellow), and the rest are the wheel's secondaries and tertiaries, flat.
Object.assign(TYPE, {
  F: ["Fire", "#D7261E"], W: ["Water", "#1F4FA0"], L: ["Lightning", "#F2B705"], G: ["Grass", "#2E8540"],
  P: ["Psychic", "#74399A"], X: ["Fighting", "#E36F1E"], D: ["Darkness", "#2B2A28"], M: ["Metal", "#8F8C84"],
  N: ["Dragon", "#A07E12"], Y: ["Fairy", "#D2558A"], C: ["Colorless", "#B7AE98"], t: ["Trainer", "#4C5A73"], e: ["Energy", "#77746C"],
});
// A set's ink (its bar, its medal's ribbon) is one of the three primaries or black, so neighbours on the wall differ.
const BH_INK = { red: "#D7261E", yellow: "#F2B705", blue: "#1F4FA0", black: "#141414" };
const BH_SET = { base1: "red", base2: "yellow", base3: "blue", base5: "black", neo1: "red", swsh7: "blue", sv3pt5: "red", sv8pt5: "yellow", me5: "black", me55: "blue" };
for (const k of Object.keys(SET_INK)) SET_INK[k] = BH_INK[BH_SET[k] || "blue"];
for (const st of sets) if (BH_SET[st.id]) { st.ink = BH_INK[BH_SET[st.id]]; st.bhBlack = BH_SET[st.id] === "black"; }
