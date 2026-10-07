// ---------- start ----------
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); kick(); });
addEventListener("resize", () => { resize(); placeInk(); });
try { const t = localStorage.getItem("wall-theme"); if (t === "light" || t === "dark") setTheme(t); } catch { /* auto */ }
readTheme();
arrange(mode);
vw = innerWidth; vh = innerHeight;
lensBtns.forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === state.lens)));
markFilters(); // Show, Value, Group by and the orders are remembered; Time starts from the beginning when you pick it, so it isn't
resize();
started = true;
setChrome();
try { if (localStorage.getItem("wall-list") === "1") setListMode(true); } catch { /* fine */ }
updateCount();
placeInk();
// The opening: the collection inks in, set by set, oldest first.
cards.forEach((c) => { c.intro = c.g * 140 + c.k * 2.2; });
state.introT0 = performance.now();
if (!welcomed) { document.body.classList.add("welcoming"); setTimeout(() => startWelcome(), 0); } // a first run: the welcome comes up once the wall has inked in
document.fonts?.ready.then(() => kick());
kick();
