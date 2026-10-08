// ---------- the Feed: every listing found for the cards you chase (round 21) ----------
// Two lists, two jobs. The Chase lens on the wall is your want list: one tile for each card you chase, its best deal
// leading, or the most you'd pay. The Feed is the stream: every listing found for those cards, newest first, several
// for one card where several are out there, each with where it was found, how long ago, its score (production's,
// 0 to 100), and NEW since your last visit (and never more than three days old, production's rule; leaving the Feed
// clears it). Tap a listing and the listing's own sheet opens: its photo, its title as the seller wrote it, the price
// and how the market price was worked out (production's price proof), the score and why, Open the listing, and a
// line to your card only as a link.
// Made up for the demo, seeded by card id so variants compare: every deal the wall starts with is listed with a
// source, an age, a condition and a seller; some cards have other copies listed too, dearer than the best; a live
// arrival (72-live.js) lands on top, and a price drop moves its listing up with the old price struck through.

const FEED_T0 = Date.now();
for (const c of cards) c.deal0 = c.deal; // the deals the wall starts with (a live arrival brings its own)
// ----- where it looks (production's sources; the shops are made up) -----
const SRC = [
  { id: "ebay", name: "eBay", group: "Marketplaces", w: 0.52, line: "Every card you chase, searched every 30 minutes" },
  { id: "tcgplayer", name: "TCGplayer lowest listing", short: "TCGplayer", group: "Marketplaces", w: 0.18, line: "The cheapest copy on TCGplayer, when it beats market by 15% or more" },
  { id: "reddit", name: "Reddit trade posts", short: "Reddit", group: "Marketplaces", w: 0.12, line: "New [H] posts on r/pkmntcgtrades and r/PokemonCardValue, read line by line" },
  { id: "local", name: "Local listings", short: "Local", group: "Marketplaces", w: 0.06, line: "Craigslist and Facebook Marketplace near you" },
  { id: "shop-a", name: "Northside Cards", group: "Card shops", w: 0.07, line: "Reading their product feed, 214 Pokémon items" },
  { id: "shop-b", name: "Sleeve & Binder Co.", short: "Sleeve & Binder", group: "Card shops", w: 0.05, line: "Watching their site for new singles" },
];
const SRC_BY = new Map(SRC.map((s) => [s.id, s]));
const srcName = (id, brief = false) => { const s = SRC_BY.get(id); return brief ? s.short || s.name : s.name; };
const srcState = { off: new Set(), alerts: false, ver: 0 };
try { const s = JSON.parse(localStorage.getItem("wall-sources-off") || "null"); if (s) { srcState.off = new Set(s.off || []); srcState.alerts = Boolean(s.alerts); } } catch { /* fresh */ }
const saveSources = () => { srcState.ver++; try { localStorage.setItem("wall-sources-off", JSON.stringify({ off: [...srcState.off], alerts: srcState.alerts })); } catch { /* private mode */ } };
const srcOn = (id) => !srcState.off.has(id);
const scan = { last: Date.now(), next: Date.now() + 6000 }; // the looks: when the last was, when the next is (72-live.js)
const finds = []; // what this visit's looks found, newest first: { L, at }

