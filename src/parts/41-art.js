// ---------- card pictures (round 22 polish) ----------
// Close enough to see, a card shows its real picture: the free scans production uses, from images.pokemontcg.io for
// most sets (the large scan, `_hires.png`, once a card is drawn big, falling back to the small one) and from Scrydex for
// the 2026 sets (`/large`, then `/small`). Only cards drawn at a readable size on a close level ask for one: a set's
// binder, a card up close, the Chase lens tiles, the table, the trade binder's pockets, and the pages' thumbnails.
// Never far out in the mosaic, where the flat colour and the shapes are the picture and the frame budget is tight.
//   Pictures load lazily (the freshest want first; a card flung past is dropped from the queue), decode off the main
// thread (img.decode, then an ImageBitmap) and are kept by URL in a cache capped at ART_CAP bytes of decoded pixels,
// least recently drawn out first (Safari's memory counts images as well as canvases). A frame never waits on one: until
// a picture arrives, or when it fails, the drawn face stands in, so a card is never blank. A host that fails every time
// (offline, blocked) is given up on for the visit after a few tries, so it costs nothing after that.
//   Pictures are requested with CORS (crossOrigin "anonymous"; both hosts send Access-Control-Allow-Origin), so a canvas
// that draws one stays readable. A picture that won't load that way isn't loaded at all: the face stands in.
//   The vintage scans are 1st Edition prints (the only free ones); where a card is shown large, the panel says so.
const ART_CAP = 32 * 1048576; // bytes of decoded pixels kept (about 95 small scans, or 10 large ones)
const ART_MIN = 40; // css px: narrower than this a scan is mush, and the drawn face reads better
const ART_BIG = 380; // device px: wider than this a card asks for the large scan
const ART_STAMPED = new Set(["base1", "base2", "base3", "base5", "neo1"]); // vintage sets whose free scans show 1st Edition prints
const ART = { map: new Map(), queue: new Set(), inflight: 0, max: 4, bytes: 0, timer: 0, fails: new Map(), oks: new Set(), seen: new Set(), inject: new Map(), log: [], far: false, still: false, settle: 0, lastWant: 0 }; // far: no new requests (the mosaic, the map); still: painted once and kept
const artHost = (u) => (u.startsWith("data:") || u.startsWith("blob:") ? "local" : u.split("/")[2] || "");
const artDown = (u) => !ART.oks.has(artHost(u)) && (ART.fails.get(artHost(u)) || 0) >= 6; // six misses and not one hit: blocked or offline
// A card's picture addresses, best first. Printings and twins show their card's picture (the tag says which print).
const artUrlMemo = new Map(); // (asked for every card drawn, every frame: built once)
function artUrls(c, big) {
  const r = rootOf(c), key = big ? `${r.id}+` : r.id;
  let v = artUrlMemo.get(key);
  if (v) return v;
  const st = sets[r.si], inj = ART.inject.get(r.id), n = encodeURIComponent(r.num);
  if (inj) v = big && inj.big ? [inj.big, inj.small] : [inj.small];
  else if (st.id === "me5" || st.id === "me55") { const b = `https://images.scrydex.com/pokemon/${st.id}-${n}`; v = big ? [`${b}/large`, `${b}/small`] : [`${b}/small`]; }
  else { const b = `https://images.pokemontcg.io/${st.id}/${n}`; v = big ? [`${b}_hires.png`, `${b}.png`] : [`${b}.png`]; }
  artUrlMemo.set(key, v);
  return v;
}
// Production's note under a vintage scan: the picture is of a 1st Edition print, whichever print you have.
const artStamped = (c) => ART_STAMPED.has(sets[rootOf(c).si].id) && c.tag !== "1st Ed";

