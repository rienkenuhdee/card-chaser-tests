// ---------- the import's reveal: an "Import complete" summary (round 20, safe) ----------
// The familiar pattern: a photo library's import summary, a bank account's first sync. The collection floods into the
// wall set by set with nothing else on screen; once the last set has landed, one sheet comes up over the dimmed wall
// with a plain headline ("541 cards from TCGplayer") and what it's worth, then a few rows, each a door into the wall:
//   - anything the import finished (its plaque, on the shelf): tap opens its album
//   - the set closest to done ("Fossil, 2 to go"), drawn as its own tiles in small: tap opens it
//   - the trophies the import earned, the rarest few drawn small: tap opens the trophy room
//   - the spares ("68 cards with spares, 27 wanted"): tap opens the trade binder
//   - the Complete Dex, when it's on the wall ("240 of 1,025 Pokémon"): tap opens it
// A row only appears when it has something to say, so there are never more than five. One primary button, See your
// wall, and the sheet never comes back. It stands in for the import's toast and its trophy celebration card; both stay
// for everything else. The import screen also offers the Complete Dex (the same box the hand-picked path has).

const ar = { pending: null, on: false, medals: [], timer: 0, rows: [] };
const listing = () => document.body.classList.contains("listmode");

// ----- the import: the base's, with the toast handed to the summary -----
function finishImport(src) {
  if (!wel.on) return;
  const chaseAll = wChase.checked, dexOn = wDexOn.checked && !chases.some(isFullDex);
  // The Dex goes on first, so its slots flood in with the cards that fill them.
  if (dexOn) addChase({ kind: "natdex" }, { quiet: true });
  const now = performance.now();
  let n = 0, k = 0, d = 0, last = now;
  const got = [];
  for (const c of pool) {
    if (c.owned || !c.own0) { if (chaseAll && !c.owned) { chasing[c.id] = true; k++; } continue; }
    c.owned = true; c.got = seededGot(c); saved[c.id] = { on: true, at: c.got }; got.push(c); if (!c.of) n++;
    if (!c.of) { const x = importCopies(c); if (x > 1) { copies[c.id] = { n: x, got: c.got }; d++; } }
    if (!reduced) { c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true }; if (Number.isFinite(c.anim.t0)) last = Math.max(last, c.anim.t0 + 460); } // a printing outside the drawn wall has no place (NaN): it never draws
  }
  copiesKey++; persist(); persistCopies(); if (chaseAll) persistChase();
  wel.on = false; wel.step = 0; wel.imp = null; wel.key = "";
  try { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-imported", src); } catch { /* fine */ }
  // The lens bar waits under the flood and the sheet: the wall has the screen to itself until See your wall.
  document.body.classList.add("arriving");
  document.body.classList.remove("welcoming"); welEl.classList.remove("on");
  if (marking) { session.clear(); leaveMark(); }
  ar.pending = { src, n, k: chaseAll ? k : 0, d, got, minted: [] };
  ar.medals = [];
  updateCount(); drawList();
  const sync = syncDone({ quiet: true });
  if (sync) ar.pending.minted = sync.minted;
  if (lifted && !sync) liftLayout(true);
  tick(14);
  // Once the last set has landed (and its medals are counted), the summary.
  clearTimeout(ar.timer);
  ar.timer = setTimeout(showSummary, Math.max(reduced ? 450 : 700, last - now + 380));
  kick();
}

// ----- the trophies the import earned go into the summary, not a card of their own -----
function mdAnnounce(got, viaImport) {
  if (ar.pending || (viaImport && ar.on)) { ar.medals.push(...got); mdCause = null; return; }
  const cause = mdCause && performance.now() - mdCause.t < 2000 ? mdCause.c : null; mdCause = null;
  const inSet = view === "set" && state.g && !listing() && !tbl.on && !bnd.on && !wel.on;
  if (!viaImport && got.length <= 4 && inSet) { queueMints(got, cause); return; }
  mdQueue.push(...got); mdQueue.via = viaImport ? "import" : mdQueue.via || ""; mdCelebrateSoon();
}
// Anything else earned while the summary is up waits for it to go.
function mdCelebrateSoon() {
  clearTimeout(mdCelebrateSoon.t);
  if (wel.on || tbl.on || ar.on || ar.pending || document.body.classList.contains("welcoming")) { mdCelebrateSoon.t = setTimeout(mdCelebrateSoon, 1200); return; }
  const list = mdQueue.splice(0), via = mdQueue.via; mdQueue.via = "";
  if (list.length) mdCelebrate(list, via);
}

