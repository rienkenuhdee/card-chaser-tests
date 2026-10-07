// A phone on its side (round 22): the chrome shares one row, every view lays out across, nothing sits behind the
// notch, and turning the phone mid-view lands on the same view composed for the new screen. The trade binder opens
// as two facing pages, a page turns under the thumb, and Back and a pinch close it.
// The notch is stood in for with --sal and --sar (what env(safe-area-inset-left/right) reads into), 47px a side like an
// iPhone in landscape; headless Chrome has no safe area of its own.
//   node tests/landscape.mjs [--variant name]
import { write } from "../scripts/build.mjs";
import { launch, installTouch, wait, report } from "./browser.mjs";

const variant = process.argv.includes("--variant") ? process.argv[process.argv.indexOf("--variant") + 1] : null;
const { file } = write({ variant, debug: true });
const browser = await launch();
const NOTCH = 47;
async function open(width, height, { notch = 0, dark = false, setup = null } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }, { name: "prefers-color-scheme", value: dark ? "dark" : "light" }]);
  await p.setRequestInterception(true);
  p.on("request", (r) => (r.url().startsWith("file:") ? r.continue() : r.abort()));
  p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
  p.notch = notch;
  if (notch) await p.evaluateOnNewDocument((n) => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.id = "test-notch"; s.textContent = `:root{--sal:${n}px !important;--sar:${n}px !important}`; document.head.append(s); }); }, notch);
  await p.goto(`file://${file}`);
  await p.evaluate(setup || (() => localStorage.clear()));
  await p.reload({ waitUntil: "load" }); await wait(setup ? 1200 : 3200);
  if (notch) { await p.evaluate(() => dispatchEvent(new Event("resize"))); await wait(200); } // the stand-in notch arrives after the first layout
  return p;
}
// An imported wall chasing what it's missing, with spare copies (so the binder and the table have pages).
const imported = () => {
  const at = Date.now() - 30 * 86400e3, owned = {}, chase = {}, copies = {};
  for (const c of __w.cards) { if (c.own0) { owned[c.id] = { on: true, at }; if (c.i % 4 === 0) copies[c.id] = { n: 2, got: at }; } else chase[c.id] = true; }
  localStorage.clear();
  localStorage.setItem("wall-owned", JSON.stringify(owned)); localStorage.setItem("wall-chase", JSON.stringify(chase)); localStorage.setItem("wall-copies", JSON.stringify(copies));
  localStorage.setItem("wall-imported", "TCGplayer"); localStorage.setItem("wall-welcomed", "1"); localStorage.setItem("wall-map-seen", "1");
};
// Turning the phone: the notch goes to a side in landscape, and to the top (where the tests leave it be) in portrait.
const turn = async (p, width, height) => {
  if (p.notch) await p.evaluate((n) => { const s = document.getElementById("test-notch"); if (s) s.textContent = `:root{--sal:${n}px !important;--sar:${n}px !important}`; }, width > height ? p.notch : 0);
  await p.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await wait(700);
};
const rect = (p, sel) => p.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
const inside = (r, W, H, l = 0, rt = 0) => r && r.x >= l - 1 && r.r <= W - rt + 1 && r.y >= -1 && r.b <= H + 1;
const R = [];
// A binder on a phone on its side opens on at least three rows of cards, all of them above the bottom edge, and Mark's
// bar (in the top row, where the lens bar was) clear of them (round 22 polish).
async function rowsCheck(p, tag) {
  await p.evaluate(() => __w.enterGroup(__w.groupsNow.find((g) => g.set && g.set.id === "base1"))); await wait(1400);
  const rows = () => p.evaluate(() => { const g = __w.state.g, C = __w.cam, r = [0, 1, 2].map((k) => { const c = g.cards.find((x) => x.row === k); return c && { top: (c.y - C.y) * C.s, bot: (c.y + 88 * c.sz - C.y) * C.s }; }); return { r, cols: g.cols, vh: innerHeight }; });
  const a = await rows();
  R.push([`${tag}a set opens showing three rows of cards (${a.cols} across, the third ending at ${Math.round(a.r[2]?.bot)} of ${a.vh})`, a.r.every(Boolean) && a.r[2].bot <= a.vh - 4 && a.r[0].top > 60]);
  await p.click("#mark"); await wait(800);
  const b = await rows(), bar = await rect(p, "#markbar");
  R.push([`${tag}in Mark the bar stands clear of those three rows`, Boolean(bar) && b.r[2].bot <= a.vh - 4 && (bar.b <= b.r[0].top || bar.y >= b.r[2].bot)]);
  await p.click("#m-done"); await wait(400);
  await p.click("#back"); await wait(1100);
}

