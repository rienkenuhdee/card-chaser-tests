# r17-radical-trade-binder

**Round:** 17. Your spares: how do your doubles get onto the wall, and how does a spare find someone who wants it?
**Concept:** Your spares live in a trade binder: nine-pocket pages, the most wanted first, each pocket naming who chases it under the card, swiped sideways like a real binder, and filled from copy counts the import brings (doubles seeded by card id, mostly commons and uncommons). Show mode turns it into a dark, full-screen spread you hand across a table at a show; the other person taps what they'd like, and when you take the phone back the trade is built on the table with whoever it was.

## What changed
- One added part, `85-trade-binder.js` (after 80 so its redefinitions win), and `styles.css`. No part replaced or removed; no markup change (the bars and the menu are created in JS).
- **Copies** (`wall-copies`): `copiesOf(c)`. An imported card brings `dup0` extras (seeded `${id}|dup`, rates 30% common, 22% uncommon, 10% rare, 4% holo; about 116 binder cards from the 541). The base's `spare0` is now a getter: a card with an extra copy is in the binder unless you took it out.
- **Binder** (`wall-binder`): `spares` is reassigned to a Proxy over the binder map, so every base path that sets a spare (the hold in Mark, the reply code) lands in the binder, and putting a card in bumps it to two copies. `wall-spares` is left as it was (the Proxy's `toJSON` returns the base's own value).
- **Trade lens**: no longer lifts spares out of the panels (Chase still lifts). The wall stays a wall with your spares lit, and the binder's cover (its first page in small) sits at the top above the trader chips. Redefined `layoutAll`, `mosaicLayout` (trade header added), `liftLayout` (a flight whenever the trade header comes or goes), `setLens` (the toast), `emphasis` (the focused card is never dimmed; marking in Trade lights everything you own), `hit`, `enterGroup` and `openRoom` (the cover opens the binder on a tap or a spread), `drawTraders` (draws the cover too).
- **Binder level**: a level of its own like the trophy room (`openBinder`/`closeBinder`, Back, a pinch, Escape). The cover's small page grows into the page. Pages are painted once into the corner of the wall's canvas, copied to an offscreen canvas and kept (at most six). A turn folds the page about its rings, scrubs under the finger, and snaps by speed, then by distance. Wide screens show a two-page spread with the rings at the spine. Redefined `drawMosaic`, `setChrome`, `backBtn.onclick`. While it is up the binder owns every touch on the canvas (Touch Events; mouse through pointer events), like the table.
- **Pocket tap**: one chaser opens the table with them, the card already on it. Several chasers bring up a small "Trade X with" menu first. Hold a pocket to take it out (Undo). Redefined `openTable` (pre-placed cards; your cards fly out of their pockets).
- **Show mode**: the page lerps to a dark, near edge-to-edge spread with no chrome except a Prices shown/hidden pill and a bottom bar ("3 cards picked", Done). Taps toggle picks, a pinch does nothing, and who wants what isn't shown. Done asks "Who was it?" (traders sorted by how many of the picks they chase, plus Not now) and opens the table with the picks on your side.
- **Filling it from the wall**: (1) in the Trade lens, Mark picks instead of marking. Tap or sweep, then **Into the trade binder**, and a copy of each lifts out through the top (`flyCard`). A card already in gets another copy. Redefined `markCard`, `beginStroke`, `updateBar`, `leaveMark`, Mark's Undo/Done. (2) On a card you own, the panel's Spare is now **To binder**. Tap it, or drag the card down out of its close-up: it shrinks against the panel's edge and the button lights. Let go and a copy flies into the button. Redefined `updateFlag` (the panel says "You have 3, 2 in your trade binder") and `flagBtn.onclick`. (3) On the wall, any card you have more than one of shows "×3" in its corner, gold while a copy is in the binder (drawn in the redefined `drawMarks`).
- **Trades give a copy**: `completeTrade` and `crossOnWall` decrement the count and only take the card out of your collection with its last copy.
- **Import**: `finishImport` says "541 cards imported from TCGplayer. 116 doubles are in your trade binder." with Open, which goes to the Trade lens and opens the binder.
- `toast` rewrites the base's "is a spare, up for trade" to binder language. `tradeListHTML` leads the list view with the binder in its order, with Take out. Reset clears the two new keys.

## Try this first on the phone
1. Reset the demo, import from TCGplayer, and tap **Open** on the import toast. The cover's page grows into the binder. Swipe the pages slowly (the page folds under your thumb), then flick.
2. Tap **Show mode**, hand the phone to someone, let them tap a few cards, then take it back and tap **Done**. Pick who it was, and the table opens with those cards on it.
3. In the Trade lens open 151, tap **Mark**, sweep a row, then **Into the trade binder**.

## Gesture contract
All checks pass. The binder level adds its own moves (sideways swipe turns a page, a pinch closes it, hold takes a card out) but changes nothing the contract checks. One base behaviour changed outside the contract: in a card's close-up, a **downward drag that starts on a card you own** now carries it to To binder instead of leaving the close-up. Upward or sideways drags, and drags off the card, still leave or flick as before.

## Frame budget
`npm run test:perf -- --variant r17-radical-trade-binder`: mosaic 16.7 ms, held pinch 20.0 ms (budget 34). Measured the same way: the Trade lens with an import 16.7 ms, the binder at rest 16.7 ms, mid-turn 17.8 ms, Show mode 16.7 ms (vsync-bound; a binder frame is a few drawImage calls). Painting a page is one-off, about three pages when the binder opens.

## Unsure about
- **Lift versus binder.** The Trade lens no longer lifts spare tiles out of each panel: the binder is where spares live, and the wall just lights them. If the lift was loved, it could come back under the cover, but the two say the same thing twice.
- **Who was it?** Show mode's hand-back asks the user to pick from the four made-up traders. A real show has strangers, so this needs a "Someone new" path (a name, or scan their app) before it's honest.
- **"In person or Online" is skipped** from the binder: a binder is in person by nature. Opening the table from a trader chip still asks.
- **Copies are made up and coarse.** A card taken out and marked again comes back with its seeded count. There's no stepper for "I have 4"; extra copies only come from the import, the sweep (one more each time) or dragging a card in again.
- Show mode is always dark, whatever the theme. It reads well and makes the cards pop, but a bright show floor might want it light.
- 116 cards on 13 pages is a lot of dots. Real binders are like that; the most wanted first is what keeps it usable.
