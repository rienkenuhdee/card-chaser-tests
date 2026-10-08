// ---------- graded slabs (parity 2): production's "Graded cards", as far as a prototype on one device carries it ----------
// A graded copy you own (company, grade, an optional cert number) counts as owning the card: adding one marks the card
// the way I have it does. It wears a slab badge in the binder and the list ("PSA 10"), and in every total it's worth
// what its grade asks, not the raw market. The card up close lists your slabs (Remove, and Verify on the company's
// own lookup), shows what graded copies ask, and for a raw card you own whether grading pays. The asks are made up,
// seeded by card id, from the raw market with a multiplier by rarity and age. The Feed's slabs are in 92-feed.js.
// Left out: the per-set Grade you want, PSA's population and cert API, price history.

const GRADE_COS = ["PSA", "BGS", "CGC", "SGC", "TAG"];
// The grades each company gives: PSA has no 9.5; the others give halves from 8.5 up.
const GRADE_STEPS = [10, 9.5, 9, 8.5, 8, 7, 6, 5, 4, 3, 2, 1];
const gradesOf = (co) => (co === "PSA" ? GRADE_STEPS.filter((g) => g !== 9.5) : GRADE_STEPS);
const NO_SLABS = Object.freeze([]);

// ----- your slabs, kept on this device: { cardId: [{ co, grade, cert, at }] } -----
let graded = {};
try {
  const v = JSON.parse(localStorage.getItem("wall-graded") || "{}");
  for (const [id, list] of Object.entries(v && typeof v === "object" ? v : {})) {
    const ok = (Array.isArray(list) ? list : []).filter((s) => s && GRADE_COS.includes(s.co) && gradesOf(s.co).includes(Number(s.grade)))
      .map((s) => ({ co: s.co, grade: Number(s.grade), cert: String(s.cert || "").slice(0, 24), at: Number(s.at) || 0 }));
    if (ok.length) graded[id] = ok;
  }
} catch { graded = {}; }
let gradedVer = 0; // bumps on every change, for anything that caches
const saveGraded = () => { gradedVer++; try { localStorage.setItem("wall-graded", JSON.stringify(graded)); } catch { /* private mode */ } };
// A card's slabs count only while you own it (taking the card out puts them away; marking it again brings them back).
const slabsOf = (c) => { const b = c.base || c; return (b.owned && graded[b.id]) || NO_SLABS; };
const slabText = (s) => `${s.co} ${s.grade}`;
const topSlab = (list) => list.reduce((a, s) => (!a || s.grade > a.grade ? s : a), null);
const slabBadge = (list) => (list.length ? `${slabText(topSlab(list))}${list.length > 1 ? ` +${list.length - 1}` : ""}` : "");

// ----- what each grade asks (made up, seeded by card id) -----
// A PSA 10 against raw: vintage holos multiply the most; a cheap modern card's 10 is mostly the slab's own cost.
// Lower grades sit between raw and the 10 on a curve; below 7 a slab sells under a raw Near Mint copy, with a floor.
const GR_CURVE = { 10: 1, 9.5: 0.62, 9: 0.38, 8.5: 0.27, 8: 0.2, 7: 0.12 };
const GR_CO = { PSA: 1, BGS: 0.9, CGC: 0.78, SGC: 0.82, TAG: 0.8 };
const GR_TOP = { "BGS 10": 1.9, "BGS 9.5": 0.85, "CGC 10": 0.72, "SGC 10": 0.78, "TAG 10": 0.75 }; // as a share of the PSA 10
const askMemo = new Map();
function gradeAsk(c, co, grade) {
  const b = c.base || c, key = `${b.id}|${co} ${grade}|${b.price}`;
  let v = askMemo.get(key);
  if (v != null) return v;
  const raw = Number.isFinite(b.price) ? b.price : 0, r = (x) => h32(`${b.id}|gr|${x}`), vintage = sets[b.si].year < 2003;
  const mult = vintage ? (b.tier >= 3 ? 7 : 4.5) : b.tier >= 4 ? 2.6 : b.tier === 3 ? 3.4 : 2.8;
  const p10 = Math.max(raw * mult * (0.8 + 0.4 * r("10")), raw + 14 + 10 * r("fl"));
  const top = GR_TOP[`${co} ${grade}`];
  v = top ? p10 * top : grade >= 7 ? raw + (p10 - raw) * (GR_CURVE[grade] ?? 0.12) * (GR_CO[co] ?? 0.8) : raw * (0.5 + 0.07 * grade);
  v = Math.max(8, v * (0.94 + 0.12 * r(`${co}${grade}`)));
  v = Math.round(v * 100) / 100;
  if (askMemo.size > 4000) askMemo.clear();
  askMemo.set(key, v); return v;
}
// What one card you own is worth: each slab at its grade's ask, else the raw market (production's rule).
function worthOne(c) {
  const list = slabsOf(c);
  if (!list.length) return c.price;
  let v = 0; for (const s of list) v += gradeAsk(c, s.co, s.grade);
  return v;
}
// Where a slab can be checked: PSA, CGC and TAG open with the cert filled in; Beckett and SGC open their lookup page.
function verifyUrl(co, cert) {
  const n = encodeURIComponent(String(cert || "").trim());
  if (co === "BGS") return "https://www.beckett.com/grading/card-lookup";
  if (co === "SGC") return "https://gosgc.com/cert-code-lookup";
  if (!n) return null;
  return co === "PSA" ? `https://www.psacard.com/cert/${n}` : co === "CGC" ? `https://www.cgccards.com/certlookup/${n}/` : co === "TAG" ? `https://my.taggrading.com/card/${n}` : null;
}