// ----- the import screen: the Dex box joins Chase every card I'm missing -----
// The box is the hand-picked path's own (step 1); welcomeSync hides it outside that step, so it's shown here once the
// sources are up (welcomeSync is keyed and leaves it alone until the screen changes).
const wDexText = wDex.querySelector("span");
const wDexText0 = wDexText.textContent;
wNext.addEventListener("click", () => {
  if (!wel.on || wel.step !== 0 || wel.imp !== "pick") return;
  wDex.hidden = false; wDexText.textContent = "Also chase the complete Dex";
});
wAlt.addEventListener("click", () => { if (!wel.on) return; if (wel.step === 0) wDex.hidden = true; else wDexText.textContent = wDexText0; });
document.getElementById("w-sets").addEventListener("click", () => { wDexText.textContent = wDexText0; });

// ----- the sheet -----
const arScrim = document.createElement("div"); arScrim.className = "ar-scrim";
const arEl = document.createElement("section");
arEl.className = "arrival"; arEl.id = "arrival"; arEl.setAttribute("role", "dialog"); arEl.setAttribute("aria-modal", "true"); arEl.setAttribute("aria-labelledby", "ar-title"); arEl.inert = true;
document.body.append(arScrim, arEl);

const arPlural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const arEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const arAnd = (list) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

// What the sheet says: worked out once, when it comes up.
function summaryRows(P) {
  const rows = [];
  // Finished by the import: its plaque, on the shelf today.
  const fin = P.minted.filter((g) => finishOf(g));
  if (fin.length) {
    const g = fin[0], names = fin.map(trophyName), sets = fin.filter((x) => x.set).length;
    const noun = sets === fin.length ? "sets" : sets ? "sets and chases" : "chases";
    rows.push({ id: "fin", lead: { kind: "plaque", g },
      title: fin.length === 1 ? `${names[0]} is complete` : fin.length === 2 ? `${names[0]} and ${names[1]} are complete` : `${fin.length} ${noun} complete`,
      sub: fin.length === 1 ? `Every card. On the shelf today, worth ${short(worthOf(g.base))}.` : fin.length === 2 ? "Every card. On the shelf today." : `${fin.length > 3 ? `${names.slice(0, 2).join(", ")} and ${fin.length - 2} more` : arAnd(names)}, on the shelf today.`,
      label: fin.length === 1 ? "Open its album" : `Open the ${names[0]} album`,
      go: () => arOpen(() => groups.find((x) => x === g || (x.done && doneKey(x) === doneKey(g)))) });
  }
  // The set closest to done (sets only: a chase is yours to define).
  const near = groups.filter((g) => g.set && !g.done && g.base?.length).map((g) => { const have = ownedIn(g.base); return { g, have, left: g.base.length - have }; })
    .filter((x) => x.have > 0 && x.left > 0).sort((a, b) => a.left - b.left || b.have / b.g.base.length - a.have / a.g.base.length);
  if (near.length) {
    const a = near[0], b = near[1], id = a.g.set.id;
    rows.push({ id: "near", lead: { kind: "set", g: a.g },
      title: `${a.g.name}, ${a.left} to go`,
      sub: `Closest to done, ${a.have} of ${a.g.base.length}.${b ? ` Then ${b.g.name}, ${b.left} to go.` : ""}`,
      label: `Open ${a.g.name}`,
      go: () => arOpen(() => groups.find((x) => x.set?.id === id) || null) });
  }
  // The trophies it earned: the rarest few drawn small.
  const md = [...new Map(ar.medals.map((t) => [t.id, t])).values()].sort((x, y) => mdScore(y) - mdScore(x) || mdTierIdx(y.tier) - mdTierIdx(x.tier));
  if (md.length) {
    const lucky = md.filter(mdLucky), t0 = lucky[0], names = md.slice(0, 2).map((t) => t.name);
    const shiny = lucky.filter((t) => t.rank === "shiny"), crit = lucky.filter((t) => t.rank === "crit");
    const some = (list) => `${list[0].name}${list.length > 1 ? ` and ${list.length - 1} more` : ""}`;
    const luck = shiny.length ? `${some(shiny)} came up Shiny${crit.length ? `, and ${crit.length} Critical` : ""}.` : crit.length ? `${some(crit)} came up Critical.` : "";
    rows.push({ id: "md", lead: { kind: "medals", list: md.slice(0, 3) },
      title: `${arPlural(md.length, "trophy", "trophies")} earned`,
      sub: luck || `${md.length > 2 ? `${names.join(", ")} and ${md.length - 2} more` : arAnd(names)}.`,
      rank: t0 ? t0.rank : "",
      label: "Open the trophy room",
      go: arToRoom });
  }
  // The spares: the trade binder, most wanted first.
  const tb = tbFresh(), wanted = tbMemo.wanted;
  if (tb.length) {
    // Three from the first page, of different colours where the page has them, so the stack reads as cards.
    const page = tb.slice(0, 9), pick = [];
    for (const c of page) if (pick.length < 3 && !pick.some((x) => typeColor(x) === typeColor(c))) pick.push(c);
    for (const c of page) if (pick.length < 3 && !pick.includes(c)) pick.push(c);
    rows.push({ id: "tb", lead: { kind: "spares", list: pick },
      title: `${arPlural(tb.length, "card")} with spares${wanted ? `, ${wanted} wanted` : ""}`,
      sub: wanted ? "In your trade binder, the wanted ones first." : "In your trade binder.",
      label: "Open the trade binder",
      go: arToBinder });
  }
  // The Dex, when it's on the wall.
  const dx = groups.find((g) => g.natdex), dr = chases.find((r) => r.kind === "natdex");
  if (dx && dr) {
    const s = dexStats(dr), more = Math.max(0, s.fill - s.have);
    rows.push({ id: "dex", lead: { kind: "dex", g: dx },
      title: `${s.have.toLocaleString()} of ${s.n.toLocaleString()} Pokémon`,
      sub: `${dx.name}.${more ? ` Your sets can fill ${more.toLocaleString()} more.` : ""}`,
      label: `Open the ${dx.name}`,
      go: () => arOpen(() => groups.find((g) => g.natdex) || null) });
  }
  return rows.slice(0, 5);
}

