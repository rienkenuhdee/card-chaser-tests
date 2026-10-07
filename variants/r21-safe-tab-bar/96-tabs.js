// ---------- round 21: the tab bar ----------
// Production's five tabs along the bottom (Feed, Chase, Trade, Medal, Source), each in its own colour of the four.
// Switching is instant, as tab bars are, and every tab keeps where you were: the wall's tabs keep their level, camera
// and scroll; the pages keep their scrollTop. Tapping the tab you're on goes back to its top.
//   Chase: the wall as it is, with Have, Need and Chase as a segmented control under the search strip (the bottom
//     belongs to the tab bar and to the bars that take its place: Mark, the card, the table, the binder).
//   Trade: the Trade lens as a tab: the binder's cover, the traders, the spare tiles, the table.
//   Medal: the trophy room as the tab's root (no Back, no pinch to leave). The door at the end of the wall still
//     opens the same room inside the Chase tab, with Back, as before.
//   Feed: the listings found for your chases, newest first; a tap flies to the card on the wall.
//   Source: where Card Chaser looks (made up in dev): a switch per source, the import, alerts.
const canvasTab = (t) => t === "chase" || t === "trade" || t === "medal";
const pageOf = (t) => (t === "feed" ? pgFeed : t === "source" ? pgSource : t === "medal" ? pgMedal : null);
const tabBarShown = () => !document.body.matches(".focused, .offering, .marking, .trading, .inbinder, .showing, .welcoming, .storying, .arriving, .building, .paying");
function syncTabButtons() {
  tabBar.querySelectorAll("[data-tab]").forEach((b) => { if (b.dataset.tab === curTab) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
}
function setTab(t, { lens = null } = {}) {
  if (!TABS.includes(t)) return;
  if (t === curTab) { if (lens && t === "chase") { if (lens !== state.lens) lensIn(lens); } else tabTop(t); return; }
  leaveTab(curTab);
  curTab = t; document.body.dataset.tab = t;
  try { localStorage.setItem("wall-tab", t); } catch { /* fine */ }
  syncTabButtons();
  enterTab(t, lens);
  tick(3);
}
tabBar.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); });

// Anything moving on the wall lands where it was going; anything up over it goes.
function settleWall() {
  gesture = null; cancelPress(); inertia = false; shuffle = null;
  if (state.trans) { finishTransition(); const T = state.trans; if (T) { if (T.kind === "open") T.q = T.q >= 0.5 ? 1 : 0; state.trans = null; T.done?.(T); } }
  closePop(true); hideDealBar(); hideHow(); setFilterMenu(false);
  if (marking) leaveMark();
  if (state.focus) unfocus();
  if (fly) { Object.assign(cam, fly.b); fly = null; }
  if (tbl.on) closeTable(true);
  if (bnd.on) closeBinder(true);
  if (room.anim) finishRoomAnim();
}
function dropRoom() {
  Object.assign(room, { on: false, closing: false, anim: null, q: 0, pinch: null, fan: null, root: false });
  document.body.classList.remove("inroom");
}
function leaveTab(t) {
  if (!canvasTab(t) || (t === "medal" && !room.on)) { const el = pageOf(t); if (el && tabState[t]) tabState[t].scroll = el.scrollTop; if (t !== "medal") return; }
  settleWall();
  const s = tabState[t];
  if (t === "chase") s.lens = state.lens;
  s.view = view; s.g = state.g; s.cam = { ...cam };
  if (room.on) { s.room = { my: mScroll }; s.my = room.wallScroll; dropRoom(); } else { if (t !== "medal") s.room = null; s.my = mScroll; }
  view = "mosaic"; state.g = null;
}
function enterTab(t, lens = null) {
  hideCaption();
  if (!canvasTab(t)) { renderPage(t); const el = pageOf(t); el.scrollTop = tabState[t].scroll || 0; drawList(); return; }
  const s = tabState[t];
  state.lens = t === "trade" ? "trade" : t === "medal" ? "have" : lens || s.lens || "have";
  if (t === "chase") { s.lens = state.lens; try { localStorage.setItem("wall-lens", state.lens); } catch { /* fine */ } }
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === state.lens)));
  const roomUp = t === "medal" ? roomHas() : Boolean(s.room) && roomHas();
  document.body.classList.toggle("noroom", t === "medal" && !roomUp);
  if (roomUp) {
    Object.assign(room, { on: true, root: t === "medal", q: 1, anim: null, closing: false, fan: null, pinch: null, wallScroll: s.my });
    mScroll = s.room?.my || 0; document.body.classList.add("inroom");
  } else mScroll = s.my;
  layoutAll();
  for (const c of drawnCards) c.e = emphasis(c); // a tab is there at once: no fade from the last tab's colours
  if (s.view === "set" && s.g && groups.includes(s.g) && s.cam && (!room.on || inCase(s.g))) { view = "set"; state.g = s.g; Object.assign(cam, s.cam); clampCam(state.g); }
  if (t === "medal" && !roomUp) { renderPage("medal"); pgMedal.scrollTop = 0; }
  setChrome(); placeInk(); updateCount(); drawList(); kick();
}
// The tab you're on, tapped again: back to its top (out of a card, a set, the room pushed from the door).
function tabTop(t) {
  const el = pageOf(t);
  if (!canvasTab(t) || (t === "medal" && !room.on)) { el?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); return; }
  if (state.trans || bnd.on || tbl.on) return;
  if (state.focus) { unfocus(); return; }
  if (view === "set") { exitToMosaic(); return; }
  if (room.on && !room.root) { closeRoom(); return; }
  const from = mScroll; inertia = false;
  if (from <= 0) return;
  if (reduced) { mScroll = 0; kick(); return; }
  const t0 = performance.now();
  const go = (now) => { if (gesture || view !== "mosaic") return; const p = clamp((now - t0) / 340, 0, 1); mScroll = from * (1 - ease(p)); kick(); if (p < 1) requestAnimationFrame(go); };
  requestAnimationFrame(go);
}

