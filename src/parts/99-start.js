// ---------- start ----------
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readTheme(); kick(); });
addEventListener("resize", () => { resize(); placeInk(); });
readTheme();
arrange(mode);
vw = innerWidth; vh = innerHeight;
if (state.lens === "time") state.lens = "all"; // Time starts from the beginning when you pick it, so it isn't restored
lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === state.lens)));
resize();
started = true;
if (state.lens === "wants") enterWants();
setChrome();
markMode();
try { if (localStorage.getItem("wall-list") === "1") setListMode(true); } catch { /* fine */ }
updateCount();
placeInk();
// The opening: the collection inks in, set by set, oldest first.
cards.forEach((c) => { c.intro = c.g * 140 + c.k * 2.2; });
state.introT0 = performance.now();
setTimeout(() => { if (!firstTouch) document.getElementById("caption").classList.add("gone"); }, 9000);
document.fonts?.ready.then(() => kick());
kick();
