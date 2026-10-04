# r7-safe-deals-sheet

**Round:** 7. Where should deals live: inside the mosaic, as their own surface, or as notifications?
**Concept:** The Deals lens pulls up a half-height bottom sheet over the recolored mosaic: every live deal on a card you
need, best discount first, with the deal price against market and the total saved. Tapping a row drops the sheet and
flies into that card's set and onto the card, so the list is a way in, not a way out (Maps with a place list on top).

## What changed
- `60-lenses.js` replaced (19 lines): picking Deals opens the sheet, tapping Deals again toggles it, any other lens
  closes it. The "N live deals" toast is gone because the sheet's header says it.
- `65-deals-sheet.js` added: builds the sheet and a transparent tap-to-dismiss scrim in the DOM, fills the rows
  (`money()` for both prices, sorted by percent under then dollars saved), and handles the gestures: a drag on the grip
  or header moves the sheet; in the rows, a pull down from the top or a push up while there is room to grow moves the
  sheet, anything else is the rows' own scroll. Two resting heights (half the screen, nearly all of it); a pull past
  90px or a quick flick down dismisses. A row tap calls `enterGroup(g, { then: () => focus(c) })`, scrolling the mosaic
  first so the set grows out of its panel; inside the same set it just calls `focus(c)`. Escape, the close button, the
  scrim, the search field and "Show as a list" all close it. Nothing is redefined; it only calls existing functions.
- `styles.css` appended: the sheet (glass, grip, header, rows with a type-colored chip), the lens bar raised to float
  over the sheet's foot with a fade so Deals stays a tap away, desktop floats it centered like the card panel, list
  view hides it. Dark mode comes from the existing variables; reduced motion disables the transitions globally.

## Try this first on the phone
1. Tap Deals. Pull the grip up to see the whole list, then tap a row: the sheet drops while the set grows out of its
   panel and the camera lands on the card with "Buy for" ready. Drag the wall to leave, tap Deals again, repeat.

## Gesture contract
All checks pass (dpr 1 and 2). The sheet never intercepts canvas touches; it only exists over the canvas while open.

## Frame budget
mosaic 16.7ms per frame, held pinch 17.8ms per frame (same as the base: the sheet is DOM, nothing changed on the canvas).

## Unsure about
- The lens bar floats over the sheet's foot (like a floating tab bar) so Deals is always a tap away. The other choice
  was the sheet stopping above the lens bar like the Time bar does. Does the overlap feel right or busy?
- Should the sheet come back on its own when you leave a card (the lens is still Deals), or only when you tap Deals?
  Right now it only comes back on a tap, so the recolored wall is what you see after a card.
- The header is "21 live deals on cards you need" and "All of them: $351.48, $280.11 under market." Is the second line
  the number you want, or would "Save $280.11" alone be better?
