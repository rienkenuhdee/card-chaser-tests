// ---------- toast, about ----------
const toastEl = document.getElementById("toast");
function toast(t, action = null) {
  toastEl.textContent = t;
  if (action) {
    const b = document.createElement("button"); b.textContent = "Undo"; b.className = "toast-btn";
    b.onclick = () => { toastEl.classList.remove("show"); action(); };
    toastEl.append(" ", b);
  }
  toastEl.classList.toggle("act", Boolean(action));
  toastEl.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove("show"), action ? 4500 : 2200);
}
const about = document.getElementById("about");
document.getElementById("info").onclick = () => about.showModal();
document.getElementById("about-close").onclick = () => about.close();
document.getElementById("reset").onclick = () => { saved = {}; persist(); location.reload(); };

// ---------- home: tap the count to see the whole wall ----------
document.getElementById("count").addEventListener("click", (e) => { e.preventDefault(); if (view === "set") exitToMosaic(); });

// ---------- rearrange: by set, by Pokémon, by value ----------
const arrBtn = document.getElementById("arrange"), arrMenu = document.getElementById("arrange-menu");
function setMenu(open) { arrMenu.hidden = !open; arrBtn.setAttribute("aria-expanded", String(open)); if (open) arrMenu.querySelector(`[data-mode="${mode}"]`)?.focus(); }
arrBtn.onclick = (e) => { e.stopPropagation(); setMenu(arrMenu.hidden); };
addEventListener("pointerdown", (e) => { if (!arrMenu.hidden && !e.target.closest("#arrange-menu, #arrange")) setMenu(false); });
arrMenu.addEventListener("keydown", (e) => { if (e.key === "Escape") { setMenu(false); arrBtn.focus(); } });
function markMode() { arrMenu.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode))); }
arrMenu.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { setMenu(false); rearrange(b.dataset.mode); }));
function rearrange(m) {
  if (m === mode || state.trans) return;
  unfocus(); hideCaption();
  const run = () => {
    for (const c of cards) c.pm = { ...c.m };
    arrange(m); layoutAll(); markMode();
    for (const c of cards) c.delay = reduced ? 0 : Math.min(520, c.g * 60 + c.k * 0.7);
    for (const g of groups) { g.ripple = null; g.burst = 0; }
    state.trans = { kind: "morph", t0: performance.now(), dur: reduced ? 1 : 1300, done: () => kick() };
    tick(10);
    toast(m === "set" ? "By set, oldest first" : m === "pokemon" ? "By Pokémon, region by region" : "By value: the more it's worth, the bigger");
    drawList(); kick();
  };
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  run();
}

// ---------- the list: the same wall, readable by a screen reader or a keyboard ----------
const listEl = document.getElementById("list");
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "deals" ? !c.owned && c.deal : true);
  listEl.querySelector("#list-body").innerHTML = groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? "Have it" : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const c = cards[Number(b.dataset.i)]; setOwned(c, !c.owned, { undo: () => setOwned(c, !c.owned, { quiet: true }) }); });
function setListMode(on) {
  if (on) leaveMark(); // the list has its own way to mark (tap a row)
  document.body.classList.toggle("listmode", on);
  try { localStorage.setItem("wall-list", on ? "1" : ""); } catch { /* fine */ }
  unfocus(); drawList();
  if (on) listEl.querySelector("h1")?.focus(); else { kick(); canvas.focus(); }
}
document.getElementById("to-list").onclick = () => { about.close(); setListMode(true); };
document.getElementById("to-wall").onclick = () => setListMode(false);
