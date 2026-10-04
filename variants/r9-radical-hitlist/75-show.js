// ---------- the show: for three days the wall becomes your hit list ----------
// Switch Show on and the mosaic folds back and dims while every card you want deals out of its panel as a big tile,
// stacking from the bottom of the screen upward, grouped by set (the oldest set lands nearest your thumb) and ordered
// by the most you'd pay, high first. A budget line sits under the top strip. Swipe a tile sideways when you find the
// card: it flies back into its set in the wall behind, is marked owned, and a thumb-reach keypad asks what you paid.
// Show off flies everything home and the wall is exactly as it was. Outside Show nothing changes.
const SHOW_NAME = "Sacramento, Nov 20 to 22";
const capOf = (c) => Math.round(c.price * 0.85 * 100) / 100;
let wants = {}, paid = {}, budget = 300, showOn = false;
try { wants = JSON.parse(localStorage.getItem("wall-wants") || "{}") || {}; } catch { wants = {}; }
try { paid = JSON.parse(localStorage.getItem("wall-show-paid") || "{}") || {}; } catch { paid = {}; }
try { budget = Number(localStorage.getItem("wall-show-budget")) || 300; } catch { budget = 300; }
const persistShow = () => { try { localStorage.setItem("wall-wants", JSON.stringify(wants)); localStorage.setItem("wall-show-paid", JSON.stringify(paid)); localStorage.setItem("wall-show-budget", String(budget)); localStorage.setItem("wall-show", showOn ? "1" : ""); } catch { /* private mode */ } };
document.getElementById("reset").addEventListener("click", () => { try { for (const k of ["wall-wants", "wall-show-paid", "wall-show-budget", "wall-show"]) localStorage.removeItem(k); } catch { /* fine */ } });
for (const c of cards) c.want0 = h32(c.id + "w") < 0.1;
const isWant = (c) => !c.owned && (wants[c.id] ?? c.want0);
const spent = () => Object.values(paid).reduce((a, v) => a + (v || 0), 0);
const anyWant = () => cards.some(isWant);

