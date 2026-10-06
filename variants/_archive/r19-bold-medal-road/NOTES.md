# r19-bold-medal-road

**Round:** 19. How do production's trophy types live in dev's trophy room?
**Concept:** Production's whole medal catalogue (milestones named by kind of chase, in-chase goals, signature medals with
a crown, hidden medals with a "?", the Dex, Across everything, and Critical or Shiny luck) lives in the trophy room. Each
plaque has its chase's medals hung beneath it on ribbons, and the other medals sit on shelves of their own. The new idea
is that the milestones sit on the progress bar where you earn them, as pins, with the next one faintly lit. Crossing one
mints the medal right there: it pops off the bar, shows its luck, and flies to the door at the end of the wall.

## What changed
- Added `85-medals.js`. It has:
  - **Artwork.** Production's `medal.js` ported to canvas: the same `shapePath` outlines, tiers, ribbons, nameplate,
    crown, purple "?", Critical rays and mark, and Shiny rainbow rim and sparkles, drawn with `Path2D` from the same SVG
    path data. Each look is drawn once to an offscreen canvas, cached by look, size step, dpr and theme, then drawn
    scaled. The sheet and the list use the same painter through a cached data URL. I didn't use an `Image` from an SVG
    data URL because it loads asynchronously and would need the CSS variables swapped out. Painting the same paths
    straight onto the canvas is synchronous and identical.
  - **Catalogue.** A port of `computeTrophies`, `signatureTrophies` and `collectionTrophies` onto dev's data (what's in
    and what's out is listed below). Luck is rolled once per medal id: `h32("luck|" + id)` with a finaliser, 1 in 100
    Shiny, otherwise 1 in 10 Critical. Earned medals are stored in `wall-medals` with their look, so a medal outlives a
    deleted chase. Earned medals stay earned, as in production. Anything true on load is earned quietly. Reset the
    demo clears them.
  - **Pins on the bar.** `drawBar` is redefined. The milestones sit at their points on the bar. The goals and signature
    medals hang past the bar's end, which is shortened for them and stacks them when there are many. In the mosaic a pin
    is a 3px `fillRect`: tier colour when earned, a halo when it's next, grey when not yet. Up close (the set header,
    via a copied `drawHeader` that passes `head`), each pin is a small cached medal raster hanging on a thread. Earned
    pins are full colour with ribbon stubs, the next one is lit, the rest are faint. Tapping a pin up close opens its
    sheet. In the Time filter the milestones light as the replay passes them.
  - **The mint.** `syncDone` wraps the original (now `syncDone0`) and then checks the medals. New ones queue a mint.
    Each pops off its pin (or off the card you marked, for Dex and Across everything), reveals its luck with a starburst
    for Critical or a turning rainbow and sparkles for Shiny, with haptics, then flies to the door. If the door is off
    screen it flies off the bottom edge, and when it lands the door's count ticks up and the door glows. Up to 4 medals
    each get a full pop, one after another. Beyond 4 (a set filled at once, an import), the 3 luckiest pop and the rest
    rise off their bars together and stream to the door. With reduced motion the pop is a still that fades: no movement,
    no swarm. The pop stays clear of the toast and the lens bar. Drawing happens in a redefined `drawMarks`.
  - **The door.** Redefined `caseLayout`, `drawDoor`, `openRoom` and `layoutAll`, so the door and room also exist when
    there are only medals. The door reads "2 trophies · 41 medals ›". With no plaques, its strip shows the newest medals.
  - **The room.** Redefined `roomLayout`, `drawRoom` and `headerImage`. Under each plaque's shelf hang its medals. After
    the plaques come labelled shelves: unfinished sets and chases in wall order ("3 of 12"), the Dex, then Across
    everything with a "?" medal for "N left to find". Each shelf is cached offscreen. Redefined `hit`, `enterGroup` and
    `tap` so a medal is a block: tapping it opens the sheet.
  - **The sheet.** A `<dialog>` with the big medal, the luck tag, name, chase and description, then the cards behind it
    with missing ones first (greyed, with price) and owned ones checked, up to 24, then "and N more". It ends with
    "Earned Oct 6." or "4 more to go." and an Open button for the medal's set or chase.
  - **List view.** The Trophies section lists the medals (each one opens the sheet) with the hidden count, and each set's
    line adds "Next medal: Nearly Full, 4 to go."
  - `setOwned` is redefined only to remember which card tipped a medal.
- Added `styles.css` for the sheet and the list's medals. One line about medals is added to About from JS.

