// ---------- show mode: the wall as a one-thumb checklist of your wants (round 9) ----------
// At a show you walk between tables with cards in one hand and the phone in the other. Show turns the wall into a
// checklist like Reminders: your wants by set, oldest first, big type, the most you'd pay on the right. Tick a row
// when you find it (Got it, with Undo), search along the bottom within thumb reach, and Wall takes you back to the
// wall exactly where you left it. The wall itself is untouched underneath.
const SHOW = { city: "Sacramento", dates: "Nov 20 to 22" };

// ----- wants -----
// A card is a want if you don't own it and either you said so (Want it on the card panel) or the demo seeded it.
let wants = {};
try { wants = JSON.parse(localStorage.getItem("wall-wants") || "{}") || {}; } catch { wants = {}; }
const persistWants = () => { try { localStorage.setItem("wall-wants", JSON.stringify(wants)); } catch { /* private mode */ } };
const isWant = (c) => !c.owned && (wants[c.id] != null ? Boolean(wants[c.id]) : h32(c.id + "w") < 0.1);
const maxPay = (c) => Math.round(c.price * 0.85 * 100) / 100;
const wantList = () => cards.filter(isWant);
function setWant(c, on) { wants[c.id] = on; persistWants(); if (state.focus === c) fillPanel(c, 0); drawList(); }