// ----- the canvas: what to draw for a card at this size (a ready entry, or null for the face) -----
function artWant(u, ask) {
  const t = performance.now(); // (not the frame's time: pictures painted once are drawn with none)
  let e = ART.map.get(u);
  if (!e) {
    if (!ask || artDown(u)) return null; // far out, or painting the map: no new requests
    e = { url: u, state: "queued", want: t, used: t, bytes: 0, bmp: null, t: 0 };
    ART.map.set(u, e); ART.queue.add(e); artSchedule(40);
  }
  e.want = ART.lastWant = t;
  if (e.state !== "ready" || (ART.still && t - e.t < 200)) return null; // painted once and kept: only a settled picture
  e.used = t;
  return e;
}
function artFor(c, w) {
  // Asked for where the card is close up and big enough to read (the Chase lens's tiles count), once the level has
  // landed: not mid-pinch or mid-flight, when a card passes through sizes and places it won't stay at. One already in
  // is drawn at any size a face is (so a pinch grows the picture, rather than swapping the face for it part way).
  // Far out (the mosaic, the map) it's the colour and the shapes, picture or not, so the wall reads as one surface.
  if (ART.far && (!c.lift || ART.still)) return null;
  const big = w * dpr > ART_BIG, [u0, u1] = artUrls(c, big), ask = w >= ART_MIN && !state.trans && !fly;
  return artWant(u0, ask) || (u1 ? artWant(u1, ask) : null); // the large scan, or the small one meanwhile (or instead)
}
// Which picture a card would show at this size, settled: pictures painted once and kept (the trade binder's pages)
// are painted again when this changes, and never caught half way through the fade. Asking keeps its load wanted.
function artMark(c, w) {
  const t = performance.now(), urls = artUrls(c, w * dpr > ART_BIG);
  for (let i = 0; i < urls.length; i++) { const e = ART.map.get(urls[i]); if (e) e.want = t; if (e?.state === "ready" && t - e.t >= 200) return String(i); }
  if (!ART.map.has(urls[0])) artWant(urls[0], !ART.far && !state.trans && !fly);
  return "-";
}
const artFade = (e, now) => (reduced || ART.still ? 1 : clamp((now - e.t) / 200, 0, 1));

// ----- loading: a few at a time, the freshest want first -----
function artSchedule(ms) { if (!ART.timer) ART.timer = setTimeout(artPump, ms); }
function artPump() {
  ART.timer = 0;
  const now = performance.now();
  const list = [...ART.queue].sort((a, b) => b.want - a.want);
  for (const e of list) {
    if (ART.lastWant - e.want > 300) { ART.queue.delete(e); ART.map.delete(e.url); continue; } // left out of the frames since: off screen (asked again if it comes back)
    if (artDown(e.url)) { ART.queue.delete(e); e.state = "failed"; continue; }
    if (ART.inflight >= ART.max) break;
    if (!artRoom(e.url.includes("hires") || e.url.endsWith("/large") ? 3.1e6 : 0.35e6, now)) break; // full of what's on screen
    ART.queue.delete(e); artLoad(e);
  }
  if (ART.queue.size) artSchedule(120);
}
function artLoad(e) {
  ART.inflight++; e.state = "loading";
  if (ART.log.length > 400) ART.log.splice(0, 200);
  ART.log.push(e.url);
  const im = new Image();
  im.crossOrigin = "anonymous"; im.decoding = "async";
  let over = false;
  const done = (bmp) => {
    if (over) { bmp?.close?.(); return; }
    over = true; clearTimeout(slow); ART.inflight--; im.onload = im.onerror = null;
    const host = artHost(e.url);
    if (!bmp) { e.state = "failed"; ART.fails.set(host, (ART.fails.get(host) || 0) + 1); artSchedule(0); return; }
    ART.oks.add(host); ART.fails.delete(host);
    const bytes = (bmp.width || 1) * (bmp.height || 1) * 4;
    if (ART.map.get(e.url) !== e || !artRoom(bytes, performance.now())) { bmp.close?.(); ART.map.delete(e.url); artSchedule(60); return; } // no room after all: it's asked for again while it's on screen
    Object.assign(e, { state: "ready", bmp, bytes, t: performance.now() });
    ART.bytes += bytes; ART.seen.add(e.url);
    kick(); clearTimeout(ART.settle); ART.settle = setTimeout(kick, 240); // the fade, then pictures painted once take it up
    artSchedule(0);
  };
  const slow = setTimeout(() => done(null), 12000); // a stalled load gives up; the face stays
  im.onload = () => {
    const dec = im.decode ? im.decode() : Promise.resolve();
    dec.then(() => (window.createImageBitmap ? createImageBitmap(im) : im)).then(done, () => done(im.naturalWidth ? im : null));
  };
  im.onerror = () => done(null);
  im.src = e.url;
}
// Room for this many bytes: the least recently drawn pictures go first, never one drawn in the last half second.
function artRoom(need, now) {
  if (ART.bytes + need <= ART_CAP) return true;
  const old = [...ART.map.values()].filter((e) => e.state === "ready" && now - e.used > 500).sort((a, b) => a.used - b.used);
  for (const e of old) {
    ART.bytes -= e.bytes; e.bmp?.close?.(); ART.map.delete(e.url);
    if (ART.bytes + need <= ART_CAP) return true;
  }
  return false;
}

