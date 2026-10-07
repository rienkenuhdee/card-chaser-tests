// Canvas memory (round 21): iOS Safari caps what all of a page's canvases may hold together, and counts a canvas
// that's no longer used until it's collected. Past the cap a canvas stops drawing, which on an iPhone read as a
// blank screen on pinching the wall closed. This counts every canvas the page ever creates (their backing stores,
// width x height x 4 bytes, the wall's own canvas included) on a phone at dpr 3, after going into and out of every
// room five times, and checks it stays near the wall's own figure and doesn't grow with each visit.
//   node tests/memory.mjs [--variant name] [--file path/to/debug.html]
import { write } from "../scripts/build.mjs";
import { launch, wait, report } from "./browser.mjs";

const arg = (n) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : null);
const file = arg("file") || write({ variant: arg("variant"), debug: true }).file;
const ROUNDS = 5, BUDGET = 36; // MB, all canvases together (the wall's own canvas is 11.9 of it at dpr 3)
const browser = await launch();
const p = await browser.newPage();
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
await p.setRequestInterception(true);
p.on("request", (r) => (r.url().startsWith("file:") ? r.continue() : r.abort()));
const errors = []; p.on("pageerror", (e) => errors.push(e.message));
await p.evaluateOnNewDocument(() => {
  const all = (window.__canvases = []), ce = Document.prototype.createElement;
  Document.prototype.createElement = function (t, ...a) { const el = ce.call(this, t, ...a); if (String(t).toLowerCase() === "canvas") all.push(el); return el; };
  if (window.OffscreenCanvas) { const O = window.OffscreenCanvas; window.OffscreenCanvas = function (w, h) { const c = new O(w, h); all.push(c); return c; }; }
});
await p.goto(`file://${file}`);
// An imported wall chasing what it's missing, with spares and a finished set (so every room has something to draw).
await p.evaluate(() => {
  const at = Date.now() - 30 * 86400e3, owned = {}, chase = {}, copies = {};
  const g = __w.groups.filter((x) => x.set).sort((a, b) => a.base.length - b.base.length)[0];
  for (const c of __w.cards) { if (c.own0 || g.base.includes(c)) { owned[c.id] = { on: true, at }; if (c.i % 4 === 0) copies[c.id] = { n: 2, got: at }; } else chase[c.id] = true; }
  localStorage.clear();
  localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase)); localStorage.setItem("wall-copies", JSON.stringify(copies));
  localStorage.setItem("wall-done", JSON.stringify({ [`${g.set.id}|set`]: { at: Date.now() - 2 * 86400e3, put: true } }));
  localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
});
await p.reload({ waitUntil: "load" }); await wait(3200);
const bytes = () => p.evaluate(() => { const set = new Set([...window.__canvases, ...document.querySelectorAll("canvas")]); let b = 0; for (const c of set) b += c.width * c.height * 4; return { mb: b / 1048576, n: set.size }; });
const rooms = await p.evaluate(() => Boolean(window.__w.openPlace && window.__w.toMap));
const atLoad = await bytes();
const per = [];
for (let k = 0; k < ROUNDS; k++) {
  if (rooms) {
    for (const id of ["feed", "chase", "trade", "medal", "source"]) {
      await p.evaluate(() => __w.toMap()); await wait(900);
      await p.evaluate((id) => __w.openPlace(id), id); await wait(900);
    }
    await p.evaluate(() => __w.toMap()); await wait(900); await p.evaluate(() => __w.openPlace("chase")); await wait(900);
  } else { // the wall before rooms: its own levels, the trophy room and the trade binder
    await p.evaluate(() => __w.openRoom()); await wait(900); await p.evaluate(() => __w.closeRoom()); await wait(900);
    await p.evaluate(() => __w.openBinder()); await wait(900); await p.evaluate(() => __w.closeBinder()); await wait(900);
  }
  per.push(await bytes());
}
const last = per[per.length - 1], grew = last.mb - per[0].mb, made = last.n - per[0].n;
console.log(`canvas memory at dpr 3: ${atLoad.mb.toFixed(1)} MB at load (${atLoad.n} canvases); after ${ROUNDS} rounds through every room ${per.map((x) => x.mb.toFixed(1)).join(", ")} MB (${last.n} canvases, ${made} new after the first round)`);
const bad = report([
  [`every canvas together stays under ${BUDGET} MB at dpr 3 (${last.mb.toFixed(1)} MB)`, last.mb < BUDGET],
  [`going in and out of the rooms again makes no new canvases (${made} new, ${grew.toFixed(1)} MB)`, made === 0 && grew < 0.5],
  [`no page errors${errors.length ? `: ${errors[0]}` : ""}`, !errors.length],
]);
await browser.close();
process.exit(bad ? 1 : 0);
