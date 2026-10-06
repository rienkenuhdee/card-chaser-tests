// ---------- the trophy case (round 16, safe): a proper cabinet ----------
// The case at the end of the wall becomes the familiar shelf-in-a-cabinet. Its label is a header row: how many
// trophies, what they're worth together, and a sort (Newest, Most valuable, A to Z, kept in wall-trophy-sort). Every
// plaque in the case gets a second line saying what it is in plain words ("The set, 102 cards", "Every printing,
// 306 cards", "6 cards across 4 sets"). A set's family stacks under one head: the set, then its master set and grand
// set, then the chases inside it, the kids inset so the family reads as one. A set has one binder, so only the view
// you're in is a group on the wall; the other views' trophies are "ghost" plaques drawn from the done record and the
// set's cards, and tapping one switches the set to that view and opens the album. The sealed album keeps the Set /
// Master set / Grand set switch (so a master set can be finished after the set) and gains Share, which draws a
// trophy card to a PNG and hands it to the share sheet, or saves it. The list mirrors the sort and the families.
// Sort, totals and families are computed in layout (when done changes, never per frame) and cached in caseInfo.
const CASE_HEAD = 44, CASE_PLQ = 86, KID_INSET = 12, KID_TUCK = 6;
const SORTS = [["new", "Newest", "Newest"], ["worth", "Most valuable", "Worth"], ["az", "A to Z", "A to Z"]];
const SCOPE_ORDER = { set: 0, master: 1, grand: 2 };
let caseSort = "new";
try { const s = localStorage.getItem("wall-trophy-sort"); if (SORTS.some(([k]) => k === s)) caseSort = s; } catch { /* default */ }
let caseInfo = null, caseGhosts = [];
const ghostCache = new Map();

// ----- what a trophy is, whichever kind -----
const scopeKey = (t) => (t.ghost ? t.scope : t.set ? scopeOf(t.set) : "set");
const finOf = (t) => (t.ghost ? done[t.key] || null : finishOf(t));
const nameOf = (t) => (t.ghost ? `${t.set.name}${t.scope === "master" ? " master set" : t.scope === "grand" ? " grand set" : ""}` : trophyName(t));
const tid = (t) => (t.ghost ? t.key : doneKey(t)); // one id per trophy, the ghosts included
const cardsN = (n) => `${n} card${n === 1 ? "" : "s"}`;
function whatIs(t) {
  const n = t.base.length;
  if (t.set) { const s = scopeKey(t); return `${s === "set" ? "The set" : s === "master" ? "Every printing" : "Every printing and reprint"}, ${cardsN(n)}`; }
  const si = new Set(t.base.map((c) => c.si));
  return si.size === 1 ? `${cardsN(n)} in ${sets[[...si][0]].name}` : `${cardsN(n)} across ${si.size} sets`;
}
function caseInfoOf(t) {
  const f = finOf(t), at = f?.at || Date.now(), worth = worthOf(t.base);
  return { title: nameOf(t), what: whatIs(t), line: `Finished ${dayOf(at)} · ${short(worth)}`, worth, at };
}
// What a few trophies are worth together: a card counts once (a chase's twins are the same card; a printing is its own).
function unionWorth(list) {
  const seen = new Set(); let w = 0;
  for (const t of list) for (const c of t.base) { const r = c.base || c; if (seen.has(r)) continue; seen.add(r); if (r.owned) w += r.price; }
  return w;
}

// ----- ghosts: a set's trophies in the views you aren't in -----
const scopeCards = (st, s) => (s === "set" ? st.cards : [...st.cards, ...st.master, ...(s === "grand" ? st.grand : [])]);
function ghostTrophies() {
  if (mode !== "set") return [];
  const out = [];
  for (const g of setGroups || []) {
    const st = g.set, cur = scopeOf(st);
    for (const s of ["set", "master", "grand"]) {
      if (s === cur) continue;
      const key = `${st.id}|${s}`, e = done[key];
      if (!e?.put) continue;
      const list = scopeCards(st, s);
      if (!list.length || ownedIn(list) !== list.length) { delete done[key]; persistDone(); continue; } // a card left while you were in another view
      let gh = ghostCache.get(key);
      if (!gh) { gh = { ghost: true, key, set: st, scope: s, ink: st.ink, done: true }; ghostCache.set(key, gh); }
      gh.name = nameOf(gh); gh.base = gh.cards = list;
      out.push(gh);
    }
  }
  return out;
}
// Tapping a ghost: the set switches to that view (it's finished there, so the album is sealed) and opens.
function openGhost(gh) {
  const st = gh.set;
  scopes[st.id] = gh.scope; try { localStorage.setItem("wall-scope", JSON.stringify(scopes)); } catch { /* fine */ }
  arrange(mode); layoutAll(); updateCount(); drawList();
  const g = (setGroups || []).find((x) => x.set === st);
  if (g?.done) enterGroup(g); else kick();
}

