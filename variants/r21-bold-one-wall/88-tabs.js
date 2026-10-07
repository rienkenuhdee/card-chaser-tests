// ---------- round 21 (bold): production's tabs, as lenses on one wall ----------
// The bar at the bottom reads Feed, Chase, Trade, Medal: production's words in production's four colours. The new idea
// is that a tab never leaves the wall. Tapping one is the lens flight the wall already has (every card flies to its
// new place, and every other tab flies it all home):
//   Feed   the Chase lens's deal tiles grown into production's feed: every card with a live listing lifts out of its
//          set into one column of tiles, newest first, each with the price against market, the source, a score and
//          NEW since you last looked. The sets fold to lines beneath; tap one and it opens as usual.
//   Chase  the wall itself, your sets and chases. Have and Need ride on top of the tab as a small toggle.
//   Trade  the Trade lens, with the trade binder's cover at its top.
//   Medal  flies the wall home, then opens the trophy room's door (the room is already a level of the wall). Back, a
//          pinch or any other tab closes it.
// Source is configuration, not a place: it lives in Settings as Sources, and switching one off takes its listings out
// of the feed. A tab remembers nothing but its lens: Feed and Trade land at their top, Chase where the wall was.
// The buttons keep the lens names the tests click by: data-lens="chase" is Feed (the Chase lens grown into the
// feed), data-lens="have" is the Chase tab, data-lens="need" is the Need half of the toggle.

const TAB_OF = { chase: "feed", have: "chase", need: "chase", trade: "trade" };
const TAB_COL = { feed: "blue", chase: "red", trade: "green", medal: "yellow" };
let medalGoing = false; // Medal was tapped: the wall is on its way home before the room opens
const HN_H = 46; // the Have and Need toggle over the bar on the Chase tab
const activeTab = () => (room.on || medalGoing ? "medal" : TAB_OF[state.lens] || "chase");
const roomOk = () => mode === "set" && (roomHas() || medalList().list.length > 0); // the room opens on the catalog alone

// ----- the listings (made up, seeded by card id so variants compare) -----
// A live listing is the deal on a card you chase. Where it was found and when are seeded per card; an arrival during
// the session is listed the moment it lands.
const FEED_SOURCES = [
  { k: "ebay", name: "eBay", line: "Buy It Now, auctions and Best Offer" },
  { k: "tcgplayer", name: "TCGplayer", line: "Sellers' listings, any condition" },
  { k: "reddit", name: "Reddit", line: "Sale and trade posts" },
  { k: "shops", name: "Shops", line: "In stock at card shops online" },
];
const FEED_SHOPS = ["Card Vault", "Pallet Town Cards", "Holo Hut", "Mint Condition"], FEED_SUBS = ["pkmntcgtrades", "PokemonCardValue", "pokemoncardtrades"];
let srcOff = {};
try { srcOff = JSON.parse(localStorage.getItem("wall-sources") || "{}") || {}; } catch { srcOff = {}; }
function srcOf(c) {
  if (c.fsrc) return c.fsrc;
  const r = h32(`${c.id}|src`), r2 = h32(`${c.id}|how`);
  let s;
  if (r < 0.55) s = { k: "ebay", text: `eBay, ${r2 < 0.6 ? "Buy It Now" : r2 < 0.85 ? "auction" : "Best Offer"}`, name: "eBay" };
  else if (r < 0.72) s = { k: "tcgplayer", text: "TCGplayer", name: "TCGplayer" };
  else if (r < 0.86) s = { k: "reddit", text: `Reddit r/${FEED_SUBS[Math.floor(r2 * FEED_SUBS.length)]}`, name: "Reddit" };
  else { const shop = FEED_SHOPS[Math.floor(r2 * FEED_SHOPS.length)]; s = { k: "shops", text: `In stock at ${shop}`, name: shop }; }
  return (c.fsrc = s);
}
const FEED_T0 = Date.now();
const listedAt = (c) => c.dealAt || FEED_T0 - (0.4 + 150 * Math.pow(h32(`${c.id}|listed`), 1.3)) * 3600e3; // up to six days ago, most of them recent
const feedOrd = (a, b) => listedAt(b) - listedAt(a) || a.i - b.i;
const isListed = (c) => !c.base && !c.ph && !c.owned && c.deal > 0 && isChase(c) && !srcOff[srcOf(c).k];
const scoreOf = (c) => clamp(Math.round(20 + dealPct(c) * 1.25 + h32(`${c.id}|score`) * 12 - (srcOf(c).k === "reddit" ? 6 : 0)), 1, 99); // production's 0 to 100
// When it was listed, in plain words.
const listedAgo = (c) => { const d = Math.max(0, Date.now() - listedAt(c)); if (d < 864e5) return agoText(listedAt(c), Date.now()); const n = Math.round(d / 864e5); return n === 1 ? "yesterday" : `${n} days ago`; };
// NEW: listed since you last left the Feed, and never more than three days old (production's rule).
let feedSeen = 0;
try { feedSeen = Number(localStorage.getItem("wall-feed-seen")) || 0; } catch { feedSeen = 0; }
const isNew = (c) => { const t = listedAt(c); return t > feedSeen && Date.now() - t < 3 * 864e5; };
function sawFeed() { feedSeen = Date.now(); try { localStorage.setItem("wall-feed-seen", String(feedSeen)); } catch { /* private mode */ } }
addEventListener("pagehide", () => { if (state.lens === "chase") sawFeed(); });
document.getElementById("reset").addEventListener("click", () => { try { localStorage.removeItem("wall-feed-seen"); localStorage.removeItem("wall-sources"); } catch { /* fine */ } });