// ----- a listing, seeded by card id: where, how, who, what condition the title says, and the title itself -----
const SELLERS = ["pokemon_singles", "kanto_kollects", "vintagevault_cards", "mintmarket_tcg", "slabs_and_singles", "the_card_attic", "pallet_town_tcg", "cardboard_castle"];
const FAV_SELLER = "pokemon_singles"; // a favourite seller (Source): its listings are checked every look and score higher
const REDDITORS = ["holo_hunter", "binderbound", "rarecandy_rob", "shadowless_sam", "gym_leader_gwen"], SUBS = ["pkmntcgtrades", "PokemonCardValue"];
const LOCALS = ["Craigslist, Chico", "Facebook Marketplace, Oroville", "Facebook Marketplace, Paradise", "Craigslist, Redding"];
const CONDITIONS = [["NM", "Near Mint", 1], ["LP", "Lightly Played", 0.9], ["MP", "Moderately Played", 0.75], ["HP", "Heavily Played", 0.55], ["DMG", "Damaged", 0.35]]; // production's, and its price scales
const condOf = (code) => CONDITIONS.find((x) => x[0] === code);
const round2 = (v) => Math.round(v * 100) / 100;
const seededAt = (c, k) => FEED_T0 - (0.4 + 150 * Math.pow(h32(`${c.id}|L${k}|age`), 1.3)) * 3600e3; // up to six days ago, most of them recent
const lsMemo = new Map();
function srcFor(c, k) { const sr = h32(`${c.id}|L${k}|src`); let acc = 0; for (const s of SRC) { acc += s.w; if (sr < acc) return s.id; } return "ebay"; }
// ----- slabs (parity 2): some eBay copies are graded, seeded by listing id. Never the card's best listing: that one is
// the deal on the wall, a raw copy. A slab is priced against what its grade asks (79-graded.js), not the raw market. -----
const SLAB_RATE = 0.27; // of the dearer eBay copies: about one eBay listing in seven overall
const SLAB_GRADES = [["PSA", 10, 0.3], ["PSA", 9, 0.22], ["PSA", 8, 0.08], ["BGS", 9.5, 0.1], ["BGS", 9, 0.05], ["CGC", 10, 0.08], ["CGC", 9, 0.05], ["SGC", 10, 0.05], ["SGC", 9, 0.03], ["TAG", 10, 0.04]];
function slabFor(c, k) {
  if (k < 1 || srcFor(c, k) !== "ebay") return null;
  const r = (x) => h32(`${c.id}~${k}|slab|${x}`);
  if (r("is") >= SLAB_RATE) return null;
  let acc = 0; const q = r("g");
  for (const [co, grade, w] of SLAB_GRADES) { acc += w; if (q < acc) return { co, grade }; }
  return { co: "PSA", grade: 10 };
}
const refOf = (L) => (L.grade ? gradeAsk(L.c, L.grade.co, L.grade.grade) : L.c.price); // what a listing is priced against
const refName = (L) => (L.grade ? `${slabText(L.grade)} ask` : "market price");
function makeListing(c, k, price) {
  const r = (x) => h32(`${c.id}|L${k}|${x}`), st = sets[c.si], vintage = st.year < 2003, src = srcFor(c, k);
  const L = { id: `${c.id}~${k}`, c, k, src, price, how: "", bestOffer: false, fav: false, ship: null, cond: null, seller: "", fb: null, fbN: null, endsAt: 0, bids: 0, sub: "", grade: slabFor(c, k) };
  const cr = r("cond");
  L.cond = L.grade ? null : cr < 0.5 ? "NM" : cr < 0.68 ? "LP" : cr < 0.74 ? "MP" : cr < 0.76 ? "HP" : null; // the condition the title states, if it does (a slab's grade is its condition)
  if (src === "ebay") {
    const h = r("how");
    L.how = h < 0.66 ? "Buy It Now" : h < 0.86 ? "Auction" : "Buy It Now";
    L.bestOffer = h >= 0.86;
    L.seller = SELLERS[Math.floor(r("sel") * SELLERS.length)]; L.fav = L.seller === FAV_SELLER;
    L.fb = r("fb") < 0.06 ? 94 + Math.floor(r("fbp") * 3) : 98 + Math.round(r("fbp") * 20) / 10; L.fbN = 40 + Math.floor(Math.pow(r("fbn"), 2) * 4800);
    const s = r("ship"); L.ship = s < 0.42 ? 0 : s < 0.9 ? round2(0.99 + r("shp") * 4) : null;
    if (L.how === "Auction") { L.endsAt = FEED_T0 + (0.6 + r("end") * 70) * 3600e3; L.bids = Math.floor(r("bid") * 9); L.ship = L.ship ?? 0.99; }
  } else if (src === "tcgplayer") { L.how = "Lowest listing"; L.cond = null; L.seller = ["CardCove", "PokeMart Direct", "GemMint Games"][Math.floor(r("sel") * 3)]; L.ship = null; }
  else if (src === "reddit") { L.how = "Trade post"; L.sub = SUBS[Math.floor(r("sub") * SUBS.length)]; L.seller = `u/${REDDITORS[Math.floor(r("sel") * REDDITORS.length)]}`; L.ship = round2(1 + Math.floor(r("shp") * 4)); }
  else if (src === "local") { L.how = "Local pickup"; L.seller = LOCALS[Math.floor(r("sel") * LOCALS.length)]; L.ship = "local"; }
  else { L.how = "In stock"; L.seller = srcName(src); L.ship = price >= 25 ? 0 : 4.99; }
  // the title, as a seller would write it
  const num = `${c.num}/${st.printed}`, cw = L.cond ? { NM: r("cw") < 0.5 ? "NM" : "Near Mint", LP: r("cw") < 0.5 ? "LP" : "Lightly Played", MP: "MP", HP: "Heavily Played" }[L.cond] : "";
  if (src === "ebay" && L.grade) L.title = `${r("caps") < 0.3 ? c.name.toUpperCase() : c.name} ${num} ${st.name} ${c.rname}${vintage ? ` ${st.year}` : ""} ${slabText(L.grade)}${L.grade.grade === 10 ? (L.grade.co === "PSA" ? " GEM MINT" : " PRISTINE") : ""} Pokemon`;
  else if (src === "ebay") L.title = `${r("caps") < 0.3 ? c.name.toUpperCase() : c.name} ${num} ${st.name} ${c.rname}${vintage ? (r("wotc") < 0.6 ? " WOTC" : "") + ` ${st.year}` : ""} Pokemon Card${cw ? ` ${cw}` : ""}`;
  else if (src === "tcgplayer") L.title = `${c.name} - ${num} - ${c.rname}`;
  else if (src === "reddit") L.title = `[US-CA] [H] ${c.name} ${st.code} ${num}${cw ? ` ${cw}` : ""} [W] PayPal`;
  else if (src === "local") L.title = `pokemon cards ${c.name.toLowerCase()} ${st.name.toLowerCase()}${r("lot") < 0.5 ? " must go" : ""}`;
  else L.title = `${c.name} (${num}) [${st.name}]${cw ? ` - ${cw}` : ""}`;
  return L;
}
function listingOf(c, k, price) {
  const key = `${c.id}~${k}|${price}`;
  let L = lsMemo.get(key);
  if (!L) { L = makeListing(c, k, price); if (lsMemo.size > 4000) lsMemo.clear(); lsMemo.set(key, L); }
  return L;
}
// Every listing for one card you chase: its best (the deal on the wall), and for the deals the wall started with,
// sometimes one or two dearer copies (still under market).
function listingsOf(c) {
  if (!c.deal || c.owned || !isChase(c)) return [];
  const main = listingOf(c, 0, c.deal);
  main.was = c.dealWas || null;
  main.at = c.listedAt || (c.deal0 != null ? seededAt(c, 0) : c.dealAt || FEED_T0);
  main.dropAt = c.dealWas ? c.dealAt : 0;
  main.seen = Math.max(main.at, main.dropAt || 0);
  const out = [main];
  if (c.deal0 != null) {
    const r0 = h32(`${c.id}|Ln`), n = r0 < 0.5 ? 0 : r0 < 0.82 ? 1 : 2;
    for (let k = 1; k <= n; k++) {
      const gr = slabFor(c, k), ref = gr ? gradeAsk(c, gr.co, gr.grade) : c.price, p = round2(ref * (0.7 + 0.26 * h32(`${c.id}|L${k}|p`)));
      if (gr ? p >= ref * 0.97 : p <= c.deal + 0.01 || p >= c.price * 0.97) continue;
      const L = listingOf(c, k, p); L.was = null; L.at = L.seen = seededAt(c, k); L.dropAt = 0;
      out.push(L);
    }
  }
  return out;
}
// ----- the Feed's own filters and sort (kept on this device): production's condition and damaged rules -----
// Condition filters by what a listing's title states (a title that doesn't say still shows, as in production). A
// damaged or heavily played copy stays hidden unless you pick "Any, damaged too" (production's separate switch; it only
// matters with any condition, so it's the last choice of the same picker). The filter counts everywhere the Feed is
// counted (the rooms button, the map), like a source switched off. The sort is only how the page reads.
const FEED_SORT_IDS = ["newest", "best", "ending", "price", "priceDesc", "pct", "savings", "shops", "local", "seller", "freeShip", "card"];
const FEED_F0 = { src: "", how: "", slab: "", gco: "", gmin: "", off: "", fresh: "", max: "", free: false, fav: false, soon: false }; // the Filters panel (production's, where the listings carry it)
const feedView = { sort: "newest", cond: "", ...FEED_F0, v: 0 }; // cond: "" any but damaged, NM, LP or MP and better, "any" damaged too
try {
  const v = JSON.parse(localStorage.getItem("wall-feed-view") || "null");
  if (v) {
    Object.assign(feedView, { sort: FEED_SORT_IDS.includes(v.sort) ? v.sort : "newest", cond: ["", "NM", "LP", "MP", "any"].includes(v.cond) ? v.cond : "" });
    for (const k of Object.keys(FEED_F0)) if (typeof v[k] === typeof FEED_F0[k]) feedView[k] = v[k];
  }
} catch { /* fresh */ }
const COND_RANK = { NM: 0, LP: 1, MP: 2, HP: 3, DMG: 4 };
const damagedL = (L) => L.cond === "HP" || L.cond === "DMG";
const totalOf = (L) => L.price + (typeof L.ship === "number" ? L.ship : 0);
const feedFiltersOn = () => Object.keys(FEED_F0).filter((k) => feedView[k] !== FEED_F0[k]).length;
function feedPass(L) {
  const f = feedView, now = Date.now();
  if (!L.grade && !(f.cond === "any" || (f.cond ? !L.cond || COND_RANK[L.cond] <= COND_RANK[f.cond] : !damagedL(L)))) return false; // a slab's grade is its condition
  if (f.slab === "raw" && L.grade) return false;
  if (f.slab === "graded" && !L.grade) return false;
  if ((f.gco || f.gmin) && !L.grade) return false;
  if (f.gco && L.grade.co !== f.gco) return false;
  if (f.gmin && L.grade.grade < +f.gmin) return false;
  if (f.src && (f.src === "shops" ? !L.src.startsWith("shop") : L.src !== f.src)) return false;
  if (f.how === "auction" && L.how !== "Auction") return false;
  if (f.how === "fixed" && L.how === "Auction") return false;
  if (f.how === "offer" && !L.bestOffer) return false;
  if (f.off && pctOf(L) < +f.off) return false;
  if (f.fresh && now - L.seen > +f.fresh * 3600e3) return false;
  if (f.max !== "" && +f.max > 0 && totalOf(L) > +f.max) return false;
  if (f.free && L.ship !== 0) return false;
  if (f.fav && !L.fav) return false;
  if (f.soon && !(L.endsAt > now && L.endsAt - now <= 6 * 3600e3)) return false;
  return true;
}
const byScoreL = (a, b) => scoreOf(b).score - scoreOf(a).score;
const FEED_SORTS = {
  best: byScoreL,
  ending: (a, b) => (a.endsAt || Infinity) - (b.endsAt || Infinity) || byScoreL(a, b),
  price: (a, b) => a.price - b.price, // the price the row shows
  priceDesc: (a, b) => b.price - a.price,
  pct: (a, b) => pctOf(b) - pctOf(a),
  savings: (a, b) => (refOf(b) - b.price) - (refOf(a) - a.price),
  shops: (a, b) => b.src.startsWith("shop") - a.src.startsWith("shop") || byScoreL(a, b),
  local: (a, b) => ["local", "reddit"].includes(b.src) - ["local", "reddit"].includes(a.src) || byScoreL(a, b),
  seller: (a, b) => (b.fb ?? -1) - (a.fb ?? -1) || byScoreL(a, b),
  freeShip: (a, b) => (b.ship === 0) - (a.ship === 0) || byScoreL(a, b),
  card: (a, b) => a.c.name.localeCompare(b.c.name) || a.price - b.price,
};
const FEED_ORDER = { newest: "newest first", best: "best deals first", ending: "ending soonest first", price: "cheapest first", priceDesc: "dearest first", pct: "most under market first", savings: "biggest savings first", shops: "shops first", local: "local and trades first", seller: "best seller feedback first", freeShip: "free shipping first", card: "by card name" };
const feedSorted = (list) => (FEED_SORTS[feedView.sort] ? [...list].sort((a, b) => FEED_SORTS[feedView.sort](a, b) || b.seen - a.seen) : list);
// The Feed: every listing from a source that's on and past its filters, newest first. counts: listings per source,
// on or off; hidden: how many the filters keep out (from the sources that are on).
function feedList(counts = null, hidden = null) {
  const out = [];
  for (const c of cards) for (const L of listingsOf(c)) {
    if (counts) counts[L.src] = (counts[L.src] || 0) + 1;
    if (!srcOn(L.src)) continue;
    if (feedPass(L)) out.push(L); else if (hidden) hidden.n++;
  }
  return out.sort((a, b) => b.seen - a.seen || a.c.i - b.c.i || a.k - b.k);
}
let feedMemo = { key: "", v: null };
function feedData() { // once a frame at most, for the map's cards
  const key = `${lastFrame}|${srcState.ver}|${copiesKey}|${scan.last}|${wallVer}|${feedView.cond}|${feedView.v}`;
  if (feedMemo.key === key) return feedMemo.v;
  const counts = {}, list = feedList(counts), chased = cards.filter(isChase).length;
  feedMemo = { key, v: { list, counts, chased, fresh: list.filter(isNewL).length } };
  return feedMemo.v;
}
const pctOf = (L) => Math.round((1 - L.price / refOf(L)) * 100);

