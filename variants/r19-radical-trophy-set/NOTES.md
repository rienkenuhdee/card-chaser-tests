# r19-radical-trophy-set

**Round:** 19. How do production's trophy types live in dev's trophy room?
**Concept:** Production's whole trophy catalog becomes one more set on the wall, "Trophies, 31 of 175", near the end
and before the trophy room's door. It works like a set of cards: each medal is a card-shaped pocket. Earned ones are in
colour, unearned ones are empty pockets that say what they need, hidden ones are "?" pockets, and luck (Critical, Shiny)
works as the set's rarity.

## What changed
- Added `90-trophy-set.js` and `styles.css`. Nothing in `src/` was replaced or removed; the completion plaques, the
  shelf and the trophy room work as before.
- **The catalog**, ported from production's `computeTrophies`, `signatureTrophies` and `collectionTrophies`, built from
  the wall's sets and chases (rebuilt when they change), in checklist order:
  - **Run:** for each set and chase, the four milestones named by kind (set: Half a Binder, Nearly Full, Last Pockets,
    Binder Complete; Pokémon: Fan Club to Hall of Fame; artist: Gallery Opening to Full Exhibit; type, rarity and
    custom too), then the in-chase goals Holo hunter, Chase cards and Clean sweep. These use production's
    rarity buckets on dev's rarity names.
  - **Signature** (crown): The Big Three, Professor's Lab, Legendary Birds, Jungle Eeveelutions, Red Green and Blue,
    Dark Side, Johto Starters, Dragon's Hoard, Prismatic Nine and Kanto Complete. Also Legends, Starter Squad,
    Eeveelutions, Trainer's Toolbox, Secret Stash, Holo Wall, Rainbow Road, Ace in the Hole and Gallery Wall. Per kind
    of chase: Every Form, Art Piece, Mono Deck, Ten Sets Deep, First Brushstroke, Showpiece, Through the Ages, Then and
    Now, and Across the Decades.
  - **Dex:** a master trophy for each region (counting the Pokémon dev has cards for: "every Johto Pokémon on the wall
    (79)"), plus 50 Pokémon and 151 Pokémon.
  - **Across everything:** 100, 500 and 1,000 cards; First trade, Trader and Dealmaker (done trades in `wall-trades`);
    First find, Sharp eye and Bargain hunter. Dev does have data for those three: the Got it keypad keeps what you paid
    in `wall-paid`.
  - **Hidden:** Moonbreon, Secret Agent, Pikachu Fan Club, Gotta Catch 'Em All, Full Circle, First Pick, Last Page,
    Crown Collector and Trophy Cabinet.
- **Left out** (the wall has nothing to count): Gym Circuit (no Gym sets), Shiny Vault, Shining Collection, Gold Star,
  Tag Team, Radiant, Special Delivery and Full Evolution (no shiny rarities, subtypes or "evolves from"), Shiny Hunter,
  Starter Trio, Starter Lines, Pseudo-Legend and Legends of the Region (no region chases), and promo milestones (no
  promo sets). Splash! and Unown Alphabet are also out: the wall has 3 Magikarp and 1 Unown. The 500 and 1,000
  Pokémon trophies are out (dev has 450 Pokémon), and so is 2,500 cards (dev has 1,327 cards). A "set" chase ("All of
  151") gets no trophies of its own because its set already has them. Signature generics also apply to custom chases,
  as in production.
- **Luck:** rolled once per trophy, seeded by its id (`h32`): 1 in 100 Shiny, otherwise 1 in 10 Critical. It is stored
  with the earned trophy in a new key, `wall-medals` (`{ id: { at, rank, name, chase, tier, ... } }`). Reset the demo
  clears that key. An earned trophy stays earned even if you take the cards out, as in production. Trophies earned for
  a chase you later delete stay in an "earlier" run.
- **Medals are pseudo-cards** (`c.medal`). They live only in the trophy group, never in `cards` or `pool`, so the count,
  search, Time's curve, Value, chases, trades, copies and the trade binder never see them. Price bands have no trophy
  set. Under Time the pockets stay as they are (got = 1). Value and search have no stat for the panel.
- **Artwork:** production's `medalSVG` and `shapePath`, made standalone. CSS variables are filled from the theme, and
  the greying and the glow are done with SVG filters. Each distinct picture becomes one `Image`, rasterized to an
  offscreen canvas per size bucket and dpr, with at most 6 new rasters per frame. At mosaic size and arm's length
  (under 26px) a pocket is a flat fill in its tier colour with a paper strip; the artwork is never drawn there.
- **Redefined:** `arrange` (adds the trophy group), `mosaicLayout` (the trophy set is its own full-width row after
  New chase, packed as densely as the sets, and the screen-fit accounts for it), `orderGroup` (Need sorts by how close
  each trophy is, and the pockets shuffle to their new places inside the binder), `panelStat`, `drawTile` (adds a medal
  branch; cards are unchanged), `syncDone` and `drawList` (both also schedule a trophy check), `setChrome`, `enterMark`,
  `markCard`, `beginStroke`, `markAllInSet` (no Mark in the trophy set; holding a medal does nothing), and `fillPanel`
  (adds the medal close-up).
- **Close-up:** the card panel shows the trophy, its chase and description, when it was earned and its luck (or how many
  are to go), and a row of the cards behind it, missing first (24 at most, then "and N more"). Tapping a card slides
  to its set and brings it up close (`slideTo`, the sideways-flick transition to any set). Card actions are hidden.
- **Earning mid-session:** a trophy is checked after every card change (`setTimeout` 0, so after the card's own toast).
  A new one lands in its pocket the way a marked card does: it floods in from the middle, the gold ring spreads, the
  panel ripples, and the panel header shows "Holo hunter earned". Its luck is revealed as it lands, with a gold burst
  for Critical or rainbow rings for Shiny, and its gold or rainbow rule appears. A toast tells you; if the card's toast
  is up, the news is added to it and its Undo stays. Otherwise the toast has Show, which takes you to the trophy's
  pocket. Inside a set without a People chase row, the set's header shows the beat ("New trophy: Eeveelutions"). On
  load, anything already true is stored quietly.

## Try this first on the phone
1. Import (TCGplayer), scroll to the end of the wall and tap **Trophies**. Earned medals are in colour, the rest are
   empty pockets with "12 to go". Pinch into a pocket to see the cards behind it, and tap one to fly to it.
2. Switch to **Need**: the set reorders by how close each trophy is (Next up). Fossil is nearly done, and its Last
   Pockets comes up **Critical**. Mark Magneton and Muk in Fossil (or open them from the trophy's close-up) and watch it
   land.
3. The one **Shiny** in the catalog is **Holo Wall, Neo Genesis** (own all 19 Rare Holos). Open Neo Genesis, press and
   hold, then Select all to earn it.

## Gesture contract
All checks pass (`npm test -- --variant r19-radical-trophy-set`). A scratch scenario ran the contract on the trophy set
itself, with and without reduced motion: spread to open, pinch to close, tap to open, sideways flick to the previous
set and back, a bump past the last set, spread or tap to a medal, flick between medals, pinch to the frame and a second
pinch to close. It also checked that the count, search, price bands and the list stay correct. No page errors.

## Frame budget
`npm run test:perf -- --variant r19-radical-trophy-set`: mosaic 16.7ms, held pinch 21.1ms (base: 16.7 / 17.8).
A held pinch opening the trophy set itself, where the artwork is rasterized, took 25.6ms at q 0.5 and 28.9ms at q 0.9.

## Unsure about
- **175 trophies is a lot of set.** Hidden ones count in the total (they are pockets, like secret rares), which
  production deliberately doesn't do. The run for each of the 10 sets is long, and a page-per-chase grouping in the
  binder might read better than one checklist.
- **Dex region masters** count only the Pokémon dev has cards for. Without that, every region except Kanto would be
  out of reach.
- **The buying trophies** (First find, Sharp eye, Bargain hunter) were kept, because Got it records what you paid.
  The brief suggested skipping them.
- **The close-up sits a little left of centre**, which is the base card focus's own framing. A medal close-up might
  want to centre.
- When you earn a trophy inside a set that has a People chase row, it is announced only in the toast. The base header
  beat would draw over the chips.
