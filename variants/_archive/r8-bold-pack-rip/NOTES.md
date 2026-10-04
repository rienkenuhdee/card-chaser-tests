# r8-bold-pack-rip

**Reserve.** Not harvested: we don't rip packs in the product. Kept for its animation (round 8).

**Round:** 8. Marking a stack fast: what does opening a booster pack feel like?
**Concept:** Inside a set, "Open a pack" raises a number pad; you type the number printed at the bottom of each card
you pulled, and that card's tile flips out of the binder into a fanned hand above your thumb (holos flash and get a
toast, cards you already own join as tagged spares). Done deals the hand back into the set: every card flies to its
slot and marks with the ripple, and one toast sums the pack up with Undo for the whole thing.

## What changed
- Added `75-pack.js` (one part, nothing replaced or removed):
  - A pill, "Open a pack", above the lens bar inside a set (laid out by set only: a region or a price band isn't a
    pack). It opens a sheet from the bottom: title and set, a display showing the typed number and the matching card
    ("142  Flaaffy, Common", "A spare", "Already in this pack", or "No card 999 in Evolving Skies" with a shake), keys
    1 to 9, Backspace, 0, Add, and Done.
  - Typing: a number that nothing else could extend (142 when there's no 1420) pulls at once, no Add needed. An
    ambiguous one (14 when 140 to 149 exist) shows its match and lights up Add. A physical keyboard types too
    (digits, Backspace, Enter, Escape).
  - Pulling: the tile flips from pocket to face as it flies from its slot (the binder scrolls the slot into the band
    above the sheet first if it's hidden) into the fan. The slot keeps a dashed ghost with its number. Tier 3 and up
    gets a gold ring and foil sweep as it lands, a stronger tick, and a toast ("Gyarados V! Rare Holo V, $21.03").
    Owned cards join as spares with a tag; they count in the hand and its value but aren't re-marked.
  - The fan sits on a shelf (the sheet's colour fading upward) with "7 pulls" and "$24.84, 2 spares" beside it.
    Tapping a card in the fan, or Backspace with nothing typed, flies it back to its slot. Tapping a binder card
    pulls it too (press and hold does the same in this mode, instead of marking).
  - Done: cards deal in oldest first, 60 ms apart, each marked with `setOwned(c, true, { quiet: true })` on landing.
    The ripple from the first landing is kept so it reads as one wave. Then one toast: "10 pulls, 8 new. Evolving
    Skies 44 of 237." with Undo for every new card. All spares: "3 pulls, all spares. Nothing new to mark."
  - Close (x) or Escape flies everything back unmarked ("Pack closed. Nothing marked."). Back, rearrange, the list
    toggle and focusing search deal the pack in first (Back then needs a second tap to leave the set).
  - The list view: each set section gets its own "Open a pack"; pulls show as chips in the sheet (tap one to put it
    back) and Done marks them with the same toast.
- Redefined: `emphasis` (a pulled card draws as nothing so its ghost shows), `clampCam` (the binder stops above the
  sheet), `tap`, `toggleWithUndo`, `exitToMosaic`, `slideGroup` (a sideways flick bumps instead of changing sets
  while a pack is open), `pinchMove` (a pinch can zoom but not close the set under the sheet), `markMode` (hides the
  pill off the by-set layout), `drawList`, and `kick` (runs the base `frame` then draws ghosts, shelf, fan and
  flights on top).
- `styles.css`: pill, sheet, keys, chips; the lens bar, timebar and caption slide away while a pack is open; the
  list gets bottom padding under the sheet.
- The Deals lens reflow (round 7) is untouched: lenses still work inside the set while a pack is open, and ghosts
  and flights follow the lifted layout because every target is read from the card's live slot each frame.

## Try this first on the phone
1. Open Evolving Skies, tap "Open a pack", and type 28 (Gyarados V): watch it flip out of the binder into your hand
   with a flash and a toast. Type 2 then Add, 99, 33 (a spare), a wrong one like 999, then tap the top card of the
   fan to put it back. Hit Done and watch the hand deal into the set, then Undo from the toast.

## Gesture contract
All checks pass (dpr 1 and 2). Pack entry is a mode you enter and leave; outside it nothing about navigation changes.
Inside it, two gestures are deliberately held: a sideways flick bumps rather than sliding to the next set, and a pinch
can't close the set under the sheet (it zooms, and lands back on the frame).

## Frame budget
`npm run test:perf -- --variant r8-bold-pack-rip`: mosaic 16.7 ms per frame, held pinch 17.8 to 18.9 ms per frame
over two runs (budget 34 ms; the base measures the same on this machine). The pack draws only while a pack is open or cards are in flight;
foil is skipped on the fan while anything in it moves (one-off glint and a shadow per tile are the only extras).

## Unsure about
- Auto-adding when a number can't be extended is fast but means "14" needs Add while "142" doesn't. Collectors who
  type numbers all day may find the asymmetry odd, or may not notice because the display always names the match.
- Back deals the pack in rather than cancelling. Safe (Undo covers it), but is it what a thumb expects from Back?
- Two numbers the same in one pack (two Pikachu) are rejected as "already in this pack" since marking is binary. A
  real pack can have doubles; counting a second copy as a spare would need a copies model.
- Three letter-numbered cards (B, G, R in 30th Celebration) can't be typed on a digit pad; tapping them in the
  binder works.
- The sheet takes about 40% of a phone screen. Enough binder stays visible to see the slot each card leaves, but
  on short phones the fan and the header compete.