// ----- adding and removing, with Undo in the message -----
const gradedChanged = () => { saveGraded(); if (state.focus) fillPanel(state.focus, 0); updateCount(); drawList(); kick(); };
function addSlab(c, co, grade, cert = "") {
  const b = c.base || c, was = b.owned;
  if (!GRADE_COS.includes(co) || !gradesOf(co).includes(grade)) return null;
  if (!was) setOwned(c, true, { quiet: true }); // a graded copy is owning the card, as I have it is
  const s = { co, grade, cert: String(cert).trim().slice(0, 24), at: was ? Date.now() : b.got }; // at === got: this slab is what made it yours
  (graded[b.id] ||= []).push(s);
  gradedChanged(); flashTile(c); tick(8);
  const st = sets[c.si];
  toast(`${c.name}, ${slabText(s)} added.${was ? "" : ` ${ownedIn(st.cards)} of ${st.cards.length} in ${st.name}.`}`, () => {
    const list = graded[b.id] || [], i = list.indexOf(s);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) delete graded[b.id];
    if (!was && b.owned) setOwned(c, false, { quiet: true });
    gradedChanged();
  });
  return s;
}
function removeSlab(c, s) {
  const b = c.base || c, list = graded[b.id] || [], i = list.indexOf(s);
  if (i < 0) return;
  list.splice(i, 1);
  if (!list.length) delete graded[b.id];
  const out = !list.length && b.owned && s.at && s.at === b.got; // the slab was all you had of it
  if (out) setOwned(c, false, { quiet: true });
  gradedChanged(); tick(5);
  toast(`${c.name}, ${slabText(s)} removed.${out ? " Taken out of your collection." : ""}`, () => {
    if (out && !b.owned) { setOwned(c, true, { quiet: true }); s.at = b.got; }
    const l = (graded[b.id] ||= []); l.splice(Math.min(i, l.length), 0, s);
    gradedChanged();
  });
}