// ----- NEW: listed (or dropped) since your last visit, and never more than three days old -----
let feedSeenAt = 0;
try { feedSeenAt = Number(localStorage.getItem("wall-feed-seen")) || 0; } catch { feedSeenAt = 0; }
let feedFrom = feedSeenAt; // while you're in the Feed: when your last visit ended
const inFeed = () => rooms.at === "feed" && !rooms.map;
const isNewL = (L) => L.seen > Math.max(inFeed() ? feedFrom : feedSeenAt, Date.now() - 3 * DAY);
const feedNewCount = () => feedList().filter(isNewL).length;
function feedEnter() { feedFrom = feedSeenAt; renderFeed(); pgFeed.scrollTop = 0; }
function feedLeave() { feedSeenAt = Date.now(); feedFrom = feedSeenAt; try { localStorage.setItem("wall-feed-seen", String(feedSeenAt)); } catch { /* private mode */ } syncBadge(); }
addEventListener("pagehide", () => { if (inFeed()) feedLeave(); });

// ----- production's score (0 to 100), line by line: about 40 is a fair price, 80 and up a standout -----
function scoreOf(L) {
  const ageH = Math.floor((Date.now() - L.at) / 3600e3), key = `${L.price}|${ageH}|${srcOn(L.src)}`;
  if (L.sc?.key === key) return L.sc;
  const M = marketL(L), pct = pctOf(L), parts = [{ key: "start", label: "Starting point", pts: 40, note: "Every listing starts here: about the market price." }];
  let score = 40;
  const add = (k, label, pts, note) => { score += pts; parts.push({ key: k, label, pts, note }); };
  const shaky = M.conf === "low", why = [];
  if (L.how === "Auction") why.push("it's an auction, and bids usually climb (counts 60%)");
  if (shaky) why.push("the market price rests on little data (counts half)");
  if (L.src === "tcgplayer") why.push("TCGplayer's lowest listing can be any condition (counts 60%)");
  const weight = (L.how === "Auction" ? 0.6 : 1) * (shaky ? 0.5 : 1) * (L.src === "tcgplayer" ? 0.6 : 1);
  const deal = pct >= 0 ? 48 * (1 - Math.exp(-pct / 40)) : Math.max(-35, pct * 0.7);
  add("deal", pct >= 5 ? `${pct}% under ${L.grade ? `the ${slabText(L.grade)} ask` : "market"}` : `Within ${Math.max(pct, 1)}% of market`, deal * weight, why.length ? `The full discount is reduced because ${why.join(", and ")}.` : "Bigger discounts earn more, on a curve with a ceiling.");
  if (L.how === "Auction") { const left = L.endsAt - Date.now(); if (left > 0 && left < 2 * 3600e3 && L.bids <= 2) add("ending", `Ends soon, ${plural1(L.bids, "bid")}`, 12, "Ending within 2 hours with few bids."); else if (left > 0 && left < 12 * 3600e3 && L.bids <= 3) add("ending", "Ends today", 5, "Ending within 12 hours with few bids."); }
  if (ageH < 6) add("fresh", "Just listed", 7, "Listed in the last 6 hours. Fresh listings are the ones you can still win.");
  else if (ageH < 24) add("fresh", "Listed today", 3);
  if (L.bestOffer) add("offer", "Best Offer", 3, "The seller takes offers, so you may get it for less.");
  if (L.fav) add("fav", "Favorite seller", 10, "A seller you marked as a favorite (in Source).");
  if (L.ship === 0) add("freeship", "Free shipping", 2, "Shipping is already in the total.");
  if (L.ship == null && L.src === "ebay") add("noship", "Shipping not listed", -2, "The real price will be higher once shipping is added.");
  if (L.src === "tcgplayer") add("tcgunk", "Condition unknown", -6, "TCGplayer's lowest listing can be any condition.");
  if (L.fb != null && L.fb < 97) add("feedback", "Low seller feedback", -12, "A low rating or very few sales.");
  if (L.cond === "HP" || L.cond === "DMG") add("damaged", "Condition problem in title", -15, "The title mentions damage, creases or heavy wear.");
  const total = clamp(Math.round(score), 0, 100);
  return (L.sc = { key, score: total, capped: score > 100 ? "high" : score < 0 ? "low" : null, lines: parts.map((p) => ({ ...p, pts: Math.round(p.pts) })).filter((p) => p.key === "start" || p.pts !== 0 || p.key === "deal") });
}
const slabClass = (s) => (s >= 80 ? "holo" : s >= 65 ? "good" : "");

