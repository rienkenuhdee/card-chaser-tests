// ---------- round 21: production's five tabs around the wall (state) ----------
// Feed, Chase, Trade, Medal, Source along the bottom, in production's words and colours. Chase is the wall as it is;
// Trade is the Trade lens (the binder's cover, the traders, the spare tiles) as a tab; Medal is the trophy room as the
// tab's root; Feed and Source are plain pages. This part only holds the state the layout needs early; the tabs
// themselves are in 96-tabs.js, and 99-tabs.js puts you on the tab you left.
const TABS = ["feed", "chase", "trade", "medal", "source"];
const SEG_TOP = 116; // the wall's top in the Chase tab: the search strip and the lens segment above it
let curTab = "chase", tabLive = false; // tabLive: every part has run (topPad may then look at the room and the binder)
try { const t = localStorage.getItem("wall-tab"); if (TABS.includes(t) && localStorage.getItem("wall-welcomed") === "1") curTab = t; } catch { /* the Chase tab */ }
document.body.dataset.tab = curTab;
// What each tab was showing when you left it: the lens, the level (mosaic or a set and its camera), the scroll, and
// whether the trophy room was up. The pages keep their scrollTop.
const tabState = {
  chase: { lens: "have", view: "mosaic", g: null, cam: null, my: 0, room: null },
  trade: { lens: "trade", view: "mosaic", g: null, cam: null, my: 0, room: null },
  medal: { lens: "have", view: "mosaic", g: null, cam: null, my: 0, room: { my: 0 } },
  feed: { scroll: 0 }, source: { scroll: 0 },
};
try { const l = localStorage.getItem("wall-lens"); if (["have", "need", "chase"].includes(l)) tabState.chase.lens = l; } catch { /* Have */ }
// The feed: what's new is what arrived since you last opened it.
let feedSeenAt = Date.now(), feedPrevSeen = Date.now();
const feedT0 = Date.now();
let sourcesOff = {};
try { sourcesOff = JSON.parse(localStorage.getItem("wall-sources") || "{}") || {}; } catch { sourcesOff = {}; }
let alertsOn = false;
try { alertsOn = localStorage.getItem("wall-alerts") === "1"; } catch { /* off */ }
const tabBar = document.getElementById("tabbar"), feedTabBtn = tabBar.querySelector('[data-tab="feed"]'), feedBadge = feedTabBtn.querySelector(".tbadge");
const pgFeed = document.getElementById("pg-feed"), pgSource = document.getElementById("pg-source"), pgMedal = document.getElementById("pg-medal");
