// ---------- Source: where Card Chaser looks (round 21) ----------
// Production's Source tab, as a room: a switch for each place it looks (switch one off and its listings leave the
// Feed and its counts; the wall still flashes a deal, because a deal is a property of the want), the shops and how
// many listings each gives you, the favourite seller, the import, phone alerts, and the clock: when it last looked,
// when it looks next, what it found this visit. It's the only home of these switches. Mostly words in dev: the looks
// are the demo's arrivals (72-live.js), every nine seconds.

const psBody = document.getElementById("ps-body");
// "Looked 3 s ago · next in 6 s": Source's count line, on its card and its page.
function clockText(brief = false) {
  const t = Date.now(), ago = Math.max(0, Math.round((t - scan.last) / 1000)), left = Math.max(0, Math.round((scan.next - t) / 1000)), chased = cards.some(isChase);
  if (!chased) return brief ? "Waiting for a chase" : "Chase a card and it starts looking.";
  return brief ? (left ? `Next look in ${left} s` : "Looking now") : left ? `Last look ${ago} s ago. Next in ${left} s.` : "Looking now.";
}
function renderSource() {
  if (pgSource.hidden) return;
  const counts = {}; feedList(counts);
  const chased = cards.filter(isChase).length;
  let imp = null; try { imp = localStorage.getItem("wall-imported"); } catch { /* fine */ }
  const owned = cards.filter((c) => c.owned).length;
  const sw = (id, label, on) => `<label class="sw"><input type="checkbox" role="switch" data-src="${id}" aria-label="${esc(label)}"${on ? " checked" : ""}><span aria-hidden="true"></span></label>`;
  const row = (s) => { const on = srcOn(s.id), n = counts[s.id] || 0; return `<li class="src${on ? "" : " off"}" data-row="${s.id}"><span class="src-main"><b>${esc(s.name)}</b><small>${esc(s.line)}.${on && n ? ` ${plural1(n, "listing")} in your Feed.` : ""}</small></span>${sw(s.id, s.name, on)}</li>`; };
  const group = (g) => SRC.filter((s) => s.group === g).map(row).join("");
  psBody.innerHTML = `<div class="src-clock" aria-live="polite"><i class="dot${chased ? "" : " off"}"></i><span><b>${chased ? `Looking for ${plural1(chased, "card")} you chase` : "Nothing to look for yet"}</b><span id="ps-clock">${clockText()}</span><em class="${finds.length ? "" : "none"}" id="ps-finds">${findsText()}</em></span></div>
    <h2>Marketplaces</h2><ul class="srcs">${group("Marketplaces")}</ul>
    <h2>Card shops</h2><ul class="srcs">${group("Card shops")}</ul>
    <h2>Favorite sellers</h2><ul class="srcs"><li class="src"><span class="src-main"><b>${FAV_SELLER} on eBay</b><small>Their newest listings are checked every look, and score 10 higher.</small></span></li></ul>
    <h2>Your collection</h2><ul class="srcs"><li class="src"><span class="src-main"><b>${imp && imp !== "1" ? `${esc(imp)} import` : imp ? "Your import" : "Nothing imported yet"}</b><small>${imp ? `${owned.toLocaleString()} cards on your wall now.` : "Import from TCGplayer or Collectr when you start, or pick your sets in Settings."}</small></span></li></ul>
    <h2>Alerts</h2><ul class="srcs"><li class="src${srcState.alerts ? "" : " off"}"><span class="src-main"><b>Phone alerts</b><small>A listing that scores 75 or more pings your phone. In the demo it's a line at the top.</small></span>${sw("alerts", "Phone alerts", srcState.alerts)}</li></ul>
    <p class="rp-note">The listings here are made up for the demo.</p>`;
}
const findsText = () => (finds.length ? `${plural1(finds.length, "find")} this visit. Latest: ${finds[0].L.c.name} ${short(finds[0].L.price)} on ${openOn(finds[0].L)}.` : "No finds yet this visit.");
// The clock ticks while Source is up (its line only), and a find lights the row it came from.
function syncSourceClock() {
  if (pgSource.hidden) return;
  const el = document.getElementById("ps-clock"); if (el) el.textContent = clockText();
}
setInterval(syncSourceClock, 1000);
function sourceFound(L) {
  if (pgSource.hidden) return;
  renderSource();
  const row = psBody.querySelector(`[data-row="${L.src}"]`);
  if (row && !reduced) { row.classList.remove("lit"); void row.offsetWidth; row.classList.add("lit"); }
}
// A switch, on the page or in the list view.
function sourceSwitch(x) {
  tick(4);
  if (x.dataset.src === "alerts") { srcState.alerts = x.checked; toast(srcState.alerts ? "Phone alerts on." : "Phone alerts off."); }
  else { const s = SRC_BY.get(x.dataset.src); if (x.checked) srcState.off.delete(s.id); else srcState.off.add(s.id); toast(x.checked ? `${s.name} on. Its listings are back in your Feed.` : `${s.name} off. Its listings leave your Feed.`); }
  saveSources(); renderSource(); renderFeed(); syncBadge(); drawList(); kick();
}
for (const el of [pgSource, listEl]) el.addEventListener("change", (e) => { const x = e.target.closest("[data-src]"); if (x) sourceSwitch(x); });
// The list view's Source section: the same switches.
function sourceListHTML() {
  const counts = {}; feedList(counts);
  return `<section data-sec="source"><h2>Source</h2><p class="lsub">Where Card Chaser looks for the cards you chase. ${clockText()}</p><ul>${[...SRC, { id: "alerts", name: "Phone alerts", line: "A listing that scores 75 or more pings your phone" }].map((s) => {
    const on = s.id === "alerts" ? srcState.alerts : srcOn(s.id);
    return `<li class="lwrow"><label class="lrow lsrc"><span class="lname">${esc(s.name)}</span><span class="lmeta">${esc(s.line)}${s.id !== "alerts" && counts[s.id] ? `. ${plural1(counts[s.id], "listing")}` : ""}</span><span class="lstate">${on ? "On" : "Off"}</span><input type="checkbox" role="switch" data-src="${s.id}"${on ? " checked" : ""}></label></li>`;
  }).join("")}</ul></section>`;
}