// ----- the bar -----
const tabBtns = [...lensBox.querySelectorAll("[data-tab]")], hnBtns = [...lensBox.querySelectorAll(".hn button")];
function placeInk() {
  const t = activeTab();
  for (const b of tabBtns) b.setAttribute("aria-pressed", String(b.dataset.tab === t));
  for (const b of hnBtns) b.setAttribute("aria-pressed", String(b.dataset.lens === state.lens));
  document.body.dataset.onTab = t;
  const b = lensBox.querySelector(`[data-tab="${t}"]`), ch = lensBox.querySelector('[data-tab="chase"]');
  lensInk.style.setProperty("--x", `${b.offsetLeft}px`); lensInk.style.setProperty("--w", `${b.offsetWidth}px`);
  lensInk.style.setProperty("--tc", `var(--c-${TAB_COL[t]})`);
  lensBox.style.setProperty("--hx", `${ch.offsetLeft + ch.offsetWidth / 2}px`);
}
// Each tab's count line, as production has it: "3 new", "786 to go", spares, trophies.
let tabSig = "";
const tcEl = { feed: document.getElementById("tc-feed"), chase: document.getElementById("tc-chase"), trade: document.getElementById("tc-trade"), medal: document.getElementById("tc-medal") };
function updateTabs() {
  let listed = 0, fresh = 0, toGo = 0, spare = 0, owned = 0;
  for (const c of cards) {
    if (c.owned) { owned++; if (isSpare(c)) spare += sparesOf(c); } else toGo++;
    if (isListed(c)) { listed++; if (isNew(c)) fresh++; }
  }
  const md = medalCount();
  const t = { feed: fresh ? `${fresh} new` : listed ? `${listed} listed` : "", chase: owned ? `${toGo.toLocaleString()} to go` : "", trade: spare ? `${spare} spare${spare === 1 ? "" : "s"}` : "", medal: md ? `${md} earned` : "" };
  const sig = `${t.feed}|${t.chase}|${t.trade}|${t.medal}`;
  if (sig === tabSig) return;
  tabSig = sig;
  for (const k in t) tcEl[k].textContent = t[k];
  tcEl.feed.classList.toggle("new", fresh > 0);
}
setInterval(() => { if (!document.hidden) updateTabs(); }, 2000); // NEW ages out, a medal lands, a copy is counted
function syncBadge() { updateTabs(); } // the count line is the badge now (live.js calls this on every arrival)
function updateCount() {
  natdexSync(); // a Dex slot shows the best print you own: picked again when what you own changes
  const n = state.time ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
  scheduleMedals();
  updateTabs();
}

// Every tap on the bar comes through here first (capture on window, ahead of the base's own listeners), so leaving
// the room, the table or the binder is a step of the tab change rather than a cut.
addEventListener("click", (e) => {
  const b = e.target.closest?.(".lens button"); if (!b || !lensBox.contains(b)) return;
  e.stopPropagation();
  tabTap(b);
}, true);
function tabTap(b) {
  const lens = b.dataset.lens, tab = b.dataset.tab;
  if (tab === "medal") { goMedal(); return; }
  if (room.on) { medalGoing = false; leaveRoom(() => tabTap(b)); return; }
  if (tbl.on) closeTable(true);
  if (bnd.on) { if (tab === "trade") { closeBinder(); return; } closeBinder(true); } // Trade from its binder: back to the Trade lens
  if (tab && tab === activeTab()) { toTop(); return; } // the tab you're on: back to its top
  setLens(lens);
}
function leaveRoom(then) {
  if (view === "set") { unfocus(); view = "mosaic"; state.g = null; setChrome(); closeRoom(true); then(); return; } // an album open in the room
  closeRoom();
  const wait = () => (room.on ? setTimeout(wait, 30) : then());
  wait();
}
// Back to the top of whatever the tab shows: a set closes; the wall, the feed or the room scrolls up.
let topTween = 0;
function toTop() {
  if (state.focus) { unfocus(); return; }
  if (view === "set") { exitToMosaic(); return; }
  if (mScroll <= 0) return;
  tick(4); inertia = false;
  if (reduced) { mScroll = 0; kick(); return; }
  const from = mScroll, t0 = performance.now(), id = ++topTween;
  const stepTop = (t) => { if (id !== topTween || gesture) return; const p = clamp((t - t0) / 460, 0, 1); mScroll = from * (1 - ease(p)); kick(); if (p < 1) requestAnimationFrame(stepTop); };
  requestAnimationFrame(stepTop);
}
// After whatever is moving has landed.
function whenStill(fn) { const go = () => (state.trans || shuffle || (room.on && room.anim) ? setTimeout(go, 40) : fn()); go(); }

