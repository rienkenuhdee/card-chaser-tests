// ---------- the completion ceremony (parity 6): production's full-screen finish, in the painting's language ----------
// Finishing a whole set or chase (the same moment that mints its trophy) plays one full-screen moment before the
// trophy flow: the set's cards come in along straight lines into a ruled grid (the first rows travel, the rest fill
// row by row, so a big set is as quick as a small one), the trophy plate drops into place under it, the title and the
// counts come in across, and primary squares and rules fall straight down. Share makes a picture of the final frame
// (the grid, the plate, the title) and hands it to the phone's share sheet, or saves it; Done, a tap anywhere else or
// Escape ends it, and the trophy flow (the mint, the shelf, the medals, the message with Undo) carries on as before.
// Reduced motion: the final frame, still. It plays once per finish: a set finished before (taken apart with Undo and
// put back, or finished before this existed) doesn't play it again, which is production's behaviour too (a trophy is
// kept, so the ceremony that comes with it never repeats). Kept in localStorage wall-ceremony, cleared by Reset.
// One overlay canvas and one canvas holding the final frame, both sized when it opens and let go when it closes; the
// moving frames copy from the final frame, so nothing is lettered or measured while it moves.

// var: the toast and the medals ask about it, and could before this part has run
var cer = { on: false, g: null, t0: 0, L: null, still: false, raf: 0, after: [], toast: null, bits: [], end: 0, hold: null, png: null, opened: 0, focus: null, info: null };
let cerSeen = {};
try { cerSeen = JSON.parse(localStorage.getItem("wall-ceremony") || "null") || null; } catch { cerSeen = null; }
if (!cerSeen || typeof cerSeen !== "object") { cerSeen = {}; for (const k of Object.keys(done)) cerSeen[k] = done[k].at || 1; } // finished before the ceremony existed: already celebrated
const cerPersist = () => { try { localStorage.setItem("wall-ceremony", JSON.stringify(cerSeen)); } catch { /* private mode */ } };
cerPersist();

const cerEl = document.createElement("div");
cerEl.className = "cer"; cerEl.id = "cer"; cerEl.hidden = true;
cerEl.setAttribute("role", "dialog"); cerEl.setAttribute("aria-modal", "true"); cerEl.setAttribute("aria-labelledby", "cer-say");
cerEl.innerHTML = `<canvas aria-hidden="true"></canvas><h2 id="cer-say" class="cer-say"></h2><div class="cer-acts"><button type="button" class="act" id="cer-share">Share</button><button type="button" class="act primary" id="cer-done">Done</button></div>`;
document.body.append(cerEl);
const cerCv = cerEl.querySelector("canvas"), cerX = cerCv.getContext("2d"), cerActs = cerEl.querySelector(".cer-acts");
let cerFin = null; // the final frame, at the screen's pixels

// Which of the newly finished groups gets a ceremony: every one is marked as celebrated (an import or a trade finishes
// quietly, and doesn't get one later either); the first one finished by hand, on the wall, plays.
function cerFor(minted, quiet) {
  let pick = null;
  for (const g of minted) {
    const k = doneKey(g), seen = cerSeen[k];
    cerSeen[k] = seen || Date.now();
    if (!seen && !pick && !quiet && (g.set || g.chase) && g.base?.length) pick = g;
  }
  cerPersist();
  if (!pick || cer.on || !started || tbl.on || bnd.on || wel.on || story || document.body.classList.contains("welcoming")) return null;
  return pick;
}