// ----- production's price proof: where the market price comes from, how much is behind it, how sure (seeded) -----
const SOURCE_TEXT = {
  TCGplayer: "TCGplayer's market price, copied once a day. TCGplayer works it out from recent sales, and it's normally for a Near Mint copy. It counts the most.",
  Cardmarket: "Cardmarket's 7-day average price in Europe, converted from euros. A second opinion.",
  "eBay asks": "The low end (the lowest quarter) of the Buy It Now prices Card Chaser has recently seen on eBay for this exact card. These are asking prices, not what it sold for.",
};
const CONFIDENCE_TEXT = { high: ["High", "Two or more sources agree within about 60% of each other."], medium: ["Medium", "It rests mostly on one source, or the sources differ a fair bit."], low: ["Low", "There's little data behind it, so this discount counts for half in the score, and the \"too good to be true\" warning stays off."] };
function marketOf(c) {
  if (c.mk?.p === c.price) return c.mk;
  const r = (x) => h32(`${c.id}|mk|${x}`), age = Math.floor(r("age") * 9), src = [{ name: "TCGplayer", value: c.price, age }];
  if (r("cm") < 0.72) src.push({ name: "Cardmarket", value: round2(c.price * (0.8 + 0.42 * r("cmv"))) });
  const asks = 1 + Math.floor(r("an") * 13);
  if (asks >= 3) src.push({ name: "eBay asks", value: round2(c.price * (0.86 + 0.34 * r("av"))), n: asks });
  let pts = age <= 2 ? 2 : age <= 7 ? 1.5 : 0.5;
  for (const s of src.slice(1)) { const ratio = Math.max(s.value / c.price, c.price / s.value); if (ratio <= 1.6) pts += s.n ? (s.n >= 6 ? 1 : 0.5) : 1; else if (ratio > 2.5) pts -= 1; }
  return (c.mk = { p: c.price, value: c.price, src, age, conf: pts >= 3 ? "high" : pts >= 1.5 ? "medium" : "low" });
}
// A slab's market is what its grade asks (never above medium confidence: asks, not sales), with raw beside it.
function marketL(L) {
  if (!L.grade) return marketOf(L.c);
  const ask = refOf(L), t = slabText(L.grade);
  if (L.mk?.p === ask) return L.mk;
  return (L.mk = { p: ask, value: ask, age: 0, conf: "medium", src: [{ name: `${t} asks`, value: ask, n: 3 + Math.floor(h32(`${L.id}|gn`) * 10), note: `What ${t} copies of this card ask on eBay, the typical one over the last 45 days. Asking prices, not sales.` }, { name: "Raw", value: L.c.price, note: "The raw (ungraded) market price, for comparison. A slab is priced against its grade, not this." }] });
}
function priceVerdict(L) {
  const pct = pctOf(L), M = marketL(L);
  if (pct >= 75 && M.conf !== "low" && L.src !== "tcgplayer") return { tone: "warn", head: "Too good to be true?" };
  if (pct >= 25) return M.conf === "low" ? { tone: "ok", head: "Looks cheap, but the market price is shaky" } : { tone: "good", head: "A good price" };
  if (pct >= 10) return { tone: "good", head: "A little under market" };
  if (pct > -10) return { tone: "ok", head: "About the market price" };
  return { tone: "high", head: "Above market" };
}
// A line with the market sources marked on it and this listing's price pinned above (production's ruler).
function priceRuler(L) {
  const M = marketL(L), src = M.src, hi = Math.max(L.price, M.value, ...src.map((x) => x.value)) * 1.22;
  const W = 340, l = 14, r = W - 14, y = 62, ROW = 17, x = (v) => l + (Math.max(0, v) / hi) * (r - l), rows = [], placed0 = [];
  // Each label goes in the first row where it overlaps no other label and its leader line runs through none above it.
  const placed = [...src].sort((a, b) => a.value - b.value).map((p) => {
    const text = `${p.name} ${money(p.value)}`, w = text.length * 6.6 + 6, tx = x(p.value), cx = clamp(tx, w / 2 + 2, W - w / 2 - 2), lo = cx - w / 2 - 4, hx = cx + w / 2 + 4;
    const fits = (i, strict) => !(rows[i] || []).some((q) => lo < q.hi && hx > q.lo) && (!strict || !rows.slice(0, i).some((rw) => rw.some((q) => tx > q.lo && tx < q.hi)));
    let row = -1;
    for (const strict of [true, false]) { for (let i = 0; i < 5 && row < 0; i++) if (fits(i, strict)) row = i; if (row >= 0) break; }
    if (row < 0) row = 4;
    (rows[row] ||= []).push({ lo, hi: hx });
    const r = { text, tx, cx, row, lo, hi: hx }; placed0.push(r); return r;
  });
  const H = y + 30 + (Math.max(1, rows.length) - 1) * ROW + 12, px = x(L.price);
  return `<svg class="pr" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><rect x="${l}" y="${y - 4}" width="${r - l}" height="8" rx="4" class="pr-track"/><rect x="${x(M.value * 0.9)}" y="${y - 9}" width="${Math.max(2, x(M.value * 1.1) - x(M.value * 0.9))}" height="18" rx="5" class="pr-zone"/>${placed.map((q) => `<line x1="${q.tx}" y1="${y - 7}" x2="${q.tx}" y2="${y + 7}" class="pr-tick"/><line x1="${q.tx}" y1="${y + 8}" x2="${q.tx}" y2="${y + 17 + q.row * ROW}" class="pr-lead"/><text x="${q.cx}" y="${y + 29 + q.row * ROW}" text-anchor="middle" class="pr-t">${esc(q.text)}</text>`).join("")}<path d="M${px} ${y - 9} l-8 -12 h16 z" class="pr-pin ${L.price <= M.value ? "good" : "high"}"/><text x="${clamp(px, 62, W - 62)}" y="${y - 28}" text-anchor="middle" class="pr-t pr-you">You'd pay ${money(L.price)}</text></svg>`;
}

