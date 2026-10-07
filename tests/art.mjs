// Card pictures (round 22 polish): the real addresses, served here by the test in place of the image hosts (the
// sandbox can't reach them), so the whole path runs: lazy requests for the cards on screen, CORS, decode, the cache and
// its cap, a failure falling back to the drawn face, a blocked host given up on, and a canvas that stays readable.
//   node tests/art.mjs [--variant name]
import zlib from "node:zlib";
import { write } from "../scripts/build.mjs";
import { launch, wait, report } from "./browser.mjs";

const variant = process.argv.includes("--variant") ? process.argv[process.argv.indexOf("--variant") + 1] : null;
const { file } = write({ variant, debug: true });

// A plain PNG (one colour, opaque) for a picture: magenta, so it can be told from any drawn face.
function png(w, h, [r, g, b]) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const SMALL = png(245, 342, [255, 0, 255]), LARGE = png(734, 1024, [255, 0, 255]);

const browser = await launch();
const R = [];
// mode: "serve" answers the hosts with pictures (with CORS), except the cards in `broken` (404) and `nocors` (no
// Access-Control-Allow-Origin); "block" aborts them, as this sandbox's network does.
async function page(mode, { broken = new Set(), nocors = new Set(), dpr = 2 } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  p.reqs = []; p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.setRequestInterception(true);
  p.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("file:") || u.startsWith("data:")) return r.continue();
    const m = u.match(/^https:\/\/images\.pokemontcg\.io\/([^/]+)\/([^/_.]+)(_hires)?\.png$/) || u.match(/^https:\/\/images\.scrydex\.com\/pokemon\/([^/-]+)-([^/]+)\/(large|small)$/);
    if (!m) return r.abort();
    p.reqs.push(u);
    if (mode === "block") return r.abort("blockedbyclient");
    const id = `${m[1]}-${decodeURIComponent(m[2])}`;
    if (broken.has(id)) return r.respond({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "" });
    r.respond({ status: 200, contentType: "image/png", headers: nocors.has(id) ? {} : { "access-control-allow-origin": "*" }, body: m[3] === "_hires" || m[3] === "large" ? LARGE : SMALL });
  });
  await p.evaluateOnNewDocument(() => {
    const all = (window.__canvases = []), ce = Document.prototype.createElement;
    Document.prototype.createElement = function (t, ...a) { const el = ce.call(this, t, ...a); if (String(t).toLowerCase() === "canvas") all.push(el); return el; };
  });
  await p.goto(`file://${file}`);
  await p.evaluate(() => { // an imported wall, chasing what it's missing, with spares
    const at = Date.now() - 30 * 86400e3, owned = {}, chase = {}, copies = {};
    for (const c of __w.cards) { if (c.own0) { owned[c.id] = { on: true, at }; if (c.i % 4 === 0) copies[c.id] = { n: 2, got: at }; } else chase[c.id] = true; }
    localStorage.clear();
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase)); localStorage.setItem("wall-copies", JSON.stringify(copies));
    localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(1500);
  return p;
}
const openSet = (p, id) => p.evaluate((id) => __w.enterGroup(__w.groups.find((g) => g.set?.id === id)), id);
// The owned cards of the open set and where they are on screen (their faces are what can show a picture).
const onScreen = (p) => p.evaluate(() => {
  const g = __w.state.g, C = __w.cam, out = [];
  for (const c of g.cards) {
    const x = c.x * C.s - C.x * C.s, y = (c.y - C.y) * C.s, w = 63 * c.sz * C.s, h = 88 * c.sz * C.s;
    out.push({ id: c.id, owned: c.owned, x, y, w, h, vis: y < innerHeight && y + h > 0 && x < innerWidth && x + w > 0 });
  }
  return out;
});
const pixel = (p, x, y) => p.evaluate((x, y) => { const cv = document.getElementById("wall"), d = devicePixelRatio; return [...cv.getContext("2d").getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data]; }, x, y);
const magenta = ([r, g, b]) => r > 200 && g < 60 && b > 200;
const cardOf = (u) => { const m = u.match(/pokemontcg\.io\/([^/]+)\/([^/_.]+)/); return m ? `${m[1]}-${decodeURIComponent(m[2])}` : null; };