// ----- families and sort -----
function trophyCmp() {
  if (caseSort === "worth") return (a, b) => b.worth - a.worth || b.at - a.at;
  if (caseSort === "az") return (a, b) => a.name.localeCompare(b.name) || b.at - a.at;
  return (a, b) => b.at - a.at;
}
function caseFamilies(list) {
  const cmp = trophyCmp(), byId = (t) => ({ at: t.ci.at, worth: t.ci.worth, name: t.ci.title, t });
  const bySet = new Map(), loose = [];
  for (const t of list) if (t.set) { const a = bySet.get(t.set.id) || []; a.push(t); bySet.set(t.set.id, a); }
  for (const t of list) { if (t.set) continue; const sid = t.chase?.set; if (sid && bySet.has(sid)) bySet.get(sid).push(t); else loose.push(t); }
  const fam = (head, kids) => { const all = [head, ...kids]; return { head, kids, all, at: Math.max(...all.map((t) => t.ci.at)), worth: unionWorth(all), name: head.ci.title }; };
  const fams = [];
  for (const members of bySet.values()) {
    const scoped = members.filter((t) => t.set).sort((a, b) => SCOPE_ORDER[scopeKey(a)] - SCOPE_ORDER[scopeKey(b)]);
    const kids = [...scoped.slice(1), ...members.filter((t) => !t.set).map(byId).sort(cmp).map((x) => x.t)];
    fams.push(fam(scoped[0], kids));
  }
  for (const t of loose) fams.push(fam(t, []));
  return fams.sort(cmp);
}
function allTrophies() { return [...groups.filter((g) => g.done), ...ghostTrophies()]; }

