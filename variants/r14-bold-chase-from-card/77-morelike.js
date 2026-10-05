// ---------- chase from a card: "Chase more like this" ----------
// A chase is built from the card you're looking at, not a form. Under Chase it (the card panel, and the Chase pop)
// a row of one-tap rules is made from the card's own facts, each with a live count of the cards you don't have:
// "Every Tangela (6)", "Everything by Mitsuhiro Arita (41)", "Full art in 151 (12)", "Arita's Tangelas (2)",
// "All of 151 (88)". Tap one and it's a saved chase: every matching card you don't own lights as chased, the Chase
// lens flies to its new shape, and a toast confirms with Undo. Two taps are two chases (not an intersection); the
// combination (artist + Pokémon) is its own row. Saved chases live in the top-left chase menu (with counts and
// Remove) and in the list, and persist in wall-chases.
// A card is chased when hand-picked or matched by any saved chase; a hand-picked off wins over a rule. isChase reads
// `chasing[c.id] ?? c.chase0`, so the rules are folded into c.chase0 (recomputed only when a chase changes).
// Popular (a filter by the search box, next to Value and Time): the cards people chase in each set, shared across
// this round's variants: score = tier * 2 + log10(price + 1) * 1.5 + h32(id + "p"); the top max(3, 6%) of a set.

// ----- popular cards: computed once -----
const popScore = (c) => c.tier * 2 + Math.log10(c.price + 1) * 1.5 + h32(c.id + "p");
for (const c of cards) c.pop = false;
for (const st of sets) {
  st.pop = st.cards.slice().sort((a, b) => popScore(b) - popScore(a)).slice(0, Math.max(3, Math.round(0.06 * st.cards.length)));
  for (const c of st.pop) c.pop = true;
}
const byPop = (a, b) => popScore(b) - popScore(a);

// ----- names: the Pokémon behind a card, the plural, the possessive -----
const baseName = (c) => c.name.replace(/\s+(ex|gx|v|vmax|vstar|lv\.x|break|prime|legend)$/i, "").trim();
const speciesByDex = new Map(); // the shortest name printed for a Dex number: "Charizard" for Dark Charizard, Charizard ex, ...
for (const c of cards) { if (!c.dex) continue; const b = baseName(c); const cur = speciesByDex.get(c.dex); if (!cur || b.length < cur.length) speciesByDex.set(c.dex, b); }
const species = (c) => (c.dex ? speciesByDex.get(c.dex) : baseName(c));
const plural = (n) => (/[sxz]$/.test(n) ? n : `${n}s`);
const possessive = (artist) => { const w = artist.split(" "); const n = /^\d/.test(w[0]) ? artist : w[w.length - 1]; return /s$/.test(n) ? `${n}'` : `${n}'s`; };
const setById = (id) => sets.find((s) => s.id === id);
// "Charizard, Blastoise and 4 more"
const listNames = (names, k) => { const rest = names.length - k; if (rest > 0) return `${names.slice(0, k).join(", ")} and ${rest} more`; return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || ""; };

