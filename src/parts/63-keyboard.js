// ---------- keyboard ----------
canvas.addEventListener("keydown", (e) => {
  const k = e.key;
  if (state.focus && (k === "ArrowRight" || k === "ArrowLeft")) { e.preventDefault(); return step(k === "ArrowRight" ? 1 : -1); }
  if (k === "Escape" || k === "Backspace") { e.preventDefault(); if (state.focus) return unfocus(); if (view === "mosaic") return toMap(); return exitToMosaic(); } // the wall's own level: up to the map
  if (view === "mosaic") {
    const i = groups.indexOf(state.kb || groups[0]);
    if (k === "ArrowRight" || k === "ArrowDown") { state.kb = groups[Math.min(groups.length - 1, i + 1)]; toast(state.kb.name); }
    else if (k === "ArrowLeft" || k === "ArrowUp") { state.kb = groups[Math.max(0, i - 1)]; toast(state.kb.name); }
    if (state.kb?.m) { mScroll = clamp(state.kb.m.y - topPad() - 10, 0, mMax); kick(); }
    else if (k === "Enter") enterGroup(state.kb || groups[0]);
    else return;
    e.preventDefault(); return;
  }
  const pan = 90 / cam.s;
  if (k === "ArrowRight") { if (cam.s <= fitCam(state.g).s * 1.02) slideGroup(1); else cam.x += pan; }
  else if (k === "ArrowLeft") { if (cam.s <= fitCam(state.g).s * 1.02) slideGroup(-1); else cam.x -= pan; }
  else if (k === "ArrowDown") cam.y += pan; else if (k === "ArrowUp") cam.y -= pan;
  else if (k === "+" || k === "=") { const s = Math.min(maxS(), cam.s * 1.4), w = toWorld(vw / 2, vh / 2); cam.s = s; cam.x = w.x - vw / 2 / s; cam.y = w.y - vh / 2 / s; }
  else if (k === "-") { const f = fitCam(state.g).s; if (cam.s / 1.4 < f * 0.9) return exitToMosaic(); const s = Math.max(f, cam.s / 1.4), w = toWorld(vw / 2, vh / 2); cam.s = s; cam.x = w.x - vw / 2 / s; cam.y = w.y - vh / 2 / s; }
  else if (k === "Enter") { const h = hit(vw / 2, vh / 2); if (h?.card) focus(h.card); return; }
  else return;
  e.preventDefault(); kick();
});
// "/" jumps to search, unless you're typing in a field (a shop's website has slashes in it).
addEventListener("keydown", (e) => { if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) { e.preventDefault(); qIn.focus(); } });