// ----- chrome: the Show pill, the budget line, the keypad, and Want it on the card panel -----
const showBtn = document.createElement("button");
showBtn.type = "button"; showBtn.id = "show"; showBtn.className = "showpill"; showBtn.setAttribute("aria-pressed", "false"); showBtn.textContent = "Show";
arrBtn.insertAdjacentElement("afterend", showBtn);
const budgetEl = document.createElement("button");
budgetEl.type = "button"; budgetEl.id = "budget"; budgetEl.className = "budget glass"; budgetEl.setAttribute("aria-label", "Your budget for the show. Tap to change it.");
budgetEl.innerHTML = `<span class="bl"><b id="b-spent"></b><span id="b-where">${SHOW_NAME}</span></span><span class="bbar"><i id="b-fill"></i></span>`;
document.querySelector(".top").after(budgetEl);
const bSpent = document.getElementById("b-spent"), bFill = document.getElementById("b-fill");
function updateBudget() {
  const s = spent();
  bSpent.textContent = `Spent ${money(s)} of ${short(budget)}`;
  bFill.style.width = `${clamp(budget ? (s / budget) * 100 : 100, 0, 100)}%`;
  budgetEl.classList.toggle("over", s > budget);
}
const payEl = document.createElement("div");
payEl.id = "pay"; payEl.className = "pay glass"; payEl.setAttribute("role", "dialog"); payEl.setAttribute("aria-labelledby", "pay-q"); payEl.inert = true;
payEl.innerHTML = `<div class="pay-head"><b id="pay-q">What did you pay?</b><span id="pay-sub"></span></div><output class="pay-amt" id="pay-amt" aria-live="polite">$0</output>
<div class="pay-keys" id="pay-keys">${["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((k) => `<button type="button" data-k="${k}"${k === "⌫" ? ' aria-label="Delete"' : ""}>${k}</button>`).join("")}</div>
<div class="pay-acts"><button type="button" class="mbtn" id="pay-skip">Skip</button><button type="button" class="mbtn primary" id="pay-done">Done</button></div>`;
const scrim = document.createElement("div"); scrim.className = "pay-scrim";
document.body.append(scrim, payEl);
const payQ = document.getElementById("pay-q"), paySub = document.getElementById("pay-sub"), payAmt = document.getElementById("pay-amt"), paySkip = document.getElementById("pay-skip"), payDone = document.getElementById("pay-done");
const pay = { kind: null, c: null, str: "", fresh: true };
const paying = () => Boolean(pay.kind);
function renderPay() { payAmt.textContent = pay.str ? `$${pay.str}` : "$0"; }
function openPay(kind, c = null) {
  pay.kind = kind; pay.c = c; pay.fresh = true;
  pay.str = kind === "budget" ? String(budget) : capOf(c).toFixed(2);
  payQ.textContent = kind === "budget" ? "Your budget for the show" : "What did you pay?";
  paySub.textContent = kind === "budget" ? SHOW_NAME : `${c.name}, ${sets[c.si].code} ${c.num}/${sets[c.si].printed}. Up to ${money(capOf(c))}.`;
  paySkip.textContent = kind === "budget" ? "Cancel" : "Skip";
  renderPay(); payEl.inert = false; document.body.classList.add("paying"); payDone.focus({ preventScroll: true });
}
function closePay() { pay.kind = null; pay.c = null; payEl.inert = true; document.body.classList.remove("paying"); }
function payKey(k) {
  if (k === "⌫" || k === "Backspace") { pay.str = pay.fresh ? "" : pay.str.slice(0, -1); pay.fresh = false; }
  else if (k === ".") { if (pay.fresh || !pay.str.includes(".")) pay.str = pay.fresh ? "0." : `${pay.str || "0"}.`; pay.fresh = false; }
  else if (/^\d$/.test(k)) {
    if (pay.fresh) pay.str = "";
    const dot = pay.str.indexOf(".");
    if ((dot >= 0 && pay.str.length - dot > 2) || (dot < 0 && pay.str.length >= 5)) return;
    pay.str = pay.str === "0" ? k : pay.str + k; pay.fresh = false;
  } else return;
  tick(3); renderPay();
}
const payAmount = () => clamp(Math.round((parseFloat(pay.str) || 0) * 100) / 100, 0, 99999);
function payFinish(skip) {
  const { kind, c } = pay; if (!kind) return;
  const amount = skip ? null : payAmount();
  closePay();
  if (kind === "budget") { if (!skip) { budget = Math.max(0, amount); persistShow(); updateBudget(); toast(`Budget ${short(budget)} for ${SHOW_NAME}`); } return; }
  paid[c.id] = amount; persistShow(); updateBudget(); drawList();
  const undo = () => { delete paid[c.id]; setOwned(c, false, { quiet: true }); persistShow(); updateBudget(); if (!showOn) enterShow({ silent: true }); };
  if (showOn && !anyWant()) { toast(`Found all ${Object.keys(paid).length}. Spent ${money(spent())}.`, undo); exitShow(); return; }
  toast(`${c.name} found${amount ? ` for ${money(amount)}` : ""}. Spent ${money(spent())} of ${short(budget)}.`, undo);
}
document.getElementById("pay-keys").addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) payKey(b.dataset.k); });
paySkip.onclick = () => payFinish(true);
payDone.onclick = () => payFinish(false);
scrim.onclick = () => payFinish(true);
budgetEl.onclick = () => { if (!paying()) openPay("budget"); };
addEventListener("keydown", (e) => {
  if (!paying()) return;
  if (e.key === "Enter") { e.preventDefault(); payFinish(false); }
  else if (e.key === "Escape") { e.preventDefault(); payFinish(true); }
  else if (/^\d$|^\.$|^Backspace$/.test(e.key)) { e.preventDefault(); payKey(e.key); }
});
// Want it, next to I have it on the card panel.
const wantBtn = document.createElement("button");
wantBtn.type = "button"; wantBtn.id = "p-want"; wantBtn.className = "act want";
document.querySelector("#panel .acts").insertBefore(wantBtn, document.getElementById("p-buy"));
function updateWant(c) {
  const on = isWant(c);
  wantBtn.hidden = c.owned;
  wantBtn.textContent = on ? "Want it ✓" : "Want it";
  wantBtn.classList.toggle("on", on); wantBtn.setAttribute("aria-pressed", String(on));
}
wantBtn.onclick = () => {
  const c = state.focus; if (!c || c.owned) return;
  wants[c.id] = !isWant(c); persistShow(); updateWant(c); tick(5); drawList(); kick();
  toast(wants[c.id] ? `${c.name} on your hit list. Pay up to ${money(capOf(c))}.` : `${c.name} off your hit list.`);
};
function fillPanel(c, dir) {
  const st = sets[c.si];
  const swap = document.getElementById("swap");
  const put = () => {
    document.getElementById("p-name").textContent = c.name;
    document.getElementById("p-meta").textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. ${c.rname}.${c.owned && c.got ? ` Yours since ${new Date(c.got).toLocaleDateString("en-US", { month: "short", year: "numeric" })}.` : ""}${!c.owned && isWant(c) ? ` Pay up to ${money(capOf(c))}.` : ""}`;
    document.getElementById("p-price").innerHTML = `${money(c.price)}<small>market</small>`;
    const dl = document.getElementById("p-deal");
    if (!c.owned && c.deal) { dl.hidden = false; dl.textContent = `A copy on eBay for ${money(c.deal)} right now, ${Math.round((1 - c.deal / c.price) * 100)}% under.`; } else dl.hidden = true;
    const own = document.getElementById("p-own"), buy = document.getElementById("p-buy");
    own.textContent = c.owned ? "In your collection ✓" : "I have it";
    own.className = `act ${c.owned ? "owned" : "primary"}`;
    own.setAttribute("aria-pressed", String(c.owned));
    buy.textContent = c.owned ? "Back to the set" : c.deal ? `Buy for ${money(c.deal)}` : "Find a copy";
    updateWant(c);
  };
  if (dir && !reduced) { swap.classList.add("out"); setTimeout(() => { put(); swap.classList.remove("out"); }, 140); } else put();
}

// ----- the hit list model -----
const ROW_H = 86, ROW_GAP = 8, HEAD_H = 34, SET_GAP = 14, PW = 42, PH = Math.round(PW * TH / TW), LX = 10;
const hl = { rows: [], heads: new Map(), items: [], ghosts: [], H: 0, Hcur: 0, scroll: 0, vel: 0, inertia: false, drag: null, q: null, dirty: false, closing: false, open: 0, from: 0, to: 0, t0: 0, last: 0 };
const flights = [];
let safeTop = 0, safeBot = 0;
const readSafe = () => { const cs = getComputedStyle(document.documentElement); safeTop = parseFloat(cs.paddingTop) || 0; safeBot = parseFloat(cs.paddingBottom) || 0; };
const listTopY = () => topPad() + 54 + safeTop; // under the budget line
const listBot = () => 16 + safeBot;
const listTop = () => vh - listBot() - hl.Hcur + hl.scroll;
const availH = () => vh - listBot() - listTopY();
const matchQ = (c, words) => { const hay = `${c.name} ${sets[c.si].name} ${c.num} ${c.rname} ${(TYPE[c.type] || TYPE.C)[0]}`.toLowerCase(); return words.every((w) => hay.includes(w)); };
// Where the card's tile sits in the wall behind, folded back with it.
function homeRect(c) {
  const r = mr(c.m), o = hl.open;
  if (o <= 0) return r;
  const k = 1 - 0.06 * o, px = vw / 2, py = topPad();
  return { x: px + (r.x - px) * k, y: py + (r.y - py) * k, w: r.w * k, h: r.h * k };
}
const listX = () => Math.max(LX, (vw - 600) / 2), listW = () => vw - listX() * 2;
const pocketRect = (r) => ({ x: listX() + r.dx + 12, y: listTop() + r.ycur + (ROW_H - PH) / 2, w: PW, h: PH });
function layoutItems() {
  const bySet = new Map();
  for (const r of hl.rows) { if (hl.q && !matchQ(r.c, hl.q)) continue; if (!bySet.has(r.c.si)) bySet.set(r.c.si, []); bySet.get(r.c.si).push(r); }
  const items = []; let y = 0;
  for (const si of [...bySet.keys()].sort((a, b) => b - a)) { // newest set at the top, the oldest nearest your thumb
    const rs = bySet.get(si).sort((a, b) => capOf(b.c) - capOf(a.c) || a.c.i - b.c.i);
    let h = hl.heads.get(si); if (!h) { h = { kind: "head", si, ycur: null, a: 0 }; hl.heads.set(si, h); }
    h.n = rs.length; h.sum = rs.reduce((t, r) => t + capOf(r.c), 0); h.cy = y; h.rows = rs; y += HEAD_H;
    if (h.ycur == null) h.ycur = h.cy;
    items.push(h);
    for (const r of rs) { r.cy = y; if (r.ycur == null) r.ycur = r.cy; r.head = h; y += ROW_H + ROW_GAP; items.push(r); }
    y += SET_GAP - ROW_GAP;
  }
  for (const si of [...hl.heads.keys()]) if (!bySet.has(si)) hl.heads.delete(si);
  hl.items = items; hl.H = Math.max(0, y - (SET_GAP - ROW_GAP));
  if (hl.Hcur === 0 || reduced) hl.Hcur = hl.H;
  hl.scroll = clamp(hl.scroll, 0, Math.max(0, hl.H - availH()));
}
// The list follows the wants: a card marked owned (or found) leaves, a card wanted again deals back out.
function syncHit(now) {
  const want = new Set();
  for (const c of cards) if (isWant(c)) want.add(c);
  let changed = hl.dirty;
  for (const r of [...hl.rows]) if (!want.has(r.c)) { leaveRow(r, now); changed = true; }
  const have = new Set(hl.rows.map((r) => r.c)), fresh = [];
  for (const c of want) if (!have.has(c)) { const r = { kind: "row", c, cy: 0, ycur: null, a: 0, dx: 0, armed: false }; hl.rows.push(r); fresh.push(r); c.away = true; changed = true; }
  if (changed) { layoutItems(); hl.dirty = false; }
  if (fresh.length) { fresh.sort((a, b) => b.cy - a.cy); fresh.forEach((r, i) => dealRow(r, Math.min(900, i * 22))); }
}
function dealRow(r, delay) {
  const c = r.c, cur = c.flight?.cur;
  startFlight({ c, row: r, kind: "deal", from: cur ? { ...cur } : () => homeRect(c), to: () => pocketRect(r), dur: 560, delay, lift: 28, done: () => { r.a = 1; kick(); } });
}
function leaveRow(r, now) {
  hl.rows.splice(hl.rows.indexOf(r), 1);
  const from = r.c.flight?.cur ? { ...r.c.flight.cur } : pocketRect(r);
  hl.ghosts.push({ kind: "ghost", c: r.c, y: listTop() + r.ycur, dx: r.dx, a: r.a, t0: now });
  startFlight({ c: r.c, kind: "home", from, to: () => homeRect(r.c), dur: 620, delay: 0, lift: 26, done: () => { r.c.away = false; kick(); } });
}
// ----- flights: the tile itself travelling between its panel and the list -----
function startFlight(f) {
  if (f.c.flight) flights.splice(flights.indexOf(f.c.flight), 1);
  f.t0 = performance.now() + (reduced ? 0 : f.delay || 0); f.c.flight = f; f.c.away = true;
  flights.push(f); kick();
}
function stepFlights(now) {
  if (!flights.length) return false;
  for (const f of [...flights]) {
    const p = reduced ? 1 : clamp((now - f.t0) / f.dur, 0, 1), e = ease(p);
    const a = typeof f.from === "function" ? f.from() : f.from, b = f.to();
    const r = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * p) * f.lift, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e };
    f.cur = r;
    if (f.row) f.row.a = Math.max(f.row.a, clamp((p - 0.45) / 0.4, 0, 1));
    if (p > 0 && p < 1 && r.w > 10) { ctx.globalAlpha = 0.22; rr(r.x + 1, r.y + 2 + r.w * 0.06, r.w, r.h, r.w * 0.045); ctx.fillStyle = "#000"; ctx.fill(); }
    const e0 = f.c.e; f.c.e = 1; ctx.globalAlpha = 1; drawTile(f.c, r.x, r.y, r.w, r.h, now); f.c.e = e0;
    if (p >= 1) { flights.splice(flights.indexOf(f), 1); f.c.flight = null; f.done?.(); }
  }
  return true;
}

// ----- on and off -----
function enterShow({ silent = false } = {}) {
  if (showOn) return;
  finishTransition(); if (state.focus) unfocus(); leaveMark(); if (playing) stopTime(); setMenu(false);
  if (view === "set") { view = "mosaic"; state.g = null; fly = null; inertia = false; setChrome(); }
  showOn = true; hl.closing = false; hl.scroll = 0; hl.vel = 0; hl.inertia = false; hl.drag = null; hl.ghosts = [];
  const q = qIn.value.trim().toLowerCase(); hl.q = q ? q.split(/\s+/) : null; state.matches = null;
  state.introT0 = 0; hl.dirty = true;
  document.body.classList.add("show"); showBtn.setAttribute("aria-pressed", "true");
  hl.t0 = performance.now(); hl.from = hl.open; hl.to = 1;
  persistShow(); updateBudget(); updateCount(); readSafe();
  for (const r of hl.rows) if (r.c.flight?.kind === "home") dealRow(r, 0); // caught mid-flight home: turn round
  syncHit(performance.now());
  if (!silent) toast(hl.rows.length ? `${hl.rows.length} to hunt at ${SHOW_NAME}. Swipe one sideways when you find it.` : `Nothing to hunt yet. Open a card and choose Want it.`);
  tick(8); drawList(); kick();
}
function exitShow() {
  if (!showOn) return;
  showOn = false; hl.closing = true; hl.drag = null; hl.inertia = false; closePay();
  document.body.classList.remove("show"); showBtn.setAttribute("aria-pressed", "false");
  hl.t0 = performance.now(); hl.from = hl.open; hl.to = 0;
  const rows = [...hl.rows].sort((a, b) => a.cy - b.cy);
  rows.forEach((r, i) => { const from = r.c.flight?.cur ? { ...r.c.flight.cur } : pocketRect(r); startFlight({ c: r.c, kind: "home", from, to: () => homeRect(r.c), dur: 560, delay: Math.min(500, i * 14), lift: 24, done: () => { r.c.away = false; kick(); } }); });
  hl.q = null;
  const q = qIn.value.trim().toLowerCase(); state.matches = q ? new Set(cards.filter((c) => matchQ(c, q.split(/\s+/)))) : null;
  persistShow(); updateCount(); tick(6); drawList(); kick();
}
showBtn.onclick = () => (showOn ? exitShow() : enterShow());

// ----- the wall behind: folded back and dimmed while Show is on -----
function drawMosaic(now, alpha = 1, except = null) {
  const o = hl.open;
  if (o > 0) { const k = 1 - 0.06 * o; ctx.save(); ctx.translate(vw / 2, topPad()); ctx.scale(k, k); ctx.translate(-vw / 2, -topPad()); alpha *= 1 - (theme.dark ? 0.66 : 0.72) * o; }
  for (const g of groups) {
    if (g === except) continue;
    if (g.m.y - mScroll > vh || g.m.y + g.m.h - mScroll < 0) continue;
    drawPanel(g, now, alpha);
    for (const c of g.cards) drawTile(c, c.m.x, c.m.y - mScroll, c.m.w, c.m.h, now, alpha);
  }
  if (o > 0) ctx.restore();
}
// A card that's out on the hit list leaves its slot empty in the wall.
function emphasis(c) {
  if (c.away) return 0;
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  if (state.lens === "need") return c.owned ? 0.16 : 1;
  if (state.lens === "deals") return !c.owned && c.deal ? 1 : 0.18;
  if (state.lens === "value") return c.owned ? 1 : 0.22;
  return 1;
}
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ["bg", "slot", "slot-line", "ink", "muted", "deal", "gold", "panel", "paper", "paper-ink", "panel-solid", "line"]) theme[k] = cs.getPropertyValue(`--${k}`).trim();
  theme.panelFill = cs.getPropertyValue("--panel-fill").trim();
  if (typeof heatCache !== "undefined") heatCache.clear();
  theme.dark = cs.colorScheme === "dark" || matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
}

// ----- drawing the list -----
function stepOpen(now) {
  if (hl.open === hl.to) return false;
  const p = reduced ? 1 : clamp((now - hl.t0) / 480, 0, 1);
  hl.open = hl.from + (hl.to - hl.from) * ease(p);
  return p < 1;
}
function drawRow(r, y, now) {
  const a = r.a; if (a <= 0.01) return;
  const x0 = listX(), W = listW(), c = r.c, st = sets[c.si], dx = r.dx;
  if (Math.abs(dx) > 1) { // the "Found it" strip under a tile as it slides
    const reveal = clamp(Math.abs(dx) / 80, 0, 1);
    rr(x0, y, W, ROW_H, 12); ctx.globalAlpha = a * reveal; ctx.fillStyle = theme["panel-solid"]; ctx.fill();
    ctx.globalAlpha = a * reveal * (r.armed ? 1 : 0.6); ctx.fillStyle = theme.deal; ctx.fill();
    ctx.globalAlpha = a * reveal;
    ctx.fillStyle = "#fff"; font(800, 18, true); ctx.textBaseline = "middle"; ctx.textAlign = dx > 0 ? "left" : "right";
    ctx.fillText("Found it", dx > 0 ? x0 + 20 : x0 + W - 20, y + ROW_H / 2);
  }
  ctx.globalAlpha = a;
  const rx = x0 + dx;
  rr(rx, y, W, ROW_H, 12); ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = theme["slot-line"]; ctx.stroke();
  if (!c.flight) { const p = pocketRect(r); p.y = y + (ROW_H - PH) / 2; const e0 = c.e; c.e = 1; drawTile(c, p.x, p.y, p.w, p.h, now, a); c.e = e0; ctx.globalAlpha = a; }
  const tx = rx + 66, capW = 132, tw = W - 66 - capW - 8;
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(800, 20, true); ctx.fillText(fitText(c.name, tw), tx, y + 36);
  font(500, 13.5); ctx.fillStyle = theme.muted;
  const meta = `${st.code} ${c.num}/${st.printed}`;
  if (c.deal) { ctx.fillText(meta, tx, y + 58); if (r.mw == null) r.mw = ctx.measureText(`${meta} `).width; ctx.fillStyle = theme.deal; font(700, 13.5); ctx.fillText(fitText(`Live ${money(c.deal)}`, tw - r.mw), tx + r.mw, y + 58); }
  else ctx.fillText(fitText(`${meta}, ${c.rname}`, tw), tx, y + 58);
  ctx.textAlign = "right"; font(600, 12); ctx.fillStyle = theme.muted; ctx.fillText("Pay up to", rx + W - 14, y + 30);
  ctx.fillStyle = theme.ink; font(800, 26); ctx.fillText(money(capOf(c)), rx + W - 14, y + 62);
}
function drawHead(h, y) {
  if (h.a <= 0.01) return;
  const st = sets[h.si], x0 = listX(), W = listW();
  rr(x0, y + 2, W, HEAD_H - 4, 8); ctx.globalAlpha = h.a * 0.94; ctx.fillStyle = theme["panel-solid"]; ctx.fill();
  ctx.globalAlpha = h.a;
  ctx.fillStyle = st.ink; ctx.fillRect(x0, y + 7, 3, HEAD_H - 14);
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
  font(800, 16, true); ctx.fillText(fitText(st.name, W * 0.5), x0 + 13, y + 22);
  ctx.textAlign = "right"; ctx.fillStyle = theme.muted; font(600, 13);
  ctx.fillText(`${h.n} to find, up to ${short(h.sum)}`, x0 + W - 12, y + 22);
}
function drawEmpty() {
  ctx.globalAlpha = 1; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const y = vh - listBot() - 120;
  ctx.fillStyle = theme.ink; font(800, 22, true); ctx.fillText(hl.q ? "Nothing on your hit list matches" : "Nothing to hunt yet", vw / 2, y);
  ctx.fillStyle = theme.muted; font(500, 14); ctx.fillText(hl.q ? "Clear the search to see the whole list." : "Switch Show off, open a card and choose Want it.", vw / 2, y + 26);
}
function drawHit(now) {
  const dt = Math.min(48, now - (hl.last || now)); hl.last = now;
  let more = false;
  if (showOn) syncHit(now);
  const k = reduced ? 1 : Math.min(1, dt / 140);
  if (Math.abs(hl.Hcur - hl.H) > 0.3) { hl.Hcur += (hl.H - hl.Hcur) * k; more = true; } else hl.Hcur = hl.H;
  if (hl.inertia && !hl.drag) {
    const max = Math.max(0, hl.H - availH());
    hl.scroll = clamp(hl.scroll + hl.vel * dt, 0, max); hl.vel *= Math.pow(0.95, dt / 16);
    if (Math.abs(hl.vel) < 0.02 || hl.scroll <= 0 || hl.scroll >= max) hl.inertia = false; else more = true;
  }
  const top = listTop(), topY = listTopY();
  ctx.save(); ctx.beginPath(); ctx.rect(0, topY, vw, vh - topY); ctx.clip();
  for (const it of hl.items) {
    if (Math.abs(it.ycur - it.cy) > 0.3) { it.ycur += (it.cy - it.ycur) * k; more = true; } else it.ycur = it.cy;
    if (it.kind === "row") {
      const ta = hl.closing ? 0 : it.c.flight ? it.a : 1;
      if (Math.abs(it.a - ta) > 0.01) { it.a += (ta - it.a) * (reduced ? 1 : Math.min(1, dt / 160)); more = true; } else it.a = ta;
      if (!hl.drag || hl.drag.row !== it) { if (Math.abs(it.dx) > 0.5) { it.dx *= reduced ? 0 : Math.pow(0.8, dt / 16); more = true; } else it.dx = 0; }
    } else it.a = it.rows.reduce((m, r) => Math.max(m, r.a), 0);
    const y = top + it.ycur, h = it.kind === "head" ? HEAD_H : ROW_H;
    if (y > vh || y + h < topY) continue;
    if (it.kind === "head") drawHead(it, y); else drawRow(it, y, now);
  }
  for (const g of [...hl.ghosts]) {
    g.a *= reduced ? 0 : Math.pow(0.75, dt / 16); g.dx += g.dx * dt * 0.01;
    if (g.a < 0.03) { hl.ghosts.splice(hl.ghosts.indexOf(g), 1); continue; }
    drawRow(g, g.y, now); more = true;
  }
  if (showOn && !hl.items.length && !flights.length) drawEmpty();
  ctx.restore();
  if (stepFlights(now)) more = true;
  if (hl.closing && hl.open <= 0 && !flights.length) { hl.closing = false; hl.rows = []; hl.items = []; hl.heads.clear(); hl.ghosts = []; hl.H = hl.Hcur = 0; }
  ctx.globalAlpha = 1;
  if (more || hl.closing) kick();
}
// Every frame: the wall (folded back while Show is on), then the hit list over it.
function kick() {
  if (raf) return;
  raf = requestAnimationFrame(showFrame);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; showFrame(performance.now()); } }, 120);
}
function showFrame(now) {
  const opening = stepOpen(now);
  frame(now);
  if (showOn || hl.closing || flights.length || hl.ghosts.length) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawHit(now); }
  if (opening) kick();
}

// ----- input: while Show is on, the hit list owns every touch on the canvas -----
const ARM = () => Math.min(150, vw * 0.38);
function rowAt(x, y) {
  if (y < listTopY()) return null;
  const top = listTop();
  for (const it of hl.items) { if (it.kind !== "row") continue; const ry = top + it.ycur; if (y >= ry && y <= ry + ROW_H && x >= listX() && x <= listX() + listW()) return it; }
  return null;
}
function hitDown(x, y) {
  hl.inertia = false; hideCaption(); if (document.activeElement === qIn) qIn.blur();
  hl.drag = { x, y, t: performance.now(), s0: hl.scroll, row: rowAt(x, y), axis: null, samples: [{ x, y, t: performance.now() }] };
}
function hitMove(x, y) {
  const d = hl.drag; if (!d) return;
  const dx = x - d.x, dy = y - d.y, now = performance.now();
  d.samples.push({ x, y, t: now }); if (d.samples.length > 8) d.samples.shift();
  if (!d.axis) { if (Math.hypot(dx, dy) < 8) return; d.axis = d.row && Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y"; }
  if (d.axis === "x") {
    const r = d.row; r.dx = clamp(dx, -vw, vw);
    const armed = Math.abs(r.dx) > ARM(); if (armed !== r.armed) { r.armed = armed; tick(armed ? 6 : 3); }
  } else hl.scroll = clamp(d.s0 + dy, 0, Math.max(0, hl.H - availH()));
  kick();
}
function hitUp(x, y, cancelled) {
  const d = hl.drag; if (!d) return; hl.drag = null;
  if (cancelled) { if (d.row) d.row.armed = false; kick(); return; }
  const now = performance.now();
  const s0 = d.samples.find((s) => now - s.t < 90) || d.samples[0], last = d.samples[d.samples.length - 1];
  const vx = s0 && s0 !== last ? (last.x - s0.x) / Math.max(1, last.t - s0.t) : 0, vy = s0 && s0 !== last ? (last.y - s0.y) / Math.max(1, last.t - s0.t) : 0;
  if (d.axis === "x") {
    const r = d.row, flick = Math.abs(r.dx) > 48 && Math.abs(vx) > 0.7 && Math.sign(vx) === Math.sign(r.dx);
    r.armed = false;
    if (Math.abs(r.dx) > ARM() || flick) found(r.c);
    kick(); return;
  }
  if (d.axis === "y") { if (!reduced && Math.abs(vy) > 0.2) { hl.vel = vy; hl.inertia = true; } kick(); return; }
  // a tap
  if (d.row) { const c = d.row.c; tick(4); toast(`${c.name}: market ${money(c.price)}. Swipe it sideways when you find it.`); }
}
function found(c) {
  if (!isWant(c)) return;
  tick(14);
  setOwned(c, true, { quiet: true });
  openPay("paid", c);
}
const owns = () => showOn || hl.closing;
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!owns() || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (paying() || !showOn) return;
  const ts = e.touches;
  if (type === "touchstart") { if (ts.length !== 1) { hitUp(null, null, true); return; } hitDown(ts[0].clientX, ts[0].clientY); }
  else if (type === "touchmove") { if (ts.length !== 1) { hitUp(null, null, true); return; } hitMove(ts[0].clientX, ts[0].clientY); }
  else if (!ts.length) { const p = e.changedTouches[0]; hitUp(p?.clientX, p?.clientY, type === "touchcancel"); }
}, { capture: true, passive: false });
let hitMouse = false;
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !owns() || e.target !== canvas) return; e.stopImmediatePropagation(); if (paying() || !showOn) return; hitMouse = true; hitDown(e.clientX, e.clientY); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !hitMouse) return; e.stopImmediatePropagation(); hitMove(e.clientX, e.clientY); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !hitMouse) return; hitMouse = false; e.stopImmediatePropagation(); hitUp(e.clientX, e.clientY, type === "pointercancel"); }, true);
document.addEventListener("wheel", (e) => {
  if (!owns() || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (!showOn) return;
  hl.scroll = clamp(hl.scroll - e.deltaY, 0, Math.max(0, hl.H - availH())); kick();
}, { capture: true, passive: false });
canvas.addEventListener("keydown", (e) => {
  if (!showOn) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.stopImmediatePropagation(); e.preventDefault(); hl.scroll = clamp(hl.scroll + (e.key === "ArrowUp" ? 120 : -120), 0, Math.max(0, hl.H - availH())); kick(); }
  else if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); exitShow(); }
}, true);

// ----- search: on the show floor it narrows the hit list instead of flying the camera -----
function runSearch() {
  const q = qIn.value.trim().toLowerCase();
  searchBox.classList.toggle("has", Boolean(q));
  if (showOn) { hl.q = q ? q.split(/\s+/) : null; state.matches = null; hl.dirty = true; drawList(); kick(); return; }
  if (!q) { state.matches = null; drawList(); kick(); return; }
  const words = q.split(/\s+/);
  const m = cards.filter((c) => matchQ(c, words));
  state.matches = new Set(m);
  drawList();
  if (document.body.classList.contains("listmode")) return;
  if (state.focus) unfocus();
  if (!m.length) { kick(); return; }
  const gs = [...new Set(m.map((c) => groups[c.g]))];
  const go = (c) => { const s = fitCam(groups[c.g]).s * 2.2; flyTo({ s, x: c.x - (vw / 2) / s + TW * c.sz / 2, y: c.y - (vh / 2.4) / s }, 520); if (m.length === 1) setTimeout(() => focus(c), 540); };
  if (gs.length === 1) {
    if (view === "set" && state.g === gs[0]) return go(m[0]);
    if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
    return enterGroup(gs[0], { then: () => go(m[0]) });
  }
  if (view === "set") exitToMosaic();
  kick();
}

// ----- the list view: the hit list as text, with Found it -----
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "deals" ? !c.owned && c.deal : true);
  let top = "";
  if (showOn) {
    const ws = cards.filter((c) => isWant(c) && (!hl.q || matchQ(c, hl.q))).sort((a, b) => b.si - a.si || capOf(b) - capOf(a));
    top = `<section class="lhit"><h2>Your hit list</h2><p class="lsub">${SHOW_NAME}. Spent ${money(spent())} of ${short(budget)}. ${ws.length} to find.</p><ul>${ws.map((c) => {
      const st = sets[c.si];
      return `<li class="lhrow"><div class="lrow lwant"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">Pay up to ${money(capOf(c))}</span><span class="lstate">${c.deal ? `Live ${money(c.deal)}` : `Market ${money(c.price)}`}</span></div><button type="button" class="pill-btn lfound" data-found="${c.i}">Found it</button></li>`;
    }).join("")}</ul>${ws.length ? "" : `<p class="lsub">Nothing to hunt yet.</p>`}</section>`;
  }
  listEl.querySelector("#list-body").innerHTML = top + (groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si];
      return `<li><button class="lrow" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? "Have it" : isWant(c) ? `Want it, up to ${money(capOf(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`);
}
listEl.addEventListener("click", (e) => { const b = e.target.closest("[data-found]"); if (!b) return; found(cards[Number(b.dataset.found)]); });

// ----- start: the show stays on across reloads for the three days -----
addEventListener("resize", () => { readSafe(); hl.dirty = true; kick(); });
readSafe(); updateBudget();
setTimeout(() => { try { if (localStorage.getItem("wall-show") === "1") enterShow({ silent: true }); } catch { /* fine */ } }, 0);
