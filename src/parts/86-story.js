// ---------- the import plays your collection's story (round 20) ----------
// When the import carries the date you got each card, the wall assembles in that order: the clock runs from your first
// card to today (quiet months go by fast, a busy day slows it), every card blooms into its pocket as the clock passes
// the day you got it, and the date ticks along the bottom over the collection's growth curve. The moments land as they
// happened, each holding the clock for a beat: your first card, your biggest day, your first spare, the hundredth
// Pokémon, a set finishing, your first trophy and the first lucky one. Every other trophy drops in on its date without
// stopping the clock (its panel says its name in gold, the tally counts up, the Medal room's count follows).
// The wall follows where cards are landing, gently, and is home at the top before today; then the import's summary
// comes up (87-arrival.js). About 15 seconds.
//
// It's the collection itself replaying: a card is really yours from the moment the clock passes it (c.owned), so every
// count, bar and panel follows without being told. Everything is saved before it starts, so reloading half way loses
// nothing. A touch anywhere (or the wheel, or a key) jumps to the end at once and carries on as the gesture it was;
// Skip (or Escape) goes straight to the summary. With reduced motion the moments step by as stills.
// Afterwards the Time filter keeps the story: its moments sit on the slider as gold dots, and passing one says it.

const ST = { MOVE: 8000, HOLD: 1100, FIRST: 1500, BIG: 2000, TAIL: 1700, STILL: 2300 };
const monthLong = (t) => new Date(t).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const dayLong = (t) => new Date(t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const stPlural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
let story = null; // while it plays: the schedule, where each list has got to, and what's on screen

// ----- the overlay: along the bottom, the moment above one line of date and tally, and the growth curve -----
const stEl = document.createElement("section");
stEl.className = "story"; stEl.setAttribute("aria-label", "Your collection's story");
stEl.innerHTML = `<div class="st-in">
  <div class="st-moment glass" id="st-moment" aria-live="polite"><span class="st-pic" id="st-pic" aria-hidden="true"></span><span class="st-text"><small class="st-kick" id="st-kick"></small><b id="st-title"></b><span id="st-sub"></span></span></div>
  <div class="st-row"><b class="st-date" id="st-date" aria-hidden="true"></b><span class="st-tally" aria-hidden="true"><span id="st-n"></span><span class="st-meds"><span class="st-med" id="st-med"></span><span id="st-mn"></span></span></span></div>
  <div class="st-curve" aria-hidden="true"><svg viewBox="0 0 1000 40" preserveAspectRatio="none"><defs><clipPath id="st-clip"><rect id="st-clipr" x="0" y="-4" width="0" height="48"/></clipPath></defs><path class="st-track" d="M0,39.5H1000"/><g clip-path="url(#st-clip)"><path class="st-area" id="st-area"/><path class="st-line" id="st-line"/></g></svg><span class="st-dots" id="st-dots"></span><i class="st-head" id="st-head"></i></div>
</div>`;
document.body.append(stEl);
const stSkip = document.createElement("button");
stSkip.type = "button"; stSkip.className = "st-skip glass"; stSkip.textContent = "Skip";
document.body.append(stSkip);
const $s = (id) => stEl.querySelector(`#${id}`);
const stMoment = $s("st-moment"), stPic = $s("st-pic"), stKick = $s("st-kick"), stTitle = $s("st-title"), stSub = $s("st-sub"), stDate = $s("st-date");
const stClip = $s("st-clipr"), stArea = $s("st-area"), stLine = $s("st-line"), stDots = $s("st-dots"), stHead = $s("st-head"), stN = $s("st-n"), stMed = $s("st-med"), stMn = $s("st-mn");

// ----- the moments: worked out from the collection (the import's, or whatever you have when Time comes on) -----
// own: the cards you have, oldest first. meds: the trophies with the date each came true, oldest first.
function storyMoments(own, meds) {
  const out = [];
  if (!own.length) return out;
  const first = own[0];
  out.push({ at: first.got, kind: "first", hold: ST.FIRST, kick: "Your first card", title: first.name, sub: `${sets[first.si].name}, ${monthLong(first.got)}`, c: first });
  // Big days: a dozen cards or more on one day (the old binder turning up). The moment is the end of the day.
  const byDay = new Map();
  for (const c of own) { const k = dayKey(c.got); let d = byDay.get(k); if (!d) byDay.set(k, (d = [])); d.push(c); }
  [...byDay.values()].filter((d) => d.length >= 12).sort((a, b) => b.length - a.length).slice(0, 2).forEach((d, i) => {
    const last = d.reduce((a, c) => (c.got > a.got ? c : a)), from = new Set(d.map((c) => c.si));
    out.push({ at: last.got, kind: "day", day: d, hold: ST.BIG, kick: i ? "Another big day" : "Your biggest day", title: `${d.length.toLocaleString()} cards in one day`, sub: `${dayLong(last.got)}, from ${from.size === 1 ? sets[[...from][0]].name : `${from.size} sets`}`, c: d[0] });
  });
  const sp = own.find((c) => nOf(c) > 1);
  if (sp) out.push({ at: sp.got, kind: "spare", kick: "Your first spare", title: sp.name, sub: `${nOf(sp)} copies, ${sets[sp.si].name}. It's up for trade.`, c: sp });
  const seen = new Set();
  for (const c of own) {
    if (!c.dex || seen.has(c.dex)) continue;
    seen.add(c.dex);
    if (seen.size === 100) { out.push({ at: c.got, kind: "dex", kick: "100 different Pokémon", title: c.name, sub: `The hundredth, ${sets[c.si].name}, ${monthLong(c.got)}`, c }); break; }
  }
  // A set finishing: the day its last card came in (its plaque mints right there, see storyMoment).
  for (const g of groups) {
    if (!g.set || !g.base?.length || !g.base.every((c) => c.owned && c.got)) continue;
    const at = Math.max(...g.base.map((c) => c.got));
    out.push({ at, kind: "set", hold: ST.BIG, kick: "Set complete", title: trophyName(g), sub: `${stPlural(g.base.length, "card")}, finished ${dayLong(at)}`, g });
  }
  // Trophies that get the stage: your first, and the first lucky one. The rest drop in without stopping the clock.
  let luck = false;
  meds.forEach((m, i) => {
    const lucky = Boolean(MD_RANK[m.t.rank]);
    if (i && (!lucky || luck)) return;
    luck ||= lucky;
    out.push({ at: m.at, kind: "medal", t: m.t, kick: m.t.rank === "shiny" ? "A shiny trophy" : lucky ? "A critical trophy" : "Your first trophy", title: m.t.name, sub: `${m.t.chase}, ${monthLong(m.at)}${lucky ? `. A 1 in ${m.t.rank === "shiny" ? 100 : 10} roll` : ""}` });
  });
  // Whatever else happened on a big day comes after the day itself: the burst first, then what it brought.
  for (const d of out.filter((m) => m.kind === "day")) {
    const k = dayKey(d.at);
    for (const m of out) if (m !== d && m.kind !== "day" && dayKey(m.at) === k) { m.at = Math.max(m.at, d.at); m.after = 1; }
  }
  return out.sort((a, b) => a.at - b.at || (a.after || 0) - (b.after || 0));
}
// The trophies as dated records. Trophy Cabinet and Crown Collector count other trophies, so they came true on the day
// the 25th (or the 5th signature one) did.
function datedMedals(list) {
  const byAt = (a, b) => a.at - b.at;
  const rest = list.filter((t) => t.id !== "g:trophy-cabinet" && t.id !== "g:crown-collector").sort(byAt);
  for (const t of list) {
    const pick = t.id === "g:trophy-cabinet" ? rest[24] : t.id === "g:crown-collector" ? rest.filter((x) => x.sig)[4] : null;
    if (pick && pick.at < t.at) { t.at = pick.at; if (mdStore[t.id]) mdStore[t.id].at = pick.at; }
  }
  if (list.length) mdPersist();
  return list.map((t) => ({ t, at: t.at || Date.now() })).sort(byAt);
}
// Does a list of imported cards carry real dates? (An import without them lands every card on one day.)
const hasDates = (list) => { const days = new Set(); for (const c of list) if (!c.of && c.got) { days.add(dayKey(c.got)); if (days.size > 1) return true; } return false; };

// ----- the schedule: real time against calendar time -----
// Each day weighs 1, plus more for every card that came in that day (so a busy day slows the clock), and each moment
// holds the clock for a beat. K is a list of [real ms, calendar time] points; both columns only go up.
function storySchedule(S) {
  const DAYMS = 86400e3, N = Math.max(1, Math.ceil((S.T1 - S.T0) / DAYMS));
  const cnt = new Float64Array(N);
  for (const c of S.order) if (!c.of) cnt[clamp(Math.floor((c.got - S.T0) / DAYMS), 0, N - 1)]++;
  const w = Array.from(cnt, (n) => 1 + 5 * Math.sqrt(n)), W = w.reduce((a, b) => a + b, 0);
  const K = [[0, S.T0]];
  let r = 0, mi = 0;
  for (let d = 0; d < N; d++) {
    const d0 = S.T0 + d * DAYMS, d1 = Math.min(S.T1, d0 + DAYMS), per = (ST.MOVE * w[d]) / W / DAYMS;
    let h = 0;
    while (mi < S.moms.length && S.moms[mi].at < d1) {
      const m = S.moms[mi++], tm = clamp(m.at, d0, d1), rm = r + h + per * (tm - d0);
      K.push([rm, tm]); m.sAt = rm; h += m.hold || ST.HOLD; K.push([r + h + per * (tm - d0), tm]);
    }
    r += h + per * (d1 - d0);
    K.push([r, d1]);
  }
  for (; mi < S.moms.length; mi++) S.moms[mi].sAt = r; // anything dated after now (it shouldn't be) lands at the end
  S.K = K; S.total = r;
}
// When the clock passes calendar time t (the first point at or after it, so a card on a moment's day blooms before the hold).
function realOf(K, t) {
  let lo = 0, hi = K.length - 1;
  if (t <= K[0][1]) return K[0][0];
  if (t >= K[hi][1]) return K[hi][0];
  while (lo < hi) { const m = (lo + hi) >> 1; if (K[m][1] >= t) hi = m; else lo = m + 1; }
  const a = K[lo - 1], b = K[lo];
  return b[1] === a[1] ? b[0] : a[0] + (b[0] - a[0]) * (t - a[1]) / (b[1] - a[1]);
}
function calOf(K, r) {
  let lo = 0, hi = K.length - 1;
  if (r <= K[0][0]) return K[0][1];
  if (r >= K[hi][0]) return K[hi][1];
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (K[m][0] <= r) lo = m; else hi = m - 1; }
  const a = K[lo], b = K[lo + 1];
  return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (r - a[0]) / (b[0] - a[0]);
}