// ----- the card up close: what grades ask, whether grading pays, your slabs, and the form to add one -----
const pAsks = document.getElementById("p-asks"), pWorth = document.getElementById("p-worth"), pSlabs = document.getElementById("p-slabs");
const pGadd = document.getElementById("p-gadd"), pGform = document.getElementById("p-gform"), pGco = document.getElementById("p-gco"), pGgr = document.getElementById("p-ggr"), pGcert = document.getElementById("p-gcert");
const ASK_ROWS = [["PSA", 10], ["PSA", 9], ["BGS", 9.5], ["CGC", 10]];
const GRADE_FEE = 30; // production's default grading cost, shipping both ways included
const askMoney = (v) => (v >= 1000 ? short(v) : money(v));
pGco.innerHTML = GRADE_COS.map((co) => `<option>${co}</option>`).join("");
function fillGrades() { const keep = Number(pGgr.value) || 10, list = gradesOf(pGco.value); pGgr.innerHTML = list.map((g) => `<option${g === keep ? " selected" : ""}>${g}</option>`).join(""); }
fillGrades();
let grFor = null; // the card the form is open for
function gradedPanel(c) {
  const b = c.base || c;
  if (grFor && grFor !== b) showSlabForm(false, false);
  const a = ASK_ROWS.map(([co, g]) => [`${co} ${g}`, gradeAsk(b, co, g)]);
  pAsks.innerHTML = `<caption>What graded copies ask</caption><tr>${a.map(([t]) => `<th scope="col">${t}</th>`).join("")}</tr><tr>${a.map(([, v]) => `<td>${askMoney(v)}</td>`).join("")}</tr>`;
  const list = slabsOf(c);
  pWorth.hidden = !(b.owned && !list.length);
  if (!pWorth.hidden) {
    const d = (v) => { const x = v - GRADE_FEE - b.price; return x >= 0 ? `<b class="up">${money(x)} more</b>` : `<b class="down">${money(-x)} less</b>`; };
    pWorth.innerHTML = `<b>Worth grading?</b> After ${short(GRADE_FEE)} to grade it, a PSA 10 would come to ${d(a[0][1])} than keeping it raw (${money(b.price)}), a PSA 9 ${d(a[1][1])}. These are asking prices, and a 10 is never guaranteed.`;
  }
  pSlabs.hidden = !list.length;
  pSlabs.innerHTML = list.map((s, i) => { const u = verifyUrl(s.co, s.cert); return `<li><span class="gr-tag">${esc(slabText(s))}</span><span class="gr-line">${s.cert ? `cert ${esc(s.cert)}` : "No cert number"}<small>${askMoney(gradeAsk(b, s.co, s.grade))}</small></span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">Verify on ${s.co}</a>` : ""}<button type="button" data-gr-rm="${i}" aria-label="Remove ${esc(slabText(s))}">Remove</button></li>`; }).join("");
  pGadd.textContent = list.length ? "Add another graded copy" : "Add a graded copy";
}
function showSlabForm(on, refit = true) {
  pGform.hidden = !on; pGadd.hidden = on; pGadd.setAttribute("aria-expanded", String(on));
  grFor = on ? state.focus && (state.focus.base || state.focus) : null;
  if (on) { pGcert.value = ""; pGco.focus({ preventScroll: true }); pGform.scrollIntoView?.({ block: "nearest" }); }
  if (refit && state.focus) focusCam(state.focus); // the panel changed height: the card keeps clear of it
}
pGadd.onclick = () => { tick(3); showSlabForm(true); };
document.getElementById("p-gcancel").onclick = () => showSlabForm(false);
pGco.onchange = fillGrades;
pGform.addEventListener("submit", (e) => {
  e.preventDefault();
  const c = state.focus; if (!c) return;
  showSlabForm(false, false);
  addSlab(c, pGco.value, Number(pGgr.value), pGcert.value);
  focusCam(state.focus || c);
});
pSlabs.addEventListener("click", (e) => {
  const b = e.target.closest("[data-gr-rm]"), c = state.focus; if (!b || !c) return;
  const s = slabsOf(c)[Number(b.dataset.grRm)]; if (s) removeSlab(c, s);
});

// ----- the slab badge on a pocket: a white tag in a black rule at the foot of the art -----
// Drawn over the binder after the cards (one font for every badge in a frame), only where a pocket's label can be read.
const SLAB_MIN = 60;
function drawSlabs() {
  if (view !== "set" || !state.g || !Object.keys(graded).length || state.lens !== "have" || state.time || state.trans || shuffle || room.on || tbl.on || bnd.on || preview) return;
  const g = state.g, y0 = cam.y, y1 = cam.y + vh / cam.s, dim = 1 - state.dimAll * 0.72;
  const r0 = Math.max(0, Math.floor((y0 - g.head) / stepY(g))), r1 = Math.floor((y1 - g.head) / stepY(g));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let k = r0 * g.cols; k < Math.min(g.cards.length, (r1 + 1) * g.cols); k++) {
    const c = g.cards[k];
    if (!c.owned || c.e < 0.3 || c.ph) continue;
    const list = slabsOf(c); if (!list.length) continue;
    const r = binderRect(c, cam);
    if (r.w < SLAB_MIN || r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0) continue;
    slabTag(slabBadge(list), r, c.e * (state.focus && state.focus !== c ? dim : 1));
  }
  ctx.globalAlpha = 1;
}
function slabTag(t, r, a) {
  const fs = r.w >= 110 ? 12 : 10, inset = Math.max(3, r.w * 0.05);
  font(700, fs);
  const tw = textW(t) + fs * 0.9, th = fs + 7, x = r.x + r.w - inset - tw, y = r.y + r.h * 0.76 - inset - th;
  if (![x, y, tw, th].every(Number.isFinite)) return;
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.fillStyle = "#121212"; ctx.fillRect(x - 1.5, y - 1.5, tw + 3, th + 3);
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x, y, tw, th);
  ctx.fillStyle = "#121212"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(t, x + tw / 2, y + th - 4.5);
  ctx.textAlign = "left";
}

setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { graded: { get: () => graded }, addSlab: { value: addSlab }, removeSlab: { value: removeSlab }, slabsOf: { value: slabsOf }, gradeAsk: { value: gradeAsk }, unfocus: { value: unfocus }, worthOne: { value: worthOne }, binderRect: { value: binderRect }, worthOf: { value: worthOf } }); }, 0);
