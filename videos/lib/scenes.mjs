// The scenes' building blocks, on the real app: its routes, its element ids, and the words it draws on its canvas.
//   Routes (wall/src/data/live/routes.js): #collection is the wall; #chases/set%3A<id> opens a printed set.
//   The + menu (99-add.js): #add, then #add-menu [data-add=set] opens Add a set (#chase-sheet); #cs-own is Make your
//   own set, #cs-q its Pokémon field, a .cs-chip names the Pokémon, #cs-save is "Put it on the wall", #cs-close closes it.
//   A card up close (52-focus.js, 99-links.js): #panel with #p-name, #p-own ("I have it" when it's missing), and
//   #p-buy ("View offers in Find · N ›"). Find's answer (92-find-answer.js): #fa, a deal's "N% under" is .fa-under.
import { VIEW, sleep, beat } from "./session.mjs";
import { log, Fail } from "./log.mjs";

/** Back to the wall, at its top, settled. (A reload: the cleanest way to the wall from anywhere.) */
export async function toWall(S) {
  await S.open("#collection");
  await S.settled("The Wall");
}

/** From the wall: the panel titled `re` in view (not yet opened). */
export async function panelInView(S, re) {
  const l = await S.findOnWall(re);
  await S.settled(`The wall at ${l.t}`);
  return (await S.label(re)) || l;
}

