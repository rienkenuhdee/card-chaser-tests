# r17-safe-copies

**Round:** 17. Your spares: how do your doubles get onto the wall, and how does a spare find someone who wants it?
**Concept:** Copies, the way every inventory app does it: every card you own has a count, and each copy past the first is a spare unless you choose Keep both. The import brings realistic doubles (seeded, mostly commons and uncommons), so the Trade lens is full from the first open. Each spare says who wants it, in plain words, one tap from the table.

## What changed
- Added `82-copies.js` and `styles.css`. Nothing replaced or removed.
- **Counts:** `copies` in a new key, `wall-copies` (`{ id: { n, got, keep } }`). A count belongs to the copy you got at `got`, so if you take a card out and add it back, it starts again at 1. The base `spares` map becomes a Proxy computed from the counts. That means the const `isSpare`, `wantsOf`, `wantedBy`, the Trade lift, the table, the replies and counters all follow the counts without being touched. The Proxy writes `wall-spares` as the counts see it. Old Spare flags become a second copy the first time this build runs.
- **Import:** `finishImport` redefined. It gives seeded doubles by tier: commons 20%, uncommons 15%, rares 6%, holos 3%, rarer less. Commons and uncommons sometimes come in threes or fours. Keys are `${id}|copies`, with the id first, because keys that differ only in their last character hash alike. The demo import gives 68 cards with spares (102 copies), and 27 of them are wanted. The toast says "751 cards imported from TCGplayer, 68 with spare copies."
- **Card panel:** `updateFlag` redefined. On a card you own, a stepper ("−  You have 2  +") takes Chase it's place, beside In your collection. A line under the buttons reads "1 spare, up for trade. Wanted by Maya and Theo." with **Trade with Maya** and **Keep both** (or "Keeping both, not up for trade." with **Trade the extra**). A single copy someone wants says "Priya wants this. Got a double? Tap +." Trade with Maya uses `tradeWith`: it leaves the set, switches to the Trade lens and asks In person or Online, the same path a chip tap takes. − stops at 1, because taking the card out is In your collection's job.
- **On the wall:** close up, a gold "×2" pill sits at the top left of the card face (white if you're keeping them all). Far out in the mosaic, a second card peeks from behind the tile: muted in Have, gold in Trade. This draws only in Have and Trade, never during a transition, as an overlay pass from a redefined `drawPicks`. It uses one font and caches its widths.
- **Spare tile (Trade lens):** `drawSpareTile` redefined. The count is on the mini card, and "Wanted by / Maya, Theo" (or "No takers yet") sits beside it.
- **Mark:** `onDown`, `paintTo`, `tally`, `updateBar`, `leaveMark` and Undo redefined. In Mark, holding a card you have adds a copy. Keep the finger down and sweep along the row, and each owned card you cross gets one more. The bar counts "3 extra copies", and Undo or the summary toast puts the counts back. Holding a card you don't have still chases it.
- **Trades take one copy:** `completeTrade`, `crossOnWall` and `finishCross` redefined. A card with more than one copy loses one and stays on the wall. In the wall crossing, a copy flies out and the tile stays. The toast adds "You still have Shellder." Getting a card you already own adds a copy.
- **Empty Trade lens:** `setLens` redefined, with the toast now "102 spares to trade, 27 of them wanted" or "No spares yet". With no spares, a gold bar above the lenses says "No spares yet. 24 cards you likely have two of" with Review. Review opens a ticked list of likely doubles (seeded commons and uncommons you own, the ones someone wants first, with who wants them) and **Add 24 spares**, which has Undo. The list view has the same thing as **Check likely doubles**.
- **List:** `drawList` redefined. Rows say "Have 2, 1 spare, Priya wants it", "Have 3, keeping all" or "Have it".
- **Settings and About:** Reset the demo now also clears `wall-copies`, through a reassigned handler. The About line about Spare now describes +.

## Try this first on the phone
1. Reset the demo, then import. Tap **Trade**: spares are already out in front, each with ×2 or ×3 on the card and who wants it.
2. Open Base Set and tap a card with a gold ×2. Read the line under the buttons, try **Keep both**, then **Trade with …**.
3. In a set, tap Mark, then hold a card you have and sweep along the row: each one gets a copy.
4. To see the empty state: on a fresh demo, mark a few commons by hand (or skip the import), then tap Trade and **Review**.

## Gesture contract
All checks pass. Navigation is unchanged. The hold in Mark adds a copy on owned cards instead of toggling Spare, which is still a hold followed by a sweep.

## Frame budget
`npm test -- --variant r17-safe-copies` runs on an empty wall: mosaic 16.7 ms, held pinch 17.8 ms.
After an import (scratch run, software canvas):

| Lens | Base mosaic | Base held pinch | This build, mosaic | This build, held pinch |
| --- | --- | --- | --- | --- |
| Have | 16.7 to 18 ms | 21 ms | 16.7 ms | 20 to 22 ms |
| Trade | 16.7 to 18 ms | 21 ms | 18 to 24 ms | 28 to 29 ms |

In the Trade lens, the cost is the 68 lifted spare tiles, which the base never draws after an import because it has no spares. The overlay pass and the Proxy reads measure at about 0.25 ms. The Trade lens held pinch is under the 34 ms budget but has the least headroom.

## Unsure about
- Whether 68 cards with spares is the right density. It reads as real, but the Trade lens is now a long feed, and most of it is "No takers yet".
- "Likely doubles" is a seeded guess presented as a review. It's honest in the copy ("Untick any you only have one of"), but a real import would know the counts, so the review only matters for collectors who mark by hand.
- The Mark bar has no button for "these are doubles". Hold and sweep covers many at once without a new mode, but nothing shows it except the bar's hint ("Hold one you have to add a copy").
- The stepper doesn't go below 1, so taking the card out stays with In your collection. An inventory app would usually let − reach 0.
- Trades in the table show "Your spares" without counts.