function showSummary() {
  const P = ar.pending; if (!P) return;
  // The medals a beat after the count: counted now if they haven't been yet, so the sheet has them.
  if (mdBooted) { clearTimeout(mdTimer); checkMedals(false); }
  ar.pending = null; ar.on = true;
  const worth = P.got.reduce((a, c) => a + c.price * nOf(c), 0);
  ar.rows = summaryRows(P);
  arEl.innerHTML = `<div class="ar-scroll">
      <p class="ar-kick">Import complete</p>
      <h2 id="ar-title">${arPlural(P.n, "card")} from ${arEsc(P.src)}</h2>
      <p class="ar-line">Worth <b>${money(worth)}</b> at today's prices.${P.k ? ` ${P.k.toLocaleString()} more on your chase list.` : ""}</p>
      ${ar.rows.length ? `<ul class="ar-rows">${ar.rows.map((r, i) => `<li style="--i:${i}"><button type="button" class="ar-row" data-ar="${r.id}" aria-label="${arEsc(`${r.title}. ${r.sub} ${r.label}.`)}"><span class="ar-lead ar-${r.lead.kind}" aria-hidden="true"></span><span class="ar-text"><b>${arEsc(r.title)}${r.rank ? ` <i class="rank-tag ${r.rank}">${MD_RANK[r.rank]}</i>` : ""}</b><span>${arEsc(r.sub)}</span></span><svg class="ar-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></li>`).join("")}</ul>` : ""}
    </div>
    <div class="ar-foot"><button type="button" class="mbtn primary" data-ar-close>See your wall</button></div>`;
  ar.rows.forEach((r) => paintLead(arEl.querySelector(`[data-ar="${r.id}"] .ar-lead`), r.lead));
  arEl.inert = false; document.body.classList.add("arrived-sheet");
  tick(10);
  requestAnimationFrame(() => arEl.querySelector("[data-ar-close]")?.focus({ preventScroll: true }));
  kick();
}
function closeSummary(then = null) {
  if (!ar.on) return;
  ar.on = false; arEl.inert = true;
  document.body.classList.remove("arrived-sheet", "arriving");
  tick(4);
  if (then) then(); else if (!listing()) canvas.focus({ preventScroll: true });
  if (mdQueue.length) mdCelebrateSoon();
  kick();
}
arEl.addEventListener("click", (e) => {
  if (e.target.closest("[data-ar-close]")) { closeSummary(); return; }
  const b = e.target.closest("[data-ar]"); if (!b) return;
  const r = ar.rows.find((x) => x.id === b.dataset.ar); if (!r) return;
  closeSummary(r.go);
});
arScrim.addEventListener("click", () => closeSummary());
addEventListener("keydown", (e) => { if (e.key === "Escape" && ar.on) { e.preventDefault(); e.stopImmediatePropagation(); closeSummary(); } }, true);

