# r20-bold-wall-tour

**Round:** 20. The import's reveal: what should the first minute after your collection arrives show you?
**Concept:** The import floods in set by set as before, and when it settles the wall gives you a short tour of
itself: the camera glides through a few composed stops (the whole wall, the set closest to done with its gaps lit, the
trade binder's cover with its first page lifting, the trophy room's door, home), each held about two seconds under one
plain caption, like a photo app's memories. A tap on the caption goes there for real, any other touch ends the tour on
the spot, and the tour replaces the import's toast and its trophy card with one summary line at the end.

## What changed
- Added `90-tour.js` (no part replaced or removed):
  - The tour itself: a caption bar where the lens bar sits (segments along its top, one per stop, filling while it
    holds; the action word in gold; Skip), the stops, the glide between them, and the light drawn on each stop.
  - Stops, each a view the wall already has: (1) the mosaic at the top, "541 cards, worth $5,341.35"; (2) the set
    with the fewest cards to go opened with the usual tap transition, then the binder scrolled to frame its missing
    pockets, which stay bright with a gold edge while the cards you have step back ("Fossil: 5 to go"); (3) the Trade
    lens (its usual lens flight), its binder cover in a spotlight with the first page lifting off the stack ("101
    spares, 27 wanted"); (4) the Complete Dex panel, only if it is on the wall; (5) the trophy room door at the end of
    the wall, with its row of rarest medals ("30 trophies", the two rarest named); (6) home, the top of the wall in Have,
    with the summary "541 cards · 101 spares · 30 trophies". Stops with nothing to show are skipped.
  - Caption actions: the set stop keeps you in the set, the binder stop opens the trade binder, the trophy stop opens
    the room, the Dex stop opens the Dex. Skip, Escape, a touch, the wheel or any key outside the caption ends the tour
    exactly where the wall is (nothing is put back), with the summary as a toast if the tour hadn't said it yet.
  - Redefined `finishImport` (the same flood, minus the toast; it schedules the tour for when the last set lands),
    `mdAnnounce` (the import's trophies are counted into the tour rather than shown as the "Your collection arrived"
    card), and `drawTraders` (same body, then the tour's light, because the cover and traders are the last things the
    frame draws).
- `styles.css`: the caption bar; the lens bar steps back while the tour runs (the top strip stays).

## Try this first on the phone
1. Settings, Reset the demo, then Import from TCGplayer. Watch the flood, then let the tour run all the way through.
2. Do it again and touch the wall in the middle of the Fossil stop: the tour stops there and your drag scrolls the binder.
3. Do it again and tap the caption on the trade binder stop: the binder opens.

## Gesture contract
All checks pass. None of the contract's scenarios run an import, so the tour never starts in them. The tour's own
checks were run as a scratch script (not added to `tests/`): a drag during the flood cancels the tour before it starts
and scrolls, with the summary toast counting the trophies and no trophy card after; a drag in the set stop ends the
tour and scrolls the binder, and nothing moves afterwards; a quick pinch while the set is opening ends the tour and
lands on a composed view; the caption opens the binder and the room; Skip, Escape and a lens tap end it.

## Frame budget
`npm run test:perf -- --variant r20-bold-wall-tour`: mosaic 16.7 ms, held pinch 18.9 to 30.0 ms across four runs (the base
measured 22.2 ms in the same session). The tour draws nothing unless it is running, and while it runs it only adds a
scrim path and, on the binder stop, one small copy of the cover's page.

## Unsure about
- Length: with lens flights and the set's open and close between stops it runs about 15 seconds. Each stop holds
  2.3 s; the lens morphs (1.3 s) make the binder and trophy legs the slowest.
- The lens bar hides during the tour so the caption can take its place (and the door at the very end of the wall can
  sit above it). The top strip stays, so the set stop shows Back and Mark as it really would.
- "Stay here" on the set stop: the set is already open, so the caption's action is just to keep you in it. Entering
  Mark instead might be the more useful jump.
- The Complete Dex stop is real but the demo can't reach it after an import (the welcome only offers the Dex on the
  manual path); it was checked by adding the Dex before importing.
- The captions count spare copies (101) where the cover counts cards with a spare (68); both are true, side by side
  they may read as a mismatch.
