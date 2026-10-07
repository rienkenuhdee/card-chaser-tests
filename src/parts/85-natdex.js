// ---------- the Complete Dex: one slot for every Pokémon, #1 to #1,025 (after round 19) ----------
// Ryan: "add in a complete dex set too to select for the wall to Chase", and "filter full art etc on the dex settings".
// A chase rule of its own kind ({ kind: "natdex", rarity?, type? }), a panel on the wall like any chase, its binder in
// Dex order. Each slot is one Pokémon:
//   - with cards in the wall's sets, the slot is a twin of one of them: the most valuable print you own, else the
//     cheapest print (the one you'd chase). It counts as owned when you own any print of that Pokémon that passes the
//     filter; marking it marks that card (through c.base, as twins do). Slots are kept per Dex number, so a slot is the
//     same object through every change: when what you own changes, its print is picked again by swapping its
//     prototype (natdexSync, from updateCount), and nothing on the wall has to be laid out again.
//   - without one (or without one that passes the filter), the slot is an empty pocket reading "#387" and "Turtwig",
//     and up close "Not in your sets". It can't be marked; a tap says so. These pockets (c.ph) stay out of everything
//     that expects a real card: search, Time, Value, copies and spares, trades, the chase list, the list's rows,
//     medals' card lists and the wall's count. They do count in the Dex's own total ("312 of 1,025").
// The filter: which prints fill a slot (Any print, Holo and up, Full art) and, optionally, one type. A type narrows the
// slots to the Pokémon with a card of that type in the wall's sets (production's Dex list carries no types, so a typed
// Dex has no pockets for Pokémon the sets don't print). Set in the New chase sheet, and in place on the Dex's binder
// header (the prints as a segment, the type through a small settings sheet); two Dexes with different filters are
// two chases. The label says it: "Complete Dex", "Holo Dex", "Full art Dex", "Fire Dex".
// The chase list: the Dex adds nothing to it. Every missing Pokémon would flood Chase with hundreds; the Need lens on
// the Dex panel already shows what's missing, the ones your sets can fill bright and the rest quieter, and any slot
// can still go on the list by hand (Chase it).
// Trophies: production's Dex medals (Kanto master, 50 and 151 Pokémon) are the Complete Dex's, on its shelf, when it's
// on the wall. Johto to Paldea masters and 500 or 1,000 Pokémon stay out: the wall's ten sets reach 450 Pokémon and
// fill no region but Kanto (Johto tops out at 79 of 100). A filtered Dex earns the custom chase milestones (Halfway,
// Home stretch, Last three, Complete), counted over the Pokémon its sets can fill.

