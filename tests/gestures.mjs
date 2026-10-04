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
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  failures += report(R, `[dpr ${dpr}] `);
  await p.close();
}
await browser.close();
console.log(failures ? `\n${failures} gesture check(s) failed.` : "\nAll gesture checks passed.");
process.exit(failures ? 1 : 0);
