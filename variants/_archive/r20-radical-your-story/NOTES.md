# r20-radical-your-story

**Round:** 20. The import's reveal: what should the first minute after your collection arrives show you?
**Concept:** The import plays your collection's story in the order it happened. The wall assembles in time from your
first card to today (about 25 seconds, fast through quiet months, slower on busy days), a big date ticks along the
bottom over the growth curve, and the moments land as they happened, ending on today with the wall whole and one line of
totals.

## What changed
- Added `86-story.js`; no part replaced or removed.
  - `finishImport` redefined. It marks the seeded collection as before (owned, dates, copies, chase list) and saves it
    all straight away. It earns the trophies quietly with `checkMedals(true)`, so each is dated from the card that
    completed it; Trophy Cabinet and Crown Collector are dated from the 25th or 5th trophy. Then it plays the story.
  - The story is the collection replaying. Every imported card and trophy goes back to "not yet" and comes back as
    the clock passes its date: `c.owned` plus the usual mark flood (`c.anim`), and `mdStore` for trophies. So the
    panel counts, bars, the search count and the trophy room door all follow without being touched.
  - Pacing: each day weighs 1, plus 5 × √(cards that day). The clock moves for 13 s and each moment holds it for
    1.1 s (2 s for a big day), plus a 1.8 s opening line.
  - The moments, computed from the data rather than scripted:
    - your first card
    - big days (12 or more cards; the demo has one: 194 cards on March 9, 2024, from 6 sets)
    - your first spare
    - the 100th different Pokémon
    - a set finishing (its plaque mints right there through `syncDone()`; the seeded import never finishes one)
    - your first trophy and every Critical or Shiny one
    
    Whatever else happened on a big day comes after the day's caption.
  - Every trophy, captioned or not, drops in on its date. Its panel says its name in gold (`g.beat`), the tally's
    medal icon pops and counts up, and the door at the end of the wall appears with the first one. A big day sends a
    gold ripple through each panel it touched, with "+37 in a day". Moment cards flash gold where they sit, and the
    camera drifts toward where cards are landing, then comes home to the top.
  - The overlay is a scrim along the bottom with:
    - the moment card (the celebration card's look, Critical and Shiny borders included)
    - the date in 42px condensed type
    - the growth curve, revealed up to the playhead, with gold dots where moments landed
    - "231 cards" and the latest trophy with the trophy count
    
    The chrome steps aside (`body.storying`). A small Skip sits top right.
  - The end: "Today" in gold, the totals line ("541 cards from 10 sets, worth $5,341.35. 101 spares, 30 trophies."),
    See your trophies and Done. It goes by itself after about 5 s or on any touch.
  - A touch anywhere (capture-phase `touchstart`, mouse `pointerdown`, `wheel` or a key) jumps to the end at once:
    the whole wall, every trophy, the chrome back, the totals as a toast. The same touch carries on as the gesture it
    was, so a drag scrolls and a spread opens a set.
  - Reduced motion: the story steps through its moments as stills (2.3 s each, no floods or ripples), then the same end.
  - This replaces the import toast and the trophy celebration card (no celebration fires, since the trophies were
    earned quietly).
  - Time keeps the story. `drawSpark` is redefined to put the moments on the slider as gold dots. `setT` is
    redefined so scrubbing or playing past a moment shows it above the bar ("Your biggest day, 194 cards in one day")
    and flashes its card.
  - Also redefined: `scheduleMedals` (doesn't run while the story plays), `doorMedals` (the door's medal row reads
    the trophies that have landed so far, instead of working out the catalog every frame) and `tickFeed` (the live
    deal feed waits until the story is over).
- `styles.css`: the overlay, Skip, the end state, the Time dots and the moment card above the Time bar, plus reduced-motion rules.

## Try this first on the phone
1. Reset the demo (Settings), then Import from TCGplayer and watch without touching: about 25 seconds. The
   moment to look for is March 2024, when the old binder turns up and 194 cards land in one beat.
2. Run it again and drag the wall half way through. It should jump to today at once and the drag should scroll.
3. Afterwards, open Filters and choose Time, then drag the slider across the gold dots.

## Gesture contract
All checks pass. None of them run the import (they start on an empty wall). The story's own checks were run as a
scratch script, and all passed:
- a drag during the story ends it and scrolls in the same touch
- a spread during the story ends it and opens a set
- Skip ends it
- reloading half way keeps every card and trophy
- played through, it ends at the top with the totals, and a tap puts the end card away
- Time shows the dots and says the day when scrubbed

## Frame budget
`npm run test:perf -- --variant r20-radical-your-story`: mosaic 16.7 ms, held pinch 21 to 23 ms (base 21.1; budget 34;
one run hit 30 ms while other builders were testing on the same machine). The story is off at rest, so neither frame changes.
During the story (software canvas, dpr 2): median frame 16.7 ms and p90 33 ms, the same as the base import's flood.
A few 50 ms frames land on moments, when the moment card's DOM swaps.

## Unsure about
- Length. About 25 s played through. The four Critical trophies all land in 2025 and 2026, so the tail is a run of
  "Across everything" medals (Last Page, 500 cards, Trophy Cabinet), then Legendary Birds. Maybe only the first lucky
  one should hold the clock.
- The seeded data shapes the story: the first card is a trainer (Boost Shake), and only one day is "big". Real
  imports carry real dates, and many will have one huge day (the import day itself), which would read as "1,200
  cards in one day" unless the source has acquisition dates.
- The camera drift follows where cards land. It reads as alive in the screenshots, but it may feel like the wall
  moving by itself on a phone.
- On skip, the totals go to the top toast; played through, they stand in the moment card with See your trophies. Two
  endings for one line.
- Time's Play still runs its own 7 s ease; only scrubbing and playing past the dots tells the story. Replaying the
  full paced story from Time would need the replay to un-own cards temporarily, which I avoided.
