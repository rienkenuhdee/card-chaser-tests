// ---------- the show floor: type what's printed on the card, get a verdict ----------
// "Show" in the top strip switches on floor mode for the Sacramento show. The search steps aside for a keypad along
// the bottom: set code chips and big digits, so one thumb can type what's printed on the card in the other hand
// (EVS 94). The moment the entry resolves to one card the wall flies to it (open the set, focus the card: the usual
// navigation) and a verdict fills the top half of the screen in type you can read from a metre away: NEED IT with
// the price you decided on at home ("Pay up to $X") if it's a want, NEED IT with the market price if it's merely
// unowned, HAVE IT if you own it. "Got it" at the thumb marks it owned (Undo on the toast); "Next card" clears the
// entry. Outside floor mode nothing changes except a "Want it" toggle on the card panel.
const SHOW = "Sacramento, Nov 20 to 22";

// ----- wants: the cards you're hunting, and what you'd pay -----
let wants = {};
try { wants = JSON.parse(localStorage.getItem("wall-wants") || "{}") || {}; } catch { wants = {}; }
const persistWants = () => { try { localStorage.setItem("wall-wants", JSON.stringify(wants)); } catch { /* private mode */ } };
for (const c of cards) c.want0 = h32(c.id + "w") < 0.1;
const isWant = (c) => !c.owned && (wants[c.id] != null ? wants[c.id] : c.want0);
const payUpTo = (c) => Math.round(c.price * 0.85 * 100) / 100;
const wantsIn = (list) => list.filter(isWant).length;
function setWant(c, on) {
  wants[c.id] = on; persistWants(); tick(on ? 10 : 5);
  if (state.focus === c) fillPanel(c, 0);
  refreshChips(); drawList(); kick();
}
// Marking a want owned drops it from the list; taking it out again (or Undo) puts it back.
function setOwned(c, on, { undo = null, quiet = false } = {}) {
  const now = performance.now();
  if (on && isWant(c)) { wants[c.id] = false; c.wantDrop = true; persistWants(); }
  else if (!on && c.wantDrop) { wants[c.id] = true; c.wantDrop = false; persistWants(); }
  c.owned = on; c.got = on ? Date.now() : null; saved[c.id] = { on, at: c.got }; persist();
  c.anim = { t0: now, to: on };
  const g = groups[c.g];
  g.ripple = { t0: now, col: c.col, row: c.row };
  tick(on ? 14 : 6);
  const st = sets[c.si], owned = ownedIn(st.cards);
  if (on && owned === st.cards.length) { if (mode === "set") g.burst = now; tick(40); toast(`${st.name} complete. ${owned} of ${owned}.`, undo); }
  else if (!quiet) toast(on ? `${c.name} added. ${owned} of ${st.cards.length} in ${st.name}.` : `${c.name} taken out.`, undo);
  if (state.focus === c) fillPanel(c, 0);
  if (floorOn && verdict.c === c) showVerdict(c);
  refreshChips();
  updateCount(); drawList(); kick();
}