// ----- playing it (the import has marked and saved everything; P is what it brought, see reveal in 87-arrival.js) -----
function startStory(P) {
  if (state.time) setTime(false);
  if (state.lens !== "have") { setLens("have"); toastEl.classList.remove("show"); }
  if (state.trans) finishTransition();
  const S = { P, meds: P.meds };
  S.order = P.got.slice().sort((a, b) => a.got - b.got);
  const own = cards.filter((c) => c.owned && c.got).sort((a, b) => a.got - b.got);
  S.moms = storyMoments(own, S.meds);
  S.T1 = Date.now();
  S.T0 = S.order[0]?.got ?? S.T1; // the clock starts on your first card: the wall is never an empty "0 cards"
  storySchedule(S);
  // The last stretch comes home to the top, and the story waits until it is there.
  const lastMom = Math.max(0, ...S.moms.map((m) => m.sAt + (m.hold || ST.HOLD)));
  S.tailAt = Math.max(S.total - ST.TAIL - 250, lastMom);
  S.total = Math.max(S.total, S.tailAt + ST.TAIL + 250);
  for (const c of S.order) c.sAt = realOf(S.K, c.got);
  for (const m of S.meds) m.sAt = realOf(S.K, m.at);
  // Back to before the first card: the cards and trophies come back as the clock passes them. The trophies wait in
  // S.held, which is still what's saved (mdPersist), so a reload half way finds them all.
  for (const c of S.order) { c.owned = false; c.anim = null; }
  S.held = {};
  for (const m of S.meds) { S.held[m.t.id] = mdStore[m.t.id]; delete mdStore[m.t.id]; }
  mdVer++;
  S.oi = 0; S.mi = 0; S.mo = 0; S.cards = 0; S.landed = []; S.shown = null; S.hideAt = 0; S.month = ""; S.fy = null; S.acc = 0; S.accN = 0; S.lastNow = 0; S.home = null;
  story = S;
  mScroll = 0; layoutAll();
  stCurve(S);
  stN.textContent = ""; stMn.textContent = ""; stMed.innerHTML = "";
  stEl.classList.add("on"); document.body.classList.add("storying");
  const now = performance.now();
  S.t0 = now;
  if (reduced) { S.still = true; S.step = 0; stillNext(); }
  else { storyFrame(now); }
  tick(14); kick();
}
// One step per frame.
function storyFrame(now) {
  const S = story;
  if (!S || S.still) return;
  const el = now - S.t0, dt = Math.min(48, now - (S.lastNow || now)); S.lastNow = now;
  while (S.oi < S.order.length && S.order[S.oi].sAt <= el) stBloom(S, S.order[S.oi++], now);
  while (S.mi < S.meds.length && S.meds[S.mi].sAt <= el) stLand(S, S.meds[S.mi++], now);
  while (S.mo < S.moms.length && S.moms[S.mo].sAt <= el) storyMoment(S, S.moms[S.mo++], now);
  stClock(S, calOf(S.K, el));
  if (S.shown && el > S.hideAt) { stMoment.classList.remove("show"); S.shown = null; }
  stCamera(S, dt, el);
  if (el >= S.total) { storyEnd("end"); return; }
  kick();
  requestAnimationFrame(storyFrame);
}
// A card comes in: yours from now, flooding into its pocket as a mark does.
function stBloom(S, c, now) {
  c.owned = true;
  if (!reduced) { c.anim = { t0: now, to: true }; for (const t of twinsOf(c)) t.anim = { t0: now, to: true }; }
  if (c.of) return;
  S.cards++;
  if (c.m && groups[c.g]?.cards.includes(c)) { S.acc += c.m.y + c.m.h / 2; S.accN++; }
}
// A trophy comes true: back in the store (so the Medal room and its count follow), its name in gold on its panel.
function stLand(S, m, now) {
  const had = medalCount();
  if (S.held[m.t.id]) { mdStore[m.t.id] = S.held[m.t.id]; delete S.held[m.t.id]; }
  mdVer++; S.landed.push(m.t);
  if (!had && !state.trans) layoutAll(); // the first trophy changes the wall's shape (a finished set leaves it)
  const g = m.t.open ? mdGroupOf(m.t.open) : null;
  if (g && !reduced) g.beat = { t0: now, text: m.t.name, col: theme.gold };
  stMed.innerHTML = medalSvg(m.t); stMed.classList.remove("pop"); void stMed.offsetWidth; stMed.classList.add("pop");
  stMn.textContent = String(S.landed.length);
}
// A moment: the line at the bottom, and the wall marks it where it happened.
function storyMoment(S, m, now) {
  stShow(m);
  S.hideAt = m.sAt + (m.hold || ST.HOLD) + 900;
  S.focus = null;
  if (m.kind === "day") {
    stPic.innerHTML = `<i class="st-card st-stack" style="--tc:${typeColor(m.c)}"><em>${m.day.length.toLocaleString()}</em></i>`; stPic.className = "st-pic";
    if (!reduced) { // a gold wave through every panel the day touched, each saying how many
      const per = new Map();
      for (const c of m.day) per.set(groups[c.g], (per.get(groups[c.g]) || 0) + 1);
      for (const [g, n] of per) { if (!g?.set || n < 3) continue; const c0 = m.day.find((c) => groups[c.g] === g); g.ripple = { t0: now, col: c0.col, row: c0.row, live: true, gold: true }; g.beat = { t0: now, text: `+${n} in a day`, col: theme.gold }; }
    }
  } else if (m.c) {
    const c = m.c;
    if (!reduced) { c.flash = { t0: now, gold: true }; for (const t of twinsOf(c)) t.flash = { t0: now, gold: true }; }
    if (c.m) S.focus = { y: c.m.y + c.m.h / 2, until: m.sAt + (m.hold || ST.HOLD) };
  }
  if (m.kind === "medal") { const g = m.t.open ? mdGroupOf(m.t.open) : null; if (g?.m) S.focus = { y: g.m.y + 40, until: m.sAt + ST.HOLD }; }
  if (m.kind === "set") { syncDone(); if (m.g?.m) S.focus = { y: m.g.m.y + 40, until: m.sAt + ST.BIG }; }
  tick(m.kind === "medal" && MD_RANK[m.t.rank] ? 30 : 10);
}
function stShow(m) {
  stPicFor(m);
  stKick.textContent = m.kick; stTitle.textContent = m.title; stSub.textContent = m.sub;
  stMoment.className = `st-moment glass${m.t?.rank === "shiny" ? " shiny" : m.t?.rank === "crit" ? " crit" : ""}`;
  void stMoment.offsetWidth; stMoment.classList.add("show");
  if (story) story.shown = m;
}
// The moment's picture: the medal, or the card as a small chip in its colours.
function stPicFor(m) {
  if (m.t) { stPic.innerHTML = medalSvg(m.t); stPic.className = "st-pic medal"; return; }
  if (m.c) { stPic.innerHTML = `<i class="st-card${artIn(m.c, 28) ? " pic" : ""}" style="--tc:${typeColor(m.c)}">${artImg(m.c, 28)}<em>${mdEsc(sets[m.c.si].code)} ${mdEsc(m.c.num)}</em></i>`; stPic.className = "st-pic"; return; }
  if (m.g) { stPic.innerHTML = `<i class="st-plaque" style="--tc:${m.g.ink}"></i>`; stPic.className = "st-pic"; return; }
  stPic.innerHTML = `<i class="st-card st-stack" style="--tc:var(--ink)"></i>`; stPic.className = "st-pic";
}
// The date, the curve's playhead and the count.
function stClock(S, t) {
  const m = monthLong(t);
  if (m !== S.month) { S.month = m; stDate.textContent = m; }
  const p = clamp((t - S.T0) / Math.max(1, S.T1 - S.T0), 0, 1);
  stClip.setAttribute("width", (p * 1000).toFixed(1)); stHead.style.left = `${(p * 100).toFixed(2)}%`;
  for (const d of S.dots) if (!d.on && d.at <= t) { d.on = true; d.el.classList.add("on"); }
  if (S.cards !== S.shownN) { S.shownN = S.cards; stN.textContent = stPlural(S.cards, "card"); stCountText(); }
}
// The growth curve over the story's span, revealed as the clock goes; the moments are dots on it.
function stCurve(S) {
  const dates = S.order.filter((c) => !c.of).map((c) => c.got), N = 160, span = Math.max(1, S.T1 - S.T0), pts = [];
  let k = 0;
  for (let i = 0; i <= N; i++) { const t = S.T0 + span * i / N; while (k < dates.length && dates[k] <= t) k++; pts.push([i / N * 1000, 39 - (k / Math.max(1, dates.length)) * 36]); }
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  stLine.setAttribute("d", line); stArea.setAttribute("d", `${line}L1000,40L0,40Z`); stClip.setAttribute("width", "0");
  stDots.innerHTML = ""; S.dots = [];
  for (const m of S.moms) {
    const p = (m.at - S.T0) / span, i = dates.findIndex((d) => d > m.at), have = i < 0 ? dates.length : i;
    const el = document.createElement("i"); el.style.left = `${(p * 100).toFixed(2)}%`; el.style.bottom = `${(have / Math.max(1, dates.length)) * 90}%`;
    stDots.append(el); S.dots.push({ at: m.at, el, on: false });
  }
}
// The count at the top, without the work updateCount does (the medals wait for the story; see scheduleMedals).
const stCountText = () => { document.getElementById("count").textContent = `${cards.filter((c) => c.owned).length.toLocaleString()} of ${TOTAL.toLocaleString()}`; };
// The camera drifts, slowly, toward where the cards are landing (and to a moment while it holds), then comes home to
// the top before today. A finger ends all this.
function stCamera(S, dt, el) {
  if (view !== "mosaic" || state.trans || gesture || room.on) return;
  if (el > S.tailAt) {
    if (!S.home) S.home = { from: mScroll, t0: el };
    mScroll = S.home.from * (1 - ease(clamp((el - S.home.t0) / ST.TAIL, 0, 1)));
    return;
  }
  if (S.accN) { const y = S.acc / S.accN; S.fy = S.fy == null ? y : S.fy + (y - S.fy) * Math.min(1, S.accN * 0.05); S.acc = 0; S.accN = 0; }
  const f = S.focus && el < S.focus.until ? S.focus.y : S.fy;
  if (f == null) return;
  const want = clamp(f - (vh - 150) * 0.45, 0, mMax), d = want - mScroll;
  if (Math.abs(d) < 0.5) return;
  mScroll += clamp(d * Math.min(1, dt / 2000), -0.2 * dt, 0.2 * dt); // never faster than a slow scroll
}

