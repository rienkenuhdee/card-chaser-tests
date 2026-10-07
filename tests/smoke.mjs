// Every layout, lens and theme renders without errors; screenshots go to tests/out/<variant>/ for review.
//   node tests/smoke.mjs [--variant name]
import fs from "node:fs";
import path from "node:path";
import { write } from "../scripts/build.mjs";
import { launch, phone, wait, report } from "./browser.mjs";

const variant = process.argv.includes("--variant") ? process.argv[process.argv.indexOf("--variant") + 1] : null;
const { file } = write({ variant, debug: true });
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname), "out", variant || "wall");
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
const R = [];
for (const [dark, width, height] of [[false, 390, 844], [true, 390, 844], [false, 1440, 900]]) {
  const tag = `${width > 700 ? "desktop" : "phone"}-${dark ? "dark" : "light"}`;
  const p = await phone(browser, file, { dark, motion: false, dpr: 2, width, height });
  for (const mode of ["set", "value"]) {
    if (mode === "value") { await p.click("#filter"); await wait(120); await p.click('[data-filter="bands"]'); await wait(250); }
    for (const lens of ["have", "need", "chase"]) {
      await p.click(`[data-lens="${lens}"]`); await wait(200);
      if (lens === "have" || width < 700) await p.screenshot({ path: path.join(out, `${tag}-${mode}-${lens}.png`) });
    }
    await p.click('[data-lens="have"]'); await wait(150);
    for (const f of ["value", "time"]) {
      await p.click("#filter"); await wait(120); await p.click(`[data-filter="${f}"]`); await wait(250);
      if (width < 700) await p.screenshot({ path: path.join(out, `${tag}-${mode}-${f}.png`) });
      await p.click("#filter"); await wait(120); await p.click(`[data-filter="${f}"]`); await wait(150);
    }
  }
  // open the first group, screenshot the binder, and a card up close
  const g = await p.evaluate(() => { const m = __w.groups[0].m; return { x: m.x + m.w / 2, y: m.y + m.h / 2 - __w.mScroll }; });
  await p.mouse.click(g.x, g.y); await wait(400);
  await p.screenshot({ path: path.join(out, `${tag}-binder.png`) });
  await p.mouse.click(width / 2 - 40, 330); await wait(500);
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
await browser.close();
const bad = report(R);
console.log(`\nScreenshots: ${path.relative(process.cwd(), out)}`);
process.exit(bad ? 1 : 0);
