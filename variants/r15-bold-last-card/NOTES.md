# r15-bold-last-card

**Round:** 15. Finishing a chase. What happens when the last card lands, and how does a set or chase show how far
along it is before then?
**Concept:** The last card is a moment. Before it, every panel knows its next card (the cheapest one you still need,
"Next: Pidgeot $19", "Last: Charizard $395" when one is left) in the Chase and Need lenses and in gold on the binder
header, where a tap brings that card up; when the last card of a set or a chase lands, the binder goes quiet, the card
lifts to the centre and grows, "Complete" stamps itself across the header in gold with the bar filling gold under the
shimmer, and the card settles back, after which the finished panel wears a gold frame and offers Keep on the wall or
Put it away (a gold line at the bottom of the wall, listed under Finished in Settings with Back on the wall).

## What changed
- Added `78-lastcard.js` (one part; nothing replaced or removed; `index.html` untouched, the Finished section is
  injected into `dialog#prefs`). It redefines, by hoisting:
  - `setOwned` (a copy of the base with the finish check; the base's completion branch assigns `g.burst` where `g`
    isn't declared, so finishing a set in the base throws; this copy has no such line), `markAllInSet` (Select all can
    finish a set too), `updateCount` and `layoutAll` (both call `refreshFinish`, which caches `g.fin = { complete,
    next, left }` per set and chase group; computed when a card changes or the wall is laid out, never per frame).
  - `finishHits`: after a mark, a group that was not complete before and is now, and contains the card, has just
    finished. A set finishes in the view it's in (`scopedCards`, keyed `base1`, `base1:master`, `base1:grand`); a
    chase by its `g.base` of twins. A twin finishing a chase and its set at once gives one toast naming both.
  - `finish`: in the open binder, `startLastCard` (unfocus, fly to the framed set so the header is on screen, then
    the moment: lift 0 to 520 ms, stamp 420 to 760 ms with `g.burst` and a tick when it lands, hold, settle 1700 to
    2200 ms); on the mosaic, a `panelFlashes` entry (frame pulses twice, the stamp lands and fades by 1.9 s). The
    toast with Undo waits until the card settles in the binder. `finished[key] = { at, away }` persists to
    `wall-done`; Reset the demo clears it; taking a card out of a finished group drops the record (and brings a
    put-away group back).
  - `drawSet` (the other cards dim to 0.38 while the card is up; the lifted card is skipped in its pocket),
    `drawHeader` (the gold "Next:" or "Finished Oct 6, 2026" after the count with `g.nextHit` for the tap; the stamp
    at rest on the title line, the title fitted to make room; the bar's last segment fills as the stamp lands; a
    chase draws both header buttons), `drawHdrBtn` (Keep on the wall / Put it away, the current one gold-tinted),
    `headAt` (the Next line first, then the buttons), `tap` (one branch for keep and away), `panelStat` ("Complete";
    Need: the cheapest card you still need; Chase: the cheapest chased tile, deal price if live; shorter forms on a
    narrow panel so the set's name keeps its room), `drawPanel` (gold frame and gold stat on a finished panel, the
    flash pulse, the bar fill), `drawTraders` (the base body plus `drawLastCard`: the lifted card and the panel
    stamp), `mosaicLayout` (put-away groups fold to `W_FOLD` lines after the New chase panel, out of the treemap).
  - The group's `sub` is wrapped so the list view's section line adds ". Next: Scraggy $0.10." or ". Complete,
    finished Oct 6, 2026."
- `styles.css`: the Finished rows in Settings (gold left rule, date, Put it away / Back on the wall).

## Try this first on the phone
1. Skip the welcome (or import), scroll to the end of the wall and open "Every Charizard" (6 cards). The header reads
   "Your chase. 0 of 6  Next: Charizard $0.33" in gold; tap the gold line and that card comes up. Mark five with Mark
   (or press and hold and sweep), then tap the last one and I have it: the binder dims, the card rises to the middle,
   Complete stamps the header, the bar turns gold under the shimmer, the card settles back, then the toast with Undo.
2. Tap Put it away: the panel flies to a gold line under New chase at the bottom of the wall. Settings lists it under
   Finished with Back on the wall. Tap the gold line to open it; Keep on the wall brings it back.
3. Need or Chase lens: every panel's stat is now its next card. Finish a set from the mosaic (Chase lens, Got it on
   the last tile, or Mark in the list) and the panel's frame flashes gold with the stamp landing on it.

## Gesture contract
All checks pass (dpr 1 and 2). Tap, pinch, drag and the composed levels are unchanged. New tap targets: the gold Next
line in a binder header, Keep on the wall and Put it away in a finished group's header (where Chase these and Remove
sat), and the put-away gold line at the bottom of the wall (opens as any folded panel).

## Frame budget
`npm run test:perf -- --variant r15-bold-last-card`: mosaic 16.7 ms per frame, held pinch 16.7 ms per frame (budget
34 ms; the base measures 16.7 / 16.7). Completion and the next card are cached per group; per frame the variant adds one
stroke per finished panel, and the moment draws one card and one stamp.

## Unsure about
- The camera flies back to the framed set before the lift so the stamp lands on a header you can see. If the last card
  was marked deep in a long set while zoomed in, that's a flight plus a lift; it might be calmer to leave the camera
  and stamp the header off screen, but then the moment is just a big card.
- Put it away sits at the bottom of the wall, after New chase, as a gold line. In the Chase lens a finished panel folds
  among the other folded lines in wall order rather than sinking to the bottom.
- The Settings list shows every finished group, kept or put away, with the matching action; it could show only the
  put-away ones if that reads as clutter.
- A master set and the plain set finish separately (`base1` and `base1:master`); the Finished list says "Base Set
  master set" for the second. Switching a finished set to its master set view takes the stamp off until that view is
  complete too, which is right but might surprise.
- In the Chase lens the Next price is the live deal when there is one, else market; in Need it's market. The feed tile
  beside it shows the most you'd pay (85% of market), so the two numbers differ by design.
- Reduced motion: the card appears at the centre for 1.3 s and the stamp is simply there; the toast comes at once.
