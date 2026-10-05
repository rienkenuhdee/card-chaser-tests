const RAR = { c: ["Common", 0], u: ["Uncommon", 1], r: ["Rare", 2], h: ["Rare Holo", 3], s: ["Secret Rare", 5], v: ["Rare Holo V", 3], x: ["Rare Holo VMAX", 4], U: ["Ultra Rare", 4], w: ["Rainbow Rare", 5], d: ["Double Rare", 3], i: ["Illustration Rare", 4], S: ["Special Illustration Rare", 6], y: ["Hyper Rare", 5], a: ["ACE SPEC Rare", 3], m: ["Mega Hyper Rare", 6], p: ["Pikachu Rare", 4], f: ["Futuristic Rare", 5] };
const TYPE = { F: ["Fire", "#D2553A"], W: ["Water", "#2E74C8"], G: ["Grass", "#3B925A"], L: ["Lightning", "#D29E1F"], P: ["Psychic", "#8A50BE"], X: ["Fighting", "#A95F36"], D: ["Darkness", "#373B55"], M: ["Metal", "#768397"], N: ["Dragon", "#A07D22"], Y: ["Fairy", "#C9659D"], C: ["Colorless", "#958F7E"], t: ["Trainer", "#5F6C8A"], e: ["Energy", "#7E879E"] };
const GLYPH = ["●", "◆", "★", "★H", "★★", "★★", "★★★"];
const SET_INK = { base1: "#E8603C", base2: "#45A866", base3: "#A35BD6", base5: "#4A4F72", neo1: "#E9B524", swsh7: "#3D8BE8", sv3pt5: "#E8603C", sv8pt5: "#A35BD6", me5: "#4A4F72", me55: "#E9B524" };
const OWN_RATE = { base1: 0.62, base2: 0.48, base3: 0.7, base5: 0.36, neo1: 0.28, swsh7: 0.3, sv3pt5: 0.82, sv8pt5: 0.44, me5: 0.16, me55: 0.1 };
const SPECIAL = { "base1-4": 395, "base1-2": 142, "base1-15": 96, "base5-83": 210, "neo1-9": 160, "neo1-17": 90, "swsh7-215": 1350, "swsh7-218": 640, "swsh7-212": 420, "sv3pt5-199": 265, "sv3pt5-205": 140, "sv8pt5-161": 980, "sv8pt5-156": 260, "me55-B": 120, "me55-R": 120, "me55-G": 120 };

// Illustrators are made up for the demo (real names, seeded per card), so an artist chase has something to show.
const ARTISTS = ["Mitsuhiro Arita", "Ken Sugimori", "Kagemaru Himeno", "Atsuko Nishida", "Kouki Saitou", "Ryo Ueda", "5ban Graphics", "Naoki Saito", "Hideki Ishikawa", "Tomokazu Komiya", "Sowsow", "Yuka Morii", "Keiko Fukuyama", "Shin Nagasawa", "Masakazu Fukuda", "Kyoko Umemoto"];
const h32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const money = (v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const short = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v >= 100 ? `$${Math.round(v)}` : v >= 10 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);
const tick = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* none */ } };

let saved = {};
try { saved = JSON.parse(localStorage.getItem("wall-owned") || "{}") || {}; } catch { saved = {}; }
const persist = () => { try { localStorage.setItem("wall-owned", JSON.stringify(saved)); } catch { /* private mode */ } };

// ---------- cards ----------
const sets = DATA.map(([id, name, date, printed, enc, code], si) => ({ si, id, name: name === "Base" ? "Base Set" : name, year: Number(date.slice(0, 4)), released: Date.parse(date.replace(/\//g, "-")), printed, code, ink: SET_INK[id] || "#7A88A8", cards: [] }));
const cards = [];
sets.forEach((st, si) => {
  DATA[si][4].split(";").forEach((row, k) => {
    const [name, num, r, t, dex] = row.split("|");
    const id = `${st.id}-${num}`;
    const [rname, tier] = RAR[r] || RAR.c;
    const vintage = st.year < 2003;
    const ranges = [[0.1, 0.4], [0.15, 0.8], [0.6, 3], [3, 25], [6, 45], [12, 90], [35, 420]];
    const [lo, hi] = ranges[tier];
    let price = lo + (hi - lo) * Math.pow(h32(id + "p"), 2.2);
    if (vintage) price *= tier >= 3 ? 3.2 : tier === 2 ? 1.8 : 1.4;
    if (SPECIAL[id]) price = SPECIAL[id];
    price = Math.round(price * 100) / 100;
    const own0 = h32(id + "o") < clamp(OWN_RATE[st.id] * (tier <= 1 ? 1.3 : tier === 2 ? 1 : tier === 3 ? 0.66 : 0.32), 0, 0.97);
    const mark = saved[id];
    // The wall starts empty: only your own marks count. The seeded ownership (own0) is what an import brings in.
    const owned = mark == null ? false : typeof mark === "object" ? mark.on : Boolean(mark);
    // When you got it (made up for the demo): most of the vintage came in one day, the childhood binder found again;
    // modern cards trickle in from release. Cards you mark yourself are dated the moment you mark them.
    const START = Date.parse("2023-01-15"), NOW = Date.now(), BINDER = Date.parse("2024-03-09");
    let got = null;
    if (owned) {
      if (mark && typeof mark === "object" && mark.at) got = mark.at;
      else if (vintage && h32(id + "g") < 0.72) got = BINDER + h32(id + "h") * 6 * 3600e3;
      else { const from = Math.max(START, st.released || START); got = from + Math.pow(h32(id + "t"), 0.8) * Math.max(0, NOW - from - 86400e3); }
    }
    const dr = h32(id + "d");
    // A deal is a live copy for less than the card's price; a floor-priced common at or over market isn't one.
    let deal = !own0 && dr < 0.07 ? Math.max(0.25, Math.round(price * (0.55 + 0.3 * h32(id + "e")) * 100) / 100) : null;
    if (deal !== null && deal >= price) deal = null;
    const c = { i: cards.length, si, k, id, name, num, rname, tier, type: t, dex: Number(dex) || 0, price, owned, got, deal, own0, artist: ARTISTS[Math.floor(h32(id + "a") * ARTISTS.length)], x: 0, y: 0, sz: 1, col: 0, row: 0, e: 1, anim: null, intro: 0 };
    cards.push(c); st.cards.push(c);
  });
});
const TOTAL = cards.length;