// ----- the words for a listing -----
const shipText = (L) => (L.ship === "local" ? "Local pickup" : L.ship === 0 ? "Free shipping" : L.ship > 0 ? `Includes ${money(L.ship)} shipping` : L.src === "tcgplayer" ? "Plus shipping" : "Shipping not listed");
const whereText = (L) => (L.src === "ebay" ? `eBay, ${L.how === "Auction" ? `auction, ${plural1(L.bids, "bid")}` : L.bestOffer ? "Buy It Now or Best Offer" : "Buy It Now"}` : L.src === "tcgplayer" ? "TCGplayer, lowest listing" : L.src === "reddit" ? `Reddit r/${L.sub}` : L.src === "local" ? `Local: ${L.seller}` : `In stock at ${srcName(L.src)}`);
const howText = (L) => (L.src === "ebay" ? (L.how === "Auction" ? `Auction, ${plural1(L.bids, "bid")}` : L.bestOffer ? "Buy It Now or Best Offer" : "Buy It Now") : L.src === "tcgplayer" ? "Lowest listing" : L.src === "reddit" ? "Trade post" : L.src === "local" ? "Local pickup" : "In stock"); // where is the line above it
const openOn = (L) => (L.src === "ebay" ? "eBay" : L.src === "tcgplayer" ? "TCGplayer" : L.src === "reddit" ? "Reddit" : L.src === "local" ? L.seller.split(",")[0] : srcName(L.src));
const cardFaceHTML = (c, extra = "", size = 58) => `<span class="cface${c.tier >= 4 ? " full" : c.tier === 3 ? " holo" : ""}${extra}${artIn(c, size) ? " pic" : ""}" style="--t:${typeColor(c)}" aria-hidden="true">${artImg(c, size)}<b>${esc(c.name)}</b><i>${esc(sets[c.si].code)} ${esc(c.num)}/${sets[c.si].printed}</i></span>`;

