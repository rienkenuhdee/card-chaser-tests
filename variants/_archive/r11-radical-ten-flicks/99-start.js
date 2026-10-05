// ---------- start ----------
// The same start as the base, except the opening: a first visit begins with the ten flicks (80-flicks.js) and the wall
// assembles itself at the end of them; later visits ink in as today. The caption is gone for good.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); kick(); });
addEventListener("resize", () => { resize(); placeInk(); });
try { const t = localStorage.getItem("wall-theme"); if (t === "light" || t === "dark") setTheme(t); } catch { /* auto */ }
readTheme();
arrange(mode);
vw = innerWidth; vh = innerHeight;
lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === state.lens)));
markFilters();
resize();
started = true;
setChrome();
markMode();
try { if (localStorage.getItem("wall-list") === "1") setListMode(true); } catch { /* fine */ }
updateCount();
placeInk();
if (flicked) {
  // Back again: the collection inks in, set by set, oldest first.
  cards.forEach((c) => { c.intro = c.g * 140 + c.k * 2.2; });
  state.introT0 = performance.now();
} else deckStart();
document.fonts?.ready.then(() => kick());
kick();
