# r14-safe-chase-builder

**Round:** 14. How does a collector define a chase: a set, one Pokémon, one artist, a dex with options (full art only), or any combination? And how does a set show the cards people typically chase in it?
**Concept:** A chase is a saved search, like in a shopping app: the top-left menu lists your chases with a count ("Charizard, 3 to find") and a New chase row that opens a glass sheet along the bottom with a kind picker (Set, Pokémon, Artist, Dex, Custom), plain pickers for each, and a live count while the wall under it dims to what the rule would match. Every unowned card a saved chase matches is on your chase list; inside a set a "People chase" row under the title shows the cards people typically chase with chips, a gold corner marks them in the mosaic and binder, and "Chase these" saves them as a chase.

## What changed
- Added `77-chases.js` and `styles.css`; nothing replaced or removed, `index.html` untouched (the sheet, the menu rows and the active-chase pill are injected).
- Rules live in `wall-chases` as an array of `{ id, kind, set, dex, artist, rarity, type, only, label }`. `matchRule(r, c)` is all-of: set id, Dex number, artist, `tier >= rarity`, type, and for the Dex kind Pokémon cards only; `only` is the popular list. The matches are kept in a Set (`ruled`), rebuilt when a rule changes, so `isChase` stays cheap.
- `isChase` is a `const` arrow in 64-chase, so it can't be redefined by hoisting. Instead `chasing` (a `let`) is wrapped in a Proxy: a card's own mark wins (true or false), otherwise a rule match reads as true. Every caller that reads or writes `chasing[c.id]` keeps working, `JSON.stringify` still persists only the hand-picked marks, and a hand-picked off wins over a rule. At harvest this should become a plain `isChase` function.
- A Pokémon is its Dex number (`c.dex`), so "Charizard" covers Charizard, Dark Charizard and Charizard ex. `SPECIES` maps dex to the plainest card name (prefixes like Dark, Galarian and suffixes like V, VMAX, ex stripped). Suggestions start with what you typed, most cards first; typing a whole name picks it; Enter takes the first suggestion.
- Rarity: Any, Holo and up (`tier >= 3`), Full art only (`tier >= 4`). Labels are built by `labelOf`: "Charizard", "Base Set", "Fire Pokémon", "Full art in Evolving Skies", "Charizard by Ken Sugimori", "Popular in Base Set".
- Save closes the sheet, saves, and shows the chase (below). Nothing to find still saves, with a toast saying so.
- The menu (`arrBtn.onclick` reassigned, rows rendered on open): "Your chases" rows (label, count, a trash button), then New chase. Tapping a row calls `showChase`: leaves the set if in one, switches to the Chase lens (or reflows it), and that chase's cards go first in each panel (`orderGroup` redefined) with its panels first on the wall (`liftedLayout` redefined). A glass pill above the lens bar names the active chase with its count and an × to go back to the plain chase list; any other lens clears it. Delete has Undo.
- `emphasis` redefined: while the sheet is up the wall shows the preview (matches full, matches you own at 0.42, the rest dim).
- Popular (shared rule): `popScore = tier * 2 + log10(price + 1) * 1.5 + h32(id + "p")`, top `max(3, round(0.06 * n))` per set, as `st.pop` and `c.pop`. `binderLayout` redefined: a set's header grows by the row's height (`popH`, from an estimated chip layout in framed pixels, up to three rows, "and N more" after). `drawHeader` redefined: the title block as before, then "People chase", the Chase these / Chasing these ✓ button, and the chips (name and price; gold hairline when you don't have it). `tap` redefined: a chip focuses its card, the button saves or removes the popular chase (toast with Undo). `drawTile` redefined: a faint gold corner on popular tiles at every size except feed tiles. `drawLive` redefined so the live beat measures from the title block.
- `drawList` redefined: in the Chase lens a "Your chases" section (Show, Delete, New chase) and the chase list with the active chase first; set sections name the top three people chase; a gold dot by a popular card's name. `updateCount` redefined to keep the pill in sync. Reset the demo also clears `wall-chases`.
- Reduced motion: the sheet has no transition; everything else inherits the base's handling. Dark mode through the CSS variables and `theme`.

## Try this first on the phone
1. Import, then tap the top-left menu and **New chase**. Tap **Pokémon**, type "char" and tap **Charizard**: the wall dims to its six cards and the count reads what's left to find. **Save**: the Chase lens opens with Charizard first in each set and a gold "Charizard, 3 to find" pill above the lens bar. Then open **Base Set**: under the title, "People chase" shows Charizard $395, Venusaur $96 and the rest as chips (gold corners on their cards below); tap **Chase these**, then look at the menu again.

## Gesture contract
All checks pass (dpr 1 and 2). Tap, pinch, drag and the composed levels are unchanged; the only new tap target is the row under a set's title, which was blank header before.

## Frame budget
`npm run test:perf -- --variant r14-safe-chase-builder`: mosaic 16.7 ms per frame, held pinch 16.7 ms per frame (budget 34; the base measures the same). The rule matching runs once per change into a Set; the proxy get is one `hasOwn` and one `Set.has`; the corner is one small triangle per popular tile.

## Unsure about
- "Full art" per the brief is `tier >= 3`, but Rare Holo is tier 3 too, so "Holo and up" and "Full art only" would be the same list; I put full art at `tier >= 4` (VMAX, Ultra, Illustration rares and up). If the other variants used 3, the counts won't compare.
- The Proxy on `chasing` is the smallest change but it's a trick; a harvested version should make `isChase` a function that checks the rule set.
- The popular chips only fit three rows on a phone (two or three chips per row), so a big set shows "and 8 more"; the gold corners carry the rest. Could be one scrolling row if the chips were DOM.
- Custom with only a rarity or a type ("Full art", "Fire") matches trainers and energy too, since it isn't the Dex kind. Reasonable, but a collector might expect Pokémon only.
- Showing a chase sorts its panels first and its cards first, but doesn't hide the other chased cards; a stricter "only this chase" view might be what tapping a row should mean.
- The sheet stays up while you tap the wall under it (like the welcome), including opening a set; it hides behind the card panel and comes back. Fine on a phone, slightly odd on desktop.
