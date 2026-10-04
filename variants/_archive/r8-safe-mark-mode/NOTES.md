# r8-safe-mark-mode

**Round:** 8. Marking a stack fast: what does opening a booster pack feel like?
**Concept:** A Select mode inside a set, modelled on Photos. "Mark" in the set header (next to Back) turns the set
into a tap-to-mark surface: a tap toggles a card with the usual ripple, a drag that sets off sideways across cards
paints every card it crosses to the state of the first one, and a bar along the bottom (in the lens bar's place)
keeps the running count with Undo for the whole session and Done, which sums it up in one toast. Press and hold on
any card is the shortcut in: the hold marks that card and opens the mode, so you can keep the finger down and sweep.

## What changed
- Added `75-mark-mode.js` and `styles.css`. Nothing replaced or removed; the base markup is kept (the Mark button
  and the bottom bar are created from the part, and a line about Mark is added to the About list).
- Redefined `setChrome` (the Mark button shows with Back and hides in mark mode; leaving the set view for any reason,
  Back, pinch out, rearrange, search, ends the session with the summary toast), `updateCount` (a shorter search
  placeholder inside a set on a narrow screen, so Mark fits beside it) and `setListMode` (opening the list ends the
  session; the list keeps its own tap-a-row marking).
- Redefined `onDown`, `onMove`, `onUp` and `tap` (the base code with mark mode folded in): in mark mode a tap on a
  card toggles it (`setOwned`, quiet) instead of bringing it up close; a drag that starts on a card and sets off
  sideways paints (the first card decides whether the stroke adds or takes out; every card between samples is hit so a
  fast sweep skips none); a drag that sets off downward scrolls as before; two fingers pinch as before. A hold on a card
  starts a stroke, entering the mode first if needed.
- Redefined `kick` to run the base `frame` and then draw the session's badges over the binder: a green tick on each
  card added this session, a grey dash on each one taken out (only in mark mode, so the frame budget is unchanged).
- Copy: the bar reads "Mark cards / Tap a card, or drag across a row" until something changes, then "7 added" or
  "4 added, 2 taken out" with "41 of 64 in Jungle" under it. Done toasts "7 added. 41 of 64 in Jungle." with Undo.
  The set-complete toast from `setOwned` still fires inside the mode.

## Try this first on the phone
1. Open Jungle, tap **Mark**, then sweep a finger sideways along a row of empty pockets: they flood in one after the
   other and the bar counts them. Tap a couple more. Tap **Done** and read the one toast; tap its Undo to watch them
   all go back out.
2. Without Mark: press and hold an empty pocket until it fills, keep the finger down and slide along the row. The hold
   opened the mode for you; the bar is waiting at the bottom.
3. In mark mode, drag downward to scroll and pinch to zoom: both still work. Pinch out of the set: the session ends
   with its summary.

## Gesture contract
All checks pass (dpr 1 and 2). The checks run outside mark mode, where every redefined gesture function takes the
base path. Inside mark mode, one thing is deliberately different: a sideways flick that starts on a card paints
instead of sliding to the next set (a sideways drag from the title block still slides, and Done or Back restores the
normal flick). Press and hold on a card now opens the mode as well as marking the card.

## Frame budget
`npm run test:perf -- --variant r8-safe-mark-mode`: mosaic 16.7ms, held pinch 17.8ms (budget 34ms); the same as
the base, since the badges are only drawn in mark mode and only for cards the session touched.

## Unsure about
- Should the hold shortcut open the mode at all? It turns the old one-card flow (hold, toast, Undo) into hold, bar,
  Done. The bar carries the same count and Undo, and Back or a pinch out ends it too, but it is one more thing on
  screen if you only wanted one card.
- The sideways-starts-painting, downward-starts-scrolling split is the Photos rule; on the Wall a sideways flick
  usually means the next set. Is losing that flick inside mark mode acceptable, or should the next set need the title
  block drag?
- Painting does not scroll when the finger reaches the screen's edge, so a run longer than a screen takes two sweeps.
- A rearrange while marking ends the session with its summary toast, which the "By set" toast then replaces, so that
  Undo is hard to reach. Rare, but worth knowing.
