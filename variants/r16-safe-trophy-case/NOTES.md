# r16-safe-trophy-case

**Round:** 16. Trophies: where do they live after their day on the shelf, and what can a trophy do?
**Concept:** The case at the end of the wall becomes a proper trophy case, the familiar shelf-in-a-cabinet: a header row with the count and what they're worth together and a sort (Newest, Most valuable, A to Z), plaques that say what they are in plain words, and a set's family (the set, its master set, its grand set, the chases inside it) stacked under one head with the kids inset. A trophy can be shared: the sealed album gets Share beside Back to the wall, which draws a trophy card to a PNG and hands it to the share sheet, or saves it.

## What changed
- Added `82-case.js` (after 81, so its redefinitions win). Redefined by hoisting:
  - `caseLayout`: the header row (44px), then columns of plaques (two on a phone, four wide), each family going into the shortest column in sorted order. Case plaques are 86px (three lines); the shelf at the top keeps the base's 72px plaques and the minting flight. Sort, totals, families and the sort control's rects are computed here (in `layoutAll`, when `done` changes or the layout does) and cached in `caseInfo`, never per frame.
  - `drawCaseLabel`: "Trophies · 5 · $13k" and the sort control (long labels when they fit beside the count, short ones when they don't). `drawPlaque`: a third line on tall plaques ("The set, 102 cards", "Every printing, 306 cards", "6 cards across 3 sets", "6 cards in Base Set"), the board under a family drawn once at the head's width. `drawMosaic`: also draws the ghost plaques (below).
  - `albumHeader`, `drawPopRow`, `drawHdrBtn`, `tap`: the sealed album keeps the Set / Master set / Grand set switch (so a master set can be finished after the set, and the set's plaque stays in the case while you work on it) and gains Share; a tap on the sort control re-sorts with the base's `shelfMorph` flight (plaques fly to their new places), a tap on a ghost plaque opens it.
  - `trophyListHTML`: the list's Trophies section mirrors the sort (three buttons) and the families (kids indented), with Share and Back to the wall per trophy.
- Ghost plaques: a set has one binder, so only the view you're in is a group on the wall. A finished view you aren't in (`done["base1|set"]` while the set is in its master view) is drawn as a plaque from the done record and the set's cards for that view; tapping it switches the set to that view and opens the sealed album. A ghost whose cards are no longer all owned is dropped from `done` quietly.
- Share: `trophyCard(t)` draws the plaque at 2× (1200×600) on an offscreen canvas (name, what it is, finished date, worth, the engraving, "Card Chaser") in the current theme; `shareTrophy` hands it to `navigator.share` as a file when `canShare` allows, else triggers a download. Toasts: "Trophy card shared." / "Trophy card saved as a picture."; closing the sheet says nothing.
- `wall-trophy-sort` holds the sort; Reset the demo clears it. The debug hook adds `caseInfo`, `caseGhosts`, `caseSort`, `setCaseSort`, `trophyCard`, `shareTrophy`.
- `styles.css`: the list's sort row, the indented kids, the button pair.

## Try this first on the phone
1. With a few trophies in the case (finish Jungle, Base Set, and Every Charizard via Mark → All → Done; age them with `__w.done[key].at -= 86400e3 + 1000; __w.layoutAll()` or wait a day), scroll to the end of the wall: the header counts them and totals them, tap "Most valuable" and watch the plaques fly into their new order. Then tap the Base Set plaque, tap "Master set" in its album: the album loosens with the printings missing while the Base Set plaque stays in the case; finish the printings and "Base Set master set" lands tucked under Base Set, with "Popular in Base Set" under both. Tap Share in any album.

## Gesture contract
All checks pass (`npm test -- --variant r16-safe-trophy-case`). A fresh wall has no trophies, so the layout and every gesture are the base's. With six trophies (a scenario script: the shelf, a three-plaque family, two singles, a ghost): tapping the sort control sorts, tapping a ghost plaque opens the sealed album in that view, Share without a share sheet saves a picture and says so, every lens and filter renders, the list mirrors the families and the sort.

## Frame budget
`npm run test:perf -- --variant r16-safe-trophy-case`: mosaic 16.7ms per frame, held pinch 18.9–23.3ms per frame (fresh wall; the base varies the same way run to run). With six trophies and the case on screen: 16.7–20.0ms, held pinch 17.8–21.1ms. Per frame the case costs one `drawImage` and three `fillText` per plaque plus the header; sorting, totals, families and ghosts are computed in layout.

## Unsure about
- Ghost plaques only ever sit in the case, never on the shelf at the top, even on their first day: the shelf's minting flight counts real groups. Switching a set's view the day it was finished moves its plaque from the shelf to the case at once.
- The header total is `short()` ("$13k") so the three long sort labels fit on a 390px phone; the list has the exact figure. The brief's "$2,140" (whole dollars) would need a third price format.
- "A card counts once" in the totals: a chase's twins collapse into their cards, a printing counts as its own card, so Base Set plus its master set don't double count the base cards.
- iOS: `navigator.share` with a file runs after an `await` on `toBlob`; Safari's user-activation window should cover it, but it wasn't tried on a device. If the sheet refuses, the download fallback runs.
- A set's chases ("Popular in Base Set", "Full art in 151") fold under the set's plaque only when the set is a trophy; otherwise they stand alone. The ordering inside a family is set, master, grand, then the chases by the current sort.
- Sorting by A to Z puts a family under its head's name, so "Popular in Base Set" doesn't appear under P.