// ----- the rules -----
let rules = [];
try { rules = (JSON.parse(localStorage.getItem("wall-chases-bold") || "[]") || []).filter((r) => r && typeof r === "object"); } catch { rules = []; }
const persistRules = () => { try { localStorage.setItem("wall-chases-bold", JSON.stringify(rules)); } catch { /* private mode */ } };
const mkRule = (kind, f) => ({ kind, set: null, pokemon: null, dex: 0, artist: null, fullArt: false, popular: false, ...f });
const ruleKey = (r) => `${r.set || ""}|${r.pokemon || ""}|${r.dex || 0}|${r.artist || ""}|${r.fullArt ? 1 : 0}|${r.popular ? 1 : 0}`;
const findRule = (r) => rules.find((x) => ruleKey(x) === ruleKey(r)) || null;
function ruleMatch(r, c) {
  if (r.set && sets[c.si].id !== r.set) return false;
  if (r.artist && c.artist !== r.artist) return false;
  if (r.fullArt && c.tier < 3) return false;
  if (r.popular && !c.pop) return false;
  if (r.pokemon) { if (r.dex) { if (c.dex !== r.dex) return false; } else if (c.dex || baseName(c) !== r.pokemon) return false; }
  return true;
}
function ruleLabel(r) {
  const st = r.set ? setById(r.set)?.name || r.set : "";
  if (r.kind === "pokemon") return `Every ${r.pokemon}`;
  if (r.kind === "artist") return `Everything by ${r.artist}`;
  if (r.kind === "fullart") return `Full art in ${st}`;
  if (r.kind === "combo") return `${possessive(r.artist)} ${plural(r.pokemon)}`;
  if (r.kind === "popular") return `Popular in ${st}`;
  if (r.kind === "set") return `All of ${st}`;
  return [r.artist, r.pokemon, r.fullArt ? "full art" : "", st].filter(Boolean).join(", ");
}
const ruleCards = (r) => cards.filter((c) => ruleMatch(r, c));
const ruleLeft = (r) => ruleCards(r).filter((c) => !c.owned);
const countText = (r) => { const left = ruleLeft(r), d = left.filter((c) => c.deal).length; return left.length ? `${left.length} to find${d ? `, ${d} with a live deal` : ""}` : "All found"; };
// Fold the rules into c.chase0; returns the cards that just became chased.
function applyRules() {
  const lit = [];
  for (const c of cards) {
    const was = isChase(c);
    c.chase0 = rules.some((r) => ruleMatch(r, c));
    if (!was && isChase(c)) lit.push(c);
  }
  return lit;
}
applyRules();

// The rules a card suggests, in a fixed order, with how many you'd be chasing.
function rulesFor(c) {
  const st = sets[c.si], sp = c.type === "e" ? "" : species(c), out = [], seen = new Set();
  const add = (kind, f, min = 2) => {
    const r = mkRule(kind, f), all = ruleCards(r), k = all.map((x) => x.i).join(",");
    if (all.length < min || seen.has(k)) return; // nothing beyond this card, or the same cards as a row above
    seen.add(k);
    const n = all.filter((x) => !x.owned).length;
    out.push({ r, n, all: all.length, on: Boolean(findRule(r)), label: ruleLabel(r) });
  };
  if (sp) add("pokemon", { pokemon: sp, dex: c.dex });
  add("artist", { artist: c.artist });
  if (c.tier >= 3) add("fullart", { set: st.id, fullArt: true });
  if (sp) add("combo", { artist: c.artist, pokemon: sp, dex: c.dex });
  if (c.pop) add("popular", { set: st.id, popular: true });
  add("set", { set: st.id }, 1);
  return out.filter((x) => x.n > 0 || x.on);
}

// Frames keep coming while a staggered flash plays out.
function pumpUntil(t) { const f = () => { kick(); if (performance.now() < t) setTimeout(f, 40); }; f(); }
let liftPending = false; // the chase list changed while a card was up close inside a set: the set reshuffles once the card goes back
function chaseChanged(lit) {
  const now = performance.now();
  if (lit.length) { // the cards that just joined the chase flash gold where they sit, a beat apart
    lit.forEach((c, i) => { c.flash = { t0: now + Math.min(700, i * 14), gold: true }; });
    pumpUntil(now + 1900);
  }
  if (lifted) {
    if (view === "set" && state.focus) liftPending = true;
    else { liftLayout(true); if (pop.c) pop.from = mr(pop.c.m); }
  }
  syncBadge(); renderMenu(); refreshChips(); drawList(); kick();
}
function addRule(r, { quiet = false } = {}) {
  if (findRule(r)) return;
  rules.push(r); persistRules();
  const lit = applyRules();
  tick(8); chaseChanged(lit);
  if (quiet) return;
  const left = ruleLeft(r), d = left.filter((c) => c.deal).length;
  toast(`${ruleLabel(r)}: ${left.length} to find${d ? `, ${d} with a live deal` : ""}.`, () => removeRule(r, { quiet: true }));
}
function removeRule(r, { quiet = false } = {}) {
  const i = rules.findIndex((x) => ruleKey(x) === ruleKey(r)); if (i < 0) return;
  const [gone] = rules.splice(i, 1); persistRules();
  applyRules(); tick(5); chaseChanged([]);
  if (!quiet) toast(`${ruleLabel(gone)} removed.`, () => addRule(gone, { quiet: true }));
}
function toggleRule(r) { if (findRule(r)) removeRule(r); else addRule(r); }

