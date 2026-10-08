# r23-bold-mondrian-grid

**Round:** 23. What does the Wall look like with Bauhaus and Piet Mondrian as its visual language?
**Concept:** A Bauhaus base (red, yellow, blue and black on off-white, a geometric sans, square corners) where heavy
black rules are the structure. The wall is a Mondrian composition: every set is a ruled rectangle whose header is a
solid colour field as wide as its progress. The cards sit in a thin-ruled grid. Binder pockets, the trade binder and
Trophies are black-ruled grids, and the rooms map is one painting whose rectangles grow with what's inside them.

## What changed
- `95-mondrian.js` (added part). It redefines:
  - the type: `font`, `fontOn`, a Futura / Jost stack (Jost is loaded from Google Fonts for screens without Futura);
  - square corners: `rr` and `rrOn` draw plain rectangles;
  - `readTheme`, which also reads `--rule`, `--m-red/yellow/blue`, `--m-on` and `--hole`;
  - the wall: `drawPanel`, `packPanel`, `packFolded`, `drawWall` and the new `drawGrid`;
  - the tiles: `drawTile0` and `emptyPocket`;
  - the set: `drawHeader`, `drawSet` and the new `binderGrid`.

  It also flattens the `TYPE` hues toward poster colours (still twelve apart) and sets Trade's map colour to black.
- `96-mondrian-rooms.js` (added part). It redefines:
  - the map: `mapLayout` and `mapAcross` (rooms touch and are sized by weights), `cardFrame` and `cardTitle`,
    `drawChaseCard`, `chaseChrome` and `drawMap`;
  - Trophies: `mdDrawItem` (ruled boxes, square chips, ruled progress bars);
  - the trade binder: `tbPaint` (the page a black-ruled 3 by 3) and `tbCoverPaint` (the cover is a small Mondrian).
- `styles.css`: the palette in light and dark mode, `border-radius: 0` everywhere (except the Time slider's knob), and
  flat off-white surfaces inside a 3px black rule instead of glass. The lens you're in is a black block, and the
  filter chip is red.

How it reads:
- **Panels.** Each panel is one `strokeRect` with a 5px rule. Neighbours share edges, so the rules meet as single
  lines. The header band is 38px: the colour field is what you own, a 30% tint of the same hue after it is what you
  chase (this replaces the gold ticks), and a black rule sits at the field's edge. The name and the count are two-tone:
  ink over off-white, off-white over red or blue, ink over yellow.
- **Colour.** Each set's hue rotates red, blue, yellow by its place in the set list, so the wall composes like a
  painting. The amount of colour always means how far along you are.
- **Cells.** Cards fill card-shaped cells that touch. Thin rules are drawn as one fill per row and per column, never
  per tile, and are skipped when cells are under 7px.
- **Color by: Type.** The type colour is only a square field in the bottom-left corner of an owned card's cell, 70% of
  the cell's width. A missing card is an empty cell a shade darker than the field. A holo or better gets a small black
  square at the top right. A live deal is a green square at the top right. Color by value uses the same square, in the
  heat colour. On the Dex, where cells are under 5px, the whole cell takes the colour. Up close, an empty pocket
  carries the type as a faint square by its price.
- **The set.** The header is a big band in the set's hue as wide as your progress, with the title two-tone and the
  next trophy hanging from the band's foot. The pockets are separated by black rules that run down and across every
  gap (about 4px framed). Only the visible rows are drawn, under the cards, so slides, pinches and a card up close
  need nothing extra. A sealed album, packed edge to edge, has no rules. A finish flashes the band yellow instead of
  the gold sweep.
- **The map.** The rooms touch. Each room draws its half of an 8px rule, and an outer frame closes the composition.
  - Chase's width and height grow with the share of cards still to go, so the Feed and Source give up height.
  - The Feed's height grows with its listings.
  - Trade and Trophies split their column by spares against trophies earned.
  - Each room has a colour band. Feed is blue for the share that's new, Chase is red for what's left, Trade is black
    for the spares someone wants, Trophies is yellow for what's earned, and Source has none.
  - Sizes move in tenths and are re-read at most every 1.5 s, so the map doesn't shift while you hold it.
- **Dark mode.** Off-white rules (`#EEEAE0`) on near-black fields (`#151515`), with slightly brighter primaries. The
  Darkness type colour was lifted so it shows on black.

## Try this first on the phone
1. Open the rooms map, then pinch back into Chase. The wall shrinks into the red Chase rectangle and grows back out
   into the ruled wall. Then tap a set: its tiles grow into the binder while the black pocket grid fades in under them,
   and the header becomes a large field of the set's colour.

## Gesture contract
All checks pass (navigation and gestures are unchanged).

## Frame budget
Software canvas, dpr 2, from `npm test -- --variant r23-bold-mondrian-grid`. All checks pass, under 34 ms:

| Upright | |
|---|---|
| Mosaic | 16.7 ms |
| Held pinch | 20.0 ms |
| Held pinch up to the map | 18.9 ms |
| Binder with 64 pictures | 16.7 ms |
| Pinch held into the binder | 16.7 ms |
| Trade binder mid-turn | 20.0 ms |

| On its side | |
|---|---|
| Mosaic | 16.7 ms |
| Held pinch | 18.9 ms |
| Up to the map | 18.9 ms |
| Spread mid-turn | 16.7 ms |

The rules add one stroked rectangle per panel and one fill per grid line. They are never drawn per tile, and the thin
grid is skipped below 7px cells.

## Unsure about
- Futura is the iOS face. It is wider than Archivo's condensed cut and there is no condensed Futura on canvas, so
  "narrow" text is set about 8% smaller instead. Long set names truncate sooner, for example "Neo G…" in a small
  panel. The tests run with a fallback font, so the screenshots don't show Futura.
- Whether the rotating hue per set reads as decoration. It's meaningful in area (progress), not in hue. The other
  option was one colour for all progress, which is calmer but no longer a Mondrian.
- At mosaic size the thin cell rules make big sets look a little like a spreadsheet. They could fade out below about
  12px cells, which would be more Boogie Woogie and less grid.
- On the map, a narrow Trade card truncates "131 spares, 55 wanted" in the fallback font.
- The trade binder's tall upright cells leave off-white space above and below each card, because the rule sits in
  the middle of the page's vertical gap.
