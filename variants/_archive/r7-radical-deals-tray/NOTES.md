# r7-radical-deals-tray

**Round:** 7. Where should deals live: inside the mosaic, as their own surface, or as notifications?
**Concept:** Notifications in the Wall's own physics: when a deal appears, the card's tile detaches from its panel and
flies into a tray along the bottom edge, leaving a ghost outline where it came from. The tray is a strip of card chips
(name, deal price, how far under); tap one to open the card (the chip grows into it), swipe up to watch it, swipe down
to send it home (it flies back to its ghost).

## What changed
- Added `75-deals-tray.js` (one part, nothing replaced or removed):
  - Tray model: 21 deal cards arrive one by one over the first ~55 s in an order seeded by card id (`h32(id + "arrive")`),
    first at 2.2 s then every 2.5 s with a little seeded jitter. Reduced motion: all there at once, no flights.
  - Flights: a tile travels between its home (panel tile, or binder slot in the set), the tray chip, and the card up
    close, drawn with `drawTile` so it's the same tile growing. Targets are evaluated per frame, so a flight follows a
    camera fly or an open transition (tapping a chip in the mosaic: the chip travels while the set opens, then grows into
    the focused card).
  - Ghosts: a dashed hairline at the away card's home in the mosaic and the binder (deal-coloured under the Deals lens,
    so that lens now shows where the deals belong).
  - Watch (swipe up): gold star on the chip, chip sorts to the front, persisted in `localStorage` `wall-watch`.
    Send home (swipe down): persisted in `wall-sent-home` keyed by deal price, with Undo in the toast. Reset the demo clears both.
  - Marking a tray card as owned (panel, press and hold, or list) sends it home; undoing brings it back.
  - Deals lens button gets a count badge that ticks on every arrival. One toast on the first arrival explains the gestures.
  - List view gets a "Live deals" section at the top with Watch and Send home buttons; tray cards read "In the tray".
- Redefined functions: `mosaicLayout`, `clampCam`, `exitToMosaic` (reserve 160 px at the bottom for the tray so nothing
  hides under it; same as the Time lens pad, so switching lenses doesn't relayout), `emphasis` (away cards draw as
  nothing so the ghost shows), `focus`, `unfocus`, `setOwned`, `drawList`, `readTheme` (adds `--panel-solid`), and
  `kick` (schedules a frame that runs the base `frame` then draws ghosts, tray and flights on top).
- Input: touch and mouse events that start inside the tray are claimed in the capture phase on `document` and never
  reach the wall's gesture code (no pointer map for touch; the finger is tracked by its identifier from `e.touches`).
  Horizontal drag scrolls the strip (with inertia), vertical drag lifts the chip with a "Watch" or "Send home" pill that
  arms at 36 px, tap opens. Wheel over the tray scrolls it.
- `styles.css`: the badge, the caption moved above the tray, list styles for the deals section.

## Try this first on the phone
1. Load it and wait a few seconds: watch a tile lift out of a panel and land in the tray at the bottom, and the Deals
   count tick. Tap the chip: it flies up into the set and becomes the card. Drag the wall to leave; it goes back to the
   tray. Swipe another chip down and watch it fly home into its ghost (Undo in the toast brings it back).

## Gesture contract
All checks pass (dpr 1 and 2). The tray claims only single-finger touches that start inside its strip; pinches, taps
and drags on the wall are untouched. Mosaic scrolling and the binder's bottom are padded so nothing sits under the tray.

## Frame budget
`npm run test:perf -- --variant r7-radical-deals-tray`: mosaic 17.8 ms per frame, held pinch 17.8 ms per frame
(base on the same machine, same run: mosaic 16.7 ms, held pinch 18.9 ms; budget is 34 ms). The tray draws chips in four passes with one font each; flights draw
one or two tiles with a shadow; no foil (tray cards are unowned pockets).

## Unsure about
- 160 px reserved at the bottom costs about a fifth of the phone's mosaic height. Worth it for a persistent tray, or
  should the tray collapse to a thin bar when empty or when you're in a set?
- Newest chips land at the front and push the others right. Alternative: append at the end so nothing you're looking
  at moves.
- Twenty-one arrivals over a minute is right for the demo but a real feed would be bursty. Does the staggered landing
  still read as "notification" if several come at once?
- Cheap commons where the floored deal price is above market now read "At market" in the tray. The data quirk is in
  the base (`10-model.js` floors deals at $0.25); maybe those shouldn't count as deals at all.
- Whether "watch" needs to do more than a star and front-sorting (it doesn't notify or affect anything else yet).
