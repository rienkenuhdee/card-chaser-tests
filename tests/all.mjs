// npm test: gestures, landscape, smoke, performance and canvas memory, for the base wall or one variant (--variant name).
import { spawnSync } from "node:child_process";
const extra = process.argv.slice(2);
let failed = 0;
for (const t of ["gestures", "landscape", "smoke", "perf", "memory"]) {
  console.log(`\n=== ${t} ===`);
  const r = spawnSync(process.execPath, [new URL(`./${t}.mjs`, import.meta.url).pathname, ...extra], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) failed.` : "\nEverything passed.");
process.exit(failed ? 1 : 0);
