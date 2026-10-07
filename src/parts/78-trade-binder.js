// ---------- the trade binder (round 17) ----------
// Real collectors keep a trade binder: nine-pocket pages of the cards they'll part with, flipped through across a table
// at a show. Here it holds exactly the cards you have a spare copy of (sparesOf > 0, from the copies model in
// 77-copies.js), most wanted first, each card naming who chases it along its foot.
//   The cover sits at the top of the Trade room (94-trade-room.js, round 21), with its first page in small. Tap it and
//   that page grows into the binder: a level inside the room, the way a set is a level inside the wall. Swipe
//   sideways to turn the page (it folds about the rings under your thumb, then snaps by speed first, distance second),
//   or tap the arrows beside a spread. Tap a pocket and the trade table opens with whoever wants it, the card already on it. Back, a pinch or Escape
//   returns to the Trade room.
//   Show mode turns the binder into the same spread, dark, to hand across a table: its own thin bar (what's picked,
//   prices shown or hidden, Done) and nothing else, swipe to turn. The other person taps what they'd like. Taking the phone back, Done asks who it was: a trader
//   opens the table with the picks on your side; someone new takes one copy of each (Undo puts them back).
// While the binder is up it owns every touch on the canvas (Touch Events for fingers, pointer events for the mouse),
// like the table. Pages are painted once into the corner of the wall's canvas, copied offscreen and kept, keyed on the
// counts, so a frame in the binder is a handful of drawImage calls.

// ----- what's in it: the cards you have a spare of, most wanted first (then the dearest) -----
const tbMemo = { key: "", list: [], wanted: 0 };
function tbList() {
  const key = `${copiesKey}|${lastFrame}`;
  if (tbMemo.key === key) return tbMemo.list;
  const list = cards.filter((c) => sparesOf(c) > 0).sort(spareOrder);
  tbMemo.key = key; tbMemo.list = list; tbMemo.wanted = list.filter((c) => wantedBy(c).length).length;
  return list;
}
const tbFresh = () => { tbMemo.key = ""; return tbList(); }; // after a change in this same frame
const tbPageCount = () => Math.max(1, Math.ceil(tbList().length / 9));
const plural1 = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ----- geometry: a page is three by three pockets, each a card at 63:88 with what's said about it on the card -----
// Production's proportions (round 22 polish, Ryan: "use the full screen"): one thin bar along the top (Back, the title
// and its count, where you are, Show mode), and the book takes all the height under it. On a wide screen, and on any
// phone on its side, it lies open as two facing pages with the rings down a narrow spine between them and an arrow at
// either side: each page's three rows share its height, every pocket a card at full row height, the grid centred on
// its page, the page number in its outer bottom corner. Upright, one page at a time: the paper across the whole width
// under the bar, the pockets as wide as it allows, the dots and the page number along its bottom edge. Who wants a
// card and its price sit on the card itself, so no line under the pockets takes their height.
// The map's Trade card draws the classic page (full: false), pockets packed.
const SHOW_BG = "#0B0C0F", SHOW_PAGE = "#15171C", SHOW_SLEEVE = "#22262E", SHOW_LINE = "#2C313B", SHOW_MUTED = "#9AA0AD", SHOW_PICK = "#3BD597";
const TB_BAR = 44, TB_ARROW = 44, TB_SLEEVE = 3; // the bar's height, an arrow's column, the sleeve around a card
function tbGeom(show, only = 0, full = true) {
  const S = SAFE, flat = landPhone(), spread = only || (flat || (vw >= 820 && vh >= 600) ? 2 : 1);
  if (!full) { // the classic page, packed: just its proportions matter (the map's card)
    const ring = 20, edge = 10, pad = 8, g = 8, lh = 22, cw = 100, ch = Math.round(cw * TH / TW), pw = ring + cw * 3 + g * 2 + edge, ph = pad * 2 + (ch + lh) * 3 + g * 2;
    return { show, flat, spread, sp: 0, cw, ch, lh, g, gx: g, gy: g, ring, edge, pad, pw, ph, bx: ring, bxL: edge, by: pad, x0: 0, y0: 0, pages: [{ x: 0, y: 0 }] };
  }
  const two = spread === 2, g = 6, sl = TB_SLEEVE, sp = two ? 14 : 0, ring = 12, edge = two ? 12 : 4, pad = 8;
  const y0 = Math.round(S.top + TB_BAR + 2); // the book starts under the bar
  let x0, pw, ph, B;
  if (two) { // between the arrows, clear of the notch at either side and of the home bar
    const l = Math.max(10, S.left), r = Math.max(10, S.right);
    x0 = l + TB_ARROW; pw = Math.floor((vw - l - r - TB_ARROW * 2 - sp) / 2); ph = Math.floor(vh - Math.max(6, S.bottom) - y0); B = 0;
  } else { x0 = 0; pw = Math.floor(vw); ph = Math.floor(vh - y0); B = S.bottom + 30; } // the paper runs to the bottom edge; the dots stand clear of the home bar
  const innerW = pw - ring - edge - sl * 2, availH = ph - pad * 2 - B;
  const byW = (innerW - g * 2) / 3, byH = ((availH - g * 2) / 3) * TW / TH;
  // the card: from the row's height when that's what binds (the usual case on its side), else from the width
  const c0 = clamp(Math.min(byW, byH), 36, 260), byRow = byH <= byW && byH <= 260;
  const ch = byRow ? Math.floor((availH - g * 2) / 3) : Math.floor(c0 * TH / TW), cw = byRow ? Math.floor(ch * TW / TH * 2) / 2 : Math.floor(c0);
  const blockW = cw * 3 + g * 2, exH = Math.max(0, availH - (ch * 3 + g * 2));
  const ay = Math.min(exH / 4, ch * (two ? 0.15 : 0.2)), gy = g + ay; // height to spare (upright, or a tablet): a share between the rows
  const ox = Math.round((innerW - blockW) / 2);
  const bx = ring + sl + ox, bxL = edge + sl + ox, by = Math.round(pad + (availH - (ch * 3 + gy * 2)) / 2);
  return { show, flat, spread, sp, cw, ch, lh: 0, g, gx: g, gy, ring, edge, pad, pw, ph, B, bx, bxL, by, x0, y0, arrows: two ? TB_ARROW : 0, dotY: ph - S.bottom - 15, pages: Array.from({ length: spread }, (_, j) => ({ x: x0 + j * (pw + sp), y: y0 })) };
}
const tbSpreadRect = (G) => ({ x: G.x0, y: G.y0, w: G.pw * G.spread + G.sp, h: G.ph });
// On a two-page spread the rings sit at the spine: a left page has them on its right.
const tbLeft = (G, i) => G.spread === 2 && i % 2 === 0;
function tbPocket(G, i, k) {
  const ox = tbLeft(G, i) ? G.bxL : G.bx;
  return { x: ox + (k % 3) * (G.cw + G.gx), y: G.by + Math.floor(k / 3) * (G.ch + G.lh + G.gy), w: G.cw, h: G.ch };
}
const bnd = { on: false, q: 0, anim: null, closing: false, vi: 0, turn: 0, tAnim: null, show: false, sq: 0, sa: null, prices: true, picks: new Set(), L: null, pinch: null, drag: null, rest: false, swallow: false, press: null, cache: new Map(), labels: new Map() };
const tbViews = () => Math.max(1, Math.ceil(tbPageCount() / (bnd.L?.spread || 1)));
const tbCan = (d) => bnd.vi + d >= 0 && bnd.vi + d < tbViews();

