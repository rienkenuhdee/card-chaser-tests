// ---------- round 21: start on the tab you left ----------
// The wall has started (99-start.js) in the Chase tab's lens; Trade is a tab now, not a lens of the Chase tab.
tabLive = true;
if (state.lens === "trade") state.lens = tabState.chase.lens;
tabState.chase.lens = state.lens;
lensBox.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lens === state.lens)));
syncTabButtons();
if (curTab === "chase") { layoutAll(); setChrome(); placeInk(); }
else { const t = curTab; curTab = "chase"; document.body.dataset.tab = "chase"; setTimeout(() => setTab(t), 0); } // after the medals have booted
syncBadge();