// ----- 1. a binder up close asks only for the cards on screen, and shows them -----
{
  const p = await page("serve", { broken: new Set(["base1-2"]), nocors: new Set(["base1-3"]) });
  const before = p.reqs.length;
  await openSet(p, "base1"); await wait(1800);
  const cs = await onScreen(p), asked = new Set(p.reqs.slice(before).map(cardOf));
  const vis = new Set(cs.filter((c) => c.vis && c.owned).map((c) => c.id));
  const stray = [...asked].filter((id) => !vis.has(id));
  R.push([`a binder up close asks for pictures only for the cards on screen (${asked.size} asked, ${vis.size} owned on screen${stray.length ? `, stray: ${stray.slice(0, 4).join(" ")}` : ""})`, asked.size > 0 && stray.length === 0]);
  R.push(["no picture is asked for far out in the mosaic", before === 0]);
  const shown = [];
  for (const c of cs.filter((c) => c.vis && c.owned && c.y > 0 && c.y + c.h < 760 && !["base1-2", "base1-3"].includes(c.id)).slice(0, 4)) shown.push(magenta(await pixel(p, c.x + c.w * 0.5, c.y + c.h * 0.4)));
  R.push([`the cards on screen show their pictures (${shown.filter(Boolean).length} of ${shown.length} checked)`, shown.length > 0 && shown.every(Boolean)]);
  // ----- 2. a picture that fails (a 404, or no CORS) leaves the drawn face -----
  for (const id of ["base1-2", "base1-3"]) {
    const c = cs.find((x) => x.id === id);
    if (!c?.owned || !c.vis) { R.push([`${id} is owned and on screen for the failure check`, false]); continue; }
    const px = await pixel(p, c.x + c.w * 0.5, c.y + c.h * 0.4), label = await pixel(p, c.x + c.w * 0.5, c.y + c.h * 0.9);
    R.push([`${id === "base1-2" ? "a picture that 404s" : "a picture served without CORS"} falls back to the drawn face (${px.slice(0, 3)})`, !magenta(px) && px[3] === 255 && label[0] > 200 && label[1] > 200]);
  }
  const art = await p.evaluate(() => __w.art);
  R.push([`the failed pictures are remembered, not asked for again (${art.failed.length} failed)`, art.failed.some((u) => u.includes("base1/2.png")) && art.failed.some((u) => u.includes("base1/3.png"))]);
  // ----- 3. a card up close: the large scan, and the vintage note -----
  await p.evaluate(() => { const c = __w.state.g.cards.find((c) => c.owned && c.id !== "base1-2" && c.id !== "base1-3"); __w.focus(c); }); await wait(1600);
  const big = p.reqs.some((u) => u.includes("_hires.png")), note = await p.evaluate(() => { const n = document.getElementById("p-pic"); return Boolean(n && !n.hidden && n.style.visibility === "visible" && n.textContent.includes("1st Edition")); });
  R.push(["a card up close loads the large scan", big]);
  R.push(["a vintage card up close says its picture is a 1st Edition print", note]);
  // ----- 4. no toBlob, toDataURL or getImageData throws, on the wall's canvas or any made from it -----
  await p.keyboard.press("Escape"); await wait(500);
  await p.evaluate(() => __w.goRoom("trade")); await wait(1300); await p.evaluate(() => __w.openBinder()); await wait(1600);
  await p.evaluate(() => __w.closeBinder()); await wait(800);
  await p.evaluate(() => __w.toMap()); await wait(1200);
  const reads = await p.evaluate(async () => {
    const list = [...new Set([...window.__canvases, ...document.querySelectorAll("canvas")])].filter((c) => c.width && c.height);
    let bad = 0;
    for (const c of list) {
      try { c.getContext("2d").getImageData(0, 0, 1, 1); c.toDataURL(); await new Promise((res, rej) => { try { c.toBlob(res); } catch (e) { rej(e); } }); } catch { bad++; }
    }
    return { n: list.length, bad };
  });
  R.push([`every canvas stays readable with pictures drawn: getImageData, toDataURL, toBlob (${reads.n} canvases, ${reads.bad} threw)`, reads.n > 1 && reads.bad === 0]);
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  await p.close();
}
// ----- 5. the cache stays under its cap, through every set's binder and cards up close -----
{
  const p = await page("serve", { dpr: 3 });
  let peak = 0, cap = 0, ready = 0;
  for (const id of ["base1", "base2", "base3", "base5", "neo1", "swsh7", "sv3pt5", "sv8pt5", "me5", "me55"]) {
    await openSet(p, id); await wait(1000);
    for (let k = 0; k < 6; k++) {
      await p.evaluate(() => { __w.cam.y += innerHeight / __w.cam.s * 0.8; __w.kick(); }); await wait(450);
      const a = await p.evaluate(() => __w.art); peak = Math.max(peak, a.bytes); cap = a.cap; ready = Math.max(ready, a.ready);
    }
    await p.evaluate(() => { const c = __w.state.g.cards.filter((c) => c.owned); for (const x of c.slice(0, 1)) __w.focus(x); }); await wait(1200);
    const a = await p.evaluate(() => __w.art); peak = Math.max(peak, a.bytes);
    await p.keyboard.press("Escape"); await wait(400);
    await p.evaluate(() => document.getElementById("back").click()); await wait(1000);
  }
  R.push([`the picture cache stays under its cap at dpr 3 (peak ${(peak / 1048576).toFixed(1)} of ${(cap / 1048576).toFixed(0)} MB, ${ready} pictures at most)`, peak > 0 && peak <= cap]);
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  await p.close();
}
// ----- 6. a blocked host (this sandbox's network) is given up on, and the faces stay -----
{
  const p = await page("block");
  await openSet(p, "base1"); await wait(1200);
  for (let k = 0; k < 4; k++) { await p.evaluate(() => { __w.cam.y += innerHeight / __w.cam.s * 0.8; __w.kick(); }); await wait(400); }
  await p.evaluate(() => __w.goRoom("feed")); await wait(1200);
  const n = p.reqs.filter((u) => u.includes("pokemontcg")).length, art = await p.evaluate(() => __w.art);
  R.push([`a blocked host is given up on after a few tries (${n} requests, given up: ${art.down.join(", ") || "no"})`, n <= 14 && art.down.includes("images.pokemontcg.io")]);
  await p.evaluate(() => __w.goRoom("chase")); await wait(1200);
  await openSet(p, "base2"); await wait(1200);
  const cs = await onScreen(p), c = cs.find((c) => c.vis && c.owned && c.y > 0);
  const px = c ? await pixel(p, c.x + c.w * 0.5, c.y + c.h * 0.9) : [0, 0, 0, 0];
  R.push(["with the host blocked, a binder draws the drawn faces (label strip in place)", Boolean(c) && px[0] > 200 && px[1] > 200]);
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  await p.close();
}
await browser.close();
const bad = report(R);
process.exit(bad ? 1 : 0);
