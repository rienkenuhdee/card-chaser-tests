// ---------- the import's finish: "Import complete" (round 20) ----------
// The familiar pattern: a photo library's import summary, a bank account's first sync. Once the collection has
// arrived (the story reaching today, or the plain flood when the import has no dates), one sheet comes up over the
// dimmed wall with a plain headline ("541 cards from TCGplayer"), what it's worth, and a few rows, each a door:
//   - anything the import finished (its plaque, on the shelf): tap opens its album
//   - the set closest to done ("Fossil, 5 to go"): tap opens it framed on its missing pockets, ringed in gold
//   - the trophies the import earned, the rarest few drawn small: tap opens Trophies
//   - the spares ("68 cards with spares, 27 wanted"): tap opens the trade binder
//   - the Complete Dex, when it's on the wall: tap opens it
// A row only appears when it has something to say. One primary button, See your wall, and the sheet never comes back.
// If a finger took the wall during the story, the sheet doesn't land on top of what you're doing: one line of totals
// says it, with Open for the sheet. It stands in for the import's toast and its trophy celebration card.
// Worth is the wall's own: each card you have, once, at market (what the panels' "Yours is worth" lines add up to).
// Spare copies aren't counted in it; the spares row says how many there are.

const ar = { on: false, P: null, rows: [], timer: 0 };
const revealing = () => Boolean(story || ar.on || ar.timer); // the live feed and the celebration card wait for these
const arListing = () => document.body.classList.contains("listmode");
const arWorth = () => worthOf(cards);
// Saved until the summary has been seen (or offered), so a reload half way through the story still gets it.
const arSave = (P) => { try { if (P) localStorage.setItem("wall-arrival", JSON.stringify({ src: P.src, n: P.n, k: P.k, meds: P.meds.map((m) => m.t.id), fin: P.fin })); else localStorage.removeItem("wall-arrival"); } catch { /* private mode */ } };

// ----- the import's reveal: called by finishImport once everything is marked and saved -----
function reveal(P) {
  // The trophies are earned now, quietly, each dated from the card that completed it (and saved, like the cards).
  P.meds = datedMedals(checkMedals(true));
  P.dated = hasDates(P.got);
  P.fin = groups.filter((g) => (g.set || g.chase) && g.base?.length && !finishOf(g) && g.base.every((c) => c.owned)).map(doneKey);
  try { localStorage.setItem("wall-dated", P.dated ? "1" : ""); } catch { /* fine */ }
  arSave(P);
  document.body.classList.add("arriving"); // the lens bar waits under the story and the sheet
  if (P.dated && !arListing() && view === "mosaic" && mode === "set" && !room.on && !bnd.on) { startStory(P); return; }
  // No dates (or the list, or somewhere else): the plain flood, set by set, straight into the summary.
  const now = performance.now();
  let last = now;
  if (!reduced) for (const c of P.got) { c.anim = { t0: now + 200 + c.g * 140 + c.k * 2.2, to: true }; if (Number.isFinite(c.anim.t0)) last = Math.max(last, c.anim.t0); } // a printing outside the drawn wall has no place: it never draws
  updateCount(); drawList();
  const sync = syncDone({ quiet: true });
  if (lifted && !sync) liftLayout(true);
  tick(14); kick();
  clearTimeout(ar.timer);
  ar.timer = setTimeout(() => { ar.timer = 0; arrived(P, "end"); }, reduced || arListing() ? 300 : Math.max(500, last - now)); // the sheet rises as the last set lands
}
// The collection has arrived: the summary, or (a finger took over) the totals with Open.
function arrived(P, how) {
  if (how !== "touch") { openSummary(P); return; }
  arSave(null);
  document.body.classList.remove("arriving");
  toast(`${stPlural(P.n, "card")} imported, ${money(arWorth())}`, () => openSummary(P), "Open"); // one line, beside Open
  if (mdQueue.length) mdCelebrateSoon();
}

// ----- the sheet -----
const arScrim = document.createElement("div"); arScrim.className = "ar-scrim";
const arEl = document.createElement("section");
arEl.className = "arrival"; arEl.id = "arrival"; arEl.setAttribute("role", "dialog"); arEl.setAttribute("aria-modal", "true"); arEl.setAttribute("aria-labelledby", "ar-title"); arEl.inert = true;
document.body.append(arScrim, arEl);
const arAnd = (list) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