const DEX_INK = "#D9483B";
const DEX_RAR = [[0, "Any print"], [HOLO, "Holo and up"], [FULL, "Full art"]];
const dexPass = (r, c) => (!r.rarity || c.tier >= r.rarity) && (!r.type || c.type === r.type);
const dexHasType = (n, t) => (MD_SPECIES.get(n) || []).some((c) => c.type === t);
const dexPrints = (r, n) => (MD_SPECIES.get(n) || []).filter((c) => dexPass(r, c));
function dexLabel(r) {
  const rar = r.rarity === FULL ? "Full art" : r.rarity === HOLO ? "Holo" : "", typ = r.type ? (TYPE[r.type] || TYPE.C)[0] : "";
  return rar || typ ? `${[rar, typ].filter(Boolean).join(" ")} Dex` : "Complete Dex";
}
// A pocket's facts when no card stands behind it (shared by every Dex; the slot keeps its own place and rule).
const phProtos = new Map();
function phProto(n) {
  let p = phProtos.get(n);
  if (!p) { const [, name, gen] = DEX[n - 1]; p = { id: `dex-${n}`, i: -1, si: 0, n0: n, name, num: `#${n}`, dex: n, gen, rname: "", tier: 0, price: 0, owned: false, got: null, deal: null, own0: false, chase0: false, spare0: false, pop: false, ph: true }; phProtos.set(n, p); }
  return p;
}
// The print a slot shows: the most valuable you own, else the cheapest (the one you'd chase).
function pickRep(prints) {
  let best = null;
  for (const c of prints) if (c.owned && (!best || c.price > best.price)) best = c;
  if (best) return best;
  for (const c of prints) if (!best || c.price < best.price || (c.price === best.price && c.i < best.i)) best = c;
  return best;
}
let natAnim = false; // a filter change in place: a slot that changes hands floods in or out
function setSlot(s, r, rep) {
  const was = s.owned, old = s.base;
  if (old && old !== rep && old.twins?.get(r.id) === s) old.twins.delete(r.id);
  if (rep) {
    if (Object.getPrototypeOf(s) !== rep) Object.setPrototypeOf(s, rep);
    s.base = rep; s.ph = false; (rep.twins ||= new Map()).set(r.id, s);
  } else {
    const p = phProto(s.dexN); if (Object.getPrototypeOf(s) !== p) Object.setPrototypeOf(s, p);
    s.base = undefined; s.ph = true; s.anim = null; // a pocket never animates (nothing would end it)
  }
  if (natAnim && rep && s.owned !== was && !reduced) s.anim = { t0: performance.now(), to: s.owned };
}
const natSlots = new Map(); // rule id -> Map(Dex number -> slot): the same objects through filters, Undo and arrangements
// The Dex's slots in Dex order, every one pointing at the right print (and registered as that print's twin).
function dexSlots(r) {
  let m = natSlots.get(r.id); if (!m) natSlots.set(r.id, (m = new Map()));
  const list = []; let last = 0;
  for (const [n, name, gen] of DEX) {
    if (r.type && !dexHasType(n, r.type)) continue;
    let s = m.get(n);
    if (!s) { s = Object.assign(Object.create(phProto(n)), PER_VIEW, { dexN: n, dexName: name, gen, base: undefined, ph: true }); m.set(n, s); }
    s.rule = r;
    setSlot(s, r, pickRep(dexPrints(r, n)));
    s.reg = gen !== last ? gen : 0; last = gen; // the first pocket of each region wears its name
    list.push(s);
  }
  for (const [n, s] of m) if (r.type && !dexHasType(n, r.type) && s.base?.twins?.get(r.id) === s) s.base.twins.delete(r.id); // slots a type left out
  return list;
}
// Ownership changed somewhere: each slot picks its print again (only when what you own has changed).
let natSig = "";
function natdexSync() {
  if (!chases.some((r) => r.kind === "natdex")) return false;
  let n = 0, h = 0;
  for (const c of cards) if (c.owned) { n++; h = (Math.imul(h, 31) + c.i) | 0; }
  const sig = `${n}|${h}`;
  if (sig === natSig) return false;
  natSig = sig;
  for (const r of chases) {
    if (r.kind !== "natdex") continue;
    const m = natSlots.get(r.id); if (!m) continue;
    for (const s of m.values()) if (!r.type || dexHasType(s.dexN, r.type)) setSlot(s, r, pickRep(dexPrints(r, s.dexN)));
  }
  return true;
}
const dexCount = (list) => { let have = 0, fill = 0; for (const s of list) { if (!s.ph) fill++; if (s.owned) have++; } return { n: list.length, have, fill }; };
// The same counts from the rule alone (the New chase sheet's live count; no slots made).
function dexStats(r) {
  let n = 0, have = 0, fill = 0;
  for (const [num] of DEX) {
    if (r.type && !dexHasType(num, r.type)) continue;
    n++;
    const ps = dexPrints(r, num);
    if (ps.length) fill++;
    if (ps.some((c) => c.owned)) have++;
  }
  return { n, have, fill, absent: n - fill };
}
const dexAddedText = (r) => { const s = dexStats(r), left = s.fill - s.have; return `${r.label} is on your wall, ${s.have} of ${s.n.toLocaleString()}.${left ? ` Show Missing (in Filters) picks out the ${left} more your sets can fill.` : ""}`; };

