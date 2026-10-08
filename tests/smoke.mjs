// Every layout, lens and theme renders without errors; screenshots go to tests/out/<variant>/ for review.
//   node tests/smoke.mjs [--variant name]
import fs from "node:fs";
import path from "node:path";
import { write } from "../scripts/build.mjs";
import { launch, phone, wait, report, installTouch } from "./browser.mjs";

const variant = process.argv.includes("--variant") ? process.argv[process.argv.indexOf("--variant") + 1] : null;
const { file } = write({ variant, debug: true });
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), "out", variant || "wall");
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
const R = [];
for (const [dark, width, height] of [[false, 390, 844], [true, 390, 844], [false, 844, 390], [true, 844, 390], [false, 1440, 900]]) {
  const tag = `${width > 1000 ? "desktop" : width > height ? "landscape" : "phone"}-${dark ? "dark" : "light"}`; // landscape: a phone on its side (round 22)
  const p = await phone(browser, file, { dark, motion: false, dpr: 2, width, height });
  // One choice in the Filters sheet: open it, tap, and close it again (Time closes it by itself). A message in the bar
  // covers Filters until it is tapped away (round 23).
  const pick = async (sel, close = true) => { if (await p.$eval("#filter-menu", (e) => e.hidden)) { await p.evaluate(() => document.getElementById("toast").classList.remove("show")); await p.click("#filter"); await wait(120); } await p.click(sel); await wait(250); if (close && !(await p.$eval("#filter-menu", (e) => e.hidden))) { await p.click("#f-done"); await wait(120); } };
  for (const mode of ["set", "value", "rarity", "type"]) {
    if (mode !== "set") await pick(`[data-group="${mode}"]`);
    for (const lens of ["have", "chase"]) {
      await p.click(`[data-lens="${lens}"]`); await wait(200);
      if (lens === "have" || width < 1000) await p.screenshot({ path: path.join(out, `${tag}-${mode}-${lens}.png`) });
    }
    await p.click('[data-lens="have"]'); await wait(150);
    if (mode !== "set" && mode !== "value") continue;
    for (const [on, off] of [['[data-show="missing"]', '[data-show="all"]'], ['[data-show="have"]', '[data-show="all"]'], ['[data-color="value"]', '[data-color="type"]'], ['[data-filter="time"]', '[data-filter="time"]']]) {
      await pick(on);
      if (width < 1000) await p.screenshot({ path: path.join(out, `${tag}-${mode}-${/data-(\w+)="(\w+)"/.exec(on).slice(1).join("-")}.png`) });
      await pick(off);
    }
  }
  await pick('[data-group="set"]');
  await p.evaluate(() => document.getElementById("toast").classList.remove("show")); await p.click("#filter"); await wait(150);
  if (width < 700) await p.screenshot({ path: path.join(out, `${tag}-filters.png`) });
  await p.click("#f-done"); await wait(120);
  // open the first group, screenshot the binder, and a card up close
  const g = await p.evaluate(() => { const m = __w.groups[0].m; return { x: m.x + m.w / 2, y: m.y + m.h / 2 - __w.mScroll }; });
  await p.mouse.click(g.x, g.y); await wait(400);
  await p.screenshot({ path: path.join(out, `${tag}-binder.png`) });
  await p.mouse.click(width / 2 - 40, Math.min(330, height - 80)); await wait(500);
  await p.screenshot({ path: path.join(out, `${tag}-card.png`) });
  // The rooms (round 21), on an imported wall chasing what it's missing: the map, each room, a listing's sheet.
  await p.evaluate(() => {
    const at = Date.now() - 30 * 86400e3, owned = {}, chase = {}, copies = {};
    for (const c of __w.cards) { if (c.own0) { owned[c.id] = { on: true, at }; if (c.i % 4 === 0) copies[c.id] = { n: 2, got: at }; } else chase[c.id] = true; }
    localStorage.clear();
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase)); localStorage.setItem("wall-copies", JSON.stringify(copies));
    localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(600);
  const room = async (id) => { await p.evaluate((id) => __w.goRoom(id), id); await wait(700); };
  await p.click("#rooms"); await wait(500); await p.screenshot({ path: path.join(out, `${tag}-room-map.png`) });
  await p.evaluate(() => __w.openPlace("feed")); await wait(700); await p.screenshot({ path: path.join(out, `${tag}-room-feed.png`) });
  await p.select("#pf-sort", "best"); await wait(300); await p.screenshot({ path: path.join(out, `${tag}-room-feed-best.png`) }); await p.select("#pf-sort", "newest"); await wait(200);
  await p.evaluate(() => __w.openListing(__w.feedList()[0].id)); await wait(500); await p.screenshot({ path: path.join(out, `${tag}-room-listing.png`) });
  await p.keyboard.press("Escape"); await wait(300);
  await room("trade"); await p.screenshot({ path: path.join(out, `${tag}-room-trade.png`) });
  await p.evaluate(() => { __w.tcAdd("give", { id: __w.tbList()[0].id }); __w.tcAdd("get", { id: __w.cards.find((c) => __w.isChase(c) && c.price > 3).id }); document.getElementById("pg-trade").scrollTop = 380; }); await wait(300);
  await p.screenshot({ path: path.join(out, `${tag}-room-checker.png`) });
  await p.evaluate(() => { document.querySelector("#tc [data-clear]")?.click(); }); await wait(200);
  await room("medal"); await p.screenshot({ path: path.join(out, `${tag}-room-medal.png`) });
  await room("source"); await p.screenshot({ path: path.join(out, `${tag}-room-source.png`) });
  R.push([`${tag}: every layout and lens renders${p.errors.length ? ` (${p.errors[0]})` : ""}`, !p.errors.length]);
  await p.close();
}
// Round 23 (De Stijl): pinching to the map leaves no large empty field part way, and every nameplate fits its plinth.
// An empty field is the largest connected patch of the page's background (in 10px cells); part way it may be no bigger
// than at rest on the map (plus a little), never the 9% the across-then-down move used to leave beside the room.
for (const dark of [false, true]) {
  const tag = `phone-${dark ? "dark" : "light"}`, p = await phone(browser, file, { dark, motion: true, width: 390, height: 844 });
  await p.evaluate(() => {
    const at = Date.now() - 30 * 86400e3, owned = {}, chase = {};
    for (const c of __w.cards) { if (c.own0) owned[c.id] = { on: true, at }; else if (c.i % 3 === 0) chase[c.id] = true; }
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase)); localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(3500);
  const emptiest = async () => {
    const png = await p.screenshot({ encoding: "base64" });
    return p.evaluate(async (png) => {
      const i = new Image(); await new Promise((r) => { i.onload = r; i.src = `data:image/png;base64,${png}`; });
      const k = document.createElement("canvas"); k.width = i.width; k.height = i.height; const x = k.getContext("2d"); x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, i.width, i.height).data, bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      const B = [1, 3, 5].map((o) => parseInt(bg.slice(o, o + 2), 16)), S = 10, cw = Math.floor(i.width / S), ch = Math.floor(i.height / S);
      const isBg = (px, py) => { const o = (py * i.width + px) * 4; return Math.abs(d[o] - B[0]) + Math.abs(d[o + 1] - B[1]) + Math.abs(d[o + 2] - B[2]) < 12; };
      const cell = new Uint8Array(cw * ch);
      for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) cell[cy * cw + cx] = [[1, 1], [8, 1], [1, 8], [8, 8], [5, 5]].every(([a, b]) => isBg(cx * S + a, cy * S + b)) ? 1 : 0;
      let best = 0;
      for (let s0 = 0; s0 < cell.length; s0++) {
        if (cell[s0] !== 1) continue;
        let n = 0; const st = [s0]; cell[s0] = 2;
        while (st.length) { const c = st.pop(); n++; const cx = c % cw, cy = (c - cx) / cw; for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && cell[ny * cw + nx] === 1) { cell[ny * cw + nx] = 2; st.push(ny * cw + nx); } }
        best = Math.max(best, n);
      }
      return best / (cw * ch);
    }, png);
  };
  await p.click("#rooms"); await wait(1500);
  const rest = await emptiest();
  await p.evaluate(() => __w.goRoom("chase")); await wait(1500);
  const mid = [];
  for (const q of [0.2, 0.4, 0.6, 0.8]) { await p.evaluate((q) => { if (!__w.state.trans) __w.beginMap("chase", "out"); __w.state.trans.q = q; __w.kick(); }, q); await wait(250); mid.push([q, await emptiest()]); }
  await p.evaluate(() => { __w.state.trans.q = 0; __w.state.trans.anim = { from: 0, to: 0, t0: performance.now(), dur: 1 }; __w.kick(); }); await wait(400);
  const worst = Math.max(...mid.map((m) => m[1]));
  R.push([`${tag}: no large empty field part way to the map (largest ${(worst * 100).toFixed(1)}% of the screen; ${(rest * 100).toFixed(1)}% at rest)`, worst <= Math.max(rest + 0.02, 0.05)]);
  if (!dark) {
    const plates = await p.evaluate(() => {
      const box = document.createElement("div"); box.style.cssText = "position:fixed;left:0;top:0;width:200px;opacity:0;pointer-events:none"; document.body.append(box);
      const list = __w.medalList().list.filter((t) => t.plate), extra = ["RAINBOW", "WWWWWWWW", "MMMMMMMMMMMMMM", "CHAMPION"].map((plate, i) => ({ ...list[0], id: `x${i}`, plate }));
      const bad = [];
      for (const t of [...list, ...extra]) {
        box.innerHTML = __w.medalSvg(t);
        const svg = box.querySelector("svg"), txt = [...svg.querySelectorAll("text")].find((e) => e.textContent !== "?"), r = [...svg.querySelectorAll("rect")].find((e) => e.getAttribute("y") === "94");
        if (!txt || !r) continue;
        const b = txt.getBBox(), x0 = Number(r.getAttribute("x")), x1 = x0 + Number(r.getAttribute("width"));
        if (b.x < x0 + 1 || b.x + b.width > x1 - 1 || x0 < 6 || x1 > 94) bad.push(t.plate);
      }
      box.remove();
      return { n: list.length + extra.length, bad };
    });
    R.push([`${tag}: every nameplate fits its plinth (${plates.n} checked${plates.bad.length ? `; spills: ${plates.bad.join(", ")}` : ""})`, plates.n > 0 && !plates.bad.length]);
  }
  R.push([`${tag}: the move to the map runs without errors${p.errors.length ? ` (${p.errors[0]})` : ""}`, !p.errors.length]);
  await p.close();
}
// A frame that throws part way never freezes the screen: one fault while the wall's pieces are drawn on the way to the
// map, and the move still lands on the map, the screen keeps drawing, and the top bar names what happened.
{
  const p = await phone(browser, file, { motion: true });
  await p.evaluate(() => { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1"); }); await p.reload({ waitUntil: "load" }); await wait(1500);
  const t = await installTouch(p);
  await p.evaluate(() => __w.armFault("pieces"));
  await t.pinch(195, 420, 260, 70, 500); await wait(1500);
  const s = await p.evaluate(() => ({ map: __w.rooms.map, trans: Boolean(__w.state.trans), err: window.__frameError || "", toast: document.getElementById("toast").textContent }));
  const px = await p.evaluate(() => { const c = document.getElementById("wall"), x = c.getContext("2d"), d = x.getImageData(Math.round(c.width * 0.25), Math.round(c.height * 0.5), 1, 1).data; return d[0] + d[1] + d[2]; });
  R.push([`a frame that throws on the way to the map doesn't freeze it: the move lands (${s.map ? "on the map" : "not on the map"}) and the top bar names the snag`, s.map && !s.trans && /test fault in pieces/.test(s.err) && /snag/.test(s.toast) && px > 0 && !p.errors.length]);
  await p.close();
}
// A gradient at a bad number (Safari throws "The provided value is non-finite") is drawn at 0 instead: the move lands
// with no snag, and the top bar names where the number came from.
{
  const p = await phone(browser, file, { motion: true });
  await p.evaluate(() => { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1"); }); await p.reload({ waitUntil: "load" }); await wait(1500);
  const t = await installTouch(p);
  await p.evaluate(() => __w.armFault("nan"));
  await t.pinch(195, 420, 260, 70, 500); await wait(1500);
  const s = await p.evaluate(() => ({ map: __w.rooms.map, trans: Boolean(__w.state.trans), err: window.__frameError || "", bad: window.__badNumber || "", toast: document.getElementById("toast").textContent }));
  R.push([`a gradient at a bad number is drawn anyway and named (${s.bad || "not named"}), and the move lands`, s.map && !s.trans && !s.err && /createLinearGradient in drawPieces/.test(s.bad) && /bad number/.test(s.toast) && !p.errors.length]);
  await p.close();
}
// A pinch whose fingertips meet (the distance reads 0, as an iPhone reports a fast close) never puts a bad number in
// the camera: the set closes or stays, and the wall draws.
{
  const p = await phone(browser, file, { motion: true });
  await p.evaluate(() => { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1"); }); await p.reload({ waitUntil: "load" }); await wait(1500);
  const t = await installTouch(p);
  await t.tap(100, 200); await wait(1300);
  const opened = await p.evaluate(() => __w.view);
  await p.evaluate(async () => { // both fingers land on one point, then a single jump with them still together
    const cv = document.getElementById("wall"), T = (id, x, y) => new Touch({ identifier: id, target: cv, clientX: x, clientY: y });
    const fire = (type, touches, changed) => cv.dispatchEvent(new TouchEvent(type, { touches, changedTouches: changed, cancelable: true, bubbles: true }));
    let a = T(1, 200, 400), c = T(2, 200, 400); fire("touchstart", [a], [a]); fire("touchstart", [a, c], [c]);
    a = T(1, 201, 400); c = T(2, 201, 400); fire("touchmove", [a, c], [a, c]); fire("touchend", [], [a, c]);
  });
  await wait(1200);
  const s = await p.evaluate(() => ({ cam: [__w.cam.x, __w.cam.y, __w.cam.s].every(Number.isFinite), bad: window.__badNumber || "", err: window.__frameError || "", view: __w.view }));
  R.push([`a pinch whose fingertips meet keeps the camera sound (opened a ${opened}, now the ${s.view}${s.bad ? `; ${s.bad}` : ""})`, opened === "set" && s.cam && !s.bad && !s.err && !p.errors.length]);
  await p.close();
}
// After a pinch, the finger still down rests: moving it neither scrolls nor breaks the scroll (it used to set it from
// a start it didn't have, and the wall went blank).
{
  const p = await phone(browser, file, { motion: true });
  await p.evaluate(() => { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1"); }); await p.reload({ waitUntil: "load" }); await wait(1500);
  const before = await p.evaluate(() => __w.mScroll);
  await p.evaluate(async () => {
    const cv = document.getElementById("wall"), T = (id, x, y) => new Touch({ identifier: id, target: cv, clientX: x, clientY: y });
    const fire = (type, touches, changed) => cv.dispatchEvent(new TouchEvent(type, { touches, changedTouches: changed, cancelable: true, bubbles: true }));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let a = T(1, 150, 400), c = T(2, 250, 400); fire("touchstart", [a], [a]); fire("touchstart", [a, c], [c]);
    a = T(1, 152, 400); c = T(2, 248, 400); fire("touchmove", [a, c], [a, c]); await sleep(20);
    fire("touchend", [c], [a]); // one finger lifts; the other stays and moves
    for (let i = 1; i <= 6; i++) { c = T(2, 248, 400 - i * 40); fire("touchmove", [c], [c]); await sleep(16); }
    fire("touchend", [], [c]);
  });
  await wait(600);
  const s = await p.evaluate(() => ({ scroll: __w.mScroll, bad: window.__badNumber || "" }));
  R.push([`after a pinch the finger left down rests: the wall doesn't scroll (${before} then ${s.scroll}) and no bad number turns up${s.bad ? ` (${s.bad})` : ""}`, Number.isFinite(s.scroll) && s.scroll === before && !s.bad && !p.errors.length]);
  await p.close();
}
// The Feed's sorts and Filters (production's, as far as the listings carry them): each filter narrows the list to
// listings that pass it, the button counts what's on, and Clear brings every listing back.
{
  const p = await phone(browser, file, { motion: false });
  await p.evaluate(() => { localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1"); }); await p.reload({ waitUntil: "load" }); await wait(1500);
  await p.click("#rooms"); await wait(500); await p.evaluate(() => __w.openPlace("feed")); await wait(800);
  const rows = () => p.evaluate(() => [...document.querySelectorAll("#pf-list [data-l]")].map((b) => b.dataset.l));
  const all = await rows();
  await p.click("#pf-more-btn"); await wait(150);
  await p.select("#pf-src", "ebay"); await wait(200);
  const ebay = await rows();
  await p.select("#pf-how", "auction"); await wait(200);
  const auc = await rows(), label = await p.$eval("#pf-more-btn", (e) => e.textContent);
  await p.click("#pf-clear"); await wait(200);
  const back = await rows();
  R.push([`the Feed's Filters narrow it (${all.length} listings, ${ebay.length} on eBay, ${auc.length} eBay auctions), count what's on ("${label}"), and Clear brings them all back`, all.length > 0 && ebay.length < all.length && auc.length <= ebay.length && auc.every((id) => ebay.includes(id)) && label === "Filters (2)" && back.length >= all.length && !p.errors.length]);
  await p.close();
}
// Graded slabs (parity 2): adding one on the card up close owns the card and puts a badge on its pocket; Remove takes
// it out (and the card, when the slab was all you had of it), and Undo brings both back. In the Feed, the three new
// filters narrow to slabs, a company and a grade, Clear brings everything back, and a slab passes "Near Mint only".
{
  const p = await phone(browser, file, { motion: false });
  await p.evaluate(() => {
    const at = Date.now() - 30 * 86400e3, owned = {}, chase = {};
    for (const c of __w.cards) { if (c.own0) owned[c.id] = { on: true, at }; else chase[c.id] = true; }
    localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase));
    localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
  });
  await p.reload({ waitUntil: "load" }); await wait(800);
  await p.evaluate(() => __w.enterGroup(__w.groups[0])); await wait(900);
  const k = await p.evaluate(() => { const g = __w.groups[0], k = g.cards.findIndex((c) => !c.owned && !c.ph); __w.focus(g.cards[k]); return k; }); await wait(700);
  const badge = () => p.evaluate((k) => { // the pixel just inside the badge's corner, where its white field is
    const c = __w.groups[0].cards[k], r = __w.binderRect(c, __w.cam), inset = Math.max(3, r.w * 0.05), cv = document.getElementById("wall"), d = window.devicePixelRatio || 1;
    const px = cv.getContext("2d").getImageData(Math.round((r.x + r.w - inset - 2) * d), Math.round((r.y + r.h * 0.76 - inset - 2) * d), 1, 1).data;
    return px[0] + px[1] + px[2] === 765;
  }, k);
  const before = await badge();
  await p.click("#p-gadd"); await wait(200);
  await p.select("#p-gco", "PSA"); await p.select("#p-ggr", "10"); await p.type("#p-gcert", "12345678"); await p.click("#p-gsave"); await wait(600);
  const added = await p.evaluate((k) => { const c = __w.groups[0].cards[k]; return { owned: c.owned, n: __w.slabsOf(c).length, worth: __w.worthOf([c]) === __w.gradeAsk(c, "PSA", 10), link: document.querySelector("#p-slabs a")?.href || "", list: Boolean(document.querySelector("#p-slabs li")) }; }, k);
  const shown = await badge();
  R.push([`adding a graded copy owns the card (${added.owned ? "owned" : "not owned"}), counts it at its grade (${added.worth ? "PSA 10 ask" : "not"}), links to PSA, and its pocket wears the badge (${before ? "white before" : "none before"}, ${shown ? "shown" : "not shown"})`, added.owned && added.n === 1 && added.worth && added.list && added.link === "https://www.psacard.com/cert/12345678" && !before && shown]);
  await p.click("#p-slabs [data-gr-rm]"); await wait(500);
  const removed = await p.evaluate((k) => { const c = __w.groups[0].cards[k]; return { owned: c.owned, n: (__w.graded[c.id] || []).length }; }, k);
  await p.click("#toast .toast-btn"); await wait(500);
  const undone = await p.evaluate((k) => { const c = __w.groups[0].cards[k]; return { owned: c.owned, n: __w.slabsOf(c).length, kept: JSON.parse(localStorage.getItem("wall-graded") || "{}")[c.id]?.length || 0 }; }, k);
  R.push([`removing the slab takes the card out (${removed.owned ? "still owned" : "out"}, ${removed.n} slabs) and Undo brings both back (${undone.owned ? "owned" : "not owned"}, ${undone.n} slab, ${undone.kept} kept)`, !removed.owned && removed.n === 0 && undone.owned && undone.n === 1 && undone.kept === 1]);
  await p.evaluate(() => __w.unfocus()); await wait(300);
  await p.evaluate(() => __w.goRoom("feed")); await wait(900);
  const rows = () => p.evaluate(() => { const by = new Map(__w.feedList().map((L) => [L.id, L])); return [...document.querySelectorAll("#pf-list [data-l]")].map((b) => { const L = by.get(b.dataset.l); return { id: b.dataset.l, g: L?.grade ? `${L.grade.co} ${L.grade.grade}` : "", co: L?.grade?.co || "", gr: L?.grade?.grade || 0 }; }); });
  const all = await rows(), slabsIn = all.filter((x) => x.g);
  await p.click("#pf-more-btn"); await wait(150);
  await p.select("#pf-slab", "graded"); await wait(200); const only = await rows();
  await p.select("#pf-slab", "raw"); await wait(200); const raw = await rows();
  await p.select("#pf-slab", ""); await p.select("#pf-gco", "PSA"); await wait(200); const psa = await rows();
  await p.select("#pf-gmin", "10"); await wait(200); const ten = await rows(), label = await p.$eval("#pf-more-btn", (e) => e.textContent);
  await p.click("#pf-clear"); await wait(200); const back = await rows();
  await p.select("#pf-cond", "NM"); await wait(200); const nm = await rows();
  await p.select("#pf-cond", ""); await wait(150);
  R.push([`the Feed's raw-or-slab, company and grade filters narrow it (${all.length} listings, ${only.length} slabs, ${raw.length} raw, ${psa.length} PSA, ${ten.length} PSA 10; "${label}") and Clear brings them back`, slabsIn.length > 0 && only.length === slabsIn.length && only.every((x) => x.g) && raw.every((x) => !x.g) && all.every((x) => (x.g ? only : raw).some((y) => y.id === x.id)) && psa.every((x) => x.co === "PSA") && psa.length <= only.length && ten.every((x) => x.co === "PSA" && x.gr >= 10) && ten.length <= psa.length && label === "Filters (2)" && all.every((x) => back.some((y) => y.id === x.id))]); // (a live arrival may land meanwhile: always raw)
  R.push([`a slab passes "Near Mint only" (${slabsIn.filter((x) => nm.some((y) => y.id === x.id)).length} of ${slabsIn.length} slabs stay, ${nm.length} listings in all)`, slabsIn.length > 0 && slabsIn.every((x) => nm.some((y) => y.id === x.id)) && nm.length <= all.length && !p.errors.length]);
  await p.close();
}
await browser.close();
const bad = report(R);
console.log(`\nScreenshots: ${path.relative(process.cwd(), out)}`);
process.exit(bad ? 1 : 0);
