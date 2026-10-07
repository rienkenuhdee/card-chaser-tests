// ---------- the Trade room (round 21) ----------
// The only home of the trade binder (its cover here, the binder a level inside, 78-trade-binder.js), the trade
// checker and the table (75-trade.js). A page: the cover with its first page small (tap it and that page grows into
// the binder), then production's trade checker, then the collectors to trade with (tap one for the table).
// The trade checker is production's, on the wall's own cards and prices: add cards (or cash) to You give and You get,
// your spares first on one side and the cards you chase first on the other, or any card by name. Each card has a
// condition (NM, LP, MP, HP, DMG, scaling its market price by about 100%, 90%, 75%, 55% and 35%) and a quantity, and
// any price can be set by hand. The verdict is Fair within 5%, Close within 15% (with how much to add) or Uneven. Below
// it, what the trade does to your sets and chases, and Trade done marks the cards in and out with Undo. The trade is
// kept on this device until you clear it.

const ptCount = document.getElementById("pt-count"), ptCoverN = document.getElementById("pt-cover-n"), ptCoverW = document.getElementById("pt-cover-w"), ptPage = document.getElementById("pt-page"), ptTraders = document.getElementById("pt-traders"), tcEl = document.getElementById("tc");
function renderTrade() {
  if (pgTrade.hidden) return;
  const list = tbList(), n = list.length, pages = tbPageCount(), s = spareCount();
  ptCount.textContent = ""; // the cover says it: how many, how many wanted
  ptCoverN.textContent = n ? `${plural1(n, "card")} on ${plural1(pages, "page")}` : "Empty for now";
  ptCoverW.textContent = n ? (tbMemo.wanted ? `${tbMemo.wanted} wanted` : "Nobody has asked yet") : "+ on a card you have adds a spare";
  ptCoverW.className = n && tbMemo.wanted ? "" : "none";
  ptPage.innerHTML = `<span class="tcb-label"><b>Trade binder</b></span>`; // the binder, closed
  const ts = TRADERS.filter((t) => wantsOf(t).length || offersOf(t).length || threadOf(t).length).sort((a, b) => (activeOf(b) ? 1 : 0) - (activeOf(a) ? 1 : 0) || wantsOf(b).length - wantsOf(a).length || offersOf(b).length - offersOf(a).length);
  ptTraders.innerHTML = ts.length ? ts.map((t) => { const st = chipState(t); return `<li><button type="button" class="trader" data-t="${t.id}"><span class="tav" style="background:${t.ink}" aria-hidden="true">${t.name[0]}</span><span class="tw"><b>${esc(t.name)}</b><small>${esc(t.where)}</small><em class="${st.col === theme.deal ? "deal" : ""}">${esc(st.text)}</em></span><span class="chev" aria-hidden="true">›</span></button></li>`; }).join("")
    : `<li class="rp-note" style="margin:0">Nobody wants your spares yet. On a card you have, + counts a copy; every copy past the first is a spare.</li>`;
  renderChecker();
}
pgTrade.addEventListener("click", (e) => {
  if (e.target.closest("#pt-cover")) { tick(4); openBinder(); return; }
  const t = e.target.closest("[data-t]"); if (t) { tick(4); startTrade(TRADERS.find((x) => x.id === t.dataset.t), null); }
});

