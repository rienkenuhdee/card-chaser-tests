# r7-bold-deal-lift

**Round:** 7. Where should deals live: inside the mosaic, as their own surface, or as notifications?
**Concept:** Deals stay in the mosaic, but the Deals lens changes the layout as well as the colour: every deal card
flies to the top left of its panel and grows with its discount (the further under market, the bigger the tile), the
rest of the set packs in around them dimmed, and panels with nothing on offer fold to one line and drop to the bottom.
Any other lens flies everything home, so you never hunt for green dots and the mosaic is never torn up for good.

## What changed
- Added `65-deal-lift.js`. Nothing replaced or removed; no markup or style changes.
- Redefined `layoutAll` (orders each group: deals first, best discount first, then the arrangement's own order) and
  `mosaicLayout` (the base strip treemap and packing are kept verbatim for every other lens; with the Deals lens on,
  live panels get area by cells needed, deal tiles take a 5 to 8 cell square each by first fit from the top left, the
  rest fill in around them, and panels with no deals fold to a 54px line below the live ones, their cards kept as a
  hairline so opening one still grows them into the binder).
- Redefined `drawPanel`: during a lens flight the panel rect travels too (lerped from `g.pm`), instead of snapping.
  Also "No deals" is muted rather than deal green.
- Redefined `emptyPocket`: a lifted deal tile shows the asking price, "was $x", the percent under market, and the name
  (base pocket otherwise).
- Redefined `drawSet` and `stepInertia`: switching lens inside an open set plays an in-binder reorder flight (deals move
  to the front; everything else slides to its new slot) instead of a cut.
- Replaced the lens buttons' click handler (same as base plus `liftLayout()`, which runs the existing morph flight
  when the layout changes, and relayouts under a held pinch instead of fighting it).
- Marking a deal card as owned while lifted leaves it in place (dimmed) until the next lens switch or rearrange.

## Try this first on the phone
1. From the mosaic, tap **Deals**: the vintage sets fold into lines and sink, the modern sets swell, and 21 deal cards
   fly to the corners of their panels and grow by discount. Tap **All** to watch it all fly home.
2. In the Deals lens, tap Evolving Skies: the big deal tiles become the first row of the binder. Tap **All** while
   inside: the deals slide back to their set order.
3. Rearrange by value with Deals on: the "$20 to $100" band becomes a wall of 45%-off ex cards.

## Gesture contract
All checks pass (dpr 1 and 2). The gesture tests run with the All lens, where every redefined function takes the
base code path. The Deals lens only changes layout, not navigation: tap, pinch, scroll and slide all work the same on
the lifted mosaic (a folded panel is a full-width 54px tap target).

## Frame budget
`npm run test:perf -- --variant r7-bold-deal-lift`: mosaic 16.7ms, held pinch 18.9ms (budget 34ms).
Measured with the Deals lens on as well (custom script): lifted mosaic 16.7ms, held pinch on a lifted panel 18.9ms.

## Unsure about
- The seeded data has only 21 deals and none in the five vintage sets, so by set the first screen is five swollen
  modern panels and five folded lines. With real data (deals in every set) the folds would rarely show; is the
  fold-and-sink still the right move, or should folded panels keep their place in the order?
- A few "deals" are priced above market ($0.25 floor on a $0.10 card). They're lifted at the smallest size and labelled
  "live" with no percent. Should the lens drop them entirely?
- Deal tiles in the binder lead but stay the same size as the rest. Making them bigger there would need a new hit
  test; is the mosaic size-by-discount enough, or do you want it inside the set too?
- The mosaic gets about 1.3 screens tall with Deals on (the rest cells shrink, the deals grow). Too much scrolling, or
  fine?
