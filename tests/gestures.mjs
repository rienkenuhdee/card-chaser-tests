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
  // The trophy room: a set finished two days ago sits behind the door at the end of the wall.
  await p.evaluate(() => {
    const g = __w.groups.filter((x) => x.set).sort((a, b) => a.base.length - b.base.length)[0], at = Date.now() - 2 * 86400e3, owned = {};
    for (const c of g.base) owned[c.id] = { on: true, at };
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-imported", "1"); localStorage.setItem("wall-welcomed", "1");
    localStorage.setItem("wall-done", JSON.stringify({ [`${g.set.id}|set`]: { at, put: true } }));
  });
  await p.reload({ waitUntil: "load" }); await wait(900);
  const u = await installTouch(p);
  const rm = () => p.evaluate(() => ({ on: __w.room.on, q: __w.room.q, view: __w.view, my: Math.round(__w.mScroll) }));
  const d = await p.evaluate(() => __w.trophyCase); R.push(["a trophy past its day sits behind the door", Boolean(d)]);
  if (d) {
    const toDoor = async () => { for (let k = 0; k < 12; k++) { const r = await p.evaluate(() => ({ y: __w.trophyCase.y - __w.mScroll })); if (r.y > 120 && r.y < 640) return r; await u.drag(200, 650, 250, 120); await wait(250); } return p.evaluate(() => ({ y: __w.trophyCase.y - __w.mScroll })); };
    let r = await toDoor(); const wallAt = (await rm()).my;
    await u.tap(195, r.y + 32); await wait(900); R.push(["tapping the door opens the room", (await rm()).on && (await rm()).q === 1]);
    // Something in the room (a rect in room coordinates) dragged into view, then where it is on screen.
    const inView = async (get) => { for (let k = 0; k < 10; k++) { const r = await get(); if (!r) return null; const y = r.y - (await rm()).my; if (y > 110 && y < 640) return { x: r.x, y }; const d = Math.max(-440, Math.min(440, y - 380)); await u.drag(200, d > 0 ? 680 : 220, (d > 0 ? 680 : 220) - d, Math.max(160, Math.abs(d) / 0.15)); await wait(300); } return null; }; // slow enough not to fling
    const pl = await inView(() => p.evaluate(() => { const g = __w.caseList()[0]; return { x: g.m.x + g.m.w / 2, y: g.m.y + 40 }; }));
    if (pl) await u.tap(pl.x, pl.y); await wait(1000); R.push(["a plaque in the room opens its album", (await rm()).view === "set"]);
    await p.click("#back"); await wait(900); R.push(["back from the album returns to the room", (await rm()).on && (await rm()).view === "mosaic"]);
    await u.pinch(195, 450, 220, 120, 90); await wait(900); R.push(["a quick pinch in the room closes it where the wall was", !(await rm()).on && Math.abs((await rm()).my - wallAt) < 4]);
    r = await toDoor(); await u.pinch(195, r.y + 32, 40, 120, 160); await wait(900); R.push(["a spread on the door opens the room", (await rm()).on]);
    await p.click("#back"); await wait(900); R.push(["back closes the room", !(await rm()).on]);
    // The finished set's shelf: its plaque at the head, Binder Complete mounted on it, its other medals hanging beneath.
    r = await toDoor(); await u.tap(195, r.y + 32); await wait(900);
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
  // The trade binder: an imported collection with spare copies, the Trade lens up, the binder's cover at its top.
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
  const cover = () => p.evaluate(() => { const m = __w.COVER.m; return m ? { x: m.x + m.w / 2, y: m.y + m.h / 2 - __w.mScroll } : null; });
  await p.click('[data-lens="trade"]'); await wait(1600);
  let cv = await cover(); R.push(["the Trade lens shows the binder's cover", Boolean(cv) && cv.y > 60 && cv.y < 300 && (await bd()).n > 18]);
  const openIt = async () => { cv = await cover(); await v.tap(cv.x, cv.y); await wait(900); };
  await openIt(); R.push(["tapping the cover opens the binder", (await bd()).on && (await bd()).q === 1]);
  await v.drag(300, 450, 450, 120, -200); await wait(700); R.push(["a sideways flick turns the page", (await bd()).vi === 1]);
  await v.drag(100, 450, 450, 120, 200); await wait(700); R.push(["a flick the other way turns it back", (await bd()).vi === 0]);
  await p.click("#back"); await wait(900); R.push(["back closes the binder", !(await bd()).on]);
  await openIt(); await v.pinch(195, 450, 220, 195, 320, 250); await wait(800); R.push(["a slow small pinch stays in the binder", (await bd()).on]);
  await v.pinch(195, 450, 220, 120, 90); await wait(900); R.push(["a quick pinch closes the binder", !(await bd()).on]);
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
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  failures += report(R, `[dpr ${dpr}] `);
  await p.close();
}
await browser.close();
console.log(failures ? `\n${failures} gesture check(s) failed.` : "\nAll gesture checks passed.");
process.exit(failures ? 1 : 0);