// ----- layout: the header row, then shelves of plaques, families stacked -----
function caseLayout(R, y) {
  for (const g of groups) g.board = null;
  caseGhosts = ghostTrophies();
  const all = [...groups.filter((g) => g.done && !onShelf(g)), ...caseGhosts];
  if (!all.length) { trophyCase = null; caseInfo = null; return 0; }
  for (const t of all) t.ci = caseInfoOf(t);
  const fams = caseFamilies(all), cols = Math.min(fams.length, R.w >= 700 ? 4 : 2);
  const place = (t, m) => { t.m = m; if (!t.ghost) { packPlaque(t); t.plq = plaqueInfo(t); } };
  // Columns fill in sorted order, each family going into the shortest column, so a tall family leaves no hole beside it.
  const top = y + CASE_HEAD, cw = R.w / cols, colH = new Array(cols).fill(0);
  for (const f of fams) {
    let j = 0; for (let c = 1; c < cols; c++) if (colH[c] < colH[j] - 0.5) j = c;
    const x = R.x + j * cw;
    let ky = top + colH[j];
    place(f.head, { x, y: ky, w: cw, h: CASE_PLQ }); ky += CASE_PLQ;
    f.head.board = f.kids.length ? false : null;
    f.kids.forEach((k, idx) => { ky -= KID_TUCK; place(k, { x: x + KID_INSET, y: ky, w: cw - KID_INSET * 2, h: CASE_PLQ }); ky += CASE_PLQ; k.board = idx === f.kids.length - 1 ? { x, w: cw } : false; });
    colH[j] = ky - top;
  }
  const yy = top + Math.max(...colH);
  const count = all.length, total = unionWorth(all);
  trophyCase = { x: R.x, y, w: R.w, h: CASE_HEAD };
  caseInfo = { fams, all, count, total, seg: sortSeg(R, y, `Trophies · ${count} · ${short(total)}`) };
  return yy - y + 4;
}
// The sort control, right of the header: long labels when they fit beside the count, short ones when they don't.
function sortSeg(R, y, title) {
  const build = (long) => { let w = 0; const items = SORTS.map(([key, l, s]) => { const label = long ? l : s, tw = Math.round(textW(label)) + 18; w += tw + 2; return { key, label, w: tw }; }); return { items, w: w - 2 }; };
  font(700, 10.5); let s = build(true);
  font(800, 13, true); const tw = textW(title);
  if (tw + s.w + 36 > R.w) { font(700, 10.5); s = build(false); }
  let x = R.x + R.w - PG - 10 - s.w;
  for (const it of s.items) { it.x = x; it.y = y + 10; it.h = 24; x += it.w + 2; }
  return s.items;
}
const caseSortAt = (sx, sy) => { if (!caseInfo || view !== "mosaic") return null; const y = sy + mScroll; return caseInfo.seg.find((s) => sx >= s.x - 4 && sx <= s.x + s.w + 4 && y >= s.y - 8 && y <= s.y + s.h + 8) || null; };
const ghostAt = (sx, sy) => { if (view !== "mosaic") return null; const y = sy + mScroll; return caseGhosts.find((g) => g.m && sx >= g.m.x && sx <= g.m.x + g.m.w && y >= g.m.y && y <= g.m.y + g.m.h) || null; };
function setCaseSort(key) {
  if (key === caseSort) return;
  caseSort = key; try { localStorage.setItem("wall-trophy-sort", key); } catch { /* fine */ }
  tick(4);
  if (view === "mosaic" && !state.trans && !reduced && !gesture && mode === "set") shelfMorph(); else { layoutAll(); kick(); }
  drawList();
}
document.getElementById("reset").onclick = ((prev) => () => { try { localStorage.removeItem("wall-trophy-sort"); } catch { /* fine */ } prev(); })(document.getElementById("reset").onclick);

