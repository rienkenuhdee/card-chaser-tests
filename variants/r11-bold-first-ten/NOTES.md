# r11-bold-first-ten

**Round:** 11. The first 30 seconds: onboarding before anything is marked.
**Concept:** The wall builds itself from the first ten cards in your hand. The mosaic opens grey and quiet with a
thumb-reach sheet at the bottom: Import from TCGplayer or Collectr first (simulated: pick the app, a second of
looking, and the demo's 541 cards flood in), or type ten cards you own on a number pad with set-code chips; each
number flies out of the pad onto the wall, its set's panel brightens, the count reads "3 of 10", and after ten the
sets you own fly to the front ("Your wall") and the lens bar slides in. No picking, no tour.

## What changed
- Added `80-first-ten.js` (one part, nothing replaced or removed):
  - Shared rule: seeded ownership off. Every card starts unowned unless you marked it (`saved`), `chase0` and
    `spare0` are false, deals stay. Reset the demo also clears `wall-first10` and `wall-import`, so the opening
    returns.
  - The sheet (`#ft`, built in JS, glass, bottom of a phone; a column at the right on a wide screen with a log of the
    cards typed so far). Three steps: **choose** (Import from TCGplayer or Collectr, the primary button; "or"; Type
    ten cards you own), **import** (TCGplayer or Collectr, then "Looking for your collection in Collectr" with a
    progress hairline for about a second), **pad** (title with the "0 of 10" badge and Done; set-code chips across the
    top, each with what the card prints after the slash since vintage sets print no code; a display with the typed
    number and the match; keys 1 to 9, Backspace, 0, Add).
  - Import: the seeded ownership is computed the way `10-model.js` does (`OWN_RATE`, `h32`, the same dates), written
    to `saved` as if it came from the file, the sets you own fly to the front, and the cards flood in set by set,
    front first, with the base flood animation. One toast: "541 cards imported from Collectr." `wall-import`
    remembers it.
  - Typing: a number that nothing else could extend (142 when there is no 1420) lands at once; an ambiguous one (14
    when 140 to 149 exist) shows its match and lights Add. A wrong number shakes the display ("No card 999 in Base
    Set"); a card already yours says so. Backspace with nothing typed puts the last card back. A physical keyboard
    types too (digits, Backspace, Enter, Escape).
  - Landing: the mosaic scrolls so the card's panel sits in the band above the pad (a binder pans its row into view),
    the card flies out from under the pad flipping from pocket to face, shrinks into its tile, and `setOwned` runs on
    arrival so the flood and ripple happen where it lands, with a ring in the set's ink. Panels of sets with nothing
    owned draw their label at half strength; the first card to land brightens one over 700 ms.
  - After ten (or Done early): `wall-first10` is set, the mosaic scrolls to the top while every panel flies to the new
    order (sets you own first, most cards leading, and those panels get 1.5x the area), the lens bar slides in, one
    toast: "Your wall. Tap a set to open it; Have, Need, Chase and Trade recolour it."
  - A touch on the wall while the sheet is up folds it (nothing is swallowed); during the opening a pill ("Keep
    going, 3 of 10") brings it back. Afterwards "Add cards" sits beside Mark in the set header (a 36 px "+" on narrow
    phones, labelled Add cards) and opens the pad on that set; picking another set's chip inside a binder slides to
    it. Done then gives one toast with Undo for the session, and a flight if a new set came forward. The list view has
    its own "Add cards" in the head; there, cards mark without a flight.
  - Redefined: `layoutAll` (applies the your-wall order to the set arrangement), `mosaicLayout` (the scroll range
    grows under the pad on a phone, the panels make room beside it on a wide screen, owned panels get more area),
    `drawPanel` (quiet and brightening labels), `clampCam` (the binder stops above the pad), `setChrome` (the header
    button), `kick` (runs `frame`, then the scroll tween, the flight and the ring), and the reset button's handler.
- `styles.css`: the sheet and its three steps, chips, keys, pill, header button, list head wrapping; the lens bar,
  time bar, caption and pill step aside while the sheet is up; the list makes room under it.

## Try this first on the phone
1. Reset the demo (settings cog). Tap "Type ten cards you own", tap BS /102, type 4: Charizard flies out of the pad
   and lands in Base Set, which brightens. Tap MEW /165 and type 199 to see the wall scroll to 151 before it lands.
   Keep going to ten (or tap Done) and watch the sets you typed fly to the front as the lens bar slides in.
2. Reset again and tap Import, then Collectr: a second of looking, then 541 cards flood in, front set first.

## Gesture contract
All checks pass (dpr 1 and 2). The sheet is a DOM layer over the canvas; the first touch on the wall folds it rather
than being swallowed, and nothing about tap, pinch, drag or the composed levels changes.

## Frame budget
`npm run test:perf -- --variant r11-bold-first-ten`: mosaic 16.7 ms per frame, held pinch 16.7 to 17.8 ms per frame
(budget 34 ms; the base measures the same here). The flight draws one card with a shadow while it is in the air; the
quiet-label pass costs one `ownedNow` per panel, which `drawPanel` already paid.

## Unsure about
- A touch on the wall folds the pad without finishing the opening (the pill stays until ten or Done). The alternative,
  finishing on the first wall touch, would have started the your-wall flight under a pinch and blocked it, so I kept
  the flight for ten or Done only. Is "Keep going, 3 of 10" enough of a way back?
- Set chips show the code and "/102". New collectors won't know BS, so the slash total is the real key for vintage
  sets; modern ones print the code. Typing "4/102" straight (a slash key resolving the set) might beat chips.
- The import is a simulation that loads the seeded 541; the Time filter then shows their made-up dates, while cards
  you type are dated today. Mixing the two reads as a collection that mostly arrived in 2023 plus today's ten.
- Three letter-numbered cards (B, G, R in 30th Celebration) can't be typed on the pad; tapping them in the binder works.
- On short phones the pad takes about half the screen; the band above still fits a panel, but 151 and Prismatic
  Evolutions are tall and get centred on the landing row rather than shown whole.
