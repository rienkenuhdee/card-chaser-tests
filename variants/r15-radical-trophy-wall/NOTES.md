# r15-radical-trophy-wall

**Round:** 15. Finishing a chase: what happens when the last card lands, and how does a set or chase show how far along it is before then?
**Concept:** Finished things leave the wall and become trophies. When the last card of a set or a chase lands, the panel is minted: its tiles gather into a gold plaque that flies up onto a shelf along the top of the mosaic (name, finished date, what it's worth, its cards engraved as a strip of colour) and the rest of the wall flows into the space; the wall only holds unfinished work, and every panel's title carries a ring gauge so you can read how close each thing is before then.

## What changed
- Added `81-trophy.js` (after the welcome, so its redefinitions win over 80-welcome's). It redefines, by hoisting:
  - `layoutAll`, `mosaicLayout`, `liftedLayout`: the shelf (`shelfLayout`) reserves height at the top in every lens, done groups are laid out as plaques (newest first, two across on a phone, four on a wide screen, a short last row stretched) and left out of the treemap, the fold and the lift. Their cards' `c.m` are slots in the plaque's engraving, so the morph, the open transition and the search rings all work unchanged. No shelf under price bands (the groups are bands there; the cards fly into the bands and back).
  - `binderLayout`, `hit`, `drawSet`, `drawHeader`, `drawHdrBtn`, `tap`: the sealed album. A finished group's binder packs its cards edge to edge (no gap, the binder's width shrinks so the cards grow), the header reads "Finished Oct 6, worth $743.50." with a full gold bar and one button, Back to the wall; a finished group kept on the wall gets Put on the shelf instead (in place of Chase these on a set, beside Remove chase on a chase).
  - `drawPanel`: a plaque for done or minting groups (`drawPlaque`: a gold plate with a bevel, the board it sits on, the engraving from a cached offscreen strip per plaque, a gleam when it lands); otherwise the usual panel plus the ring gauge at the right of the title (owned over total; gold when something in it is chased or it's complete; hidden while picking sets).
  - `setOwned` (also fixes a base bug: `g.burst` referenced an undefined `g` when a set completed), `markAllInSet`, `finishImport`, `chasesChanged`, `drawList`: completion is checked once per change (`syncDone`), never per frame; trades with `quietLayout` defer the check to the next `drawList`. `applyDone` decides the flight: on the mosaic a two-beat `mintFlight` (gather in place, 1 s; then `shelfMorph`, 1.3 s, the wall scrolling to the top under it); inside the binder `sealInPlace` (the cards slide tight with the shuffle flight, the header gleams); in the list, under the table, or while fingers hold a transition, a quiet relayout. A card taken out of a finished group (Undo, Mark, the list, a trade) frees it: the plaque fades into a panel as the tiles fly back.
  - `readTheme`, `setChrome`, `drawPicks`, the reset handler (clears `wall-done`).
- Persisted in `wall-done` as `{ key: { at, put } }`; a set is keyed with its view (`base1|set`, `base1|master`), so the master set is its own trophy and switching views doesn't lose the plain set's finish.
- The list view gets a Finished section (each trophy with its date, worth, Back to the wall, and its cards); finished groups kept on the wall say so in their line.
- `styles.css`: plaque colours as CSS variables for light and dark; the toast and the deal bar sit under the shelf while it shows (`--shelf-h`); the Finished section.
- Toasts: "Every Charizard finished. It's on the shelf, worth $743.50." (Undo takes the card back out and the plaque comes down), "Base Set is back on the wall.", "Clefairy taken out. Base Set is back on the wall."

## Try this first on the phone
1. Import, open "Every Charizard" at the end of the wall, Mark, All, Done: the album seals (cards slide tight, "Finished today, worth $743.50"). Tap Back and watch it close into a gold plaque on a shelf above the sets. Tap the plaque, then Back to the wall; open it again and Put on the shelf to see the minting flight (the tiles gather into a plaque, it flies up, the wall flows in). Then do Base Set the same way: it takes "Popular in Base Set" with it.

## Gesture contract
All checks pass (`npm test -- --variant r15-radical-trophy-wall`). On a fresh wall nothing is finished, so there is no shelf and the layout is the base's. With three trophies on the shelf (scenario run): a slow small spread on a plaque stays home, a big spread opens its album, Back closes it onto the plaque, the mosaic scrolls.

## Frame budget
`npm run test:perf -- --variant r15-radical-trophy-wall`: mosaic 16.7 ms per frame, held pinch 16.7 ms per frame (fresh wall). With three plaques on the shelf (measured in the scenario script): mosaic 16.7 ms, held pinch 16.7 ms. Per frame the shelf costs one `drawImage` per plaque and the ring arcs; the completion check runs only when a card changes.

## Unsure about
- Is a finished set gone from the wall too final? The Need lens no longer shows it (nothing to need), and a finished set's spares don't show under Trade until you open the album. Back to the wall is one tap, but maybe a trophy should keep a hairline on the wall like a folded set.
- The shelf is at the top of the mosaic and scrolls with it; minting scrolls the wall to the top so you see the plaque land. A fixed shelf under the search bar would always be in view but cost height on every screen.
- "Popular in Base Set" finishes with Base Set, so one finish mints two plaques (a sub-chase of a set is complete when the set is). Should a chase that is a subset of a finished set fold into the set's plaque instead?
- Plaques are two across on a phone and stretch to the row; one trophy is a full-width bar. On a wide screen a 700 px plaque with a three-card engraving looks sparse; a capped width with space to the right might read better as "a shelf with room".
- The toast moves under the shelf while it shows (the shelf is where the toast lives). It jumps, not slides.
- With the Value filter the heat-coloured tiles draw over the plaque's type-coloured engraving; with Time the engraving fills in as the slider moves. Both are free and arguably right, but the plaque could also just stay engraved.
- The import's completions are quiet (a chase you already have every card of goes straight to the shelf under the flood), and a new chase that's already complete is minted as it's made with the base's "You have them all." toast; it could say "It's on the shelf."