/** Taps a panel open (its title's label) and waits for the set to be finished, the rest of its cards in. */
export async function openPanel(S, l, name) {
  await S.tapAt(l.x + Math.min(30, l.w / 2), l.y + 34, { pause: false });
  await S.page.waitForFunction(() => document.getElementById("back") && !document.getElementById("back").hidden, null, { timeout: 15000 }).catch(() => { throw new Fail(`${name} didn't open`); });
  await sleep(500);
  await S.settled(name, { loadRest: true, timeout: 45000 });
  // The set's head is drawn (its count line): the set is the one asked for.
  const head = await S.label(new RegExp(l.t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  if (!head) throw new Fail(`${name}: its heading isn't on screen`);
}

/**
 * Films a set opening from the wall with the app's own flight (its tiles fly out and grow into the binder). The set is
 * opened once off camera first, so its pictures are in and the flight is motion, not loading; the clip ends once it
 * has landed. Skipped (returns false, the set left open) when its first screen would show a card with no picture.
 */
export async function openWithFlight(F, S, re, name, caption) {
  let l = await panelInView(S, re);
  await openPanel(S, l, name);
  const blank = await S.blankCards(await binderTop(S));
  await S.page.locator("#back").click();
  await S.page.waitForFunction(() => document.getElementById("back")?.hidden, null, { timeout: 10000 }).catch(() => { throw new Fail(`${name}: Back didn't close it`); });
  l = await panelInView(S, re);
  if (blank.length) { log(`${name}: its first screen has a card with no picture; opening it off camera`); await openPanel(S, l, name); return false; }
  await F.begin(`${name} opens`, caption);
  await sleep(380);
  await S.tapAt(l.x + Math.min(30, l.w / 2), l.y + 34, { pause: false });
  await S.page.waitForFunction(() => !document.getElementById("back").hidden, null, { timeout: 15000 }).catch(() => { throw new Fail(`${name} didn't open`); });
  await sleep(950);
  await F.end();
  await S.settled(name, { loadRest: true, timeout: 45000 });
  return true;
}

/** Scrolls an open set back to its head. */
export async function setTop(S, setName) {
  for (let i = 0; i < 12; i++) {
    const h = await S.label(/^Have \d/, { inView: false });
    if (h && h.y > 150) return;
    await S.T.drag(VIEW.width / 2, 260, VIEW.width / 2, 760, 450);
    await sleep(400);
  }
  throw new Fail(`${setName}: couldn't scroll back to its top`);
}

/** Where the set's cards start on screen (under its head's counts and tabs). */
async function binderTop(S) {
  const L = await S.labels();
  const head = L.filter((e) => /^(Have \d|Missing \d|Chasing \d|Main set$|Master$|Grand Master$|~?\$[\d,]+ (in this set|to finish))/.test(e.t)).map((e) => e.y);
  return Math.max(head.length ? Math.max(...head) + 8 : 0, 120); // (never under the top bar)
}

// A point well inside the card a label belongs to: a price sits at a card's top right, a name at its foot.
const cardPoint = (e) => (/^\$/.test(e.t) ? { x: e.x + e.w / 2 - 12, y: e.y + 40 } : { x: e.x + 24, y: e.y - 36 });
const money = (t) => Number(String(t).replace(/[$,]/g, ""));
async function panelState(S) {
  return S.page.evaluate(() => {
    const v = (id) => { const e = document.getElementById(id); return e && e.getBoundingClientRect().height ? (e.textContent || "").trim() : ""; };
    return { name: v("p-name"), meta: v("p-meta"), own: v("p-own"), buy: v("p-buy") };
  });
}
async function closeCard(S) {
  await S.page.locator("#back").click({ timeout: 5000 }).catch(() => {});
  await S.page.waitForFunction(() => !document.body.classList.contains("focused"), null, { timeout: 8000 }).catch(() => {});
  await sleep(700);
}

/**
 * In an open set: its own Filters (they last only while it's open and are never saved, 60-lenses.js): Show (all or
 * missing) and In a set by Price, dearest first, so the best art and the cards most worth an offer lead.
 */
export async function setFilters(S, setName, { show = "all", order = "price" } = {}) {
  await S.tapEl("#filter", { pause: false });
  const menu = S.page.locator("#filter-menu");
  await menu.waitFor({ state: "visible", timeout: 8000 }).catch(() => { throw new Fail(`${setName}: Filters didn't open`); });
  for (const sel of [`#filter-menu [data-show="${show}"]`, `#filter-menu [data-order="${order}"]`]) {
    const b = S.page.locator(sel);
    if (!(await b.isVisible().catch(() => false))) throw new Fail(`${setName}: Filters has no ${sel}`);
    await S.tapEl(b, { pause: false }); await sleep(350);
  }
  await S.tapEl("#f-done", { pause: false });
  await menu.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  await setTop(S, setName);
  await S.settled(`${setName}, ${show === "missing" ? "missing cards" : "every card"} by price`);
}
export const missingByPrice = (S, setName) => setFilters(S, setName, { show: "missing" });

/**
 * How far down an open set (from its top) can be filmed with every card on screen showing its picture: steps down the
 * set looking for cards drawn with no picture, up to `want` px. Leaves the set back at its top, settled.
 */
export async function safeDepth(S, setName, want) {
  const headY = async () => (await S.label(/^Have \d/, { inView: false }))?.y;
  const y0 = await headY();
  if (y0 == null) throw new Fail(`${setName}: no head to measure from`);
  const first = await S.blankCards(await binderTop(S));
  if (first.length) throw new Fail(`${setName}: a card with no picture (${first[0].t}) is on screen at the top of the set`);
  let safe = want;
  for (let o = 0; o < want; ) {
    await S.T.drag(VIEW.width / 2, 700, VIEW.width / 2, 400, 420);
    await sleep(450);
    const y = await headY();
    if (y == null) break;
    const now = y0 - y;
    if (now <= o + 5) break; // (the end of the set)
    o = now;
    const blank = await S.blankCards(120);
    if (blank.length) {
      // The blank card's top is about a card above its name; it may come no nearer than the screen's foot.
      const cardTop = blank[0].y - 120;
      safe = Math.max(0, Math.min(want, Math.round(o - (VIEW.height - cardTop) - 24)));
      log(`${setName}: a card with no picture (${blank[0].t}) lies ${Math.round(o + cardTop)} px down; filming at most ${safe} px of scroll`);
      break;
    }
  }
  await setTop(S, setName);
  await S.settled(`${setName}, back at its top`);
  return safe;
}

/**
 * In an open set: finds a card you're missing that has an offer in Find, by trying the likeliest ones (a name and price
 * that match one of Find's deals) before the clip starts. Returns where to tap it and its name. Leaves the set as it was.
 */
export async function findMissingWithOffer(S, setName, { views = 7, taps = 16 } = {}) {
  const deals = S.feed.filter((l) => l.cardKey && !l.tooCheap && l.pctVsMarket > 0 && l.type !== "auction");
  const names = new Set(deals.map((l) => l.cardName));
  const tried = new Set();
  let n = 0;
  for (let v = 0; v < views; v++) {
    const top = await binderTop(S);
    const L = (await S.labels()).filter((e) => e.y > top && e.y < VIEW.height - 60 && e.x > 0 && e.x < VIEW.width);
    // A price pill's card name: the first name line under it in the same card (names sit at a card's foot).
    const nameOf = (e) => L.filter((l) => l !== e && l.h <= 16 && !/^[$—●★×]/.test(l.t) && l.x <= e.x + e.w && l.x >= e.x + e.w - 120 && l.y > e.y + 40 && l.y < e.y + 170).sort((a, b) => a.y - b.y)[0]?.t;
    // Likeliest first: a card whose name and price both match one of Find's deals, then the dearest.
    const dealt = (name, price) => deals.some((l) => l.cardName === name && Math.abs(Number(l.market) - price) <= Math.max(0.06, Number(l.market) * 0.03));
    const cands = L.filter((e) => /^\$[\d,.]+$/.test(e.t)).map((e) => {
      const price = money(e.t), name = nameOf(e);
      return { e, score: name && dealt(name, price) ? 0 : names.has(name) ? 1 : 2, price };
    }).filter((c) => c.score === 0 || !deals.length || (v >= views - 2 && c.score === 1)).sort((a, b) => a.score - b.score || b.price - a.price);
    const P = await S.pics();
    const pictured = (e) => { const p = cardPoint(e); return P.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h); };
    for (const { e } of cands) {
      if (!pictured(e)) continue; // (a card with no picture: never the one filmed)
      const { x, y } = cardPoint(e), key = `${Math.round(x / 20)}|${Math.round(y / 20)}`;
      if (tried.has(key)) continue;
      tried.add(key);
      if (++n > taps) throw new Fail(`${setName}: no missing card with an offer in Find among the ${taps} tried`);
      await S.T.tap(x, y);
      const up = await S.page.waitForFunction(() => document.body.classList.contains("focused"), null, { timeout: 6000 }).then(() => true).catch(() => false);
      if (!up) continue; // (not a card: a gap or the head)
      await sleep(900);
      const st = await panelState(S);
      const offers = /View offers in Find\s*·\s*(\d+)/.exec(st.buy);
      await closeCard(S);
      if (/I have it/i.test(st.own) && offers && Number(offers[1]) > 0) {
        log(`${setName}: picked a missing card with ${offers[1]} offer(s) in Find`);
        // A card low on the screen is brought up to the middle first, so it's well in view when it's tapped.
        let cy = y;
        if (y > VIEW.height * 0.6) { const dy = Math.round(y - VIEW.height * 0.45); await S.scroll(dy, { ms: 700 }); cy = y - dy; }
        return { x, y: cy, name: st.name, label: e.t };
      }
    }
    await S.scroll(420, { ms: 700 });
    await S.settled(`${setName}, looking for a card with an offer`);
    tried.clear();
  }
  throw new Fail(`${setName}: no missing card with an offer in Find`);
}

/** In Find's answer: scrolls so the best deal (its price and "N% under") is in view. */
export async function dealInView(S) {
  const deal = S.page.locator("#fa .fa-under").first();
  await deal.waitFor({ state: "attached", timeout: 15000 }).catch(() => { throw new Fail("Find's answer shows no deal under market (no .fa-under)"); });
  for (let i = 0; i < 6; i++) {
    const b = await deal.boundingBox();
    if (b && b.y > 140 && b.y + b.height < VIEW.height - 110) return;
    const dy = b ? Math.min(420, b.y - VIEW.height * 0.55) : 420;
    if (Math.abs(dy) < 20) return;
    await S.scroll(dy, { y: dy > 0 ? 640 : 240, ms: 1000 });
  }
  throw new Fail("Couldn't bring Find's deal into view");
}

/**
 * The climax, in one unbroken take: the missing card flies up close, View offers in Find, Find's answer comes in, the
 * page scrolls to the deal, and it lands: a spotlight, the page leaning in, a shake, confetti, the stamp and the
 * punchline caption. The whole path is run once off camera first (so the card's sheet and Find's answer for it are
 * loaded and kept), then filmed from the set with nothing left to load.
 */
export async function cardToDeal(F, S, card, scene, caption, { hold = 1600, punch = "" } = {}) {
  // Where the card is now (the page may have moved a little since it was chosen): its label nearest to where it was.
  const relocate = async () => {
    const at = (await S.labels()).filter((e) => e.t === card.label).map(cardPoint).filter((p) => p.y >= 120 && p.y <= VIEW.height - 60).sort((a, b) => Math.hypot(a.x - card.x, a.y - card.y) - Math.hypot(b.x - card.x, b.y - card.y))[0];
    if (!at) throw new Fail(`${scene}: lost sight of ${card.name}`);
    Object.assign(card, at);
  };
  await relocate();
  // Off camera: the path once, then back to the set.
  await S.T.tap(card.x, card.y);
  await S.page.waitForFunction(() => document.body.classList.contains("focused"), null, { timeout: 8000 }).catch(() => { throw new Fail(`${scene}: ${card.name} didn't come up close`); });
  await S.page.waitForFunction(() => { const e = document.getElementById("p-buy"), r = e?.getBoundingClientRect(); return r && r.height > 0 && r.bottom < innerHeight && /View offers in Find/.test(e.textContent); }, null, { timeout: 10000 }).catch(() => { throw new Fail(`${scene}: the card's sheet has no "View offers in Find"`); });
  await S.settled(`${scene}: ${card.name} up close (rehearsed)`);
  const st = await panelState(S);
  if (st.name !== card.name) throw new Fail(`${scene}: opened ${st.name || "something else"}, not ${card.name}`);
  await S.page.locator("#p-buy").click();
  await S.page.waitForFunction(() => { const e = document.getElementById("fa"); return e && !e.hidden && e.getBoundingClientRect().height > 0; }, null, { timeout: 15000 }).catch(() => { throw new Fail(`${scene}: Find's answer didn't open`); });
  await S.page.locator("#fa .fa-under").first().waitFor({ state: "attached", timeout: 15000 }).catch(() => { throw new Fail(`${scene}: Find's answer shows no deal under market`); });
  await S.settled(`${scene}: Find's answer for ${card.name} (rehearsed)`);
  // Back: Find's answer to the card up close in Collection, then the card closed onto the set.
  // (Find's answer has its own way back across, "‹ Back to Gengar in Collection" (99-links.js); then the card is closed.)
  const across = S.page.locator("button, a, [role=button]", { hasText: /Back to .+ in Collection/ }).first();
  if (await across.isVisible().catch(() => false)) { await across.click().catch(() => {}); await sleep(1100); }
  for (let i = 0; i < 3 && (await S.page.evaluate(() => document.body.classList.contains("focused") || document.getElementById("fa")?.hidden === false)); i++) {
    await S.page.locator("#back").click().catch(() => {});
    await sleep(900);
  }
  await S.page.waitForFunction(() => !document.body.classList.contains("focused") && document.getElementById("fa")?.hidden !== false, null, { timeout: 10000 }).catch(() => { throw new Fail(`${scene}: couldn't get back to the set from Find's answer`); });
  await S.settled(`${scene}: back on the set`);
  await relocate();

  // On camera: the card, then (past the app's in-between screens) the answer and the deal.
  await F.begin(`${scene} · the card`, caption);
  await sleep(450);
  await S.T.tap(card.x, card.y);
  await S.page.waitForFunction(() => document.body.classList.contains("focused"), null, { timeout: 8000 }).catch(() => {});
  await sleep(1000);
  await S.tapEl("#p-buy", { pause: false });
  await sleep(200);
  // The app goes from here back out across the wall and Find's home before the answer opens (about a second of
  // in-between screens): left out, the two halves joined by a quick zoom from the tap straight into the answer.
  await F.end();
  await S.page.waitForFunction(() => { const e = document.getElementById("fa"); return e && !e.hidden && e.getBoundingClientRect().height > 0; }, null, { timeout: 8000 }).catch(() => { throw new Fail(`${scene}: Find's answer didn't open on the filmed run`); });
  await sleep(450);
  await F.begin(`${scene} · the deal`, caption, { join: "whip" });
  await sleep(250);
  await dealInView(S);
  await sleep(250);
  // The spotlight on the deal's "N% under" and its price together (the row itself runs the screen's width).
  const box = await S.page.evaluate(() => {
    const u = document.querySelector("#fa .fa-under"), row = u?.closest("button") || u?.parentElement;
    const parts = [u, ...(row ? row.querySelectorAll("em") : [])].filter(Boolean).map((e) => e.getBoundingClientRect()).filter((r) => r.width);
    if (!parts.length) return null;
    const x = Math.min(...parts.map((r) => r.left)), y = Math.min(...parts.map((r) => r.top)), r = Math.max(...parts.map((r) => r.right)), b = Math.max(...parts.map((r) => r.bottom));
    return { x: x - 6, y: y - 6, width: r - x + 12, height: b - y + 12 };
  });
  if (!box) throw new Fail(`${scene}: the deal's price isn't on screen`);
  // The payoff: what it saves against the card's worth, from Find's answer itself.
  const say = await S.page.evaluate(() => {
    const fa = document.getElementById("fa"), worth = /Worth about\s*\$([\d,]+(?:\.\d+)?)/.exec(fa.innerText)?.[1];
    const u = fa.querySelector(".fa-under"), row = u?.closest("button") || u?.parentElement, price = /\$([\d,]+(?:\.\d+)?)/.exec(row?.querySelector("em")?.textContent || "")?.[1];
    return { worth: worth && Number(worth.replace(/,/g, "")), price: price && Number(price.replace(/,/g, "")), pct: /(\d+)%/.exec(u?.textContent || "")?.[1] };
  });
  const zoom = 1.12, spot = S.spotlight(box, { zoom });
  await sleep(420);
  // A big saving leads with dollars; a small one with the percentage (a "SAVE $1" is no payoff).
  const save = say.worth && say.price ? say.worth - say.price : 0;
  const money = (v) => `$${v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2).replace(/\.00$/, "")}`;
  const [big, small] = save >= 10 ? [`SAVE ${money(save)}`, say.pct ? `${say.pct}% under market` : ""] : [`${say.pct}% UNDER`, save > 0 ? `Save ${money(save)} vs market` : "market price"];
  // Where the spotlit row lands once the page has leaned in (the zoom is about the row's middle): the stamp sits above it.
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  S.shake();
  F.overlay({ kind: "confetti", x: cx, y: cy - (cy - box.y) * zoom });
  F.overlay({ kind: "stamp", big, small, pageY: cy - (cy - box.y) * zoom });
  if (punch) F.punch(punch);
  await spot;
  await sleep(hold);
  await F.end();
  log(`${scene}: the deal on screen: "${big}" (${small})`);
}