// ----- painting a page (once, into the corner of the wall's canvas, then copied offscreen and kept) -----
// A pocket's picture is the large scan once the pocket is wider on screen than the small scan (an iPhone upright), else
// the small one. A page painted with a picture keeps it when the picture cache later lets it go (tbArtKept), so leafing
// through a binder with more pictures than the cache holds never sets the pages repainting each other's out.
const TB_BIG = 300; // device px
const tbArtKept = new Map();
const tbArtId = (c, w) => `${c.id}|${w * dpr > TB_BIG ? 1 : 0}`;
function tbArt(c, w) { // which picture the pocket would show, settled: "0" the first choice, "1" the small one meanwhile, "-" the face
  const urls = artUrls(c, w * dpr > TB_BIG), t = performance.now();
  for (let i = 0; i < urls.length; i++) { const e = ART.map.get(urls[i]); if (e) e.want = t; if (e?.state === "ready" && t - e.t >= 200) return String(i); }
  const kept = tbArtKept.get(tbArtId(c, w)); if (kept) return kept;
  if (!ART.map.has(urls[0])) artWant(urls[0], !state.trans && !fly);
  return "-";
}
function tbPic(c, w) { // the settled picture to paint (asking for it, and for the small scan meanwhile), or null for the face
  const [u0, u1] = artUrls(c, w * dpr > TB_BIG), ask = !state.trans && !fly, was = ART.still;
  ART.still = true; const e = artWant(u0, ask) || (u1 ? artWant(u1, ask) : null); ART.still = was;
  if (e) tbArtKept.set(tbArtId(c, w), e.url === u0 ? "0" : "1"); else tbArtKept.delete(tbArtId(c, w));
  return e;
}
function tbKey(i, G) {
  const items = tbList().slice(i * 9, i * 9 + 9);
  return `${copiesKey}|${G.show}|${G.pw}|${G.ph}|${G.cw}|${G.spread}|${G.bx}|${G.bxL}|${G.by}|${G.gy}|${G.dotY}|${dpr}|${theme.bg}|${theme["panel-solid"]}|${theme.gold}|${bnd.prices}|${i}|${items.map((c) => `${c.id}.${sparesOf(c)}.${c.away ? 1 : 0}.${tbArt(c, G.cw)}.${G.show && bnd.picks.has(c.id) ? 1 : 0}`).join(",")}`;
}
function tbPaint(i, G) {
  const items = tbList().slice(i * 9, i * 9 + 9), show = G.show, two = G.spread === 2, sl = TB_SLEEVE, said = [];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, G.pw + 2, G.ph + 2);
  const fill = show ? SHOW_PAGE : theme["panel-solid"], line = show ? SHOW_LINE : theme["slot-line"], sleeve = show ? SHOW_SLEEVE : theme.slot;
  const muted = show ? SHOW_MUTED : theme.muted, left = tbLeft(G, i);
  rr(0.5, 0.5, G.pw - 1, G.ph - 1, two ? (left ? [10, 4, 4, 10] : [4, 10, 10, 4]) : 10); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke();
  const rx = left ? G.pw - G.ring / 2 : G.ring / 2;
  for (const f of [0.17, 0.5, 0.83]) { ctx.beginPath(); ctx.arc(rx, G.ph * f, two ? 3 : 3.4, 0, Math.PI * 2); ctx.fillStyle = show ? SHOW_BG : theme.bg; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke(); } // the holes the rings go through
  ctx.textBaseline = "alphabetic";
  for (let k = 0; k < 9; k++) {
    const r = tbPocket(G, i, k), c = items[k];
    rr(r.x - sl, r.y - sl, r.w + sl * 2, r.h + sl * 2, 6); ctx.fillStyle = sleeve; ctx.fill(); // the sleeve
    ctx.fillStyle = line; ctx.fillRect(r.x - 1, r.y - sl, r.w + 2, 1); // its opening along the top
    if (!c) continue;
    if (c.away) { // out on the trade table: the pocket keeps its name
      ctx.setLineDash([4, 4]); rr(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, r.w * 0.045); ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = "center"; ctx.fillStyle = muted; font(600, 11); ctx.fillText("On the table", r.x + r.w / 2, r.y + r.h / 2 + 4);
      continue;
    }
    const pic = tbPic(c, r.w);
    if (pic) { faceShadow(r.x, r.y, r.w, r.h); ctx.drawImage(pic.bmp, r.x, r.y, r.w, r.h); }
    else { // the drawn face, at a size that prints no price of its own (the pill has it)
      const W0 = Math.min(r.w, 108), s = r.w / W0;
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * r.x, dpr * r.y);
      foilOff = true; drawnFace(c, 0, 0, W0, W0 * TH / TW, 0, false); foilOff = false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    }
    if (show && bnd.picks.has(c.id)) { // picked across the table
      ctx.lineWidth = 3.5; ctx.strokeStyle = SHOW_PICK; rr(r.x - 2.5, r.y - 2.5, r.w + 5, r.h + 5, r.w * 0.045 + 2.5); ctx.stroke();
      const R = clamp(r.w * 0.11, 9, 14), cx = r.x + r.w - R - 4, cy = r.y + R + 4;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = SHOW_PICK; ctx.fill();
      ctx.lineWidth = Math.max(2, R * 0.2); ctx.strokeStyle = "#0B0C0F"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      ctx.moveTo(cx - R * 0.45, cy + R * 0.02); ctx.lineTo(cx - R * 0.12, cy + R * 0.36); ctx.lineTo(cx + R * 0.48, cy - R * 0.36); ctx.stroke(); ctx.lineCap = "butt"; ctx.lineJoin = "miter";
    }
    said.push(...tbOnCard(c, r, pic, show));
  }
  // the page number, in the outer bottom corner
  ctx.fillStyle = muted; font(600, 11);
  if (two) { ctx.textAlign = left ? "left" : "right"; ctx.fillText(String(i + 1), left ? 12 : G.pw - 12, G.ph - 6); }
  else { ctx.textAlign = "right"; ctx.fillText(String(i + 1), G.pw - 14, G.dotY + 4); }
  bnd.labels.set(i, said);
}
// What's said about a pocket, on the card itself: who wants it along the card's foot (across the table, the price
// there instead), the price in a pill at its top corner, and the print and how many spares just over the foot, clear
// of the card's name. Never cut short: a list of names too long becomes "Theo +1", the type steps down a little before
// that gives way to the first name alone. On the drawn face the foot sits just over its label strip, so its name shows.
// Returns the words, for the tests.
function tbOnCard(c, r, pic, show) {
  const m = Math.max(2.5, r.w * 0.035), fs = clamp(r.w * 0.125, 9.5, 13), bh = Math.round(fs * 1.6), room = r.w - m * 2 - 6;
  const footY = pic ? r.y + r.h - m - bh : r.y + r.h * 0.76 - 3 - bh, said = [];
  const price = show && !bnd.prices ? "" : short(c.price);
  let foot = price, f = fs, ink = "#FFFFFF";
  if (!show) {
    const who = wantedBy(c), names = who.map((t) => t.name);
    const tries = who.length ? [names.join(", "), ...(who.length > 1 ? [`${names[0]} +${who.length - 1}`] : []), names[0]] : ["No takers yet", "No takers"];
    foot = null;
    for (const t of tries) { for (let z = fs; z >= Math.max(8, fs - 1.5); z -= 0.5) { font(700, z, true); if (textW(t) <= room) { foot = t; f = z; break; } } if (foot) break; }
    if (!foot) { foot = tries[tries.length - 1]; f = 8; }
    ink = who.length ? (theme.dark ? theme.gold : shade(theme.gold, -0.22)) : theme.muted;
  }
  if (foot) { // the foot
    rr(r.x + m, footY, r.w - m * 2, bh, Math.min(5, bh / 2)); ctx.fillStyle = show ? "rgb(11 12 15 / .82)" : theme.dark ? "rgb(22 26 36 / .92)" : "rgb(255 255 255 / .94)"; ctx.fill();
    font(700, f, !show); ctx.textAlign = "center"; ctx.fillStyle = ink; ctx.fillText(foot, r.x + r.w / 2, footY + bh / 2 + f * 0.36);
    said.push(foot);
  }
  const ph = Math.round(fs * 1.4), pf = fs * 0.88;
  if (price && !show) { // the price, in a pill at the top corner
    font(700, pf); const tw = textW(price) + 9, x = r.x + r.w - m - tw;
    rr(x, r.y + m, tw, ph, ph / 2); ctx.fillStyle = "rgb(16 18 24 / .8)"; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = "#FFFFFF"; ctx.fillText(price, x + tw / 2, r.y + m + ph / 2 + pf * 0.36);
    said.push(price);
  }
  if (show || !foot) return said;
  let spareX = r.x + r.w - m;
  if (sparesOf(c) >= 2) { // more than one spare in the pocket (in words: on the wall "×3" is how many you have)
    const t = `${sparesOf(c)} spares`; font(800, pf); const tw = textW(t) + 9; spareX -= tw;
    rr(spareX, footY - 3 - ph, tw, ph, ph / 2); ctx.fillStyle = theme.gold; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = theme.dark ? "#171920" : "#FFFFFF"; ctx.fillText(t, spareX + tw / 2, footY - 3 - ph / 2 + pf * 0.36);
    said.push(t);
  }
  if (pic && c.tag) { // which print (the drawn face prints it in its strip)
    font(700, pf); const tw = textW(c.tag) + 9, x = r.x + m, y = footY - 3 - ph - (x + tw > spareX - 3 ? ph + 3 : 0);
    rr(x, y, tw, ph, ph / 2); ctx.fillStyle = "rgb(16 18 24 / .8)"; ctx.fill();
    ctx.textAlign = "center"; ctx.fillStyle = "#FFFFFF"; ctx.fillText(c.tag, x + tw / 2, y + ph / 2 + pf * 0.36);
    said.push(c.tag);
  }
  return said;
}
// The binder's front cover: green board (the Trade room's colour) with a darker spine at its ring side, the title in
// gold. The same object as the closed binder on the Trade room's page, which opens into the pages.
const COVER = { light: ["#2F7A52", "#1F5A3B", "#174A30"], dark: ["#2B6B4A", "#1C4F36", "#133B28"] };
function tbCoverPaint(G) {
  const w = G.pw, h = G.ph, [c0, c1, c2] = theme.dark ? COVER.dark : COVER.light, spine = Math.max(10, w * 0.09);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w + 2, h + 2);
  const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c0); gr.addColorStop(0.6, c1); gr.addColorStop(1, c2);
  rr(0, 0, w, h, 10); ctx.fillStyle = gr; ctx.fill();
  ctx.save(); rr(0, 0, w, h, 10); ctx.clip();
  ctx.fillStyle = "rgb(0 0 0 / .22)"; ctx.fillRect(0, 0, spine, h); // the spine, at the ring side
  ctx.fillStyle = "rgb(255 255 255 / .10)"; ctx.fillRect(spine, 0, 1.5, h);
  ctx.strokeStyle = "rgb(255 236 190 / .28)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(spine + 6, 8); ctx.lineTo(spine + 6, h - 8); ctx.stroke(); ctx.setLineDash([]); // stitching
  const sh = ctx.createLinearGradient(0, 0, w, h * 0.6); sh.addColorStop(0, "rgb(255 255 255 / 0)"); sh.addColorStop(0.45, "rgb(255 255 255 / .07)"); sh.addColorStop(0.55, "rgb(255 255 255 / 0)");
  ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
  ctx.restore(); curFont = "";
  ctx.lineWidth = 1; ctx.strokeStyle = "rgb(0 0 0 / .25)"; rr(0.5, 0.5, w - 1, h - 1, 10); ctx.stroke();
  const cx = spine + (w - spine) / 2, gold = theme.dark ? "#E8BE55" : "#F1CF72";
  rr(spine + 14, h * 0.3, w - spine - 28, h * 0.26, 6); ctx.lineWidth = 1.2; ctx.strokeStyle = "rgb(241 207 114 / .55)"; ctx.stroke(); // the label's frame, foil
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = gold;
  const fs = clamp(w * 0.105, 13, 26); font(800, fs, true); ctx.fillText(fitText("Trade binder", w - spine - 36), cx, h * 0.43 + fs * 0.36); // the title alone in its frame (the count is beside it, on the page)
}
function tbEnsure(i, G) {
  if (i < -1) return;
  const key = i === -1 ? `cover|${G.pw}|${G.ph}|${dpr}|${theme.dark ? 1 : 0}|${tbList().length}` : tbKey(i, G), slot = i === -1 ? "cover" : `${G.show ? "s" : "o"}${i}`, had = bnd.cache.get(slot), now = performance.now();
  if (had?.key === key) { had.used = now; return; }
  if (i === -1) tbCoverPaint(G); else tbPaint(i, G);
  const W = Math.ceil(G.pw * dpr), H = Math.ceil(G.ph * dpr), most = 3 * G.spread + 1; // a spread mid-turn needs its pages either side, and the cover
  let cv = had?.cv;
  if (!cv && bnd.cache.size >= most) { const old = [...bnd.cache].filter((e) => e[0] !== "cover" || slot === "cover").sort((a, b) => a[1].used - b[1].used)[0]; if (old) { cv = old[1].cv; bnd.cache.delete(old[0]); } } // the page least lately used gives up its canvas
  if (!cv) cv = document.createElement("canvas");
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } // a new size (a turn of the phone, Show mode): the same canvas, resized
  const x = cv.getContext("2d"); x.clearRect(0, 0, W, H); x.drawImage(canvas, 0, 0, W, H, 0, 0, W, H);
  bnd.cache.set(slot, { key, cv, used: now }); // kept, and reused: turning through the binder never makes more canvases
}
const tbImg = (i, G) => bnd.cache.get(i === -1 ? "cover" : `${G.show ? "s" : "o"}${i}`)?.cv || null;

