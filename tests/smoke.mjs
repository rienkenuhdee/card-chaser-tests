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
  for (const mode of ["set", "pokemon", "value"]) {
    await p.click("#arrange"); await wait(150); await p.click(`[data-mode="${mode}"]`); await wait(250);
    for (const lens of ["all", "need", "deals", "value", "time"]) {
      await p.click(`[data-lens="${lens}"]`); await wait(200);
      if (lens === "all" || width < 700) await p.screenshot({ path: path.join(out, `${tag}-${mode}-${lens}.png`) });
    }
    await p.click('[data-lens="all"]'); await wait(150);
  }
  // open the first group, screenshot the binder, and a card up close
  const g = await p.evaluate(() => { const m = __w.groups[0].m; return { x: m.x + m.w / 2, y: m.y + m.h / 2 - __w.mScroll }; });
  await p.mouse.click(g.x, g.y); await wait(400);
  await p.screenshot({ path: path.join(out, `${tag}-binder.png`) });
  await p.mouse.click(width / 2 - 40, 330); await wait(500);
  await p.screenshot({ path: path.join(out, `${tag}-card.png`) });
  R.push([`${tag}: every layout and lens renders${p.errors.length ? ` (${p.errors[0]})` : ""}`, !p.errors.length]);
  await p.close();
}
await browser.close();
const bad = report(R);
console.log(`\nScreenshots: ${path.relative(process.cwd(), out)}`);
process.exit(bad ? 1 : 0);
