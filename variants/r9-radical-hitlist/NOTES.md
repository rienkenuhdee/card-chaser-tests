# r9-radical-hitlist

**Round:** 9. The show floor: one-handed, glanceable, built around your wants (Sacramento, Nov 20 to 22).
**Concept:** For the three days of the show the Wall becomes your hit list: switch Show on and the mosaic folds back and
dims while every want deals out of its panel as a big tile, stacking up from the bottom of the screen, grouped by set
with the oldest set nearest your thumb and the most you'd pay (85% of market) in big figures. Swipe a tile sideways when
you find the card: it flies back into its set in the wall behind, is marked owned, and a thumb-reach keypad asks what you
paid, feeding a budget line under the top strip; Show off flies everything home and the wall is exactly as it was.

## What changed
- Added `75-show.js` (one part; nothing replaced or removed). It injects its own chrome so `index.html` is untouched:
  a **Show** pill after Rearrange in the top strip, a **budget line** under the strip ("Spent $0.00 of $300", a thin
  bar, the show's name; tap it to change the budget), a **keypad** sheet (digits, point, delete, Skip, Done; typing on
  a keyboard works too), and a **Want it** toggle on the card panel between "I have it" and "Find a copy" (gold when
  on; hidden once the card is owned, since marking a want owned drops it from the wants).
- Wants per the shared rule: `!owned && (wants[id] ?? h32(id + "w") < 0.1)`; toggles persist in `wall-wants`. The cap
  is `Math.round(price * 0.85 * 100) / 100`. Also persisted: `wall-show` (the mode survives a reload, like a mode you
  switch on at the door), `wall-show-paid` ({id: amount or null for Skip}) and `wall-show-budget`. Reset the demo clears
  them all.
- The hit list is drawn on the canvas after the base `frame` (redefined `kick` to run `frame` then `drawHit`). Rows are
  86 px tiles (card pocket, name, set code and number or a live price, "Pay up to" and the cap in 26 px figures) with a
  set header per group ("Base Set · 6 to find, up to $1.44"). Content is bottom-anchored and scrolls with inertia;
  sets run newest at the top to oldest at the bottom so the vintage sets sit in thumb reach; within a set the highest
  cap comes first. On wide screens the list is 600 px wide, centred, with the wall visible either side.
- Flights: a want's tile travels from its panel (through the folding-back transform) to its row's pocket, bottom row
  first, 22 ms apart; the row chrome fades in as its tile lands. Found or Show off: the tile flies back to its slot and
  floods to a card face as it goes (the base `setOwned` ripple plays on the panel behind). Every target is evaluated
  per frame, so flights follow a scroll or the wall un-folding. Reduced motion: no flights, no fold, instant rows.
- Redefined: `drawMosaic` (folds back 6% about the top strip and dims to about 30% while Show is on), `emphasis`
  (a card that's out on the list leaves its slot empty), `readTheme` (adds `--panel-solid`), `fillPanel` (Want it and
  "Pay up to" in the meta line), `runSearch` (in Show, search narrows the list in place without flying anything;
  outside Show it's the base behaviour), `drawList` (a "Your hit list" section on top with Found it buttons, and rows
  read "Want it, up to $X").
- Input: while Show is on, touch, mouse and wheel events that start on the canvas are claimed in the capture phase on
  `document` and never reach the wall's gesture code (fingers are read from `e.touches`; no pointer map). A sideways
  drag on a tile slides it over a "Found it" strip and arms at 38% of the width (or a quick flick); a vertical drag
  scrolls; a tap on a tile says its market price and reminds you of the gesture. Two fingers do nothing in Show.
- `styles.css`: the pill, budget line, keypad and scrim, the panel's three-button grid, list styles. The lens bar,
  Time bar and caption step aside while Show is on; Rearrange and Mark hide (the wall isn't navigated in Show). Inside
  a set on a phone narrower than 480 px the Show pill hides, because Back, Mark and search already fill the strip.
- Entering Show from inside a set jumps to the mosaic first (as Rearrange does), then deals out. When the last want is
  found the keypad closes, the toast reads "Found all N. Spent $X." with Undo, and the wall returns.

## Try this first on the phone
1. Tap **Show** in the top strip and watch the wall fold back as your wants deal out of their panels and stack up from
   the bottom. Scroll with your thumb; the wall shows between tiles. Swipe a tile sideways: it flies back into its set
   behind, the keypad asks what you paid (Done or Skip), and the budget line moves. Undo on the toast brings it back
   out. Tap **Show** again: everything flies home and the wall is as it was.

## Gesture contract
All checks pass (dpr 1 and 2). Show is a mode: with it off nothing in the base changes (the capture listeners return
immediately). With it on, the hit list owns every touch that starts on the canvas, so there is no pinch, no panel tap
and no wall scroll until Show is off.

## Frame budget
`npm run test:perf -- --variant r9-radical-hitlist`: mosaic 16.7 ms per frame, held pinch 18.9 ms per frame (budget
34 ms; base on the same machine 16.7 / 20.0). Measured separately with the mode on: dealing out (46 tiles in flight plus
the fold) 16.7 ms, the settled list 16.7 ms, flying home 16.7 ms, all at the vsync cap. Flights draw one cheap offset
rect for a shadow and never foil; text goes through `font()` and `fitText()`; only rows on screen are drawn.

## Unsure about
- Order: newest set at the top, oldest at the bottom so Base Set sits by the thumb. Reading downward within a set is
  high-first as asked, but the list as a whole reads bottom-up. Should it just be set order top to bottom?
- 46 wants under the shared rule is a long list for a show; a "Top 10 by cap" pin or a per-set collapse might earn its
  place. The headers already carry the count and the total cap.
- The found tile floods to a card face as it flies home. Lovely, but the keypad slides up at the same time and may
  steal the moment; the keypad could wait for the landing.
- Search in Show hides non-matching rows in place (no flights). Their slots in the wall behind stay empty while hidden.
- The Show pill hides inside a set on narrow phones. If Ryan wants it always visible, the count ("541 of 1,327") is
  the thing to drop there instead.
- Tap on a tile only toasts the market price. It could open the card panel, but the panel's buttons duplicate the swipe.