// "Want it" on the card panel, between I have it and Find a copy. An owned card can't be a want, so it hides then.
const wantBtn = document.createElement("button");
wantBtn.type = "button"; wantBtn.className = "act"; wantBtn.id = "p-want"; wantBtn.textContent = "Want it";
document.getElementById("p-own").after(wantBtn);
wantBtn.onclick = () => {
  const c = state.focus; if (!c) return;
  setWant(c, !isWant(c)); tick(6);
  const n = wantList().length;
  toast(isWant(c) ? `${c.name} on your list. ${n} want${n === 1 ? "" : "s"}.` : `${c.name} off your list.`);
};
function fillPanel(c, dir) {
  const st = sets[c.si];
  const swap = document.getElementById("swap");
  const put = () => {
    document.getElementById("p-name").textContent = c.name;
    document.getElementById("p-meta").textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. ${c.rname}.${c.owned && c.got ? ` Yours since ${new Date(c.got).toLocaleDateString("en-US", { month: "short", year: "numeric" })}.` : ""}`;
    document.getElementById("p-price").innerHTML = `${money(c.price)}<small>market</small>`;
    const dl = document.getElementById("p-deal");
    if (!c.owned && c.deal) { dl.hidden = false; dl.textContent = `A copy on eBay for ${money(c.deal)} right now, ${Math.round((1 - c.deal / c.price) * 100)}% under.`; } else dl.hidden = true;
    const own = document.getElementById("p-own"), buy = document.getElementById("p-buy");
    own.textContent = c.owned ? "In your collection ✓" : "I have it";
    own.className = `act ${c.owned ? "owned" : "primary"}`;
    own.setAttribute("aria-pressed", String(c.owned));
    buy.textContent = c.owned ? "Back to the set" : c.deal ? `Buy for ${money(c.deal)}` : "Find a copy";
    const w = isWant(c);
    wantBtn.hidden = c.owned;
    wantBtn.parentElement.classList.toggle("three", !c.owned);
    wantBtn.textContent = w ? "On your list ✓" : "Want it";
    wantBtn.className = `act ${w ? "wanted" : ""}`;
    wantBtn.setAttribute("aria-pressed", String(w));
  };
  if (dir && !reduced) { swap.classList.add("out"); setTimeout(() => { put(); swap.classList.remove("out"); }, 140); } else put();
}

// ----- the surface -----
let showOn = false, offered = false;
try { offered = localStorage.getItem("wall-show-offered") === "1"; } catch { /* fine */ }
const show = { hold: false, open: null, q: "" };
const showEl = document.createElement("section");
showEl.className = "sh"; showEl.id = "show"; showEl.hidden = true; showEl.setAttribute("aria-label", "Your wants for the show");
showEl.innerHTML = `
  <header class="sh-head">
    <p class="sh-eyebrow">${SHOW.city} card show, ${SHOW.dates}</p>
    <h1 id="sh-h" tabindex="-1"></h1>
    <p class="sh-sub" id="sh-sub"></p>
  </header>
  <div class="sh-list" id="sh-list"><div class="sh-wrap" id="sh-wrap"></div></div>
  <div class="sh-bar" id="sh-bar"><div class="in">
    <label class="sh-search" id="sh-search"><span class="sr">Find a card</span>
      <input id="sh-q" type="search" placeholder="Search any card" autocomplete="off" enterkeyhint="search">
      <button type="button" class="sh-clear" id="sh-clear" aria-label="Clear search"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="stroke:currentColor;stroke-width:2.2;stroke-linecap:round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </label>
    <button type="button" class="sh-wall" id="sh-wall">Wall</button>
  </div></div>`;
document.body.append(showEl);
const shH = showEl.querySelector("#sh-h"), shSub = showEl.querySelector("#sh-sub"), shWrap = showEl.querySelector("#sh-wrap"), shList = showEl.querySelector("#sh-list");
const shQ = showEl.querySelector("#sh-q"), shSearch = showEl.querySelector("#sh-search"), shBar = showEl.querySelector("#sh-bar"), shWall = showEl.querySelector("#sh-wall");

// The Show button in the top strip, beside About.
const showBtn = document.createElement("button");
showBtn.type = "button"; showBtn.className = "showbtn"; showBtn.id = "show-btn"; showBtn.textContent = "Show";
showBtn.setAttribute("aria-label", `Show mode: your wants as a list for ${SHOW.city}`); showBtn.setAttribute("aria-pressed", "false");
document.getElementById("info").before(showBtn);
showBtn.onclick = () => enterShow();
shWall.onclick = () => leaveShow();

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function matchCards(q) {
  const words = q.split(/\s+/);
  return cards.filter((c) => { const hay = `${c.name} ${sets[c.si].name} ${c.num} ${c.rname} ${(TYPE[c.type] || TYPE.C)[0]}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
}
function renderHead() {
  const w = wantList(), total = w.reduce((a, c) => a + maxPay(c), 0);
  shH.textContent = w.length ? `${plural(w.length, "want")}, about ${short(total)}` : "No wants yet";
  shSub.textContent = show.q ? "Any card. A tick means you have it." : w.length ? "The most you'd pay for each, by set, oldest first." : "Want it on any card puts it here.";
}
const LIMIT = 80;
function rowHTML(c) {
  const st = sets[c.si], w = isWant(c);
  const pay = w ? `<span class="sh-pay">${money(maxPay(c))}</span>`
    : `<span class="sh-pay muted">${money(c.price)}<small>${c.owned ? "have it" : "need it"}</small></span>`;
  return `<li class="sh-row${c.owned ? " have" : ""}${show.open === c ? " open" : ""}" data-i="${c.i}">
    <button type="button" class="sh-check" aria-label="${c.owned ? "Taken out" : "Got it"}: ${esc(c.name)}" aria-pressed="${c.owned}"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i></button>
    <button type="button" class="sh-main" aria-expanded="${show.open === c}"><span class="sh-name">${esc(c.name)}</span><span class="sh-meta">${esc(st.name)} ${c.num}/${st.printed}</span></button>
    ${pay}
    <div class="sh-more">${moreHTML(c)}</div>
  </li>`;
}
function moreHTML(c) {
  const w = isWant(c);
  const line = c.owned ? `Market ${money(c.price)}. In your collection.`
    : `Market ${money(c.price)}.${w ? ` You'd pay up to ${money(maxPay(c))}.` : ""}${c.deal ? ` <b>A copy on eBay for ${money(c.deal)}, ${Math.round((1 - c.deal / c.price) * 100)}% under.</b>` : ""}`;
  const acts = [
    !c.owned ? `<button type="button" class="sh-act primary" data-act="find">${c.deal ? `Buy for ${money(c.deal)}` : "Find a copy"}</button>` : "",
    `<button type="button" class="sh-act" data-act="wall">See it on the wall</button>`,
    !c.owned ? `<button type="button" class="sh-act" data-act="want">${w ? "Drop it" : "Want it"}</button>` : "",
  ].join("");
  return `<p>${line}</p><div class="sh-acts">${acts}</div>`;
}
function renderShow() {
  if (!showOn) return;
  renderHead();
  const q = show.q;
  let list = q ? matchCards(q) : wantList();
  const over = Math.max(0, list.length - LIMIT); if (over) list = list.slice(0, LIMIT);
  const bySet = new Map();
  for (const c of list) { const st = sets[c.si]; if (!bySet.has(st)) bySet.set(st, []); bySet.get(st).push(c); }
  const order = [...bySet.keys()].sort((a, b) => a.released - b.released);
  let html = "";
  if (!list.length) html = `<p class="sh-empty">${q ? "No cards match." : "Nothing to hunt for. Want it on any card puts it here."}</p>`;
  else {
    if (q) html += `<p class="sh-note">${plural(list.length + over, "card")} match${over ? `, showing the first ${LIMIT}` : ""}.</p>`;
    html += order.map((st) => {
      const items = bySet.get(st);
      const sum = items.filter(isWant).reduce((a, c) => a + maxPay(c), 0);
      const side = q ? plural(items.length, "card") : `${plural(items.length, "want")}, ${short(sum)}`;
      return `<section><h2>${esc(st.name)} <small>${st.year}</small><small class="side">${side}</small></h2><ul>${items.map(rowHTML).join("")}</ul></section>`;
    }).join("");
  }
  shWrap.innerHTML = html;
}

// Got it: the row ticks, slides out, and the header updates; Undo brings it back. In search, a got card stays
// ticked where it is (you may be looking at the set), and a ticked card can be unticked (taken out).
function gotIt(c, row) {
  const was = c.owned;
  show.hold = true;
  setOwned(c, !was, { quiet: true });
  const n = wantList().length;
  toast(!was ? `Got it. ${c.name} added.` : `${c.name} taken out. ${plural(n, "want")}.`, () => setOwned(c, was, { quiet: true }));
  row.classList.toggle("have", c.owned);
  row.querySelector(".sh-check").setAttribute("aria-pressed", String(c.owned));
  renderHead();
  const leaves = !was && !show.q;
  if (!leaves || reduced) { show.hold = false; renderShow(); return; }
  row.style.height = `${row.offsetHeight}px`;
  row.classList.add("going");
  setTimeout(() => row.classList.add("gone"), 200);
  setTimeout(() => { show.hold = false; renderShow(); }, 640);
}
function seeOnWall(c) {
  leaveShow();
  const g = groups[c.g];
  finishTransition(); unfocus();
  if (view === "set" && state.g === g) return focus(c);
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  enterGroup(g, { then: () => focus(c) });
}
shList.addEventListener("click", (e) => {
  const row = e.target.closest(".sh-row"); if (!row || row.classList.contains("going")) return;
  const c = cards[Number(row.dataset.i)];
  if (e.target.closest(".sh-check")) return gotIt(c, row);
  if (e.target.closest(".sh-main")) {
    const open = show.open === c ? null : c;
    if (show.open) shWrap.querySelector(".sh-row.open")?.classList.remove("open");
    show.open = open; row.classList.toggle("open", Boolean(open));
    row.querySelector(".sh-main").setAttribute("aria-expanded", String(Boolean(open)));
    if (open) row.querySelector(".sh-more").innerHTML = moreHTML(c);
    tick(4); return;
  }
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "find") { const st = sets[c.si]; window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`pokemon ${c.name} ${c.num}/${st.printed} ${st.name}`)}&_sop=15`, "_blank", "noopener"); }
  else if (act === "wall") seeOnWall(c);
  else if (act === "want") { const on = !isWant(c); show.open = null; setWant(c, on); tick(6); toast(on ? `${c.name} on your list.` : `${c.name} off your list.`); }
});

// Search along the bottom: filters the list as you type, and can find any card, not only wants.
function runShowSearch() {
  show.q = shQ.value.trim().toLowerCase();
  shSearch.classList.toggle("has", Boolean(show.q));
  show.open = null;
  renderShow();
  shList.scrollTop = 0;
}
shQ.addEventListener("input", () => { clearTimeout(shQ.t); shQ.t = setTimeout(runShowSearch, 120); });
shQ.addEventListener("keydown", (e) => { if (e.key === "Enter") { clearTimeout(shQ.t); runShowSearch(); shQ.blur(); } if (e.key === "Escape") { shQ.value = ""; runShowSearch(); shQ.blur(); } });
showEl.querySelector("#sh-clear").onclick = (e) => { e.preventDefault(); shQ.value = ""; runShowSearch(); shQ.focus(); };
// The phone keyboard covers the bottom of the screen: the bar rides up on top of it.
function liftBar() {
  const v = window.visualViewport; if (!v || !showOn) return;
  const covered = Math.max(0, innerHeight - v.height - v.offsetTop);
  shBar.style.transform = covered > 60 ? `translateY(-${covered}px)` : "";
  shList.style.paddingBottom = covered > 60 ? `${covered + 96}px` : "";
}
window.visualViewport?.addEventListener("resize", liftBar);
window.visualViewport?.addEventListener("scroll", liftBar);

function enterShow({ quick = false } = {}) {
  if (showOn) return;
  showOn = true; offered = true; show.q = ""; shQ.value = ""; shSearch.classList.remove("has"); show.open = null;
  hideCaption(); stopTime(); setMenu(false); if (about.open) about.close();
  if (document.activeElement === qIn) qIn.blur();
  toastEl.classList.remove("show"); // the offer, if it's up
  document.body.classList.add("showing");
  showBtn.setAttribute("aria-pressed", "true");
  showEl.hidden = false;
  if (quick || reduced) showEl.classList.add("in"); else requestAnimationFrame(() => requestAnimationFrame(() => showEl.classList.add("in")));
  renderShow(); shList.scrollTop = 0;
  shWall.textContent = document.body.classList.contains("listmode") ? "List" : "Wall";
  try { localStorage.setItem("wall-show", "1"); } catch { /* fine */ }
  setTimeout(() => shH.focus({ preventScroll: true }), quick || reduced ? 0 : 400);
  tick(5);
}
function leaveShow() {
  if (!showOn) return;
  showOn = false; show.hold = false;
  document.body.classList.remove("showing");
  showBtn.setAttribute("aria-pressed", "false");
  showEl.classList.remove("in");
  clearTimeout(leaveShow.t);
  leaveShow.t = setTimeout(() => { if (!showOn) showEl.hidden = true; }, reduced ? 0 : 380);
  try { localStorage.setItem("wall-show", ""); } catch { /* fine */ }
  if (!document.body.classList.contains("listmode")) canvas.focus({ preventScroll: true });
  kick(); tick(4);
}
addEventListener("keydown", (e) => {
  if (!showOn) return;
  if (e.key === "/" && document.activeElement !== shQ) { e.preventDefault(); e.stopImmediatePropagation(); shQ.focus(); }
  if (e.key === "Escape" && document.activeElement !== shQ) leaveShow();
}, true);

// The list view and every other way of marking keep the show list honest: anything that redraws the list redraws this.
function drawList() {
  if (showOn && !show.hold) renderShow();
  if (!document.body.classList.contains("listmode")) return;
  const showRow = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "deals" ? !c.owned && c.deal : true);
  listEl.querySelector("#list-body").innerHTML = groups.map((g) => {
    const items = g.cards.filter(showRow);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}${isWant(c) ? ". A want" : ""}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? "Have it" : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}

// The strip has one more button now, so the placeholder is short on a phone and the count steps aside inside a set.
function updateCount() {
  const n = state.lens === "time" ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 520 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
}

// About gets a line, and the show is offered once with a toast (not gated on the date, for the demo).
const aboutList = about.querySelector("ul");
if (aboutList) { const li = document.createElement("li"); li.innerHTML = `<b>Show</b> (top) turns the wall into your wants as a one-thumb checklist for the ${SHOW.city} show, ${SHOW.dates}. Tick a card when you find it; Wall brings you back.`; aboutList.append(li); }
setTimeout(() => {
  if (showOn || offered) return;
  try { localStorage.setItem("wall-show-offered", "1"); } catch { /* fine */ }
  toast(`${SHOW.city} show, ${SHOW.dates}: your wants as one list.`, () => enterShow());
  const b = toastEl.querySelector("button"); if (b) b.textContent = "Show";
}, 3200);
// Show mode stays on across a reload, the way the list does: at a show you don't want to find it again.
try { if (localStorage.getItem("wall-show") === "1") setTimeout(() => enterShow({ quick: true }), 0); } catch { /* fine */ }