// Medal: the wall flies home (a lifted tab lands back on the wall, an open set closes), then the room's door opens.
function goMedal() {
  if (room.on) { toTop(); return; }
  if (document.body.classList.contains("listmode")) { // the list has the trophies as a section of its own
    const s = listEl.querySelector(".lshelf");
    if (s) s.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); else toast("No trophies yet. Mark the cards you have and they come.");
    return;
  }
  if (!medalList().list.length) { toast("No trophies to earn yet. Pick your sets first."); return; }
  if (tbl.on) closeTable(true);
  if (bnd.on) closeBinder(true);
  closePop(true); hideCaption(); tick(6);
  medalGoing = true; placeInk();
  const go = () => {
    if (!medalGoing) return; // another tab was tapped on the way
    if (state.trans || shuffle || tbl.on || bnd.on) { setTimeout(go, 40); return; }
    if (state.focus) unfocus();
    if (view === "set") { exitToMosaic(); setTimeout(go, 40); return; }
    if (mode !== "set") { rearrange("set"); setTimeout(go, 40); return; }
    if (state.lens === "chase" || state.lens === "trade") { applyLens("have"); setTimeout(go, 40); return; }
    medalGoing = false; openRoom(); placeInk();
  };
  go();
}

// ----- lenses -----
function setLens(lens) {
  if (lens === "medal") { goMedal(); return; }
  medalGoing = false;
  applyLens(lens);
}
function applyLens(lens) {
  if (lens === state.lens) { placeInk(); return; }
  const was = state.lens;
  if (was === "chase") sawFeed(); // leaving the Feed: what you saw is no longer new
  state.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n.toLocaleString()} cards to go`); }
  if (lens === "trade") tradeToast();
  if (was === "chase") closePop(true);
  hideDealBar(); if (lens === "chase") live.news = []; // the feed shows what's new itself, newest at the top
  liftLayout(); drawList(); updateCount(); kick();
}
// The lens flight. As the base, plus: a tab tapped inside a set flies its cards straight out of the binder; Feed and
// Trade land at their top; coming home lands the wall where it was.
let wallScroll = 0;
function liftLayout(force = false) {
  const want = state.lens === "chase" || state.lens === "trade";
  const same = want === lifted && (!want || state.lens === liftKey); // Chase to Trade is a flight too
  if (same && !(force && lifted)) { layoutAll(); return; }
  if (tbl.on || bnd.on) { layoutAll(); kick(); return; } // nothing of the wall shows under the table or the binder: no flight to watch
  const T = state.trans;
  if (T && !(T.anim || T.t0)) { layoutAll(); return; } // fingers are holding a transition: relayout under it
  if (T) finishTransition();
  const now = performance.now();
  if (view === "set" && state.g && same) { // the chase list changed inside a lifted binder: it reshuffles in place
    const g = state.g;
    if (state.focus) unfocus();
    for (const c of g.cards) { c.px = c.x; c.py = c.y; }
    layoutAll();
    if (!reduced) { for (const c of g.cards) c.delay = Math.min(240, c.k * 1.4); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
    tick(8); kick(); return;
  }
  const from = mScroll, wasLifted = lifted, inSet = view === "set" && state.g ? state.g : null;
  if (!wasLifted && want && !inSet) wallScroll = mScroll; // leaving the wall: remember where it was
  for (const c of drawnCards) c.pm = { ...c.m };
  for (const g of groups) { g.pm = { ...g.m }; g.ripple = null; g.burst = 0; }
  if (inSet) {
    if (state.focus) { state.focus = null; document.body.classList.remove("focused"); }
    for (const c of inSet.cards) { const r = binderRect(c, cam); c.pm = { x: r.x, y: r.y + from, w: r.w, h: r.h }; }
    inSet.pm = { x: 0, y: from + topPad() - 8, w: vw, h: vh - topPad() }; // the page shrinks to its place
    view = "mosaic"; state.g = null; fly = null; inertia = false; setChrome();
  }
  // A listing landing while you're down the feed: the tile you're reading stays where it is (at the top, the new one
  // slides in and the rest move down, as a feed does).
  const anchor = same && feedBox && state.lens === "chase" && mScroll > 0 ? feedBox.list.find((c) => c.m && c.m.y >= mScroll + topPad()) : null;
  const ay = anchor?.m.y;
  layoutAll();
  if (anchor?.lift && anchor.m) {
    const d = anchor.m.y - ay;
    if (d) { mScroll = clamp(mScroll + d, 0, mMax); const k = mScroll - from; for (const c of drawnCards) if (c.pm) c.pm.y += k; for (const g of groups) if (g.pm?.y != null) g.pm.y += k; }
  }
  if (!same) {
    mScroll = clamp(want ? 0 : wasLifted ? wallScroll : mScroll, 0, mMax);
    const d = mScroll - from;
    if (d) { for (const c of drawnCards) if (c.pm) c.pm.y += d; for (const g of groups) if (g.pm?.y != null) g.pm.y += d; }
  }
  // The chased cards leave first, so the eye follows them to the front; the rest trail in a beat behind. In the feed
  // the tiles land one after another, newest first.
  const feed = state.lens === "chase";
  for (const c of drawnCards) c.delay = reduced ? 0 : c.lift && feed ? Math.min(420, (c.fi || 0) * 26) : Math.min(400, (c.lift ? 0 : 90) + c.g * 30 + c.k * 0.5);
  state.trans = { kind: "morph", t0: now, dur: reduced ? 1 : medalGoing ? 1000 : 1300, done: () => { for (const g of groups) g.pm = null; kick(); } };
  tick(10); kick();
}
function orderGroup(g) {
  g.base ||= g.cards;
  const feed = state.lens === "chase", trade = state.lens === "trade";
  const key = trade ? isSpare : feed ? isListed : isChase, ord = trade ? spareOrder : feed ? feedOrd : chaseOrder;
  const lead = lifted ? g.base.filter(key).sort(ord) : [];
  g.lead = lead;
  g.cards = lead.length ? [...lead, ...g.base.filter((c) => !key(c))] : g.base;
  g.cards.forEach((c, k) => { c.k = k; c.lift = 0; });
  for (const c of lead) c.lift = 1;
}
function layoutAll() {
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) { orderGroup(g); g.done = mode === "set" && isPut(g); }
  groups.forEach(binderLayout);
  const keep = mScroll;
  if (lifted) { newPanel = null; liftedLayout(); } else { feedBox = null; mosaicLayout(); if (!state.time && !picking()) mMax += HN_H; } // the end of the wall clears Have and Need above the bar
  if (room.on) { if (!roomOk()) { endRoom(); return; } if (room.fan && !inCase(room.fan)) room.fan = null; mScroll = keep; strip = null; roomLayout(); }
  if (bnd.on) { bnd.L = tbGeom(bnd.show); bnd.vi = clamp(bnd.vi, 0, tbViews() - 1); } // the binder fits the new screen
}

// ----- the feed's layout: one column of tiles (two or three on a wide screen), the sets folded beneath -----
const FEED_HEAD = 66, FEED_TH = 112, FEED_GAP = 8, SETS_H = 34;
let feedBox = null; // { x, y, w, h, list, setsY } in mosaic coordinates
function liftedLayout() {
  const R = { x: 8, y: topPad(), w: vw - 16 };
  let y = R.y + shelfLayout(R);
  COVER.m = null;
  if (state.lens !== "chase") { // Trade, as the base: the binder's cover, the traders, then the panels with spares
    feedBox = null;
    y += coverLayout({ x: R.x, y, w: R.w }); y += stripLayout({ x: R.x, y, w: R.w });
    const live = groups.filter((g) => !g.done && g.lead.length), folded = groups.filter((g) => !g.done && !g.lead.length);
    const across = R.w >= 900 ? 2 : 1, pw = R.w / across;
    for (let i = 0; i < live.length; i += across) {
      const row = live.slice(i, i + across), h = Math.max(...row.map((g) => liftedH(g, pw)));
      row.forEach((g, j) => { g.m = { x: R.x + j * pw, y, w: pw, h }; });
      y += h;
    }
    for (const g of folded) { g.m = { x: R.x, y, w: R.w, h: FOLD }; y += FOLD; }
    y += caseLayout(R, y);
    mMax = Math.max(0, y + botPad() - vh);
    mScroll = clamp(mScroll, 0, mMax);
    for (const g of groups) { if (g.done) continue; if (g.lead.length) packLifted(g); else packFolded(g); }
    return;
  }
  strip = null;
  const list = [];
  for (const g of groups) if (!g.done) for (const c of g.lead) list.push(c);
  list.sort(feedOrd);
  const cols = R.w >= 1000 ? 3 : R.w >= 620 ? 2 : 1, x0 = R.x + PG, tw = (R.w - PG * 2 - FEED_GAP * (cols - 1)) / cols;
  feedBox = { x: R.x, y, w: R.w, h: 0, list, setsY: 0 };
  y += list.length ? FEED_HEAD : FEED_HEAD + 22;
  list.forEach((c, i) => { c.fi = i; c.m = { x: x0 + (i % cols) * (tw + FEED_GAP), y: y + Math.floor(i / cols) * (FEED_TH + FEED_GAP), w: tw, h: FEED_TH }; });
  y += Math.ceil(list.length / cols) * (FEED_TH + FEED_GAP);
  feedBox.h = y - feedBox.y; feedBox.setsY = y;
  y += SETS_H;
  const folded = groups.filter((g) => !g.done);
  for (const g of folded) { g.m = { x: R.x, y, w: R.w, h: FOLD }; y += FOLD; }
  y += caseLayout(R, y);
  mMax = Math.max(0, y + botPad() - vh);
  mScroll = clamp(mScroll, 0, mMax);
  for (const g of folded) packRest(g);
}
// A folded set in the feed: the cards still in it as a hairline under its name (its listings are up in the feed).
function packRest(g) {
  const m = g.m, x = m.x + PG + 10, w = m.w - PG * 2 - 20, n0 = g.lead.length, n = Math.max(1, g.cards.length - n0);
  for (let k = n0; k < g.cards.length; k++) g.cards[k].m = { x: x + (w * (k - n0)) / n, y: m.y + PG + 30, w: clamp(w / n, 0.5, 20), h: 2 };
}
// A hairline segment stays a hairline: a chase of a few cards folded would otherwise draw 2px-tall card faces.
function packFolded(g) {
  const m = g.m, x = m.x + PG + 10, w = m.w - PG * 2 - 20, n = g.cards.length;
  g.cards.forEach((c, k) => { c.m = { x: x + (w * k) / n, y: m.y + PG + 30, w: clamp(w / n, 0.5, 20), h: 2 }; });
}

// ----- drawing -----
function emphasis(c) {
  if (c.away) return 0; // out on the trade table: its tile is empty
  if (preview) return preview.has(c.base || c) ? (c.owned ? 0.42 : 1) : 0.1; // the New chase form: what it would match
  if (state.matches) return state.matches.has(rootOf(c)) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.1 : c.ph ? 0.3 : 1;
  if (state.lens === "chase") return isListed(rootOf(c)) ? 1 : 0.18;
  if (state.lens === "trade") return isSpare(c) ? 1 : 0.18;
  return 1;
}
function panelStat(g) {
  if (picking()) return "  "; // the tick's place
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(rootOf(c))).length; return m ? `${m} found` : ""; }
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.lead?.length || 0; return d ? `${d} listed` : ""; }
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
// As the base, but in the feed a set's listings are drawn even when its folded line is off screen.
function drawWall(now, alpha = 1, except = null) {
  const pick = picking() && wel.picks.size > 0, feed = lifted && state.lens === "chase";
  let settling = false;
  for (const g of groups) {
    const t = pick && g.set && !wel.picks.has(g.set.id) ? 0.42 : 1;
    g.pe ??= 1;
    if (Math.abs(g.pe - t) > 0.01) { g.pe += (t - g.pe) * (reduced ? 1 : 0.16); settling = true; } else g.pe = t;
    if (g === except) continue;
    if (room.on && inCase(g)) continue;
    const off = g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0;
    if (off && !(feed && g.lead?.length)) continue;
    const a = alpha * g.pe;
    if (!off) drawPanel(g, now, a);
    if (inCase(g)) continue; // its strip is part of the door, drawn below the tiles
    for (const c of g.cards) { const y = c.m.y - mScroll; if (y > vh || y + c.m.h < 0) continue; drawTile(c, c.m.x, y, c.m.w, c.m.h, now, a); }
  }
  if (!except && !state.trans) { drawNewPanel(now, alpha); drawDoor(now, alpha); }
  if (!state.trans) for (const g of groups) { if (!inCase(g) || room.on) continue; if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue; for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha * g.pe); }
  if (settling) kick();
}
// The overlay drawn every frame over the lifted lenses (it fades in with the flight): Trade's cover and traders, or
// the feed's header and the line over the folded sets.
function drawTraders(now) {
  if (view !== "mosaic" || bnd.on || room.on || (state.lens !== "trade" && state.lens !== "chase")) return;
  const T = state.trans;
  let alpha = 1;
  if (T?.kind === "morph") alpha = ease(clamp((now - T.t0 - 140) / (T.dur - 520), 0, 1));
  else if (T?.kind === "open") alpha = 1 - T.q;
  else if (T) return;
  if (tbl.on) alpha *= 1 - tbl.q;
  if (alpha <= 0.01) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.lens === "chase") { drawFeedHead(alpha * (pop.c ? 0.3 : 1)); return; }
  drawCover(now, alpha); // the trade binder, above the traders
  if (strip) for (const ch of strip.chips) drawChip(ch, now, alpha);
}
const srcNames = () => { const on = FEED_SOURCES.filter((s) => !srcOff[s.k]).map((s) => (s.k === "shops" ? "shops" : s.name)); return on.length > 1 ? `${on.slice(0, -1).join(", ")} and ${on[on.length - 1]}` : on[0] || ""; };
function drawFeedHead(a) {
  const F = feedBox; if (!F) return;
  const x = F.x + PG + 4, w = F.w - PG * 2 - 8, y = F.y - mScroll;
  ctx.globalAlpha = a; ctx.textBaseline = "alphabetic";
  if (y < vh && y + FEED_HEAD + 22 > 0) {
    const n = F.list.length;
    let fresh = 0; for (const c of F.list) if (isNew(c)) fresh++;
    let rw = 0;
    if (fresh) { // how many are new, in the Feed's blue
      font(800, 12); const t = `${fresh} new`; rw = textW(t) + 18;
      rr(x + w - rw, y + 13, rw, 22, 11); ctx.fillStyle = theme["c-blue"]; ctx.fill();
      ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(t, x + w - rw / 2, y + 28.5); rw += 10;
    }
    ctx.textAlign = "left"; ctx.fillStyle = theme.ink; font(800, 22, true);
    ctx.fillText(fitText(n ? `${n} listing${n === 1 ? "" : "s"} for your chases` : "Nothing listed yet", w - rw), x, y + 32);
    ctx.fillStyle = theme.muted; font(500, 13);
    const srcs = srcNames(), chased = cards.filter(isChase).length;
    if (n) ctx.fillText(fitText(srcs ? `Newest first, from ${srcs}` : "Every source is off, in Settings", w), x, y + 52);
    else {
      ctx.fillText(fitText(!srcs ? "Every source is off. Turn one on in Settings." : chased ? `Watching ${chased.toLocaleString()} card${chased === 1 ? "" : "s"} you chase on ${srcs}.` : "Open a card and choose Chase it.", w), x, y + 52);
      ctx.fillText(fitText(chased || !srcs ? "New listings land here, newest first." : "Its listings land here, newest first.", w), x, y + 70);
    }
  }
  const sy = F.setsY - mScroll;
  if (sy < vh && sy + SETS_H > 0) {
    ctx.textAlign = "left"; ctx.fillStyle = theme.muted; font(700, 13); ctx.fillText("Your sets", x, sy + 24);
    ctx.textAlign = "right"; font(500, 12); ctx.fillText("Tap one to open it", x + w, sy + 24);
  }
  ctx.globalAlpha = 1;
}
// A listing: the card, its name and set, the asking price against market, a score, where it was found and when.
function drawFeedTile(c, x, y, w, h, a, now = performance.now()) {
  if (y > vh || y + h < 0 || x > vw || x + w < 0) return;
  const b = rootOf(c), st = sets[c.si], rad = Math.min(12, w * 0.06), fresh = b.deal > 0 && isNew(b);
  ctx.globalAlpha = a;
  rr(x, y, w, h, rad); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (w < 120 || h < 56) { ctx.globalAlpha = 1; return; }
  const s = clamp(h / FEED_TH, 0.6, 1.4), pad = 10 * s, mh = h - pad * 2, mw = mh * TW / TH;
  foilOff = true; cardFace(c, x + pad, y + pad, mw, mh, now, state.value && !state.matches); foilOff = false;
  ctx.globalAlpha = a;
  const tx = x + pad + mw + 12 * s, rx = x + w - pad, tw = rx - tx;
  if (tw < 60) { ctx.globalAlpha = 1; return; }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  let nw = tw;
  if (fresh) {
    font(800, 10.5 * s); const pw = textW("NEW") + 12 * s, ph = 17 * s;
    rr(rx - pw, y + pad, pw, ph, ph / 2); ctx.fillStyle = theme["c-blue"]; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText("NEW", rx - pw / 2, y + pad + 12.3 * s); ctx.textAlign = "left";
    nw -= pw + 6 * s;
  }
  ctx.fillStyle = theme.ink; font(800, 16 * s, true); ctx.fillText(fitText(c.name, nw), tx, y + pad + 13 * s);
  ctx.fillStyle = theme.muted; font(500, 12 * s); ctx.fillText(fitText(`${st.name} #${c.num}`, tw), tx, y + pad + 30 * s);
  if (!(b.deal > 0)) { ctx.globalAlpha = 1; return; } // got it, or its source switched off, mid-flight
  // the score, production's slab
  const sc = scoreOf(b), sw = 40 * s, sx0 = rx - sw, sy0 = y + pad + 40 * s, hot = sc >= 80, good = sc >= 65;
  rr(sx0, sy0, sw, sw, 8 * s); ctx.fillStyle = hot ? goldTint() : good ? dealTint() : theme.slot; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = hot ? theme.gold : good ? theme.deal : theme["slot-line"]; ctx.stroke();
  ctx.textAlign = "center"; ctx.fillStyle = hot ? theme.gold : good ? theme.deal : theme.muted;
  font(800, 16 * s); ctx.fillText(String(sc), sx0 + sw / 2, sy0 + 20 * s);
  font(600, 9 * s); ctx.fillText("score", sx0 + sw / 2, sy0 + 32 * s);
  ctx.textAlign = "left";
  const lw = tw - sw - 8 * s;
  // the asking price (a drop strikes the old one through), then market and how far under
  const price = short(b.deal);
  ctx.fillStyle = theme.deal; font(800, 23 * s); ctx.fillText(price, tx, y + pad + 58 * s);
  if (b.dealWas) {
    const px = tx + textW(price) + 8 * s; font(600, 12.5 * s);
    const old = short(b.dealWas), ow = textW(old);
    if (px + ow <= tx + lw) { ctx.fillStyle = theme.muted; ctx.fillText(old, px, y + pad + 58 * s); ctx.fillRect(px, y + pad + 53.5 * s, ow, Math.max(1, s)); }
  }
  font(600, 12.5 * s); ctx.fillStyle = theme.muted;
  const mk = `Market ${short(b.price)} · `, mkw = textW(mk);
  ctx.fillText(fitText(mk, lw), tx, y + pad + 76 * s);
  if (mkw < lw - 30) { ctx.fillStyle = theme.deal; font(700, 12.5 * s); ctx.fillText(fitText(`${dealPct(b)}% under`, lw - mkw), tx + mkw, y + pad + 76 * s); }
  ctx.fillStyle = theme.muted; font(500, 11.5 * s);
  ctx.fillText(fitText(`${srcOf(b).text} · ${listedAgo(b)}`, tw), tx, y + h - pad);
  ctx.globalAlpha = 1;
}

