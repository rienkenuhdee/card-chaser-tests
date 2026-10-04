// Rebuilds on every save and serves dist/ at http://localhost:5173 (open it on your phone on the same Wi-Fi with
// your computer's address). Every build is also written as a debug build, so the tests can run against it.
//   npm run dev                      the base wall
//   npm run dev -- --variant name    a variant
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { write } from "./build.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const variant = args.includes("--variant") ? args[args.indexOf("--variant") + 1] : null;
const port = Number(process.env.PORT || 5173);
let version = 0;

function rebuild() {
  try { const r = write({ variant }); write({ variant, debug: true }); version++; console.log(`built ${path.relative(root, r.file)} (${(r.bytes / 1024).toFixed(0)} KB)`); }
  catch (e) { console.error("build failed:", e.message); }
}
rebuild();
let t;
for (const dir of ["src", "variants"]) fs.watch(path.join(root, dir), { recursive: true }, () => { clearTimeout(t); t = setTimeout(rebuild, 80); });

// The page polls /__version and reloads itself after a rebuild.
const reload = `<script>(()=>{let v=null;setInterval(async()=>{try{const r=await fetch("/__version");const n=await r.text();if(v&&n!==v)location.reload();v=n;}catch{}},700);})();</script>`;
http.createServer((req, res) => {
  if (req.url === "/__version") { res.end(String(version)); return; }
  const name = req.url === "/" ? `${variant || "wall"}.html` : decodeURIComponent(req.url.slice(1).split("?")[0]);
  const file = path.join(root, "dist", name);
  if (!file.startsWith(path.join(root, "dist")) || !fs.existsSync(file)) { res.statusCode = 404; res.end("not found"); return; }
  let body = fs.readFileSync(file, "utf8");
  if (name.endsWith(".html")) body = body.replace("</body>", `${reload}</body>`);
  res.setHeader("content-type", name.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain");
  res.end(body);
}).listen(port, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`\nThe Wall: http://localhost:${port}${ips.length ? `   on your phone: ${ips.map((ip) => `http://${ip}:${port}`).join("  ")}` : ""}\n`);
});
