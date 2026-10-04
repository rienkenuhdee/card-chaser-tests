# r8-radical-deal

**Reserve.** Not harvested: we don't rip packs in the product. Kept for its animation (round 8).

**Round:** 8. Marking a stack fast: what does opening a booster pack feel like?
**Concept:** The pack is the gesture. Inside a set, pull down past the top of the binder (with resistance, like pull to
refresh) and a sealed pack in the set's colour comes out from behind the top strip; pull past the line and let go (or
swipe across it while you hold) and it tears open, dealing the set's missing cards as a stack of full-size cards in
number order. Swipe right to keep one (it flies out of the stack to its slot in the binder behind and ripples in),
left to pass; a number index along the edge scrubs straight to a number; Done, the last card, or pulling the stack
down closes the pack with one toast and Undo for the whole pack.

## What changed
- Added `75-pack.js` (one part, nothing replaced or removed) and `styles.css`.
- Redefined `onMove` (a copy of the base plus the pull: a drag that starts at the top of the binder and goes down
  becomes `pack.pull`; the binder gives by `pullDrop(pull)`, 110 px at most; past 150 px the pack is armed, with a
  haptic tick; a sideways move of 56 px while armed tears it without letting go). Redefined `clampCam` (the binder's
  top edge sits lower by `pack.drop` while pulled, and springs back after). Release is handled by `touchend` /
  `pointerup` listeners added after the base ones, so the base `onUp` runs untouched and its inertia is cancelled.
- Redefined `exitToMosaic` (Back and Escape close the pack before they close the set), `cardFace` (a copy whose foil
  is gated: only the stack's top card may shimmer while a pack is out, so the binder behind never foils under a moving
  card; the top card also wears a cheap layered shadow instead of a blurred one), `kick` (runs the base `frame` then
  `packFrame`, which draws the pack, the dim, the stack and the flights on top), and `drawList` (an "Open a pack"
  button per set, which goes to the wall, opens the set and deals the pack).
- The stack: `pack.list` is the group's unowned cards in the arrangement's own order (`g.base`, so the Deals lens
  reorder doesn't change it); `pack.i` is the top card. Keep pushes a flight to `binderRect(c, cam)` (recomputed per
  frame, so it follows the camera), and on landing calls `setOwned(c, true, { quiet: true })` for the base ripple. If
  the slot is off screen the binder pans to it behind the stack. Pass slides the card off left. The cards behind rise a
  level over 220 ms. Removing the last card closes the pack. Closing lands any flight still in the air so Undo (which
  calls `setOwned(c, false, { quiet: true })` for every kept card) is always consistent.
- Input while open: single-finger touches and mouse drags on the canvas are claimed in the capture phase on
  `document` (same pattern as the round 7 tray; the finger is tracked by identifier from `e.touches`, no pointer map).
  A touch that starts on the card swipes it (commit at 90 px or a flick faster than 0.6 px/ms); a drag down of 140 px
  anywhere puts the pack away; pinches and taps elsewhere do nothing. Keyboard: right keeps, left passes, Escape closes.
- HUD is DOM created from the part (count, Done, the index with its number bubble, a one-line hint). The index is a
  Contacts-style strip of up to 14 numbers; scrubbing maps y to the card at that fraction of the remaining list.
- Reduced motion: the pull still follows the finger (it's direct manipulation), the tear is a cut, kept cards land at
  once, nothing flies. Dark mode via the existing CSS variables. A one-time toast on the first set opened says "Pull
  down for a pack of what you're missing".

## Try this first on the phone
1. Open Jungle (or any set that isn't complete), then pull down from the top of the binder and keep pulling: the pack
   comes out from behind the search bar. Let go when it says "Let go to open". Swipe the first card right and watch
   it fly into its slot in the binder behind; swipe the next one left. Drag your thumb along the numbers on the right
   edge to jump to the fifties, keep a couple, then tap Done and try Undo on the toast.

## Gesture contract
All checks pass (dpr 1 and 2). The pull needs a drag that begins at the top of the binder and goes down, so scrolling
the binder, diagonal drags and set flips are untouched; the pack only claims touches while it's open, and Back and
pinch work normally when it isn't.

## Frame budget
`npm run test:perf -- --variant r8-radical-deal`: mosaic 16.7 ms, held pinch 18.9 ms (budget 34 ms). Measured
separately on the same software canvas: binder 20 ms, pull with the pack out 18 ms, open stack 23 ms, mid-swipe
27 ms (was 30 ms with a blurred shadow on the top card; replaced with a layered one).

## Unsure about
- The pull is only discoverable through the one-time toast. Is that enough, or does the binder header want a small
  sealed-pack glyph that does the same thing on tap?
- The binder pans behind the stack to wherever a kept card lands, so Done leaves you at the last landing rather than
  the top of the set. Nice to see the ripple, but it could feel like the floor moved.
- In the By Pokémon and By value layouts the pull still works and the pack says "BOOSTER Kanto" or "BOOSTER $100 and
  up". Maybe the pack should be a set-only thing.
- Passed cards leave the pack for good; Done with cards left just closes. Should passing be undoable, or should passed
  cards go to the bottom of the stack instead?
- "Nothing left to open" for a complete set is a pack that says "complete" and springs back with a toast; it could
  instead refuse to come out at all.