// ----- the composition: one function lays it out, for the screen or for the picture -----
const CER = { PAD: 16, PLATE: 84, TITLE: 90, GAP: 16, BTN: 50 };
function cerGrid(n, w, h) { // the column count that makes the cards biggest, the grid as wide as its column
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols), cw = Math.min(w / cols, (h / rows) * TW / TH);
    if (!best || cw > best.cw) best = { cols, rows, cw };
  }
  const cols = best.cols, rows = best.rows, cw = w / cols, ch = Math.max(4, best.cw * TH / TW);
  return { cols, rows, cw, ch, w, h: rows * ch };
}
function cerLayout(W, H, n, share = false) {
  const { PAD, PLATE, TITLE, GAP, BTN } = CER, sl = share ? 0 : SAFE.left, sr = share ? 0 : SAFE.right, st = share ? 0 : SAFE.top, sb = share ? 0 : SAFE.bottom;
  const side = !share && W > H * 1.2 && H < 600; // a phone on its side: the grid on the left, the plate and the words on the right
  if (side) {
    const x0 = PAD + sl, inner = W - x0 - PAD - sr, gw = Math.round(inner * 0.56), top = st + PAD, avail = H - top - PAD - sb;
    const G = cerGrid(n, gw, avail), gy = top + Math.max(0, (avail - G.h) / 2);
    const rx = x0 + gw + 24, rw = W - rx - PAD - sr, block = PLATE + GAP + TITLE + GAP + BTN, ry = top + Math.max(0, (avail - block) / 2);
    return { W, H, side, grid: { x: x0, y: gy, ...G }, plate: { x: rx, y: ry, w: rw, h: PLATE }, title: { x: rx, y: ry + PLATE + GAP, w: rw, h: TITLE }, btn: { x: rx, y: ry + PLATE + GAP + TITLE + GAP, w: rw, h: BTN } };
  }
  const w = Math.min(W - PAD * 2 - sl - sr, 560), x = sl + (W - sl - sr - w) / 2;
  const top = st + PAD + (share ? 0 : 8), btnY = share ? H : H - sb - PAD - BTN, bottom = share ? H - PAD : btnY - 20;
  const fixed = GAP + PLATE + GAP + TITLE, G = cerGrid(n, w, Math.max(60, bottom - top - fixed)), block = G.h + fixed;
  const y = share ? top : top + Math.max(0, (bottom - top - block) / 2);
  const L = { W, H, side: false, grid: { x, y, ...G }, plate: { x, y: y + G.h + GAP, w, h: PLATE }, title: { x, y: y + G.h + GAP + PLATE + GAP, w, h: TITLE }, btn: { x, y: btnY, w, h: BTN } };
  if (share) L.H = Math.ceil(L.title.y + TITLE + PAD);
  return L;
}
// The words, worked out once.
function cerInfo(g) {
  const n = g.base.length, at = finishOf(g)?.at || Date.now(), name = trophyName(g);
  let medal = null;
  try { medal = medalList().byId.get(`${mdSecOf(g)}:complete`) || null; } catch { medal = null; }
  const date = new Date(at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return { name, n, title: `${name} complete.`, count: `${n} of ${n} · ${date}`, worth: `Worth ${money(worthOf(g.base))} at market`, medal, medalName: medal?.name || "Complete" };
}
const cerInk = (col) => { if (!/^#[0-9a-f]{6}$/i.test(col)) return "#FFFFFF"; const [r, g, b] = hex(col); return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#121212" : "#FFFFFF"; };
const cerRule = (G) => clamp(Math.round(G.cw * 0.07), 1, 4);
// The empty grid: the field, its rules, and the frame around it (drawn while the cards come in).
function cerGridEmpty(x, G) {
  const rw = cerRule(G), F = DS_WR;
  x.fillStyle = theme.rule; x.fillRect(G.x - F, G.y - F, G.w + F * 2, G.h + F * 2);
  x.fillStyle = theme.slot; x.fillRect(G.x + rw / 2, G.y + rw / 2, G.w - rw, G.h - rw); // the frame's inner edge meets the cells
  x.fillStyle = theme.rule;
  for (let c = 1; c < G.cols; c++) x.fillRect(G.x + c * G.cw - rw / 2, G.y, rw, G.h);
  for (let r = 1; r < G.rows; r++) x.fillRect(G.x, G.y + r * G.ch - rw / 2, G.w, rw);
}
// The final frame: the grid full, the plate, the title. k: the scale it's painted at (the screen's pixels, or the picture's).
function cerPaint(x, L, g, info, k) {
  const G = L.grid, P = L.plate, T = L.title, rw = cerRule(G), list = g.base;
  x.setTransform(k, 0, 0, k, 0, 0);
  x.fillStyle = theme.bg; x.fillRect(0, 0, L.W, L.H);
  cerGridEmpty(x, G);
  const big = G.cw >= 40 && G.ch >= 40, named = G.cw >= 92;
  if (big) { fontOn(x, 700, named ? 12 : 11); x.textBaseline = "alphabetic"; x.textAlign = "left"; }
  list.forEach((c, i) => {
    const cx = G.x + (i % G.cols) * G.cw, cy = G.y + Math.floor(i / G.cols) * G.ch, col = typeColor(c);
    x.fillStyle = col; x.fillRect(cx + rw / 2, cy + rw / 2, G.cw - rw, G.ch - rw);
    if (!big) return;
    x.fillStyle = cerInk(col);
    x.fillText(`#${c.num ?? ""}`, cx + rw / 2 + 6, cy + G.ch - rw / 2 - 7);
    if (named) x.fillText(fitOn(x, c.name || "", G.cw - rw - 12), cx + rw / 2 + 6, cy + rw / 2 + 17);
  });
  const left = G.cols * G.rows - list.length; // the pockets past the last card: one red field
  if (left > 0) { x.fillStyle = theme["c-red"]; x.fillRect(G.x + (G.cols - left) * G.cw + rw / 2, G.y + (G.rows - 1) * G.ch + rw / 2, left * G.cw - rw, G.ch - rw); }
  // the plate: a yellow field in a black rule, the trophy on its own white square at the head, the name beside it
  const F = DS_WR;
  x.fillStyle = theme.rule; x.fillRect(P.x - F, P.y - F, P.w + F * 2, P.h + F * 2);
  x.fillStyle = theme.plaque; x.fillRect(P.x, P.y, P.w, P.h);
  x.fillStyle = theme.rule; x.fillRect(P.x + P.h - F / 2, P.y, F, P.h);
  if (info.medal) drawMedal(x, { ...info.medal, rank: "" }, P.x + P.h / 2, P.y + 12, P.h - 24, "", 100, Math.round((P.h - 24) * k / dpr));
  else { x.fillStyle = theme["c-red"]; x.fillRect(P.x + 18, P.y + 18, P.h - 36, P.h - 36); }
  const tx = P.x + P.h + 14, tw = P.w - P.h - 26;
  x.fillStyle = theme["plaque-ink"]; x.textAlign = "left"; x.textBaseline = "alphabetic";
  fontOn(x, 700, 20); x.fillText(fitOn(x, info.name, tw), tx, P.y + 37);
  fontOn(x, 600, 13); x.fillText(fitOn(x, info.medalName, tw), tx, P.y + 60);
  // the title and the counts
  x.fillStyle = theme.ink; fontOn(x, 700, 25); x.fillText(fitOn(x, info.title, T.w), T.x, T.y + 28);
  x.fillStyle = theme.muted; fontOn(x, 600, 15); x.fillText(fitOn(x, info.count, T.w), T.x, T.y + 56); x.fillText(fitOn(x, info.worth, T.w), T.x, T.y + 79);
  x.setTransform(1, 0, 0, 1, 0, 0);
}

// ----- the moment -----
// Times in ms from the open. The first rows of cards travel (at most CER_MOVE, whole rows), the rest fill row by row.
const CER_MOVE = 30, CER_T = { fill0: 380, fill1: 820, plate0: 760, plate1: 1180, title0: 1080, title1: 1420, bits0: 820, acts: 1250 };
function cerBits(L, key) { // falling squares and rules in the primaries and black: a few dozen, seeded by the trophy
  const cols = ["c-red", "c-yellow", "c-blue", "rule"], out = [];
  for (let i = 0; i < 36; i++) {
    const r = (s) => h32(`${s}|${i}|${key}`), kind = i % 3, len = 14 + r("l") * 14;
    const w = kind === 0 ? 7 + r("s") * 6 : kind === 1 ? 3 : len, h = kind === 0 ? w : kind === 1 ? len : 3;
    out.push({ x: r("x") * (L.W - w), y: -h - r("y") * 160, w, h, col: cols[i % 4], v: 0.42 + r("v") * 0.3, d: r("d") * 700 });
  }
  return out;
}
function cerBuild() {
  const g = cer.g, L = cerLayout(vw, vh, g.base.length), G = L.grid;
  cer.L = L;
  cerCv.width = Math.max(1, Math.round(vw * dpr)); cerCv.height = Math.max(1, Math.round(vh * dpr));
  cerFin ||= document.createElement("canvas");
  cerFin.width = cerCv.width; cerFin.height = cerCv.height;
  cerPaint(cerFin.getContext("2d"), L, g, cer.info, dpr);
  cer.move = Math.min(g.base.length, Math.max(G.cols, Math.floor(CER_MOVE / G.cols) * G.cols)); // whole rows
  cer.bits = cer.still ? [] : cerBits(L, doneKey(g));
  const fall = cer.bits.reduce((a, b) => Math.max(a, b.d + (L.H - b.y) / b.v), 0);
  cer.end = cer.still ? 0 : Math.max(CER_T.title1, CER_T.fill1, CER_T.bits0 + fall);
  Object.assign(cerActs.style, { left: `${L.btn.x}px`, top: `${L.btn.y}px`, width: `${L.btn.w}px`, height: `${L.btn.h}px` });
}
const cerOut = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3); // straight in, slowing to a stop: no overshoot
// One frame of the moment at time t; false once it has landed (the final frame is up).
function cerDraw(t) {
  const x = cerX, L = cer.L, G = L.grid, k = dpr, F = cerFin;
  if (t >= cer.end) { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(F, 0, 0); return false; }
  const blit = (sx, sy, sw, sh, dx, dy) => { if (sw > 0 && sh > 0) x.drawImage(F, sx * k, sy * k, sw * k, sh * k, dx, dy, sw, sh); };
  x.setTransform(k, 0, 0, k, 0, 0); x.globalAlpha = 1;
  x.fillStyle = theme.bg; x.fillRect(0, 0, L.W, L.H);
  cerGridEmpty(x, G);
  // the rest of the cards: row by row, each row drawn in from the left
  const n = cer.g.base.length, rows0 = Math.ceil(cer.move / G.cols), rest = G.rows - rows0;
  for (let r = rows0; r < G.rows; r++) {
    const a = CER_T.fill0 + ((r - rows0) / Math.max(1, rest)) * (CER_T.fill1 - CER_T.fill0 - 160), p = cerOut((t - a) / 160);
    if (p > 0) blit(G.x, G.y + r * G.ch, G.w * p, G.ch, G.x, G.y + r * G.ch);
  }
  if (G.cols * G.rows > n && rest === 0) { const sx = G.x + (n % G.cols) * G.cw, sy = G.y + (G.rows - 1) * G.ch, p = cerOut((t - CER_T.fill1 + 160) / 160); if (p > 0) blit(sx, sy, (G.x + G.w - sx) * p, G.ch, sx, sy); } // every row travelled: the red field after them
  // the first rows: each card travels across its row to its pocket, rows from alternate sides, the farthest first
  const rw = cerRule(G), h = rw / 2;
  for (let i = 0; i < cer.move; i++) {
    const col = i % G.cols, row = Math.floor(i / G.cols), a = row * 70 + (row % 2 ? col : G.cols - 1 - col) * Math.min(24, 300 / G.cols), p = cerOut((t - a) / 420);
    if (p <= 0) continue;
    const tx = G.x + col * G.cw, ty = G.y + row * G.ch, fx = row % 2 ? L.W + 8 : -G.cw - 8;
    blit(tx + h, ty + h, G.cw - rw, G.ch - rw, fx + (tx - fx) * p + h, ty + h);
  }
  // the plate drops straight down into place
  const P = L.plate, F4 = DS_WR, pp = cerOut((t - CER_T.plate0) / (CER_T.plate1 - CER_T.plate0));
  if (pp > 0) { const y0 = -P.h - F4 * 2; blit(P.x - F4, P.y - F4, P.w + F4 * 2, P.h + F4 * 2, P.x - F4, y0 + (P.y - F4 - y0) * pp); }
  // the title and the counts come in across
  const T = L.title, tp = cerOut((t - CER_T.title0) / (CER_T.title1 - CER_T.title0));
  if (tp > 0) { x.globalAlpha = tp; blit(T.x, T.y, T.w, T.h, T.x - 28 * (1 - tp), T.y); x.globalAlpha = 1; }
  // confetti, in the painting's terms: squares and short rules falling straight down
  const tb = t - CER_T.bits0;
  if (tb > 0) for (const b of cer.bits) { const y = b.y + (tb - b.d) * b.v; if (tb < b.d || y > L.H) continue; x.fillStyle = theme[b.col] || theme.rule; x.fillRect(b.x, y, b.w, b.h); }
  return true;
}
function cerLoop(now) {
  cer.raf = 0;
  if (!cer.on) return;
  let more = false;
  try { more = cerDraw(cer.hold != null ? cer.hold : now - cer.t0); }
  catch (e) { console.error(e); try { cerX.setTransform(1, 0, 0, 1, 0, 0); cerX.globalAlpha = 1; cerX.drawImage(cerFin, 0, 0); } catch { /* nothing to show */ } more = false; } // a frame that throws lands on the final frame
  if (!more) cerShown();
  if (more || cer.hold != null) cer.raf = requestAnimationFrame(cerLoop);
}
function cerShown() { // landed: the buttons, and the picture made ahead so Share answers the tap at once
  cerEl.classList.add("in");
  if (cer.png || !cer.on) return;
  const p = cerPng().then((b) => { p.blob = b; return b; }, () => null);
  cer.png = p;
}

// ----- open and close -----
function cerOpen(g) {
  cer.on = true; cer.g = g; cer.still = reduced; cer.after = cer.after || []; cer.toast = null; cer.png = null; cer.hold = null;
  cer.info = cerInfo(g); cer.focus = document.activeElement;
  cerEl.querySelector("#cer-say").textContent = `${cer.info.title} ${cer.info.count}. ${cer.info.worth}.`;
  cerEl.hidden = false; cerEl.classList.remove("in"); document.body.classList.add("ceremony");
  cerBuild();
  cer.t0 = cer.opened = performance.now();
  if (cer.still) { cerDraw(Infinity); cerShown(); }
  else { cerDraw(0); cer.raf = requestAnimationFrame(cerLoop); setTimeout(() => { if (cer.on) cerEl.classList.add("in"); }, CER_T.acts); tick([30, 40, 60]); }
  focusFor(cerEl.querySelector("#cer-done"), cerEl);
}
function cerClose() {
  if (!cer.on) return;
  cer.on = false; cer.hold = null; cancelAnimationFrame(cer.raf); cer.raf = 0;
  cerEl.hidden = true; cerEl.classList.remove("in"); document.body.classList.remove("ceremony");
  cerCv.width = cerCv.height = 1; if (cerFin) cerFin.width = cerFin.height = 1; // let the pixels go
  cer.g = null; cer.L = null; cer.bits = []; cer.png = null;
  tick(6);
  for (const f of cer.after.splice(0)) { try { f(); } catch (e) { console.error(e); } } // the trophy flow, as it would have run
  if (cer.toast) { const a = cer.toast; cer.toast = null; toast(...a); } // the message it held, with its Undo
  if (mdQueue.length) mdCelebrateSoon();
  if (cer.focus?.isConnected && cer.focus !== document.body) cer.focus.focus({ preventScroll: true });
  kick();
}
// Run now, or once the ceremony is over.
const cerLater = (f) => { if (cer.on) cer.after.push(f); else f(); };
addEventListener("resize", () => { if (!cer.on) return; cerBuild(); cerDraw(cer.raf ? performance.now() - cer.t0 : Infinity); });

// ----- Share: the final frame as a picture -----
function cerPng() {
  const g = cer.g, S = 3, L = cerLayout(390, 640, g.base.length, true), cv = document.createElement("canvas"); // the one canvas it takes, made here
  cv.width = Math.round(L.W * S); cv.height = Math.round(L.H * S);
  cerPaint(cv.getContext("2d"), L, g, cer.info, S);
  return new Promise((res, rej) => cv.toBlob((b) => { cv.width = cv.height = 0; if (b) res(b); else rej(new Error("no picture")); }, "image/png"));
}
const cerFile = () => `${(cer.info?.name || "complete").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-complete.png`;
function cerSave(blob, name) {
  const a = document.createElement("a"), u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
function cerSend(blob) {
  const name = cerFile(), file = new File([blob], name, { type: "image/png" }), info = cer.info;
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    return navigator.share({ files: [file], title: info.title, text: `${info.title} ${info.count}.` }).then(() => "shared", (e) => { if (e?.name === "AbortError") return "cancelled"; cerSave(blob, name); return "saved"; });
  }
  cerSave(blob, name); return Promise.resolve("saved");
}
function cerShare() {
  if (!cer.on) return Promise.resolve(null);
  tick(5);
  const made = cer.png; // made ahead as it landed: the share sheet opens inside the tap, as Safari wants
  if (made?.blob) return cerSend(made.blob);
  return (made || cerPng()).then((b) => b || cerPng()).then(cerSend); // still being made (or it failed): when it's ready
}

cerEl.querySelector("#cer-done").onclick = () => cerClose();
cerEl.querySelector("#cer-share").onclick = () => { cerShare(); };
cerCv.addEventListener("click", () => { if (performance.now() - cer.opened > 450) cerClose(); }); // a tap anywhere else (not the tap that finished it)
addEventListener("keydown", (e) => {
  if (!cer.on) return;
  if (!e.metaKey && !e.ctrlKey && !e.altKey) keyed = true;
  if (e.key === "Escape") { e.preventDefault(); cerClose(); }
  e.stopImmediatePropagation(); // the wall's keys wait; the buttons still take Enter and Space
}, true);
// Debug builds only: the tests' hook sees the ceremony.
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { cer: { get: () => cer }, cerSeen: { get: () => cerSeen }, cerOpen: { value: cerOpen }, cerClose: { value: cerClose }, cerShare: { value: cerShare }, cerPng: { value: cerPng } }); }, 0);
