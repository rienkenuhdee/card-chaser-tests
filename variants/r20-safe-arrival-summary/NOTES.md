# r20-safe-arrival-summary

**Round:** 20. The import's reveal: what should the first minute after your collection arrives show you?
**Concept:** An "Import complete" summary, like a photo library's import or a bank's first sync. The collection floods in
with nothing else on screen, then one sheet over the dimmed wall: "541 cards from TCGplayer", what it's worth, and a few
rows that are each a door into the wall. One button, See your wall, and it never comes back.

## What changed
- Added `90-arrival.js` (and `styles.css`). No base part replaced or removed.
- Redefined `finishImport`: same import, but no toast. The lens bar stays down during the flood (`body.arriving`), and
  the summary comes up 380 ms after the last set lands (worked out from the flood's own timings; 450 ms with reduced
  motion).
- Redefined `mdAnnounce`: medals the import earns go into the summary instead of the celebration card.
  `mdCelebrateSoon` holds any other card until the sheet has gone. Both work as before for everything else.
- The rows, each shown only when it has something to say (five at most, fits a 390×844 phone without scrolling):
  - **Finished by the import**: the plaque drawn small (its engraving in the cards' colours). Tap opens its album.
  - **Closest to done**: "Fossil, 5 to go", the set's own tiles drawn small, plus the next set. Tap opens the set.
  - **Trophies**: "30 trophies earned", the rarest three medals, any Shiny or Critical called out. Tap opens the trophy room.
  - **Spares**: "68 cards with spares, 27 wanted", three cards from the binder's first page. Tap opens the trade binder.
  - **The Dex** when it's on the wall: "240 of 1,025 Pokémon. Your sets can fill 210 more." Tap opens the Dex.
- The headline line adds "N more on your chase list" if you ticked Chase every card I'm missing.
- The import screen now has the Dex box too ("Also chase the complete Dex"). It's the box the by-hand path already
  has. Without it the Dex row could never show on a first import.
- Escape, a tap on the dimmed wall, or See your wall closes it. Focus starts on See your wall. List view, dark mode and
  reduced motion (no slide, no row stagger) all work.

## Try this first on the phone
1. Settings › Reset the demo, then Import › TCGplayer. Watch the flood, read the sheet, then tap "Fossil, 5 to go".
2. Do it again with "Also chase the complete Dex" ticked, and try the trophies row (into the room) and the spares row
   (into the binder).

## Gesture contract
All checks pass. Smoke and perf pass too. I also checked by script that each row lands where it says: Fossil open, the
room, the binder in the Trade lens, the Dex open, and a finished set's sealed album (with Base Set and Fossil forced
complete). Escape and See your wall leave the plain wall with the lens bar up and no celebration card.

## Frame budget
`npm run test:perf -- --variant r20-safe-arrival-summary`: mosaic 16.7–17.8 ms, held pinch 23.3–28.9 ms (three runs),
under 34. The sheet is DOM and its small mosaics are drawn once into 46 px canvases, so nothing is added per frame.

## Unsure about
- The wait: the sheet comes up about 2.5 s after the flood starts. That's long enough to watch the wall fill, but it
  may feel like a pause before the payoff.
- The demo import finishes no set, so the plaque row only shows when something really completes. I tested it by
  forcing two sets complete.
- Worth counts every copy at market (spares included), so it's a bit above the sum of the panels' "worth" lines.
- The trophies row opens the room rather than one medal. With 30 at once the room's Showcase reads better, but a single
  Critical might deserve its own sheet.
- The Dex box on the import screen goes a little past the brief.
