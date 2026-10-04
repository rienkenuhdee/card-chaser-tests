# Experiments

## The loop

1. **Diverge.** Three takes on one question: one safe, one bold, one radical. Built in parallel as variants.
2. **Feel.** Ryan tries them on his phone. Feel beats screenshots.
3. **Harvest.** Keep the moments that were great, even if the variant as a whole wasn't.
4. **Normalize.** Reshape what's kept toward patterns people already know, so it's intuitive on first touch
   ("zeitgeist digestible"). The novelty stays in the feel, not in having to learn something.
5. **Guard.** The gesture contract and frame budget pass before anything lands.

## Principles (learned so far)

- **The interface owns the camera.** Every gesture lands on a composed view: mosaic, framed set, or card. Never a
  free-floating in-between state. Free zoom-out felt empty; composed levels felt designed.
- **Fill the screen with meaning.** No empty void at any level. The mosaic packs cards into panels; panels tile the
  screen; it scrolls when it must rather than shrinking to dust.
- **Transitions are continuous, not cuts.** A set's tiles physically become its binder. Rearranging moves every card
  to its new place. The thing you tapped is the thing that grows.
- **Gestures scrub, then snap.** A pinch holds a transition under your fingers; release snaps by speed first (a quick
  flick wins), position second. A small pinch never closes a set.
- **Familiar on top of novel.** Back button, pull to scroll, tap to open, press and hold to mark, Mark to select a
  handful like Photos. The mosaic is novel; how you move through it shouldn't be.
- **A collector's archive, not a toy.** Archivo (condensed for names, tabular figures for prices), hairlines, small
  radii, color from the cards themselves. Rounded, bouncy type read as "comic sans".
- **Lenses over pages.** Need, Deals, Value and Time recolor what you're looking at instead of navigating away. A lens
  may rearrange as well as recolor (Deals brings the deals out in front), as long as every other lens flies it all home.
- **Frame budget is a feature.** A slow frame makes pinches lag and makes a flick read as a slow release, so snapping
  goes the wrong way. Keep the held-pinch frame under budget (see `npm run test:perf`).

## Log

**Round 1: The Wall.** Every card on one zoomable canvas, sets as blocks, semantic zoom (heat map, binders, card).
Lenses instead of filter pages. Kept: lenses, marking that floods in with a ripple, the heat map as an overview.

**Round 2: Rearrange, press and hold.** Layouts by set, by Pokémon (the Dex as region blocks), by value, with every
card flying to its new place. Press and hold to mark with Undo. A list view for screen readers. Kept: all of it; the
rearrange flight was the standout.

**Round 3: Archive look; size is worth; Time.** Moved off a rounded display face to Archivo; cards became color chips
with a printed label strip. By value sized cards by price. The Time lens replays the collection filling in, with a
growth curve behind the slider. Kept: the look, Time, size-by-worth.

**Round 4: The mosaic.** Free zoom-out felt empty, so the camera became UX-controlled: mosaic, framed set, card.
Panels tile the screen; tapping a panel grows its tiles into the binder. Kept: the structure ("we're getting somewhere").

**Round 5: Pinch that scrubs; mosaic scroll.** Pinch drives the open/close transition and snaps on release; the mosaic
scrolls. Feedback: snapping still unreliable, scrolling hit or miss on the phone.

**Round 6: Touch fixes.** Root causes: ghost fingers from dropped pointer events (fixed by reading the touch list),
touches ignored during animations (now they finish the animation and take over), diagonal drags read as set flips,
position-only snapping (now speed first), and a 374ms held-pinch frame on GPU canvases from per-card font setting and
text measuring (now 24ms). Gesture contract added as tests.

**Round 7: Where deals live.** Three answers: a bottom sheet listing live deals (their own surface), the Deals lens
rearranging every panel so deal cards fly to the corner and grow by discount, with no-deal panels folding to a line
(inside the mosaic), and deals arriving as the card tile itself flying from its panel into a tray along the bottom
edge (notifications). Kept: the lens reflow, and All flying it home. Learned: a lens can change layout as well as
colour and still feel like a lens, because nothing is navigated away from. A deal must be under market or it's noise
(the data now drops at-market copies). The sheet was a page in disguise, and the tray's up and down swipes had no
precedent, though its arrival flight is worth revisiting as the notification.

**Round 8: Opening a booster pack.** Three answers to marking a stack fast: a Select mode inside a set like Photos
(tap to toggle, sweep along a row to paint, a bar with the count, Undo and Done); "Open a pack", a number pad where
each typed number flips the card out of the binder into a fanned hand and Done deals it in; and the pack as a gesture
(pull down past the top of a binder for a sealed pack, tear it, swipe through the set's missing cards). Kept: the Select
mode, with press and hold as the way in (hold, then keep the finger down and sweep). Learned: a numbered-ghost flight
and a holo flash are lovely, but we don't rip packs in this product, so the two pack variants stay in the archive as a
reserve of animation for later (the flip-out, the dealing-in wave, the sealed-pack reveal). Inside Select, a sideways
drag paints instead of sliding to the next set; a drag from the title still slides.

## Open questions (next rounds)

- A deal arriving: the tray's flight from panel to edge as the notification, landing in the lens reflow?
- Painting past the screen's edge: should a sweep scroll the binder as it goes?
- The show floor: one-handed, glanceable, built around your wants (Sacramento, Nov 20 to 22).
- Trading: your spares meeting someone else's wants.
- The first 30 seconds: onboarding before anything is marked.
- Bringing the mosaic into the real app as the Chase home.
