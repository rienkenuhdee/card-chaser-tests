# r10-safe-trade-matches

**Round:** 10. Trading: your spares meeting someone else's wants.
**Concept:** The Trade lens works exactly like Chase: your spares lift out in front inside their panels as tiles
(market value, "Wanted by 3", who has what for you), panels with no spares fold, and the wanted spares wear gold.
Tap a lifted spare and it pops up over the wall with a marketplace listing under it: each collector who wants it,
what they'd give from their spares that you chase, the balance, and Propose, which records the trade on this device
and toasts with Undo.

## What changed
- Added `75-trade.js` (one part; nothing replaced or removed, `index.html` untouched: the sheet is injected after
  `#offers`). `styles.css` appended for the sheet, rows and chips.
- Shared data per the round rule (prefix keys: `${t.id}|o|${c.id}`, `|s|`, `|c|`): `TRADERS`, `tOwns`, `tSpare`,
  `tChase` exactly as given. With this collection that is 44 spares, 17 wanted by someone. Proposals persist in
  `wall-trades` (`{to, give, get: [ids], cash, yours, at}`); Reset the demo clears it.
- Redefined `orderGroup` and `layoutAll` so the lead list is lens-keyed: Chase leads with chases (`chaseOrder`, as
  before), Trade leads with spares (`tradeOrder`: most wanted first, then dearest). `lifted` is true for either lens.
- Redefined `liftLayout`: same as the base, plus going straight from Chase to Trade (or back) is a morph flight, not a
  cut (`liftLens` remembers which lens the lifted layout is for).
- Redefined `drawTile` with one change: the feed-tile path no longer requires the card to be unowned. `drawFeedTile`
  now dispatches: a card you chase draws as before; a card you own draws `drawSpareTile` (value and "market" left;
  right: "Wanted by N" in gold over "Maya has Blastoise" / "Theo offers cash", or "Proposed" over "to Maya", or "No
  takers yet"). Wanted spares get a gold tint and stroke (`wantTint`, like `dealTint`).
- Matching (`matchOf`, cached per card, cleared in `layoutAll` and on propose/withdraw): a trader's offer is a bundle
  from their spares you chase, picked greedily to come as close as it can to your card's value (up to four cards).
  If it still falls short by more than a quarter they add cash; if it runs over by more than a quarter you add cash
  ("You give $3.06 and $2.96 cash, get $6.02"); nothing you chase means cash at market. Offers sort card offers
  first, closest balance first, cash last; the tile's name line is the top one.
- Redefined `popCard`, `closePop`, `popRect`: the pop-up is shared with Chase. A card you own pops over the trade
  sheet (`body.trading`), a card you chase over the offers sheet (`body.offering`). `popRect` measures whichever
  sheet is up. Escape, a touch on the wall, the close button and a lens change all put the card back.
- The sheet: title and meta ("Evolving Skies, EVS 93/203. Market $3.06. Your spare."), a line ("1 collector wants
  it. Pick one to propose a trade." / "Proposed to Priya." / "Nobody wants this one yet. It stays up for trade."),
  one row per collector (name and town, balance, chip strip of what they'd give with price and set number, a Cash
  chip when cash is part of it, Propose). Propose records and toasts "Proposed to Maya: your Charizard for her
  Blastoise." with Undo; the row turns gold with "Proposed ✓", tapping it withdraws (also with Undo). A "Spare ✓"
  button at the bottom takes the card off the trade pile, like "Chasing ✓" on the offers sheet.
- Redefined `setLens` (closes the pop when leaving Trade as well as Chase; the Trade toast adds "N that someone
  wants"), `panelStat` ("8 spares, 2 wanted" / "No spares"), and reassigned the card panel's Spare toggle so it flies
  the Trade layout to its new shape, as Chase it does for Chase.
- Redefined `drawList`: a "Your spares" section on top in the Trade lens (wanted ones first, "Wanted by 1" or
  "Proposed to Priya", an Offers button that opens the same sheet) and set rows read "Spare, wanted by 1".

## Try this first on the phone
1. Tap **Trade**. The spares deal out of their panels like the chase list; scroll to Team Rocket (five gold tiles:
   "Wanted by 2, Theo has Moo-Moo Milk"). Tap **The Boss's Way**: the card pops up and the listing slides under it,
   Theo (Moo-Moo Milk and $0.07 to even it up) and Maya (Eevee, you add $0.16). Tap **Propose** on Theo, read the
   toast, tap **Undo**, propose again, put the card back and see the tile now say "Proposed to Theo, 1 more wants
   it". Then tap **Chase** and watch the spares fly home as the chases come out.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing in navigation changes; the Trade lens uses the Chase lens's lift layout,
and the pop-up uses the Chase pop-up's touch capture.

## Frame budget
`npm run test:perf -- --variant r10-safe-trade-matches`: mosaic 16.7 ms per frame, held pinch 17.8 ms per frame
(budget 34 ms). Matches are cached per card and recomputed only when the layout is; the spare tile sets fonts
through `font()` and fits names through `fitText()`.

## Unsure about
- The wanted spares are mostly cheap commons and uncommons (the dearest wanted one is $1.09), so most trades are
  small change and the cash top-ups read as cents ("$0.07 to even it up"). Rounding to whole dollars only above $5
  keeps the arithmetic honest, but a trader may not want to see cents at all.
- The balance evens with cash from either side. Is "your Galarian Moltres and $2.96 cash for her Silvally" the kind
  of trade we want to suggest, or should a bundle that overshoots just show the uneven balance and let the people
  sort it out?
- Pronouns for the made-up traders ("her", "his", "their") are a small map next to TRADERS. Dropping them ("for
  Blastoise") would be safer if the names are ever real.
- The Trade lens keeps set order, so the wanted spares can be a scroll away. Panels with a wanted spare could come
  first, but then the wall would not be "exactly as it was" between lenses.
