# r11-safe-welcome

**Round:** 11. The first 30 seconds: onboarding before anything is marked.
**Concept:** A first-run sheet over the wall, like an app's welcome: import from TCGplayer or Collectr first (pretend, a second of looking, then the 541 seeded cards flood in set by set), or go by hand through three steps with three dots: pick the sets you collect (tap a panel to tick it, the rest fold back), mark a few you have (the first picked set opens in Mark mode, the count ticks up), chase one (press and hold). The sheet sits along the bottom in glass and the wall under it keeps working; after it goes, the lens bar rises with one toast, and the wall remembers.

## What changed
- Added `80-welcome.js` and `styles.css`. Nothing replaced or removed; the sheet and a "Choose your sets" button in Settings are created from the part.
- Shared rule: every card starts unowned, `chase0` and `spare0` are false, deals stay. Only your own marks (`wall-owned`) persist. Reset the demo also clears `wall-welcomed`, `wall-imported`, `wall-sets`, `wall-lens`, `wall-mode` and `wall-value`, so it returns to the fresh opening.
- The opening (`wall-welcomed` unset): `body.welcoming` hides the lens bar and the mark bar (in place, faded, so they rise when the sheet goes), the caption never shows, and the sheet comes up after the ink-in.
  - Step 0: "Welcome to your wall", **Import from TCGplayer or Collectr** (primary), "or", **Pick your sets and mark by hand**. Import asks which source, shows "Looking for your collection" with a one-second progress line, then computes the seeded ownership the way `10-model.js` does (`OWN_RATE`, `h32`, the same "got" dates), saves it as your marks, floods the cards into the wall with the marking flood a beat apart per set, and ends the welcome with the one toast "541 cards imported from Collectr."
  - Step 1: panels become pickable (`tap` redefined: in step 1 a tap on a panel ticks it; `panelStat` gives the count's place to the tick; `drawMosaic` sits unpicked panels back once one is ticked; `drawMarks` redefined to draw the ticks after the base marks). Continue persists `wall-sets`, flies the unpicked sets to folded lines (`mosaicLayout` redefined: picked sets share the top of the screen, the rest fold to 50px lines beneath, as the Chase lens folds), then opens the first picked set and enters Mark mode.
  - Step 2: the sheet is the mark bar: "Tap a card you have, or drag across a row", the count ticks up (`kick` redefined to run `welcomeSync`, which only touches the DOM when its key changes). Reached by your own navigation instead (a pinch opened a set during steps 0 or 1), Mark mode isn't forced and the line says "Press and hold a card you have, then sweep along the row", which is the base way in.
  - Step 3: "Press and hold a card you don't have to put it on your chase list" (Mark mode is ensured, since a hold outside it marks the card as yours); after the first chase the line points at the Chase lens and the button reads Done. Done closes the set back into the mosaic, the lens bar rises, one toast: "Have, Need, Chase and Trade recolor the wall. Tap a set to open it."
  - Skip is always there (Cancel when re-choosing sets). The sheet steps aside while a card is up close, while offers or the keypad are open, on the trade table, with Time on, and in the list view, and comes back after.
- Settings gets **Choose your sets**, which runs step 1 alone (Done re-folds the wall; no picks unfolds it).

## Try this first on the phone
1. Tap **Import from TCGplayer or Collectr**, pick Collectr, and watch the wall fill in set by set as the toast lands. Then Settings, Reset the demo, and take the other door: tap two or three sets to tick them, Continue, sweep a finger along a row of Base Set, Continue, hold a card you don't have, Done.
2. Ignore the sheet and pinch a set open instead: the sheet follows you to "Mark a few you have" and the hold-then-sweep still works.
3. After the welcome: Settings, Choose your sets, change the ticks, Done; the wall flies to its new shape.

## Gesture contract
All checks pass (dpr 1 and 2). The tests run inside the opening: a pinch or tap on the canvas lands on the composed views as before, and a set opening during steps 0 or 1 moves the sheet to step 2 without forcing Mark mode, so the sideways flick still slides between sets. The one deliberate difference, outside the tests: in step 1 a tap on a panel ticks it rather than opening the set (a spread still opens it).

## Frame budget
`npm run test:perf -- --variant r11-safe-welcome`: mosaic 16.7ms, held pinch 16.7ms (budget 34ms), measured inside the opening. `welcomeSync` runs on every `kick` but compares a key string and returns.

## Unsure about
- Should the folded "other sets" stay folded after the welcome? It gives a new collector a focused wall, and Choose your sets undoes it, but it is a persistent layout that didn't exist before.
- After an import the sheet ends at once (no pick-sets or chase steps). The chase step could still follow an import; I left it out to land on the wall as the brief said.
- Step 2 has no Undo in the sheet (a tap toggles a card back); the mark bar's Undo is hidden while the sheet is up.
- In step 1 a tap ticks rather than opens, which is the one place the wall's tap means something else. A spread still opens, and the sheet follows.
- The import copy says "The import is pretend in this demo"; drop that line in the real app.
