// ---------- toast, about ----------
const toastEl = document.getElementById("toast");
function toast(t, action = null, label = "Undo") {
  toastEl.textContent = t;
  if (action) {
    const b = document.createElement("button"); b.textContent = label; b.className = "toast-btn";
    b.onclick = () => { toastEl.classList.remove("show"); action(); };
    toastEl.append(" ", b);
  }
  toastEl.classList.toggle("act", Boolean(action));
  toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), action ? 4500 : 2200);
}
const about = document.getElementById("about");
document.getElementById("info").onclick = () => about.showModal();
document.getElementById("about-close").onclick = () => about.close();
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases", "wall-scope", "wall-done", "wall-spares", "wall-copies", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value", "wall-medals"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };

// ---------- settings: appearance, the list, reset ----------
const prefs = document.getElementById("prefs");
document.getElementById("settings").onclick = () => prefs.showModal();
document.getElementById("prefs-close").onclick = () => prefs.close();
function setTheme(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  prefs.querySelectorAll("[data-theme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === t)));
  try { localStorage.setItem("wall-theme", t); } catch { /* fine */ }
  readTheme(); kick();
}
prefs.querySelectorAll("[data-theme]").forEach((b) => (b.onclick = () => setTheme(b.dataset.theme)));

// ---------- home: tap the count to see the whole wall ----------
document.getElementById("count").addEventListener("click", (e) => { e.preventDefault(); if (view === "set") exitToMosaic(); else if (bnd.on) closeBinder(); else if (room.on) closeRoom(); });

// ---------- rearrange: the sets and your chases, or price bands (under the Value filter) ----------
function rearrange(m) {
  if (m === mode || state.trans) return;
  unfocus(); hideCaption(); if (bnd.on) closeBinder(true);
  const run = () => {
    for (const c of drawnCards) c.pm = { ...c.m };
    const was = new Set(drawnCards);
    arrange(m); layoutAll(); markFilters();
    for (const c of drawnCards) { if (!was.has(c)) c.pm = { ...(c.base?.pm || c.m) }; }
    for (const c of drawnCards) c.delay = reduced ? 0 : Math.min(520, c.g * 60 + c.k * 0.7);
    for (const g of groups) { g.ripple = null; g.burst = 0; }
    state.trans = { kind: "morph", t0: performance.now(), dur: reduced ? 1 : 1300, done: () => kick() };
    tick(10);
    toast(m === "set" ? "Your sets and chases, oldest first" : "Grouped by price: the more it's worth, the bigger");
    drawList(); kick();
  };
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  run();
}

// ---------- the list: the same wall, readable by a screen reader or a keyboard ----------
const listEl = document.getElementById("list");
function drawList() {
  if (doneDirty && !quietLayout) { doneDirty = false; syncDone({ quiet: true }); }
  if (!document.body.classList.contains("listmode")) return;
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
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-got]"); if (b) gotIt(pool[Number(b.dataset.got)]); });
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const c = pool[Number(b.dataset.i)]; setOwned(c, !c.owned, { undo: () => setOwned(c, !c.owned, { quiet: true }) }); });
function setListMode(on) {
  if (on) leaveMark(); // the list has its own way to mark (tap a row)
  document.body.classList.toggle("listmode", on);
  try { localStorage.setItem("wall-list", on ? "1" : ""); } catch { /* fine */ }
  unfocus(); drawList();
  if (on) listEl.querySelector("h1")?.focus(); else { kick(); canvas.focus(); }
}
document.getElementById("to-list").onclick = () => { prefs.close(); setListMode(true); };
document.getElementById("to-wall").onclick = () => setListMode(false);