// ----- the row of chips, under Chase it on the card panel and in the Chase pop -----
function moreLikeEl(host, before) {
  const el = document.createElement("div"); el.className = "morelike"; el.hidden = true;
  el.innerHTML = `<p class="ml-head">Chase more like this</p><div class="ml-row" role="group" aria-label="Chase more like this"></div>`;
  before ? host.querySelector(before).before(el) : host.append(el);
  el.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b || !el.list) return; toggleRule(el.list[Number(b.dataset.i)].r); });
  return el;
}
const panelMore = moreLikeEl(panel, ".hint"), popMore = moreLikeEl(offersEl, ".o-acts");
function fillChips(el, c) {
  const list = rulesFor(c), row = el.querySelector(".ml-row"), sl = row.scrollLeft;
  el.list = list; el.hidden = !list.length;
  row.innerHTML = list.map((x, i) => `<button type="button" class="chip" aria-pressed="${x.on}" data-i="${i}" aria-label="${esc(x.label)}, ${x.n} to find"><b>${esc(x.label)}</b><span>${x.n}</span></button>`).join("");
  row.scrollLeft = sl;
}
function refreshChips() {
  if (state.focus) fillPanel(state.focus, 0); // the chips, the flag and "Pay up to" all follow the chase
  if (pop.c) { fillChips(popMore, pop.c); oFlag.textContent = isChase(pop.c) ? "Chasing ✓" : "Chase it"; }
}
// The card panel (52-focus), with the chips filled in.
function fillPanel(c, dir) {
  const st = sets[c.si];
  const swap = document.getElementById("swap");
  const put = () => {
    document.getElementById("p-name").textContent = c.name;
    document.getElementById("p-meta").textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. ${c.rname}.${c.owned && c.got ? ` Yours since ${new Date(c.got).toLocaleDateString("en-US", { month: "short", year: "numeric" })}.` : ""}${!c.owned && isChase(c) ? ` Pay up to ${money(capOf(c))}.` : c.owned && isSpare(c) ? " You have a spare." : ""}`;
    document.getElementById("p-price").innerHTML = `${money(c.price)}<small>market</small>`;
    const dl = document.getElementById("p-deal");
    if (!c.owned && c.deal && isChase(c)) { dl.hidden = false; dl.textContent = `A copy on eBay for ${money(c.deal)} right now, ${Math.round((1 - c.deal / c.price) * 100)}% under.`; } else dl.hidden = true;
    const own = document.getElementById("p-own"), buy = document.getElementById("p-buy");
    own.textContent = c.owned ? "In your collection ✓" : "I have it";
    own.className = `act ${c.owned ? "owned" : "primary"}`;
    own.setAttribute("aria-pressed", String(c.owned));
    buy.textContent = c.owned ? "Back to the set" : c.deal && isChase(c) ? `Buy for ${money(c.deal)}` : "Find a copy";
    updateFlag(c);
    fillChips(panelMore, c);
  };
  if (dir && !reduced) { swap.classList.add("out"); setTimeout(() => { put(); swap.classList.remove("out"); }, 140); } else put();
}
// The Chase pop (64-chase), with the chips above Got it.
function fillOffers(c) {
  const st = sets[c.si], list = offersFor(c, oKind);
  oName.textContent = c.name;
  oMeta.textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. Market ${money(c.price)}, you'd pay up to ${money(capOf(c))}.`;
  oSub.textContent = oKind === "single" ? `${list.length} copies online, cheapest first. Swipe through them.` : oKind === "pack" ? `${packOdds(c) > 36 ? "A long shot in a pack" : "A fair pull from a pack"}: ${list[0].odds.toLowerCase()}.` : `Sealed, with the odds of this card inside.`;
  offersEl.querySelectorAll("[data-kind]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === oKind)));
  oRow.innerHTML = list.map((o) => `<article class="offer${o.live ? " live" : ""}"><b>${money(o.price)}</b><span class="osrc">${o.src}${o.live ? ", the live deal" : ""}</span><span class="ocond">${o.title}</span><span class="ocond">${o.cond}${o.ship ? `, ${money(o.ship)} shipping` : ", free shipping"}${o.odds ? `. ${o.odds}` : ""}</span><button type="button" class="mbtn obuy" data-q="${o.q.replace(/"/g, "&quot;")}">Open on ${o.src}</button></article>`).join("");
  oRow.scrollLeft = 0;
  oFlag.textContent = isChase(c) ? "Chasing ✓" : "Chase it";
  fillChips(popMore, c);
}
// Putting a card back (52-focus): a reshuffle that waited for the panel to go runs now.
function unfocus() {
  if (!state.focus) return;
  state.focus = null;
  document.body.classList.remove("focused");
  if (view === "set" && state.g) { const f = fitCam(state.g); if (cam.s > f.s * 2.2) { const s = f.s * 2.2, cx = cam.x + vw / 2 / cam.s, cy = cam.y + vh / 2 / cam.s; flyTo({ s, x: cx - vw / 2 / s, y: cy - vh / 2 / s }, 380); } }
  if (liftPending) { liftPending = false; if (lifted) liftLayout(true); }
  kick();
}

// ----- your chases in the top-left menu -----
const menuSec = document.createElement("div"); menuSec.className = "chases"; menuSec.hidden = true; arrMenu.append(menuSec);
function renderMenu() {
  menuSec.hidden = !rules.length;
  if (!rules.length) { menuSec.innerHTML = ""; return; }
  menuSec.innerHTML = `<p class="ch-head">Your chases</p>` + rules.map((r, i) => `<div class="chrow"><button type="button" role="menuitem" class="chgo" data-ri="${i}"><b>${esc(ruleLabel(r))}</b><small>${countText(r)}</small></button><button type="button" role="menuitem" class="chrm" data-rm="${i}" aria-label="Remove ${esc(ruleLabel(r))}">Remove</button></div>`).join("");
}
menuSec.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm]");
  if (rm) { setMenu(false); removeRule(rules[Number(rm.dataset.rm)]); return; }
  const go = e.target.closest("[data-ri]");
  if (!go) return;
  const r = rules[Number(go.dataset.ri)]; setMenu(false);
  if (state.lens !== "chase") setLens("chase"); // the chase deals out of the wall
  toast(`${ruleLabel(r)}: ${countText(r).toLowerCase()}.`);
});
renderMenu();

