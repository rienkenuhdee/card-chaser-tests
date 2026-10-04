// dist/index.html: one page linking the base wall and every variant, with each variant's concept from its NOTES.md.
// It's what a Netlify deploy preview opens to, so a round can be tried from a phone with one link.
import fs from "node:fs";
import path from "node:path";
import { variants } from "./build.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const rows = variants().map((v) => {
  const notes = path.join(root, "variants", v, "NOTES.md");
  const text = fs.existsSync(notes) ? fs.readFileSync(notes, "utf8") : "";
  const concept = (text.match(/\*\*Concept:\*\*\s*(.+)/) || [])[1] || "";
  const first = (text.match(/## Try this first on the phone\s+1\.\s*(.+)/) || [])[1] || "";
  return { v, concept, first };
});
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The Wall: variants</title><style>
:root{--bg:#ECEEF2;--ink:#12151D;--muted:#626979;--card:#FAFBFD;--line:rgb(18 21 29 / .1);color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0F121A;--ink:#E8EBF1;--muted:#8B92A5;--card:#161A24;--line:rgb(232 235 241 / .1);color-scheme:dark}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 "Helvetica Neue",Arial,system-ui,sans-serif;padding:calc(env(safe-area-inset-top,0px) + 20px) 16px calc(env(safe-area-inset-bottom,0px) + 24px)}
main{max-width:600px;margin:0 auto}h1{font-size:28px;margin:0 0 4px}p.sub{color:var(--muted);margin:0 0 18px}
a.row{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:10px}
a.row b{font-size:17px}a.row span{display:block;color:var(--muted);font-size:14px;margin-top:3px}
</style></head><body><main><h1>The Wall</h1><p class="sub">Tap one to try it. Each opens full screen.</p>
<a class="row" href="wall.html"><b>Current wall</b><span>What's been harvested so far.</span></a>
${rows.map((r) => `<a class="row" href="${esc(r.v)}.html"><b>${esc(r.v)}</b>${r.concept ? `<span>${esc(r.concept)}</span>` : ""}${r.first ? `<span>Try first: ${esc(r.first)}</span>` : ""}</a>`).join("\n")}
${rows.length ? "" : `<p class="sub">No variants yet. Run a round in Claude Code: /round &lt;question&gt;</p>`}
</main></body></html>`;
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "index.html"), html);
console.log(`dist/index.html  (${rows.length} variant${rows.length === 1 ? "" : "s"})`);