// ----- drawing a picture where the face would be -----
function artDraw(c, e, sx, sy, w, h, now, value, k) {
  const a0 = ctx.globalAlpha;
  if (k < 1) { ctx.globalAlpha = a0 * k; kick(); }
  ctx.drawImage(e.bmp, sx, sy, w, h);
  // Foil while still, as on the face: holos and up catch the light as the wall comes to rest.
  if (c.tier >= 3 && !reduced && !foilOff && !state.trans && !fly && !inertia && !(tbl.on && tableMoving())) {
    frameFoil = true;
    const phase = ((now * 0.00005 + (sx + cam.x * cam.s * 0.25) * 0.0011) % 1 + 1) % 1, fx = sx - w + phase * w * 3;
    const fg = ctx.createLinearGradient(fx, sy, fx + w * 0.9, sy + h);
    fg.addColorStop(0, "rgb(255 255 255 / 0)"); fg.addColorStop(0.42, "rgb(150 220 255 / .16)"); fg.addColorStop(0.5, "rgb(255 226 160 / .26)"); fg.addColorStop(0.58, "rgb(160 245 205 / .16)"); fg.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.save(); rr(sx, sy, w, h, w * 0.045); ctx.clip();
    ctx.globalCompositeOperation = "screen"; ctx.fillStyle = fg; ctx.fillRect(sx, sy, w, h); ctx.restore();
  }
  // In Value the price is the point: the card wears its heat as a rule.
  if (value) { ctx.lineWidth = Math.max(1.5, w * 0.025); ctx.strokeStyle = heat(c.price); rr(sx + ctx.lineWidth / 2, sy + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth, w * 0.045); ctx.stroke(); }
  if (w >= 56) {
    const s = clamp(w / 120, 0.62, 1.15), ph = 15 * s, py = sy + h - ph - w * 0.035;
    ctx.textBaseline = "alphabetic";
    if (c.tag) artPill(c.tag, sx + w * 0.035, py, ph, s, "left"); // which print: the scan is the card's
    if (value) artPill(short(c.price), sx + w - w * 0.035, py, ph, s, "right"); // (up close the panel has the price)
  }
  ctx.globalAlpha = a0;
}
function artPill(t, x, y, h, s, side) {
  font(700, 10.5 * s); const tw = textW(t) + 10 * s, px = side === "left" ? x : x - tw;
  rr(px, y, tw, h, h / 2); ctx.fillStyle = "rgb(16 18 24 / .78)"; ctx.fill();
  ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(t, px + tw / 2, y + h * 0.72); ctx.textAlign = "left";
}
// The note under a card up close, for a vintage scan: shown only while its picture is.
const artNoteEl = document.createElement("p");
artNoteEl.id = "p-pic"; artNoteEl.className = "p-pic"; artNoteEl.hidden = true;
artNoteEl.textContent = "Pictured: a 1st Edition print.";
document.getElementById("p-meta")?.after(artNoteEl);
// As the panel fills (52-focus.js), before the card is framed above it: a vintage card whose picture is in or on its
// way from a host that answers keeps the note's line, so the panel doesn't grow over the card when the picture lands.
function artPanel(c) {
  const u = artUrls(c, true)[0];
  artNoteEl.hidden = !(artStamped(c) && (ART.oks.has(artHost(u)) || artUrls(c, false).some((x) => ART.seen.has(x))));
  artNoteEl.style.visibility = "hidden";
}
function artNote(c, shown) { // each frame the card is up: the note shows while its picture does
  const v = shown && !artNoteEl.hidden ? "visible" : "hidden";
  if (artNoteEl.style.visibility !== v) artNoteEl.style.visibility = v;
}

// ----- the pages: the same pictures in the markup, over the drawn face (which stays if the picture never comes) -----
// size is the thumbnail's width in css px. The parent gets `pic` once the picture is in, which hides the drawn face.
function artImg(c, size) {
  if (size < 24) return "";
  const urls = artUrls(c, size * dpr > 300).filter((u) => ART.map.get(u)?.state !== "failed" && !artDown(u));
  if (!urls.length) return "";
  return `<img class="art" src="${esc(urls[0])}"${urls[1] ? ` data-alt="${esc(urls[1])}"` : ""} alt="" crossorigin="anonymous" decoding="async" loading="lazy" data-art>`;
}
// Whether the picture is known to be in (so a page drawn again shows it at once, without the face flashing first).
const artIn = (c, size) => ART.seen.has(artUrls(c, size * dpr > 300)[0]);
document.addEventListener("load", (ev) => {
  const im = ev.target;
  if (!(im instanceof HTMLImageElement) || !im.hasAttribute("data-art")) return;
  ART.seen.add(im.getAttribute("src")); ART.oks.add(artHost(im.src)); im.parentElement?.classList.add("pic");
}, true);
document.addEventListener("error", (ev) => {
  const im = ev.target;
  if (!(im instanceof HTMLImageElement) || !im.hasAttribute("data-art")) return;
  const host = artHost(im.src);
  ART.fails.set(host, (ART.fails.get(host) || 0) + 1);
  const alt = im.dataset.alt;
  if (alt && !artDown(alt)) { delete im.dataset.alt; im.src = alt; return; }
  im.parentElement?.classList.remove("pic"); im.remove(); // the drawn face it sat on is the card now
}, true);

