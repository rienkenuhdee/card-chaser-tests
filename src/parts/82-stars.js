// ---------- favorites and priority stars (parity 4) ----------
// Production's two stars, lean. Favorites: up to five cards you own, your showcase, chosen with ☆ on the card up
// close and shown first, large, in Show mode of the trade binder (78-trade-binder.js), never offered for trade. A sixth
// takes the oldest one's place, and the message names it with Undo. Priority: ★ on a card you chase, on the card up
// close or a Feed row. It leads the Chase lens, its listings score a little higher (production's +4), and the Feed's
// Filters can show only those. State and the read helpers are in 64-chase.js; Reset clears both.
const starBtn = document.getElementById("p-star");
function starPanel(c) {
  if (!c) return;
  const own = (c.base || c).owned, chase = !own && isChase(c);
  starBtn.hidden = !own && !chase;
  if (starBtn.hidden) return;
  const on = own ? isFav(c) : isPrio(c), word = own ? "Favorite" : "Priority";
  starBtn.textContent = `${on ? "★" : "☆"} ${word}`;
  starBtn.classList.toggle("on", on);
  starBtn.setAttribute("aria-pressed", String(on));
  starBtn.title = own ? (on ? "A favorite: first in Show mode" : "Make it a favorite") : (on ? "Priority: first on your chase list" : "Make it a priority");
}
starBtn.onclick = () => { const c = state.focus; if (!c) return; if ((c.base || c).owned) toggleFav(c); else togglePrio(c); };
function starsChanged() {
  if (state.focus) starPanel(state.focus);
  if (bnd.on) tbSync();
  drawList(); kick();
}
function toggleFav(c) {
  const b = c.base || c; if (!b.owned) return;
  const cur = favCards(), was = favs.slice();
  tick(cur.includes(b) ? 4 : 8);
  if (cur.includes(b)) { favs = cur.filter((x) => x !== b).map((x) => x.id); toast(`${b.name} isn't a favorite any more.`); }
  else if (cur.length >= FAV_MAX) { // a sixth: it takes the oldest one's place, and Undo puts that back
    const old = cur[0];
    favs = [...cur.slice(1), b].map((x) => x.id);
    toast(`Five favorites at most. ${b.name} replaces ${old.name}, your oldest.`, () => { favs = was; persistStars(); starsChanged(); });
  } else { favs = [...cur, b].map((x) => x.id); toast(`${b.name} is a favorite. It's first in Show mode.`); }
  persistStars(); starsChanged();
}
function togglePrio(c) {
  const b = c.base || c; if (!isChase(b)) return;
  const on = !prio[b.id];
  if (on) prio[b.id] = true; else delete prio[b.id];
  persistStars(); tick(on ? 8 : 4);
  toast(on ? `${b.name} is a priority. It goes first.` : `${b.name} isn't a priority any more.`);
  if (lifted) liftLayout(true);
  renderFeed(); syncBadge(); starsChanged();
}
// The ★ on a Feed row: beside the row's button, not inside it.
const prioBtnHTML = (c) => { const on = isPrio(c); return `<button type="button" class="fd-star${on ? " on" : ""}" data-prio="${esc(c.id)}" aria-pressed="${on}" aria-label="${on ? "Priority" : "Make it a priority"}: ${esc(c.name)}">${on ? "★" : "☆"}</button>`; };

// Debug builds only: the tests' hook sees the stars.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { favCards: { value: favCards }, isFav: { value: isFav }, isPrio: { value: isPrio }, toggleFav: { value: toggleFav }, togglePrio: { value: togglePrio }, tbPageItems: { value: (i, show) => tbPageItems(i, show) } }); }, 0);
