# r10-bold-pairs

**Round:** 10. Trading: your spares meeting someone else's wants.
**Concept:** The unit of the Trade lens is the pair, not the card. Switching to Trade lifts swap tiles out in front
inside their panels (the chase lift, generalised so Trade leads with pairs): your spare flies out of its slot to the
left, the collector's spare you chase sits on the right as a chip in their colour, their name between, and a balance
beam underneath that tips toward whoever comes out ahead with "You give $1.09, get $0.56. Down $0.53." in figures.
Tap the beam and the wall suggests a cheap spare (yours or theirs) to even it up, and it slides onto the tile; tap the
tile to flip through the other pairs for the same spare; hold it, or tap Propose, to record the trade with a toast and
Undo. Panels with no pairs fold.

## What changed
- Added `75-pairs.js` (one part; nothing replaced or removed; `index.html` and `styles.css` untouched).
- Data per the shared rule: `TRADERS` (Maya, Theo, Jun, Priya) and `tOwns`, `tSpare`, `tChase` with the prefix keys
  the coordinator sent mid-round (`${t.id}|o|${c.id}` etc.; the suffix version correlated with the ownership hash and
  yielded two matches in the whole collection). Each collector's chase set and spare list is worked out once at start.
  A pair is `{ mine, t, theirs, adds }`: your spare, a collector who chases it, one of their spares you chase. Pairs
  for a spare are sorted closest in value first; pair objects persist across relayouts so adds and animations survive.
- Proposed trades: `localStorage["wall-trades"]`, `[{ id, t, give: [ids], get: [ids], at }]`; the first card given
  leads the tile. A proposed tile stays in place, goes gold, the chip slides over to join your card, the centre reads
  "Proposed to Maya, waiting to hear back", the pill becomes Take back. Cards in a proposed trade leave every other
  pair (their card is no longer offered; a spare of yours thrown in as an add is no longer a lead). Undo on the toast,
  or Take back, puts it all back. Reset the demo clears `wall-trades` too.
- Lift generalised: `layoutAll`, `orderGroup`, `liftedH`, `packLifted`, `liftLayout` redefined with a `liftKind`
  (`chase` or `trade`). In Trade a lead is a spare with pairs (or a proposed trade); its `c.m` is the card slot inside
  the 156 px pair tile (`c.pair`), so the base morph flies the real card out of its mosaic slot into the tile, and
  opening the set grows it on into the binder. Pair tiles are one across on a phone, two per panel on a wide screen.
  Chase→Trade and back fly too (different cards lead). Chase itself is unchanged: its branch is the base code.
- Drawing: `drawPanel` redefined (a copy plus `drawPairs` at the end, so the tiles fade in with the labels as a lens
  flight settles and fade out as a set opens). The tile: your card (the base `cardFace`), the collector's chip (flat
  colour, label strip, their name, `short(price)`; no gradients), name and "Your X for Y" between, Propose pill, pager
  dots under the chip, the beam (a 2 px bar on a fulcrum, angle eased per frame so it swings as weights land; tips at
  most 3.5°), the balance sentence, and an "Even it up" pill when the gap is more than a quarter or 8%. Adds are 44 px
  chips that slide out from behind the card they join. Reduced motion: no flip, no slide, no swing.
- Input: `tap` and `liftedAt` redefined (the whole pair tile is the hit area; the pill proposes or takes back, the
  beam band evens up, anything else flips). Press and hold (560 ms, fingers read from `e.touches`; mouse via pointer
  events) fills the Propose pill green and proposes; the tap that follows a fired hold is swallowed. `panelStat` reads
  "3 swaps", "1 proposed" or "4 spares, no takers". `setLens` copied for the Trade toast ("14 swaps on the table with
  2 collectors"). `flagBtn.onclick` reassigned so Spare on the card panel relayouts in Trade (and a spare taken back
  drops its proposed trade). `drawList` redefined: a Swaps section on top with Propose or Take back per row, and
  "Spare, in a trade" on cards that are promised.
- Even it up: you're up, so one of your spares goes on; you're down, so one of theirs does. Candidates never go far
  over the gap (1.3× + 50¢); closest to the gap wins, a card the other side actually chases wins a tie, and your spares
  that have swaps of their own are kept for their own tiles. Up to three adds, then "That's as close as it gets."

## Try this first on the phone
1. Tap **Trade**. The wall folds to the sets with swaps and your spares fly out into pair tiles beside Maya's and
   Theo's cards. On the first tile (Here Comes Team Rocket!, down $0.53) tap **Even it up**: Maya's Ursaring slides
   out from behind her chip and the beam swings level. Tap the middle of a tile to flip to the next pair (the chip
   turns over, the dots move, the beam re-tips). Hold a tile until the pill fills, or tap **Propose**: the chip slides
   over to join your card, the tile goes gold, the toast has Undo. Tap **Have** and everything flies home.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing about pinch, scroll, tap-to-open or the slide between sets changes; the hold
to propose only arms on a pair tile in the Trade lens and cancels on 8 px of movement or a second finger.

## Frame budget
`npm run test:perf -- --variant r10-bold-pairs`: mosaic 16.7 ms per frame, held pinch 17.8 ms per frame (budget 34 ms).
Measured separately with Trade on and 14 tiles laid out: 16.7 ms per frame (the vsync cap). Chips are flat fills,
text goes through `font()` and `fitText()`, the only gradients are the base card faces (one per lead), no foil while
anything moves (the base rule), and only tiles on screen are drawn.

## Unsure about
- Pairs lead with the closest value, so the front of most tiles is near-even and the beam is flat until you flip.
  Leading with the card of theirs you'd most want (their highest value) would show the beam and Even it up on first
  sight, at the cost of a sillier default (Mew ex for a $3 Moltres).
- Under the shared rule the matches are cheap commons (a dime for a dime), so the beam is working at the nickel level.
  Evening up a 7¢ gap is a bit comic; the tolerance (a quarter, or 8%) calls those even already.
- The proposed tile stays in place rather than flying home. It keeps the record visible on the wall; a "Proposed"
  section in the list does the same. If Ryan wants proposed trades out of the way, they could fold to a line.
- Long card names truncate in the centre column ("Your Here Comes Team Rocket! fo…"). The card and chip carry the
  names too, but at 60 px they're tiny; the list view has them in full.
- Hold to propose and Propose do the same thing. The hold was in the brief; if it never gets found, the pill alone is
  the clearer contract and the hold can go.
