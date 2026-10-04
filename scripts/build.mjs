// Builds the Wall into one self-contained HTML file.
//
//   node scripts/build.mjs                      -> dist/wall.html
//   node scripts/build.mjs --variant deals-tab  -> dist/deals-tab.html (src/parts with variants/deals-tab applied)
//   node scripts/build.mjs --debug              -> also exposes window.__w for the tests
//   node scripts/build.mjs --all                -> the base and every variant
//
// How parts work: every file in src/parts is a plain script fragment. They're joined in filename order inside one
// function scope, so they share variables without imports (that's what keeps iteration fast and the output one file
// you can publish anywhere). A variant folder can:
//   - replace a part: a file with the same name as one in src/parts (e.g. variants/x/51-gestures.js)
//   - add a part: a new name that sorts where it should run (e.g. variants/x/65-deals-tab.js)
//   - remove a part: list its name in variants/x/remove.txt
//   - change the markup or styles: variants/x/index.html replaces src/index.html; variants/x/styles.css is appended
//   - redefine a single function: declare it again in an added part. Function declarations are hoisted and the
//     last one wins everywhere, so a variant can swap one behaviour without copying a whole part.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };

export function build({ variant = null, debug = false } = {}) {
  const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
  const vdir = variant ? path.join("variants", variant) : null;
  if (vdir && !fs.existsSync(path.join(root, vdir))) throw new Error(`No variant folder ${vdir}`);
  const vfile = (n) => (vdir && fs.existsSync(path.join(root, vdir, n)) ? path.join(vdir, n) : null);
  const removed = new Set((vfile("remove.txt") ? read(vfile("remove.txt")) : "").split(/\s+/).filter(Boolean));
  const parts = new Map();
  for (const f of fs.readdirSync(path.join(root, "src/parts")).filter((f) => f.endsWith(".js"))) parts.set(f, path.join("src/parts", f));
  if (vdir) for (const f of fs.readdirSync(path.join(root, vdir)).filter((f) => /^\d\d-.*\.js$/.test(f))) parts.set(f, path.join(vdir, f));
  for (const f of removed) parts.delete(f);
  const order = [...parts.keys()].sort();
  let js = `${read("src/intro.txt")}(() => {\n"use strict";\n`;
  for (const f of order) js += `\n// ===== ${parts.get(f)} =====\n${read(parts.get(f))}`;
  if (debug) js += `\n// ===== test hook (debug builds only) =====\nwindow.__w = { state, cam, groups, hit, kick, get view() { return view; }, get mScroll() { return mScroll; }, get mMax() { return mMax; }, get gesture() { return gesture; }, get mode() { return mode; } };\n`;
  js += "})();\n";
  const css = read("src/styles.css") + (vfile("styles.css") ? `\n/* ===== ${vdir}/styles.css ===== */\n${read(vfile("styles.css"))}` : "");
  const html = read(vfile("index.html") || "src/index.html");
  if (!html.includes("/* STYLES */") || !html.includes("/* SCRIPT */")) throw new Error("index.html needs the /* STYLES */ and /* SCRIPT */ markers");
  return { html: html.replace("/* STYLES */", () => css).replace("/* SCRIPT */", () => js), parts: order.map((f) => parts.get(f)) };
}

export function variants() {
  const dir = path.join(root, "variants");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => !d.startsWith("_") && fs.statSync(path.join(dir, d)).isDirectory()) : [];
}

export function write({ variant = null, debug = false, out = null } = {}) {
  const { html, parts } = build({ variant, debug });
  const file = out || path.join(root, "dist", `${variant || "wall"}${debug ? ".debug" : ""}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return { file, parts, bytes: html.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const list = flag("all") ? [null, ...variants()] : [opt("variant")];
  for (const v of list) {
    const r = write({ variant: v, debug: flag("debug"), out: opt("out") });
    console.log(`${path.relative(root, r.file)}  ${(r.bytes / 1024).toFixed(0)} KB  (${r.parts.length} parts)`);
  }
}