// ----- finding the tile under a finger in the feed: it belongs to its set, so a tap pops the card and a spread opens
// the set with the tile growing into its binder -----
function hit(sx, sy, nearest = false) {
  if (state.trans) return null;
  if (view === "mosaic") {
    if (room.on && room.closing) return null;
    if (room.on && room.anim) finishRoomAnim();
    const y = sy + mScroll;
    if (room.on) {
      for (const it of room.L?.hits || []) if (inR(it, sx, y)) return { block: it.blk }; // a medal, a filter, a fold line
      for (const g of room.plaques) {
        if (g.fanR && inR(g.fanR, sx, y)) return { block: g.fanBtn };
        if (g === room.fan) for (const r of fanRows(g)) if (inR(r.m, sx, y)) return { block: r };
        if (inR(g.m, sx, y)) return { block: g };
      }
      if (!nearest) return null;
      let best = null, bd = Infinity;
      for (const g of room.plaques) { const dx = Math.max(g.m.x - sx, 0, sx - g.m.x - g.m.w), dy = Math.max(g.m.y - y, 0, y - g.m.y - g.m.h), d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = g; } }
      return best && bd < 60 ? { block: best } : null;
    }
    if (COVER.m && inR(COVER.m, sx, y)) return { block: COVER }; // the trade binder, at the top of the Trade lens
    if (feedBox && lifted && state.lens === "chase") for (const c of feedBox.list) if (c.m && inR(c.m, sx, y)) return { block: groups[c.g] };
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

// ----- the room: the Medal tab's place (opens on the catalog alone; the bar stays up and lights Medal) -----
function openRoom() {
  if (room.on || state.trans || tbl.on || bnd.on || view !== "mosaic" || !roomOk()) return;
  hideCaption(); cancelPress(); closePop(true); tick(8);
  room.on = true; room.closing = false; room.wallScroll = mScroll; room.fan = null; room.pinch = null; mScroll = 0;
  layoutAll();
  document.body.classList.add("inroom"); setChrome();
  room.q = reduced ? 1 : 0; room.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 520 };
  placeInk(); kick();
}
function endRoom() {
  room.on = false; room.closing = false; room.anim = null; room.q = 0; room.pinch = null; room.fan = null;
  mScroll = room.wallScroll; layoutAll();
  document.body.classList.remove("inroom"); setChrome(); placeInk(); kick();
}