// ----- Popular: the cards people chase, as a filter by the search box -----
state.popular = false;
const popBtn = document.createElement("button");
popBtn.type = "button"; popBtn.setAttribute("role", "menuitemcheckbox"); popBtn.dataset.filter = "popular"; popBtn.setAttribute("aria-checked", "false");
popBtn.innerHTML = `<span><b>Popular</b><small>The cards people chase in each set</small></span><span class="tick" aria-hidden="true">✓</span>`;
filterMenu.append(popBtn);
popBtn.onclick = () => { setFilterMenu(false); setPopular(!state.popular); };
function markFilters() {
  filterMenu.querySelector('[data-filter="value"]').setAttribute("aria-checked", String(state.value));
  filterMenu.querySelector('[data-filter="time"]').setAttribute("aria-checked", String(state.time));
  popBtn.setAttribute("aria-checked", String(state.popular));
  filterBtn.setAttribute("aria-pressed", String(state.value || state.time || state.popular));
}
function setPopular(on) {
  state.popular = on; markFilters(); tick(5); hideCaption();
  if (on) { const all = cards.filter((c) => c.pop), left = all.filter((c) => !c.owned).length; toast(`What people chase: ${all.length} cards, ${left} you don't have. Tap a set's names to chase them.`); }
  drawList(); kick();
}
// Popular dims everything but the popular cards, on top of whatever lens is on (40-render).
function emphasis(c) {
  if (c.away) return 0;
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  let e = 1;
  if (state.lens === "need") e = c.owned ? 0.1 : 1;
  else if (state.lens === "chase") e = isChase(c) ? 1 : 0.18;
  else if (state.lens === "trade") e = isSpare(c) ? 1 : 0.18;
  if (state.popular && !c.pop) e = Math.min(e, 0.12);
  return e;
}
// The panel's stat line in Popular: who's popular here, fitted to the panel (the font is set by drawPanel first).
function popStat(g) {
  const list = g.set ? g.set.pop : g.cards.filter((c) => c.pop).sort(byPop);
  if (!list.length) return "";
  const key = `${Math.round(g.m?.w || 0)}|${curFont}`;
  if (g.ps && g.ps.key === key) return g.ps.text;
  // The title keeps at least 42% of the row (measured in its own font, then the stat's font is put back).
  const w = (g.m?.w || 240) - PG * 2 - 20, size = clamp((g.m?.w || 240) * 0.075, 12, 17);
  font(800, size, true); const tw = Math.min(textW(g.name), w * 0.42); font(600, size * 0.82);
  const maxW = Math.max(40, w - tw - 10), names = list.map(baseName);
  let text = `${names.length} popular`;
  const forms = [listNames(names, 3), listNames(names, 2), listNames(names, 1), names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]];
  for (const t of forms) if (textW(t) <= maxW) { text = t; break; }
  g.ps = { key, text }; return text;
}
function panelStat(g) {
  if (picking()) return "  ";
  const n = g.cards.length, owned = ownedNow(g.cards);
  if (state.matches) { const m = g.cards.filter((c) => state.matches.has(c)).length; return m ? `${m} found` : ""; }
  if (state.popular) return popStat(g);
  if (state.lens === "need") return `${n - owned} to go`;
  if (state.lens === "chase") { const d = g.cards.filter(isChase).length; return d ? `${d} to find` : "Nothing to chase"; }
  if (state.lens === "trade") { const d = g.cards.filter(isSpare).length; return d ? `${d} spare${d === 1 ? "" : "s"}` : ""; }
  if (state.value) return short(worthOf(g.cards));
  return `${owned}/${n}`;
}
// Inside a set, the header's line names them too (30-layout: the groups' sub lines are wrapped after every arrange).
function popLine(g) {
  const list = g.set ? g.set.pop : g.cards.filter((c) => c.pop).sort(byPop), left = list.filter((c) => !c.owned).length;
  return list.length ? `People chase ${listNames(list.map(baseName), 3)}. ${left ? `${left} to find` : "All yours"}.` : "Nothing people chase here";
}
function layoutAll() {
  lifted = state.lens === "chase" || state.lens === "trade"; liftKey = lifted ? state.lens : null;
  for (const g of groups) { if (!g.sub0) { g.sub0 = g.sub; g.sub = () => (state.popular ? popLine(g) : g.sub0()); } orderGroup(g); }
  groups.forEach(binderLayout); if (lifted) liftedLayout(); else mosaicLayout();
}
// In Popular, a tap on a set panel's names offers to chase them.
function statAt(sx, sy) {
  if (!state.popular || view !== "mosaic" || mode !== "set") return null;
  const y = sy + mScroll;
  for (const g of groups) { const m = g.m; if (m && g.set && sx >= m.x + m.w * 0.42 && sx <= m.x + m.w && y >= m.y && y <= m.y + PG + 34) return g; }
  return null;
}
function offerPopular(g) {
  const st = g.set, left = st.pop.filter((c) => !c.owned), r = mkRule("popular", { set: st.id, popular: true });
  tick(4);
  if (findRule(r)) return toast(`Already chasing the popular cards in ${st.name}.`, () => removeRule(r), "Remove");
  if (!left.length) return toast(`You have every card people chase in ${st.name}.`);
  toast(`${st.name}: ${listNames(left.map(baseName), 2)}. ${left.length === st.pop.length ? "None are yours yet." : `${left.length} you don't have.`}`, () => addRule(r), "Chase these");
}
// A tap (51-gestures), with the stat's offer in front of opening the set.
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block); // which sets do you collect?
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch); // a trader: how to trade, then the table
    const sg = statAt(sx, sy); if (sg) return offerPopular(sg); // Popular: the names on a panel offer "Chase these"
    if (h?.block && lifted) {
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") { // a spare: the table with whoever wants it
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m)); // a chased card: every offer online
    }
    if (h?.block) enterGroup(h.block);
    return;
  }
  if (!h?.card) return;
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned); // in mark mode a tap toggles the card
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}
// The tile (40-render), with a gold ring on the popular cards while Popular is on.
function drawTile(c, sx, sy, w, h, now, mult = 1) {
  let fp = 0;
  const f = c.flash;
  if (f) { fp = (now - f.t0) / 1100; if (fp >= 1 || fp < 0) { if (fp >= 1) c.flash = null; fp = 0; } }
  if (fp && !reduced) {
    const k = f.drop ? 1 + 0.07 * Math.abs(Math.sin(Math.PI * 2 * fp)) : 1 + 0.12 * Math.sin(Math.PI * Math.min(1, fp * 2));
    sx += (w - w * k) / 2; sy += (h - h * k) / 2; w *= k; h *= k;
  }
  drawTile0(c, sx, sy, w, h, now, mult);
  const ringed = w >= 5 && c.e > 0.5 && !c.lift && ((state.lens === "need" && !c.owned && isChase(c)) || (state.popular && c.pop));
  if (ringed) {
    ctx.globalAlpha = Math.min(1, mult) * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1); ctx.lineWidth = Math.max(1.5, w * 0.07); ctx.strokeStyle = theme.gold;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, w * 0.09); ctx.stroke(); ctx.globalAlpha = 1;
  }
  let tint = 0, col = theme.deal;
  if (fp) { tint = 0.55 * (1 - fp); if (f.gold) col = theme.gold; }
  else { const rp = groups[c.g].ripple; if (rp?.live) { const t = (now - rp.t0 - Math.hypot(c.col - rp.col, c.row - rp.row) * 38) / 300; if (t > 0 && t < 1) { tint = 0.3 * Math.sin(Math.PI * t); if (rp.gold) col = theme.gold; } } }
  if (tint < 0.01 || c.e < 0.05) return;
  const a = Math.min(1, mult) * c.e;
  ctx.fillStyle = col; ctx.globalAlpha = a * tint;
  if (w < 5) ctx.fillRect(sx, sy, Math.max(w, 1), Math.max(h, 1)); else { rr(sx, sy, w, h, Math.min(w * 0.06, 12)); ctx.fill(); }
  if (fp) {
    const e = 4 + 10 * fp; ctx.globalAlpha = a * (1 - fp); ctx.lineWidth = 2; ctx.strokeStyle = col;
    rr(sx - e, sy - e, w + e * 2, h + e * 2, Math.min(w * 0.06, 12) + e); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ----- the list (70-chrome): your chases on top, Popular narrows the rows -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.popular && !c.pop ? false : state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "chase" ? isChase(c) : state.lens === "trade" ? isSpare(c) : true);
  let top = rules.length ? `<section><h2>Your chases</h2><p class="lsub">Built from cards you looked at. Chase shows everything they match.</p><ul>${rules.map((r, i) => `<li class="lwrow"><div class="lrow"><span class="lname">${esc(ruleLabel(r))}</span><span class="lmeta">${countText(r)}</span></div><button type="button" class="pill-btn" data-rm="${i}">Remove</button></li>`).join("")}</ul></section>` : "";
  if (state.lens === "chase") {
    const ws = cards.filter((c) => isChase(c) && (!state.matches || state.matches.has(c)) && (!state.popular || c.pop)).sort((a, b) => a.si - b.si || (b.deal ? 1 : 0) - (a.deal ? 1 : 0) || capOf(b) - capOf(a));
    top += `<section><h2>Your chase list</h2><p class="lsub">${ws.length} to find. Live deals first.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lwrow"><div class="lrow"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${c.deal ? `<b class="ldeal">Live ${money(c.deal)}</b>` : `Pay up to ${money(capOf(c))}`}</span><span class="lstate">Market ${money(c.price)}</span></div><button type="button" class="pill-btn lgot" data-got="${c.i}">Got it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to find yet.</p>`}</section>`;
  }
  if (state.lens === "trade") top += tradeListHTML();
  listEl.querySelector("#list-body").innerHTML = top + groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}${c.pop ? ". People chase this one" : ""}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? (isSpare(c) ? (wantedBy(c).length ? `Spare, ${wantedBy(c).map((t) => t.name).join(" and ")} want${wantedBy(c).length === 1 ? "s" : ""} it` : "Spare") : "Have it") : isChase(c) ? `Chasing, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) removeRule(rules[Number(b.dataset.rm)]); });

// Reset the demo clears the chases too.
document.getElementById("reset").onclick = () => { saved = {}; persist(); try { for (const k of ["wall-chase", "wall-chases-bold", "wall-spares", "wall-paid", "wall-trades", "wall-welcomed", "wall-imported", "wall-sets", "wall-lens", "wall-mode", "wall-value"]) localStorage.removeItem(k); } catch { /* fine */ } location.reload(); };
