// Frame budget on the software canvas (slower than a phone's GPU canvas, so passing here leaves headroom on a device).
// The held-pinch frame is the one that matters: if it's slow, pinches lag and snapping misreads your speed.
//   node tests/perf.mjs [--variant name]
import { write } from "../scripts/build.mjs";
import { launch, phone, report } from "./browser.mjs";

const variant = process.argv.includes("--variant") ? process.argv[process.argv.indexOf("--variant") + 1] : null;
const { file } = write({ variant, debug: true });
const browser = await launch();
const p = await phone(browser, file, { dpr: 2 });
const t = await p.evaluate(async () => {
  const time = async () => { const ts = []; await new Promise((res) => { const f = (x) => { ts.push(x); __w.kick(); if (ts.length < 16) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); return (ts[15] - ts[0]) / 15; };
  const mosaic = await time();
  __w.state.trans = { kind: "open", g: __w.groups[1], q: 0.5, cam: { s: 1.3, x: -9, y: -58 }, done: () => {} };
  const pinch = await time();
  __w.state.trans = null;
  // Round 21: the wall held half way up to the map (drawn live into its card, the other rooms coming in around it).
  let map = null;
  if (__w.beginMap) {
    const T = __w.beginMap("chase", "out"); T.q = 0.5;
    map = await time();
    T.anim = { from: 0.5, to: 0, t0: performance.now(), dur: 1 }; await new Promise((r) => setTimeout(r, 200));
  }
  return { mosaic, pinch, map };
});
console.log(`mosaic ${t.mosaic.toFixed(1)}ms per frame, held pinch ${t.pinch.toFixed(1)}ms per frame${t.map != null ? `, held pinch up to the map ${t.map.toFixed(1)}ms per frame` : ""}`);
// Round 22: a phone on its side (more of the wall on screen at once), and the trade binder's two facing pages held mid-turn.
const q = await phone(browser, file, { dpr: 2, width: 844, height: 390 });
await q.evaluate(() => {
  const at = Date.now() - 30 * 86400e3, owned = {}, copies = {};
  for (const c of __w.cards) if (c.own0) { owned[c.id] = { on: true, at }; if (c.i % 4 === 0) copies[c.id] = { n: 2, got: at }; }
  localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-copies", JSON.stringify(copies));
  localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
});
await q.reload({ waitUntil: "load" }); await new Promise((r) => setTimeout(r, 1500));
const u = await q.evaluate(async () => {
  const time = async () => { const ts = []; await new Promise((res) => { const f = (x) => { ts.push(x); __w.kick(); if (ts.length < 16) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); return (ts[15] - ts[0]) / 15; };
  const mosaic = await time();
  __w.state.trans = { kind: "open", g: __w.groups[1], q: 0.5, cam: { s: 1.3, x: -9, y: -58 }, done: () => {} };
  const pinch = await time();
  __w.state.trans = null;
  const T = __w.beginMap("chase", "out"); T.q = 0.5;
  const map = await time();
  T.anim = { from: 0.5, to: 0, t0: performance.now(), dur: 1 }; await new Promise((r) => setTimeout(r, 300));
  let turn = null;
  if (__w.openBinder && __w.tbList().length) {
    __w.openBinder(); await new Promise((r) => setTimeout(r, 1600));
    if (__w.bnd.on) { __w.bnd.turn = 0.3; await time(); turn = await time(); __w.bnd.turn = 0; __w.closeBinder(true); }
  }
  return { mosaic, pinch, map, turn };
});
console.log(`on its side: mosaic ${u.mosaic.toFixed(1)}ms per frame, held pinch ${u.pinch.toFixed(1)}ms per frame, held pinch up to the map ${u.map.toFixed(1)}ms per frame${u.turn != null ? `, the binder's spread held mid-turn ${u.turn.toFixed(1)}ms per frame` : ""}`);
const bad = report([["the mosaic draws within 34ms", t.mosaic < 34], ["a held pinch draws within 34ms", t.pinch < 34], ...(t.map != null ? [["a held pinch up to the map draws within 34ms", t.map < 34]] : []),
  ["on its side, the mosaic draws within 34ms", u.mosaic < 34], ["on its side, a held pinch draws within 34ms", u.pinch < 34], ["on its side, a held pinch up to the map draws within 34ms", u.map < 34], ...(u.turn != null ? [["on its side, a page turn held under the thumb draws within 34ms", u.turn < 34]] : [])]);
await browser.close();
process.exit(bad ? 1 : 0);
