# r19-safe-medal-room

**Round:** 19. How do production's trophy types live in dev's trophy room?
**Concept:** The trophy room becomes production's Medal tab in the room's own skin: the plaques stay, and production's
trophies join them laid out as the Medal tab lays them out (a summary, a Showcase shelf, Next up, plain filters, then a
shelf of medals per chase, with chases you haven't started folded away). Tapping a medal opens production's trophy card
with the cards behind it, and earning one during a session pops a toast-sized card with its Critical or Shiny look.

## What changed
- One added part, `68-medals.js`, plus `styles.css`. Nothing in `src/` is replaced or removed.
- **The catalog**, ported from production's `computeTrophies`, `signatureTrophies` and `collectionTrophies`, worked out
  from the wall's cards and cached until a card, chase, trade or medal changes (never per frame; about 5 to 10 ms to
  recompute):
  - **Every set** (all 10) and **every saved chase** (kind read the way production reads it: a Pokémon, an artist, a
    type or a rarity alone is that kind; anything mixed, including Popular, is custom) gets production's milestones,
    named by kind (Half a Binder, Nearly Full, Last Pockets, Binder Complete; Fan Club through Hall of Fame; Gallery
    Opening through Full Exhibit; Attuned, Treasure Hunter and so on), plus Holo hunter, Chase cards and Clean sweep.
  - **Signature trophies (gold crown):** The Big Three, Professor's Lab, Jungle Eeveelutions, Legendary Birds, Dark Side,
    Johto Starters, Dragon's Hoard, Prismatic Nine, Kanto Complete, Red, Green and Blue; and the generic ones the data
    supports: Legends, Starter Squad, Eeveelutions, Trainer's Toolbox, Secret Stash, Holo Wall, Rainbow Road, Ace in the
    Hole, Special Delivery, Gallery Wall; by kind: Every Form, Art Piece, Mono Deck, Ten Sets Deep, First Brushstroke,
    Showpiece, Through the Ages, Then and Now, Across the Decades.
  - **Hidden (purple "?")**, out of progress and Next up until earned: Moonbreon, Secret Agent, Pikachu Fan Club,
    Gotta Catch 'Em All, Full Circle, First Pick, Last Page, Crown Collector, Trophy Cabinet.
  - **Dex:** a master trophy per region (over the Pokémon the wall's sets have from it) and 50 and 151 Pokémon.
  - **Across everything:** 100, 500 and 1,000 cards; First trade, Trader, Dealmaker (from `wall-trades`).
  - **Luck:** rolled once per trophy with `h32`, seeded by its id (1 in 100 Shiny, otherwise about 1 in 10 Critical;
    measured 1.1% and 9.7% over 20,000 ids). A saved chase's trophies are keyed by its rule, so taking a chase off
    and making it again can't reroll.
- **Earning:** kept in `wall-medals` (`{ at, rank, name, ... }`, cleared by Reset the demo). Checked a beat after the
  count changes (`updateCount` is redefined to schedule it). On load, anything already true is earned quietly, dated
  from when its last needed card came in. Later, new medals pop in a toast-sized card under the toast: the medal
  springs in, the kicker says New trophy, Critical or A shiny appeared, and a tap opens the trophy card (or the room
  when several came at once). An import's trophies arrive in one card ("Your collection arrived, 30 trophies
  earned"). Once earned a medal stays earned, as in production; finishing a set or chase still mints its plaque
  exactly as before.
- **The medals** are production's `medalSVG` (shape per kind, tier colours, crown, "?", Critical starburst, Shiny
  rainbow rim and sparkles), ported as `medalSvg`. In the room each look is decoded once from an SVG data URL into an
  offscreen canvas (CSS variables swapped for theme values), then each trophy copies it and gets its nameplate lettered
  in Archivo, cached per trophy, size, dpr and theme. The looks are decoded in the background after load and the
  copies are made a few at a time, so nothing is rasterized while you scroll. Page-side medals (trophy card,
  celebration, list) are the inline SVG, with production's four colours as `--c-red/yellow/green/blue` in light and dark.
- **The room** (`roomLayout`, `drawRoom` redefined): header (Trophy room, "32 of 169 trophies · 5 hidden left to find",
  and the round 16 worth line when there are plaques), Showcase (the rarest four, six on a wide screen, standing on a
  lit shelf), Finished (the plaques, unchanged), Next up (four rows with bars), filter chips (All, Earned, To earn,
  Critical, Shiny), a shelf per chase (medals standing on wood with their label below: date, "12 to go", or the
  Critical or Shiny tag), "Not started yet · 7 chases" folded, and a short "How trophies work" at the end. Everything is
  drawn from cached bitmaps; text goes through `font()` and the fit caches.
