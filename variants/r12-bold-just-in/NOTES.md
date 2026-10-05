# r12-bold-just-in

**Round:** 12. A deal arrives: how does the wall tell you a live copy just appeared on a card you chase, and what do you do next?
**Concept:** The notification is the card itself arriving: when a live copy lands, the card's tile lifts out of its panel (or its binder slot), flies up to a "Just in" shelf that slides out from under the search bar, and settles there as a chip with its mini face, the price in green and how far under, leaving a faint ghost where it lives. Tap the chip and the card pops up with its offers; swipe it up and it flies home. No banner, no copy: the card comes to you, and the ghost tells you where it belongs.

## What changed
- Added `78-just-in.js` (after Trade, before the welcome):
  - The shared feed: 6 s after load, then every 9 s, `feedTick` picks the next chased card in `h32(id + "r")` order without a deal (price `round(price * (0.55 + 0.3 * h32(id + "e")), 2)`, floored at $0.25, only if under market); if every chased card has one, the oldest deal (`dealAt`, seeded deals count as oldest) drops 10%. Sets `c.dealAt`, clears `c.dealSeen`. Arrivals wait while the welcome sheet is up. A fresh wall chases nothing, so nothing arrives.
  - The shelf: a DOM strip (`#shelf`, glass) that slides out from beneath the top strip; chips are buttons, newest left, native sideways scroll with snap. A chip is the card's mini face (the tile itself, snapshotted off the wall's canvas at 2x), `short(deal)` in green, "N% under", the name and "just now" / "4 min ago" (refreshed every 30 s). Unseen chips keep a green border; the Chase lens button carries the unseen count and ticks on each arrival. A price drop on a card already on the shelf moves its chip to the front and pulses it again.
  - The flight: one element (`.flier`) carrying the chip's face, from the tile's rect (the card inside a feed tile under Chase) to the chip's face rect, re-aimed every frame so it lands even while the slot is still opening; a small arc on the way up, none on the way home. One flight at a time; later arrivals queue. The first arrival waits 380 ms so the shelf can slide down and the wall make room first.
  - Ghosts: `emphasis` returns 0 for a card that's away on the shelf (`c.gone`), and `drawGhosts` draws a dashed green hairline at its home (panel tile, binder slot, feed tile), following open, morph and camera moves (`homeRect`, cribbed from the round 7 tray). Stronger under the Chase lens.
  - Tap a chip: `popCard` from the chip's face, `dealSeen` set. Swipe up (30 px, with resistance): `putBack`, the chip's slot closes and the tile flies home to its ghost with a ripple. Delete/Backspace on a focused chip does the same. Got it, Chase it off or Undo on a shelved card send it home too (via `shelfSync` in `drawList`); after Got it the tile inks in as it lands. The shelf folds away when its last chip goes.
  - Redefined `kick` (frame wrapper: face snapshots before the frame, shelf height tween with relayout, ghosts and the flight after), `emphasis`, `focus` (the card up close sits below the shelf), `drawList` (a "Just in" section with Got it and Put back).
  - Reduced motion: no flights; the shelf and chips simply appear, the ghost appears. List view: the "Just in" rows, and reading them marks the arrivals seen. Trading hides the shelf.
- Replaced `30-layout.js` with a copy whose only change is `topPad = () => 70 + shelfPad()` (`topPad` is a const, so it can't be redefined by hoisting). The wall is pushed down by the shelf's height while it's out, so no panel ever sits under it and a touch on the shelf is never a touch on the wall.
- `styles.css`: the shelf, chips (enter/leave width transitions, the green pulse, lifting/armed states), the flier, the Chase badge, the toast and menus moved under the shelf, the list rows.

## Try this first on the phone
1. Import with "Chase every card I'm missing", wait six seconds, and watch a tile leave its panel and fly up into the shelf. Tap the chip to see the offers; swipe another chip up and watch it fly home to its dashed ghost. Then open a set that has a ghost in it and wait for the next one to leave from the binder.

## Gesture contract
All checks pass on the fresh wall, and also with the shelf out (three arrivals before the checks, wall pushed down to 176 px): a copy of `tests/gestures.mjs` with the import and `feedTick` calls prepended, run locally. The shelf takes only its own touches (DOM, `touch-action: pan-x`); nothing reaches the canvas from it, and nothing of the wall is under it.

## Frame budget
`npm run test:perf -- --variant r12-bold-just-in`: mosaic 16.7 ms per frame, held pinch 16.7 ms per frame (fresh wall). With the shelf out, six chips and ghosts on screen (measured in the scenario script): mosaic 16.7 ms, held pinch 16.7 ms. Nothing new is drawn on the canvas per frame except the ghost hairlines; the flight is one DOM transform per frame, and chips carry no foil.

## Unsure about
- The shelf costs 106 px of the phone's height for the whole session once anything has arrived. It folds away when empty, but should it also fold after you've looked at everything (a chip auto-leaving once seen), or collapse to a thin bar while you're inside a set?
- The mini face on a chip is the empty pocket (you don't own the card), so it's mostly a grey slot with a green hairline. It's honest, but a chip with just the price and name might be cleaner. The pocket does make the flight read as "that tile".
- Swipe up to put back: the chip slides under the shelf's header and goes. Is "up and away" the right direction, or should it be down (toward where it lives)?
- The hint line in the shelf header ("Tap to look. Swipe up to put back.") goes after your first look or swipe. It is copy, which the concept wanted none of; it could be dropped entirely.
- When a deal arrives while the Chase lens is out, the layout isn't re-sorted (deals first), so the ghost stays where the tile was. The next lens change tidies it. Re-sorting mid-arrival would move the wall under the flight.
