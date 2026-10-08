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
    window.__frameError = String(e?.message || e);
    if (!frameErrSeen) { frameErrSeen = true; toast(`The screen hit a snag and carried on (${window.__frameError}). A screenshot of this helps.`); }
    if (frameErrs < 30) kick(); // the next frame as usual; a fault on every frame stops asking after half a second
  }
}
function kick() {
  welcomeSync(); // the welcome sheet follows every change on the wall
  if (raf) return;
  raf = requestAnimationFrame(safeFrame);
  clearTimeout(watchdog);
  watchdog = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); raf = 0; safeFrame(performance.now()); } }, 120);
}
// Debug builds only: the tests arm a single fault inside a drawing step and check the screen carries on.
function testFault(where) { if (testFaultArmed === where) { testFaultArmed = ""; throw new Error(`test fault in ${where}`); } }
setTimeout(() => { if (window.__w) Object.defineProperties(window.__w, { armFault: { value: (w) => { testFaultArmed = w; } } }); }, 0);