// ----- the checker -----
const TC = (() => { try { const v = JSON.parse(localStorage.getItem("wall-checker") || "null"); return v && Array.isArray(v.give) ? v : { give: [], get: [] }; } catch { return { give: [], get: [] }; } })();
const saveChecker = () => { try { localStorage.setItem("wall-checker", JSON.stringify(TC)); } catch { /* private mode */ } };
const tcCard = (i) => (i.cash ? null : poolById.get(i.id) || null);
const tcBase = (i) => (i.cash ? i.base || 0 : tcCard(i)?.price || 0); // market, for a Near Mint copy
const tcPrice = (i) => (i.override != null ? i.override : tcBase(i) * (i.cash ? 1 : condOf(i.cond)?.[2] ?? 1)) * (i.qty || 1);
const tcTotal = (side) => TC[side].reduce((a, i) => a + tcPrice(i), 0);
let tcUid = Date.now() % 1e6;
function tcAdd(side, item) {
  const same = !item.cash && TC[side].find((i) => !i.cash && i.id === item.id && i.cond === "NM" && i.override == null);
  if (same) same.qty += 1; else TC[side].push({ k: ++tcUid, qty: 1, cond: "NM", override: null, ...item });
  saveChecker(); renderChecker();
}
// production's verdict
function tcVerdict(give = tcTotal("give"), get = tcTotal("get"), nGive = TC.give.length, nGet = TC.get.length) {
  if (!nGive && !nGet) return { tone: "idle", head: "Add cards to each side", detail: "" };
  if (!nGive || !nGet) return { tone: "idle", head: `Now add what you'd ${nGive ? "get" : "give"}`, detail: "" };
  if (!give || !get) return { tone: "idle", head: "A card needs a price", detail: "Tap its price to set one." };
  const diff = get - give, base = Math.max(give, get), pct = base ? Math.abs(diff) / base : 0, you = diff > 0, gap = money(Math.abs(diff));
  if (pct <= 0.05) return { tone: "fair", head: "Fair trade", detail: pct === 0 ? "Dead even." : `${gap} apart.` };
  if (pct <= 0.15) return { tone: "close", head: you ? "Close, slightly in your favor" : "Close, slightly in their favor", detail: `${gap} apart. ${you ? `You could add about ${gap}.` : `Ask them to add about ${gap}.`}` };
  return { tone: "uneven", head: you ? "Uneven, in your favor" : "Uneven, in their favor", detail: `${gap} apart. ${you ? `You'd get ${gap} more than you give.` : `Ask them to add about ${gap}.`}` };
}
// What it does to your sets and chases: how many cards closer each gets, and how many it sets back if a card you
// give is your only copy.
function tcImpact() {
  const gets = TC.get.map(tcCard).filter((c) => c && !c.owned), gives = TC.give.filter((i) => tcCard(i)?.owned && nOf(tcCard(i)) <= (i.qty || 1)).map(tcCard);
  const out = [];
  for (const g of [...(setGroups || []), ...chaseGroups.values()]) {
    if (g.natdex || !g.base) continue;
    const has = (c) => g.base.some((x) => rootOf(x) === c);
    const gain = new Set(gets.filter(has)).size, loss = gives.filter((c) => has(c) && !gets.includes(c)).length;
    if (gain || loss) out.push({ name: g.name, gain, loss });
  }
  return out;
}
const tcSub = (c) => `${sets[c.si].name} #${c.num}${c.owned ? (sparesOf(c) ? `, ${plural1(sparesOf(c), "spare")}` : ", your only copy") : isChase(c) ? ", on your chase list" : ""}`;
function tcItemHTML(side, i) {
  const c = tcCard(i), price = tcPrice(i), editing = tcEdit === i.k;
  return `<li class="titem" data-k="${i.k}" data-side="${side}">${c ? cardFaceHTML(c) : '<span class="cash" aria-hidden="true">$</span>'}
    <span class="ti-main"><b>${c ? esc(c.name) : "Cash"}</b>${c ? `<small>${esc(tcSub(c))}</small><span class="ti-ctl"><select data-cond aria-label="Condition">${CONDITIONS.map(([k, name]) => `<option value="${k}"${i.cond === k ? " selected" : ""}>${k}</option>`).join("")}</select><span class="qty"><button type="button" data-qty="-1" aria-label="One fewer">−</button><span>${i.qty}</span><button type="button" data-qty="1" aria-label="One more">+</button></span></span>` : ""}</span>
    <span class="ti-price">${editing ? `<input type="number" inputmode="decimal" min="0" step="0.01" data-price-in value="${(tcPrice(i) / (i.qty || 1)).toFixed(2)}" aria-label="Price${i.qty > 1 ? " each" : ""}">` : `<button type="button" data-price aria-label="${esc(`${money(price)}. Change the price`)}">${tcBase(i) || i.override != null ? money(price) : "No price"}</button>`}<button type="button" class="x" data-rm aria-label="Take ${c ? esc(c.name) : "the cash"} off">×</button></span></li>`;
}
let tcEdit = null; // the item whose price is being typed
function renderChecker() {
  const give = tcTotal("give"), get = tcTotal("get"), v = tcVerdict(give, get), imp = tcImpact(), any = TC.give.length || TC.get.length;
  // Each side: its total once it has something, its cards, and Add. Two empty sides sit side by side, a button each.
  const side = (k, title) => `<section class="tside" data-side="${k}"><div class="tside-head"><b>${title}</b>${TC[k].length ? `<span>${money(tcTotal(k))}</span>` : ""}</div>${TC[k].length ? `<ul class="titems">${TC[k].map((i) => tcItemHTML(k, i)).join("")}</ul>` : ""}<button type="button" class="mbtn tc-add" data-add="${k}" aria-label="${title}: add a card or cash">${any ? "+ Add card or cash" : "+ Add"}</button></section>`;
  tcEl.innerHTML = `${any ? `<div class="verdict ${v.tone}" role="status"><b>${esc(v.head)}</b>${v.detail ? `<span>${esc(v.detail)}</span>` : ""}</div>` : ""}
    <div class="tsides${any ? "" : " two"}">${side("give", "You give")}${side("get", "You get")}</div>
    ${imp.length ? `<div class="impact"><b>What it does to your sets and chases</b><ul>${imp.map((x) => `<li><b>${esc(x.name)}</b>: ${x.gain ? `<span class="up">+${x.gain}</span> closer` : ""}${x.gain && x.loss ? ", " : ""}${x.loss ? `<span class="down">−${x.loss}</span>, your only copy` : ""}</li>`).join("")}</ul></div>` : TC.get.some((i) => tcCard(i)) ? `<p class="rp-note" style="margin:0">None of the cards you'd get are missing from your sets or chases.</p>` : ""}
    ${any ? `<div class="tc-acts"><button type="button" class="mbtn primary" data-done>Trade done</button><button type="button" class="mbtn" data-copy>Copy summary</button><button type="button" class="mbtn" data-clear>Clear</button></div>
    <p class="rp-note" style="margin:0">Prices are Near Mint market. Set a condition, or tap a price to change it.</p>` : ""}`;
  const inp = tcEl.querySelector("[data-price-in]"); if (inp) { inp.focus(); inp.select(); }
}
const tcItemOf = (el) => { const li = el.closest("[data-k]"); if (!li) return []; const side = li.dataset.side, it = TC[side].find((x) => String(x.k) === li.dataset.k); return it ? [side, it] : []; };
tcEl.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]"); if (add) { openTcAdd(add.dataset.add); return; }
  if (e.target.closest("[data-clear]")) { const was = JSON.stringify(TC); TC.give = []; TC.get = []; saveChecker(); renderChecker(); toast("Trade cleared.", () => { Object.assign(TC, JSON.parse(was)); saveChecker(); renderChecker(); }); return; }
  if (e.target.closest("[data-copy]")) { tcCopy(); return; }
  if (e.target.closest("[data-done]")) { tcDone(); return; }
  const [side, it] = tcItemOf(e.target); if (!it) return;
  if (e.target.closest("[data-rm]")) { TC[side] = TC[side].filter((x) => x !== it); saveChecker(); renderChecker(); tick(3); return; }
  const q = e.target.closest("[data-qty]"); if (q) { it.qty = Math.max(0, it.qty + Number(q.dataset.qty)); if (!it.qty) TC[side] = TC[side].filter((x) => x !== it); saveChecker(); renderChecker(); tick(3); return; }
  if (e.target.closest("[data-price]")) { tcEdit = it.k; renderChecker(); }
});
tcEl.addEventListener("change", (e) => { const s = e.target.closest("[data-cond]"); if (!s) return; const [, it] = tcItemOf(s); if (it) { it.cond = s.value; it.override = null; saveChecker(); renderChecker(); } });
function tcPriceDone(inp, keep = true) {
  const [, it] = tcItemOf(inp); tcEdit = null;
  if (it && keep) { const n = Number(String(inp.value).replace(/[$,]/g, "")); if (n >= 0 && inp.value !== "") { if (it.cash) it.base = n; else it.override = n; saveChecker(); } }
  renderChecker();
}
tcEl.addEventListener("keydown", (e) => { const inp = e.target.closest("[data-price-in]"); if (!inp) return; if (e.key === "Enter") { e.preventDefault(); tcPriceDone(inp); } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); tcPriceDone(inp, false); } });
tcEl.addEventListener("focusout", (e) => { const inp = e.target.closest?.("[data-price-in]"); if (inp && tcEdit != null) tcPriceDone(inp); });
function tcCopy() {
  const v = tcVerdict(), line = (i) => { const c = tcCard(i); return `${i.qty > 1 ? `${i.qty}x ` : ""}${c ? `${c.name} (${sets[c.si].name} #${c.num}) ${i.cond}` : "Cash"} ${money(tcPrice(i))}`; };
  const text = `Trade\nI give: ${TC.give.map(line).join("; ") || "nothing"} = ${money(tcTotal("give"))}\nI get: ${TC.get.map(line).join("; ") || "nothing"} = ${money(tcTotal("get"))}\n${v.head}. ${v.detail}`;
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => toast("Summary copied."), () => toast("Couldn't copy here."));
}
// Trade done: the cards you get are yours (or one more copy), the ones you give leave (a copy, or the card), with Undo.
function tcDone() {
  const gets = TC.get.filter((i) => tcCard(i)), gives = TC.give.filter((i) => tcCard(i)?.owned);
  if (!gets.length && !gives.length) { toast("None of these are cards on your wall. Cleared."); TC.give = []; TC.get = []; saveChecker(); renderChecker(); return; }
  const touched = [...new Set([...gets, ...gives].map(tcCard))], was = touched.map((c) => ({ c, owned: c.owned, got: c.got, rec: copies[c.id] ? { ...copies[c.id] } : null })), keep = JSON.stringify(TC);
  quietLayout = true;
  let nin = 0, nout = 0;
  for (const i of gets) { const c = tcCard(i), q = i.qty || 1; if (c.owned) setN(c, nOf(c) + q); else { setOwned(c, true, { quiet: true }); if (q > 1) setN(c, q); } nin += q; }
  for (const i of gives) { const c = tcCard(i), q = i.qty || 1, n = nOf(c); if (n > q) setN(c, n - q); else setOwned(c, false, { quiet: true }); nout += q; }
  quietLayout = false;
  copiesKey++; persistCopies(); TC.give = []; TC.get = []; saveChecker(); tbChanged(); renderTrade(); tick(14);
  toast(`Collection updated: ${plural1(nin, "card")} in, ${nout} out.`, () => {
    quietLayout = true;
    for (const w of was) { const c = w.c; if (c.owned !== w.owned) setOwned(c, w.owned, { quiet: true }); if (w.owned) { c.got = w.got; saved[c.id] = { on: true, at: w.got }; } if (w.rec) copies[c.id] = w.rec; else delete copies[c.id]; }
    quietLayout = false;
    copiesKey++; persist(); persistCopies(); Object.assign(TC, JSON.parse(keep)); saveChecker(); tbChanged(); renderTrade(); tick(6);
  });
}

// ----- adding a card or cash: your spares first (You give), the cards you chase first (You get), or any by name -----
const tcAddEl = document.getElementById("tc-add"), tcaQ = document.getElementById("tca-q"), tcaList = document.getElementById("tca-list"), tcaHint = document.getElementById("tca-hint");
let tcaSide = "give", tcaFound = [];
function openTcAdd(side) {
  tcaSide = side; tcaQ.value = "";
  document.getElementById("tca-h").textContent = side === "give" ? "Add a card you'd give" : "Add a card you'd get";
  drawTcAdd(); tcAddEl.showModal(); tick(4);
}
function drawTcAdd() {
  const q = tcaQ.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean), give = tcaSide === "give";
  const first = give ? (c) => (sparesOf(c) ? 2 : c.owned ? 1 : 0) : (c) => (isChase(c) ? 2 : !c.owned ? 1 : 0);
  if (!words.length) {
    tcaFound = (give ? tbList() : cards.filter(isChase).sort((a, b) => b.price - a.price)).slice(0, 12);
    tcaHint.textContent = tcaFound.length ? (give ? "Your spares, the most wanted first. Or type a card's name." : "Cards you chase, the dearest first. Or type a card's name.") : "Type a card's name, its set or its number.";
  } else {
    tcaFound = cards.filter((c) => matchQ(c, words)).sort((a, b) => first(b) - first(a) || b.price - a.price).slice(0, 30);
    tcaHint.textContent = tcaFound.length ? (give ? "Cards you have first." : "Cards you chase first.") : "Nothing matches. Try the set or the number.";
  }
  tcaList.innerHTML = tcaFound.map((c, n) => `<li><button type="button" class="tca-row" data-n="${n}">${cardFaceHTML(c)}<span><b>${esc(c.name)}</b><small>${esc(tcSub(c))}</small></span><em>${money(c.price)}</em></button></li>`).join("");
}
tcaQ.addEventListener("input", drawTcAdd);
tcaList.addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (!b) return; const c = tcaFound[Number(b.dataset.n)]; tcAdd(tcaSide, { id: c.id }); toast(`Added ${c.name}.`); tick(4); });
document.getElementById("tca-cash").onclick = () => { const inp = document.getElementById("tca-amt"), n = Number(inp.value); if (!(n > 0)) { toast("Enter an amount."); return; } tcAdd(tcaSide, { cash: true, base: n }); inp.value = ""; toast(`Added ${money(n)} cash.`); };
tcAddEl.addEventListener("click", (e) => { if (e.target === tcAddEl || e.target.closest("[data-tca-close]")) tcAddEl.close(); });

// Debug builds only: the tests' hook sees the checker.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { TC: { get: () => TC }, tcAdd: { value: tcAdd }, tcVerdict: { value: () => tcVerdict() }, tcTotal: { value: tcTotal }, renderChecker: { value: renderChecker } }); }, 0);