// ----- Sources, in Settings: where the feed looks -----
const srcsEl = document.getElementById("srcs");
srcsEl.innerHTML = FEED_SOURCES.map((s) => `<label class="src-row"><span><b>${s.name}</b><small>${s.line}</small></span><input type="checkbox" role="switch" data-source="${s.k}"${srcOff[s.k] ? "" : " checked"}></label>`).join("");
srcsEl.addEventListener("change", (e) => {
  const i = e.target.closest("[data-source]"); if (!i) return;
  const s = FEED_SOURCES.find((x) => x.k === i.dataset.source);
  srcOff[s.k] = !i.checked; if (!srcOff[s.k]) delete srcOff[s.k];
  try { localStorage.setItem("wall-sources", JSON.stringify(srcOff)); } catch { /* private mode */ }
  tick(3); toast(i.checked ? `Looking on ${s.name} again` : `${s.name} is off. Its listings leave the feed.`);
  if (state.lens === "chase") liftLayout(true);
  updateTabs(); drawList(); kick();
});

// ----- the copies online: the live listing names where the feed found it -----
function offersFor(c, kind) {
  const st = sets[c.si], r = (k) => h32(`${c.id}|${kind}|${k}`), out = [];
  const vintage = st.year < 2010, packBase = vintage ? 160 + r("b") * 420 : 3.8 + r("b") * 5;
  if (kind === "single") {
    const n = 3 + Math.floor(r("n") * 4);
    for (let i = 0; i < n; i++) out.push({ title: `${c.name} ${c.num}/${st.printed}`, price: Math.round(c.price * (0.82 + r(`p${i}`) * 0.55) * 100) / 100, src: SOURCES[Math.floor(r(`s${i}`) * 3)], cond: CONDS[Math.floor(r(`c${i}`) * 4)], ship: r(`f${i}`) < 0.4 ? 0 : Math.round((0.99 + r(`h${i}`) * 4) * 100) / 100, q: `pokemon ${c.name} ${c.num}/${st.printed} ${st.name}` });
    if (c.deal) out.push({ title: `${c.name} ${c.num}/${st.printed}`, price: c.deal, src: srcOf(rootOf(c)).name, cond: "Near mint", ship: 0, q: `pokemon ${c.name} ${c.num}/${st.printed} ${st.name}`, live: true });
    out.sort((a, b) => a.price - b.price);
  } else if (kind === "pack") {
    const n = 3 + Math.floor(r("n") * 2);
    for (let i = 0; i < n; i++) out.push({ title: `${st.name} booster pack`, price: Math.round(packBase * (0.9 + r(`p${i}`) * 0.35) * 100) / 100, src: SOURCES[Math.floor(r(`s${i}`) * 3)], cond: vintage && r(`v${i}`) < 0.5 ? "Heavy pack" : "Sealed", ship: r(`f${i}`) < 0.5 ? 0 : Math.round((0.99 + r(`h${i}`) * 3) * 100) / 100, q: `${st.name} booster pack sealed`, odds: `About 1 in ${packOdds(c)} packs` });
    out.sort((a, b) => a.price - b.price);
  } else {
    const boxes = Math.max(1, Math.round(packOdds(c) / 36));
    out.push({ title: `${st.name} booster box, 36 packs`, price: Math.round(packBase * 33 * (0.92 + r("x") * 0.2)), src: SOURCES[Math.floor(r("s0") * 3)], cond: "Sealed", ship: 0, q: `${st.name} booster box sealed`, odds: `About 1 in ${boxes} box${boxes === 1 ? "" : "es"}` });
    out.push({ title: `${st.name} booster box, 36 packs`, price: Math.round(packBase * 33 * (1.02 + r("y") * 0.25)), src: SOURCES[Math.floor(r("s1") * 3)], cond: "Sealed", ship: Math.round((4.99 + r("h1") * 10) * 100) / 100, q: `${st.name} booster box sealed`, odds: `About 1 in ${boxes} box${boxes === 1 ? "" : "es"}` });
    if (!vintage) out.push({ title: `${st.name} elite trainer box, 9 packs`, price: Math.round(packBase * 10 * (1 + r("z") * 0.3)), src: "TCGplayer", cond: "Sealed", ship: 0, q: `${st.name} elite trainer box`, odds: `About 1 in ${Math.max(1, Math.round(packOdds(c) / 9))} boxes` });
    if (vintage) out.push({ title: `${st.name} sealed pack lot of 6`, price: Math.round(packBase * 5.6), src: "eBay", cond: "Sealed", ship: 0, q: `${st.name} booster pack lot sealed`, odds: `About 1 in ${Math.max(1, Math.round(packOdds(c) / 6))} lots` });
  }
  return out;
}

