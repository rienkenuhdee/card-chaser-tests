# r21-radical-rooms

**Round:** 21. The wall inside the app: how do production's five tabs (Feed, Chase, Trade, Medal, Source) sit around the wall?
**Concept:** No tab bar: the app is five places on one map, one zoom level above the wall. Pinch the wall closed and it shrinks into its card on the map while Feed, Trade, Medal and Source settle in around it, each card showing what is happening inside (the newest listings sliding in, the binder's first page, the rarest medals on a shelf, the clock and a pulse when a look finds something); spread on a card (or tap it) and it grows to fill the screen, and pinching any room closed brings you back to the map.

## What changed
- Two added parts, no part replaced or removed, nothing in `src/` touched.
  - `90-rooms.js`: the map and the moves. A new state `spot` (`"map"`, `"feed"`, `"source"` or null) is a level drawn over the wall, which stays exactly as it was underneath (view, scroll, lens). Chase is the wall itself. Medal is the trophy room and Trade the trade binder, opened from the map with no slide of their own and remembered as `map.from`, so Back and a pinch from them go up to the map; opened from the wall's door or the Trade lens's cover they behave exactly as before.
    - Moving between a room and the map is one transition with a position (`state.trans` of kind `map`, q 0 the room, 1 the map), held under the fingers and snapped by speed first (0.0011 q/ms, the set's own threshold), then position (0.4 going up, the same distances as opening and closing a set). The room is a picture taken once at the start; the wall's picture is kept for the Chase card and taken again only when the wall changes (key: size, theme, lens, filters, layout, scroll, counts). The other four cards come in from just beyond their places as the room shrinks.
    - Redefined by hoisting: `pinchMove` and `releasePinch` (closing fingers on the wall, or in the trophy room reached from the map, go up; a spread still opens what's under the fingers; the gesture commits to one direction), `bPinchStart`, `bPinchMove`, `bPinchEnd` (the binder reached from the map shrinks into its card instead of onto the cover), `layoutAll` (the trophy room from the map may be empty: it says how a trophy comes), `endRoom`, `tbEnd`, `updateCount`, `setChrome` (the rooms button, the screen-reader labels), `tickFeed` and `showArrival` (a find also lands in the Feed and pulses in the Source; the source of a find is seeded by card id), `frame` (the base frame plus the map, the Feed, the Source and the move between them).
    - Input on the map, the Feed and the Source has its own Touch Events listeners (window, capture, ahead of everything) and mouse pointer events, plus ctrl+wheel (a trackpad pinch) and keys (arrows pick a room, Enter goes in, Escape goes back to the wall; Escape or Backspace in a room from the map goes up).
  - `91-places.js`: the four cards (painted once into offscreen images keyed on what they show; what moves is drawn over them each frame), the Chase card (the wall's picture, the count, a small lens bar), the Feed room (every listing for your chases, newest first, with NEW since your last visit, the source, when, and a deal score; then "Still looking", the chased cards with nothing under market yet and the most you'd pay; tap one for its offers, the same pop-up as the Chase lens), the Source room (production's list: eBay, TCGplayer lowest listing, Reddit trade posts, Local listings, two card shops, the import, phone alerts, each with a switch; a clock with the last and next look and what it found this visit).
  - `styles.css`: the rooms button (a tiny map in production's four colours), the first-time tip, and the wall's chrome stepping away on the map (the lens bar belongs to Chase).
- Production's colours on the cards' top edge: Feed blue, Chase red, Trade green, Medal yellow, Source blue.

## How a newcomer finds it
- The **rooms button** sits at the top left of the wall's strip, exactly where Back sits inside a set: "up a level" in both places. Its icon is a little map of the five cards.
- The first time the wall is quiet after the welcome (and until you've been to the map once), a tip comes up under the button for 7 s: "Every room is up here. Pinch the wall closed, or tap this button, for Feed, Trade, Medal and Source." The button glows while it shows.
- The About sheet's first line says how rooms work. On the map, a line along the bottom says "Tap a room to go in. Pinch any room closed to come back."
- On the map, the count in the strip opens Chase (the wall).

## Try this first on the phone
1. Import (or open a wall with chases), then put two fingers on the wall and close them slowly: the wall shrinks into its card while the other four rooms come in around it. Hold it half way, open again, then close and let go (or flick).
2. Wait on the map for a find: the newest listing slides into the Feed card, the source's chip pulses with "+1", and the tile flashes green in the Chase card's picture of the wall.
3. Spread two fingers on the Medal card: the trophy room grows out of it. Pinch closed: back to the map. Do the same with Trade (the binder, Show mode and the table all work as before), then Feed and Source.
4. Tap "Need" in the Chase card's little lens bar: the wall comes back and then flies into the Need lens.

## Gesture contract
All checks pass (`npm test -- --variant r21-radical-rooms`): no check pinches closed on the mosaic, so none change. What does change, deliberately:
- A pinch closing on the mosaic used to do nothing; now it goes up to the map. That includes a pinch on a panel, on the door or on the binder's cover (a spread there still opens it, exactly as before), and ctrl+wheel inward on a trackpad.
- In the trophy room or the trade binder **opened from the map**, a pinch closed (and Back, Escape, Backspace) goes to the map rather than the wall. Opened from the door or the cover they close to the wall as before; the contract's room and binder checks open them that way and pass unchanged.
- Inside a set nothing changes: a pinch closes the set to the wall, and going up to the map takes a second pinch (as closing a set from a card does).

Also checked with a scratch script (phone, dpr 1 and 2, with and without reduced motion, all passing): a slow small pinch on the wall stays; a quick short pinch goes up; a slow small spread on a room stays on the map; a quick short spread on Chase lands on the wall where it was; a spread on a panel still opens its set and a pinch in the set still closes it to the wall; a big pinch on a panel goes up; tapping Feed goes in and the Feed scrolls; a quick pinch in the Feed, the binder from the map and the room from the map each come back to the map; a slow small pinch stays in the binder; a switch in the Source turns a source off; Back in the Source returns to the map; the count opens Chase; the rooms button goes up; typing a search on the map goes to the wall; the binder from the cover still closes to the Trade lens; Chase comes back in the Trade lens; a touch during the move lands it; Escape on the map goes to the wall; tapping Need in the Chase card goes in with the Need lens; no page errors.

One note on the suite: the "closest-to-done row" step clicks the import summary's row within about 100 ms of the sheet appearing, while the row is still sliding in from below the screen. On a loaded machine (three builders testing at once) it failed twice in five runs here; the base has the same race (the row measured at y 1004 of 844 at that moment in both). It passed on the reruns.

## Frame budget
`npm run test:perf -- --variant r21-radical-rooms`: mosaic 16.7 ms, held pinch (opening a set) 17.8 ms per frame.
Scratch measurements on the same software canvas, an imported wall, phone 390×844 at dpr 2: the held pinch up to the map 21.1 ms; the map at rest 16.7 ms; a held move into Feed, Trade, Medal or Source 16.7 ms; the Feed and the Source scrolling 16.7 ms. Taking the wall's picture at the start of the pinch costs one wall draw (13 to 17 ms, once). On the 1440×900 desktop page at dpr 2 (2880×1800): the wall 40 ms, the held pinch to the map 51 ms, into a room 43 to 48 ms, the map at rest 28 ms. Over 34 there, as the base wall itself nearly is; the phone is the target.

## Unsure about
- The Trade room is the trade binder (your spares and who wants them), not production's Trade tab, which is a trade checker (you give, you get, Fair or Uneven). The binder is the wall's trading object; the checker has no home here yet.
- The Feed's sources and the deal score are made up (seeded by card id). Switching a source off only takes its listings out of the Feed and its counts; the wall still flashes the deal, because a deal is a property of the want. Phone alerts on is a toast stand-in for a big find (40% under or more).
- The Feed and the Source are canvas rooms, read with the list of rooms (five buttons) for a screen reader but not row by row; the list view covers the wall, not them.
- The Chase card's picture of the wall is taken once and kept, so it isn't live beyond the green flash where a deal lands. A lens change from the Chase card's lens bar plays after the wall has grown back, rather than in the card.
- On a phone the Chase card is as wide as the wall's proportions allow (56% of the screen), which leaves the Trade and Medal cards 153 px wide: enough for a page and three medals, tight for words.
- Desktop: the map is a phone layout widened, with empty space in the Trade and Source cards; it wasn't the point.