// ----- the card panel: "Want it" next to "I have it" -----
document.getElementById("p-own").insertAdjacentHTML("afterend", '<button class="act want" id="p-want" aria-pressed="false">Want it</button>');
document.getElementById("p-deal").insertAdjacentHTML("afterend", '<p class="wantline" id="p-wantline" hidden></p>');
const wantBtn = document.getElementById("p-want"), wantLine = document.getElementById("p-wantline");
wantBtn.onclick = () => { const c = state.focus; if (c && !c.owned) setWant(c, !isWant(c)); };
function fillPanel(c, dir) {
  const st = sets[c.si];
  const swap = document.getElementById("swap");
  const put = () => {
    document.getElementById("p-name").textContent = c.name;
    document.getElementById("p-meta").textContent = `${st.name}, ${st.code} ${c.num}/${st.printed}. ${c.rname}.${c.owned && c.got ? ` Yours since ${new Date(c.got).toLocaleDateString("en-US", { month: "short", year: "numeric" })}.` : ""}`;
    document.getElementById("p-price").innerHTML = `${money(c.price)}<small>market</small>`;
    const dl = document.getElementById("p-deal");
    if (!c.owned && c.deal) { dl.hidden = false; dl.textContent = `A copy on eBay for ${money(c.deal)} right now, ${Math.round((1 - c.deal / c.price) * 100)}% under.`; } else dl.hidden = true;
    const own = document.getElementById("p-own"), buy = document.getElementById("p-buy");
    own.textContent = c.owned ? "In your collection ✓" : "I have it";
    own.className = `act ${c.owned ? "owned" : "primary"}`;
    own.setAttribute("aria-pressed", String(c.owned));
    buy.textContent = c.owned ? "Back to the set" : c.deal ? `Buy for ${money(c.deal)}` : "Find a copy";
    const want = isWant(c);
    panel.classList.toggle("wantable", !c.owned);
    wantBtn.hidden = c.owned;
    wantBtn.textContent = want ? "Wanted ✓" : "Want it";
    wantBtn.classList.toggle("on", want);
    wantBtn.setAttribute("aria-pressed", String(want));
    wantLine.hidden = !want;
    wantLine.textContent = `On your list for ${SHOW}. Pay up to ${money(payUpTo(c))}.`;
  };
  if (dir && !reduced) { swap.classList.add("out"); setTimeout(() => { put(); swap.classList.remove("out"); }, 140); } else put();
}

// ----- floor mode: the DOM -----
let floorOn = false;
const entry = { code: null, num: "", timer: 0, buf: "" };
const verdict = { c: null, just: null };
searchBox.insertAdjacentHTML("afterend", `<span class="fl-title" id="fl-title">${SHOW}</span><button class="show" id="show" aria-pressed="false" aria-label="Show floor: ${SHOW}">Show</button>`);
document.body.insertAdjacentHTML("beforeend", `
<div class="floor" id="floor" hidden>
  <div class="fl-top" id="fl-top">
    <div class="fl-entry" id="fl-entry">
      <div class="fl-typed"><span class="fl-code" id="fl-code">Set</span><span class="fl-num" id="fl-num"></span><span class="fl-caret" aria-hidden="true"></span></div>
      <p class="fl-hint" id="fl-hint" aria-live="polite"></p>
    </div>
    <div class="fl-verdict" id="fl-verdict" aria-live="assertive">
      <div class="fl-word" id="fl-word"></div>
      <div class="fl-pay" id="fl-pay"></div>
      <div class="fl-card" id="fl-card"></div>
    </div>
  </div>
  <div class="fl-pad" id="fl-pad" role="group" aria-label="Type the card's set code and number">
    <div class="fl-chips" id="fl-chips"></div>
    <div class="fl-keys" id="fl-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button type="button" data-key="${d}">${d}</button>`).join("")}<button type="button" class="del" data-key="del" aria-label="Delete">⌫</button><button type="button" data-key="0">0</button><button type="button" class="go" data-key="go">Go</button></div>
  </div>
  <div class="fl-acts" id="fl-acts">
    <button type="button" class="fl-got" id="fl-got">Got it</button>
    <button type="button" class="fl-next" id="fl-next">Next card</button>
  </div>
