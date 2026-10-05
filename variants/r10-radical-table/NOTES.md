# r10-radical-table

**Round:** 10. Trading: your spares meeting someone else's wants.
**Concept:** The Trade lens deals your spares out in front (the Chase lift, keyed on spares, each tile the card itself
with its price and who wants it) and puts a strip of traders along the top of the mosaic. Tap one and the screen becomes
a table between you: their spares along the top with the ones you chase lit green, yours along the bottom with the ones
they chase lit gold, and the table between; a card dragged (or tapped) from either side travels onto the table and stays
there, the strip keeps both totals and the balance, and Shake hands proposes the trade.

## What changed
- Added `75-table.js` and `styles.css`; nothing replaced or removed, `index.html` untouched (the trade bar is injected
  after the mark bar).
- Shared data per the round's rule (prefix keys): `TRADERS`, `tOwns`, `tSpare`, `tChase`. Per trader, `spares` and
  `chases` are precomputed once; `wantsOf(t)` is your spares they chase, `offersOf(t)` their spares you chase. Proposed
  trades live in `localStorage` `wall-trades` as `{t, give, get, at}`; Reset the demo clears them.
- The Trade lens lifts: redefined `layoutAll` (lifted for chase or trade, keyed), `orderGroup` (spares first, the ones
  more traders want first, then price), `liftLayout` (also morphs when switching Chase to Trade), `liftedLayout` (reserves
  the trader strip at the top of the mosaic, scrolling with it), `emphasis` (a card out on the table leaves its tile
  empty), `drawTile` (one change: a lifted card you own draws as the spare tile while it is wider than tall, so it grows
  into the card on its way to the table), `cardFace` (one change: no foil while anything on the table moves; the spare
  tile's mini card never foils, so the Trade lens does not animate at rest).
- The strip: every trader with a match on either side, most wants first, as chips with the initial, name, town and
  "Wants 10 of yours" in gold (or "Has 4 you chase" in green, or "Proposed: 1 for 2" once proposed). Two across on a
  phone, four on a wide screen. A tap opens the table; tapping a spare tile opens it with the first trader who wants it.
- The table is a composed level drawn on the canvas, not a modal: redefined `kick` to run `tableFrame`, which skips the
  base frame entirely once the table is fully up (one draw of two binders and the strip, no mosaic underneath), and
  draws the wall through the base frame while it opens or closes. Binders are two rows (three on a tall screen) that
  scroll sideways, lit cards in the first columns. Their binder is `cardFace` of cards they own; non-lit cards sit at
  half strength, lit ones wear a 2.5 px ring. A card that has gone to the table leaves a pocket reading "On the table".
- Flights: opening, your spares fly from their mosaic tiles into the bottom binder (the tile becomes the card as it
  goes) and the trader's cards deal out of their chip into the top binder, staggered; the chrome fades in with q.
  Closing reverses it. Tap or drop and the card travels to its slot (340 ms, a lifted shadow); the other cards on the
  table ease over to make room. Shake hands crosses the two sides over (520 ms), then everything flies home.
- Input while the table is up: capture-phase listeners on `document` claim touch, mouse and wheel events that start on
  the canvas (fingers read from `e.touches`, no pointer map). In a binder a sideways drag scrolls it with inertia; a
  pull toward the table carries the card and drops it on the table when the finger crosses out of the binder (or a
  flick toward the table; a flick away sends it home); on the table any drag carries, and letting go off the strip sends
  it home. A tap moves a card across. Two fingers pinch the table closed under them (scrubbed, speed first, position
  second: a slow small pinch stays). Back, Escape, ctrl+wheel out also close it. A touch during the close finishes it.
- Chrome: redefined `setChrome` (Back stays, Rearrange and Mark hide, `#where` reads "Trade with Maya"); `backBtn`
  closes the table first. The trade bar replaces the lens bar: the balance in tabular figures ("You're up $2.60",
  "Maya's up $0.16", "An even trade") over "1 of yours for 2 of Maya's", and Shake hands (enabled once both sides have
  a card). Lens, search, the list and Rearrange close the table instantly first.
- Shake hands: toast "Proposed to Maya: 1 of yours for 2 of Maya's. You're up $2.60." with Undo (removes the record).
- The list (redefined `drawList`): under the Trade lens a "Trade with" section on top, one row per trader (what they
  want of yours, what they have that you chase, the balance, Proposed state) with a Propose button that proposes all
  matches both ways. Spare rows read "Spare, Maya and Jun want it".
- Reduced motion: no flights, the table appears and clears at once, drags still follow the finger and snap on release.
  Dark mode through `theme`. Value filter colours the table's cards by heat.

## Try this first on the phone
1. Tap **Trade**, then tap **Maya** at the top. Watch your spares fly down into the bottom binder and hers deal out of
   her chip. Pull a green card down out of her binder: it slides onto the table. Pull a gold card up out of yours. Read
   the balance, tap **Shake hands**, and watch the cards cross and fly home. Pinch the table closed another time.

## Gesture contract
All checks pass (dpr 1 and 2). Outside the table nothing in the base navigation changes; the Trade lens only adds the
strip above the panels. While the table is up it owns every touch that starts on the canvas (no pinch-to-open, panel
tap or wall scroll until it closes); pinching in on the table closes it with the same speed-then-position rule.

## Frame budget
`npm run test:perf -- --variant r10-radical-table`: mosaic 16.7 ms, held pinch 17.8 ms (budget 34; base 16.7 / 20.0).
Measured separately: the Trade lens mosaic 16.7 ms, the table opening (about 100 cards in flight over the fading wall)
21.1 ms, the table at rest 18.9 ms, a held drag 18.9 ms. Two binders on screen draw only the columns in view; cards
stay under 90 px wide so no shadow blur; no foil while anything moves; fonts via `font()`, names via `fitText()`.

## Unsure about
- Under the shared rule Maya wants 10 of yours, Jun 8, Theo 7, and Priya nothing either way, so she is not in the strip.
  (With the earlier suffix keys only Priya had any match, two cards; the prefix fix changed the picture completely.)
  The strip also lists a trader who wants nothing of yours but has cards you chase; is that right, or wants only?
- The binders scroll sideways so that a vertical pull can carry a card. Two rows of 82 px cards on a phone; a longer
  binder (Maya has 58 spares) means a fair bit of sideways travel, though the lit cards are always the first columns.
- Non-lit cards sit at 50% so the matches pop. Too washed out? Could be 65%.
- After Shake hands the table closes. It could stay open marked "Proposed" instead, so you can see what you offered.
- Tapping a spare tile on the wall opens the table with the first trader who wants it; the Chase lens pops the card
  instead. Should a spare tile pop the card with the traders listed?
- The Trade lens toast ("44 spares to trade") briefly covers the strip.
- No per-card value shown in the binders (card faces only print the price over 110 px); the pockets and table cards
  carry totals, not prices. A long press on a card could show it.