// ----- drawing: the header row, the plaques (three lines in the case), the ghosts -----
function drawCaseLabel(alpha) {
  const t = trophyCase, ci = caseInfo; if (!t || !ci) return;
  const m = mr(t); if (m.y > vh || m.y + m.h < 0) return;
  ctx.globalAlpha = alpha; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const x = m.x + PG + 10, by = m.y + 27, segX = ci.seg[0].x;
  ctx.fillStyle = theme.ink; font(800, 13, true); ctx.fillText("Trophies", x, by); const hw = textW("Trophies");
  ctx.fillStyle = theme.muted; font(600, 12.5); ctx.fillText(fitText(` · ${ci.count} · ${short(ci.total)}`, segX - 8 - x - hw), x + hw, by);
  for (const s of ci.seg) {
    const on = s.key === caseSort, y = s.y - mScroll;
    rr(s.x, y, s.w, s.h, 7);
    if (on) { ctx.fillStyle = theme.ink; ctx.fill(); } else { ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
    ctx.fillStyle = on ? theme.bg : theme.muted; font(700, 10.5); ctx.textAlign = "center"; ctx.fillText(s.label, s.x + s.w / 2, y + s.h * 0.66);
  }
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
}
function drawPlaque(g, m, now, alpha, labelAlpha) {
  const p = plateOf(m);
  ctx.globalAlpha = alpha;
  if (!g.minting && !g.unmint && g.board !== false) { const b = g.board || m; ctx.fillStyle = theme["slot-line"]; rr(b.x, p.y + p.h + 2, b.w, 3, 1.5); ctx.fill(); } // the shelf it stands on
  rr(p.x, p.y, p.w, p.h, 8); ctx.fillStyle = theme.plaque; ctx.fill();
  ctx.save(); rr(p.x, p.y, p.w, p.h, 8); ctx.clip();
  ctx.fillStyle = theme["plaque-hi"]; ctx.fillRect(p.x, p.y, p.w, 1.5);
  ctx.fillStyle = theme["plaque-lo"]; ctx.fillRect(p.x, p.y + p.h - 1.5, p.w, 1.5);
  if (g.gleam) { // a gleam crosses the plaque as it lands
    const t = (now - g.gleam) / 1200;
    if (t >= 1) g.gleam = 0;
    else {
      const fx = p.x - p.w + t * p.w * 3, gr = ctx.createLinearGradient(fx, p.y, fx + p.w * 0.6, p.y + p.h);
      gr.addColorStop(0, "rgb(255 255 255 / 0)"); gr.addColorStop(0.5, "rgb(255 250 225 / .6)"); gr.addColorStop(1, "rgb(255 255 255 / 0)");
      ctx.fillStyle = gr; ctx.fillRect(p.x, p.y, p.w, p.h); kick();
    }
  }
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["plaque-lo"]; rr(p.x + 4.5, p.y + 4.5, p.w - 9, p.h - 9, 5); ctx.stroke();
  if (state.press?.g === g) { ctx.lineWidth = 1.5; ctx.strokeStyle = theme.ink; rr(p.x, p.y, p.w, p.h, 8); ctx.stroke(); }
  if (labelAlpha < 0.01 || p.w < 60 || p.h < 40) { ctx.globalAlpha = 1; return; }
  const x = p.x + 10, w = p.w - 20, tall = p.h >= 70; // the case's plaques carry three lines; the shelf's two
  const info = tall ? g.ci || (g.ci = caseInfoOf(g)) : g.plq || (g.plq = plaqueInfo(g));
  ctx.globalAlpha = alpha * labelAlpha;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme["plaque-ink"];
  font(800, 15, true); ctx.fillText(fitText(info.title, w), x, p.y + 21);
  font(600, 11);
  if (tall) { ctx.globalAlpha = alpha * labelAlpha * 0.88; ctx.fillText(fitText(info.what, w), x, p.y + 35); ctx.globalAlpha = alpha * labelAlpha * 0.7; ctx.fillText(fitText(info.line, w), x, p.y + 48); }
  else { ctx.globalAlpha = alpha * labelAlpha * 0.78; ctx.fillText(fitText(info.line, w), x, p.y + 36); }
  ctx.globalAlpha = alpha * labelAlpha;
  const n = g.base.length, sw = Math.min(w, n * ENGR_H * TW / TH), ey = p.y + p.h - 18;
  ctx.fillStyle = "rgb(0 0 0 / .22)"; ctx.fillRect(x - 1, ey - 1, sw + 2, ENGR_H + 2);
  ctx.drawImage(engravingOf(g, w, ENGR_H), x, ey, w, ENGR_H);
  ctx.globalAlpha = 1;
}
function drawMosaic(now, alpha = 1, except = null) {
  const pick = picking() && wel.picks.size > 0;
  let settling = false;
  for (const g of groups) {
    const t = pick && g.set && !wel.picks.has(g.set.id) ? 0.42 : 1;
    g.pe ??= 1;
    if (Math.abs(g.pe - t) > 0.01) { g.pe += (t - g.pe) * (reduced ? 1 : 0.16); settling = true; } else g.pe = t;
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    const a = alpha * g.pe;
    drawPanel(g, now, a);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, a);
  }
  if (!except && !state.trans) {
    drawNewPanel(now, alpha);
    for (const gh of caseGhosts) { const m = mr(gh.m); if (m.y > vh || m.y + m.h < 0) continue; drawPlaque(gh, m, now, alpha, 1); }
    drawCaseLabel(alpha);
  }
  if (settling) kick();
}