// ----- debug builds only: pictures made up in the page, so the views can be seen and tested with art -----
// __w.artInject(ids | "all" | null, big) gives those cards a generated scan (a data URL, through the real loading path;
// the large one too with big); null takes them away again. __w.art reports the cache.
let artMaker = null;
function artFake(c, W) {
  const H = Math.round(W * TH / TW);
  const cv = artMaker || (artMaker = document.createElement("canvas"));
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), col = typeColor(c), k = W / 245, vint = sets[c.si].year < 2003;
  x.clearRect(0, 0, W, H);
  x.beginPath(); x.roundRect(0, 0, W, H, 12 * k); x.fillStyle = vint ? "#F2CF3B" : "#C9CCD2"; x.fill(); // the border
  x.beginPath(); x.roundRect(10 * k, 10 * k, W - 20 * k, H - 20 * k, 6 * k); x.fillStyle = mix(col, "#FFFFFF", 0.35); x.fill(); // the card's body
  x.fillStyle = "#1B1B1B"; x.font = `700 ${15 * k}px Arial`; x.fillText(c.name.slice(0, 18), 20 * k, 34 * k);
  const ax = 22 * k, ay = 42 * k, aw = W - 44 * k, ah = 128 * k; // the art window
  const g = x.createLinearGradient(0, ay, 0, ay + ah); g.addColorStop(0, mix(col, "#FFFFFF", 0.55)); g.addColorStop(1, mix(col, "#000000", 0.25));
  x.fillStyle = g; x.fillRect(ax, ay, aw, ah);
  const h = h32(c.id + "art");
  x.fillStyle = mix(col, "#000000", 0.45); x.beginPath(); x.ellipse(ax + aw * (0.35 + 0.3 * h), ay + ah * 0.58, aw * 0.22, ah * 0.3, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = "rgb(255 255 255 / .7)"; x.beginPath(); x.arc(ax + aw * (0.2 + 0.6 * (1 - h)), ay + ah * 0.25, ah * 0.1, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "#B8A27A"; x.lineWidth = 3 * k; x.strokeRect(ax, ay, aw, ah);
  x.fillStyle = "rgb(0 0 0 / .55)"; for (let i = 0; i < 4; i++) x.fillRect(22 * k, (196 + i * 22) * k, (W - 44 * k) * (0.5 + 0.5 * h32(c.id + i)), 5 * k);
  x.font = `600 ${9 * k}px Arial`; x.fillText(`${c.num}/${sets[c.si].printed}`, W - 60 * k, H - 16 * k);
  return cv.toDataURL("image/png");
}
function artInject(ids, big = false) {
  artUrlMemo.clear();
  if (ids === null) { ART.inject.clear(); for (const e of ART.map.values()) e.bmp?.close?.(); ART.map.clear(); ART.queue.clear(); ART.bytes = 0; kick(); return 0; }
  const list = ids === "all" ? cards : (Array.isArray(ids) ? ids : [ids]).map((id) => cards.find((c) => c.id === id)).filter(Boolean);
  for (const c of list) ART.inject.set(c.id, { small: artFake(c, 245), big: big ? artFake(c, 734) : null });
  if (artMaker) { artMaker.width = artMaker.height = 0; artMaker = null; } // let the scratch canvas go
  for (const [u, e] of ART.map) if (e.state === "failed") ART.map.delete(u);
  kick(); return list.length;
}
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { artInject: { value: artInject }, artUrls: { value: artUrls }, art: { get: () => ({ cap: ART_CAP, bytes: ART.bytes, ready: [...ART.map.values()].filter((e) => e.state === "ready").length, failed: [...ART.map.values()].filter((e) => e.state === "failed").map((e) => e.url), loading: ART.inflight, queued: ART.queue.size, log: [...ART.log], down: [...ART.fails].filter(([h]) => artDown(`x://${h}/`)).map(([h]) => h) }) }, artReset: { value: () => { ART.log.length = 0; ART.fails.clear(); ART.oks.clear(); for (const [u, e] of ART.map) if (e.state === "failed") ART.map.delete(u); } } }); }, 0);