// ----- lenses: Have, Need and Chase belong to the Chase tab; Trade is a tab of its own -----
function setLens(lens) {
  if (lens === "trade") { setTab("trade"); return; }
  if (curTab !== "chase") { setTab("chase", { lens }); return; }
  lensIn(lens);
}
// The base lens switch, inside the Chase tab (the flight between lenses is the wall's, not the tab bar's).
function lensIn(lens) {
  if (lens === state.lens) return;
  lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === lens)));
  const was = state.lens;
  state.lens = lens; tabState.chase.lens = lens; placeInk(); tick(5); hideCaption();
  try { localStorage.setItem("wall-lens", lens); } catch { /* fine */ }
  if (lens === "have") { const n = cards.filter((c) => c.owned).length, s = spareCount(); toast(`${n.toLocaleString()} of ${TOTAL.toLocaleString()} in your collection${s ? `, ${s} spare${s === 1 ? "" : "s"}` : ""}`); }
  if (lens === "need") { const n = cards.filter((c) => !c.owned).length; toast(`${n} cards to go`); }
  const news = lens === "chase" && live.news.some((c) => c.deal && isChase(c) && !c.owned);
  if (lens === "chase" && !news) { const n = cards.filter(isChase).length, d = cards.filter((c) => isChase(c) && c.deal).length; toast(n ? `${n} on your chase list${d ? `, ${d} with a live deal` : ""}` : "Nothing on your chase list yet. Open a card and choose Chase it."); }
  if (was === "chase") closePop(true);
  if (news) showDealBar(); else hideDealBar();
  liftLayout(); drawList(); updateCount(); kick();
}

// ----- chrome: Back belongs to a level you went into, never to a tab's root -----
function setChrome() {
  document.body.classList.toggle("inset", view === "set" || tbl.on);
  backBtn.hidden = view !== "set" && !tbl.on && !(room.on && !room.root) && !bnd.on;
  backBtn.setAttribute("aria-label", bnd.on && !tbl.on ? "Back to Trade" : room.on && view !== "set" ? "Back to the wall" : room.on ? "Back to the trophy room" : "Back to everything");
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = tbl.on ? `Trade with ${tbl.t.name}` : view === "set" && state.g ? state.g.name : bnd.on ? (bnd.show ? "Trade binder, Show mode" : "Trade binder") : room.on ? "Trophy room" : curTab === "chase" ? "" : curTab[0].toUpperCase() + curTab.slice(1);
  if (marking && view !== "set") leaveMark();
  syncShelfPad(); updateCount();
}