// ----- reduced motion: the moments as stills -----
function stillNext() {
  const S = story;
  if (!S || !S.still) return;
  const m = S.moms[S.step++];
  if (!m) { storyEnd("end"); return; }
  const now = performance.now();
  while (S.oi < S.order.length && S.order[S.oi].got <= m.at) stBloom(S, S.order[S.oi++], now);
  while (S.mi < S.meds.length && S.meds[S.mi].at <= m.at) stLand(S, S.meds[S.mi++], now);
  storyMoment(S, m, now);
  stClock(S, m.at); stDate.textContent = m.kind === "day" ? dayLong(m.at) : monthLong(m.at); S.month = "";
  if (m.c?.m || m.g?.m) { const y = m.c?.m ? m.c.m.y + m.c.m.h / 2 : m.g.m.y + 40; mScroll = clamp(y - (vh - 150) * 0.45, 0, mMax); }
  kick();
  S.timer = setTimeout(stillNext, ST.STILL);
}

// ----- the end: today, the wall whole -----
// how: "end" (played through), "skip" (Skip or Escape: straight to the summary), "touch" (a finger, the wheel or a key
// took over: the wall is yours at once, and the summary waits behind a toast).
function storyEnd(how) {
  const S = story;
  if (!S) return;
  clearTimeout(S.timer);
  for (; S.oi < S.order.length; S.oi++) { const c = S.order[S.oi]; c.owned = true; c.anim = null; for (const t of twinsOf(c)) t.anim = null; }
  for (const id of Object.keys(S.held)) mdStore[id] = S.held[id];
  S.held = {};
  mdVer++; mdPersist();
  story = null;
  layoutAll(); updateCount(); drawList();
  const sync = syncDone({ quiet: true });
  if (lifted && !sync) liftLayout(true);
  stEl.classList.remove("on"); document.body.classList.remove("storying"); stMoment.classList.remove("show");
  if (how !== "touch") { if (view === "mosaic" && !room.on) mScroll = 0; }
  kick();
  arrived(S.P, how);
}
// A touch anywhere jumps to the end (and carries on as the gesture it was).
function stInterrupt(e) {
  if (!story || e.target?.closest?.(".st-skip")) return;
  storyEnd("touch");
}
addEventListener("touchstart", stInterrupt, { capture: true, passive: true });
addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") stInterrupt(e); }, true);
addEventListener("wheel", stInterrupt, { capture: true, passive: true });
addEventListener("keydown", (e) => {
  if (!story || e.key === "Tab" || e.target === stSkip) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); storyEnd("skip"); return; }
  stInterrupt(e);
}, true);
stSkip.onclick = () => storyEnd("skip");