// What the sheet says: worked out once, when it comes up, from the wall as it is.
function summaryRows(P) {
  const rows = [];
  // Finished by the import: its plaque, on the shelf today.
  const fin = (P.fin || []).map((k) => groups.find((g) => (g.set || g.chase) && doneKey(g) === k && finishOf(g))).filter(Boolean);
  if (fin.length) {
    const g = fin[0], names = fin.map(trophyName), n = fin.filter((x) => x.set).length, key = doneKey(g);
    const noun = n === fin.length ? "sets" : n ? "sets and chases" : "chases";
    rows.push({ id: "fin", lead: { kind: "plaque", g },
      title: fin.length === 1 ? `${names[0]} is complete` : fin.length === 2 ? `${names[0]} and ${names[1]} are complete` : `${fin.length} ${noun} complete`,
      sub: fin.length === 1 ? `Every card. On the shelf today, worth ${short(worthOf(g.base))}.` : fin.length === 2 ? "Every card. On the shelf today." : `${fin.length > 3 ? `${names.slice(0, 2).join(", ")} and ${fin.length - 2} more` : arAnd(names)}, on the shelf today.`,
      label: fin.length === 1 ? "Open its album" : `Open the ${names[0]} album`,
      go: () => arOpen(() => groups.find((x) => (x.set || x.chase) && doneKey(x) === key) || null) });
  }
  // The set closest to done (sets only: a chase is yours to define). It opens on its gaps, ringed.
  const near = groups.filter((g) => g.set && !g.done && g.base?.length).map((g) => { const have = ownedIn(g.base); return { g, have, left: g.base.length - have }; })
    .filter((x) => x.have > 0 && x.left > 0).sort((a, b) => a.left - b.left || b.have / b.g.base.length - a.have / a.g.base.length);
  if (near.length) {
    const a = near[0], b = near[1], id = a.g.set.id;
    rows.push({ id: "near", lead: { kind: "set", g: a.g },
      title: `${a.g.name}, ${a.left} to go`,
      sub: `Closest to done, ${a.have} of ${a.g.base.length}.${b ? ` Then ${b.g.name}, ${b.left} to go.` : ""}`,
      label: `Open ${a.g.name} at its gaps`,
      go: () => arOpen(() => groups.find((x) => x.set?.id === id) || null, ringGaps) });
  }
  // The trophies it earned: the rarest few drawn small.
  const L = medalList(), md = [...new Set(P.meds.map((m) => m.t.id))].map((id) => L.byId.get(id)).filter(Boolean).sort((x, y) => mdScore(y) - mdScore(x) || mdTierIdx(y.tier) - mdTierIdx(x.tier));
  if (md.length) {
    const lucky = md.filter(mdLucky), t0 = lucky[0], names = md.slice(0, 2).map((t) => t.name);
    const shiny = lucky.filter((t) => t.rank === "shiny"), crit = lucky.filter((t) => t.rank === "crit");
    const some = (list) => `${list[0].name}${list.length > 1 ? ` and ${list.length - 1} more` : ""}`;
    const luck = shiny.length ? `${some(shiny)} came up Shiny${crit.length ? `, and ${crit.length} Critical` : ""}.` : crit.length ? `${some(crit)} came up Critical.` : "";
    rows.push({ id: "md", lead: { kind: "medals", list: md.slice(0, 3) },
      title: `${stPlural(md.length, "trophy", "trophies")} earned`,
      sub: luck || `${md.length > 2 ? `${names.join(", ")} and ${md.length - 2} more` : arAnd(names)}.`,
      rank: t0 ? t0.rank : "", label: "Open Trophies", go: arToRoom });
  }
  // The spares: the trade binder, most wanted first.
  const tb = tbFresh(), wanted = tbMemo.wanted;
  if (tb.length) {
    // Three from the first page, of different colours where the page has them, so the stack reads as cards.
    const page = tb.slice(0, 9), pick = [];
    for (const c of page) if (pick.length < 3 && !pick.some((x) => typeColor(x) === typeColor(c))) pick.push(c);
    for (const c of page) if (pick.length < 3 && !pick.includes(c)) pick.push(c);
    rows.push({ id: "tb", lead: { kind: "spares", list: pick },
      title: `${stPlural(tb.length, "card")} with spares${wanted ? `, ${wanted} wanted` : ""}`,
      sub: wanted ? "In your trade binder, the wanted ones first." : "In your trade binder.",
      label: "Open the trade binder", go: arToBinder });
  }
  // The Dex, when it's on the wall.
  const dx = groups.find((g) => g.natdex), dr = chases.find((r) => r.kind === "natdex");
  if (dx && dr) {
    const s = dexStats(dr), more = Math.max(0, s.fill - s.have);
    rows.push({ id: "dex", lead: { kind: "dex", g: dx },
      title: `${s.have.toLocaleString()} of ${s.n.toLocaleString()} Pokémon`,
      sub: `${dx.name}.${more ? ` Your sets can fill ${more.toLocaleString()} more.` : ""}`,
      label: `Open the ${dx.name}`, go: () => arOpen(() => groups.find((g) => g.natdex) || null) });
  }
  return rows.slice(0, 5);
}