// ----- the list: the Feed lens is the listings, newest first -----
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(rootOf(c)) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isListed(rootOf(c)) : state.lens === "trade" ? isSpare(c) : true);
  let top = "";
  if (state.lens === "chase") {
    const ls = cards.filter((c) => isListed(c) && (!state.matches || state.matches.has(c))).sort(feedOrd);
    top = `<section><h2>Feed</h2><p class="lsub">${ls.length ? `${ls.length} listing${ls.length === 1 ? "" : "s"} for your chases, newest first.` : "Nothing listed for your chases yet."}</p><ul>${ls.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${isNew(c) ? `<b class="lnew">NEW</b> ` : ""}${c.name}</span><span class="lmeta">${st.name} #${c.num}. ${srcOf(c).text}, ${listedAgo(c)}</span><span class="lprice"><b class="ldeal">${money(c.deal)}</b></span><span class="lstate">Market ${money(c.price)}, ${dealPct(c)}% under</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul></section>`;
  }
  if (state.lens === "trade") top = tradeListHTML();
  const row = (c) => {
    const st = sets[c.si];
    return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${lstateOf(c)}</span></button></li>`;
  };
  const rows = (items) => `<ul>${items.map(row).join("")}</ul>`;
  listEl.querySelector("#list-body").innerHTML = top + trophyListHTML(show, rows) + groups.map((g) => {
    if (g.done) return "";
    const items = g.cards.filter((c) => !c.ph && show(c)); // a Dex pocket with no card isn't a row
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}</p><ul>${items.map(row).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { feedBox: { get: () => feedBox }, isListed: { value: isListed }, activeTab: { value: activeTab }, goMedal: { value: goMedal }, updateTabs: { value: updateTabs }, r21Scroll: { value: (y) => { mScroll = clamp(y, 0, mMax); kick(); } }, r21Arrive: { value: () => arrive() } }); }, 0);
