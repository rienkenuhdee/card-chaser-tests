// The gesture contract: every move lands on a composed view, pinch snaps by speed or distance, scrolling always works.
// A variant that changes navigation may change what's expected here, but it has to say so in its NOTES.md.
//   node tests/gestures.mjs [--variant name]
import { write } from "../scripts/build.mjs";
import { launch, phone, installTouch, wait, report } from "./browser.mjs";

const variant = process.argv.includes("--variant") ? process.argv[process.argv.indexOf("--variant") + 1] : null;
const { file } = write({ variant, debug: true });
const browser = await launch();
let failures = 0;
for (const dpr of [1, 2]) {
  const p = await phone(browser, file, { dpr });
  const t = await installTouch(p);
  const st = () => p.evaluate(() => ({ view: __w.view, s: +__w.cam.s.toFixed(2), my: Math.round(__w.mScroll), cy: Math.round(__w.cam.y), set: __w.state.g?.name }));
  const G = (i = 1) => p.evaluate((i) => { const m = __w.groups[i].m; return { x: m.x + m.w / 2, y: Math.min(700, m.y + m.h / 2 - __w.mScroll) }; }, i);
  const R = [];
  let g = await G();
  await t.pinch(g.x, g.y, 60, 74, 320, 250); await wait(800); R.push(["a slow small spread stays home", (await st()).view === "mosaic"]);
  await t.pinch(g.x, g.y, 60, 92, 80); await wait(900); R.push(["a quick short spread opens", (await st()).view === "set"]);
  const opened = (await st()).set;
  await t.pinch(195, 450, 220, 195, 320, 250); await wait(800); R.push(["a slow small pinch stays in the set", (await st()).view === "set"]);
  await t.drag(195, 650, 300, 120); await wait(500); R.push(["the binder scrolls", (await st()).cy > -40]);
  const c0 = (await st()).cy; await t.drag(150, 650, 400, 120, 60); await wait(500);
  R.push(["a diagonal drag scrolls, it doesn't change sets", (await st()).cy > c0 + 40 && (await st()).set === opened]);
  await t.drag(300, 500, 500, 120, -170); await wait(700); R.push(["a sideways flick goes to the next set", (await st()).set !== opened]);
  await t.pinch(195, 450, 220, 185, 80); await wait(900); R.push(["a quick short pinch closes", (await st()).view === "mosaic"]);
  g = await G();
  await t.pinch(g.x, g.y, 60, 170, 200); await wait(900); R.push(["a big spread opens", (await st()).view === "set"]);
  await t.pinch(195, 450, 100, 260, 200); await wait(600); R.push(["a spread inside a set zooms in", (await st()).s > 2]);
  await t.pinch(195, 450, 260, 60, 400); await wait(900);
  if ((await st()).view === "set") { R.push(["a long pinch from deep zoom lands on the frame", (await st()).s < 1.5]); await t.pinch(195, 450, 220, 120, 160); await wait(900); }
  R.push(["pinching out of a set closes it", (await st()).view === "mosaic"]);
  g = await G();
  await t.pinch(g.x, g.y, 60, 170, 200); await wait(900);
  await t.pinch(195, 450, 100, 220, 300, 300); await wait(600);
  await t.pinch(195, 450, 220, 120, 500, 300); await wait(800); R.push(["slowly pinching back from zoom lands on the frame", (await st()).view === "set"]);
  await p.click("#back"); await wait(900); R.push(["back closes the set", (await st()).view === "mosaic"]);
  let hits = 0;
  for (let k = 0; k < 8; k++) { const b4 = (await st()).my; await t.drag(200, k % 2 ? 300 : 650, k % 2 ? 650 : 300, 120); await wait(200); const af = (await st()).my; if (Math.abs(af - b4) > 40 || (af === 0 && k % 2)) hits++; }
  R.push([`the mosaic scrolls every time (${hits}/8)`, hits === 8]);
  await t.ghost(100, 500); await wait(100);
  const g0 = (await st()).my; await t.drag(200, 650, 300, 120); await wait(300);
  R.push(["a cancelled touch leaves no ghost finger", (await st()).my !== g0 && (await st()).view === "mosaic"]);
  g = await G(); await t.tap(g.x, g.y); await wait(200); await t.drag(195, 650, 300, 120); await wait(900);
  R.push(["a touch during the opening takes over", (await st()).view === "set" && (await st()).cy > -40]);
  // Trophies, the trophy room (round 21: a room on the map, its only way in; its id is still "medal").
  // A set finished two days ago sits on its shelves. Pinch the wall closed for the map, tap Trophies.
  await p.evaluate(() => {
    const g = __w.groups.filter((x) => x.set).sort((a, b) => a.base.length - b.base.length)[0], at = Date.now() - 2 * 86400e3, owned = {};
    for (const c of g.base) owned[c.id] = { on: true, at };
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-imported", "1"); localStorage.setItem("wall-welcomed", "1");
    localStorage.setItem("wall-done", JSON.stringify({ [`${g.set.id}|set`]: { at, put: true } }));
  });
  await p.reload({ waitUntil: "load" }); await wait(900);
  const u = await installTouch(p);
  const rm = () => p.evaluate(() => ({ on: __w.room.on, q: __w.room.q, view: __w.view, my: Math.round(__w.mScroll), at: __w.rooms.at, map: __w.rooms.map }));
  const roomCard = (id) => p.evaluate((id) => { const r = __w.mapLayout().r[id]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }, id);
  const d = await p.evaluate(() => __w.caseList().length === 1 && !__w.groupsNow.some((g) => g.done && g.m && g.m.h > 0 && __w.caseList().includes(g)));
  R.push(["a trophy past its day is in Trophies, not on the wall", d]);
  if (d) {
    for (let k = 0; k < 2; k++) { await u.drag(200, 650, 250, 120); await wait(250); } // somewhere down the wall, to come back to
    const wallAt = (await rm()).my;
    await u.pinch(195, 450, 220, 120, 90); await wait(900); R.push(["pinching the wall closed goes up to the map", (await rm()).map && !(await rm()).on]);
    let c = await roomCard("medal"); await u.tap(c.x, c.y); await wait(900); R.push(["tapping the Trophies card opens the room", (await rm()).on && (await rm()).q === 1 && (await rm()).at === "medal" && !(await rm()).map]);
    // Something in the room (a rect in room coordinates) dragged into view, then where it is on screen.
    const inView = async (get) => { for (let k = 0; k < 10; k++) { const r = await get(); if (!r) return null; const y = r.y - (await rm()).my; if (y > 110 && y < 640) return { x: r.x, y }; const d = Math.max(-440, Math.min(440, y - 380)); await u.drag(200, d > 0 ? 680 : 220, (d > 0 ? 680 : 220) - d, Math.max(160, Math.abs(d) / 0.15)); await wait(300); } return null; }; // slow enough not to fling
    const pl = await inView(() => p.evaluate(() => { const g = __w.caseList()[0]; return { x: g.m.x + g.m.w / 2, y: g.m.y + 40 }; }));
    if (pl) await u.tap(pl.x, pl.y); await wait(1000); R.push(["a plaque in the room opens its album", (await rm()).view === "set"]);
    await p.click("#back"); await wait(900); R.push(["back from the album returns to the room", (await rm()).on && (await rm()).view === "mosaic"]);
    await u.pinch(195, 450, 220, 120, 90); await wait(900); R.push(["a quick pinch in the room goes up to the map", !(await rm()).on && (await rm()).map]);
    c = await roomCard("chase"); await u.tap(c.x, c.y); await wait(900); R.push(["and Chase comes back where the wall was", (await rm()).at === "chase" && !(await rm()).map && Math.abs((await rm()).my - wallAt) < 4]);
    await p.click("#rooms"); await wait(900); R.push(["the rooms button goes up to the map", (await rm()).map]);
    c = await roomCard("medal"); await u.pinch(c.x, c.y, 40, 120, 160); await wait(900); R.push(["a spread on the Trophies card opens the room", (await rm()).on && !(await rm()).map]);
    await u.drag(300, 500, 510, 120, -190); await wait(900); R.push(["a sideways flick in the room goes to the next room along (Source)", !(await rm()).on && (await rm()).at === "source"]);
    await u.pageDrag(80, 500, 505, 120, 200); await wait(900); R.push(["and a flick back on its page returns to the room", (await rm()).on && (await rm()).at === "medal"]);
    // The finished set's shelf (the room is still up): its plaque at the head, Binder Complete mounted on it, its other medals hanging beneath.
    const shelf = await p.evaluate(() => {
      const g = __w.caseList()[0], sec = __w.mdSecOf(g), L = __w.roomL, rows = L.items.filter((it) => it.type === "row" && !it.stand && it.cells.every((c) => c.t.sec === sec));
      return { plaque: __w.room.plaques.includes(g), ride: Boolean(g.ride?.complete && g.ride.sec === sec), first: rows[0] ? rows[0].y - (g.m.y + g.m.h) : null, n: rows.reduce((a, it) => a + it.cells.length, 0), head: L.items.some((it) => it.type === "head" && it.text === g.name) };
    });
    R.push(["the room shows the finished set's shelf: its plaque with its medals", shelf.plaque && shelf.ride && shelf.n > 0 && shelf.first !== null && shelf.first < 0 && !shelf.head]);
    const medalAt = () => p.evaluate(() => { const g = __w.caseList()[0], sec = __w.mdSecOf(g), h = __w.roomL.hits.find((x) => x.blk.mdt && x.blk.mdt.sec === sec && x.y > g.m.y + 60); return h ? { x: h.x + h.w / 2, y: h.y + h.h / 2, id: h.blk.mdt.id } : null; });
    const md = await inView(medalAt), mid = (await medalAt())?.id;
    if (md) await u.tap(md.x, md.y); await wait(600);
    const sheet = () => p.evaluate(() => ({ on: document.body.classList.contains("medaling"), name: document.getElementById("ms-name")?.textContent || "" }));
    R.push(["tapping a medal opens its trophy sheet", (await sheet()).on && (await sheet()).name === (await p.evaluate((id) => __w.medalList().byId.get(id)?.name, mid))]);
    await p.click("[data-ms-close]"); await wait(500);
    // A shelf's locked medals fold behind one line; a tap unfolds them. (Here every other shelf is under "Not started yet".)
    const fa = await inView(() => p.evaluate(() => { const it = __w.roomL.items.find((x) => x.type === "fold" && !x.open); return it ? { x: it.x + it.w / 2, y: it.y + it.h / 2 } : null; }));
    if (fa) { await u.tap(fa.x, fa.y); await wait(500); }
    const moreAt = () => p.evaluate(() => { const it = __w.roomL.items.find((x) => x.type === "more" && !x.open); return it ? { x: it.x + it.w / 2, y: it.y + it.h / 2, sec: it.blk.mdsec } : null; });
    const mo = await inView(moreAt), msec = (await moreAt())?.sec;
    const cellsOf = (sec) => p.evaluate((sec) => __w.roomL.items.filter((it) => it.type === "row" && !it.stand).reduce((a, it) => a + it.cells.filter((c) => c.t.sec === sec).length, 0), msec);
    const c0 = await cellsOf(msec);
    if (mo) await u.tap(mo.x, mo.y); await wait(500);
    R.push(["a shelf's \"more to earn\" line unfolds its locked medals", Boolean(msec) && (await p.evaluate((sec) => __w.mdOpen.has(sec), msec)) && (await cellsOf(msec)) > c0]);
    // Next up: a medal's sheet lists the cards behind it, missing first; tapping a missing one lands on it in its set.
    const nu = await inView(() => p.evaluate(() => { const it = __w.roomL.items.find((x) => x.type === "nu" && !x.t.noCards); return it ? { x: it.x + it.w / 2, y: it.y + it.h / 2 } : null; }));
    if (nu) await u.tap(nu.x, nu.y); await wait(600);
    const ci = await p.evaluate(() => Number(document.querySelector("#msheet .ms-card:not(.own)")?.dataset.ci ?? -1));
    if (ci >= 0) await p.click(`#msheet .ms-card[data-ci="${ci}"]`); await wait(1600);
    R.push(["tapping a missing card in the sheet lands on it", ci >= 0 && (await p.evaluate((ci) => __w.view === "set" && __w.state.focus?.i === ci && !__w.state.focus.owned, ci))]);
    for (let k = 0; k < 2; k++) if (await p.evaluate(() => !document.getElementById("back").hidden)) { await p.click("#back"); await wait(900); }
  }
  // Inside a set the next medal hangs on the bar; marking the card that tips it records it and mints it there.
  await p.evaluate(() => {
    const g = __w.groups[0], need = Math.ceil(g.base.length / 2), owned = {}, at = Date.now() - 30 * 86400e3;
    localStorage.clear();
    for (const c of g.base.slice(-(need - 1))) owned[c.id] = { on: true, at };
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-imported", ""); localStorage.setItem("wall-welcomed", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(900);
  const w = await installTouch(p);
  const half = await p.evaluate(() => `${__w.mdSecOf(__w.groups[0])}:half`);
  g = await G(0); await w.tap(g.x, g.y); await wait(1200);
  const pin = await p.evaluate((id) => ({ next: __w.mdNextOf(__w.groups[0])?.id, drawn: __w.groups[0].pinR?.t.id, had: Boolean(__w.medals[id]) }), half);
  R.push(["an open set's bar carries its next medal", pin.next === half && pin.drawn === half && !pin.had]);
  await p.click("#mark"); await wait(300);
  const card = await p.evaluate(() => { const c = __w.groups[0].cards.find((x) => !x.owned), C = __w.cam; return { x: (c.x - C.x) * C.s + 31 * C.s, y: (c.y - C.y) * C.s + 44 * C.s, id: c.id }; });
  await w.tap(card.x, card.y); await wait(650);
  const minted = await p.evaluate((id) => ({ got: Boolean(__w.medals[id]), mint: __w.mintQ.length + __w.mintsOn.length }), half);
  R.push(["marking the card that tips a medal records it and mints it on the bar", minted.got && minted.mint > 0]);
  await wait(3500); await p.click("#m-done"); await wait(300);
  // The trade binder (round 21: in the Trade room, its only home, reached here with a sideways flick from the wall, the
  // room next to Chase): an imported collection with spare copies, the binder's cover at the top of the room.
  await p.evaluate(() => {
    const at = Date.now() - 30 * 86400e3, owned = {}, copies = {};
    for (const c of __w.cards) if (c.own0) { owned[c.id] = { on: true, at }; if (c.i % 4 === 0) copies[c.id] = { n: c.i % 3 ? 2 : 3, got: at }; }
    localStorage.clear();
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-copies", JSON.stringify(copies));
    localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(900);
  const v = await installTouch(p);
  const bd = () => p.evaluate(() => ({ on: __w.bnd.on, q: __w.bnd.q, vi: __w.bnd.vi, show: __w.bnd.show, n: __w.tbList().length }));
  const cover = () => p.evaluate(() => { const el = document.getElementById("pt-cover"), r = el.getBoundingClientRect(); return !el.closest(".rpage").hidden && r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent } : null; });
  await v.drag(300, 450, 460, 120, -200); await wait(900);
  R.push(["a sideways flick on the wall goes to the next room along, Trade", await p.evaluate(() => __w.rooms.at === "trade" && !document.getElementById("pg-trade").hidden && __w.view === "mosaic")]);
  let cv = await cover(); R.push(["the Trade room shows the binder's cover", Boolean(cv) && cv.y > 60 && cv.y < 400 && /cards on/.test(cv.text) && (await bd()).n > 18]);
  const openIt = async () => { await p.click("#pt-cover"); await wait(900); };
  await openIt(); R.push(["tapping the cover opens the binder", (await bd()).on && (await bd()).q === 1]);
  // Production's proportions (round 22 polish): a thin bar along the top (Back, the title, Show mode), and under it the
  // page across the whole width, each pocket a card as wide as it allows with who wants it and its price on the card.
  const ff = await p.evaluate(() => { const G = __w.bnd.L, v = __w.bnd.vi, cs = __w.tbList().slice(v * 9, v * 9 + 9), rs = cs.map((c) => __w.tbPocketRect(c)), sh = document.getElementById("bb-show").getBoundingClientRect(), bk = document.getElementById("back").getBoundingClientRect(); return { cover: (G.pw * G.ph * G.spread) / (innerWidth * innerHeight), top: Math.min(...rs.map((r) => r.y)), w: Math.min(...rs.map((r) => r.w)), n: rs.length, chrome: Math.max(sh.bottom, bk.bottom), vw: innerWidth, said: __w.bnd.labels.get(v) || [] }; });
  R.push([`the open binder's page fills the screen under a thin bar (${Math.round(ff.cover * 100)}%, the bar ${Math.round(ff.chrome)}px), clear of the pockets`, ff.cover >= 0.9 && ff.chrome <= 48 && ff.chrome <= ff.top]);
  R.push([`every pocket is at least 30% of the screen's width (${Math.round(ff.w)}px, ${(ff.w / ff.vw * 100).toFixed(1)}%)`, ff.n === 9 && ff.w / ff.vw >= 0.3]);
  R.push([`who wants each card and its price sit on the card, none cut short (${ff.said.slice(0, 3).join(" | ")})`, ff.said.length >= 18 && ff.said.every((t) => t && !t.includes("…") && !t.includes(".."))]);
  await v.drag(300, 450, 450, 120, -200); await wait(700); R.push(["a sideways flick turns the page", (await bd()).vi === 1]);
  await v.drag(100, 450, 450, 120, 200); await wait(700); R.push(["a flick the other way turns it back", (await bd()).vi === 0]);
  await p.click("#back"); await wait(900); R.push(["back closes the binder to the Trade room", !(await bd()).on && (await p.evaluate(() => __w.rooms.at === "trade" && !__w.rooms.map))]);
  await openIt(); await v.pinch(195, 450, 220, 195, 320, 250); await wait(800); R.push(["a slow small pinch stays in the binder", (await bd()).on]);
  await v.pinch(195, 450, 220, 120, 90); await wait(900); R.push(["a quick pinch closes the binder (to the room, not the map)", !(await bd()).on && (await p.evaluate(() => __w.rooms.at === "trade" && !__w.rooms.map))]);
  // Show mode: the other person taps two pockets; Done, then who it was, and the table opens with them on your side.
  const pickTwo = async () => {
    await p.click("#bb-show"); await wait(700);
    const pk = await p.evaluate(() => [0, 4].map((k) => { const c = __w.tbList()[__w.bnd.vi * 9 + k], r = __w.tbPocketRect(c); return { id: c.id, x: r.x + r.w / 2, y: r.y + r.h / 2 }; }));
    for (const q of pk) { await v.tap(q.x, q.y); await wait(150); }
    await p.click("#sb-done"); await wait(600);
    return pk.map((q) => q.id);
  };
  await openIt(); const shown = await pickTwo();
  await p.click('#tb-who [data-w="0"]'); await wait(1200);
  const tb = await p.evaluate(() => ({ on: __w.tbl.on, give: __w.tbl.give.map((c) => c.id) }));
  R.push(["Show mode, two picks, Done and a trader open the table with them on your side", tb.on && tb.give.length === 2 && shown.every((id) => tb.give.includes(id))]);
  await p.click("#back"); await wait(1200); R.push(["back from the table returns to the binder", !(await p.evaluate(() => __w.tbl.on)) && (await bd()).on]);
  // Someone new: one copy of each pick is given away, and Undo puts the counts and the cards back exactly.
  const snap = (ids) => p.evaluate((ids) => JSON.stringify(ids.map((id) => { const c = __w.pool.find((x) => x.id === id); return [c.owned, c.got, __w.nOf(c), __w.copies[id] || null]; })), ids);
  const ids = await pickTwo(), before = await snap(ids), n0 = await p.evaluate((ids) => ids.map((id) => __w.nOf(__w.pool.find((x) => x.id === id))), ids);
  await p.evaluate(() => [...document.querySelectorAll("#tb-who [data-w]")].find((b) => b.querySelector("b").textContent === "Someone new").click()); await wait(400);
  const gave = await p.evaluate((ids) => ({ n: ids.map((id) => __w.nOf(__w.pool.find((x) => x.id === id))), toast: document.getElementById("toast").textContent }), ids);
  R.push(["someone new takes one copy of each", gave.n.every((n, i) => n === n0[i] - 1) && /^Gave 2 cards to someone new\./.test(gave.toast)]);
  await p.evaluate(() => document.querySelector("#toast .toast-btn").click()); await wait(300);
  R.push(["undo gives them back exactly", (await snap(ids)) === before]);
  await p.keyboard.press("Escape"); await wait(900); R.push(["escape closes the binder", !(await bd()).on]);
  // The rooms (round 21): an imported collection chasing every card it's missing. The map one pinch above the wall,
  // the Feed's listings (the wall's deals, seeded, several for some cards), a listing's own sheet, the Chase lens's
  // want list, a flick between rooms, and the trade checker.
  await p.evaluate(() => {
    const at = Date.now() - 30 * 86400e3, owned = {}, chase = {}, copies = {};
    for (const c of __w.cards) { if (c.own0) { owned[c.id] = { on: true, at }; if (c.i % 4 === 0) copies[c.id] = { n: 2, got: at }; } else chase[c.id] = true; }
    localStorage.clear();
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase)); localStorage.setItem("wall-copies", JSON.stringify(copies));
    localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(900);
  const f = await installTouch(p);
  const where = () => p.evaluate(() => ({ at: __w.rooms.at, map: __w.rooms.map, trans: __w.state.trans?.kind || null, view: __w.view, pages: [...document.querySelectorAll(".rpage")].filter((e) => !e.hidden).map((e) => e.id), focus: __w.state.focus?.id || null, pop: Boolean(__w.state.focus) }));
  const mcard = (id) => p.evaluate((id) => { const r = __w.mapLayout().r[id]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }, id);
  await f.pinch(195, 450, 220, 195, 320, 250); await wait(800); R.push(["a slow small pinch on the wall stays on the wall", !(await where()).map && (await where()).at === "chase"]);
  await f.pinch(195, 450, 220, 120, 90); await wait(900); R.push(["a quick pinch on the wall goes up to the map", (await where()).map]);
  let mc = await mcard("feed"); await f.pinch(mc.x, mc.y, 60, 74, 320, 250); await wait(800); R.push(["a slow small spread on a room stays on the map", (await where()).map]);
  await f.pinch(mc.x, mc.y, 40, 140, 140); await wait(900); R.push(["a spread on the Feed card enters the Feed", (await where()).at === "feed" && !(await where()).map && (await where()).pages.includes("pg-feed")]);
  const feed = await p.evaluate(() => { const L = __w.feedList(), rows = [...document.querySelectorAll("#pf-list [data-l]")], per = {}; for (const x of L) per[x.c.id] = (per[x.c.id] || 0) + 1; return { n: L.length, rows: rows.length, seeded: L.filter((x) => x.c.deal0 && !x.c.dealAt).length, multi: Object.values(per).some((k) => k > 1), news: document.querySelectorAll("#pf-list .fd-new").length, sorted: L.every((x, i) => !i || L[i - 1].seen >= x.seen) }; });
  R.push([`the Feed lists the seeded listings on load (${feed.rows} rows, ${feed.news} new)`, feed.n > 10 && feed.rows === feed.n && feed.seeded > 10 && feed.multi && feed.news > 0 && feed.sorted]);
  const row = await p.evaluate(() => { const b = document.querySelectorAll("#pf-list [data-l]")[1], r = b.getBoundingClientRect(); return { id: b.dataset.l, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p.mouse.click(row.x, row.y); await wait(600);
  const sheet = await p.evaluate(() => ({ open: document.getElementById("lsheet").open, id: __w.lsOpen?.id, text: document.getElementById("lsheet").textContent }));
  R.push(["tapping a listing opens its listing sheet, not the card", sheet.open && sheet.id === row.id && /How we worked out the market price/.test(sheet.text) && /What moved the score/.test(sheet.text) && /Open on /.test(sheet.text) && !(await where()).pop && (await where()).view === "mosaic" && (await where()).at === "feed"]);
  await p.click("[data-mine]"); await wait(2400);
  const mine = await where(), cid = row.id.split("~")[0];
  R.push(["the listing's line to your card lands on it in its set", mine.at === "chase" && mine.view === "set" && mine.focus === cid && !(await p.evaluate(() => document.getElementById("lsheet").open))]);
  await p.click("#back"); await wait(900); if ((await where()).view === "set") { await p.click("#back"); await wait(900); }
  await p.click('[data-lens="chase"]'); await wait(1600);
  const lens = await p.evaluate(() => { const lead = new Set(__w.groupsNow.flatMap((g) => (g.done ? [] : (g.lead || []).map((c) => c.base || c)))), chased = __w.cards.filter(__w.isChase).length; return { lead: lead.size, chased, toast: document.getElementById("toast").textContent }; });
  R.push(["the Chase lens still lifts the want list, every card you chase", lens.lead > 0 && lens.lead === lens.chased && /Your chase list/.test(lens.toast) && /Feed/.test(lens.toast)]);
  // Messages sit in the top bar, in its colours, not as a dark banner over the wall.
  const msg = await p.evaluate(() => { const t = document.getElementById("toast"), r = t.getBoundingClientRect(), s = document.querySelector(".top .strip").getBoundingClientRect(), cs = getComputedStyle(t);
    return { inBar: r.top >= s.top - 1 && r.bottom <= s.bottom + 1 && r.left >= s.left - 1 && r.right <= s.right + 1, bg: cs.backgroundColor, bar: getComputedStyle(document.querySelector(".top .strip")).backgroundColor }; });
  R.push(["a message sits inside the top bar, in the bar's colours, not over the wall", msg.inBar && msg.bg === msg.bar]); // round 23: the same field as the bar, never a dark banner
  await p.click('[data-lens="have"]'); await wait(1600);
  await f.drag(100, 450, 460, 120, 200); await wait(900); R.push(["a sideways flick on the wall the other way goes to the Feed", (await where()).at === "feed"]);
  await f.pageDrag(300, 450, 455, 120, -200); await wait(900); R.push(["a sideways flick on the Feed's page comes back to Chase", (await where()).at === "chase" && (await where()).pages.length === 0]);
  const b0 = await p.evaluate(() => __w.feedNewCount()); await p.evaluate(() => __w.arrive());
  // The badge follows on the next frame or two; under load that can take longer than a fixed wait, so wait until it agrees.
  // (The wall's own timer can land another deal in that window, so the count may rise by more than one.)
  for (let k = 0; k < 30; k++) { await wait(100); if (await p.evaluate(() => document.querySelector("#rooms .rbadge")?.textContent === String(__w.feedNewCount()))) break; }
  // (A copy whose title says it's damaged or heavily played stays out of the Feed and its count, as in production.)
  const b1 = await p.evaluate(() => { const c = __w.cards.filter((x) => x.dealAt).sort((a, b) => b.dealAt - a.dealAt || b.i - a.i)[0], L = __w.listingsOf(c)[0], shown = __w.feedList().some((x) => x.id === L.id); return { n: __w.feedNewCount(), badge: document.querySelector("#rooms .rbadge").textContent, shown, first: __w.feedList()[0]?.id === L.id, damaged: L.cond === "HP" || L.cond === "DMG" }; });
  R.push([`a deal arriving lands on top of the Feed and the rooms button counts it${b1.damaged ? " (a damaged copy: hidden, not counted)" : ""}`, (b1.damaged ? !b1.shown && b1.n >= b0 : b1.shown && b1.n >= b0 + 1) && b1.badge === String(b1.n)]);
  await f.drag(300, 450, 460, 120, -200); await wait(900);
  // The trade checker: one of your spares for a card you chase, priced to match, is fair; cash on your side makes it uneven.
  const tc = () => p.evaluate(() => document.querySelector("#tc .verdict b")?.textContent || "");
  await p.click('#tc [data-add="give"]'); await wait(400); await p.click("#tca-list [data-n]"); await wait(200); await p.click("#tc-add [data-tca-close]"); await wait(300);
  await p.click('#tc [data-add="get"]'); await wait(400); await p.type("#tca-q", "charizard"); await wait(200); await p.click("#tca-list [data-n]"); await wait(200); await p.click("#tc-add [data-tca-close]"); await wait(300);
  const give = await p.evaluate(() => __w.tcTotal("give"));
  await p.click('#tc [data-side="get"] [data-price]'); await wait(200);
  await p.evaluate((v) => { const i = document.querySelector("#tc [data-price-in]"); i.value = v; }, (give * 1.02).toFixed(2)); await p.keyboard.press("Enter"); await wait(300);
  const fair = await tc();
  await p.click('#tc [data-add="give"]'); await wait(400); await p.type("#tca-amt", String(Math.round(give * 3))); await p.click("#tca-cash"); await wait(200); await p.click("#tc-add [data-tca-close]"); await wait(300);
  const uneven = await tc();
  R.push([`the trade checker says Fair, then Uneven with cash added (${fair}; ${uneven})`, fair === "Fair trade" && uneven === "Uneven, in their favor"]);
  await p.click("#tc [data-clear]"); await wait(200);
  // The lenses and Filters (the polish after round 21): the bar is Collection and Chase; Need is Show: Missing in
  // Filters. Every choice applies, is named in the chip beside the lenses while it's on, clears with the chip's X, and
  // is kept on the device. Group by flies every card to its new place; the order in a binder reshuffles the binder; the
  // Chase lens and the Feed sort.
  {
    await p.evaluate(() => {
      const at = Date.now() - 30 * 86400e3, owned = {}, chase = {};
      for (const c of __w.cards) { if (c.own0) owned[c.id] = { on: true, at }; else if (c.i % 2 === 0) chase[c.id] = true; }
      localStorage.clear();
      localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase));
      localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
      localStorage.setItem("wall-lens", "need"); // as the old Need lens left it
    });
    await p.reload({ waitUntil: "load" }); await wait(1200);
    const fl = () => p.evaluate(() => ({ lens: __w.state.lens, show: __w.state.show, value: __w.state.value, time: __w.state.time, mode: __w.mode, order: __w.state.order, corder: __w.state.corder, on: __w.filtersOn(), chip: document.getElementById("fchip").hidden ? null : document.getElementById("fchip-open").textContent, lit: document.getElementById("filter").getAttribute("aria-pressed") === "true", trans: __w.state.trans?.kind || null, view: __w.view, sheet: !document.getElementById("filter-menu").hidden, toast: document.getElementById("toast").textContent }));
    const sheet = async (sel) => { if (!(await fl()).sheet) { await p.evaluate(() => document.getElementById("toast").classList.remove("show")); await p.click("#filter"); await wait(150); } await p.click(sel); await wait(120); }; // a message in the bar covers Filters until it's tapped away (round 23)
    const done = async () => { if ((await fl()).sheet) { await p.click("#f-done"); await wait(150); } };
    const bar = await p.evaluate(() => [...document.querySelectorAll(".lens [data-lens]")].map((b) => `${b.dataset.lens}:${b.textContent}`).join(","));
    let s = await fl();
    R.push([`the bar is Collection and Chase, and the old Need lens comes back as Show: Missing (${bar})`, bar === "have:Collection,chase:Chase" && s.lens === "have" && s.show === "missing" && s.chip === "Missing" && s.lit]);
    // Show: Missing dims what you have and says what's left; the list follows; the chip's X clears it.
    await wait(500);
    const dim = () => p.evaluate(() => { const g = __w.groupsNow.find((x) => x.set && x.base.some((c) => c.owned) && x.base.some((c) => !c.owned)), o = g.base.find((c) => c.owned), m = g.base.find((c) => !c.owned); return { o: +o.e.toFixed(2), m: +m.e.toFixed(2), stat: __w.panelStat(g), left: g.base.filter((c) => !c.owned).length }; });
    let d = await dim();
    R.push([`Show: Missing dims what you have and the panel counts what's left (${d.stat})`, d.o <= 0.15 && d.m === 1 && d.stat === `${d.left} to go`]);
    await p.evaluate(() => { __w.setLens("chase"); }); await wait(1500);
    s = await fl(); R.push(["Show isn't named in Chase, where it doesn't apply", s.lens === "chase" && s.chip === null && !s.lit && s.show === "missing"]);
    await p.click('[data-lens="have"]'); await wait(1500);
    s = await fl(); R.push(["back in Collection the chip names it again, and the toast says so", s.chip === "Missing" && /Showing what's missing/.test(s.toast)]);
    await p.click("#fchip-clear"); await wait(600);
    s = await fl(); d = await dim();
    R.push(["the chip's X clears it: every card back, no chip, the button unlit", s.show === "all" && s.chip === null && !s.lit && d.o === 1 && d.m === 1 && /^\d+\/\d+$/.test(d.stat)]);
    // Each choice applies and clears: Have, Value, Time; two at once read "2 filters"; Clear filters in the sheet clears all.
    await sheet('[data-show="have"]'); await wait(500); d = await dim();
    R.push(["Show: Have dims what you're missing", d.o === 1 && d.m <= 0.15 && (await fl()).chip === "Have"]);
    await sheet('[data-color="value"]'); s = await fl();
    R.push(["Color by value turns Value on, and two filters read as two", s.value && s.chip === "2 filters" && s.on.join() === "Have,Value"]);
    await done(); s = await fl();
    R.push(["closing the sheet says the last change", /Your collection: about \$/.test(s.toast)]);
    await sheet('[data-filter="time"]'); await wait(300); s = await fl();
    R.push(["Time is a switch in the sheet; it plays and the chip counts it", s.time && !s.sheet && s.chip === "3 filters" && (await p.evaluate(() => document.body.classList.contains("timing")))]);
    await sheet("#f-clear"); await wait(600); s = await fl();
    R.push(["Clear filters in the sheet clears Show, Value and Time at once", !s.time && !s.value && s.show === "all" && s.chip === null && !s.sheet && s.toast === "Filters cleared"]);
    // Group by: every card flies to its new place and lands there.
    const landed = () => p.evaluate(() => { const gs = __w.groupsNow.filter((g) => !g.done && g.m), ids = new Set(); let inside = true; for (const g of gs) for (const c of g.cards) { ids.add(c.id); const m = c.m; if (!m || m.x < g.m.x - 1 || m.y < g.m.y - 1 || m.x + m.w > g.m.x + g.m.w + 1 || m.y + m.h > g.m.y + g.m.h + 1) inside = false; } return { names: gs.map((g) => g.name), n: ids.size, inside, trans: __w.state.trans?.kind || null }; });
    for (const [m, first, n] of [["rarity", "Special illustration rare", 7], ["type", "Fire", 13], ["value", "$100 and up", 5]]) {
      await sheet(`[data-group="${m}"]`); await wait(250);
      const mid = (await fl()).trans; await wait(1600);
      const L = await landed();
      R.push([`Group by ${m}: the cards fly (${mid}) and land in their new panels (${L.names.length}, ${L.names[0]})`, mid === "morph" && !L.trans && L.names[0] === first && L.names.length <= n && L.n === 1327 && L.inside && (await fl()).chip === `By ${m === "value" ? "price" : m}`]);
    }
    await sheet('[data-group="type"]'); await wait(200); await sheet('[data-group="rarity"]'); await wait(1800);
    let L = await landed(); R.push(["a second grouping mid-flight flies on from where the cards are and lands", !L.trans && L.names[0] === "Special illustration rare" && L.inside && L.n === 1327]);
    await sheet('[data-group="set"]'); await wait(1800); await done();
    L = await landed(); R.push(["Group by set flies them home: the sets, then your chases", !L.trans && L.names[0] === "Base Set" && L.inside && (await fl()).chip === null]);
    // The order in a binder: open a set, sort by price, name, rarity, and back to number.
    const g1 = await p.evaluate(() => { const g = __w.groupsNow.find((x) => x.set && x.base.length < 120); const m = g.m; return { name: g.name, x: m.x + m.w / 2, y: m.y + m.h / 2 - __w.mScroll }; });
    await p.evaluate((n) => __w.enterGroup(__w.groupsNow.find((x) => x.name === n)), g1.name); await wait(1300);
    const ord = () => p.evaluate(() => { const g = __w.state.g, L = g.cards; return { set: g.name, ks: L.every((c, k) => c.k === k), rows: L.every((c, k) => !k || c.y > L[k - 1].y || (c.y === L[k - 1].y && c.x > L[k - 1].x)), price: L.every((c, k) => !k || L[k - 1].price >= c.price), name: L.every((c, k) => !k || L[k - 1].name.localeCompare(c.name) <= 0), tier: L.every((c, k) => !k || L[k - 1].tier >= c.tier), num: L.every((c, k) => !k || L[k - 1].n0 < c.n0), shuffle: Boolean(__w.shuffle && __w.shuffle.g === g) }; });
    for (const [o, key] of [["price", "price"], ["name", "name"], ["rarity", "tier"], ["number", "num"]]) {
      await sheet(`[data-order="${o}"]`); await wait(120);
      const fly = (await ord()).shuffle; await wait(1000);
      const O = await ord();
      R.push([`a binder sorted by ${o}: its cards travel to their new pockets in that order`, (await fl()).view === "set" && O.set === g1.name && fly && O.ks && O.rows && O[key]]);
    }
    await done();
    await p.evaluate(() => __w.setOrder("price")); await wait(900);
    R.push(["a binder sorted by price says so in its header, and every binder follows", await p.evaluate(() => __w.orderNote(__w.state.g) === ". Dearest first" && __w.groupsNow.every((g) => g.natdex || g.cards.every((c, k) => !k || g.cards[k - 1].price >= c.price)))]);
    await p.click("#back"); await wait(1000);
    // The Chase lens sorts: best deal, dearest, cheapest to get now.
    await p.click('[data-lens="chase"]'); await wait(1600);
    const leads = () => p.evaluate(() => __w.groupsNow.filter((g) => !g.done && g.lead?.length > 1).map((g) => g.lead));
    const sorted = (o) => p.evaluate((o) => __w.groupsNow.filter((g) => !g.done && g.lead?.length > 1).every((g) => g.lead.every((c, k) => !k || (o === "dear" ? g.lead[k - 1].price >= c.price : o === "cheap" ? __w.nowPrice(g.lead[k - 1]) <= __w.nowPrice(c) : (g.lead[k - 1].deal ? 1 : 0) >= (c.deal ? 1 : 0)))), o);
    let okDeal = await sorted("deal");
    await sheet('[data-corder="cheap"]'); const cf = (await fl()).trans; await wait(1700);
    const okCheap = await sorted("cheap");
    await sheet('[data-corder="dear"]'); await wait(1700); await done();
    const okDear = await sorted("dear");
    R.push([`the Chase lens sorts its tiles: best deal, cheapest, dearest (the change flies: ${cf})`, (await leads()).length > 2 && okDeal && okCheap && okDear && cf === "morph" && (await fl()).corder === "dear" && /dearest first/.test((await fl()).toast)]);
    // Everything is kept on the device.
    await p.evaluate(() => { __w.setLens("have"); __w.setShow("missing"); __w.rearrange("rarity"); }); await wait(1800);
    await p.reload({ waitUntil: "load" }); await wait(1200);
    s = await fl();
    R.push(["every choice is kept on the device", s.show === "missing" && s.mode === "rarity" && s.order === "price" && s.corder === "dear" && s.chip === "2 filters"]);
    // Trophies and back (round 22 polish): the trophy room lives on the set wall, but leaving it gives the wall back
    // exactly as it was, Group by and all.
    await p.evaluate(() => __w.goRoom("medal")); await wait(1500);
    const inTrophies = await p.evaluate(() => ({ room: __w.room.on, filter: getComputedStyle(document.getElementById("filter")).display }));
    await p.evaluate(() => __w.goRoom("chase")); await wait(1500);
    const backFrom = await fl();
    R.push([`opening Trophies and coming back keeps Group by (${backFrom.mode}, ${backFrom.chip})`, inTrophies.room && backFrom.mode === "rarity" && backFrom.show === "missing" && backFrom.chip === "2 filters"]);
    await p.evaluate(() => document.getElementById("to-list").click()); await wait(400);
    const lv = await p.evaluate(() => { const rows = [...document.querySelectorAll("#list-body section:not([data-sec]) [data-i]")]; return { n: rows.length, owned: rows.filter((r) => r.getAttribute("aria-pressed") === "true").length, h: [...document.querySelectorAll("#list-body h2")].map((h) => h.textContent).slice(1, 3).join(", ") }; });
    await p.evaluate(() => document.getElementById("to-wall").click()); await wait(400);
    R.push([`the list follows: Show: Missing lists only what's missing, in the rarity groups (${lv.n} rows; ${lv.h})`, lv.n > 100 && lv.owned === 0 && /rare/i.test(lv.h)]);
    await p.evaluate(() => __w.clearFilters()); await wait(1800);
    // The Feed: sorted four ways; condition and damaged copies filtered as production does, everywhere it's counted.
    await p.evaluate(() => __w.goRoom("feed")); await wait(1000);
    const feedRows = () => p.evaluate(() => { const ids = [...document.querySelectorAll("#pf-list [data-l]")].map((b) => b.dataset.l), all = __w.cards.flatMap((c) => __w.listingsOf(c)), byId = new Map(all.map((L) => [L.id, L])); return { rows: ids.map((id) => { const L = byId.get(id); return { score: __w.scoreOf(L).score, price: L.price, pct: __w.pctOf(L), seen: L.seen, cond: L.cond }; }), hidden: document.getElementById("pf-hidden").hidden ? "" : document.getElementById("pf-hidden").textContent, all: all.filter((L) => !__w.srcState.off.has(L.src)).length, list: __w.feedList().length }; });
    let F = await feedRows();
    const inOrder = (rows, f) => rows.every((r, k) => !k || f(rows[k - 1], r));
    R.push([`the Feed starts newest first, damaged copies hidden as in production (${F.rows.length} of ${F.all})`, F.rows.length > 10 && inOrder(F.rows, (a, b) => a.seen >= b.seen) && F.rows.every((r) => r.cond !== "HP") && F.rows.length === F.list && (F.all === F.rows.length || /hidden/.test(F.hidden))]);
    const cond = await p.evaluate(() => { const s = document.getElementById("pf-cond"); return s.options[s.selectedIndex].textContent; });
    R.push([`the Feed's default condition says what it hides ("${cond}")`, cond !== "Any condition" && /damaged/i.test(cond)]);
    // Filters are the wall's: in every room but Chase the button is gone (search stays: it takes you to the wall).
    const fbtn = [];
    for (const id of ["feed", "trade", "medal", "source", "chase"]) { await p.evaluate((id) => __w.goRoom(id), id); await wait(1300); fbtn.push([id, await p.evaluate(() => getComputedStyle(document.getElementById("filter")).display !== "none"), await p.evaluate(() => getComputedStyle(document.getElementById("search")).display !== "none")]); }
    R.push([`Filters shows only in Chase; search in every room (${fbtn.map(([id, f]) => `${id} ${f ? "on" : "off"}`).join(", ")})`, fbtn.every(([id, f, q]) => f === (id === "chase") && q)]);
    await p.evaluate(() => __w.goRoom("feed")); await wait(1300);
    for (const [v, f] of [["best", (a, b) => a.score >= b.score], ["price", (a, b) => a.price <= b.price], ["pct", (a, b) => a.pct >= b.pct]]) {
      await p.select("#pf-sort", v); await wait(250); F = await feedRows();
      R.push([`the Feed sorts by ${v}`, F.rows.length > 10 && inOrder(F.rows, f)]);
    }
    await p.select("#pf-cond", "NM"); await wait(250); F = await feedRows();
    const nm = F;
    await p.select("#pf-cond", "any"); await wait(250); F = await feedRows();
    R.push([`Near Mint keeps only NM and unstated titles (${nm.rows.length}); Any, damaged too brings every listing back (${F.rows.length})`, nm.rows.length < F.rows.length && nm.rows.every((r) => !r.cond || r.cond === "NM") && /hidden by the condition you picked/.test(nm.hidden) && F.rows.length === F.all && !F.hidden && F.list === F.rows.length]);
    await p.select("#pf-cond", "LP"); await wait(200);
    await p.reload({ waitUntil: "load" }); await wait(1200); await p.evaluate(() => __w.goRoom("feed")); await wait(1000);
    const fv = await p.evaluate(() => ({ ...__w.feedView, sel: document.getElementById("pf-sort").value }));
    R.push(["the Feed's sort and filters are kept on the device", fv.sort === "pct" && fv.cond === "LP" && fv.sel === "pct" && (await p.evaluate(() => document.getElementById("pf-cond").value)) === "LP"]);
    await p.evaluate(() => { __w.setFeedView({ sort: "newest", cond: "" }); __w.goRoom("chase"); }); await wait(900);
  }
  // The Complete Dex: added from the New chase sheet, a panel on the wall with one slot for each of the 1,025 Pokémon.
  await p.evaluate(() => {
    const at = Date.now() - 30 * 86400e3, owned = {};
    for (const c of __w.cards) if (c.own0) owned[c.id] = { on: true, at };
    localStorage.clear();
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(900);
  const x = await installTouch(p);
  const dex = () => p.evaluate(() => { const g = __w.dexGroup; return g ? { on: __w.groupsNow.includes(g), n: g.base.length, have: g.base.filter((c) => c.owned).length, label: g.name, m: Boolean(g.m), view: __w.view, inside: __w.state.g === g, chases: __w.chases.filter((r) => r.kind === "natdex").length } : { on: false, view: __w.view, chases: __w.chases.filter((r) => r.kind === "natdex").length }; });
  for (let k = 0; k < 14; k++) { const y = await p.evaluate(() => __w.newPanel && __w.newPanel.y - __w.mScroll); if (y > 120 && y < 680) break; await x.drag(200, 650, 250, 120); await wait(250); }
  const np = await p.evaluate(() => ({ x: __w.newPanel.x + __w.newPanel.w / 2, y: __w.newPanel.y + __w.newPanel.h / 2 - __w.mScroll }));
  await x.tap(np.x, np.y); await wait(700);
  await p.click("#cs-dex"); await wait(200); await p.click("#cs-save"); await wait(1800);
  let dx = await dex(); R.push(["adding the Complete Dex from the New chase sheet puts its panel on the wall", dx.on && dx.m && dx.n === 1025 && dx.label === "Complete Dex"]);
  for (let k = 0; k < 14; k++) { const y = await p.evaluate(() => __w.dexGroup.m.y - __w.mScroll); if (y > 100 && y < 600) break; await x.drag(200, y < 100 ? 250 : 650, y < 100 ? 650 : 250, 120); await wait(250); }
  const dp = await p.evaluate(() => { const m = __w.dexGroup.m; return { x: m.x + m.w / 2, y: Math.min(700, m.y + 80 - __w.mScroll) }; });
  await x.tap(dp.x, dp.y); await wait(1300); dx = await dex(); R.push(["tapping the Dex panel opens its binder", dx.view === "set" && dx.inside]);
  // Mark a slot your sets can fill: its card is yours and the Dex's count ticks up.
  const onScreen = (pick) => p.evaluate((pick) => { const g = __w.dexGroup, C = __w.cam, s = g.cards.find((c) => (pick === "ph" ? c.ph : !c.ph && !c.owned)); C.y = Math.max(C.y, s.y - 320 / C.s); __w.kick(); return { dex: s.dexN, id: s.base?.id || null }; }, pick);
  const slotAt = (n) => p.evaluate((n) => { const g = __w.dexGroup, C = __w.cam, s = g.cards.find((c) => c.dexN === n); return { x: (s.x - C.x) * C.s + 31 * C.s, y: (s.y - C.y) * C.s + 44 * C.s, owned: s.owned, ph: s.ph, base: s.base ? s.base.owned : null }; }, n);
  const s0 = await onScreen("fill"); await wait(400);
  await p.click("#mark"); await wait(300);
  let sa = await slotAt(s0.dex); await x.tap(sa.x, sa.y); await wait(700);
  sa = await slotAt(s0.dex); const d1 = await dex();
  R.push(["marking a Dex slot owns its card and ticks the count", sa.owned && sa.base === true && d1.have === dx.have + 1 && (await p.evaluate((id) => __w.cards.find((c) => c.id === id).owned, s0.id))]);
  await p.click("#m-done"); await wait(400);
  // A Pokémon with no card in the wall's sets: its pocket can't be marked, and a tap says so.
  const s1 = await onScreen("ph"); await wait(400);
  sa = await slotAt(s1.dex); await x.tap(sa.x, sa.y); await wait(500);
  const said = await p.evaluate(() => document.getElementById("toast").textContent);
  await p.click("#mark"); await wait(300); sa = await slotAt(s1.dex); await x.tap(sa.x, sa.y); await wait(500);
  sa = await slotAt(s1.dex); const d2 = await dex();
  R.push(["a Dex slot for a Pokémon with no card can't be marked", sa.ph && !sa.owned && d2.have === d1.have && /in your sets/.test(said) && !(await p.evaluate(() => __w.state.focus))]);
  await p.click("#m-done"); await wait(400);
  // Its settings in place: Full art only, the count and the slots change.
  await p.evaluate(() => { Object.assign(__w.cam, { y: -(70 + 6) / __w.cam.s }); __w.kick(); }); await wait(400);
  const hdr = (which) => p.evaluate((which) => { const g = __w.dexGroup, C = __w.cam, k = (g.head * C.s) / (132 + g.popH), sx = (g.x - C.x) * C.s, y0 = (g.y - C.y) * C.s + 132 * k, b = which === "full" ? g.dexSeg[2] : g.hdrBtn; return { x: sx + (b.x + b.w / 2) * k, y: y0 + (b.y + b.h / 2) * k }; }, which);
  const own1 = await slotAt(1);
  let hb = await hdr("full"); await x.tap(hb.x, hb.y); await wait(1200);
  const d3 = await dex(), own1b = await slotAt(1);
  R.push(["switching the Dex to Full art changes its count and its slots", d3.label === "Full art Dex" && d3.n === 1025 && d3.have < d2.have && own1.owned && !own1b.owned]);
  // Remove chase takes it off, and Undo puts it back.
  hb = await hdr("remove"); await x.tap(hb.x, hb.y); await wait(1500);
  const d4 = await dex();
  await p.evaluate(() => document.querySelector("#toast .toast-btn")?.click()); await wait(1500);
  const d5 = await dex();
  R.push(["Remove chase takes the Dex off the wall, and Undo puts it back", !d4.on && d4.chases === 0 && d4.view === "mosaic" && d5.on && d5.chases === 1 && d5.label === "Full art Dex"]);
  // The import's reveal (round 20): a fresh wall, the welcome's Import, TCGplayer. The collection plays in the order it
  // was got, then "Import complete" comes up with its rows.
  const imp = () => p.evaluate(() => ({ story: Boolean(__w.story), sum: __w.summary.on, rows: __w.summary.rows.map((r) => r.id), my: Math.round(__w.mScroll), view: __w.view, set: __w.state.g?.name, rings: __w.rings, n: __w.groups.reduce((a, g) => a + (g.set ? g.base.filter((c) => c.owned).length : 0), 0), storying: document.body.classList.contains("storying"), arriving: document.body.classList.contains("arriving"), toast: document.getElementById("toast").classList.contains("show") ? document.getElementById("toast").textContent : "", mpop: document.getElementById("mpop").classList.contains("show") }));
  const importFresh = async () => {
    await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "load" }); await wait(3200);
    await p.click("#w-next"); await wait(300); await p.click('[data-src="TCGplayer"]');
    return Date.now();
  };
  const untilSheet = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await imp()).sum) return true; await wait(100); } return false; };
  let tap = await importFresh(); await wait(3500);
  const mid = await imp();
  R.push(["the import plays the collection in the order it was got", mid.story && mid.storying && mid.n > 0 && mid.n < 541]);
  const reached = await untilSheet(30000), took = (Date.now() - tap) / 1000, done1 = await imp();
  console.log(`  [dpr ${dpr}] the import took ${took.toFixed(1)} s from the tap to the summary`);
  R.push(["the story ends home at the top with the summary and its rows", reached && !done1.story && done1.my === 0 && done1.n === 541 && ["near", "md", "tb"].every((id) => done1.rows.includes(id)) && !done1.mpop && !done1.toast]);
  const nearSet = await p.evaluate(() => /^(.*), \d+ to go$/.exec(__w.summary.rows.find((r) => r.id === "near").title)[1]);
  // Wait for the sheet to finish sliding up before tapping its row (a tap mid-slide can land on the row below).
  for (let k = 0, last = null; k < 40; k++) { const y = await p.evaluate(() => document.querySelector('[data-ar="near"]')?.getBoundingClientRect().top ?? -1); if (y === last && y > 0) break; last = y; await wait(80); }
  await p.click('[data-ar="near"]'); await wait(2600);
  const ring = await imp(), gaps = await p.evaluate(() => __w.gaps(__w.state.g).filter((r) => r.y > 70 && r.y < 772).length);
  R.push(["the closest-to-done row opens that set with its missing pockets ringed", ring.view === "set" && ring.set === nearSet && ring.rings?.set === nearSet && gaps > 0 && !ring.sum]);
  const y = await installTouch(p);
  await y.drag(195, 600, 450, 200); await wait(600);
  R.push(["the rings fade on the first touch", !(await imp()).rings]);
  // A drag during the story ends it there, and the drag scrolls; the totals come as a toast with Open, not the sheet.
  tap = await importFresh(); await wait(5000);
  const z = await installTouch(p), my0 = (await imp()).my;
  await z.drag(200, 650, 300, 200); await wait(500);
  const took2 = await imp(); await wait(2500); const later = await imp();
  R.push(["a drag during the story ends it and the wall scrolls", !took2.story && !took2.storying && took2.n === 541 && Math.abs(took2.my - my0) > 40]);
  R.push(["after a drag the totals come as a toast with Open, not the sheet", /541 cards imported/.test(took2.toast) && /Open/.test(took2.toast) && !took2.sum && !later.sum && !later.arriving]);
  await p.evaluate(() => document.querySelector("#toast .toast-btn").click()); await wait(700);
  R.push(["Open in the toast brings up the summary", (await imp()).sum]);
  await p.click("[data-ar-close]"); await wait(600);
  const shut = await imp();
  await p.reload({ waitUntil: "load" }); await wait(3200);
  R.push(["See your wall closes the summary for good", !shut.sum && !shut.arriving && !(await imp()).sum]);
  // Skip goes straight to the summary.
  await importFresh(); await wait(2500);
  await p.click(".st-skip"); await wait(700);
  const sk = await imp();
  R.push(["Skip goes straight to the summary", !sk.story && sk.sum && sk.n === 541 && sk.my === 0]);
  await p.click("[data-ar-close]"); await wait(400);
  // Afterwards the story's moments are dots on the Time slider.
  await p.click("#filter"); await wait(150); await p.click('[data-filter="time"]'); await wait(600);
  R.push(["the story's moments sit on the Time slider as dots", (await p.evaluate(() => document.querySelectorAll(".timebar .t-marks i").length)) >= 4]);
  await p.click("#filter"); await wait(150); await p.click('[data-filter="time"]'); await wait(300);
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  failures += report(R, `[dpr ${dpr}] `);
  await p.close();
}
await browser.close();
console.log(failures ? `\n${failures} gesture check(s) failed.` : "\nAll gesture checks passed.");
process.exit(failures ? 1 : 0);