function openSummary(P) {
  if (ar.on || !P) return;
  clearTimeout(ar.timer); ar.timer = 0;
  arSave(null);
  if (bnd.on || tbl.on) { document.body.classList.remove("arriving"); return; } // somewhere the sheet can't go: the wall keeps it to itself
  ar.on = true; ar.P = P;
  ar.rows = summaryRows(P);
  arEl.innerHTML = `<div class="ar-scroll">
      <p class="ar-kick">Import complete</p>
      <h2 id="ar-title">${stPlural(P.n, "card")} from ${mdEsc(P.src)}</h2>
      <p class="ar-line">Worth <b>${money(arWorth())}</b> at today's prices.${P.k ? ` ${P.k.toLocaleString()} more on your chase list.` : ""}</p>
      ${ar.rows.length ? `<ul class="ar-rows">${ar.rows.map((r, i) => `<li style="--i:${i}"><button type="button" class="ar-row" data-ar="${r.id}" aria-label="${mdEsc(`${r.title}. ${r.sub} ${r.label}.`)}"><span class="ar-lead ar-${r.lead.kind}" aria-hidden="true"></span><span class="ar-text"><b>${mdEsc(r.title)}${r.rank ? ` <i class="rank-tag ${r.rank}">${MD_RANK[r.rank]}</i>` : ""}</b><span>${mdEsc(r.sub)}</span></span><svg class="ar-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></li>`).join("")}</ul>` : ""}
    </div>
    <div class="ar-foot"><button type="button" class="mbtn primary" data-ar-close>See your wall</button></div>`;
  ar.rows.forEach((r) => paintLead(arEl.querySelector(`[data-ar="${r.id}"] .ar-lead`), r.lead));
  arEl.inert = false; document.body.classList.add("arriving", "arrived-sheet");
  tick(10);
  requestAnimationFrame(() => arEl.querySelector("[data-ar-close]")?.focus({ preventScroll: true }));
  kick();
}
function closeSummary(then = null) {
  if (!ar.on) return;
  ar.on = false; arEl.inert = true;
  document.body.classList.remove("arrived-sheet", "arriving");
  tick(4);
  if (then) then(); else if (!arListing()) canvas.focus({ preventScroll: true });
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
  if (arListing()) setListMode(false);
  closePop(true); if (state.focus) unfocus(); hideCaption();
  if (bnd.on) closeBinder(true);
}
function arOpen(find, then = null) {
  if (tbl.on || mode !== "set") return;
  arLeave();
  if (state.lens !== "have" && lifted) setLens("have");
  arWhenStill(function go(tries) {
    const g = find(); if (!g) return;
    if (view === "set") { if (state.g === g) { then?.(g); return; } exitToMosaic(); arWhenStill(go, tries + 1); return; }
    if (room.on && !inCase(g)) closeRoom(true);
    if (g.m) { const top = topPad(); if (g.m.y - mScroll < top || g.m.y + g.m.h - mScroll > vh - botPad()) mScroll = clamp(g.m.y - top - 10, 0, mMax); }
    enterGroup(g, { then: then ? () => then(g) : null });
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
  if (arListing()) setListMode(false);
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
  const cols = Math.max(1, Math.round(Math.sqrt(n * (TH / TW)))), rows = Math.ceil(n / cols); // card-shaped cells
  const cw = S / cols, ch = Math.min(S / rows, cw * (TH / TW)), gap = n > 300 ? 0 : Math.min(1, cw * 0.18), y0 = (S - ch * rows) / 2;
  list.forEach((c, i) => {
    x.fillStyle = c.owned ? typeColor(c) : c.ph ? theme.bg : theme.slot;
    x.fillRect((i % cols) * cw, y0 + Math.floor(i / cols) * ch, cw - gap, ch - gap);
  });
  el.append(cv);
}

// ----- the gaps, ringed: the set framed on its missing pockets, what you have stepped back, gone on the first touch -----
let rings = null; // { g, t0, out }
function gapsCam(g) {
  const f = fitCam(g), miss = g.cards.filter((c) => !c.owned && !c.ph);
  if (!miss.length) return f;
  const s = f.s, y0 = Math.min(...miss.map((c) => c.y)), y1 = Math.max(...miss.map((c) => c.y + TH * c.sz));
  const top = topPad() + 8, bot = vh - botPad() - 8;
  let y = (y1 - y0) * s > bot - top ? y0 - (top + 24) / s : (y0 + y1) / 2 - (top + bot) / 2 / s;
  const lo = -(topPad() + 6) / s, hi = g.h + (botPad() + 20) / s - vh / s;
  y = hi < lo ? lo : clamp(y, lo, hi);
  return { s, x: f.x, y };
}
function ringGaps(g) {
  if (view !== "set" || state.g !== g) return;
  flyTo(gapsCam(g), 760);
  rings = { g, t0: performance.now() + (reduced ? 0 : 300), out: 0 };
  kick();
}
const ringsOut = () => { if (rings && !rings.out) { rings.out = performance.now(); kick(); } };
addEventListener("touchstart", ringsOut, { capture: true, passive: true });
addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") ringsOut(); }, true);
addEventListener("wheel", ringsOut, { capture: true, passive: true });
addEventListener("keydown", (e) => { if (e.key !== "Tab") ringsOut(); }, true);
// Drawn over the binder (frame, after the marks). Nothing per frame once it has faded in: no pulse.
function drawRings(now) {
  const R = rings; if (!R) return false;
  if (view !== "set" || state.g !== R.g) { if (!state.trans) rings = null; return false; }
  if (state.trans || bnd.on || tbl.on) return false;
  const a = reduced ? 1 : clamp((now - R.t0) / 450, 0, 1), o = R.out ? (reduced ? 1 : clamp((now - R.out) / 320, 0, 1)) : 0;
  if (o >= 1) { rings = null; return false; }
  const k = ease(a) * (1 - ease(o));
  if (k > 0) {
    const g = R.g, hy = Math.max(0, (g.y + g.head - cam.y) * cam.s - 6);
    const hole = (r) => { const p = 3, rad = Math.min(10, r.w * 0.09) + p; if (ctx.roundRect) ctx.roundRect(r.x - p, r.y - p, r.w + p * 2, r.h + p * 2, rad); else ctx.rect(r.x - p, r.y - p, r.w + p * 2, r.h + p * 2); };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(0, hy, vw, vh - hy); ctx.clip();
    ctx.beginPath(); ctx.rect(0, hy, vw, vh - hy);
    const rs = [];
    for (const c of g.cards) { if (c.owned || c.ph) continue; const r = binderRect(c, cam); if (r.y > vh || r.y + r.h < 0) continue; rs.push(r); hole(r); }
    ctx.fillStyle = theme.bg; ctx.globalAlpha = 0.62 * k; ctx.fill("evenodd"); // what you have steps back
    ctx.globalAlpha = k; ctx.lineWidth = 2; ctx.strokeStyle = theme.gold;
    ctx.beginPath(); for (const r of rs) hole(r); ctx.stroke(); // the gaps, ringed in gold
    ctx.restore(); ctx.globalAlpha = 1;
  }
  return a < 1 || Boolean(R.out) || Boolean(fly);
}

// A reload during the story: everything is already on the wall, and the summary comes up once it has inked in.
setTimeout(() => {
  let P = null;
  try { P = JSON.parse(localStorage.getItem("wall-arrival") || "null"); } catch { P = null; }
  if (!P || wel.on || story || ar.on) return;
  const L = medalList();
  P.meds = (P.meds || []).map((id) => L.byId.get(id)).filter(Boolean).map((t) => ({ t, at: t.at }));
  document.body.classList.add("arriving");
  ar.timer = setTimeout(() => { ar.timer = 0; openSummary(P); }, reduced ? 300 : 1500);
}, 0);

// Debug builds only: the tests' hook sees the summary and the rings.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { summary: { get: () => ({ on: ar.on, rows: ar.rows.map((r) => ({ id: r.id, title: r.title, sub: r.sub })) }) }, closeSummary: { value: closeSummary }, rings: { get: () => rings && { set: rings.g.name, out: Boolean(rings.out) } }, gaps: { value: (g) => g.cards.filter((c) => !c.owned && !c.ph).map((c) => { const r = binderRect(c, cam); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }) }, arWorth: { value: arWorth }, importDates: { set: (v) => { importDates = v; } } }); }, 0);
