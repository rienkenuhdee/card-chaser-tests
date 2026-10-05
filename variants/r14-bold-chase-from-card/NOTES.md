# r14-bold-chase-from-card

**Round:** 14. How does a collector define a chase (a set, one Pokémon, one artist, a dex with options, any
combination), and how does a set show the cards people typically chase in it?
**Concept:** A chase is built from the card you're looking at, not a form. Under Chase it, on the card panel and in
the Chase pop, a row "Chase more like this" offers one-tap rules made from that card's own facts with a live count of
what you don't have ("Every Venusaur 4", "Everything by Yuka Morii 68", "Full art in 151 25", "Morii's Venusaurs 2",
"All of 151 34"); a tap saves the rule, every matching card you don't own flashes gold where it sits and joins the
Chase lens, and the saved chases live in the top-left chase menu with counts and Remove. Popular, a filter by the
search box, dims every card but the ones people chase in each set, names them on the panel, rings them in gold, and
a tap on a panel's names offers "Chase these".

## What changed
- Added `77-morelike.js` (one part; nothing replaced or removed, `index.html` untouched: the chip rows, the menu
  section and the Popular entry are injected):
  - The rules: `wall-chases` is an array of `{ kind, set, pokemon, dex, artist, fullArt, popular }` (`kind` only
    picks the label; the other fields AND together for matching; `dex` is added to the shared shape so "Every
    Charizard" means the Dex number when there is one and the suffix-stripped name, `baseName`, for trainers).
    `species(c)` is the shortest printed name for a Dex number, so Dark Charizard, Charizard ex and Mega Charizard
    ex all read as "Every Charizard".
  - `isChase` is a `const` in 64-chase, so it can't be hoisted over; instead the rules are folded into `c.chase0`
    (`applyRules`, run at load and whenever a chase changes, never per frame). `isChase` already reads
    `chasing[c.id] ?? c.chase0`, so a hand-picked on or off wins over a rule, exactly as asked.
  - `rulesFor(c)`: Pokémon, artist, full art in the set (only when the card is tier 3+), artist + Pokémon, popular in
    the set (only when the card is popular), the whole set; rows that would match a single card or the same cards as
    a row above are dropped; rows with nothing left to find are dropped unless already saved. Two taps are two saved
    chases. A saved row shows ticked and gold; tapping it again removes it.
  - `addRule` / `removeRule`: persist, recompute, flash the cards that just joined (`c.flash = { gold: true }`, a
    beat apart, frames pumped while it plays), fly the Chase lens to its new shape (`liftLayout(true)`, with
    `pop.from` moved to the tile's new place under the pop), and a toast with Undo. Inside a set with a card up
    close, the reshuffle waits until the card goes back (`liftPending`, redefined `unfocus`) so the panel stays up
    and a second rule can be tapped.
  - Redefined `fillPanel` and `fillOffers` (copies with `fillChips` added), `drawList` (a "Your chases" section on
    top with Remove; Popular narrows the rows; popular cards say so), `tap` (the stat's offer in front of opening a
    set), `emphasis` (Popular dims to 0.12 on top of any lens), `panelStat` (Popular: "Charizard, Blastoise and 4
    more", fitted to the panel with shorter forms down to "Umbreon +10" and "7 popular", cached per width),
    `layoutAll` (wraps each group's `sub` so the set header reads "People chase Charizard, Venusaur and Zapdos. 4 to
    find."), `drawTile` (a copy with the gold ring for popular cards), `markFilters`, and the Reset handler (clears
    `wall-chases`).
  - Popular: `popScore` and `st.pop` computed once per set at load; `state.popular` is not remembered across loads
    (like Time).
- `styles.css`: the chip row (horizontal scroll, gold when saved), the "Your chases" section in the arrange menu.

## Try this first on the phone
1. Import, open 151, tap a card you don't have (a Venusaur ex or any ex). Under Chase it, tap "Every Venusaur": the
   four Venusaurs flash gold in the binder behind the panel and the toast says 4 to find. Tap "Everything by Yuka
   Morii" too. Close the card, choose Chase: the set reorders with the chased cards first; Back, and the mosaic deals
   them out by set. Open the top-left menu: both chases are there with counts and Remove.
2. Filters (by the search box), Popular. The wall dims to the cards people chase, ringed in gold, each panel naming
   them. Tap the names on Base Set: "Base Set: Venusaur, Poliwrath and 2 more. 4 you don't have. Chase these".
3. In Chase, tap a lifted tile: the pop has the same row under the offers, so a chase can start from a deal.

## Gesture contract
All checks pass (dpr 1 and 2). Tap, pinch, drag and the composed levels are unchanged; the one new tap target is the
names on a panel's label row, only while Popular is on.

## Frame budget
`npm run test:perf -- --variant r14-bold-chase-from-card`: mosaic 16.7 ms per frame, held pinch 16.7 to 17.8 ms per
frame over three runs (budget 34 ms; the base measures 16.7 / 16.7). Popular adds one boolean per tile; the rules
cost nothing per frame.

## Unsure about
- The stat tap in Popular is a hidden affordance: the names look like a label. A small "Chase these" could sit in the
  panel instead, but the label row has no room on a phone.
- On a narrow panel the names collapse to "Umbreon +10" and then "7 popular"; the set title keeps at least 42% of the
  row. Which should lose first, the set's name or the names?
- Rules match all sets they apply to: "Everything by Yuka Morii" is 68 cards across the wall, which makes the Chase
  lens long. Fine for an artist chase, but "All of 151 (34)" next to it is the same button at a different scale.
- The Chase pop's row sits between the offers and Got it, so the sheet is taller and the popped card a little smaller.
- `dex` is an extra field on the shared rule shape; the other variants may store the Pokémon as a name only.
- Removing a rule leaves any card you hand-picked off still off, and any hand-picked on still on, which is right, but
  there is no way to see which cards are hand-picked versus matched.
