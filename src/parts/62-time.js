// ---------- time: scrub or play through when you got each card ----------
const T_MIN = Math.min(...cards.filter((c) => c.got).map((c) => c.got)) - 30 * 86400e3, T_MAX = () => Date.now();
const tRange = document.getElementById("t-range"), tWhen = document.getElementById("t-when"), tCount = document.getElementById("t-count"), tPlay = document.getElementById("t-play");
state.t = Date.now();
let lastMonth = "", playing = null;
function setT(t, { user = false } = {}) {
  state.t = clamp(t, T_MIN, T_MAX());
  const p = (state.t - T_MIN) / (T_MAX() - T_MIN);
  tRange.value = String(Math.round(p * 1000)); tRange.style.setProperty("--p", `${p * 100}%`);
  const m = monthOf(state.t);
  if (m !== lastMonth) { if (user || playing) tick(3); lastMonth = m; } // a soft detent each month
  const n = cards.filter((c) => c.owned && c.got && c.got <= state.t).length;
  tWhen.textContent = p > 0.995 ? "Now" : m; tCount.textContent = `${n.toLocaleString()} cards`;
  updateCount(); kick();
}
function playTime(fromStart = false) {
  if (reduced) { setT(T_MAX()); return; }
  const from = fromStart || state.t >= T_MAX() - 86400e3 ? T_MIN : state.t;
  playing = { t0: performance.now(), from, dur: 7200 * (T_MAX() - from) / (T_MAX() - T_MIN) };
  tPlay.setAttribute("aria-label", "Pause"); tPlay.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13M16 5.5v13" stroke-width="3"/></svg>';
  const stepT = (now) => {
    if (!playing) return;
    const p = clamp((now - playing.t0) / playing.dur, 0, 1);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    setT(playing.from + (T_MAX() - playing.from) * e);
    if (p < 1) requestAnimationFrame(stepT); else stopTime();
  };
  requestAnimationFrame(stepT);
}
function stopTime() {
  playing = null;
  tPlay.setAttribute("aria-label", "Play your collection's story"); tPlay.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
}
// The growth curve behind the slider: how many cards you had, over time.
function drawSpark() {
  const dates = cards.filter((c) => c.owned && c.got).map((c) => c.got).sort((a, b) => a - b);
  const N = 120, span = T_MAX() - T_MIN, pts = [];
  let k = 0;
  for (let i = 0; i <= N; i++) { const t = T_MIN + span * i / N; while (k < dates.length && dates[k] <= t) k++; pts.push([i / N * 1000, 40 - (k / Math.max(1, dates.length)) * 38]); }
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  document.getElementById("t-line").setAttribute("d", line);
  document.getElementById("t-area").setAttribute("d", `${line}L1000,40L0,40Z`);
}
tPlay.onclick = () => (playing ? stopTime() : playTime());
tRange.addEventListener("input", () => { stopTime(); setT(T_MIN + (T_MAX() - T_MIN) * Number(tRange.value) / 1000, { user: true }); });