// ----- the wall, a set, a card, on a phone on its side with a notch at each side -----
{
  const W = 844, H = 390, p = await open(W, H, { notch: NOTCH, setup: imported }), t = await installTouch(p);
  const strip = await rect(p, ".strip"), lens = await rect(p, ".lens");
  R.push(["the strip and the lens bar share the top row, clear of the notch", strip.y < 20 && lens.y < 20 && strip.r <= lens.x - 4 && strip.x >= NOTCH && lens.r <= W - NOTCH + 1]);
  const wall = await p.evaluate((n) => { const gs = __w.groupsNow.filter((g) => g.m && !g.done && g.m.h > 0); return { ok: gs.every((g) => g.m.x >= n + 7 && g.m.x + g.m.w <= innerWidth - n - 7), top: Math.min(...gs.map((g) => g.m.y)) }; }, NOTCH);
  R.push(["the wall's panels stand clear of the notch, under the top row", wall.ok && wall.top >= 56]);
  const g = await p.evaluate(() => { const m = __w.groups[3].m; return { x: m.x + m.w / 2, y: Math.min(m.y + 60 - __w.mScroll, innerHeight - 60) }; });
  await t.tap(g.x, g.y); await wait(1300);
  const set = () => p.evaluate((n) => { const g = __w.state.g, C = __w.cam, l = (g.x - C.x) * C.s, r = (g.x + g.w - C.x) * C.s; return { view: __w.view, name: g?.name, l, r, s: C.s, fit: (innerWidth - 24 - 2 * n) / g.w, top: (g.y - C.y) * C.s }; }, NOTCH);
  const s1 = await set();
  R.push(["a set opens framed between the notches", s1.view === "set" && Math.abs(s1.s - s1.fit) < 0.01 && s1.l >= NOTCH + 11 && s1.r <= W - NOTCH - 11]);
  // A set's header on its side is compact: title and count on one line, its switch and People chase on one more.
  const hd = await p.evaluate(() => { const g = __w.state.g; return { head: g.head * __w.cam.s, chips: g.popChips ? new Set(g.popChips.map((c) => c.y)).size : 0 }; });
  R.push([`a set's header takes under a third of the height (${Math.round(hd.head)}px), People chase on one line`, hd.head < H / 3 && hd.chips <= 1]);
  const c = await p.evaluate(() => { const g = __w.state.g, C = __w.cam, c = g.cards[2]; return { x: (c.x - C.x) * C.s + 20 * C.s, y: (c.y - C.y) * C.s + 30 * C.s, id: c.id }; });
  await t.tap(c.x, c.y); await wait(1000);
  const card = () => p.evaluate(() => { const c = __w.state.focus; if (!c) return null; const C = __w.cam, x = (c.x - C.x) * C.s, y = (c.y - C.y) * C.s, w = 63 * c.sz * C.s, h = 88 * c.sz * C.s, pr = document.getElementById("panel").getBoundingClientRect(); return { id: c.id, x, y, r: x + w, b: y + h, h, panel: { x: pr.left, r: pr.right, y: pr.top, b: pr.bottom } }; });
  const k1 = await card();
  R.push(["a card up close stands beside its panel, not under it", Boolean(k1) && k1.r <= k1.panel.x + 1 && k1.x >= NOTCH && k1.y >= 50 && k1.b <= H && k1.panel.r <= W - NOTCH + 1 && k1.h > H * 0.6]);
  // Turning the phone with the card up close: it comes up close again, on the new screen.
  await turn(p, H, W);
  const k2 = await card();
  R.push(["turning to portrait keeps the card up close, whole on screen", Boolean(k2) && k2.id === k1.id && k2.x >= 0 && k2.r <= H + 1 && k2.y >= 0 && k2.b <= k2.panel.y + 1]);
  await turn(p, W, H);
  const k3 = await card();
  R.push(["and back on its side, beside its panel again", Boolean(k3) && k3.id === k1.id && k3.r <= k3.panel.x + 1 && k3.x >= NOTCH]);
  await t.tap(120, 200); await wait(700); // a tap off the card puts it down
  // Turning the phone inside a set: still the set, framed, at the row you were reading.
  await t.drag(W / 2, 330, 150, 300); await wait(700);
  const before = await p.evaluate(() => { const g = __w.state.g, C = __w.cam, y = C.y + 70 / C.s; return g.cards.find((c) => c.y + 44 > y)?.id; });
  await turn(p, H, W);
  const s2 = await p.evaluate(() => { const g = __w.state.g, C = __w.cam; return { view: __w.view, name: g?.name, s: C.s, fit: (innerWidth - 24) / g.w, l: (g.x - C.x) * C.s }; });
  const after = await p.evaluate((id) => { const c = __w.state.g.cards.find((x) => x.id === id), C = __w.cam, y = (c.y - C.y) * C.s; return y > -60 && y < innerHeight - 60; }, before);
  R.push(["turning to portrait inside a set keeps the set framed", s2.view === "set" && s2.name === s1.name && Math.abs(s2.s - s2.fit) < 0.01 && Math.abs(s2.l - 12) < 1.5]);
  R.push(["and the row you were reading stays on screen", after]);
  await turn(p, W, H);
  const s3 = await set();
  R.push(["turning back on its side keeps it framed between the notches", s3.view === "set" && s3.name === s1.name && Math.abs(s3.s - s3.fit) < 0.01 && s3.l >= NOTCH + 11]);
  await p.click("#back"); await wait(900);
  R.push(["back closes the set", await p.evaluate(() => __w.view === "mosaic")]);
  // The rooms map: five cards across in the tab bar's order, all on screen, none behind the notch.
  await p.click("#rooms"); await wait(1000);
  const map = await p.evaluate((n) => { const r = __w.mapLayout().r, ids = ["feed", "chase", "trade", "medal", "source"], o = ids.map((id) => r[id]); return { map: __w.rooms.map, on: o.every((m) => m.x >= n && m.x + m.w <= innerWidth - n && m.y >= 50 && m.y + m.h <= innerHeight - 20), order: r.feed.x < r.chase.x && r.chase.x < r.trade.x && r.trade.x === r.medal.x && r.medal.y > r.trade.y && r.trade.x < r.source.x, apart: o.every((a, i) => o.every((b, j) => i === j || a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5)) }; }, NOTCH);
  R.push(["the map lays its five rooms across, in order, clear of the notch", map.map && map.on && map.order && map.apart]);
  await turn(p, H, W);
  const pm = await p.evaluate(() => { const r = __w.mapLayout().r; return __w.rooms.map && r.feed.w > innerWidth * 0.8 && r.chase.y > r.feed.y; });
  R.push(["turning to portrait on the map lays it out for portrait", pm]);
  await turn(p, W, H);
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  await p.close();
}