- **The door** (`caseLayout`, `drawDoor`): shows once anything is earned (not only plaques), its line counts trophies
  ("36 trophies · 1 sealed · $615 ›"), and the rarest earned medals stand in a row above the plaques' engraving strip.
- `hit`, `enterGroup`, `openRoom` and `layoutAll` are redefined to add the medal, filter and fold targets and to let the
  room open with medals but no plaques. Plaques, the fan, the album and the pinch-out behave as in round 16.
- **The trophy card:** a bottom sheet over a scrim. Big medal, its luck tag, name, chase, what it's for, then the cards
  behind it, missing first (empty slots) and owned ones checked, up to 24. Tap one to go to it: out of the room into
  its set with the card up close, or into the sealed album from the room for a finished set (Back returns to the room).
  Open the binder goes to the chase. Escape or the scrim closes it.
- **The list view** (`trophyListHTML`): a Trophies section with the count, Showcase and Next up rows (with medals), and
  "Every trophy, by chase" folded in a details element. Each row opens the trophy card. The plaques' section is now
  titled Finished.

## Left out, and why
- **Region trophies** (Road Trip through Grand Tour, Starter Trio, Starter Lines, Pseudo-Legend, Legends of the Region):
  dev's chases have no Dex-range (region) rule. The Dex's region masters stand in.
- **Buying trophies** (First find, Sharp eye, Bargain hunter): the wall has no purchases.
- **2,500 cards, 500 and 1,000 Pokémon**: the wall has 1,327 cards and about 450 Pokémon, so they could never be earned.
- **Splash! (10 Magikarp) and Unown Alphabet (10 Unown)**: the sets have 3 Magikarp and 1 Unown.
- **Shiny Vault, Shining Collection, Gold Star, Tag Team, Radiant, Shiny Hunter**: none of those rarities are in the
  wall's sets. **Full Evolution**: needs "evolves from" data. **Gym Circuit**: no Gym sets. **Promo milestones**: no promo set.
- **Region masters** count the Pokémon the wall's sets have from each region, not every Pokémon of the region.
- Production's foil animation on holo rims and the sparkle twinkle stay off the canvas (frame budget). They play in the
  trophy card and the celebration (and stop with reduced motion).

## Try this first on the phone
1. Reset the demo, import from TCGplayer: one card says "Your collection arrived, 30 trophies earned". Tap it for the room.
2. In the room, tap a medal: the cards behind it, missing first. Tap a missing one and you land on it in its set.
3. On the imported wall, one more popular Base Set card (the People chase row, or Mewtwo) earns a **Shiny**: Popular in
   Base Set's Halfway. Team Rocket's Trainer's Toolbox is the other reachable Shiny (6 to go).

## Gesture contract
All checks pass (both dprs), including every trophy room check. Smoke passes in light, dark and desktop.

## Frame budget
`npm run test:perf -- --variant r19-safe-medal-room`: mosaic 16.7 ms, held pinch 17.8 to 18.9 ms (base on the same
run: 21.1 ms; the empty-wall test is within noise of the base). On an imported wall (scratch script): held pinch 20 to
28 ms against the base's 21 to 25 ms, the room at 16.7 ms still and about 17 ms average while scrolling, worst frame 33 ms.

## Unsure about
- **Size of the catalog.** About 169 trophies on the demo (67 of them signature), more than production's typical case.
  The room is long. The fold helps, but chases you've started still show every locked medal. Should locked ones fold
  behind a "12 more to earn" line per chase?
- **Plaques and medals overlap.** Binder Complete (a medal) and the set's plaque are the same moment. Kept both, since
  the plaque is the sealed album and the medal is the catalog entry. A master or grand set only has a plaque.
- **Earned stays earned.** As in production, taking a card out (or Undo) doesn't take a medal back, though the plaque
  comes off the shelf. A medal can be celebrated and then undone.
- **Dates.** Medals earned quietly on load are dated from the cards (so an older collection's trophies have history).
  Medals from an import are dated today, as production does.
- The celebration sits under the toast. When a set is finished, the plaque's toast and the medal card show together.
  Production instead plays the completion ceremony first and then the rest.