// ----- the trophy room as the Medal tab's root: it doesn't close, it's where the tab is -----
function closeRoom(instant = false) {
  if (!room.on || room.closing) return;
  if (room.root) { if (room.q < 1) { room.anim = { from: room.q, to: 1, t0: performance.now(), dur: 200 }; kick(); } return; }
  room.closing = true; room.fan = null; room.pinch = null;
  if (instant || reduced) { room.q = 0; room.anim = null; endRoom(); return; }
  room.anim = { from: room.q, to: 0, t0: performance.now(), dur: 160 + 320 * room.q }; tick(6); kick();
}
function endRoom() {
  const root = room.root;
  room.on = false; room.closing = false; room.anim = null; room.q = 0; room.pinch = null; room.fan = null; room.root = false;
  if (root) { // the last trophy went (a card taken back out): the Medal tab says so
    document.body.classList.remove("inroom"); document.body.classList.add("noroom"); renderPage("medal");
    mScroll = 0; layoutAll(); setChrome(); kick(); return;
  }
  mScroll = room.wallScroll; layoutAll();
  document.body.classList.remove("inroom"); setChrome(); kick();
}
// A search typed in the Medal tab is a search of the wall: it goes to Chase.
qIn.addEventListener("input", () => { if (curTab === "medal") setTab("chase"); }, true);
// Escape in the Medal tab's room has nowhere to go back to (the room's own key handler would close it).
addEventListener("keydown", (e) => {
  if (curTab !== "medal" || !room.root || view !== "mosaic" || tbl.on || document.activeElement === qIn) return;
  if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
function arToRoom() {
  if (tbl.on || mode !== "set") return;
  arLeave();
  arWhenStill(() => setTab("medal"));
}

// A pinch in the room closes it, except in the Medal tab, where the room is the tab (a spread on a plaque still opens
// its album). The rest is the base pinch.
function pinchMove(a, b) {
  const g = gesture, d = dist(a, b), m = mid(a, b), r = d / g.d0, now = evT || performance.now();
  if (g.snap) return;
  if (view === "mosaic") {
    if (room.on) {
      if (!room.root && (room.pinch || (r < 1 && !state.trans))) {
        if (!room.pinch) { room.pinch = { q0: room.q, qs: [] }; room.anim = null; }
        room.q = clamp(room.pinch.q0 - (1 - r) / 0.55, 0, 1); room.pinch.qs.push({ q: room.q, t: now }); kick(); return;
      }
      if (!g.g?.done) return;
    } else if (g.g?.door) { if (r > 1.12) { g.snap = true; openRoom(); } return; }
    else if (g.g?.tbCover) { if (r > 1.12) { g.snap = true; openBinder(); } return; }
    else if (g.g && (g.g.fan || g.g.pick)) return;
    if (!g.g) return;
    const q = clamp((r - 1) / 1.1, 0, 1);
    if (!state.trans && q > 0.01) state.trans = openTrans(g.g, 0, fitCam(g.g));
    if (state.trans?.kind === "open" && !state.trans.anim) { state.trans.q = q; g.qs.push({ q, t: now }); kick(); }
    return;
  }
  if (state.trans && state.trans.kind !== "open") return;
  const f = fitCam(state.g), s = g.cam.s * r;
  g.m = m; g.r = r;
  if (s < f.s * 0.995) {
    if (g.noClose) { Object.assign(cam, f); kick(); return; }
    if (!state.trans) { Object.assign(cam, f); state.trans = openTrans(state.g, 1, f); g.closeD = d * (f.s / s); }
    if (!state.trans.anim) { const q = clamp(1 - (1 - d / (g.closeD || d)) / 0.6, 0, 1); state.trans.q = q; g.qs.push({ q, t: now }); }
    kick(); return;
  }
  if (state.trans && !state.trans.anim) { state.trans = null; g.closeD = 0; g.qs = []; }
  const sc = Math.min(s, maxS());
  const wx = g.cam.x + g.m0.x / g.cam.s, wy = g.cam.y + g.m0.y / g.cam.s;
  cam.s = sc; cam.x = wx - m.x / sc; cam.y = wy - m.y / sc;
  clampCam(state.g);
  kick();
}

// ----- the feed: listings found for your chases (made up, seeded by card id) -----
// A listing is a live copy under market on a card you chase: the wall's own deals (c.deal) and every arrival since.
// Where it was found is seeded per listing: eBay most of the time, a favourite seller, TCGplayer's lowest, an online
// shop, or a Reddit trade post.
function srcOf(c) {
  const k = `${c.id}|src|${c.dealAt || 0}`, r = h32(k);
  if (r < 0.5) return { id: "ebay", name: "eBay", how: h32(`${k}|bin`) < 0.75 ? "Buy It Now" : "auction" };
  if (r < 0.6) return { id: "fav", name: "eBay", how: "pokemon_singles" };
  if (r < 0.74) return { id: "tcgplayer", name: "TCGplayer", how: "lowest listing" };
  if (r < 0.88) return { id: "shops", name: h32(`${c.id}|shop`) < 0.5 ? "TCG Republic" : "Loose Packs", how: "in stock" };
  return { id: "reddit", name: "Reddit", how: "r/pkmntcgtrades" };
}
const listedAt = (c) => c.dealAt || feedT0 - (0.6 + h32(`${c.id}|age`) * 70) * 3600e3; // the wall's own deals: listed in the last three days
function feedItems() {
  const out = [];
  for (const c of cards) { if (!c.deal || c.owned || !isChase(c)) continue; const s = srcOf(c); if (sourcesOff[s.id]) continue; out.push({ c, s, at: listedAt(c) }); }
  return out.sort((a, b) => b.at - a.at || a.c.i - b.c.i);
}
const feedFresh = new Set(); // arrived while you were looking: they slide in once
const cogBtn = `<button type="button" class="ib" data-prefs aria-label="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/></svg></button>`;
const pageHead = (title, sub) => `<header class="phead"><h1 tabindex="-1">${title}</h1>${cogBtn}</header><p class="psub">${sub}</p><div class="colorbar" aria-hidden="true"></div>`;
function renderFeed() {
  const items = feedItems(), chased = cards.filter(isChase).length, now = Date.now(), all = cards.filter((c) => c.deal && !c.owned && isChase(c)).length;
  const isNew = (it) => Boolean(it.c.dealAt) && it.at > feedPrevSeen;
  const news = items.filter(isNew).length;
  let body;
  if (!chased) body = `<div class="pempty"><b>Nothing to look for yet</b><span>Listings for the cards you chase land here, each against its market price. Open a card on the wall and choose Chase it.</span><button type="button" class="mbtn primary" data-go="chase">Go to the wall</button></div>`;
  else if (!items.length && all) body = `<div class="pempty"><b>Every source is off</b><span>${all} listing${all === 1 ? "" : "s"} for your chases are hidden. Switch a source back on to see them.</span><button type="button" class="mbtn primary" data-go="source">Open Source</button></div>`;
  else if (!items.length) body = `<div class="pempty"><b>Looking for your chases</b><span>New listings land here as they're found, newest first.</span></div>`;
  else body = `<ul class="feed">${items.map((it) => {
    const { c, s } = it, st = sets[c.si], pct = Math.round((1 - c.deal / c.price) * 100), n = isNew(it), fresh = feedFresh.has(c.id);
    return `<li class="fd${n ? " is-new" : ""}${fresh && !reduced ? " fd-in" : ""}"><button type="button" class="fd-row" data-ci="${c.i}" aria-label="${esc(c.name)}, ${money(c.deal)} on ${esc(s.name)}, ${pct}% under market${n ? ", new" : ""}. Show it on the wall.">
      <span class="fd-card" style="--t:${typeColor(c)}" aria-hidden="true"><em>${esc(c.num)}</em></span>
      <span class="fd-main"><span class="fd-name">${esc(c.name)}</span><span class="fd-meta">${esc(st.name)} #${esc(c.num)}, ${esc(c.rname)}</span></span>
      <span class="fd-price"><b>${c.dealWas ? `<s>${money(c.dealWas)}</s> ` : ""}${money(c.deal)}</b><small>Market ${money(c.price)}, <em>${pct}% under</em></small></span>
      <span class="fd-src">${n ? `<b class="fd-new">NEW</b>` : ""}<span>${esc(s.name)}, ${esc(s.how)}</span><span class="fd-ago">${agoText(it.at, now)}</span></span>
    </button></li>`;
  }).join("")}</ul><p class="pnote">Made up for the demo: a new listing for one of your chases lands every few seconds. Tap one to see the card on the wall.</p>`;
  const sub = !chased ? "Listings for the cards you chase." : `${items.length} listing${items.length === 1 ? "" : "s"} for ${chased} chased card${chased === 1 ? "" : "s"}, newest first.${news ? ` <b class="psub-new">${news} new</b>` : ""}`;
  document.getElementById("pg-feed-body").innerHTML = pageHead("Feed", sub) + body;
  feedFresh.clear();
}
// From a listing to the card itself: the Chase tab, its set opening, the card coming up close.
function feedToCard(c) {
  setTab("chase");
  const g = groups[c.g]; if (!g) return;
  if (document.body.classList.contains("listmode")) { listEl.querySelector(`[data-i="${c.i}"], [data-got="${c.i}"]`)?.scrollIntoView({ block: "center" }); return; }
  if (room.on) closeRoom(true);
  const land = () => setTimeout(() => { if (view === "set" && state.g === g && !state.trans) focus(c); }, 60);
  if (view === "set" && state.g === g) { land(); return; }
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  if (g.m) { const top = topPad(); if (g.m.y - mScroll < top || g.m.y + g.m.h - mScroll > vh - botPad()) mScroll = clamp(g.m.y - top - 10, 0, mMax); }
  enterGroup(g, { then: land });
}

// ----- source: where Card Chaser looks (mostly static in dev; a switch takes a source's listings out of the feed) -----
const SOURCES_PAGE = [
  ["Marketplaces", [["ebay", "eBay", "Every card you chase, searched every 30 minutes."], ["fav", "Favorite sellers", "pokemon_singles. Their newest listings are checked every scan, and score a little higher."], ["tcgplayer", "TCGplayer", "The lowest listing, when it beats market by 15% or more."], ["reddit", "Reddit", "New trade posts on r/pkmntcgtrades, read line by line."]]],
  ["Shops", [["shops", "Online shops", "TCG Republic and Loose Packs, checked every 30 minutes."], ["local", "Local shops", "4 near Chico, with their hours and directions.", true]]],
];
function renderSource() {
  const counts = {};
  for (const c of cards) if (c.deal && !c.owned && isChase(c)) { const id = srcOf(c).id; counts[id] = (counts[id] || 0) + 1; }
  let imp = "";
  try { imp = localStorage.getItem("wall-imported") || ""; } catch { /* none */ }
  const owned = cards.filter((c) => c.owned).length;
  const sw = (id, label, on) => `<label class="sw"><input type="checkbox" role="switch" data-src="${id}" aria-label="${esc(label)}"${on ? " checked" : ""}><span aria-hidden="true"></span></label>`;
  const row = ([id, name, line, fixed]) => `<li class="src${!fixed && sourcesOff[id] ? " off" : ""}"><span class="src-main"><b>${esc(name)}</b><small>${esc(line)}${!fixed && counts[id] && !sourcesOff[id] ? ` ${counts[id]} in your feed.` : ""}</small></span>${fixed ? "" : sw(id, name, !sourcesOff[id])}</li>`;
  const impLine = imp && imp !== "1" ? `From ${esc(imp)}. ${owned.toLocaleString()} cards on your wall.` : imp ? `${owned.toLocaleString()} cards on your wall.` : "Nothing imported yet. Bring your collection in from TCGplayer or Collectr.";
  document.getElementById("pg-source-body").innerHTML = pageHead("Source", "Where Card Chaser looks for the cards you chase. Anything you switch off leaves your feed.") +
    SOURCES_PAGE.map(([h, rows]) => `<h2>${h}</h2><ul class="srcs">${rows.map(row).join("")}</ul>`).join("") +
    `<h2>Your collection</h2><ul class="srcs"><li class="src"><span class="src-main"><b>Import</b><small>${impLine}</small></span>${imp ? "" : `<button type="button" class="mbtn" data-import>Import</button>`}</li></ul>` +
    `<h2>Alerts</h2><ul class="srcs"><li class="src${alertsOn ? "" : " off"}"><span class="src-main"><b>Phone alerts</b><small>When a listing 25% or more under market lands. Nothing is sent in this demo.</small></span>${sw("alerts", "Phone alerts", alertsOn)}</li></ul>` +
    `<p class="pnote">The sources are the ones production uses; the listings here are made up.</p>`;
}
function renderMedalEmpty() {
  document.getElementById("pg-medal-body").innerHTML = pageHead("Medal", "Your trophy room.") +
    `<div class="pempty"><b>No trophies yet</b><span>Every set and chase earns them as it fills: a quarter of a binder, half, the holos, the last card. Mark what you have on the wall and they start coming.</span><button type="button" class="mbtn primary" data-go="chase">Go to the wall</button></div>`;
}
function renderPage(t) { if (t === "feed") renderFeed(); else if (t === "source") renderSource(); else if (t === "medal") renderMedalEmpty(); }
for (const el of [pgFeed, pgSource, pgMedal]) el.addEventListener("click", (e) => {
  if (e.target.closest("[data-prefs]")) { prefs.showModal(); return; }
  const go = e.target.closest("[data-go]"); if (go) { setTab(go.dataset.go); return; }
  const row = e.target.closest("[data-ci]"); if (row) { tick(4); feedToCard(cards[Number(row.dataset.ci)]); return; }
  if (e.target.closest("[data-import]")) { setTab("chase"); if (!wel.on) startWelcome(); }
});
pgSource.addEventListener("change", (e) => {
  const x = e.target.closest("[data-src]"); if (!x) return;
  tick(4);
  if (x.dataset.src === "alerts") { alertsOn = x.checked; try { localStorage.setItem("wall-alerts", alertsOn ? "1" : ""); } catch { /* fine */ } toast(alertsOn ? "Phone alerts on" : "Phone alerts off"); renderSource(); return; }
  if (x.checked) delete sourcesOff[x.dataset.src]; else sourcesOff[x.dataset.src] = true;
  try { localStorage.setItem("wall-sources", JSON.stringify(sourcesOff)); } catch { /* fine */ }
  toast(x.checked ? "Source on" : "Source off. Its listings leave your feed."); renderSource(); live.badgeN = -1; syncBadge();
});

// ----- a deal arrives: the tile flashes where it sits, the listing lands at the top of the Feed, the Feed tab counts it -----
function syncBadge() {
  let n = 0;
  if (curTab !== "feed") for (const c of cards) if (c.deal && c.dealAt && c.dealAt > feedSeenAt && !c.owned && isChase(c) && !sourcesOff[srcOf(c).id]) n++;
  if (n === live.badgeN) return;
  live.badgeN = n;
  feedBadge.textContent = n > 99 ? "99+" : String(n); feedBadge.hidden = !n;
  if (n) feedTabBtn.setAttribute("aria-label", `Feed, ${n} new`); else feedTabBtn.removeAttribute("aria-label");
}
function glowChase() {
  syncBadge();
  feedTabBtn.classList.remove("tglow"); void feedTabBtn.offsetWidth; feedTabBtn.classList.add("tglow");
  clearTimeout(glowChase.t); glowChase.t = setTimeout(() => feedTabBtn.classList.remove("tglow"), 1100);
}
function showArrival(c, drop) {
  const now = performance.now(), g = groups[c.g];
  // In the Chase lens (and the Trade tab's lift) the tile slides to the front of its set, as before.
  if (lifted && !state.focus) { if (state.trans || live.quick) layoutAll(); else liftLayout(true); }
  c.flash = { t0: now, drop }; for (const t of twinsOf(c)) t.flash = { t0: now, drop };
  if (!reduced) g.ripple = { t0: now, col: c.col, row: c.row, live: true };
  live.until = now + 3200;
  if (!live.news.includes(c)) live.news.push(c);
  if (state.lens === "chase" && !dealBar.hidden) showDealBar();
  const on = !sourcesOff[srcOf(c).id];
  if (curTab === "feed") { if (on) { feedFresh.add(c.id); feedSeenAt = Date.now(); } }
  else if (on && tabBarShown()) {
    // The line races from the tile to the Feed tab, where the listing just landed.
    if (!reduced && canvasTab(curTab) && !room.on) {
      const a = tileStart(c), b = feedTabBtn.getBoundingClientRect(), x1 = b.left + b.width / 2, y1 = b.top + 6;
      live.line = { t0: now + 120, x0: a.x, y0: a.y, cx: x1 + (a.x - x1) * 0.15, cy: a.y + (y1 - a.y) * 0.35, x1, y1 };
      setTimeout(glowChase, 640);
    } else glowChase();
  } else syncBadge();
  drawList(); kick();
}

// ----- the card's deal names where it was found -----
function fillPanel(c, dir) {
  const st = sets[c.si];
  const swap = document.getElementById("swap");
  const put = () => {
    document.getElementById("p-name").textContent = c.name;
    document.getElementById("p-meta").textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. ${c.variant ? `${c.variant}. ` : ""}${c.rname}.${c.owned && c.got ? ` Yours since ${new Date(c.got).toLocaleDateString("en-US", { month: "short", year: "numeric" })}.` : ""}${!c.owned && isChase(c) ? ` Pay up to ${money(capOf(c))}.` : c.owned && isSpare(c) ? " You have a spare." : ""}`;
    document.getElementById("p-price").innerHTML = `${money(c.price)}<small>market</small>`;
    const dl = document.getElementById("p-deal");
    if (!c.owned && c.deal && isChase(c)) { dl.hidden = false; dl.textContent = `A copy on ${srcOf(c).name} for ${money(c.deal)} right now, ${Math.round((1 - c.deal / c.price) * 100)}% under.`; } else dl.hidden = true;
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
function offersFor(c, kind) {
  const st = sets[c.si], r = (k) => h32(`${c.id}|${kind}|${k}`), out = [];
  const vintage = st.year < 2010, packBase = vintage ? 160 + r("b") * 420 : 3.8 + r("b") * 5;
  if (kind === "single") {
    const n = 3 + Math.floor(r("n") * 4);
    for (let i = 0; i < n; i++) out.push({ title: `${c.name} ${c.num}/${st.printed}`, price: Math.round(c.price * (0.82 + r(`p${i}`) * 0.55) * 100) / 100, src: SOURCES[Math.floor(r(`s${i}`) * 3)], cond: CONDS[Math.floor(r(`c${i}`) * 4)], ship: r(`f${i}`) < 0.4 ? 0 : Math.round((0.99 + r(`h${i}`) * 4) * 100) / 100, q: `pokemon ${c.name} ${c.num}/${st.printed} ${st.name}` });
    if (c.deal) out.push({ title: `${c.name} ${c.num}/${st.printed}`, price: c.deal, src: srcOf(c).name, cond: "Near mint", ship: 0, q: `pokemon ${c.name} ${c.num}/${st.printed} ${st.name}`, live: true });
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

// ----- the list: the same tabs, readable by a screen reader (the Medal tab lists the trophies) -----
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (tabLive) {
    if (curTab === "feed") renderFeed(); else if (curTab === "source") renderSource();
    else if (curTab === "medal" && !room.on && view === "mosaic" && !state.trans && roomHas() && !document.body.classList.contains("listmode")) enterTab("medal"); // the first trophy: the room opens in its tab
    syncBadge();
  }
  if (!document.body.classList.contains("listmode")) return;
  const rows = (items) => `<ul>${items.map(row).join("")}</ul>`;
  const row = (c) => {
    const st = sets[c.si];
    return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${lstateOf(c)}</span></button></li>`;
  };
  if (tabLive && curTab === "medal") { listEl.querySelector("#list-body").innerHTML = trophyListHTML(() => true, rows) || `<p class="lsub">No trophies yet. Every set and chase earns them as it fills.</p>`; return; }
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
  listEl.querySelector("#list-body").innerHTML = top + trophyListHTML(show, rows) + groups.map((g) => {
    if (g.done) return "";
    const items = g.cards.filter((c) => !c.ph && show(c));
    if (!items.length) return "";
    const f = finishOf(g);
    return `<section><h2>${g.name}</h2><p class="lsub">${f ? `Finished ${dayOf(f.at)}, worth ${money(worthOf(g.base))}. On the wall. ` : ""}${g.sub()}</p><ul>${items.map(row).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

// ----- the welcome: the lens now sits at the top of the Chase tab -----
function welcomeSync() {
  if (!wel.on) return;
  const inSet = view === "set" && Boolean(state.g);
  const marked = wel.step === 2 ? Math.max(0, ownedTotal() - wel.own0) : 0, chasing = wel.step === 3 ? chaseTotal() : 0;
  const key = `${wel.step}|${wel.imp}|${inSet}|${marking}|${mode}|${wel.picks.size}|${marked}|${chasing}|${wel.chased}|${wel.only}`;
  if (key === wel.key) return;
  wel.key = key;
  wDots.forEach((d, i) => d.classList.toggle("on", i === wel.step - 1));
  welEl.classList.toggle("only", wel.only); welEl.classList.toggle("intro", wel.step === 0);
  wProg.hidden = wel.imp !== "busy"; wSrc.hidden = wel.imp !== "pick"; wOpt.hidden = wel.imp !== "pick"; wOr.hidden = wel.step !== 0 || wel.imp === "busy"; wAlt.hidden = wel.step !== 0 || wel.imp === "busy"; wDex.hidden = wel.step !== 1;
  wNext.hidden = wel.step === 0 && wel.imp !== null; wSkip.hidden = wel.imp === "busy"; wSkip.textContent = wel.only ? "Cancel" : "Skip"; wTally.hidden = wel.step === 0;
  wAll.hidden = !(wel.step === 2 && inSet && marking);
  if (wel.step === 0) {
    if (wel.imp === "busy") { wTitle.textContent = "Looking for your collection"; wLine.textContent = `Reading your ${wel.src} collection. About a second.`; }
    else if (wel.imp === "pick") { wTitle.textContent = "Import your collection"; wLine.textContent = "Where do you keep it? The import is pretend in this demo."; wAlt.textContent = "Mark by hand instead"; }
    else { wTitle.textContent = "Welcome to your wall"; wLine.textContent = "Every card you collect, on one wall. Bring your collection in, or mark it by hand."; wNext.textContent = "Import from TCGplayer or Collectr"; wNext.disabled = false; wAlt.textContent = "Pick your sets and mark by hand"; }
  } else if (wel.step === 1) {
    wTitle.textContent = "Which sets do you collect?";
    wLine.textContent = mode !== "set" ? "Choose Set chase (top left) to pick sets." : wel.picks.size ? "Tap more, or continue. The others fold back." : "Tap the sets you collect. The others fold back.";
    wN.textContent = String(wel.picks.size); wWhat.textContent = wel.picks.size === 1 ? "set" : "sets";
    wNext.textContent = wel.only ? "Done" : "Continue"; wNext.disabled = !wel.only && !wel.picks.size;
  } else if (wel.step === 2) {
    wTitle.textContent = "Mark a few you have";
    wLine.textContent = !inSet ? "Open a set to mark what you have." : marking ? "Tap a card you have, drag across a row, or take the whole set." : "Press and hold a card you have, then sweep along the row.";
    wN.textContent = String(marked); wWhat.textContent = "marked";
    wNext.textContent = "Continue"; wNext.disabled = false;
  } else {
    wTitle.textContent = "Chase one";
    wLine.textContent = wel.chased ? "It's on your chase list. Chase, at the top of the wall, keeps everything you're after, and the Feed finds them." : !inSet ? "Open a set, then press and hold a card you don't have." : "Press and hold a card you don't have to put it on your chase list.";
    wN.textContent = String(chasing); wWhat.textContent = "chasing";
    wNext.textContent = "Done"; wNext.disabled = false;
  }
  wN.classList.toggle("zero", wN.textContent === "0");
  if (wel.step <= 1 && inSet && !wel.only && wel.imp !== "busy") { if (state.g.set) wel.picks.add(state.g.set.id); wel.imp = null; gotoStep(2); }
  if (wel.step === 3 && chasing && !wel.chased) { wel.chased = true; welcomeSync(); }
  if (wel.step === 3 && inSet && !marking && !state.trans && !state.focus) enterMark();
}
function finishWelcome(skipped) {
  if (!wel.on) return;
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); } catch { /* fine */ }
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  if (wel.only) { kick(); return; }
  if (!skipped && view === "set" && !state.trans) exitToMosaic();
  setTimeout(() => toast("Have, Need and Chase recolor the wall. Tap a set to open it."), skipped ? 300 : 700);
  kick();
}

// Debug builds only: the tests' hook learns about the tabs.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { tab: { get: () => curTab }, setTab: { value: setTab }, tabState: { value: tabState }, feedItems: { value: feedItems }, srcOf: { value: srcOf }, arrive: { value: arrive } }); }, 0);

// The ink under the lens segment: the Trade lens has no segment of its own (it's a tab), so there may be nothing to sit under.
function placeInk() {
  const b = lensBox.querySelector('[aria-pressed="true"]');
  if (!b) { lensInk.style.setProperty("--w", "0px"); return; }
  lensInk.style.setProperty("--x", `${b.offsetLeft}px`); lensInk.style.setProperty("--w", `${b.offsetWidth}px`);
}