// ----- the doors: each waits for the wall to be still, steps out of wherever you are, then goes -----
function arWhenStill(fn, tries = 0) {
  if (tries > 60) return;
  if (state.trans || shuffle || fly || room.anim || bnd.anim) { setTimeout(() => arWhenStill(fn, tries + 1), 120); return; }
  fn(tries);
}
function arLeave() {
  if (listing()) setListMode(false);
  closePop(true); if (state.focus) unfocus(); hideCaption();
  if (bnd.on) closeBinder(true);
}
function arOpen(find) {
  if (tbl.on || mode !== "set") return;
  arLeave();
  if (state.lens !== "have" && lifted) setLens("have");
  arWhenStill(function go(tries) {
    const g = find(); if (!g) return;
    if (view === "set") { if (state.g === g) return; exitToMosaic(); arWhenStill(go, tries + 1); return; }
    if (room.on && !inCase(g)) closeRoom(true);
    if (g.m) { const top = topPad(); if (g.m.y - mScroll < top || g.m.y + g.m.h - mScroll > vh - botPad()) mScroll = clamp(g.m.y - top - 10, 0, mMax); }
    enterGroup(g);
  });
}
function arToRoom() {
  if (tbl.on || mode !== "set") return;
  arLeave();
  arWhenStill(function go(tries) {
    if (room.on) { mScroll = 0; kick(); return; }
    if (view === "set") { exitToMosaic(); arWhenStill(go, tries + 1); return; }
    openRoom();
  });
}
function arToBinder() {
  if (listing()) setListMode(false);
  tbOpenFromAnywhere();
}

// ----- the leads: drawn once, from the cards themselves -----
function paintLead(el, L) {
  if (!el) return;
  if (L.kind === "medals") { el.innerHTML = L.list.map((t) => `<span class="ar-medal">${medalSvg(t)}</span>`).join(""); el.classList.add(`n${L.list.length}`); return; }
  if (L.kind === "plaque") {
    const list = L.g.base, n = list.length, steps = Math.min(n, 40), stops = [];
    for (let i = 0; i < steps; i++) { const c = list[Math.floor((i / steps) * n)], a = (i / steps) * 100, b = ((i + 1) / steps) * 100; stops.push(`${typeColor(c)} ${a.toFixed(2)}% ${b.toFixed(2)}%`); }
    el.innerHTML = `<span class="ar-plate"><span class="ar-engr" style="background:linear-gradient(90deg, ${stops.join(", ")})"></span></span>`;
    return;
  }
  if (L.kind === "spares") {
    el.innerHTML = L.list.map((c, i) => `<span class="ar-card" style="--tc:${typeColor(c)};--r:${(i - (L.list.length - 1) / 2) * 9}deg"><span></span></span>`).join("");
    return;
  }
  // A set or the Dex: its tiles in small, yours in their colours, the rest as empty pockets.
  const list = L.g.base || L.g.cards, n = list.length, S = 46, cv = document.createElement("canvas");
  const dp = Math.min(3, devicePixelRatio || 1);
  cv.width = Math.round(S * dp); cv.height = Math.round(S * dp); cv.style.width = cv.style.height = `${S}px`;
  const x = cv.getContext("2d"); x.scale(dp, dp);
  // Card-shaped cells, as many columns as keep them so.
  let cols = Math.max(1, Math.round(Math.sqrt(n * (TH / TW)))), rows = Math.ceil(n / cols);
  const cw = S / cols, ch = Math.min(S / rows, cw * (TH / TW)), gap = n > 300 ? 0 : Math.min(1, cw * 0.18), y0 = (S - ch * rows) / 2;
  list.forEach((c, i) => {
    const cx = (i % cols) * cw, cy = y0 + Math.floor(i / cols) * ch;
    x.fillStyle = c.owned ? typeColor(c) : c.ph ? theme.bg : theme.slot;
    x.fillRect(cx, cy, cw - gap, ch - gap);
  });
  el.append(cv);
}

// Debug builds only: the tests' hook sees the summary.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { summary: { get: () => ({ on: ar.on, pending: Boolean(ar.pending), rows: ar.rows.map((r) => ({ id: r.id, title: r.title, sub: r.sub })), medals: ar.medals.length }) }, showSummary: { value: showSummary }, closeSummary: { value: closeSummary } }); }, 0);