// ----- the level: drawing -----
function tbStep(now) {
  let more = false;
  if (bnd.anim) {
    const a = bnd.anim, p = clamp((now - a.t0) / a.dur, 0, 1); bnd.q = a.from + (a.to - a.from) * (a.lin ? p : ease(p));
    if (p >= 1) { bnd.anim = null; bnd.q = a.to; if (a.to === 0) { tbEnd(); return false; } } else more = true;
  }
  if (bnd.tAnim) {
    const a = bnd.tAnim, p = clamp((now - a.t0) / a.dur, 0, 1); bnd.turn = a.from + (a.to - a.from) * (1 - Math.pow(1 - p, 3));
    if (p >= 1) tbTurnDone(a.to); else more = true;
  }
  if (bnd.sa) { const a = bnd.sa; a.k = clamp((now - a.t0) / a.dur, 0, 1); bnd.sq = bnd.show ? a.k : 1 - a.k; if (a.k >= 1) bnd.sa = null; else more = true; }
  return more;
}
// Opening runs in two halves: the closed binder comes off the Trade room's page to where it will lie (0 to OPEN_AT),
// then its cover swings over the rings and the pages are there (OPEN_AT to 1). Closing is the same, played back.
const OPEN_AT = 0.42;
function tbDraw(now) {
  live.line = null; // a deal landing on the wall flashes there; its line to the lens bar has nowhere to go here
  const G = bnd.L || (bnd.L = tbGeom(bnd.show)), views = tbViews();
  bnd.vi = clamp(bnd.vi, 0, views - 1);
  // the pages on show, and while a turn is under way the ones it reveals
  const need = new Set(), addView = (v) => { if (v >= 0 && v < views) for (let j = 0; j < G.spread; j++) need.add(v * G.spread + j); };
  addView(bnd.vi);
  if (bnd.turn > 0 || bnd.drag?.axis === "x") addView(bnd.vi + 1);
  if (bnd.turn < 0 || bnd.drag?.axis === "x") addView(bnd.vi - 1);
  for (const i of need) tbEnsure(i, G);
  if (bnd.q < 1) tbEnsure(-1, G);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
  const q = bnd.q, sq = bnd.sq;
  ctx.fillStyle = sq > 0.001 ? mix(theme.bg, SHOW_BG, sq) : theme.bg; ctx.fillRect(0, 0, vw, vh);
  // Opening or closing: the Trade room's page fades as the binder comes off it.
  pgTrade.style.opacity = q >= 1 ? "0" : String(clamp(1 - q / (OPEN_AT * 0.45), 0, 1)); // quickly: the page is over the canvas
  let S = tbSpreadRect(G);
  if (bnd.sa) S = lerpRect(bnd.sa.from, S, ease(bnd.sa.k));
  const ha = clamp((q - 0.72) / 0.28, 0, 1);
  if (q >= 1 && G.spread === 2) { ctx.fillStyle = `rgb(0 0 0 / ${(0.07 * (1 - sq * 0.6)).toFixed(3)})`; rr(S.x + 1, S.y + 2, S.w - 2, S.h, 10); ctx.fill(); rr(S.x + 3, S.y + 4, S.w - 6, S.h - 1, 10); ctx.fill(); } // the book's weight on the table
  if (q < 1) tbOpening(G, S, q); else tbPages(G, S);
  if (bnd.press && !bnd.turn && q >= 1) { const r = tbPocketRect(bnd.press); if (r) { ctx.lineWidth = 2; ctx.strokeStyle = G.show ? "#fff" : theme.ink; rr(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6); ctx.stroke(); } }
  tbArrows(G, S, ha);
  tbDots(G, S, ha);
  ctx.globalAlpha = 1;
}
// The arrows either side of a two-page spread (production's): tap one to turn that way; faint at the ends.
function tbArrows(G, S, a) {
  if (!G.arrows || a <= 0.01) return;
  const cy = S.y + S.h / 2, s = 9;
  ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = G.show ? "#FFFFFF" : theme.ink;
  for (const d of [-1, 1]) {
    const cx = d < 0 ? S.x - G.arrows / 2 : S.x + S.w + G.arrows / 2;
    ctx.globalAlpha = a * (tbCan(d) ? 0.8 : 0.18);
    ctx.beginPath(); ctx.moveTo(cx - d * s * 0.5, cy - s); ctx.lineTo(cx + d * s * 0.5, cy); ctx.lineTo(cx - d * s * 0.5, cy + s); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = "butt"; ctx.lineJoin = "miter";
}
// A leaf turning over the rings, drawn in slices so it reads as a page lifting toward you, not one shrinking flat:
// hinge is where it's bound, dir which way it lies from there (1 right, -1 left), f how far it has come up (0 flat,
// 1 on its edge). Its far edge rises a little as it comes up, and it darkens as it turns away from the light. mirror:
// the leaf's back, whose ring side is its right edge.
function tbLeaf(img, hinge, y, pw, ph, dir, f, mirror = false) {
  if (!img || f >= 0.999) return;
  const w = pw * Math.cos((f * Math.PI) / 2); if (w < 0.5) return;
  const N = reduced ? 1 : 16, lift = 0.05 * Math.sin(f * Math.PI), iw = img.width, ih = img.height;
  for (let k = 0; k < N; k++) {
    const u0 = k / N, u1 = (k + 1) / N, um = (u0 + u1) / 2, sh = ph * (1 + lift * um), x0 = hinge + dir * w * u0, x1 = hinge + dir * w * u1;
    const su0 = mirror ? 1 - u0 : u0, su1 = mirror ? 1 - u1 : u1, sx = Math.min(su0, su1) * iw, sw = Math.abs(su1 - su0) * iw;
    ctx.drawImage(img, sx, 0, Math.min(sw + 0.5, iw - sx), ih, Math.min(x0, x1), y + (ph - sh) / 2, Math.abs(x1 - x0) + 0.6, sh);
  }
  if (f > 0.01) { // the light going off it as it comes up
    const g = ctx.createLinearGradient(hinge, 0, hinge + dir * w, 0);
    g.addColorStop(0, `rgb(0 0 0 / ${(0.05 * f).toFixed(3)})`); g.addColorStop(1, `rgb(0 0 0 / ${(0.32 * f).toFixed(3)})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hinge, y); ctx.lineTo(hinge + dir * w, y - ph * lift / 2); ctx.lineTo(hinge + dir * w, y + ph + ph * lift / 2); ctx.lineTo(hinge, y + ph); ctx.closePath(); ctx.fill();
  }
}
// The shadow a lifting leaf casts on the page under it, from its far edge.
function tbShade(x, y, h, dir, a, pw) {
  if (a <= 0.01) return;
  const w = Math.min(46, pw * 0.3), g = ctx.createLinearGradient(x, 0, x + dir * w, 0);
  g.addColorStop(0, `rgb(0 0 0 / ${a.toFixed(3)})`); g.addColorStop(1, "rgb(0 0 0 / 0)");
  ctx.fillStyle = g; ctx.fillRect(dir > 0 ? x : x - w, y, w, h);
}
// The rings down the spine of a two-page spread: a steel bar and three rings through both pages' holes.
function tbRings(G, S, a = 1) {
  if (G.spread !== 2 || a <= 0.01) return;
  const k = S.h / G.ph, pw = G.pw * k, x0 = S.x + pw, x1 = x0 + G.sp * k, cx = (x0 + x1) / 2, ry = (G.ring / 2) * k + G.sp * k / 2, dark = G.show || theme.dark;
  ctx.globalAlpha = a;
  const gut = ctx.createLinearGradient(x0, 0, x1, 0); gut.addColorStop(0, "rgb(0 0 0 / .16)"); gut.addColorStop(0.5, "rgb(0 0 0 / .04)"); gut.addColorStop(1, "rgb(0 0 0 / .16)");
  ctx.fillStyle = gut; ctx.fillRect(x0, S.y + 6 * k, x1 - x0, S.h - 12 * k); // the gutter
  rr(cx - 3.5 * k, S.y + S.h * 0.08, 7 * k, S.h * 0.84, 3.5 * k); ctx.fillStyle = dark ? "#5A606C" : "#AEB4BF"; ctx.fill(); // the bar
  ctx.fillStyle = dark ? "#7D8491" : "#D3D8E0"; ctx.fillRect(cx - 1.5 * k, S.y + S.h * 0.09, 1.2 * k, S.h * 0.82);
  ctx.lineCap = "round";
  for (const f of [0.17, 0.5, 0.83]) {
    const y = S.y + S.h * f;
    ctx.lineWidth = 3.4 * k; ctx.strokeStyle = dark ? "#8A919E" : "#9AA1AD";
    ctx.beginPath(); ctx.ellipse(cx, y, ry, 5.5 * k, 0, Math.PI, 2 * Math.PI); ctx.stroke(); // over the top of the pages, hole to hole
    ctx.lineWidth = 1.2 * k; ctx.strokeStyle = dark ? "#C3C8D1" : "#EEF1F5";
    ctx.beginPath(); ctx.ellipse(cx, y - 0.8 * k, ry * 0.92, 4.4 * k, 0, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke(); // the shine
  }
  ctx.lineCap = "butt"; ctx.globalAlpha = 1;
}
// The page (or the spread) in rect S. A turn folds the leaf over the rings: forward from view a to a + 1 at p (the
// right page lifting off and coming down on the left), a turn back being the same fold played backwards.
function tbPages(G, S) {
  const k = S.h / G.ph, pw = G.pw * k, ph = S.h, at = (j) => S.x + j * (G.pw + G.sp) * k, sp = G.spread;
  const page = (i, x) => { const img = tbImg(i, G); if (img) ctx.drawImage(img, x, S.y, pw, ph); };
  const t = bnd.turn, v = bnd.vi;
  if (!t) { for (let j = 0; j < sp; j++) page(v * sp + j, at(j)); tbRings(G, S); return; }
  const a = t > 0 ? v : v - 1, p = t > 0 ? t : 1 + t;
  if (sp === 1) { // one page at a time: it lifts off its rings at the left and folds back out of sight
    page(a + 1, at(0));
    const w = pw * Math.cos((p * Math.PI) / 2);
    tbShade(at(0) + w, S.y, ph, 1, 0.3 * (1 - p), pw);
    tbLeaf(tbImg(a, G), at(0), S.y, pw, ph, 1, p);
    return;
  }
  const L0 = a * 2, R0 = L0 + 1, L1 = L0 + 2, R1 = L0 + 3, xl = at(0) + pw, xr = at(1);
  page(L0, at(0)); page(R1, at(1));
  if (p < 0.5) { const f = p * 2; tbShade(xr + pw * Math.cos(f * Math.PI / 2), S.y, ph, 1, 0.26 * (1 - f), pw); tbLeaf(tbImg(R0, G), xr, S.y, pw, ph, 1, f); }
  else { const f = (1 - p) * 2; tbShade(xl - pw * Math.cos(f * Math.PI / 2), S.y, ph, -1, 0.26 * (1 - f), pw); tbLeaf(tbImg(L1, G), xl, S.y, pw, ph, -1, f, true); }
  tbRings(G, S);
}
// Opening (q from 0 to 1) and closing (back down): the closed binder, then its cover swinging open over the rings.
function tbOpening(G, S, q) {
  const k = S.h / G.ph, pw = G.pw * k, ph = S.h, sp = G.spread, v = bnd.vi;
  const C = { x: S.x + (sp === 2 ? (G.pw + G.sp) * k : 0), y: S.y, w: pw, h: ph }; // where the closed binder lies: on the right-hand page's place
  const cover = tbImg(-1, G);
  if (q <= OPEN_AT) { // coming off the Trade room's page
    const e = ease(q / OPEN_AT), F = bnd.from || { x: C.x + C.w * 0.2, y: C.y + C.h * 0.2, w: C.w * 0.6, h: C.h * 0.6 }, R = lerpRect(F, C, e);
    ctx.globalAlpha = bnd.from ? 1 : e;
    ctx.save(); ctx.shadowColor = "rgb(0 0 0 / .28)"; ctx.shadowBlur = 18 * e; ctx.shadowOffsetY = 6 * e; rr(R.x, R.y, R.w, R.h, 10 * (R.w / C.w)); ctx.fillStyle = "#000"; ctx.fill(); ctx.restore(); curFont = "";
    if (cover) ctx.drawImage(cover, R.x, R.y, R.w, R.h);
    ctx.globalAlpha = 1; return;
  }
  const f = ease((q - OPEN_AT) / (1 - OPEN_AT)); // 0 closed, 1 open
  const page = (i, x) => { const img = tbImg(i, G); if (img) ctx.drawImage(img, x, S.y, pw, ph); };
  if (sp === 1) {
    page(v, C.x);
    tbShade(C.x + pw * Math.cos(f * Math.PI / 2), S.y, ph, 1, 0.3 * (1 - f), pw);
    tbLeaf(cover, C.x, S.y, pw, ph, 1, f);
    return;
  }
  const xl = S.x + pw, xr = C.x;
  page(v * 2 + 1, xr); // the right-hand page, under the cover
  tbRings(G, S, clamp(f * 2, 0, 1));
  // the cover swings up off the right page and over the rings; what comes down on the left is the left-hand page
  if (f < 0.5) { const u = f * 2; tbShade(xr + pw * Math.cos(u * Math.PI / 2), S.y, ph, 1, 0.3 * (1 - u), pw); tbLeaf(cover, xr, S.y, pw, ph, 1, u); }
  else { const u = (1 - f) * 2; tbLeaf(tbImg(v * 2, G), xl, S.y, pw, ph, -1, u, true); }
}
function tbDots(G, S, a) {
  const views = tbViews(); if (views < 2 || a <= 0.01 || G.spread !== 1) return; // a spread: the bar says where you are, the folios which page
  const k = S.h / G.ph, y = S.y + G.dotY * k, on = G.show ? "#FFFFFF" : theme.ink, off = G.show ? "#3A3F4A" : theme["slot-line"], cx = S.x + S.w / 2; // on the page's bottom edge
  ctx.globalAlpha = a;
  if (views > 24) { ctx.textAlign = "center"; ctx.fillStyle = G.show ? SHOW_MUTED : theme.muted; font(600, 12); ctx.fillText(`${bnd.vi + 1} of ${views}`, cx, y + 4); ctx.globalAlpha = 1; return; }
  const gap = 12, x0 = cx - ((views - 1) * gap) / 2, cur = bnd.vi + clamp(bnd.turn, -1, 1);
  for (let i = 0; i < views; i++) { ctx.beginPath(); ctx.arc(x0 + i * gap, y, 3, 0, Math.PI * 2); ctx.fillStyle = off; ctx.fill(); }
  ctx.beginPath(); ctx.arc(x0 + cur * gap, y, 3.6, 0, Math.PI * 2); ctx.fillStyle = on; ctx.fill();
  ctx.globalAlpha = 1;
}
// The pocket under a point on screen, and where a card's pocket is.
function tbPocketAt(x, y) {
  const G = bnd.L; if (!G || bnd.turn || bnd.q < 1 || bnd.sa) return null;
  const list = tbList();
  for (let j = 0; j < G.spread; j++) {
    const P = G.pages[j], i = bnd.vi * G.spread + j;
    for (let k = 0; k < 9; k++) {
      const r = tbPocket(G, i, k), X = P.x + r.x, Y = P.y + r.y;
      if (x >= X - 3 && x <= X + r.w + 3 && y >= Y - 3 && y <= Y + r.h + G.lh) { const c = list[i * 9 + k]; return c ? { c, r: { x: X, y: Y, w: r.w, h: r.h } } : null; }
    }
  }
  return null;
}
function tbPocketRect(c) {
  const G = bnd.L; if (!G) return null;
  const i = tbList().indexOf(c); if (i < 0) return null;
  const page = Math.floor(i / 9), j = page - bnd.vi * G.spread; if (j < 0 || j >= G.spread) return null;
  const r = tbPocket(G, page, i % 9), P = G.pages[j];
  return { x: P.x + r.x, y: P.y + r.y, w: r.w, h: r.h };
}
// Where a card of yours flies from and back to as the trade table opens and closes: its pocket while the binder is up
// (off the bottom edge if it isn't on this page), the binder's cover in the Trade room, else its tile on the wall.
function tbHome(c) {
  if (bnd.on) return tbPocketRect(c) || { x: vw / 2 - 16, y: vh + 20, w: 32, h: 45 };
  if (rooms.at === "trade" && !rooms.map) { const r = document.getElementById("pt-page").getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2 - 14, y: r.top + 10, w: 28, h: 39 }; }
  return mr(c.m);
}

// ----- opening and closing -----
// The binder lives in the Trade room: asked for from anywhere else (the import's summary), the room comes first.
function openBinder() {
  if (rooms.at !== "trade" || rooms.map) { goRoom("trade", { then: openBinder }); return; }
  if (bnd.on || state.trans || tbl.on || view !== "mosaic" || room.on) return;
  if (!tbFresh().length) { tick(3); cancelPress(); toast("Your trade binder is empty. On a card you have, + adds a spare."); return; } // nothing to leaf through
  hideCaption(); cancelPress(); closePop(true); hideHow(); hideWho(); tick(8);
  Object.assign(bnd, { on: true, closing: false, turn: 0, tAnim: null, pinch: null, drag: null, rest: false, swallow: false, press: null, show: false, sq: 0, sa: null, vi: 0, from: tbCoverRect() });
  tbFresh(); bnd.L = tbGeom(false);
  bnd.q = reduced ? 1 : 0; bnd.anim = reduced ? null : { from: 0, to: 1, t0: performance.now(), dur: 860 };
  document.body.classList.add("inbinder"); setChrome(); tbSync(); kick();
  if (!tbHinted) { tbHinted = true; try { localStorage.setItem("wall-tb-hint", "1"); } catch { /* private mode */ } setTimeout(() => { if (bnd.on && !bnd.show) toast("Most wanted first. Tap a card to trade it."); }, reduced ? 0 : 900); } // the first visit only
}
// Whether the binder has said how it works (once, as it first opens: it isn't chrome to carry every visit).
let tbHinted = false;
try { tbHinted = localStorage.getItem("wall-tb-hint") === "1"; } catch { /* fresh */ }
function closeBinder(instant = false) {
  if (!bnd.on || bnd.closing) return;
  hideWho();
  if (bnd.show) { bnd.show = false; bnd.sq = 0; bnd.sa = null; bnd.L = tbGeom(false); document.body.classList.remove("showing"); }
  Object.assign(bnd, { closing: true, pinch: null, drag: null, tAnim: null, turn: 0, press: null, from: tbCoverRect() || bnd.from }); // back onto the cover wherever it is now
  if (instant || reduced) { bnd.q = 0; bnd.anim = null; tbEnd(); return; }
  bnd.anim = { from: bnd.q, to: 0, t0: performance.now(), dur: 160 + 600 * bnd.q }; tick(6); kick();
}
// The closed binder on the Trade room's page: where the binder comes off when it opens, and goes back to.
function tbCoverRect() { const r = document.getElementById("pt-page").getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }
function tbEnd() {
  Object.assign(bnd, { on: false, closing: false, anim: null, q: 0, pinch: null, drag: null, press: null, show: false, sq: 0, sa: null });
  pgTrade.style.opacity = "";
  document.body.classList.remove("inbinder", "showing"); setChrome(); renderTrade(); kick();
}
// Turning: animate from wherever the page is to a whole turn (1 forward, -1 back) or back to rest (0).
function tbTurnTo(to) {
  if (to === bnd.turn && !bnd.tAnim) return;
  if (reduced) { bnd.tAnim = null; tbTurnDone(to); kick(); return; }
  bnd.tAnim = { from: bnd.turn, to, t0: performance.now(), dur: 150 + 300 * Math.abs(to - bnd.turn) }; kick();
}
function tbTurnDone(to) {
  bnd.tAnim = null; bnd.turn = 0;
  if (to === 1 || to === -1) { bnd.vi = clamp(bnd.vi + to, 0, tbViews() - 1); tick(4); }
  tbSync(); kick();
}
function tbTurn(d) { if (!bnd.on || bnd.q < 1) return; if (!tbCan(d)) { tick(2); return; } tbTurnTo(d); }
// Show mode: the same pages, dark and full screen, nothing else on it.
function tbEnterShow() {
  if (!bnd.on || bnd.show || bnd.q < 1 || !tbList().length) return;
  hideWho(); tick(8);
  const from = tbSpreadRect(bnd.L);
  bnd.show = true; bnd.L = tbGeom(true); bnd.turn = 0; bnd.tAnim = null;
  bnd.vi = clamp(bnd.vi, 0, tbViews() - 1);
  bnd.sa = reduced ? null : { t0: performance.now(), dur: 380, k: 0, from }; bnd.sq = reduced ? 1 : 0;
  document.body.classList.add("showing"); setChrome(); tbSync(); kick();
}
function tbExitShow() {
  if (!bnd.show) return;
  const from = tbSpreadRect(bnd.L);
  bnd.show = false; bnd.L = tbGeom(false); bnd.turn = 0; bnd.tAnim = null;
  bnd.vi = clamp(bnd.vi, 0, tbViews() - 1);
  bnd.sa = reduced ? null : { t0: performance.now(), dur: 340, k: 0, from }; bnd.sq = reduced ? 0 : 1;
  document.body.classList.remove("showing"); setChrome(); tbSync(); tick(6); kick();
}
// Taking the phone back: who was it? A trader opens the table with the picks on your side; someone new takes them.
function tbHandBack() {
  const picks = tbList().filter((c) => bnd.picks.has(c.id));
  tbExitShow();
  if (!picks.length) return;
  const them = picks.length === 1 ? "it" : "them";
  const rows = TRADERS.map((t) => ({ t, n: picks.filter((c) => t.chaseSet.has(c)).length })).sort((a, b) => b.n - a.n || TRADERS.indexOf(a.t) - TRADERS.indexOf(b.t));
  showWho(`${plural1(picks.length, "card")} picked. Who was it?`, [
    ...rows.map((r) => ({ t: r.t, title: r.t.name, sub: r.n ? `${r.t.where}. Chases ${picks.length === 1 ? "it" : `${r.n} of them`}` : `${r.t.where}. Chases none of ${them}`, go: true })),
    { id: "new", title: "Someone new", sub: `Give ${them} away, one copy each`, go: true },
    { title: "Not now", sub: "Keep the picks for later" },
  ], (r) => {
    if (r.t) { bnd.picks.clear(); tbTrade(r.t, picks); }
    else if (r.id === "new") { bnd.picks.clear(); tbGiveAway(picks); }
  });
}

// ----- trading from a pocket -----
function tbPocketTap(c) {
  const who = wantedBy(c);
  if (!who.length) { tick(3); toast(`Nobody is chasing ${c.name} yet.`); return; }
  if (who.length === 1) { tbTrade(who[0], [c]); return; }
  showWho(`Trade ${c.name} with`, who.map((t) => ({ t, title: t.name, sub: `${t.where}. Wants ${wantsOf(t).length} of yours`, go: true })), (r) => tbTrade(r.t, [c]));
}
// A binder is in person by nature, so the table opens without asking how.
function tbTrade(t, give) {
  if (tbl.on || state.trans) return;
  const had = activeOf(t);
  openTable(t, null, had ? null : give.filter(isSpare));
  if (had) toast(`You have a trade open with ${t.name}. Here it is.`);
}
// Someone new: no trader to open a table with, so the picks are given away the way a done trade gives a card (one copy
// off, or the card out with its last copy). Undo puts the counts and the cards back exactly as they were.
function tbGiveAway(list) {
  if (!list.length) return;
  const was = list.map((c) => ({ c, owned: c.owned, got: c.got, rec: copies[c.id] ? { ...copies[c.id] } : null }));
  quietLayout = true;
  for (const c of list) { if (nOf(c) > 1) setN(c, nOf(c) - 1); else if (c.owned) setOwned(c, false, { quiet: true }); }
  quietLayout = false;
  persistCopies(); tbChanged(); tick(14);
  toast(list.length === 1 ? `Gave ${list[0].name} to someone new.` : `Gave ${list.length} cards to someone new.`, () => {
    quietLayout = true;
    for (const w of was) {
      const c = w.c;
      if (w.owned && !c.owned) { setOwned(c, true, { quiet: true }); c.got = w.got; saved[c.id] = { on: true, at: w.got }; }
      if (w.rec) copies[c.id] = w.rec; else delete copies[c.id];
    }
    quietLayout = false;
    copiesKey++; persist(); persistCopies(); tbChanged(); tick(6);
  });
}
// The counts changed under the binder: the pages, the bar, the wall beneath and the list follow.
function tbChanged() { tbFresh(); syncBadge(); updateCount(); drawList(); relayoutSoon(); if (bnd.on) { bnd.vi = clamp(bnd.vi, 0, tbViews() - 1); tbSync(); } kick(); }

// ----- who: a small menu over the bar (who wants a pocket, or who was across the table) -----
const whoEl = document.createElement("div");
whoEl.className = "arrange-menu tradehow glass tbwho"; whoEl.id = "tb-who"; whoEl.setAttribute("role", "menu"); whoEl.hidden = true;
document.body.append(whoEl);
let whoPick = null, whoClosed = 0;
function showWho(head, rows, pick) {
  whoEl.innerHTML = `<p class="th-head">${esc(head)}</p>${rows.map((r, i) => `<button role="menuitem" data-w="${i}"><span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span><span class="tick" aria-hidden="true">${r.go ? "›" : ""}</span></button>`).join("")}`;
  whoPick = (i) => pick(rows[i]);
  whoEl.hidden = false; tick(4);
  focusFor(whoEl.querySelector("button"), whoEl);
}
function hideWho() { if (whoEl.hidden) return; whoEl.hidden = true; whoPick = null; }
whoEl.addEventListener("click", (e) => { const b = e.target.closest("[data-w]"); if (!b) return; const f = whoPick; hideWho(); f?.(Number(b.dataset.w)); });
whoEl.addEventListener("keydown", (e) => { if (e.key === "Escape") hideWho(); });
addEventListener("pointerdown", (e) => { if (!whoEl.hidden && !e.target.closest("#tb-who")) { hideWho(); whoClosed = performance.now(); } }, true);

// ----- the bars: one thin bar along the top (production's), the binder's and Show mode's -----
// The binder's: Back (the strip's, at its left end), the title and its count, where you are in the middle, Show mode at
// the right. Show mode's: what's picked, where you are, the prices switch and Done.
const bbar = document.createElement("div");
bbar.className = "bbar"; bbar.id = "bbar"; bbar.setAttribute("role", "group"); bbar.setAttribute("aria-label", "Trade binder");
bbar.innerHTML = `<div class="mtext"><b id="bb-head">Trade binder</b><span id="bb-sub"></span></div><span class="bb-pages" id="bb-pages" aria-live="polite"></span><button type="button" class="mbtn primary" id="bb-show">Show mode</button>`;
const sbar = document.createElement("div");
sbar.className = "showbar"; sbar.id = "showbar"; sbar.setAttribute("role", "group"); sbar.setAttribute("aria-label", "Show mode");
sbar.innerHTML = `<div class="mtext" aria-live="polite"><b id="sb-head"></b><span id="sb-sub"></span></div><span class="bb-pages" id="sb-pages"></span><button type="button" class="showpill" id="sb-price"></button><button type="button" class="mbtn" id="sb-done">Done</button>`;
document.body.append(bbar, sbar);
const bbSub = bbar.querySelector("#bb-sub"), bbPages = bbar.querySelector("#bb-pages"), bbShow = bbar.querySelector("#bb-show");
const sbHead = sbar.querySelector("#sb-head"), sbSub = sbar.querySelector("#sb-sub"), sbPages = sbar.querySelector("#sb-pages"), sPrice = sbar.querySelector("#sb-price");
function tbSync() {
  const n = tbList().length, G = bnd.L, pages = tbPageCount(), v = bnd.vi + 1, k = bnd.picks.size;
  const where = G?.spread === 2 ? (v * 2 > pages ? `Page ${v * 2 - 1} of ${pages}` : `Pages ${v * 2 - 1}–${v * 2} of ${pages}`) : `Page ${v} of ${pages}`;
  bbSub.textContent = n ? `${plural1(n, "card")} · ${tbMemo.wanted ? `${tbMemo.wanted} wanted` : "no takers yet"}` : "Empty for now";
  bbPages.textContent = sbPages.textContent = n ? where : "";
  bbShow.disabled = !n;
  sbHead.textContent = k ? `${plural1(k, "card")} picked` : "Tap the cards you'd like";
  sbSub.textContent = k ? "Tap one again to put it back" : "";
  sPrice.textContent = bnd.prices ? "Prices shown" : "Prices hidden"; sPrice.setAttribute("aria-pressed", String(bnd.prices));
}
bbShow.onclick = () => tbEnterShow();
sbar.querySelector("#sb-done").onclick = () => tbHandBack();
sPrice.onclick = () => { bnd.prices = !bnd.prices; tick(4); tbSync(); kick(); };

// ----- input: while the binder is up it owns every touch on the canvas -----
function bDown(pts) {
  hideCaption();
  if (!whoEl.hidden) { hideWho(); bnd.swallow = true; return; } // a touch outside the menu just closes it
  if (performance.now() - whoClosed < 350) { bnd.swallow = true; return; }
  if (bnd.closing) { const a = bnd.anim; if (a) { bnd.anim = null; bnd.q = a.to; } tbEnd(); return; } // the close finishes; the wall takes the next touch
  if (bnd.anim) { const a = bnd.anim; bnd.anim = null; bnd.q = a.to; }
  if (bnd.sa) { bnd.sa = null; bnd.sq = bnd.show ? 1 : 0; }
  if (pts.length >= 2) return bPinchStart(pts);
  if (bnd.drag || bnd.pinch || bnd.rest) return;
  if (bnd.tAnim) tbTurnDone(bnd.tAnim.to); // a touch during a turn: the turn lands and the touch takes over
  const p = pts[0], now = performance.now();
  bnd.drag = { x: p.x, y: p.y, t: now, axis: null, samples: [{ x: p.x, y: p.y, t: now }], turn0: 0 };
  const h = tbPocketAt(p.x, p.y);
  if (h) { bnd.press = h.c; kick(); }
}
function bMove(pts) {
  if (bnd.swallow) return;
  if (bnd.pinch) { if (pts.length >= 2) bPinchMove(pts); return; }
  if (pts.length >= 2) { if (bnd.show) return; bnd.drag = null; bnd.press = null; return bPinchStart(pts); }
  const d = bnd.drag, p = pts[0]; if (!d || !p) return;
  const now = performance.now();
  d.samples.push({ x: p.x, y: p.y, t: now }); if (d.samples.length > 8) d.samples.shift();
  const dx = p.x - d.x, dy = p.y - d.y;
  if (!d.axis) {
    if (Math.hypot(dx, dy) < 8) return;
    bnd.press = null;
    d.axis = Math.abs(dx) > Math.abs(dy) * 0.8 ? "x" : "y"; d.turn0 = bnd.turn;
  }
  if (d.axis !== "x" || bnd.q < 1) { kick(); return; }
  const G = bnd.L;
  let t;
  if (d.turn0) t = d.turn0 - dx / (G.spread === 2 ? G.pw * 1.5 : G.pw * 0.85); // caught mid-turn: carry on from there
  else { d.dir ||= dx < 0 ? 1 : -1; t = tbUnderThumb(G, d.x, dx, d.dir); }
  if ((t > 0 && !tbCan(1)) || (t < 0 && !tbCan(-1))) t = 0;
  bnd.turn = clamp(t, -1, 1); kick();
}
// The leaf under your thumb: its free edge follows the finger. Forward it sets off from the right-hand page's outer
// edge and comes down on the left; back, the other way. dir is the way the drag set off (1 forward, -1 back).
function tbUnderThumb(G, x0, dx, dir) {
  const P = G.pages, pw = G.pw;
  if (G.spread === 2) {
    const xl = P[0].x + pw, xr = P[1].x, far0 = P[0].x, far1 = xr + pw, span = far1 - far0;
    const edge = dir > 0 ? far1 + (dx * span) / Math.max(40, x0 - far0) : far0 + (dx * span) / Math.max(40, far1 - x0);
    const p = edge >= xr ? Math.acos(clamp((edge - xr) / pw, 0, 1)) / Math.PI : edge <= xl ? 1 - Math.acos(clamp((xl - edge) / pw, 0, 1)) / Math.PI : 0.5;
    return dir > 0 ? p : p - 1;
  }
  const L = P[0].x, R = L + pw;
  const edge = dir > 0 ? R + (dx * pw) / Math.max(40, x0 - L) : L + (dx * pw) / Math.max(40, R - x0), p = (Math.acos(clamp((edge - L) / pw, 0, 1)) * 2) / Math.PI;
  return dir > 0 ? p : p - 1;
}
function bUp(remaining, cancelled) {
  if (bnd.swallow) { if (!remaining.length) bnd.swallow = false; return; }
  if (bnd.pinch) { if (remaining.length >= 2) return; bPinchEnd(cancelled); bnd.rest = remaining.length > 0; return; }
  if (bnd.rest) { if (!remaining.length) bnd.rest = false; return; }
  if (remaining.length) return;
  const d = bnd.drag; bnd.drag = null; bnd.press = null;
  if (!d) { kick(); return; }
  if (cancelled) { if (bnd.turn) tbTurnTo(0); kick(); return; }
  if (!d.axis) { tbTap(d.x, d.y); kick(); return; }
  if (d.axis !== "x") { kick(); return; }
  const now = performance.now(), s0 = d.samples.find((s) => now - s.t < 100) || d.samples[0], last = d.samples[d.samples.length - 1];
  const vx = s0 && last !== s0 ? (last.x - s0.x) / Math.max(1, last.t - s0.t) : 0;
  let to = 0;
  if (Math.abs(vx) > 0.3) to = vx < 0 ? 1 : -1; // a flick turns the page, however short
  else if (Math.abs(bnd.turn) > 0.4) to = Math.sign(bnd.turn); // a slow drag turns it past halfway
  if (to && bnd.turn && Math.sign(bnd.turn) !== to && Math.abs(bnd.turn) > 0.05) to = 0;
  if (to && !tbCan(to)) to = 0;
  tbTurnTo(to);
}
function tbTap(x, y) {
  if (bnd.q < 1) return;
  const h = tbPocketAt(x, y);
  if (!h) { // beside a spread: its arrows
    const G = bnd.L, S = G && tbSpreadRect(G);
    if (G?.arrows && y >= S.y && y <= S.y + S.h && (x < S.x || x > S.x + S.w)) tbTurn(x < S.x ? -1 : 1);
    return;
  }
  if (bnd.show) {
    const id = h.c.id; if (bnd.picks.has(id)) bnd.picks.delete(id); else bnd.picks.add(id);
    tick(bnd.picks.has(id) ? 10 : 4); tbSync(); kick(); return;
  }
  tbPocketTap(h.c);
}
function bPinchStart(pts) {
  if (bnd.show) return; // across the table a pinch does nothing: the other person can't close it by accident
  bnd.drag = null; bnd.press = null; bnd.tAnim = null; bnd.turn = 0;
  bnd.pinch = { d0: dist(pts[0], pts[1]), q0: bnd.q, qs: [] }; kick();
}
function bPinchMove(pts) {
  const g = bnd.pinch, d = dist(pts[0], pts[1]);
  bnd.q = clamp(g.q0 - (1 - d / g.d0) / 0.55, 0, 1); g.qs.push({ q: bnd.q, t: performance.now() }); kick();
}
// Letting go: a quick pinch closes whatever the distance; a slow one goes to whichever end is nearer.
function bPinchEnd(cancelled) {
  const g = bnd.pinch; bnd.pinch = null; if (!g) return;
  const qs = g.qs, last = qs[qs.length - 1];
  let first = qs.find((s) => last && last.t - s.t < 160);
  if (qs.length >= 2 && (first === last || qs.indexOf(last) - qs.indexOf(first) < 2)) first = qs[Math.max(0, qs.length - 3)];
  const v = first && last && first !== last ? (last.q - first.q) / Math.max(8, last.t - first.t) : 0;
  const to = cancelled ? 1 : Math.abs(v) > 0.0011 ? (v > 0 ? 1 : 0) : bnd.q > 0.5 ? 1 : 0;
  if (to === 0) closeBinder();
  else if (reduced) { bnd.q = 1; kick(); }
  else { bnd.anim = { from: bnd.q, to: 1, t0: performance.now(), dur: 160 + 300 * (1 - bnd.q) }; kick(); }
}
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) document.addEventListener(type, (e) => {
  if (!bnd.on || tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (type === "touchstart") bDown(touchPts(e.touches));
  else if (type === "touchmove") bMove(touchPts(e.touches));
  else bUp(touchPts(e.touches), type === "touchcancel");
}, { capture: true, passive: false });
let bMouse = false;
document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" || !bnd.on || tbl.on || e.target !== canvas) return; e.stopImmediatePropagation(); bMouse = true; bDown([{ x: e.clientX, y: e.clientY }]); }, true);
document.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" || !bMouse) return; e.stopImmediatePropagation(); bMove([{ x: e.clientX, y: e.clientY }]); }, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => { if (e.pointerType !== "mouse" || !bMouse) return; bMouse = false; e.stopImmediatePropagation(); bUp([], type === "pointercancel"); }, true);
let wheelAcc = 0;
document.addEventListener("wheel", (e) => {
  if (!bnd.on || tbl.on || e.target !== canvas) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (bnd.q < 1 || bnd.tAnim) return;
  if ((e.ctrlKey || e.metaKey) && !bnd.show) { if (e.deltaY > 2) closeBinder(); return; }
  wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(wheelAcc) > 60) { tbTurn(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
}, { capture: true, passive: false });
// Escape or Backspace closes it (in Show mode, it's the hand-back); the arrows turn the page; the wall's keys wait.
document.addEventListener("keydown", (e) => {
  if (!bnd.on || tbl.on || document.activeElement === qIn) return;
  if (e.key === "Escape" || e.key === "Backspace") { if (!whoEl.hidden) return; e.preventDefault(); e.stopImmediatePropagation(); if (bnd.show) tbHandBack(); else closeBinder(); }
  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); tbTurn(e.key === "ArrowRight" ? 1 : -1); }
  else if (e.target === canvas) e.stopImmediatePropagation();
}, true);
// The binder steps aside for anything that navigates the wall: a lens, a search, the list.
lensBox.addEventListener("click", () => { if (bnd.on) closeBinder(true); }, true);
qIn.addEventListener("input", () => { if (bnd.on) closeBinder(true); }, true);
document.getElementById("to-list").addEventListener("click", () => { if (bnd.on) closeBinder(true); }, true);
// From anywhere (the import's summary): the Trade room, then the binder.
function tbOpenFromAnywhere() {
  if (document.body.classList.contains("listmode") || wel.on || tbl.on || bnd.on) return;
  openBinder();
}

// Debug builds only: the tests' hook learns about the binder.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { bnd: { get: () => bnd }, tbList: { value: tbList }, openBinder: { value: openBinder }, closeBinder: { value: closeBinder }, tbEnterShow: { value: tbEnterShow }, tbHandBack: { value: tbHandBack }, tbTurn: { value: tbTurn }, tbPocketRect: { value: tbPocketRect }, tbGiveAway: { value: tbGiveAway }, wantedBy: { value: wantedBy } }); }, 0);