// ----- the sealed album: the view switch stays, and Share joins Back to the wall -----
function albumHeader(g) {
  const f = finishOf(g); if (!f) return;
  const W = vw - 24, back = { x: W - 128, y: 2, w: 128, h: 22, shelf: true };
  if (f.put) {
    g.seg = g.set && (g.set.master.length || g.set.grand.length) ? SCOPES.map(([key, label], i) => ({ key, label, x: i * (SEG_W + 2), y: 2, w: SEG_W, h: SEG_H })) : null;
    const top = g.seg ? 34 : 0;
    g.popChips = []; g.popMore = 0; g.popTop = top; // the row draws (the switch, the buttons) with nothing to chase
    g.hdrBtn = { ...back, y: top + 2 };
    g.hdrBtn2 = onShelf(g) ? { x: W - 128 - 8 - 112, y: top + 2, w: 112, h: 22, away: true } : { x: W - 128 - 8 - 72, y: top + 2, w: 72, h: 22, share: true }; // its first day: skip the wait; after that, Share
    g.popH = top + 30;
  } else if (g.set) g.hdrBtn = { ...back, y: 4 };
  else g.hdrBtn2 = { ...back, x: W - 118 - 8 - 128 };
}
function drawHdrBtn(g, b, sx, by, k, alpha) {
  const on = b.shelf || b.away || (b.pop && Boolean(popularRule(g.set))), bx = sx + b.x * k, bw = b.w * k, bh = b.h * k;
  rr(bx, by, bw, bh, 6 * k);
  if (on) { ctx.fillStyle = theme.gold; ctx.globalAlpha = alpha * 0.18; ctx.fill(); ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme.gold; ctx.stroke(); }
  else if (b.pop || b.share) { ctx.fillStyle = theme.ink; ctx.fill(); }
  else { ctx.lineWidth = Math.max(1, k); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
  ctx.fillStyle = on || !(b.pop || b.share) ? theme.ink : theme.bg; font(700, 11 * k); ctx.textAlign = "center";
  ctx.fillText(b.away ? "To the case now" : b.shelf ? (finishOf(g)?.put ? "Back to the wall" : "Put on the shelf") : b.share ? "Share" : b.pop ? (on ? "Chasing these ✓" : "Chase these") : b.remove ? "Remove set" : "Remove chase", bx + bw / 2, by + bh * 0.68);
  ctx.textAlign = "left";
}
function drawPopRow(g, sx, y0, k, alpha) {
  if (k < 0.3 || !g.popChips) return;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  if (g.seg) { // the view: Set, Master set, Grand set
    const cur = scopeOf(g.set);
    for (const s of g.seg) {
      const x = sx + s.x * k, y = y0 + s.y * k, w = s.w * k, h = s.h * k, on = s.key === cur;
      rr(x, y, w, h, 7 * k);
      if (on) { ctx.fillStyle = theme.ink; ctx.fill(); } else { ctx.fillStyle = theme["panel-solid"]; ctx.fill(); ctx.lineWidth = Math.max(1, k * 0.8); ctx.strokeStyle = theme["slot-line"]; ctx.stroke(); }
      ctx.fillStyle = on ? theme.bg : theme.muted; font(700, 10.5 * k); ctx.textAlign = "center"; ctx.fillText(s.label, x + w / 2, y + h * 0.66);
    }
    ctx.textAlign = "left";
  }
  if (g.popChips.length) { ctx.fillStyle = theme.muted; font(600, 11 * k); ctx.fillText("People chase", sx, y0 + (g.popTop + 16) * k); } // a sealed album has nothing to chase
  drawHdrBtn(g, g.hdrBtn, sx, y0 + g.hdrBtn.y * k, k, alpha);
  if (g.hdrBtn2) drawHdrBtn(g, g.hdrBtn2, sx, y0 + g.hdrBtn2.y * k, k, alpha);
  for (const ch of g.popChips) {
    const x = sx + ch.x * k, y = y0 + ch.y * k, w = ch.w * k, h = ch.h * k, c = ch.c;
    rr(x, y, w, h, 6 * k); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
    ctx.lineWidth = Math.max(1, k * 0.8); ctx.strokeStyle = isChase(c) ? theme.gold : theme["slot-line"]; ctx.stroke();
    const pad = 9 * k;
    ctx.fillStyle = theme.muted; font(600, 10 * k); const pw = textW(ch.price);
    ctx.fillText(ch.price, x + w - pad - pw, y + h * 0.68);
    ctx.fillStyle = c.owned ? theme.muted : theme.ink; font(700, 10.5 * k, true);
    ctx.fillText(fitText(c.name, w - pad * 2 - pw - 5 * k), x + pad, y + h * 0.68);
  }
  if (g.popMore) {
    const last = g.popChips[g.popChips.length - 1], x = sx + (last.x + last.w + POP_GAP) * k, y = y0 + last.y * k;
    ctx.fillStyle = theme.muted; font(600, 10.5 * k);
    if (x + textW(`and ${g.popMore} more`) <= sx + (vw - 24) * k) ctx.fillText(`and ${g.popMore} more`, x, y + last.h * k * 0.68);
  }
}

// ----- tap: the sort, a ghost plaque, Share in the album; otherwise as before -----
function tap(sx, sy) {
  if (state.trans) return;
  const h = hit(sx, sy);
  if (picking() && !state.focus && h?.block) return togglePick(h.block);
  if (state.focus) { if (h?.card === state.focus) return; unfocus(); return; }
  if (view === "mosaic") {
    const ch = chipAt(sx, sy); if (ch) return startTrade(ch.t, ch);
    const cs = caseSortAt(sx, sy); if (cs) return setCaseSort(cs.key);
    const gh = ghostAt(sx, sy); if (gh) { tick(8); return openGhost(gh); }
    if (h?.block && lifted && !h.block.done) {
      const c = liftedAt(h.block, sx, sy);
      if (c && state.lens === "trade") {
        const who = wantedBy(c);
        if (who.length) { const chip = strip?.chips.find((x) => x.t === who[0]); return startTrade(who[0], chip); }
        tick(3); return toast(`Nobody is chasing ${c.name} yet.`);
      }
      if (c) return popCard(c, mr(c.m));
    }
    if (h?.block) enterGroup(h.block);
    else if (newPanelAt(sx, sy)) { tick(4); openSheet(); }
    return;
  }
  if (!h?.card) {
    if (h?.block && !marking && !fly && !shuffle) { const p = headAt(h.block, sx, sy); if (p) { tick(4); if (p.seg) setScope(h.block.set, p.seg); else if (p.btn) { if (p.btn.shelf) toggleShelf(h.block); else if (p.btn.share) shareTrophy(h.block); else if (p.btn.pop) chasePopular(h.block.set); else if (p.btn.remove) removeSet(h.block.set); else removeChase(h.block.chase); } else focus(p.c); } }
    return;
  }
  const w = TW * h.card.sz * cam.s;
  if (marking && w >= 14) return markCard(h.card, !h.card.owned);
  if (w >= 34) return focus(h.card);
  tick(5);
  const s = Math.min(maxS(), cam.s * 2.4), p = toWorld(sx, sy);
  flyTo({ s, x: p.x - sx / s, y: p.y - sy / s }, 380);
}

// ----- share: a trophy card, drawn offscreen at 2x, to the share sheet or a download -----
function trophyCard(t) {
  const ci = t.ci || caseInfoOf(t), f = finOf(t), S = 2, W = 600, H = 300;
  const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
  const x = cv.getContext("2d"); x.scale(S, S);
  const rrx = (X, Y, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, w, h, r); else x.rect(X, Y, w, h); };
  const setFont = (wgt, size, narrow) => { x.font = `${wgt} ${size}px ${FONT}`; if ("fontStretch" in x) x.fontStretch = narrow ? "semi-condensed" : "normal"; };
  const fit = (s, max) => { if (x.measureText(s).width <= max) return s; while (s.length > 2 && x.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; };
  x.fillStyle = theme.bg; x.fillRect(0, 0, W, H);
  const pw = 520, ph = 200, px = (W - pw) / 2, py = 36;
  x.fillStyle = theme["slot-line"]; rrx(px - 16, py + ph + 4, pw + 32, 6, 3); x.fill(); // the shelf
  rrx(px, py, pw, ph, 16); x.fillStyle = theme.plaque; x.fill();
  x.save(); rrx(px, py, pw, ph, 16); x.clip();
  x.fillStyle = theme["plaque-hi"]; x.fillRect(px, py, pw, 3);
  x.fillStyle = theme["plaque-lo"]; x.fillRect(px, py + ph - 3, pw, 3);
  x.restore();
  x.lineWidth = 2; x.strokeStyle = theme["plaque-lo"]; rrx(px + 9, py + 9, pw - 18, ph - 18, 10); x.stroke();
  const tx = px + 26, tw = pw - 52;
  x.fillStyle = theme["plaque-ink"]; x.textBaseline = "alphabetic"; x.textAlign = "left";
  setFont(800, 34, true); x.fillText(fit(ci.title, tw), tx, py + 52);
  setFont(600, 18, false);
  x.globalAlpha = 0.88; x.fillText(fit(ci.what, tw), tx, py + 82);
  x.globalAlpha = 0.72; x.fillText(fit(`Finished ${dayOf(f?.at || Date.now())} · worth ${money(ci.worth)}`, tw), tx, py + 108);
  x.globalAlpha = 1;
  const eh = 24, ey = py + ph - 26 - eh, n = t.base.length, cw = Math.min(tw / n, eh * TW / TH);
  x.fillStyle = "rgb(0 0 0 / .22)"; x.fillRect(tx - 2, ey - 2, Math.min(tw, n * cw) + 4, eh + 4);
  t.base.forEach((c, i) => { x.fillStyle = typeColor(c); x.fillRect(tx + i * cw, ey, cw, eh); });
  x.fillStyle = theme.muted; setFont(600, 13, false); x.textAlign = "right"; x.fillText("Card Chaser", W - 26, H - 22);
  return cv;
}
let sharing = false;
async function shareTrophy(t) {
  if (sharing) return;
  sharing = true; tick(5);
  try {
    const cv = trophyCard(t), name = `${nameOf(t).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-trophy.png`;
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    if (!blob) { toast("Couldn't draw the trophy card."); return; }
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${nameOf(t)}, finished`, text: `${nameOf(t)}: ${whatIs(t)}, finished ${dayOf(finOf(t)?.at || Date.now())}.` }); toast("Trophy card shared."); return; }
      catch (e) { if (e?.name === "AbortError") return; } // the sheet was closed: nothing to say
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
    toast("Trophy card saved as a picture.");
  } finally { sharing = false; }
}

// ----- the list: the same case, sorted the same, families together -----
function trophyListHTML(show, rows) {
  const all = allTrophies();
  if (!all.length) return "";
  for (const t of all) t.ci = caseInfoOf(t);
  const fams = caseFamilies(all);
  const sortRow = `<p class="lsort" role="group" aria-label="Sort trophies">${SORTS.map(([k, l]) => `<button type="button" class="pill-btn${k === caseSort ? " primary" : ""}" data-csort="${k}" aria-pressed="${k === caseSort}">${l}</button>`).join("")}</p>`;
  const one = (t, kid) => {
    const items = t.cards.filter(show);
    return `<div class="${kid ? "lkid" : "lfam"}"><h3 class="lfin">${esc(t.ci.title)}</h3><p class="lsub lfin-line"><span>${esc(t.ci.what)}. Finished ${dayOf(t.ci.at)}, worth ${money(t.ci.worth)}.${!t.ghost && onShelf(t) ? " On the shelf today." : ""}</span><span class="lbtns"><button type="button" class="pill-btn" data-share="${esc(tid(t))}">Share</button>${t.ghost ? "" : `<button type="button" class="pill-btn" data-shelf="${esc(doneKey(t))}">Back to the wall</button>`}</span></p>${items.length ? rows(items) : ""}</div>`;
  };
  return `<section class="lshelf"><h2>Trophies</h2><p class="lsub">${all.length === 1 ? "One finished" : `${all.length} finished`}, worth ${money(unionWorth(all))} together. Share makes a picture; Back to the wall puts one among the others again.</p>${sortRow}${fams.map((f) => one(f.head, false) + f.kids.map((k) => one(k, true)).join("")).join("")}</section>`;
}
document.getElementById("list").addEventListener("click", (e) => {
  const s = e.target.closest("[data-csort]"); if (s) return setCaseSort(s.dataset.csort);
  const b = e.target.closest("[data-share]"); if (!b) return;
  const t = allTrophies().find((x) => tid(x) === b.dataset.share); if (t) shareTrophy(t);
});
// Debug builds only: the tests' hook sees the case.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { caseInfo: { get: () => caseInfo }, caseGhosts: { get: () => caseGhosts }, caseSort: { get: () => caseSort }, setCaseSort: { value: setCaseSort }, trophyCard: { value: trophyCard }, shareTrophy: { value: shareTrophy } }); }, 0);
