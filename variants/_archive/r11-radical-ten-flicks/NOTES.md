# r11-radical-ten-flicks

**Round:** 11, the first 30 seconds: onboarding before anything is marked.
**Concept:** The first screen is one card alone in an empty field, with "Import from TCGplayer or Collectr" first and, under an "or", the ten flicks: "Got this one?" over Base Set Charizard, flick up for yes, down for no, sideways to chase it, and the next of ten well-known cards (one per set, old and new by turns) deals in from behind. After the tenth, or Skip, the wall assembles itself from nothing: every panel grows from a point, the cards you said yes to fly in from where they left, the ones you're chasing land wearing gold tags, and one toast says what to try next. The import (simulated) pours the seeded 541 cards up from the bottom into the same assembly.

## What changed
- `80-flicks.js` (added): the shared rule (nothing seeded: every card unowned, `chase0` and `spare0` false, only your marks persist); the opening markup (question, answers, count, Skip, Undo, the import-or-flicks choice) and the import sheet, built from JS so `index.html` is untouched; the stack, the deck card, the labels and the flick on the canvas; the assembly (`deckFinish`, the morph flight from an empty field); the simulated import (`seeded()` recomputes ownership exactly as `10-model.js` does from `OWN_RATE` and `h32`, so it's the same 541 in every variant); the list view's "Start your wall" section (import first, then the ten as rows with Got it / Chase it / Not yet, answerable in any order); `wall-flicked` persisted; Reset the demo clears it.
  Redefined: `drawMosaic` (draws the opening while it's up and nothing is in flight), `hit` and `enterGroup` (no panel is reachable under the opening), `drawTile` (chased cards keep their gold ring for a few seconds after landing, in any lens), `setT`, `playTime`, `drawSpark` (Time no longer starts at `Infinity` when nothing is owned at load), the reset button handler.
- `99-start.js` (replaced): a first visit starts the opening instead of the ink-in; later visits ink in as today. The caption is gone for good (hidden in CSS, the element stays for `hideCaption`).
- `styles.css`: the opening's typography and layout, chrome hidden while the opening is up (opacity only, so every button is still there), the import sheet, the list rows.

## Try this first on the phone
1. Tap "Flick through ten cards" (or just grab the stack). Flick Charizard up. Flick Mew ex sideways (it leaves with a gold "Chasing" tag). Flick Snorlax down. Then tap "Skip the rest" and watch the wall assemble: the panels bloom from points, Charizard flies down from the top into Base Set, Mew ex comes in from the right wearing its ring into 151.
2. Settings, Reset the demo, then tap "Import from TCGplayer or Collectr", pick one, and watch 541 cards pour up from the bottom into their panels.

## Gesture contract
All checks pass (both DPRs). The first touch on the canvas: a one-finger drag or tap on the opening is a flick (that is the whole point), but a two-finger touch anywhere, or a reach for any chrome button (lenses, the chase menu, filters, search), skips the rest and lands on the wall, so the tests' first pinch steps past the opening (the assembly plays under the fingers) and every pinch after that lands on the composed views. Settings and About don't skip it (they're dialogs), so the list view can be reached first.

## Frame budget
`npm run test:perf -- --variant r11-radical-ten-flicks`: mosaic 16.7ms per frame, held pinch 16.7 to 20ms per frame (software canvas). The perf test's "mosaic" number is measured with the opening up (one card face with foil and a stack), so I also measured the real mosaic after the flicks and after the import: 16.7ms, the same as the base. During the opening there's one foil face at most: the dealing-in card and the one flying off draw without foil.

## Unsure about
- Ten flicks before the wall is a real ask. The import is first and "Skip the rest" is always under the card, but the count may still read as homework. Fewer (five?) would make the assembly feel more like a reward than a reward for finishing.
- The gold tag on chased cards after landing lasts about seven seconds in any lens, then fades; the Need lens keeps it as today. Long enough to find them, or a mystery ring?
- The assembly's first 300ms are nearly empty (points, then the bloom). It reads as a beat before the bang on the screenshots; on a phone it may read as a stall.
- A two-finger touch on the opening skips it. Reasonable (a pinch means "show me the wall") or surprising?
- The import sheet stands in for a real file picker; the copy says so. "541 cards imported from Collectr" lands at the end of the pour rather than the start, so the toast doesn't cover the first row while the cards are landing.