// ----- the trade binder: two facing pages, a turn under the thumb, Back and a pinch close it -----
for (const [W, H, notch] of [[844, 390, 0], [932, 430, NOTCH]]) {
  const p = await open(W, H, { notch, setup: imported }), t = await installTouch(p), tag = `${W}x${H}${notch ? " with a notch" : ""}: `;
  await rowsCheck(p, tag);
  await p.click("#rooms"); await wait(900); await p.evaluate(() => __w.openPlace("trade")); await wait(1100);
  const cov = await rect(p, "#pt-page");
  R.push([`${tag}the Trade room shows the binder closed, its cover`, Boolean(cov) && cov.w > 60 && cov.h > cov.w * 1.3 && (await p.evaluate(() => getComputedStyle(document.getElementById("pt-page")).backgroundImage.includes("gradient")))]);
  const two = await p.evaluate(() => { const b = document.querySelector("#pg-trade .tcover").getBoundingClientRect(), c = document.querySelector("#pg-trade .checker").getBoundingClientRect(); return c.left > b.right && c.top < b.bottom; });
  R.push([`${tag}the Trade room sits in two columns: the binder at the left, the checker at the right`, two]);
  await p.click("#pt-cover"); await wait(350);
  const mid = await p.evaluate(() => ({ q: __w.bnd.q, on: __w.bnd.on }));
  await wait(900);
  const bd = () => p.evaluate(() => { const b = __w.bnd, G = b.L; return { on: b.on, q: b.q, vi: b.vi, turn: b.turn, show: b.show, spread: G?.spread, pages: G?.pages.map((x) => ({ x: x.x, y: x.y, r: x.x + G.pw, b: x.y + G.ph })), sp: G?.sp, pw: G?.pw, views: Math.ceil(Math.ceil(__w.tbList().length / 9) / (G?.spread || 1)) }; });
  let b = await bd();
  R.push([`${tag}the binder opens as two facing pages (it was part way open at ${mid.q.toFixed(2)})`, mid.on && mid.q > 0.05 && mid.q < 1 && b.on && b.q === 1 && b.spread === 2]);
  const P = b.pages;
  // Production's proportions (round 22 polish, Ryan: "use the full screen"): one thin bar along the top, and the two
  // pages under it taking the rest of the height, each pocket a card at the full height of its row, clear of the notch.
  const pk = await p.evaluate(() => { const list = __w.tbList(), v = __w.bnd.vi * 2, r = (i) => __w.tbPocketRect(list[i]); return { l: r(v * 9), r: r(v * 9 + 9 + 2), all: list.slice(v * 9, v * 9 + 18).map((c) => __w.tbPocketRect(c)) }; });
  const back = await rect(p, "#back"), show = await rect(p, "#bb-show"), bar = Math.max(back.b, show.b), small = Math.min(...pk.all.map((r) => r.h));
  R.push([`${tag}the pages face each other across the spine under a thin bar (${Math.round(bar)}px) and take the height under it (${Math.round((P[0].b - P[0].y) / H * 100)}% of it)`, P[1].x - P[0].r >= 12 && Math.abs(P[0].y - P[1].y) < 1 && bar <= 48 && P[0].y >= bar && (P[0].b - P[0].y) / H >= 0.85 && P[0].x >= notch && P[1].r <= W - notch + 1 && P[0].b <= H + 1 && pk.l.x >= notch + 8 && pk.r.x + pk.r.w <= W - notch - 8]);
  R.push([`${tag}every pocket is a card at least 26% of the screen's height (${Math.round(small)}px, ${(small / H * 100).toFixed(1)}%), at 63:88`, pk.all.length === 18 && small / H >= 0.26 && pk.all.every((r) => Math.abs(r.w / r.h - 63 / 88) < 0.02)]);
  R.push([`${tag}Back and Show mode sit in the bar, clear of the pages and the notch`, inside(back, W, H, notch) && inside(show, W, H, 0, notch) && back.r <= show.x]);
  const said = await p.evaluate(() => { const v = __w.bnd.vi * 2; return [v, v + 1].flatMap((i) => __w.bnd.labels.get(i) || []); });
  R.push([`${tag}who wants each card and its price sit on the card, none cut short (${said.slice(0, 3).join(" | ")})`, said.length >= 36 && said.every((t) => t && !t.includes("…") && !t.includes(".."))]);
  // A turn under the thumb: hold a drag from the right page's outer edge to the spine, and the leaf is half over.
  const y = (P[0].y + P[0].b) / 2, x0 = P[1].r - 20, spine = (P[0].r + P[1].x) / 2;
  await p.evaluate(async (a) => {
    const cv = document.querySelector("canvas"), T = (x, y) => new Touch({ identifier: 3, target: cv, clientX: x, clientY: y }), fire = (type, pts, ch) => cv.dispatchEvent(new TouchEvent(type, { touches: pts, changedTouches: ch, cancelable: true, bubbles: true }));
    let pts = [T(a.x0, a.y)]; fire("touchstart", pts, pts);
    for (let i = 1; i <= 30; i++) { pts = [T(a.x0 + (a.to - a.x0) * i / 30, a.y)]; fire("touchmove", pts, pts); await new Promise((r) => setTimeout(r, 16)); }
    window.__held = pts;
  }, { x0, y, to: x0 - (x0 - (P[0].x)) * 0.5 });
  await wait(250);
  b = await bd();
  R.push([`${tag}a page turn follows the thumb: half way across, the leaf is half over (${b.turn.toFixed(2)})`, b.turn > 0.35 && b.turn < 0.65]);
  await p.screenshot({ path: new URL(`./out/landscape-turn-${W}.png`, import.meta.url).pathname }).catch(() => {});
  await p.evaluate(async () => { const cv = document.querySelector("canvas"); await new Promise((r) => setTimeout(r, 200)); cv.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: window.__held, cancelable: true, bubbles: true })); });
  await wait(800);
  b = await bd();
  R.push([`${tag}letting go past half way turns the spread`, b.vi === 1 && b.turn === 0]);
  await t.drag(P[0].x + 40, y, y, 110, 260); await wait(800);
  R.push([`${tag}a quick flick the other way turns it back`, (await bd()).vi === 0]);
  await t.tap(P[1].r + 22, y); await wait(800); const fw = (await bd()).vi;
  await t.tap(P[0].x - 22, y); await wait(800);
  R.push([`${tag}the arrows beside the spread turn it forward and back`, fw === 1 && (await bd()).vi === 0]);
  // Show mode: the same spread, full screen, dark.
  await p.click("#bb-show"); await wait(900);
  const sh = await bd();
  R.push([`${tag}Show mode is the same spread, full screen`, sh.show && sh.spread === 2 && Math.abs(sh.pages[0].x - P[0].x) < 1 && Math.abs(sh.pages[0].y - P[0].y) < 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".top")).opacity === "0"))]);
  const done = await rect(p, "#sb-done"), price = await rect(p, "#sb-price");
  R.push([`${tag}its own thin bar holds the prices switch and Done, above the pages`, inside(done, W, H, 0, notch) && done.b <= 48 && done.b <= sh.pages[0].y && Boolean(price) && price.w > 0 && price.r <= done.x]);
  await p.click("#sb-done"); await wait(700);
  // Turning the phone with the binder open: one page at a time in portrait, two facing on its side, the same page.
  await t.drag(P[1].r - 30, y, y, 110, -260); await wait(800); // to the second spread: pages 3 and 4
  await turn(p, H, W);
  let r1 = await bd();
  const pc = (r1.pages[0].r - r1.pages[0].x) * (r1.pages[0].b - r1.pages[0].y) / (W * H);
  R.push([`${tag}turning to portrait leaves the binder open at the same page, one at a time, full frame (${Math.round(pc * 100)}%)`, r1.on && r1.spread === 1 && r1.vi === 2 && r1.pages[0].x >= 0 && r1.pages[0].r <= H + 1 && pc >= 0.9]);
  const up = await p.evaluate(() => { const list = __w.tbList(), v = __w.bnd.vi; return { r: list.slice(v * 9, v * 9 + 9).map((c) => __w.tbPocketRect(c)), said: __w.bnd.labels.get(v) || [] }; });
  const upW = Math.min(...up.r.map((r) => r.w));
  R.push([`${tag}upright, every pocket is at least 30% of the screen's width (${Math.round(upW)}px, ${(upW / H * 100).toFixed(1)}%), its words on the card in full`, up.r.length === 9 && upW / H >= 0.3 && up.said.length >= 18 && up.said.every((t) => !t.includes("…") && !t.includes(".."))]);
  await turn(p, W, H);
  r1 = await bd();
  R.push([`${tag}and on its side again, the same spread`, r1.on && r1.spread === 2 && r1.vi === 1]);
  await p.click("#back"); await wait(1200);
  R.push([`${tag}Back closes the binder, onto its cover in the Trade room`, !(await bd()).on && (await p.evaluate(() => __w.rooms.at === "trade" && !__w.rooms.map && !document.getElementById("pg-trade").hidden))]);
  await p.click("#pt-cover"); await wait(1300);
  await t.pinch(W / 2, H / 2, 300, 160, 100); await wait(1200);
  R.push([`${tag}a quick pinch closes it to the Trade room`, !(await bd()).on && (await p.evaluate(() => __w.rooms.at === "trade" && !__w.rooms.map))]);
  // The table runs across: their spares at the left, the table in the middle, yours at the right; a card of yours
  // pulled sideways onto the table stays there.
  await p.evaluate(() => document.querySelector("#pt-traders [data-t]").click()); await wait(500);
  await p.evaluate(() => document.querySelector('#trade-how [data-how="person"]')?.click()); await wait(1500);
  const tb = await p.evaluate(() => { const L = __w.tbl.L; return { on: __w.tbl.on, across: L.across, order: L.their.x + L.their.w <= L.strip.x && L.strip.x + L.strip.w <= L.your.x }; });
  R.push([`${tag}the trade table runs across: theirs, the table, yours`, tb.on && tb.across && tb.order]);
  const card = await p.evaluate(() => { const r = __w.slotRect("your", 0); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; });
  await t.drag(card.x, card.y, card.y, 260, -(card.x - W / 2)); await wait(900);
  R.push([`${tag}a card of yours pulled sideways onto the table stays on it`, (await p.evaluate(() => __w.tbl.give.length)) === 1]);
  const bar = await rect(p, "#tradebar"), strip = await p.evaluate(() => __w.tbl.L.strip);
  R.push([`${tag}the trade bar sits under the table, between the two binders`, Boolean(bar) && bar.x >= strip.x - 1 && bar.r <= strip.x + strip.w + 1 && bar.y >= strip.y + strip.h - 1]);
  await p.click("#back"); await wait(1200);
  R.push([`${tag}no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  await p.close();
}

// ----- the sheets and pages: on screen, clear of the notch, and they survive a turn -----
{
  const W = 844, H = 390, p = await open(W, H, { notch: NOTCH, dark: true });
  const wel = await rect(p, "#welcome");
  R.push(["the welcome lies low and wide, the wall above it", inside(wel, W, H, NOTCH, NOTCH) && wel.h < H * 0.55 && wel.w > W * 0.6]);
  await p.click("#w-next"); await wait(300); await p.click('[data-src="TCGplayer"]'); await wait(1500);
  await p.click(".st-skip"); await wait(1200);
  const ar = await rect(p, "#arrival");
  R.push(["Import complete fits the screen, its rows beside its summary", inside(ar, W, H, NOTCH, NOTCH) && (await p.evaluate(() => { const a = document.querySelector(".ar-rows").getBoundingClientRect(), h = document.querySelector("#arrival h2").getBoundingClientRect(); return a.left > h.right; }))]);
  await turn(p, H, W);
  const ar2 = await rect(p, "#arrival");
  R.push(["turning to portrait, it's still up and on screen", inside(ar2, H, W) && (await p.evaluate(() => __w.summary.on))]);
  await p.click("[data-ar-close]"); await wait(600);
  await turn(p, W, H);
  await p.evaluate(() => { __w.toMap(); }); await wait(900); await p.evaluate(() => __w.openPlace("feed")); await wait(1100);
  const feed = await p.evaluate(() => { const rows = [...document.querySelectorAll("#pf-list .fd-row")].slice(0, 2).map((e) => e.getBoundingClientRect()); return rows.length === 2 && Math.abs(rows[0].top - rows[1].top) < 2 && rows[1].left > rows[0].right; });
  R.push(["the Feed sets its listings two to a row", feed]);
  await p.evaluate(() => __w.openListing(__w.feedList()[0].id)); await wait(600);
  const ls = await rect(p, "#lsheet"), photo = await rect(p, "#lsheet .ls-photo"), head = await rect(p, "#lsheet .ls-head");
  R.push(["a listing's sheet fits the screen, its photo beside its details", inside(ls, W, H, NOTCH, NOTCH) && photo.r <= head.x + 1]);
  await turn(p, H, W);
  R.push(["turning to portrait, the listing is still open and fits", (await p.evaluate(() => document.getElementById("lsheet").open)) && inside(await rect(p, "#lsheet"), H, W)]);
  await p.keyboard.press("Escape"); await wait(300);
  await turn(p, W, H);
  const page = await p.evaluate((n) => { const r = document.querySelector("#pg-feed .rp-wrap").getBoundingClientRect(); return r.left >= n && r.right <= innerWidth - n; }, NOTCH);
  R.push(["a room's page stays clear of the notch", page]);
  R.push([`no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  await p.close();
}
// ----- a tablet, both ways: the chrome as on a big screen, the binder open as two pages when it's on its side -----
for (const [W, H] of [[1024, 768], [768, 1024]]) {
  const p = await open(W, H, { setup: imported });
  const lens = await rect(p, ".lens");
  R.push([`${W}x${H}: the lens bar stays at the bottom on a tablet`, lens.b > H - 40]);
  await p.click("#rooms"); await wait(900); await p.evaluate(() => __w.openPlace("trade")); await wait(1100);
  await p.click("#pt-cover"); await wait(1300);
  const sp = await p.evaluate(() => ({ on: __w.bnd.on, spread: __w.bnd.L.spread, ok: __w.bnd.L.pages.every((x) => x.x >= 0 && x.x + __w.bnd.L.pw <= innerWidth && x.y + __w.bnd.L.ph <= innerHeight) }));
  R.push([`${W}x${H}: the binder opens ${W > H ? "as two facing pages" : "a page at a time"}, on screen`, sp.on && sp.spread === (W > H ? 2 : 1) && sp.ok]);
  R.push([`${W}x${H}: no page errors${p.errors.length ? `: ${p.errors[0]}` : ""}`, !p.errors.length]);
  await p.close();
}
await browser.close();
const bad = report(R);
console.log(bad ? `\n${bad} landscape check(s) failed.` : "\nAll landscape checks passed.");
process.exit(bad ? 1 : 0);