// ----- its panel (chaseGroup hands a natdex rule here) -----
function natdexGroup(r, i) {
  let g = chaseGroups.get(r.id);
  if (!g) { g = { key: `chase:${r.id}`, chase: r }; chaseGroups.set(r.id, g); }
  const list = dexSlots(r), c0 = dexCount(list);
  g.chase = r; g.natdex = r; g.name = r.label; g.ink = DEX_INK; g.cards = list; g.base = list;
  g.weight = c0.fill + (c0.n - c0.fill) * 0.25; // the empty pockets take a quarter of a card's share of the wall
  g.sub = () => {
    const s = dexCount(list), out = s.n - s.fill;
    if (state.value) return `Your Dex. Yours is worth ${money(worthOf(list))}`;
    if (showNow() === "missing") return `${(s.n - s.have).toLocaleString()} to go${out ? `, ${s.fill - s.have} of them in your sets` : ""}`;
    return `${s.have} of ${s.n.toLocaleString()} Pokémon${out ? `, ${out} not in your sets` : ""}`;
  };
  return g;
}

// ----- its binder's header: which prints count, the type, Remove chase, then each region's count -----
// Laid out in framed pixels like a set's People chase row (1 = the binder framed to the screen).
const DEX_ROW = 24;
function dexLayout(g) {
  const W = frameW(), sw = (W - 4) / 3;
  g.popChips = null; g.seg = null; g.hdrBtn2 = null;
  g.dexSeg = DEX_RAR.map(([v, label], i) => ({ v, label, x: i * (sw + 2), y: 2, w: sw, h: SEG_H }));
  g.dexType = { x: 0, y: 38, w: Math.min(176, W - 130), h: 22 };
  g.hdrBtn = { x: W - 118, y: 38, w: 118, h: 22 }; // Remove chase
  const gens = []; for (const s of g.base) if (s.reg) gens.push(s.reg);
  const cols = 3, cw = W / cols;
  g.dexRegs = gens.map((gen, j) => ({ gen, x: (j % cols) * cw, y: 74 + Math.floor(j / cols) * DEX_ROW, w: cw - 10, h: DEX_ROW - 4 }));
  g.popH = 74 + Math.ceil(gens.length / cols) * DEX_ROW + 4;
  g.dexKey = "";
}
// Each region's count, worked out when what you own changes (not per frame).
function dexRegCounts(g) {
  const key = `${natSig}|${ticksOf(g).key}`;
  if (g.dexKey === key) return g.dexRC;
  const rc = {}; for (const s of g.base) { const x = (rc[s.gen] ||= { n: 0, have: 0 }); x.n++; if (s.owned) x.have++; }
  g.dexKey = key; g.dexRC = rc; return rc;
}
function drawDexRow(g, sx, y0, k, alpha) {
  if (!g.dexSeg) return;
  const r = g.natdex, cur = r.rarity || 0;
  ctx.textBaseline = "alphabetic";
  for (const s of g.dexSeg) {
    const x = sx + s.x * k, y = y0 + s.y * k, w = s.w * k, h = s.h * k, on = s.v === cur;
    rr(x, y, w, h, 7 * k);
    if (on) { ctx.fillStyle = theme.ink; ctx.fill(); } else { ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = Math.max(1, k * 0.8); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
    ctx.fillStyle = on ? theme.bg : theme.muted; font(700, 11 * k); ctx.textAlign = "center"; ctx.fillText(s.label, x + w / 2, y + h * 0.66);
  }
  const b = g.dexType, bx = sx + b.x * k, by = y0 + b.y * k, bw = b.w * k, bh = b.h * k;
  rr(bx, by, bw, bh, 6 * k); ctx.lineWidth = Math.max(1, k);
  if (r.type) { ctx.fillStyle = theme.gold; ctx.globalAlpha = alpha * 0.18; ctx.fill(); ctx.globalAlpha = alpha; ctx.strokeStyle = theme.gold; } else ctx.strokeStyle = theme["slot-line"];
  ctx.stroke();
  ctx.fillStyle = theme.ink; ctx.textAlign = "left"; font(700, 11 * k);
  ctx.fillText(fitText(r.type ? `${(TYPE[r.type] || TYPE.C)[0]} Pokémon only` : "Any type", bw - 30 * k), bx + 10 * k, by + bh * 0.68);
  const cx = bx + bw - 13 * k, cy = by + bh / 2; // a chevron: this opens the Dex's settings
  ctx.beginPath(); ctx.moveTo(cx - 3.5 * k, cy - 1.8 * k); ctx.lineTo(cx, cy + 1.8 * k); ctx.lineTo(cx + 3.5 * k, cy - 1.8 * k); ctx.lineWidth = Math.max(1.2, 1.4 * k); ctx.strokeStyle = theme.muted; ctx.stroke();
  const rc = dexRegCounts(g);
  for (const it of g.dexRegs) {
    const x = sx + it.x * k, y = y0 + it.y * k, w = it.w * k, c = rc[it.gen] || { n: 0, have: 0 }, full = c.n && c.have === c.n;
    ctx.textAlign = "left"; ctx.fillStyle = theme.ink; font(700, 11.5 * k, true); ctx.fillText(GEN_NAMES[it.gen], x, y + 12 * k);
    ctx.textAlign = "right"; ctx.fillStyle = full ? theme.gold : theme.muted; font(600, 10.5 * k); ctx.fillText(`${c.have} of ${c.n}`, x + w, y + 12 * k);
    ctx.fillStyle = theme["slot-line"]; ctx.fillRect(x, y + 16 * k, w, Math.max(1, 2 * k));
    ctx.fillStyle = full ? theme.gold : DEX_INK; ctx.fillRect(x, y + 16 * k, w * (c.n ? c.have / c.n : 0), Math.max(1, 2 * k));
  }
  ctx.textAlign = "left";
}
// What's under a point in the header (framed pixels, py from the bottom of the title block).
function dexHeadAt(g, fx, py) {
  if (!g.dexSeg || py < 0 || py > g.popH) return null;
  for (const s of g.dexSeg) if (fx >= s.x && fx <= s.x + s.w && py >= s.y - 4 && py <= s.y + s.h + 4) return { dex: { rar: s.v } };
  const b = g.dexType; if (fx >= b.x - 4 && fx <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4) return { dex: { type: true } };
  for (const it of g.dexRegs) if (fx >= it.x && fx <= it.x + it.w + 10 && py >= it.y - 2 && py <= it.y + it.h + 2) return { dex: { gen: it.gen } };
  return null;
}
function dexHeadTap(g, d) {
  const r = g.natdex; if (!r) return;
  if (d.rar != null) { setDexFilter(r, { rarity: d.rar, type: r.type }); return; }
  if (d.type) { openSheet({ natdex: true, edit: r, rarity: r.rarity || 0, type: r.type || null }); return; }
  const s = g.cards.find((c) => c.gen === d.gen && c.reg) || g.cards.find((c) => c.gen === d.gen); // a region: the binder scrolls to its first pocket
  if (s) { if (state.focus) unfocus(); const t = { ...cam, y: s.y - (topPad() + 26) / cam.s }; flyTo(t, 460); }
}

// ----- changing the filter in place: the binder (or the wall) takes its new shape -----
function setDexFilter(r, f) {
  const next = { kind: "natdex" }; if (f.rarity) next.rarity = f.rarity; if (f.type) next.type = f.type;
  if (ruleKey(next) === ruleKey(r)) return;
  const other = chases.find((x) => x !== r && ruleKey(x) === ruleKey(next));
  if (other) { tick(3); toast(`${labelOf(next)} is already on your wall.`); return; }
  const was = { rarity: r.rarity || 0, type: r.type || null };
  delete r.rarity; delete r.type; Object.assign(r, next); r.label = labelOf(r);
  persistChases(); tick(6);
  const g = chaseGroups.get(r.id), inside = view === "set" && state.g === g && Boolean(g), now = performance.now();
  natAnim = true;
  if (inside) {
    if (state.focus) unfocus();
    const old = new Set(g.base);
    for (const c of g.base) { c.px = c.x; c.py = c.y; }
    arrange(mode); layoutAll(); clampCam(g);
    for (const c of g.cards) if (!old.has(c)) { c.px = c.x; c.py = c.y; }
    if (!reduced && !state.trans) { for (const c of g.cards) c.delay = Math.min(240, c.k * 0.25); shuffle = { g, t0: now, dur: 640, end: now + 900 }; }
  } else reflow();
  natAnim = false;
  syncDone({ quiet: true }); syncBadge(); refreshChips(); updateCount(); drawList();
  const s = dexCount(chaseGroups.get(r.id)?.base || dexSlots(r));
  toast(`${r.label}: ${s.have} of ${s.n.toLocaleString()} Pokémon.`, () => setDexFilter(r, was));
  kick();
}

// ----- the pockets -----
const phLine = (c) => (c.rule?.rarity === FULL ? "No full art in your sets" : c.rule?.rarity === HOLO ? "No holo in your sets" : "Not in your sets");
// Far out a flat fill, quieter than a pocket you could fill; closer a dashed pocket; readable, its number and name.
function dexPocket(c, sx, sy, w, h, a) {
  if (w < 26) { ctx.globalAlpha = a * 0.45; ctx.fillStyle = theme.slot; ctx.fillRect(sx, sy, w, h); ctx.globalAlpha = 1; return; }
  const r = w * 0.045, d = Math.max(2, w * 0.035);
  ctx.globalAlpha = a * 0.5; rr(sx, sy, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.globalAlpha = a; ctx.setLineDash([d, d]); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke(); ctx.setLineDash([]);
  if (w < 40) { ctx.globalAlpha = 1; return; }
  const pad = w * 0.075, close = w >= 70, tag = c.reg ? clamp(w * 0.11, 8, 13) * 0.9 : 0;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.muted;
  font(700, w * 0.1); ctx.fillText(`#${c.dex}`, sx + pad, sy + pad + w * 0.09 + tag);
  font(700, w * 0.092, true); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - (close ? w * 0.08 : 0));
  if (close) { ctx.globalAlpha = a * 0.85; font(500, w * 0.064); ctx.fillText(fitText(phLine(c), w - pad * 2), sx + pad, sy + h - pad); }
  ctx.globalAlpha = 1;
}
// A region's first pocket: its name on a small tab across the pocket's top edge.
function dexRegionTag(c, sx, sy, w, mult) {
  const g = groups[c.g]; if (!g?.natdex || c.lift) return;
  const fs = clamp(w * 0.11, 8, 13), t = GEN_NAMES[c.reg] || "";
  font(800, fs, true); const tw = textW(t) + fs * 1.1, th = fs * 1.45, x = sx + Math.min(4, w * 0.05), y = sy - th * 0.5;
  ctx.globalAlpha = Math.min(1, mult) * (state.focus && state.focus !== c ? 1 - state.dimAll * 0.72 : 1);
  rr(x, y, tw, th, th / 2); ctx.fillStyle = theme.ink; ctx.fill();
  ctx.fillStyle = theme.bg; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(t, x + fs * 0.55, y + th * 0.72);
  ctx.globalAlpha = 1;
}
function phSay(c) {
  tick(3);
  const what = c.rule?.rarity === FULL ? "full art " : c.rule?.rarity === HOLO ? "holo " : "";
  toast(`No ${what}${c.name} card in your sets, so there's nothing to mark.`);
}

// ----- the New chase sheet: Complete Dex as a choice, and the Dex's own settings -----
function dexSheetSync() {
  const d = draft.natdex, e = Boolean(draft.edit);
  sheetEl.classList.toggle("dexmode", d); sheetEl.classList.toggle("dexedit", e);
  sheetEl.querySelector("#cs-dex").setAttribute("aria-pressed", String(d));
  sheetEl.querySelector("#cs-title").textContent = e ? "Dex settings" : "New chase";
  sheetEl.querySelector("#cs-rar-lbl").textContent = d ? "Which prints fill a slot" : "Rarity";
  sheetEl.querySelector('[data-rar="0"]').textContent = d ? "Any print" : "Any";
  sheetEl.querySelector('[data-rar="4"]').textContent = d ? "Full art" : "Full art only";
  csSave.textContent = e ? "Update the Dex" : "Put it on the wall";
}
function dexSheetCount() {
  const r = draftRule(), s = dexStats(r), left = s.fill - s.have;
  const clash = chases.find((x) => x !== draft.edit && ruleKey(x) === ruleKey(r)), same = draft.edit && ruleKey(draft.edit) === ruleKey(r);
  csN.textContent = left.toLocaleString(); csN.classList.toggle("zero", !left);
  csLine.innerHTML = `<b>${esc(labelOf(r))}.</b> ${s.n.toLocaleString()} Pokémon, you have ${s.have}.${s.absent ? ` ${s.absent.toLocaleString()} aren't in your sets.` : ""}${clash ? " Already on your wall." : ""}`;
  csSave.disabled = !s.n || Boolean(clash) || Boolean(same);
  preview = new Set(cards.filter((c) => c.dex && dexPass(r, c)));
  kick();
}

// ----- trophies: a filtered Dex's milestones, over the Pokémon its sets can fill (called from mdCompute) -----
function mdNatdex(r, mk) {
  if (isFullDex(r)) return; // the Complete Dex carries production's Dex medals instead (68-medals.js)
  const all = dexSlots(r), units = all.filter((s) => !s.ph), total = units.length; if (!total) return;
  const sec = `chase:${ruleKey(r)}`, N = MD_NAMES.custom, whole = total === all.length;
  const base = { chase: r.label, sec, kind: "dex", color: "red", plate: "DEX", open: { chase: r.id } };
  const of = whole ? `the ${r.label}` : `the ${total} Pokémon your sets can fill in the ${r.label}`;
  mk(base, { id: `${sec}:half`, name: N.half, desc: `Own half of ${of}.`, tier: "silver", units, need: Math.ceil(total * 0.5), mile: true });
  mk(base, { id: `${sec}:three-quarters`, name: N.tq, desc: `Own 75% of ${of}.`, tier: "gold", units, need: Math.ceil(total * 0.75), mile: true });
  if (total >= 6) mk(base, { id: `${sec}:last3`, name: N.last3, desc: `Get ${of} down to its final three.`, tier: "gold", units, need: total - 3, mile: true });
  mk(base, { id: `${sec}:complete`, name: N.complete, desc: whole ? `Every Pokémon in the ${r.label}.` : `Every Pokémon your sets can fill in the ${r.label} (${total}).`, tier: "holo", units, need: total, mile: true, complete: whole });
}

// ----- Choose your sets: "Also chase the complete Dex" (the welcome's step 1, and Settings) -----
function welcomeDex(on, only) {
  const had = chases.find(isFullDex);
  if (on && !had) addChase({ kind: "natdex" }, { quiet: !only });
  else if (!on && had) removeChase(had, { quiet: !only });
}

// Debug builds only: the tests' hook sees the Dex.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { dexGroup: { get: () => groups.find((g) => g.natdex) || null }, setDexFilter: { value: setDexFilter }, openSheet: { value: openSheet }, dexStats: { value: dexStats }, DEX: { value: DEX } }); }, 0);