// ----- afterwards: the Time filter keeps the story -----
// Its moments sit on the slider as gold dots (when the import carried dates); passing one says it above the bar.
const tBar = document.querySelector(".timebar"), tMarks = document.createElement("span"), tMom = document.createElement("div");
tMarks.className = "t-marks"; tMarks.setAttribute("aria-hidden", "true");
tMom.className = "t-mom glass"; tMom.setAttribute("aria-live", "polite");
tBar.querySelector(".tr").append(tMarks); tBar.append(tMom);
let timeMoms = [], tMomOn = null;
const importDated = () => { try { return localStorage.getItem("wall-dated") === "1"; } catch { return false; } };
// Called by drawSpark (62-time.js): the moments, from whatever you have now.
function storyMarks() {
  timeMoms = [];
  if (importDated()) {
    const own = cards.filter((c) => c.owned && c.got).sort((a, b) => a.got - b.got);
    const meds = medalList().earned.filter((t) => t.at).map((t) => ({ t, at: t.at })).sort((a, b) => a.at - b.at);
    timeMoms = storyMoments(own, meds);
  }
  const span = T_MAX() - tMin();
  tMarks.innerHTML = timeMoms.map((m) => `<i style="left:${(clamp((m.at - tMin()) / span, 0, 1) * 100).toFixed(2)}%"></i>`).join("");
  tMomOn = null; tMom.classList.remove("show");
}
// Called by setT: the latest moment at or before the slider, while the slider is within a few weeks' worth of track after it.
function timeMoment() {
  const span = T_MAX() - tMin(), near = span * 0.035;
  let hit = null;
  for (const m of timeMoms) { if (m.at > state.t) break; if (state.t - m.at <= near && (!hit || m.at > hit.at)) hit = m; }
  if (hit === tMomOn) return;
  tMomOn = hit;
  if (!hit) { tMom.classList.remove("show"); return; }
  tMom.innerHTML = `<small>${mdEsc(hit.kick)}</small><b>${mdEsc(hit.title)}</b><span>${mdEsc(hit.sub)}</span>`;
  tMom.classList.add("show");
  if (hit.c && !reduced && view === "mosaic") { hit.c.flash = { t0: performance.now(), gold: true }; kick(); }
}

// Debug builds only: the story, for the tests and the screenshots.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { story: { get: () => story }, storyEnd: { value: storyEnd }, storyMoments: { value: storyMoments }, timeMoms: { get: () => timeMoms }, setT: { value: setT }, setTime: { value: setTime } }); }, 0);
