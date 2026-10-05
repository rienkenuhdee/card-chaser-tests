# r14-radical-chase-sentence

**Round:** 14. How does a collector define a chase: a set, one Pokémon, one artist, a dex with options (full art
only), or any combination? And how does a set show the cards people typically chase in it?
**Concept:** A chase is a sentence you type in the search box: "tangela", "arita full art", "151 holo", "base set
charizard". The search knows a few plain words and card facts, the wall rings what matches, and Chase these keeps the
sentence: it stays as a chip under the box, every matching card you don't have is chased, and the wall flies to its
Chase shape with those cards first. Each set's panel says what people chase in it, one tap from the same box.

## What changed
- Added `77-sentence.js` (one part; nothing replaced or removed, `index.html` untouched: the row under the search
  box and the menu items are injected):
  - The vocabulary (`VOCAB`, built once from the wall): modifiers (`full art` is tier 4 and up, `holo`/`foil` tier
    3 and up, `rare`, `secret`/`hyper`/`rainbow`, `common`, `uncommon`, `ex`, `v`, `vmax`, `gx`, `mega`, `dark`,
    `trainer`, `energy`, `pokemon`, `starters`, `missing`/`need`, `have`, `vintage`/`modern`, `deal`, `cheap`,
    `expensive`); types (`fire`, `electric`, `steel`...); set names, their words and codes; every Pokémon name with
    suffixes (ex, V, VMAX, VSTAR, GX) and prefixes (Dark, Mega, Alolan...) stripped, matched by Dex number so
    "charizard" is every Charizard; trainers and energy by name; artists by full name, surname or first name; card
    numbers. Longest phrase wins ("mr mime", "full art"), "mew" is the Pokémon before the set code, filler words are
    dropped (and, or, the, cards, chase...), anything unknown falls back to the base's substring match so a plain
    name or a half-typed one behaves as before.
  - `sentence(q)`: parsed once and cached (`parsed`), facts of one kind OR together ("charizard blastoise"), kinds
    AND together ("base set charizard"). The card set is computed once per sentence, never per frame.
  - Saved chases (`chases`, localStorage `wall-chases`, an array of sentences re-parsed on load). `applyChases()`
    sets `c.chase0` for every card a saved sentence matches, so the base's `isChase` (`chasing[id] ?? c.chase0`)
    does the rest without being redefined: a hand-picked off wins over a sentence, a hand-picked on is independent.
    `saveChase` (toast with Undo), `removeChase` (toast with Undo), `runSentence` (puts it in the box and runs it).
  - Redefined `runSearch` (the sentence instead of `matchQ`; the same flights: one match goes to the card, one set
    opens it, several sets stay on the mosaic with rings), `updateCount` (placeholder; keeps the row in sync).
  - The row (`#srow`, under the strip, part of the mosaic's layout, 44 px): with the box empty it shows "Try" and a
    few sentences from the wall itself (`suggest()`: the most popular cards you don't have, the artists with the
    most cards you don't have, the set with the most full arts to find, a vintage set with holos to find); while
    typing, "14 cards, 9 to find" and Chase these (Stop chasing when the sentence is already saved); otherwise your
    saved sentences as chips (tap to re-run, × to remove, "+ New chase" focuses the box). Hidden in a set unless the
    box has text, and while trading, offering, paying, focused or in the list.
  - The top-left chase menu gets "Your chases" under the four layouts (`syncMenu`); the list view gets "Your chases"
    at the top with Remove, and Chase these for the sentence in the box (`drawList` redefined).
  - Popular cards, the rule every variant shares: `popScore = tier * 2 + log10(price + 1) * 1.5 + h32(id + "p")`,
    the top max(3, round(0.06 × set size)) per set get `c.pop`. Each set caches `pcLine` ("Charizard, Venusaur,
    Blastoise...", species names, deduplicated) and `pcq` (the sentence "Base Set Charizard, Venusaur, Blastoise").
  - Redefined `drawPanel` (the "People chase" line under the name, gold label, names in ink, `fitText`, only on
    panels at least 150 px wide and not folded; hidden while picking sets), `tap` (a tap on that line runs the
    sentence), `drawSet` (a small gold corner on popular cards in the binder), `packPanel`, `packLifted`, `liftedH`,
    `mosaicLayout`, `liftedLayout` (room for the row and the line), `orderGroup` (the newest sentence's cards lead
    each set in the Chase lens, then live deals, then the most you'd pay).
  - Cmd/Ctrl+Enter in the box is Chase these. Reset the demo clears `wall-chases` too.
- `styles.css`: the row and its chips (saved ones in a gold tint), the menu section, the list's "popular" tag; the
  toast moves below the row on the mosaic.

## Try this first on the phone
1. Import, then type "arita full art" (or tap a Try chip): the wall rings the matches and the row reads "16 cards,
   6 to find". Tap Chase these: the sentence becomes a chip, the wall flies into Chase with those six out in front.
2. Clear the box and tap "People chase Charizard, Venusaur..." under Base Set: the set opens with those ringed and
   the row offers Chase these again. Inside any set, the popular cards wear a gold corner.
3. Try "151 holo", "charizard blastoise", "team rocket dark", "mew", "fire 151", "evolving skies secret". Tap the
   top-left menu: your sentences sit under the layouts. Settings, Show as a list: the sentences are there too.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing about tap, pinch, drag or the composed levels changes; the mosaic starts 44 px
lower (the row is part of its layout, so nothing jumps when the box is focused), and a tap on the "People chase" band
of a panel runs a sentence instead of opening the set (the rest of the panel opens it as before).

## Frame budget
`npm run test:perf -- --variant r14-radical-chase-sentence`: mosaic 16.7 ms, held pinch 17.8 ms per frame (budget
34 ms; the base measures the same). Per frame the variant adds one cached `fitText` and two `fillText`s per visible
panel, and a small triangle per popular card in a binder. Sentences are parsed once and their card sets cached;
nothing matches per frame.

## Unsure about
- The count sentence ("14 cards, 9 to find") lives in the row under the box rather than in the count button: on a
  phone the button and a sentence can't share the strip without squeezing the input to a few characters.
- The row is always there on the mosaic (suggestions when nothing is saved). It costs 44 px of wall. The alternative,
  showing it only while the box is focused, makes every panel jump when the keyboard comes up.
- "full art" means tier 4 and up (illustration rares, VMAX, ultra), not tier 3 (plain holos, ex double rares), so
  "base set full art" finds nothing, honestly. "holo" is tier 3 and up so "151 holo" works on a set with no "Holo"
  rarity name. Worth a look at whether collectors read those words the same way.
- Artists are seeded per card, so "sugimori pikachu" can come up empty; the row says so and suggests what to try.
- A tap on "People chase" opens the set at the first popular card (the base's one-set flight) rather than staying on
  the mosaic with rings; the row still offers Chase these there. Staying put might read better.
- The newest sentence's cards lead each set in Chase, ahead of live deals, until the next sentence; is that the right
  precedence or should deals always lead?
- Big sets have long "People chase" lines (Evolving Skies names 13 cards at 6%); the panel truncates, the list and
  the sentence carry them all.
