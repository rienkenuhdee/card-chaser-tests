// Rehearsal: serve the app's own live build and its own server code (on the in-memory store, seeded with the app's
// made-up test account) at https://cardchaser.app inside the browser, so the recorder can be tried end to end without
// touching production. Needs a checkout of the app repo (CARD_CHASER_REPO, default ../Card-Chaser beside this repo)
// with its dependencies installed and its catalog built (npm install && npm run catalog there).
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export async function rehearsal(repoDir, opts = {}) {
  const repo = path.resolve(repoDir);
  const wall = path.join(repo, "wall");
  if (!fs.existsSync(path.join(repo, "public/catalog/cards.json"))) throw new Error(`Rehearsal needs the app's catalog: run "npm install && npm run catalog" in ${repo}`);
  const { build, assetFile } = await import(pathToFileURL(path.join(wall, "scripts/build.mjs")).href);
  const { liveServer } = await import(pathToFileURL(path.join(wall, "tests/live-fixture.mjs")).href);
  const { html } = build({ data: "live" });
  const server = await liveServer();
  await server.reset("small");
  await seed(server, opts);
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const pub = (p) => { const f = path.join(repo, "public", p); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; };
  // Card pictures come from their real hosts, so the cards look as they do on the site (the made-up deals' eBay
  // photos, which don't exist, get a blank stand-in). Fetched through Playwright and handed back with CORS, which the
  // Wall asks for to draw them on its canvas.
  const CARD_HOSTS = new Set(["images.scrydex.com", "images.pokemontcg.io", "tcgplayer-cdn.tcgplayer.com", "assets.tcgdex.net"]);
  const real = async (route) => {
    try {
      const r = await route.fetch({ timeout: 20000 });
      return route.fulfill({ status: r.status(), body: await r.body(), headers: { "content-type": r.headers()["content-type"] || "image/png", "access-control-allow-origin": "*", "cache-control": "public, max-age=86400" } });
    } catch { return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "" }); }
  };
  /** Installs the routes on a Playwright context. */
  async function install(context) {
    await context.route("**/*", async (route) => {
      const req = route.request(), u = new URL(req.url());
      if (u.hostname !== "cardchaser.app") {
        if (CARD_HOSTS.has(u.hostname)) return real(route);
        if (req.resourceType() === "image") return route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: PNG });
        if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return route.continue();
        return route.abort();
      }
      if (u.pathname.startsWith("/api/")) {
        const res = await server.handle({ method: req.method(), path: u.pathname.slice(5), search: u.search, body: req.method() === "POST" ? req.postData() || null : null });
        const type = /^image\//.test(res.headers?.["content-type"] || "") ? res.headers["content-type"] : "application/json";
        return route.fulfill({ status: res.status, contentType: type, body: res.body });
      }
      if (u.pathname === "/" || u.pathname === "/wall/" || u.pathname === "/index.html") return route.fulfill({ status: 200, contentType: "text/html", body: html });
      if (/^\/img\/[sl]\//.test(u.pathname)) return real(route); // (the site's own copies of card pictures: public, read-only)
      const asset = assetFile(u.pathname);
      if (asset) return route.fulfill({ status: 200, contentType: asset.type, body: asset.body });
      const f = pub(u.pathname.replace(/^\//, ""));
      if (f) return route.fulfill({ status: 200, path: f });
      return route.fulfill({ status: 404, body: "" });
    });
  }
  return { install, server };
}

// The stand-in account gets what the demo account has in production: the custom sets in sets.json, the 30th
// Celebration chased, and a few made-up eBay deals under market on cards it's missing, so Find has something to show.
async function seed(server, { sets = [] } = {}) {
  const call = async (method, p, body) => { const r = await server.handle({ method, path: p, body: body ? JSON.stringify(body) : null }); if (r.status >= 400) throw new Error(`rehearsal ${p}: ${r.status} ${r.body.slice(0, 200)}`); return JSON.parse(r.body || "null"); };
  const ops = [{ type: "setChase", set: "me55", value: "chase" }];
  for (const s of sets) if (!/gengar/i.test(s.name)) ops.push({ type: "chaseSave", chase: { id: `c${s.name.toLowerCase()}000`, name: `Every ${s.name}`, kind: "pokemon", value: s.name, rule: { lang: "en", langs: [], dexFrom: String(s.dex), dexTo: String(s.dex) } } });
  await call("POST", "state", { ops });
  await call("POST", "chases/refresh", {});
  const boot = await call("GET", "bootstrap");
  const owned = new Set(boot.state.imported), mk = (set, num) => boot.prices?.[set]?.[num]?.market;
  const all = Object.values(boot.checklists.sets).flatMap((x) => x.cards);
  const pick = (f, n) => all.filter((c) => !c.variant && !owned.has(c.key) && f(c) && mk(c.set, c.number) > 0.5).sort((a, b) => mk(b.set, b.number) - mk(a.set, a.number)).slice(0, n);
  const want = [...pick((c) => c.set === "me55" && Number(c.number) <= 128, 6), ...sets.flatMap((s) => pick((c) => new RegExp(`^${s.name}\\b`, "i").test(c.name), 3))];
  const setInfo = Object.fromEntries([...(boot.sets || []), ...(boot.extraSets || [])].map((x) => [x.id, x]));
  const setName = (id) => setInfo[id]?.name || "", setTotal = (id) => setInfo[id]?.printedTotal || setInfo[id]?.total || boot.checklists.sets[id]?.cards.length || "";
  if (process.env.REHEARSE_DEBUG) console.log("rehearsal deals:", want.map((c) => `${c.key} ${c.name}`).join(", "));
  const feed = await server.readJSON("feed", { items: {} });
  let n = 0;
  for (const c of want) {
    const id = `v1|1200000${++n}|0`, total = Math.round(mk(c.set, c.number) * 74) / 100, now = Date.now();
    feed.items[id] = { id, title: `${c.name} ${c.number}/${setTotal(c.set)} ${setName(c.set)} Pokemon Card NM`, url: `https://www.ebay.com/itm/1200000${n}`, plainUrl: `https://www.ebay.com/itm/1200000${n}`, image: `https://i.ebayimg.com/images/g/rh${n}/s-l500.jpg`, price: total, ship: 0, total, currency: "USD", type: "fixed", bestOffer: false, bids: null, endsAt: null, createdAt: new Date(now - 3600e3).toISOString(), seller: "kanto_kollects", feedbackPct: 99.8, feedbackScore: 900, conditionId: null, condition: "", location: "US", cardKey: c.key, set: c.set, firstSeen: now - 3600e3, lastSeen: now, source: "ebay", graded: false, grade: null, firstEd: false, shadowless: false, reverse: false };
  }
  await server.writeJSON("feed", feed);
}
