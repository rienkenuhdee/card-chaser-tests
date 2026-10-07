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
  // Round 22: card pictures. A set you own, with a picture for every card in it (made up in the page, through the real
  // loading path), scrolled through so they're all in; then the binder at rest (foil on), and a pinch held most of the
  // way into it, where every tile on screen is a picture.
  let pics = null;
  if (__w.artInject) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), g = __w.groups[1];
    for (const c of g.cards) c.owned = true;
    __w.artInject(g.cards.map((c) => c.id));
    __w.enterGroup(g); await sleep(1500);
    for (let k = 0; k < 6; k++) { __w.cam.y += innerHeight / __w.cam.s * 0.7; __w.kick(); await sleep(400); }
    for (let k = 0; k < 6; k++) { __w.cam.y -= innerHeight / __w.cam.s * 0.7; __w.kick(); await sleep(400); }
    const binder = await time(), n = __w.art.ready;
    const C = { ...__w.cam };
    document.getElementById("back").click(); await sleep(1200);
    __w.state.trans = { kind: "open", g, q: 0.85, cam: C, done: () => {} };
    const pinch = await time();
    __w.state.trans = null;
    pics = { binder, pinch, n };
  }
  return { mosaic, pinch, map, pics };
});
console.log(`mosaic ${t.mosaic.toFixed(1)}ms per frame, held pinch ${t.pinch.toFixed(1)}ms per frame${t.map != null ? `, held pinch up to the map ${t.map.toFixed(1)}ms per frame` : ""}`);
if (t.pics) console.log(`with ${t.pics.n} card pictures in: a binder at rest ${t.pics.binder.toFixed(1)}ms per frame, a pinch held into it ${t.pics.pinch.toFixed(1)}ms per frame`);
const bad = report([["the mosaic draws within 34ms", t.mosaic < 34], ["a held pinch draws within 34ms", t.pinch < 34], ...(t.map != null ? [["a held pinch up to the map draws within 34ms", t.map < 34]] : []),
  ...(t.pics ? [[`a binder of pictures draws within 34ms (${t.pics.n} pictures in)`, t.pics.n > 0 && t.pics.binder < 34], ["a pinch held into a binder of pictures draws within 34ms", t.pics.pinch < 34]] : [])]);
await browser.close();
process.exit(bad ? 1 : 0);
