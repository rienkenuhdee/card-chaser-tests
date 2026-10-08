// ---------- price history and collection value (parity 3): production's card chart and "Collection value" ----------
// Production keeps TCGplayer's market price and the lowest eBay ask per card per day, and shows a small chart on the
// card sheet; Trophies' "collection at market" opens what the collection is worth over time, what you paid against
// what it's worth now, and where the value is. Here the history is made up, seeded by card id, about a year back,
// worked out when it's asked for and cached (never stored): a drift for the year (vintage holos climb), a release
// that starts high and settles for a new set, a few steps, and day to day noise, ending exactly at today's market.
// The lowest eBay ask wanders a little around it. A graded copy's ask moves with the market, a little more, ending at
// what its grade asks today (79-graded.js). The collection's value on a day is every card you own at that day's price,
// counted from the day you got it (a slab at its grade's ask), so today's point is the worth shown everywhere else.
// Left out: production's server-side history and real TCGplayer prices.

const HIST_DAYS = 365, DAY_MS = 86400e3, GRADE_SWING = 1.25;
const histDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
// The calendar date of day i (0 is a year ago, HIST_DAYS is today).
function histDate(i, year = false) {
  const d = new Date(histDay(Date.now())); d.setDate(d.getDate() - (HIST_DAYS - i));
  return d.toLocaleDateString("en-US", year ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}
function histRng(seed) { // mulberry32: cheap, and the same every time for a card
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ----- a card's history: { p: market per day, ask: lowest eBay ask per day, first: the first day it existed } -----
const histMemo = new Map();
function histOf(c, keep = true) {
  const b = c.base || c, t0 = histDay(Date.now()), price = Number.isFinite(b.price) && b.price > 0 ? b.price : 0.01, key = `${price}|${t0}`;
  const m = histMemo.get(b.id);
  if (m?.key === key) return m;
  const h = histMake(b, price, t0); h.key = key;
  if (keep) { if (histMemo.size > 400) histMemo.clear(); histMemo.set(b.id, h); }
  return h;
}
function histMake(b, price, t0) {
  const N = HIST_DAYS, st = sets[b.si], R = histRng(h32(`${b.id}|hist`)), vintage = st.year < 2003, tier = b.tier || 0;
  const start = t0 - N * DAY_MS, rel = st.released ? histDay(st.released) : 0;
  const first = rel > start ? clamp(Math.round((rel - start) / DAY_MS), 0, N) : 0; // a set out this year starts on its release
  const drift = vintage ? (tier >= 3 ? 0.12 + 0.28 * R() : 0.02 + 0.1 * R()) : (R() - 0.5) * 0.2; // over the year, in log terms
  const fresh = !vintage && t0 - rel < 2.2 * 365 * DAY_MS; // a new set: high at release, settling down
  const hype = fresh ? (tier >= 4 ? 0.45 + 0.6 * R() : tier >= 3 ? 0.25 + 0.35 * R() : 0.1 + 0.2 * R()) : 0, tau = 40 + 80 * R();
  const steps = [];
  for (let k = 1 + Math.floor(R() * 3); k > 0; k--) steps.push([first + Math.floor(R() * (N - first + 1)), (R() < 0.5 + drift ? 1 : -1) * (0.04 + 0.1 * R())]);
  const sd = 0.008 + 0.003 * Math.min(tier, 6), L = new Float64Array(N + 1);
  let e = 0;
  for (let i = first; i <= N; i++) {
    e = 0.82 * e + sd * (R() + R() + R() - 1.5) * 2;
    let s = 0; for (const [d, v] of steps) if (i >= d) s += v;
    const age = (start + i * DAY_MS - rel) / DAY_MS;
    L[i] = (drift * (i - N)) / 365 + (fresh ? hype * Math.exp(-Math.max(0, age) / tau) : 0) + s + e;
  }
  const p = new Float64Array(N + 1), ask = new Float64Array(N + 1);
  let a = 0.2;
  for (let i = first; i <= N; i++) {
    p[i] = i === N ? price : Math.max(0.02, Math.round(price * Math.exp(L[i] - L[N]) * 100) / 100);
    a = 0.8 * a + 0.2 * (R() * 2 - 0.8); // wanders around +4%: a little over market more often than under
    ask[i] = Math.max(0.02, Math.round(p[i] * (1 + 0.18 * a) * 100) / 100);
  }
  for (let i = 0; i < first; i++) { p[i] = p[first]; ask[i] = ask[first]; } // before it existed (never drawn)
  return { p, ask, first };
}
// How much a card moved over the last `days`: "Up 12% in 90 days", or since it came out.
const HIST_SPAN = { 30: "30 days", 90: "90 days", 365: "a year" };
const trendMemo = new Map();
function trendText(c, days) {
  const b = c.base || c, key = `${b.id}|${days}|${b.price}|${histDay(Date.now())}`;
  let t = trendMemo.get(key);
  if (t) return t;
  const h = histOf(c, histMemo.has(b.id)), N = HIST_DAYS, i0 = Math.max(h.first, N - days), from = h.p[i0], pct = from > 0 ? Math.round((h.p[N] / from - 1) * 100) : 0;
  const span = i0 > N - days ? "since it came out" : `in ${HIST_SPAN[days] || `${days} days`}`;
  t = Math.abs(pct) < 1 ? `Steady ${span}` : `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% ${span}`;
  if (trendMemo.size > 5000) trendMemo.clear();
  trendMemo.set(key, t); return t;
}

// ----- the chart: straight lines across, then up or down (a day's price holds until the next), on a black rule -----
// series: [{ v, cls }] drawn in order; returns the markup. Every coordinate is checked finite.
function histChart(series, i0, N, label, cls = "") {
  let lo = Infinity, hi = -Infinity;
  for (const s of series) for (let i = i0; i <= N; i++) { const v = s.v[i]; if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  const pad = Math.max((hi - lo) * 0.12, hi * 0.02, 0.01); lo = Math.max(0, lo - pad); hi += pad;
  const W = 300, H = 100, n = N - i0, fin = (v, d) => (Number.isFinite(v) ? v : d);
  const X = (i) => fin(n > 0 ? ((i - i0) / n) * W : W, W), Y = (v) => clamp(fin(H - ((v - lo) / (hi - lo)) * H, H), 0, H);
  const path = (v) => { let d = `M${X(i0).toFixed(1)} ${Y(v[i0]).toFixed(1)}`; for (let i = i0 + 1; i <= N; i++) d += `H${X(i).toFixed(1)}V${Y(v[i]).toFixed(1)}`; return d; };
  const last = series[series.length - 1].v[N];
  return `<div class="hc ${cls}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}" data-now="${last}">${series.map((s) => `<path class="${s.cls}" d="${path(s.v)}" vector-effect="non-scaling-stroke"/>`).join("")}</svg><i class="hc-now" style="left:${((X(N) / W) * 100).toFixed(2)}%;top:${((Y(last) / H) * 100).toFixed(2)}%" aria-hidden="true"></i></div>`;
}

// ----- the card up close: the chart under the price, 30 days / 90 days / 1 year -----
const pHist = document.getElementById("p-hist"), pTrend = document.getElementById("p-trend"), pChart = document.getElementById("p-chart"), pKey = document.getElementById("p-key");
let histRange = 90, histGraded = false; // the range, and with a slab of the card, whether its grade's ask is drawn
function histPanel(c) {
  if (!c || c.ph) { pHist.hidden = true; return; }
  pHist.hidden = false;
  const b = c.base || c, h = histOf(c), N = HIST_DAYS, i0 = Math.max(h.first, N - histRange), top = topSlab(slabsOf(c)), gr = Boolean(top && histGraded);
  for (const btn of pHist.querySelectorAll("[data-hr]")) btn.setAttribute("aria-pressed", String(Number(btn.dataset.hr) === histRange));
  const when = histDate(i0, histRange > 90);
  let series, label;
  if (gr) { // a slab's ask sits far above the raw card: drawn on its own, not squeezed onto one scale with it
    const g = gradeAsk(b, top.co, top.grade), gv = h.p.map((v) => g * Math.pow(v / h.p[N], GRADE_SWING)); gv[N] = g;
    series = [{ v: gv, cls: "hc-gr" }];
    const pct = gv[i0] > 0 ? Math.round((g / gv[i0] - 1) * 100) : 0, span = trendText(c, histRange).replace(/^(Up|Down|Steady) (\d+% )?/, "");
    pTrend.textContent = `${slabText(top)} ${Math.abs(pct) < 1 ? `steady ${span}` : `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% ${span}`}`;
    label = `${slabText(top)} ask ${money(gv[i0])} on ${when}, ${money(g)} today.`;
  } else {
    series = [{ v: h.ask, cls: "hc-ask" }, { v: h.p, cls: "hc-mkt" }];
    pTrend.textContent = trendText(c, histRange);
    label = `Market price ${money(h.p[i0])} on ${when}, ${money(h.p[N])} today. Lowest eBay ask ${money(h.ask[N])} today.`;
  }
  pChart.innerHTML = histChart(series, i0, N, label) + `<div class="hc-axis" aria-hidden="true"><span>${when}</span><span>Today</span></div>`;
  pKey.innerHTML = (gr ? `<span><i class="k-gr"></i>${esc(slabText(top))} ask ${money(series[0].v[N])}</span>` : `<span><i class="k-mkt"></i>Market</span><span><i class="k-ask"></i>Lowest eBay ask ${money(h.ask[N])}</span>`)
    + (top ? `<span class="seg ph-seg ph-which" role="group" aria-label="Which price"><button type="button" data-hg="0" aria-pressed="${!gr}">Raw</button><button type="button" data-hg="1" aria-pressed="${gr}">${esc(slabText(top))}</button></span>` : "");
}
pHist.addEventListener("click", (e) => {
  const c = state.focus; if (!c) return;
  const b = e.target.closest("[data-hr]"), g = e.target.closest("[data-hg]");
  if (b) histRange = Number(b.dataset.hr) || 90;
  else if (g) histGraded = g.dataset.hg === "1";
  else return;
  tick(3); histPanel(c);
});

// ----- the collection's value over time -----
let valMemo = null;
function valueSeries() {
  const t0 = histDay(Date.now()), now = worthOf(cards);
  let n = 0, gotSum = 0;
  for (const c of cards) if (c.owned) { n++; gotSum += c.got || 0; }
  const key = `${t0}|${n}|${gotSum}|${now}|${gradedVer}`;
  if (valMemo?.key === key) return valMemo;
  const N = HIST_DAYS, pts = new Float64Array(N + 1), adds = new Float64Array(N + 1); // adds: what came in that day, at that day's price
  let first = N;
  for (const c of cards) {
    if (!c.owned) continue;
    const gi = c.got ? clamp(N - Math.round((t0 - histDay(c.got)) / DAY_MS), 0, N) : N;
    if (gi < first) first = gi;
    if (gi >= N) { adds[N] += worthOne(c); continue; }
    const h = histOf(c, histMemo.has(c.id)), w = worthOne(c), slab = slabsOf(c).length > 0, pN = h.p[N];
    for (let i = gi; i < N; i++) { const v = h.p[Math.max(i, h.first)], x = slab ? w * Math.pow(v / pN, GRADE_SWING) : v; pts[i] += x; if (i === gi) adds[i] += x; }
  }
  pts[N] = now; // today is the worth the rest of the app shows, to the cent
  return (valMemo = { key, pts, adds, first, now, n });
}
// The change over a range ("30", "90" or "all"): from its first day (or your first card, if later) to today.
function valueChange(v, range) {
  const N = HIST_DAYS, days = range === "all" ? N : Number(range), i0 = Math.min(N, Math.max(v.first, N - days));
  const from = v.pts[i0], d = v.now - from, pct = from > 0 ? (d / from) * 100 : 0;
  let added = 0; for (let i = i0 + 1; i <= N; i++) added += v.adds[i]; // cards that came in after the range began
  const span = range === "all" || i0 > N - days ? `since ${histDate(i0, true)}` : `in ${days} days`;
  const text = i0 >= N ? "Your cards all came in today, so the line starts here." : Math.abs(d) < 0.005 ? `No change ${span}` : `${d > 0 ? "Up" : "Down"} ${money(Math.abs(d))} (${Math.abs(pct).toFixed(1)}%) ${span}`;
  return { i0, from, d, pct, span, text, added, brief: i0 >= N || Math.abs(d) < 0.5 ? `Steady ${span}` : `${d > 0 ? "Up" : "Down"} ${short(Math.abs(d))} ${span}` };
}
// What you paid (the Got it keypad, 64-chase.js) against what those cards are worth now.
function purchases() {
  const rows = pool.filter((c) => !c.base && c.owned && typeof paid[c.id] === "number").map((c) => ({ c, paid: paid[c.id], now: worthOne(c) })).sort((a, b) => (b.c.got || 0) - (a.c.got || 0));
  const spent = rows.reduce((a, r) => a + r.paid, 0), worth = rows.reduce((a, r) => a + r.now, 0);
  return { rows, spent, worth, diff: worth - spent };
}
const bySet = () => sets.map((st) => ({ st, v: worthOf(st.cards), n: ownedIn(st.cards) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
const signed = (d) => `${d >= 0 ? "+" : "−"}${money(Math.abs(d))}`;

// ----- the Collection value sheet (from Trophies, or the list): production's screen, in the painting -----
const vsheet = document.getElementById("vsheet");
let vsRange = "90";
const VS_RANGES = [["30", "30 days"], ["90", "90 days"], ["all", "All"]];
function renderValue() {
  const v = valueSeries(), ch = valueChange(v, vsRange), N = HIST_DAYS, P = purchases(), sets6 = bySet().slice(0, 6), max = Math.max(1, ...sets6.map((x) => x.v));
  const slabbed = cards.some((c) => c.owned && slabsOf(c).length);
  const keep = vsheet.querySelector(".ls-scroll")?.scrollTop || 0;
  const when = histDate(ch.i0, true);
  vsheet.innerHTML = `<div class="ls-scroll vs-scroll">
    <div class="vs-head"><h2 id="vs-h">Collection value</h2>
      <p class="vs-now"><b id="vs-now">${money(v.now)}</b><small>${v.n.toLocaleString("en-US")} ${v.n === 1 ? "card" : "cards"} at market${slabbed ? ", graded copies at their grade's ask" : ""}</small></p></div>
    <div class="vs-body">
      <div class="seg vs-seg" role="group" aria-label="Range">${VS_RANGES.map(([k, t]) => `<button type="button" data-vr="${k}" aria-pressed="${vsRange === k}">${t}</button>`).join("")}</div>
      <p class="vs-change ${ch.d > 0.004 ? "up" : ch.d < -0.004 ? "down" : ""}" id="vs-change" aria-live="polite">${ch.text}</p>
      ${ch.added >= 0.005 && ch.i0 < N ? `<p class="vs-added">${money(ch.added)} of that came from cards you added, at what they were worth then.</p>` : ""}
      ${histChart([{ v: v.pts, cls: "hc-mkt" }], ch.i0, N, `Worth ${money(ch.from)} on ${when}, ${money(v.now)} today.`, "vs-chart")}
      <div class="hc-axis" aria-hidden="true"><span>${when}</span><span>Today</span></div>
      <p class="vs-note">Earlier days are estimated: each card at its market price that day, counted from the day you got it.</p>
    </div>
    <section class="ls-sec vs-sec"><h3>What you paid</h3>${P.rows.length ? `
      <div class="vs-tiles"><p><b>${money(P.spent)}</b><small>paid for ${P.rows.length} ${P.rows.length === 1 ? "card" : "cards"}</small></p><p><b>${money(P.worth)}</b><small>worth now</small></p><p class="${P.diff >= 0 ? "up" : "down"}"><b>${signed(P.diff)}</b><small>${P.diff >= 0 ? "ahead" : "behind"}</small></p></div>
      <ul class="vs-buys">${P.rows.slice(0, 8).map(({ c, paid: pd, now }) => { const st = sets[c.si]; return `<li><span><b>${esc(c.name)}</b><small>${esc(st.name)} #${esc(c.num)}${c.got ? ` · got ${new Date(c.got).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</small></span><span class="vs-num"><b>${money(now)}</b><small>paid ${money(pd)}, <em class="${now - pd >= 0 ? "up" : "down"}">${signed(now - pd)}</em></small></span></li>`; }).join("")}</ul>
      ${P.rows.length > 8 ? `<p class="vs-more">and ${P.rows.length - 8} more</p>` : ""}` : `<p>When you tap Got it on a card you chase, what you paid shows up here against what it's worth now.</p>`}</section>
    ${sets6.length ? `<section class="ls-sec vs-sec"><h3>Value by set</h3><ul class="vs-bars">${sets6.map((x) => `<li><span class="vb-name">${esc(x.st.name)} <small>${x.n} ${x.n === 1 ? "card" : "cards"}</small></span><b>${short(x.v)}</b><span class="vb-bar" aria-hidden="true"><i style="width:${Math.max(2, Math.round((x.v / max) * 100))}%;background:var(--${dsPrimaryOf(x.st.ink) || "panel-solid"})"></i></span></li>`).join("")}</ul></section>` : ""}
  </div>
  <div class="ls-foot vs-foot"><button type="button" class="mbtn primary" data-vs-close>Done</button></div>`;
  const sc = vsheet.querySelector(".ls-scroll"); if (sc) sc.scrollTop = keep;
}
function openValue() {
  if (document.querySelector("dialog[open]:not(#vsheet)")) return;
  cancelPress();
  vsheet.innerHTML = ""; renderValue();
  if (!vsheet.open) vsheet.showModal();
  vsheet.querySelector(".ls-scroll").scrollTop = 0;
  focusFor(vsheet.querySelector("[data-vs-close]"), vsheet);
  tick(5);
}
function closeValue() { if (vsheet.open) vsheet.close(); }
vsheet.addEventListener("click", (e) => {
  if (e.target === vsheet || e.target.closest("[data-vs-close]")) { closeValue(); return; } // a tap outside the sheet, or Done
  const r = e.target.closest("[data-vr]"); if (r && r.dataset.vr !== vsRange) { vsRange = r.dataset.vr; tick(3); renderValue(); vsheet.querySelector(`[data-vr="${vsRange}"]`)?.focus({ preventScroll: true }); }
});

// ----- the list: the sheet's numbers as text -----
function valueListHTML() {
  if (!cards.some((c) => c.owned)) return "";
  const v = valueSeries(), P = purchases(), top = bySet().slice(0, 6);
  return `<section data-sec="value"><h2>Collection value</h2>
    <p class="lsub">Worth ${money(v.now)} at market, ${v.n.toLocaleString("en-US")} ${v.n === 1 ? "card" : "cards"}. ${VS_RANGES.map(([k]) => valueChange(v, k).text.replace(/\.$/, "")).join(". ")}. Earlier days are estimated from each card's price history.</p>
    ${P.rows.length ? `<p class="lsub">You paid ${money(P.spent)} for ${P.rows.length} ${P.rows.length === 1 ? "card" : "cards"}. ${P.rows.length === 1 ? "It's" : "They're"} worth ${money(P.worth)} now, ${money(Math.abs(P.diff))} ${P.diff >= 0 ? "ahead" : "behind"}.</p>` : ""}
    ${top.length ? `<p class="lsub">By set: ${top.map((x) => `${esc(x.st.name)} ${money(x.v)}`).join(", ")}.</p>` : ""}
    <p class="lsub"><button type="button" class="pill-btn" data-value-open>Open Collection value</button></p></section>`;
}
listEl.addEventListener("click", (e) => { if (e.target.closest("[data-value-open]")) openValue(); });

setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { histOf: { value: histOf }, trendText: { value: trendText }, valueSeries: { value: valueSeries }, valueChange: { value: valueChange }, openValue: { value: openValue }, closeValue: { value: closeValue }, purchases: { value: purchases }, histRange: { get: () => histRange } }); }, 0);