// ----- the Feed, as a page -----
const pfList = document.getElementById("pf-list"), pfSub = document.getElementById("pf-sub"), pfCount = document.getElementById("pf-count"), pfNote = document.getElementById("pf-note");
function feedRowHTML(L, slide) {
  const c = L.c, st = sets[c.si], n = isNewL(L), sc = scoreOf(L), pct = pctOf(L), now = Date.now(), ref = refOf(L), gt = L.grade ? slabText(L.grade) : "";
  return `<li class="fd${n ? " is-new" : ""}${slide && !reduced ? " fd-in" : ""}"><button type="button" class="fd-row" data-l="${esc(L.id)}" aria-label="${esc(`${n ? "New. " : ""}${c.name}${gt ? `, graded ${gt}` : ""}, ${st.name} number ${c.num}. ${money(L.price)} on ${whereText(L)}, ${pct}% under its ${money(ref)} ${refName(L)}. Score ${sc.score}. ${L.dropAt ? "Dropped" : "Listed"} ${agoText(L.seen, now)}.`)}">
    ${cardFaceHTML(c)}<span class="fd-name">${n ? '<b class="fd-new">NEW</b>' : ""}${gt ? `<b class="fd-gr">${gt}</b>` : ""}<span>${esc(c.name)}</span></span><span class="fd-set">${esc(st.name)} #${esc(c.num)}${L.cond ? `, ${condOf(L.cond)[1]}` : ""}</span>
    <b class="fd-price">${money(L.price)}${L.was ? ` <s>${money(L.was)}</s>` : ""}</b><span class="fd-mkt">${gt ? `${gt} ask` : "Market"} ${money(ref)} · <em>${pct}% under</em></span>
    <span class="fd-src"><b>${esc(whereText(L))}</b> · ${L.dropAt ? "dropped " : ""}${agoText(L.seen, now)}</span>
    <span class="slab ${slabClass(sc.score)}"><b>${sc.score}</b><small>score</small></span></button></li>`;
}
function renderFeed(slideId = null) {
  if (pgFeed.hidden && !slideId) return;
  const counts = {}, hid = { n: 0 }, list = feedList(counts, hid), chased = cards.filter(isChase), withAny = new Set(list.map((L) => L.c)), all = Object.values(counts).reduce((a, n) => a + n, 0);
  const fresh = list.filter(isNewL).length, watching = chased.filter((c) => !withAny.has(c)).length;
  pfCount.textContent = fresh ? `${fresh} new` : ""; pfCount.classList.toggle("new", fresh > 0);
  pfSub.innerHTML = !chased.length ? "Every listing found for the cards you chase, newest first."
    : list.length ? `<b>${plural1(list.length, "listing")}</b> for ${plural1(withAny.size, "card")} you chase.` : "Every listing found for the cards you chase lands here.";
  syncFeedTools(hid.n);
  const keep = pgFeed.scrollTop > 8 ? pgFeed.scrollHeight - pgFeed.scrollTop : null; // a listing landing on top doesn't push away the one you're reading
  if (!chased.length) pfList.innerHTML = `<li class="fd-empty"><b>Nothing to look for yet</b><span>Chase a card on the wall (tap it, then Chase it) and every listing found for it lands here.</span><button type="button" class="mbtn primary" data-go="chase">Go to the wall</button></li>`;
  else if (!list.length && hid.n) pfList.innerHTML = `<li class="fd-empty"><b>Your filters hide ${hid.n === 1 ? "the one listing" : `all ${hid.n} listings`}</b><span>${plural1(hid.n, "listing")} for your chases ${hid.n === 1 ? "doesn't" : "don't"} pass ${feedFiltersOn() ? "your filters" : "the condition you picked"}.</span><button type="button" class="mbtn primary" data-fd-all>Show all</button></li>`;
  else if (!list.length && all) pfList.innerHTML = `<li class="fd-empty"><b>Every source is off</b><span>${plural1(all, "listing")} for your chases ${all === 1 ? "is" : "are"} hidden. Switch a source back on to see ${all === 1 ? "it" : "them"}.</span><button type="button" class="mbtn primary" data-go="source">Open Source</button></li>`;
  else if (!list.length) pfList.innerHTML = `<li class="fd-empty"><b>Looking for ${plural1(chased.length, "card")} you chase</b><span>A listing under market lands here the moment it's found.</span></li>`;
  else pfList.innerHTML = feedSorted(list).map((L) => feedRowHTML(L, L.id === slideId)).join("");
  pfNote.innerHTML = chased.length ? `${watching ? `Still looking for ${plural1(watching, "more card")} you chase. ` : ""}Your chase list, one tile a card, is the <button type="button" class="linklike" data-go="lens">Chase lens</button> on the wall.` : "";
  if (keep !== null) pgFeed.scrollTop = pgFeed.scrollHeight - keep;
}
// The tools row: sort, condition, and Filters, which opens the rest under it (production's Filters panel, as far as the
// listings here carry it). A line under it says what the filters hide, with Show all.
const pfSort = document.getElementById("pf-sort"), pfCond = document.getElementById("pf-cond"), pfHidden = document.getElementById("pf-hidden");
const pfMoreBtn = document.getElementById("pf-more-btn"), pfMore = document.getElementById("pf-more");
const PF_FIELDS = { "pf-src": "src", "pf-how": "how", "pf-slab": "slab", "pf-gco": "gco", "pf-gmin": "gmin", "pf-off": "off", "pf-fresh": "fresh", "pf-max": "max", "pf-free": "free", "pf-fav": "fav", "pf-soon": "soon" };
function syncFeedTools(hidden) {
  pfSort.value = feedView.sort; pfCond.value = feedView.cond;
  pfCond.classList.toggle("on", Boolean(feedView.cond));
  for (const [id, k] of Object.entries(PF_FIELDS)) { const el = document.getElementById(id); if (el.type === "checkbox") el.checked = feedView[k]; else if (document.activeElement !== el) el.value = feedView[k]; }
  const n = feedFiltersOn();
  pfMoreBtn.textContent = n ? `Filters (${n})` : "Filters"; pfMoreBtn.classList.toggle("on", Boolean(n));
  document.getElementById("pf-clear").hidden = !n;
  pfHidden.hidden = !hidden;
  if (hidden) pfHidden.innerHTML = `${n ? `${plural1(hidden, "listing")} hidden by your filters` : feedView.cond ? `${plural1(hidden, "listing")} hidden by the condition you picked` : `${plural1(hidden, "damaged listing")} hidden`}. <button type="button" class="linklike" data-fd-all>Show ${hidden === 1 ? "it" : "them"}</button>`;
}
function setFeedView(patch) {
  Object.assign(feedView, patch); feedView.v++; tick(4);
  try { localStorage.setItem("wall-feed-view", JSON.stringify(feedView)); } catch { /* private mode */ }
  pgFeed.scrollTop = 0; renderFeed(); syncBadge(); drawList();
}
pfSort.onchange = () => setFeedView({ sort: pfSort.value });
pfCond.onchange = () => setFeedView({ cond: pfCond.value });
pfMoreBtn.onclick = () => { const open = pfMore.hidden; pfMore.hidden = !open; pfMoreBtn.setAttribute("aria-expanded", String(open)); tick(3); };
for (const [id, k] of Object.entries(PF_FIELDS)) {
  const el = document.getElementById(id);
  el.addEventListener(el.type === "number" ? "input" : "change", () => setFeedView({ [k]: el.type === "checkbox" ? el.checked : el.value }));
}
document.getElementById("pf-clear").onclick = () => setFeedView({ ...FEED_F0 });
pgFeed.addEventListener("click", (e) => {
  if (e.target.closest("[data-fd-all]")) { setFeedView({ ...FEED_F0, cond: "any" }); return; }
  const row = e.target.closest("[data-l]"); if (row) { tick(4); openListing(row.dataset.l); return; }
  const go = e.target.closest("[data-go]"); if (!go) return;
  if (go.dataset.go === "lens") goRoom("chase", { then: () => setLens("chase") }); else goRoom(go.dataset.go);
});
// A live arrival: its listing lands at the top of the Feed (sliding in, if you're there), its source pulses in Source
// and on the map, and the rooms button counts it.
function feedArrived(c) {
  if (c.dealWas) c.droppedAt = c.dealAt; else c.listedAt = c.dealAt; // a new listing, or the same one cheaper
  const L = listingsOf(c)[0]; if (!L) { syncBadge(); return; }
  finds.unshift({ L, at: Date.now() }); if (finds.length > 40) finds.pop();
  mapUI.pulse = { L, t0: performance.now() };
  if (srcOn(L.src) && feedPass(L)) {
    mapUI.feedIn = { t0: performance.now() };
    if (inFeed()) renderFeed(L.id);
    if (srcState.alerts && scoreOf(L).score >= 75 && rooms.at !== "feed") toast(`Phone alert: ${c.name} ${short(L.price)} on ${openOn(L)}, ${pctOf(L)}% under market.`, () => openListing(L.id), "Open");
  }
  sourceFound(L);
  syncBadge();
}
// The list view's Feed section: the same listings, as rows a screen reader reads.
function feedListHTML() {
  const list = feedSorted(feedList()), now = Date.now(), order = FEED_ORDER[feedView.sort];
  return `<section data-sec="feed"><h2>Feed</h2><p class="lsub">${list.length ? `${plural1(list.length, "listing")} for the cards you chase, ${order}.` : "Every listing found for the cards you chase lands here. Nothing yet."}</p><ul>${list.map((L) => {
    const c = L.c, st = sets[c.si];
    return `<li><button class="lrow" data-listing="${esc(L.id)}"><span class="lname">${isNewL(L) ? "NEW. " : ""}${esc(c.name)}${L.grade ? ` <span class="lslab">${slabText(L.grade)}</span>` : ""}</span><span class="lmeta">${esc(st.name)} #${esc(c.num)}. ${esc(whereText(L))}, ${agoText(L.seen, now)}. Score ${scoreOf(L).score}.</span><span class="lprice"><b class="ldeal">${money(L.price)}</b></span><span class="lstate">${L.grade ? `${slabText(L.grade)} ask` : "Market"} ${money(refOf(L))}, ${pctOf(L)}% under</span></button></li>`;
  }).join("")}</ul></section>`;
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-listing]"); if (b) openListing(b.dataset.listing); });

// ----- a listing's own sheet: the listing, not your card -----
const lsheet = document.getElementById("lsheet");
let lsOpen = null;
function findListing(id) { const cid = id.split("~")[0], c = cards.find((x) => x.id === cid); return c ? listingsOf(c).find((L) => L.id === id) || null : null; }
function openListing(id) {
  const L = findListing(id); if (!L) return;
  lsOpen = L;
  const c = L.c, st = sets[c.si], M = marketL(L), v = priceVerdict(L), sc = scoreOf(L), pct = pctOf(L), ref = refOf(L), rn = refName(L), gt = L.grade ? slabText(L.grade) : "", diff = Math.abs(ref - L.price), now = Date.now();
  const r = (x) => h32(`${L.id}|ph|${x}`), mats = ["#2F4A3C", "#3A3550", "#4B3527", "#24394F", "#55443A"], tilt = (r("t") * 8 - 4).toFixed(1);
  const sentence = Math.abs(pct) < 3 ? `Right at the <b>${money(ref)}</b> ${rn}.` : pct > 0 ? `<b>${pct}% under</b> the <b>${money(ref)}</b> ${rn}, ${money(diff)} less.` : `<b>${-pct}% over</b> the <b>${money(ref)}</b> ${rn}.`;
  const conf = CONFIDENCE_TEXT[M.conf];
  const others = listingsOf(c).filter((x) => x !== L && srcOn(x.src) && (x.grade ? slabText(x.grade) : "") === gt).sort((a, b) => a.price - b.price), cheaper = others.filter((x) => x.price < L.price);
  const inc = [];
  if (L.how === "Auction") inc.push(`This is the <b>current bid</b> (${plural1(L.bids, "bid")}), ending in ${agoLeft(L.endsAt - now)}. Auctions usually climb, so the discount counts for 60% in the score. Decide your top price before you bid.`);
  if (L.ship === 0) inc.push("Shipping is free, so the price shown is the price delivered.");
  else if (L.ship > 0) inc.push(`The card itself is ${money(L.price - L.ship)}, plus <b>${money(L.ship)}</b> shipping.`);
  else if (L.ship == null && L.src === "ebay") inc.push("<b>Shipping isn't listed,</b> so the real price will be higher. The score takes 2 points off for that.");
  inc.push("Sales tax isn't included.");
  if (L.bestOffer) inc.push("The seller takes <b>offers</b>, so you may get it for less.");
  const ci = L.cond && condOf(L.cond);
  if (ci && L.cond !== "NM") { const adj = c.price * ci[2], ap = Math.round((1 - L.price / adj) * 100); inc.push(`The title says <b>${ci[1]}</b>. Market prices are for Near Mint, and a ${ci[1]} copy usually sells for about <b>${Math.round((1 - ci[2]) * 100)}% less</b> (around ${money(adj)}). Against that, this is ${ap >= 0 ? `${ap}% under` : `${-ap}% above`}. It's an estimate, so check the photos.`); }
  else if (L.grade) inc.push(`A graded copy, sealed in a ${L.grade.co} slab at <b>${L.grade.grade}</b>. Its grade is its condition, so it's priced against what ${gt} copies ask (${money(ref)}), not the raw market (${money(c.price)}).`);
  else if (!L.cond && L.src !== "tcgplayer") inc.push("The title doesn't give a condition. Market prices are for Near Mint, so check the photos.");
  if (L.src === "tcgplayer") inc.push("This is TCGplayer's <b>lowest listing</b>, which can be in any condition.");
  if (L.src === "reddit") inc.push("A Reddit trade post: message the seller, and pay with PayPal Goods &amp; Services so you're protected.");
  if (L.src === "local") inc.push("A local listing: message the seller and meet somewhere public.");
  const watch = [];
  if (v.tone === "warn") watch.push("<b>Far below market usually means a reprint, a fake or the wrong card.</b> Check the photos, the set symbol and the seller's history before you pay.");
  if (M.conf === "low") watch.push("The market price is <b>shaky</b>, so the discount could be an illusion. Glance at TCGplayer or another listing first.");
  if (L.fb != null && L.fb < 97) watch.push(`The seller's feedback is ${L.fb}% over ${L.fbN.toLocaleString()} sales.`);
  if (L.grade) watch.push(`Ask for the cert number and look it up with ${L.grade.co === "BGS" ? "Beckett" : L.grade.co} before you pay: fake slabs exist.`);
  if (st.year < 2003) watch.push("1st Edition and Shadowless cards are often mislabeled. The stamp or the missing shadow should be visible in the photos.");
  watch.push("Make sure the photos show the actual card (not a stock image), and read the return policy.");
  const fmt = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
  const mine = isChase(c) ? `<p class="ls-mine">You chase this card. Pay up to ${money(capOf(c))}. <button type="button" class="linklike" data-mine>See your card ›</button></p>` : "";
  lsheet.innerHTML = `<div class="ls-scroll">
    <div class="ls-photo" style="--mat:${mats[Math.floor(r("m") * mats.length)]};--tilt:${tilt}deg">${cardFaceHTML(c, r("s") < 0.5 ? " slv" : "", 118)}<small class="ls-cap">The seller's photo</small><small class="ls-cap-pic">${artStamped(c) ? "Pictured: a 1st Edition print" : "A stock picture"}. The seller's photos are on ${esc(openOn(L))}.</small><button type="button" class="ib ls-x" data-ls-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="ls-head"><span class="ls-verdict ${v.tone}">${v.head}</span><h2 id="ls-name">${esc(c.name)} <span>#${esc(c.num)}</span></h2><p class="ls-meta">${esc(st.name)}${gt ? ` · Graded ${gt}` : ci ? ` · ${ci[1]}` : L.src === "tcgplayer" ? " · Any condition" : ""}</p><p class="ls-title">“${esc(L.title)}”</p></div>
    <div class="ls-price"><b>${money(L.price)}</b>${L.was ? `<s>${money(L.was)}</s>` : ""}<span>${shipText(L)}</span></div>
    <div class="ls-row"><span class="slab ${slabClass(sc.score)}"><b>${sc.score}</b><small>score</small></span><p>${L.src === "ebay" ? `Sold by ${esc(L.seller)} (${L.fb}%, ${L.fbN.toLocaleString()} sales) on eBay` : L.src === "reddit" ? `Posted by ${esc(L.seller)} on r/${L.sub}` : L.src === "local" ? `${esc(L.seller)}` : L.src === "tcgplayer" ? `Sold by ${esc(L.seller)} on TCGplayer` : `Sold by ${esc(srcName(L.src))}`}<small>${esc(howText(L))} · ${L.dropAt ? `dropped ${agoText(L.dropAt, now)}, listed ${agoText(L.at, now)}` : `listed ${agoText(L.at, now)}`}</small></p></div>
    <p class="ls-sentence">${sentence}</p>
    ${priceRuler(L)}<p class="ls-legend"><i></i>within 10% of ${gt ? `the ${gt} ask` : "market"}</p>
    <section class="ls-sec"><h3>${gt ? `How we priced a ${gt}` : "How we worked out the market price"}</h3><ul>${M.src.map((s) => `<li><b>${s.name} ${money(s.value)}</b>${s.name === "TCGplayer" ? ` <span class="ls-age">(${s.age === 0 ? "updated today" : `updated ${plural1(s.age, "day")} ago`})</span>` : s.n ? ` <span class="ls-age">(${s.n} listings)</span>` : ""}<small>${s.note || SOURCE_TEXT[s.name]}</small></li>`).join("")}</ul><p class="ls-conf ${M.conf}"><b>${conf[0]} confidence.</b> ${conf[1]}</p></section>
    <section class="ls-sec"><h3>Against other copies</h3><p>${!others.length ? "This is the only listing we've found for this card." : !cheaper.length ? `The cheapest of the <b>${others.length + 1}</b> listings we're tracking for this card. The next lowest is <b>${money(others[0].price)}</b>, on ${openOn(others[0])}.` : `${others.length === 1 ? "The other listing is" : `<b>${cheaper.length}</b> of the other ${others.length} listings ${cheaper.length === 1 ? "is" : "are"}`} cheaper: <button type="button" class="linklike" data-other="${esc(cheaper[0].id)}">${money(cheaper[0].price)} on ${openOn(cheaper[0])}</button>.`}</p></section>
    <section class="ls-sec"><h3>What's in the price</h3><ul>${inc.map((t) => `<li>${t}</li>`).join("")}</ul></section>
    <section class="ls-sec"><h3>What moved the score</h3><ul class="points">${sc.lines.map((p) => `<li><span class="pts ${p.key === "start" ? "" : p.pts > 0 ? "up" : p.pts < 0 ? "down" : ""}">${p.key === "start" ? p.pts : fmt(p.pts)}</span><span><b>${esc(p.label)}</b>${p.note ? `<small>${esc(p.note)}</small>` : ""}</span></li>`).join("")}<li class="pts-total"><span class="pts">${sc.score}</span><span><b>Score</b><small>${sc.capped ? `Capped at ${sc.capped === "high" ? 100 : 0}. ` : ""}40 is a fair price, 65 and up a good deal, 80 and up a standout.</small></span></li></ul></section>
    <section class="ls-sec"><h3>Check before you buy</h3><ul>${watch.slice(0, 4).map((t) => `<li>${t}</li>`).join("")}</ul></section>
    ${mine}
    <p class="ls-fine">A guide to where to look first, not a promise. The listings here are made up for the demo.</p>
  </div>
  <div class="ls-foot"><button type="button" class="mbtn" data-ls-close>Close</button>${(() => { const u = listingUrl(L); return u ? `<a class="mbtn primary" data-ls-open href="${esc(u)}" target="_blank" rel="noopener">Open on ${esc(openOn(L))}</a>` : `<button type="button" class="mbtn primary" data-ls-open>Open on ${esc(openOn(L))}</button>`; })()}</div>`;
  if (!lsheet.open) lsheet.showModal();
  lsheet.querySelector(".ls-scroll").scrollTop = 0;
  focusFor(lsheet.querySelector("[data-ls-open]"), lsheet);
  tick(5);
}
const agoLeft = (ms) => { const h = Math.floor(ms / 3600e3), m = Math.max(1, Math.round((ms % 3600e3) / 60e3)); return ms <= 0 ? "moments" : h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : h ? `${h} h ${m} min` : `${m} min`; };
// The listings are made up, so Open goes to the card on the real site: a search for its name (the made-up sets and
// numbers would find nothing), where its real listings are. The made-up shops have nowhere to go.
function listingUrl(L) {
  const c = L.c, q = encodeURIComponent(c.name);
  if (L.src === "ebay") return `https://www.ebay.com/sch/i.html?_nkw=${q}+pokemon+card`;
  if (L.src === "tcgplayer") return `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${q}`;
  if (L.src === "reddit") return `https://www.reddit.com/r/${L.sub}/search/?q=${encodeURIComponent(c.name)}&restrict_sr=1&sort=new`;
  if (L.src === "local") {
    const town = L.seller.split(", ")[1]?.toLowerCase();
    return L.seller.startsWith("Craigslist") ? `https://${town}.craigslist.org/search/sss?query=${encodeURIComponent(`pokemon ${c.name}`)}` : `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(`pokemon ${c.name}`)}`;
  }
  return null;
}
function closeListing() { if (lsheet.open) lsheet.close(); }
lsheet.addEventListener("close", () => { lsOpen = null; });
lsheet.addEventListener("click", (e) => {
  if (e.target === lsheet || e.target.closest("[data-ls-close]")) { closeListing(); return; } // a tap outside the sheet, or Close
  if (e.target.closest("button[data-ls-open]")) { toast(`${openOn(lsOpen)} is a made-up shop in this test, so there's no page to open.`); tick(4); return; }
  const o = e.target.closest("[data-other]"); if (o) { openListing(o.dataset.other); return; }
  if (e.target.closest("[data-mine]") && lsOpen) { const c = lsOpen.c; closeListing(); toCard(c); }
});
// From a listing to your card: the wall, its set, the card up close (a link, not the listing's purpose).
function toCard(c) {
  if (document.body.classList.contains("listmode")) { listEl.querySelector(`[data-i="${c.i}"], [data-got="${c.i}"]`)?.scrollIntoView({ block: "center" }); return; }
  goRoom("chase", { then: () => {
    const g = groups[c.g]; if (!g || state.trans) return;
    if (view === "set" && state.g === g) { focus(c); return; }
    if (g.m) { const top = topPad(); if (g.m.y - mScroll < top || g.m.y + g.m.h - mScroll > vh - botPad()) mScroll = clamp(g.m.y - top - 10, 0, mMax); }
    enterGroup(g, { then: () => setTimeout(() => { if (view === "set" && state.g === g && !state.trans) focus(c); }, 60) });
  } });
}

// Debug builds only: the tests' hook sees the Feed.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { feedList: { value: () => feedList() }, listingsOf: { value: listingsOf }, openListing: { value: openListing }, isNewL: { value: isNewL }, scoreOf: { value: scoreOf }, srcState: { value: srcState }, arrive: { value: arrive }, feedNewCount: { value: feedNewCount }, lsOpen: { get: () => lsOpen }, feedView: { get: () => feedView }, setFeedView: { value: setFeedView }, feedSorted: { value: feedSorted }, pctOf: { value: pctOf } }); }, 0);
