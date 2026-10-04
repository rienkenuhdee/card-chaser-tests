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
  return { mosaic, pinch };
});
console.log(`mosaic ${t.mosaic.toFixed(1)}ms per frame, held pinch ${t.pinch.toFixed(1)}ms per frame`);
const bad = report([["the mosaic draws within 34ms", t.mosaic < 34], ["a held pinch draws within 34ms", t.pinch < 34]]);
await browser.close();
process.exit(bad ? 1 : 0);
