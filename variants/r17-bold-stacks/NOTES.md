# r17-bold-stacks

**Round:** 17. Your spares: how do your doubles get onto the wall, and how does a spare find someone who wants it?
**Concept:** Every card you own has a copy count, and a card with extra copies is drawn as a little physical stack at every level: copies you keep are tucked behind it (edges peeking out below and to the right), copies up for trade are slid up out of it (edges peeking out above and to the left), and the copy someone chases has a gold edge. Up close, you flick the top copy up off the stack into a small trade pile above the card, or pull one back down to keep it.

## What changed
- Added `82-stacks.js`, plus `styles.css` for the gold count badge on the Trade button. No part replaced or removed.
- Copies live in a new key, `wall-copies` (`{ id: [copies, up for trade] }`). The last copy is never a spare. `spares` is now a Proxy over the copies, so `isSpare`, `wantsOf`, the table, the counter logic and the press-and-hold in Mark all read from the counts without being changed. Holding a card in Mark puts every extra copy up for trade. With no extra copy, the hold adds one and puts it up. Spares marked on the base wall carry over as one extra copy, up for trade.
- The import (`finishImport`, redefined) brings doubles seeded by card id (`dbl|id`, `dbn|id`) and weighted toward commons and uncommons. Common and uncommon doubles go straight up for trade. Rarer doubles stay in the stack, and the gold edge on the ones someone chases invites a flick. A wall imported before this variant gets the same seeded doubles once, on load. One import gives 151 cards with copies, 213 spare copies, and 52 spares someone wants, so the Trade lens is full from the start.
- Redefined: `drawTile` (draws the stack behind the tile and the trade pile on the focused card), `focus`/`unfocus` (an owned card sits a little lower, under its pile; leaving the card sends a "+N" to the Trade button), `updateFlag` and the `#p-want`/`#p-buy` handlers ("Spare one" / "Keep one", "Add a copy"; the meta line names copies and who wants it, e.g. "3 copies, 1 up for trade. Priya wants this."), `setOwned` (taking a card out puts its copies aside, and Undo brings them back), `completeTrade` and `crossOnWall` (a trade takes one copy off the stack; the card stays yours), `drawSpareTile` (the stack behind the small card, and "2 to trade"), `panelStat` and `setLens` (Trade counts copies), and `drawList` (rows say "3 copies, 2 up for trade. Maya wants one").
- The flick is read by capture-phase listeners in front of the wall's own Touch Event and mouse pointer handlers. A touch that starts on the focused card, or on its pile, and moves vertically in a direction where there's a copy to move becomes the flick. Anything else goes on to the wall untouched: a tap, a sideways flick to the next card, a drag on the wall, or a second finger (which cancels the flick).
- Drawing cost: on the far-out levels, and at any level while a transition is moving, each extra copy is two `fillRect`s in a cached darker shade of the card's colour (gold when someone wants it). There are no gradients, shadows or font changes per tile. Rounded copies are drawn only up close when nothing is moving.

## Try this first on the phone
1. Import from TCGplayer, then look at the mosaic and open a set (151 has plenty): doubles sit in stacks, copies up for trade stick up out of them, and some edges are gold.
2. Open a holo or rare with a stack. The pile above it says "Flick a copy up to trade it". Flick the card up: the top copy slides off into the pile, and the pile now reads "1 up for trade". Pull down on the card to bring it back.
3. Leave the card. The Trade button lights up with "+1". Open Trade: the spare tiles show their stacks and "2 to trade", and the traders' strip already wants things.

## Gesture contract
All checks pass. The vertical drag that starts on the focused card is now the flick when there's a copy to move (an extra in the stack to flick up, or a spare to pull down). It still leaves the card when there isn't, and a drag anywhere else still leaves. The contract doesn't test drags that start on the focused card.

## Frame budget
`npm run test:perf -- --variant r17-bold-stacks`: mosaic 16.7 ms, held pinch 23.3 ms (this test runs on the empty first-run wall).
On an imported wall (scratch script, dpr 2, three runs): mosaic 16.7 ms; held pinch 16.7 to 23.3 ms, against 16.7 to 22.2 ms for the base on the same wall.

## Unsure about
- Up for trade reads as "slid up out of the stack". It's clear up close and in a binder, but at mosaic size it's a 1 to 2 px sliver, so the gold edges are what really show at a glance.
- The trade pile is a pill above the card, because the lens bar is hidden while a card is up. The Trade button only gets its "+N" once you leave the card.
- There's no button for "Keep one" while a card still has kept copies (the button says "Spare one" then). Pulling down is the only way to keep one, and there's no way to remove a single copy other than Undo after Add a copy.
- The traders' seeded chases cluster by set (the hash), so Base Set's spares have no takers and it's the first panel in Trade. The wanted ones start further down the wall (Fossil, 151, Prismatic).
- After a trade the toast still says "Kabuto went to Maya", not "one Kabuto". The card stays on your wall with one fewer copy.