</div>`);
const floorEl = document.getElementById("floor"), showBtn = document.getElementById("show"), flTop = document.getElementById("fl-top"), flEntry = document.getElementById("fl-entry");
const flCode = document.getElementById("fl-code"), flNum = document.getElementById("fl-num"), flHint = document.getElementById("fl-hint");
const flWord = document.getElementById("fl-word"), flPay = document.getElementById("fl-pay"), flCard = document.getElementById("fl-card");
const flChips = document.getElementById("fl-chips"), flActs = document.getElementById("fl-acts"), flGot = document.getElementById("fl-got"), flNext = document.getElementById("fl-next");
const codeSet = (code) => sets.find((s) => s.code === code) || null;
const entrySet = () => codeSet(entry.code);

// The set code chips, each with how many of your wants are in that set: what you're hunting for here.
function buildChips() {
  flChips.innerHTML = sets.map((s) => `<button type="button" class="chip" data-code="${s.code}" aria-pressed="false" aria-label="${s.name}"><b>${s.code}</b><small></small></button>`).join("");
  refreshChips();
}
function refreshChips() {
  if (!flChips.children.length) return;
  for (const b of flChips.children) {
    const s = codeSet(b.dataset.code), n = s ? wantsIn(s.cards) : 0;
    b.setAttribute("aria-pressed", String(b.dataset.code === entry.code));
    b.querySelector("small").textContent = n ? String(n) : "";
    b.title = `${s.name}: ${n ? `${n} on your list` : "nothing on your list"}`;
  }
}
flChips.addEventListener("click", (e) => { const b = e.target.closest("[data-code]"); if (b) pickCode(b.dataset.code); });
document.getElementById("fl-keys").addEventListener("click", (e) => {
  const b = e.target.closest("[data-key]"); if (!b) return;
  const k = b.dataset.key;
  if (k === "del") backspace(); else if (k === "go") check(true); else keyIn(k);
});
showBtn.onclick = () => (floorOn ? leaveFloor() : enterFloor());
flGot.onclick = () => {
  const c = verdict.c; if (!c || c.owned) return;
  verdict.just = c;
  setOwned(c, true, { undo: () => setOwned(c, false, { quiet: true }) });
};
flNext.onclick = () => nextCard();

// ----- entry: a set code, then a number -----
function renderEntry() {
  const st = entrySet();
  flCode.textContent = st ? st.code : "Set";
  flCode.classList.toggle("empty", !st);
  flNum.textContent = entry.num;
  refreshChips();
}
function hint(text, bad = false) { flHint.textContent = text; flHint.classList.toggle("bad", bad); }
function shake(msg) {
  hint(msg, true); tick(20);
  if (reduced) return;
  flEntry.classList.remove("shake"); void flEntry.offsetWidth; flEntry.classList.add("shake");
  setTimeout(() => flEntry.classList.remove("shake"), 450);
}
function idleHint() {
  const st = entrySet();
  if (!st) return hint("Tap the set code on the card, then its number");
  const n = wantsIn(st.cards);
  hint(n ? `Now the number. ${n} on your list in ${st.name}` : `Now the number. Nothing on your list in ${st.name}`);
}
function pickCode(code) {
  if (floorEl.classList.contains("verdict")) nextCard(false);
  clearTimeout(entry.timer);
  entry.code = code; entry.num = ""; entry.buf = "";
  renderEntry(); idleHint(); tick(5);
  // Open that set behind the keypad, so the binder shows what you're hunting for in it.
  const st = entrySet(), g = mode === "set" && st ? groups.find((x) => x.set === st) : null;
  if (g) openGroup(g);
}
function keyIn(d) {
  if (floorEl.classList.contains("verdict")) nextCard(false);
  const st = entrySet();
  if (!st) { shake("Pick a set code first"); return; }
  if (entry.num.length >= 4) { tick(3); return; }
  entry.num += d; tick(4); renderEntry();
  check(false);
}
function backspace() {
  if (floorEl.classList.contains("verdict")) { nextCard(false); return; }
  clearTimeout(entry.timer);
  if (!entry.num) { if (entry.code) { entry.code = null; renderEntry(); idleHint(); tick(3); } return; }
  entry.num = entry.num.slice(0, -1); tick(3); renderEntry();
  if (entry.num) check(false); else idleHint();
}
// As soon as the entry can only be one card it lands; a number that could still grow (12 in a set with 120s) lands
// after a short pause, or at once on Go. A number the set doesn't have shakes: "No EVS 999".
function check(force) {
  clearTimeout(entry.timer);
  const st = entrySet(); if (!st || !entry.num) { if (force && st) shake("Type the number first"); return; }
  const exact = st.cards.find((c) => c.num === entry.num), more = st.cards.some((c) => c.num !== entry.num && c.num.startsWith(entry.num));
  if (!exact && (force || !more)) { shake(`No ${st.code} ${entry.num}`); return; }
  if (exact && (force || !more)) return land(exact);
  if (exact) { hint(`${exact.name}…`); entry.timer = setTimeout(() => land(exact), 650); }
  else hint("Keep going");
}
function land(c) {
  clearTimeout(entry.timer);
  verdict.just = null;
  showVerdict(c);
  flyToCard(c);
}
function nextCard(clear = true) {
  clearTimeout(entry.timer);
  verdict.c = null; verdict.just = null;
  floorEl.classList.remove("verdict");
  if (clear) { entry.num = ""; if (state.focus) unfocus(); tick(4); }
  renderEntry(); idleHint(); kick();
}

// ----- the verdict -----
function showVerdict(c) {
  verdict.c = c;
  const st = sets[c.si], want = isWant(c), kind = c.owned ? "have" : want ? "want" : "need";
  flTop.dataset.kind = kind;
  floorEl.classList.add("verdict");
  flWord.textContent = c.owned ? "Have it" : "Need it";
  flPay.textContent = c.owned ? (verdict.just === c ? "Yours now" : "Spare? Trade it") : want ? `Pay up to ${money(payUpTo(c))}` : `Market ${money(c.price)}`;
  flCard.textContent = `${c.name}. ${st.code} ${c.num}/${st.printed}, ${st.name}`;
  flGot.hidden = c.owned;
  flActs.classList.toggle("have", c.owned);
  entry.code = st.code; entry.num = c.num; renderEntry();
  if (!c.owned) tick(want ? 18 : 10);
}
// The wall flies to the card: open its set (the usual opening), then bring the card up close.
function flyToCard(c) {
  const g = groups[c.g];
  const go = () => focus(c);
  if (view === "set" && state.g === g && !state.trans) return go();
  openGroup(g, go);
}
function openGroup(g, then = null) {
  finishTransition();
  if (state.trans) return; // fingers are holding a transition; leave it to them
  fly = null; inertia = false;
  if (state.focus) unfocus();
  if (view === "set" && state.g === g) { then?.(); return; }
  if (view === "set") { view = "mosaic"; state.g = null; setChrome(); }
  enterGroup(g, { then });
}

// ----- the mode -----
function enterFloor() {
  if (floorOn) return;
  if (document.body.classList.contains("listmode")) setListMode(false);
  floorOn = true; leaveMark(); hideCaption(); setMenu(false);
  if (document.activeElement === qIn) qIn.blur();
  document.body.classList.add("floor"); floorEl.hidden = false; showBtn.setAttribute("aria-pressed", "true");
  buildChips();
  entry.num = ""; entry.buf = "";
  entry.code = (view === "set" && state.g?.set?.code) || entry.code || null;
  verdict.c = null; verdict.just = null; floorEl.classList.remove("verdict");
  renderEntry(); idleHint();
  if (state.focus) focus(state.focus); // a card already up close gets its verdict straight away
  kick();
}
function leaveFloor() {
  if (!floorOn) return;
  clearTimeout(entry.timer);
  floorOn = false; verdict.c = null; verdict.just = null;
  document.body.classList.remove("floor"); floorEl.hidden = true; floorEl.classList.remove("verdict"); showBtn.setAttribute("aria-pressed", "false");
  if (state.focus) focus(state.focus); // back to the usual framing, with the card panel
  tick(4); kick();
}
// Inside floor mode the focused card sits between the verdict and the thumb buttons. Tapping or flicking to a
// card on the wall gives its verdict too.
function focus(c, dir = 0) {
  state.focus = c;
  document.body.classList.add("focused");
  fillPanel(c, dir);
  let top = 70, avail = vh - panelH() - top - 12;
  if (floorOn) { if (verdict.c !== c) { verdict.just = null; showVerdict(c); } top = Math.round(vh * 0.5) + 10; avail = vh - top - (flActs.offsetHeight || 124) - 16; }
  const ch = Math.min(avail * 0.92, (vw * 0.78) * TH / TW);
  const S = TH * c.sz, s = Math.min(ch / S, maxS() * 1.4);
  const cy = top + avail / 2;
  flyTo({ s, x: c.x + TW * c.sz / 2 - vw / 2 / s, y: c.y + S / 2 - cy / s }, dir ? 360 : 520);
  tick(6);
}
// Swiping to another set while typing moves the code chip with you.
function setChrome() {
  document.body.classList.toggle("inset", view === "set");
  backBtn.hidden = view !== "set"; arrBtn0.hidden = view === "set";
  markBtn.hidden = view !== "set" || marking;
  document.getElementById("where").textContent = view === "set" && state.g ? state.g.name : "";
  if (marking && view !== "set") leaveMark();
  updateCount();
  if (floorOn && !verdict.c && view === "set" && state.g?.set && state.g.set.code !== entry.code) { entry.code = state.g.set.code; entry.num = ""; renderEntry(); idleHint(); }
}
function setListMode(on) {
  if (on) { leaveMark(); leaveFloor(); } // the list has its own way to mark (tap a row)
  document.body.classList.toggle("listmode", on);
  try { localStorage.setItem("wall-list", on ? "1" : ""); } catch { /* fine */ }
  unfocus(); drawList();
  if (on) listEl.querySelector("h1")?.focus(); else { kick(); canvas.focus(); }
}
// A hardware keyboard works too: digits, Backspace, Enter for Go, letters for a set code, Escape to leave.
addEventListener("keydown", (e) => {
  if (!floorOn || about.open) return;
  if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
  const k = e.key;
  if (k === "Escape") leaveFloor();
  else if (/^\d$/.test(k)) keyIn(k);
  else if (k === "Backspace") backspace();
  else if (k === "Enter") check(true);
  else if (/^[a-z]$/i.test(k)) {
    entry.buf = (entry.buf + k.toUpperCase()).slice(-3);
    const hitCode = sets.find((s) => s.code === entry.buf) || sets.find((s) => s.code === entry.buf.slice(-2));
    if (hitCode) { pickCode(hitCode.code); entry.buf = ""; }
  } else return;
  e.preventDefault(); e.stopPropagation();
}, true);

// ----- the wall in floor mode: your wants lead -----
function emphasis(c) {
  if (state.matches) return state.matches.has(c) ? 1 : 0.1;
  if (floorOn) return isWant(c) ? 1 : c.owned ? 0.22 : 0.5;
  if (state.lens === "need") return c.owned ? 0.16 : 1;
  if (state.lens === "deals") return !c.owned && c.deal ? 1 : 0.18;
  if (state.lens === "value") return c.owned ? 1 : 0.22;
  return 1;
}
// An empty pocket you're hunting wears a small gold star (close up only, so the far-out levels stay cheap).
function emptyPocket(c, sx, sy, w, h, value) {
  const r = w * 0.045;
  const dealOn = c.deal && state.lens !== "need" && state.lens !== "time";
  if (lifted && c.lift && dealOn && !value) {
    rr(sx, sy, w, h, r); ctx.fillStyle = dealTint(); ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.014); ctx.strokeStyle = theme.deal;
    rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke();
    if (w < 30) return;
    const pad = w * 0.08, pct = Math.round(discount(c) * 100);
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillStyle = theme.deal;
    font(800, w * 0.16); ctx.fillText(short(c.deal), sx + pad, sy + pad + w * 0.14);
    ctx.fillStyle = theme.muted; font(500, w * 0.072); ctx.fillText(`was ${short(c.price)}`, sx + pad, sy + pad + w * 0.23);
    ctx.textAlign = "right"; ctx.fillStyle = theme.deal;
    font(800, w * 0.22); ctx.fillText(`${pct}%`, sx + w - pad, sy + h * 0.62);
    ctx.fillStyle = theme.muted; font(600, w * 0.07); ctx.fillText("under market", sx + w - pad, sy + h * 0.62 + w * 0.085);
    ctx.textAlign = "left"; ctx.fillStyle = theme.ink;
    font(700, w * 0.095, true); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - w * 0.08);
    ctx.fillStyle = theme.muted; font(500, w * 0.064); ctx.fillText(`${sets[c.si].code} ${c.num}/${sets[c.si].printed}`, sx + pad, sy + h - pad);
    return;
  }
  const want = isWant(c);
  rr(sx, sy, w, h, r); ctx.fillStyle = theme.slot; ctx.fill();
  ctx.lineWidth = want && !value ? Math.max(1, w * 0.016) : Math.max(1, w * 0.008);
  ctx.strokeStyle = value ? heat(c.price) : want ? theme.gold : dealOn ? theme.deal : theme["slot-line"];
  rr(sx + 0.5, sy + 0.5, w - 1, h - 1, r); ctx.stroke();
  if (w < 44) return;
  const pad = w * 0.075;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "right";
  if (dealOn) { ctx.fillStyle = theme.deal; font(700, w * 0.085); ctx.fillText(short(c.deal), sx + w - pad, sy + pad + w * 0.07); font(500, w * 0.06); ctx.fillText("live", sx + w - pad, sy + pad + w * 0.15); }
  else { ctx.fillStyle = value ? heat(c.price) : theme.muted; font(600, w * 0.08); ctx.fillText(short(c.price), sx + w - pad, sy + pad + w * 0.07); }
  ctx.textAlign = "left";
  if (want) { ctx.fillStyle = theme.gold; font(800, w * 0.1); ctx.fillText(w > 80 ? "★ Want" : "★", sx + pad, sy + pad + w * 0.075); }
  ctx.fillStyle = theme.muted;
  font(700, w * 0.088, true); ctx.fillText(fitText(c.name, w - pad * 2), sx + pad, sy + h - pad - w * 0.075);
  font(500, w * 0.064); ctx.fillText(`${sets[c.si].code} ${c.num}/${sets[c.si].printed}`, sx + pad, sy + h - pad);
}
// The list says what you'd pay for a want.
function drawList() {
  if (!document.body.classList.contains("listmode")) return;
  const show = (c) => (state.matches ? state.matches.has(c) : state.lens === "need" ? !c.owned : state.lens === "deals" ? !c.owned && c.deal : true);
  listEl.querySelector("#list-body").innerHTML = groups.map((g) => {
    const items = g.cards.filter(show);
    if (!items.length) return "";
    return `<section><h2>${g.name}</h2><p class="lsub">${g.sub()}</p><ul>${items.map((c) => {
      const st = sets[c.si], want = isWant(c);
      return `<li><button class="lrow${want ? " lwant" : ""}" data-i="${c.i}" aria-pressed="${c.owned}"><span class="lname">${c.name}</span><span class="lmeta">${st.name} #${c.num}, ${c.rname}</span><span class="lprice">${!c.owned && c.deal ? `<b class="ldeal">Deal ${money(c.deal)}</b>` : money(c.price)}</span><span class="lstate">${c.owned ? "Have it" : want ? `Want it, pay up to ${money(payUpTo(c))}` : "Need it"}</span></button></li>`;
    }).join("")}</ul></section>`;
  }).join("") || `<p class="lsub">Nothing here with this lens.</p>`;
}
// With a verdict up, the card sits in the gap between banner and buttons even in the first row: the binder's edge
// doesn't pin the camera while floor mode has a card up close.
function clampCam(g) {
  if (!g || (floorOn && state.focus)) return;
  const left = -12 / cam.s, right = g.w + 12 / cam.s - vw / cam.s;
  cam.x = right < left ? (left + right) / 2 : clamp(cam.x, left, right);
  const top = -(topPad() + 6) / cam.s, bottom = g.h + (botPad() + 20) / cam.s - vh / cam.s;
  cam.y = bottom < top ? top : clamp(cam.y, top, bottom);
}
// The Show pill shares the strip with the search box: a one-word placeholder on a narrow screen.
function updateCount() {
  const n = state.lens === "time" ? cards.filter((c) => c.owned && c.got && c.got <= state.t).length : cards.filter((c) => c.owned).length;
  document.getElementById("count").textContent = `${n.toLocaleString()} of ${TOTAL.toLocaleString()}`;
  qIn.placeholder = vw >= 460 ? `Search ${TOTAL.toLocaleString()} cards` : "Search";
}