## Production trophy types that made it
- **Milestones per kind**, with production's names: sets (Half a Binder, Nearly Full, Last Pockets, Binder Complete,
  set code on the plate), Pokémon (Fan Club to Hall of Fame, "#6"), artist (Gallery Opening to Full Exhibit, initials),
  type (Attuned to Perfect Match), rarity (Treasure Hunter to Full Hoard, "★"), custom (Halfway to Complete). A set's
  master and grand set views get their own milestones.
- **In-chase goals:** Holo hunter, Chase cards, Clean sweep.
- **Hand-made signature medals:** The Big Three, Professor's Lab, Legendary Birds, Jungle Eeveelutions, Red Green and
  Blue, Dark Side, Johto Starters, Dragon's Hoard, Prismatic Nine, Kanto Complete.
- **Generic signature medals:** Legends, Starter Squad, Eeveelutions, Trainer's Toolbox, Secret Stash, Holo Wall,
  Rainbow Road, Ace in the Hole, Special Delivery, Gallery Wall. Shiny Vault, Shining Collection, Gold Star, Tag Team
  and Radiant are ported but nothing in dev's ten sets matches them.
- **Chase-kind medals:** Every Form, Art Piece, Then and Now, Through the Ages (eras by year), Mono Deck, Ten Sets Deep,
  First Brushstroke, Showpiece, Across the Decades. Shiny Hunter is ported but never matches.
- **Dex:** Kanto master, 50 Pokémon, 151 Pokémon.
- **Across everything:** 100, 500 and 1,000 cards, plus First trade, Trader and Dealmaker (counted from `wall-trades`).
- **Hidden:** Moonbreon, Secret Agent, Pikachu Fan Club, Gotta Catch 'Em All, Full Circle (Base Set and 30th
  Celebration), First Pick, Last Page, Crown Collector, Trophy Cabinet.
- **Luck:** Critical and Shiny.

## Left out
- **Buying medals:** First find, Sharp eye, Bargain hunter. Dev has no purchase data.
- **Promo milestones:** dev has no promo sets.
- **Region chases and their medals:** Road Trip names, Starter Trio, Starter Lines, Pseudo-Legend, Legends of the
  Region. Dev has no region rule.
- **Full Evolution:** dev has no stage or "evolves from" data.
- **Gym Circuit:** dev has no Gym sets.
- **Dex medals dev's ten sets can't reach:** Johto to Paldea masters, 500 and 1,000 Pokémon, 2,500 cards.
- **Unreachable hidden medals:** Splash! (3 Magikarp) and Unown Alphabet (1 Unown). These are left out so "left to find"
  stays honest.
- **Production's Medal tab parts:** the Showcase, Next up and the filters. The bars replace Next up, and the room
  replaces the tab.

## Try this first on the phone
1. Import (TCGplayer), then watch the medals rise off the bars and stream down to the door. Scroll to the door: it now
   counts medals.
2. Open a set that's nearly half done (Neo Genesis or Team Rocket after the import) and look at the bar: the medals
   hang under it, and the next one is lit. Tap one to see the cards behind it, missing first. Mark the card that tips
   it and watch the medal pop and fly. Base Set's Half a Binder is a Critical.
3. Open the trophy room: each plaque has its medals on ribbons, then shelves for the rest, and "N left to find" at the
   end.

## Gesture contract
All checks pass.

## Frame budget
`npm run test:perf -- --variant r19-bold-medal-road`: mosaic 16.7ms, held pinch 18.9ms (empty wall, as the test runs).
On a populated wall (the import's 541 cards plus a plaque), a scratch run gave a held pinch of 22.2ms against the base's
21.1ms. The room ran at 16.7ms (vsync).

## Unsure about
- **The bar is shortened** to make room for the end medals (up to a third of it on Base Set, which has 9). The ratio
  still reads, but the bar no longer spans the panel.
- **Earned medals stay earned** when you take a card back out, as in production. Undo right after a mint keeps the
  medal.
- **The pins in the mosaic are 3px.** Enough to see that something is there and its tier, but they don't show a medal's
  shape until you open the set.
- **Several medals at once** play one after another, which takes about 4 seconds for 3 lucky ones. That might feel slow.
- **Dex and Across everything medals have no bar.** They rise from the card you marked, or from mid-screen after an
  import or a trade.
- **Locked medals don't show in the room.** It shows only what's earned, with "3 of 12" per shelf, and the bars are
  where you see what's still to earn.
