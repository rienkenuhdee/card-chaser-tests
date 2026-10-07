# r15-safe-finish-line

**Round:** 15. Finishing a chase: what happens when the last card lands, and how does a set or chase show how far along it is before then?
**Concept:** Completion the way a checklist app does it. The progress bar every panel already has carries more (gold ticks along its empty part are the missing cards on your chase list), and when the last card lands the bar fills to gold with a one-time shimmer, the binder line reads "Complete ✓" then "Complete since Oct 6", the panel gets a gold hairline frame and a "Complete" stat, and a Finished filter folds what's done to one gold line at the bottom so the wall is just the work left.

## What changed
- Added `78-finish.js`. Redefines `setOwned` (completion check for every set, in its current view, and every chase; the completion toast names the group you're in, with Undo), `markAllInSet` (same check; also writes the mark to the card behind a twin, so All inside a chase marks the real cards), `updateCount` (the quiet check after an import, a trade or a chase change), `drawHeader`, `drawPanel`, `panelStat`, `mosaicLayout` (the Finished fold, combined with the picked-sets fold), `markFilters`, `drawList` (a "Complete since" line per finished section, a Finished line at the end when the filter is on).
- New: `finOf(g)` caches per group (owned count, done, tick positions) keyed on a version that bumps when a card or the chase list changes, never per frame; `syncDone()` records finish dates in localStorage `wall-done` (a master set completes separately from the set: the key carries the view) and forgets them when a card is taken out; `drawBar()` draws the slot, fill, gold, ticks and the glint; `setFinished()` toggles the filter (localStorage `wall-fin`) with the wall's usual morph flight; `packFinFold()` keeps a small chase's cards as dots in the fold.
- The Finished entry is appended to `#filter-menu` from the part (no markup change). Reset the demo clears `wall-done` and `wall-fin` too.
- `styles.css`: the finished lines in the list view are gold.
- Reduced motion: no fill animation, no glint, no sweep. Dark mode: `theme.gold` and the CSS variables throughout.

## Try this first on the phone
1. Import, open Every Charizard, Mark, All. The bar fills to gold with a glint, the sweep runs, "Complete ✓" becomes "Complete since Oct 6", and the toast says so.
2. Back: the panel wears a gold hairline and reads Complete. Filters (the sliders button) > Finished: it folds to "Finished: Every Charizard" in gold at the bottom; tap the line to open it again.
3. Before finishing anything, look at the bars on the wall: the gold ticks on Everything by Arita and Full art in 151 are the missing cards you're chasing; Base Set's few ticks say most of what's missing isn't on your list.

## Gesture contract
All checks pass.

## Frame budget
mosaic 16.7ms per frame, held pinch 17.8ms per frame (both within 34ms).

## Unsure about
- The ticks are hidden during the welcome's set picking (noise before you've done anything); with a big chase like Everything by Arita they merge into a gold comb, which reads as "all of it is on your list" but might read as a glitch at first.
- A group that is already complete when the wall first sees it (an import that happens to fill a chase) gets today as its finish date; there is no earlier date to use.
- "Complete" wins over "N to go" and "Nothing to chase" in every lens except Value (the worth stays) and Trade (spares stay). Should Value show "Complete" too?
- The folded Finished line shows the finished groups' cards as a tiny row of dots; one line for all of them means a short chase's segment is narrow to tap when several are finished.
