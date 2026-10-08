// ---------- a frame that throws never freezes the screen ----------
// A frame clears its request before it draws, so one that throws part way (on a phone, in a case the tests don't
// reach) asks for no next frame: the screen stops on the half-drawn picture, mid-move. Every frame now runs guarded.
// One that throws resets the canvas (a clip or a save the throw left open goes with it), and the next frame comes as
// usual, so a move carries on and lands. The first error of a visit is named in the top bar, so a screenshot says
// what happened.
let frameErrs = 0, frameErrSeen = false, testFaultArmed = "";
function safeFrame(now) {
  try { frame(now); frameErrs = 0; }
  catch (e) {
    raf = 0; frameErrs++;
    canvas.width = canvas.width; curFont = ""; // a fresh context: no clip, no saved state, the same size
    console.error(e);
    window.__frameError = `${String(e?.message || e)}${whereFrom(e?.stack) ? ` in ${whereFrom(e.stack)}` : ""}`;
    if (!frameErrSeen) { frameErrSeen = true; toast(`The screen hit a snag and carried on (${window.__frameError}). A screenshot of this helps.`); }
    if (frameErrs < 30) kick(); // the next frame as usual
    else setTimeout(kick, 250); // a fault on every frame: keep trying, four times a second, so the screen comes back when it clears
  }
}
// The first two of our own functions in a stack ("drawTile < drawWall"), as Safari and Chrome both write them.
function whereFrom(stack) {
  const names = [];
  for (const l of String(stack || "").split("\n")) {
    const m = /^\s*at\s+(?:async\s+)?([\w$.<>]+)\s/.exec(l) || /^([\w$.]+)@/.exec(l); // Chrome: "  at fn (…)"; Safari: "fn@…"
    const n = m && m[1].split(".").pop();
    if (n && /^[\w$]+$/.test(n) && !/^(safeFrame|frame|noteBad|whereFrom|Error|anonymous|testFault)$/.test(n) && !/Gradient$|ColorStop$/.test(n)) names.push(n);
  }
  return names.slice(0, 2).join(" < ");
}
// Safari throws on a gradient at a position that isn't a number ("The provided value is non-finite"). Such a gradient
// is made at 0 instead, so the frame draws on, and the first function that asked for one is named in the top bar.
let badSeen = false;
function noteBad(what) {
  if (badSeen) return; badSeen = true;
  window.__badNumber = `${what} in ${whereFrom(new Error().stack) || "?"}`;
  console.error(`non-finite ${window.__badNumber}`);
  setTimeout(() => toast(`Drew past a bad number (${window.__badNumber}). A screenshot of this helps.`), 0);
}
for (const m of ["createLinearGradient", "createRadialGradient"]) {
  const orig = CanvasRenderingContext2D.prototype[m];
  CanvasRenderingContext2D.prototype[m] = function (...a) {
    if (a.every(Number.isFinite)) return orig.apply(this, a);
    noteBad(m); return orig.apply(this, a.map((v) => (Number.isFinite(v) ? v : 0)));
  };
}
{
  const orig = CanvasGradient.prototype.addColorStop;
  CanvasGradient.prototype.addColorStop = function (o, c) { if (Number.isFinite(o)) return orig.call(this, o, c); noteBad("addColorStop"); };
}
function kick() {
  welcomeSync(); // the welcome sheet follows every change on the wall
  if (raf) return;
  raf = requestAnimationFrame(safeFrame);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; safeFrame(performance.now()); } }, 120);
}
// Debug builds only: the tests arm a single fault inside a drawing step and check the screen carries on.
function testFault(where) {
  if (testFaultArmed !== where) return;
  testFaultArmed = "";
  if (where === "nan") ctx.createLinearGradient(NaN, 0, 10, 10); // a gradient at a bad number, as Safari met one
  else throw new Error(`test fault in ${where}`);
}
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { armFault: { value: (w) => { testFaultArmed = w; } } }); }, 0);
