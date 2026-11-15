// Card Chaser's video recorder. Films the app on a phone-sized screen and cuts a vertical video from it.
//   node record.mjs walkthrough            videos/out/walkthrough.mp4 (about 27 s)
//   node record.mjs short [--set Eevee]    videos/out/daily-short.mp4 (12 to 15 s) and caption.txt
//   --rehearse[=<app repo>]  run against a local copy of the app (its own build and server code, a made-up account)
//                            instead of production; see README.md
//   --out <dir>              where the files go (default videos/out)
//   --keep                   keep the frames and the timeline in out/work for a look afterwards
// Production needs DEMO_EMAIL and DEMO_PASSWORD in the environment; they are never printed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openSession, sleep, beat } from "./lib/session.mjs";
import { Film } from "./lib/capture.mjs";
import { renderClip, renderEndCard, finish, probe, XF } from "./lib/edit.mjs";
import { Art, ACCENTS, APP_Y, APP_H } from "./lib/art.mjs";
import { toWall, panelInView, openPanel, openWithFlight, setFilters, missingByPrice, safeDepth, findMissingWithOffer, cardToDeal } from "./lib/scenes.mjs";
import { log, Fail } from "./lib/log.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const kind = args[0];
const opt = (name) => { const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`)); if (i < 0) return null; const a = args[i]; return a.includes("=") ? a.slice(a.indexOf("=") + 1) : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true; };
if (!["walkthrough", "short"].includes(kind)) { console.error("Usage: node record.mjs walkthrough|short [--set <name>] [--rehearse[=<app repo>]] [--out <dir>] [--keep]"); process.exit(2); }

const OUT = path.resolve(opt("out") && opt("out") !== true ? opt("out") : path.join(HERE, "out"));
const WORK = path.join(OUT, "work", kind);
const SETS = JSON.parse(fs.readFileSync(path.join(HERE, "sets.json"), "utf8"));
const re = (s) => new RegExp(`^(Every\\s+)?${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
const panelOf = (s) => (s.panel ? new RegExp(s.panel, "i") : re(s.name));

/** Today's set for the short: by day of the year in California, so it rotates daily through sets.json. */
function setOfTheDay() {
  const named = opt("set");
  if (named && named !== true) { const s = SETS.find((x) => x.name.toLowerCase() === String(named).toLowerCase()); if (!s) throw new Fail(`No set named ${named} in sets.json`); return s; }
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return SETS[day % SETS.length];
}

// Pacing: every scroll is filmed at half speed and played at 2x (SLOW), so the video has a fresh frame for every frame
// it shows; taps, the app's flights and the deal play at their own speed. The video builds to the deal: the set flies
// open, the cards glide by dearest first, a missing card flies up close, and the deal lands with its stamp.
const SLOW = 2;

async function walkthrough(S, F) {
  // 1. The Wall: one long glide down the set grids.
  const c1 = "Your whole collection on one wall";
  await toWall(S);
  await F.begin("1 · The Wall", c1, { speed: SLOW });
  await sleep(1100);
  await S.glide(460, 6800);
  await sleep(700);
  await F.end();

  // 2. The 30th Celebration flies open; the finished set (owned filled in, missing faded) glides by.
  const c2 = "See exactly what you're missing";
  await toWall(S);
  await openWithFlight(F, S, /^30th Celebration$/, "30th Celebration", c2);
  if (!(await S.label(/^Have \d/)) || !(await S.label(/^(Missing|Chasing) \d/))) throw new Fail("30th Celebration: no Have / Missing (Chasing) counts on screen");
  const d30 = await safeDepth(S, "30th Celebration", 460);
  await F.begin("2 · 30th Celebration", c2, { speed: SLOW });
  await sleep(500);
  if (d30 > 60) await S.glide(d30, 5000); else await sleep(4000);
  await sleep(900);
  await F.end();

  // 3. Build your own set: Add a set, Make your own set, Pikachu, ending on "Put it on the wall" (not tapped).
  const c3 = "Build your own sets";
  await toWall(S);
  await S.tapEl("#add", { pause: false });
  await S.page.locator("#add-menu [data-add=set]").waitFor({ state: "visible" }).catch(() => { throw new Fail("The + menu has no Add a set"); });
  await S.tapEl("#add-menu [data-add=set]", { pause: false });
  await S.page.locator("#cs-own").waitFor({ state: "visible" }).catch(() => { throw new Fail("Add a set has no Make your own set"); });
  await S.settled("Add a set");
  await F.begin("3 · Make your own set", c3);
  await sleep(450);
  await S.tapEl("#cs-own");
  await S.page.locator("#cs-q").waitFor({ state: "visible" }).catch(() => { throw new Fail("Make your own set has no Pokémon field (#cs-q)"); });
  await S.tapEl("#cs-q");
  // "Pika", then the Pikachu choice: typing the whole name picks it by itself (65-chases.js), and a tap would un-pick it.
  await S.page.keyboard.type("Pika", { delay: 120 });
  const chip = S.page.locator("#chase-sheet .cs-chip", { hasText: /^\s*Pikachu(?![A-Za-z])/ }).first();
  await chip.waitFor({ state: "visible", timeout: 8000 }).catch(() => { throw new Fail("No Pikachu choice under the Pokémon field"); });
  await S.settled("Pikachu typed", { quiet: 500, timeout: 10000 });
  await S.tapEl(chip, { pause: false });
  await sleep(260);
  await F.end();
  await S.page.waitForFunction(() => { const b = document.getElementById("cs-save"); return b && !b.disabled && /Put it on the wall/.test(b.textContent); }, null, { timeout: 15000 }).catch(async () => {
    const st = await S.page.evaluate(() => ({ q: document.getElementById("cs-q")?.value, n: document.getElementById("cs-n")?.textContent, line: document.getElementById("cs-line")?.textContent }));
    throw new Fail(`"Put it on the wall" never came up ready (Pokémon field "${st.q}", ${st.n} to go, "${st.line}")`);
  });
  await S.page.locator("#cs-save").scrollIntoViewIfNeeded();
  await S.settled("Make your own set, Pikachu picked");
  await F.begin("3 · Put it on the wall", c3);
  await sleep(300);
  await S.spotlight(S.page.locator("#cs-save"));
  await sleep(700);
  await F.end();
  // Not saved: the demo account already has its Pikachu set (sets.json). Closed without a tap on the button.
  await S.page.locator("#cs-close").click().catch(() => {});

  // 4. The finished Pikachu set, dearest first, gliding by.
  const c4 = "Every Pikachu, one grid";
  const pika = SETS.find((s) => s.name === "Pikachu") || { name: "Pikachu" };
  await toWall(S);
  const pp = await panelInView(S, panelOf(pika));
  await openPanel(S, pp, "The Pikachu set");
  await setFilters(S, "The Pikachu set", { show: "all", order: "price" }); // dearest first: the best art leads
  const d4 = await safeDepth(S, "The Pikachu set", 680);
  await F.begin("4 · The Pikachu set", c4, { speed: SLOW });
  await sleep(1100);
  if (d4 > 60) await S.glide(d4, 7600); else await sleep(6000);
  await sleep(700);
  await F.end();

  // 5. The climax: a missing card flies up close, View offers in Find, the deal lands with its stamp.
  const c5 = "Find fair prices for the gaps";
  await missingByPrice(S, "The Pikachu set");
  const card = await findMissingWithOffer(S, "The Pikachu set");
  await S.settled("The Pikachu set, a missing card in view");
  await cardToDeal(F, S, card, "5", c5, { hold: 2300 });
}

async function short(S, F, set) {
  const name = set.name;
  const c1 = `Every ${name} card, on one wall`;
  await toWall(S);
  const flew = await openWithFlight(F, S, panelOf(set), `The ${name} set`, c1);
  await setFilters(S, `The ${name} set`, { show: "all", order: "price" }); // dearest first: the best art leads
  const d1 = await safeDepth(S, `The ${name} set`, 690);
  await F.begin(`1 · The ${name} set`, c1, { speed: SLOW });
  await sleep(flew ? 600 : 1200);
  if (d1 > 60) await S.glide(d1, 6400); else await sleep(5000);
  await sleep(900);
  await F.end();
  await missingByPrice(S, `The ${name} set`);
  const card = await findMissingWithOffer(S, `The ${name} set`);
  await S.settled(`The ${name} set, a missing card in view`);
  await cardToDeal(F, S, card, "2", "And the best price for the ones you're missing", { hold: 2200 });
  return card;
}

function postCaption(name) {
  const tag = name.replace(/[^A-Za-z0-9]/g, "");
  return `Every ${name} card on one wall, and the best price for the ones you're missing. Free at cardchaser.app #${tag} #PokemonTCG #PokemonCards`;
}

async function main() {
  // A rehearsal's server fetches real market prices with Node's own fetch, which uses the machine's HTTPS proxy only
  // when NODE_USE_ENV_PROXY is set at start (Node 22.21 and up): start again with it where there's a proxy.
  if (opt("rehearse") && (process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, ["--no-warnings", ...process.argv.slice(1)], { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
    process.exit(r.status ?? 1);
  }
  const t0 = Date.now();
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  let rehearse = null;
  if (opt("rehearse")) {
    const { rehearsal } = await import("./lib/rehearse.mjs");
    const repo = opt("rehearse") === true ? process.env.CARD_CHASER_REPO || path.resolve(HERE, "../../Card-Chaser") : opt("rehearse");
    log(`Rehearsal: the app from ${repo}, on its own server code and a made-up account (not production)`);
    rehearse = await rehearsal(repo, { sets: SETS, focus: kind === "walkthrough" ? ["Pikachu"] : [setOfTheDay().name], cacheFile: path.join(OUT, ".rehearsal-prices.json") });
  }
  const set = kind === "short" ? setOfTheDay() : null;
  if (set) log(`Today's set: ${set.name}`);
  const S = await openSession({ rehearse, email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD });
  const F = new Film(S, path.join(WORK, "frames"));
  let failed = null;
  try {
    S.startGuard();
    await F.start();
    if (kind === "walkthrough") await walkthrough(S, F); else await short(S, F, set);
    S.assertClean();
  } catch (e) {
    failed = e;
  } finally {
    await F.stop();
  }
  if (failed) {
    const privacy = /email/i.test(failed.message); // (no screenshot that could show the address)
    const shot = privacy ? null : await S.failShot(path.join(OUT, `failure-${kind}.png`));
    await S.close();
    console.error(`\nFAILED: ${failed.message}${shot ? `\nScreenshot: ${shot}` : ""}`);
    if (!(failed instanceof Fail)) console.error(failed.stack);
    console.error("No video was written.");
    process.exit(1);
  }
  const errs = S.errors.slice(0, 5);
  await S.close();
  if (errs.length) log(`Page errors while filming (not fatal): ${errs.join(" | ").slice(0, 400)}`);

  // Cut and encode.
  log(`Cutting ${F.clips.length} clips from ${F.frames.length} frames`);
  const art = await Art.open(path.join(WORK, "art"));
  const frame = await art.frame();
  const captions = [...new Set(F.clips.map((c) => c.caption))];
  const capFile = new Map();
  for (const [i, c] of captions.entries()) capFile.set(c, await art.caption(c, i, ACCENTS[i % ACCENTS.length]));
  const endFrames = await art.endCard();
  const stamps = new Map();
  // (a page's y on the screen to the video's: the screen is APP_H tall from APP_Y; the stamp's foot about 92 px above the row, clear of it and of the Buy button over it)
  for (const c of F.clips) if (c.sticker) stamps.set(c, { pattern: await art.stamp(c.sticker.big, c.sticker.small, c.sticker.pageY != null ? { bottom: APP_Y + ((c.sticker.pageY - 92) * APP_H) / 844 } : {}), at: c.sticker.at });
  const parts = F.clips.map((c, i) => renderClip(F.framesOf(c), { frame, caption: capFile.get(c.caption), fresh: i === 0 || F.clips[i - 1].caption !== c.caption, speed: c.speed || 1, sticker: stamps.get(c) || null }, path.join(WORK, `part-${String(i).padStart(2, "0")}.mp4`), WORK, i));
  await art.close();
  parts.push(renderEndCard(endFrames, path.join(WORK, "end.mp4")));
  const joins = F.clips.slice(1).map((c, i) => (c.caption === F.clips[i].caption ? XF.within : XF.scene)).concat([XF.end]);
  const file = path.join(OUT, kind === "walkthrough" ? "walkthrough.mp4" : "daily-short.mp4");
  finish(parts, joins, file);
  const p = probe(file);
  const want = kind === "walkthrough" ? [22, 32] : [12, 15];
  const problems = [];
  if (p.width !== 1080 || p.height !== 1920) problems.push(`size ${p.width}x${p.height}`);
  if (Math.round(p.fps) !== 30) problems.push(`${p.fps} fps`);
  if (p.codec !== "h264") problems.push(p.codec);
  if (p.audio) problems.push("has audio");
  if (p.bytes >= 10 * 1024 * 1024) problems.push("over 10 MB");
  if (p.duration < want[0] - 0.05 || p.duration > want[1] + 0.05) problems.push(`${p.duration.toFixed(1)} s long (wanted ${want[0]} to ${want[1]})`);
  fs.writeFileSync(path.join(WORK, "timeline.json"), JSON.stringify({ kind, set: set?.name || null, clips: F.clips.map((c) => { const fr = F.framesOf(c), gaps = fr.map((f) => f.dur).sort((a, b) => a - b); return { scene: c.scene, caption: c.caption, seconds: +((c.end - c.start) / (c.speed || 1)).toFixed(3), speed: c.speed || 1, fps: +(fr.length / (c.end - c.start)).toFixed(1), worstGapMs: Math.round(gaps.at(-1) * 1000), p90GapMs: Math.round(gaps[Math.floor(gaps.length * 0.9)] * 1000) }; }), output: p }, null, 2));
  if (opt("keep")) fs.writeFileSync(path.join(WORK, "frames.json"), JSON.stringify({ frames: F.frames.map((f) => f.t), clips: F.clips.map((c) => [c.scene, c.start, c.end]), marks: S.marks || [] }));
  if (problems.length) { fs.rmSync(file, { force: true }); console.error(`FAILED: the video came out wrong: ${problems.join(", ")}. No video was written.`); process.exit(1); }
  if (kind === "short") fs.writeFileSync(path.join(OUT, "caption.txt"), postCaption(set.name) + "\n");
  if (!opt("keep")) fs.rmSync(path.join(OUT, "work"), { recursive: true, force: true });
  log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${file} — ${p.duration.toFixed(2)} s, ${(p.bytes / 1048576).toFixed(2)} MB, ${p.width}x${p.height} ${p.codec} ${Math.round(p.fps)} fps, no audio`);
  process.exit(0);
}
main().catch((e) => { console.error(e instanceof Fail ? `FAILED: ${e.message}\nNo video was written.` : e); process.exit(1); });
