# r23-radical-de-stijl

**Round:** 23. What does the Wall look like with Bauhaus and Piet Mondrian as its visual language?
**Concept:** Full De Stijl: the app is one painting. The rooms map is a single Mondrian composition, black rules and primary fields with each room one rectangle of it, and the rules carry on inside every room. Everything moves along straight lines (across, then up and down), trophies are Bauhaus primitives, and the type is a geometric system sans.

## What changed
- Added `95-de-stijl.js`, which redefines functions only (no base part is replaced or removed):
  - Type: `font()` and `fontOn()` use a geometric system stack ("Futura", "Futura PT", "Avenir Next", "Avenir", "Century Gothic", "URW Gothic", "TeX Gyre Adventor", then Helvetica/Arial/sans-serif), one width, weights capped at 700. No web fonts.
  - Square: `rr()` and `rrOn()` draw plain rectangles, so every rounded corner on the canvas is a right angle. Circles are still drawn with `arc` and stay circles.
  - Colour: `readTheme()` also reads `--rule`. `TYPE` is recoloured to Itten's Bauhaus colour wheel (see below). `heat0()` (Color by value) is four flat fields, not a gradient: grey under $1, then blue, yellow and red by the decade. `MD_TIERS` are the primaries.
  - The map: `mapLayout()` and `mapAcross()` lay the five rooms full bleed with 6 px rules (5 px on a phone on its side). `PAINT.feed` and `PAINT.medal` are new. `PAINT.source` wraps the base painter and adds a blue field with a circle (yellow when alerts are on). `cardFrame()`, `cardTitle()`, `pill()`, `feedChip()`, `drawCard()`, `drawChaseCard()`, `chaseChrome()`, `chaseLensAt()` and `drawMap()` are redrawn as flat fields. Feed is a blue field with its count standing big, Chase a red field over the wall, Trophies a yellow field, Trade a white field, and Source has a small blue field.
  - The move between the map and a room: `mapGeom()`, `drawMapTrans()` and `pageAt()`. The room's rectangle narrows across first, then up and down; into a room it's the reverse. Every field draws its own rule frame, so the rules travel with the fields and ride out to the screen's edges. The other rooms slide in on one axis only, each held to the moving room's edge. The Chase field's red band slides down from above, and its lenses ride the wall's bottom edge.
  - `drawHop()` (room to room) and the slide between sets draw a rule at the seam.
  - The wall: `drawPanel()` fills each panel's whole slot and strokes a 4 px rule on its edge. Neighbouring panels' halves make one rule, and any gaps the layout leaves are empty white fields. Each panel's count sits in a corner field in its set's nearest primary (or white for green and grey sets), held in by rules. `frame()` and `drawSet()` move every tile along two straight lines (across, then down) when a set opens, when the wall rearranges and when a set reorders. `drawTile()` drops the pop on a deal landing (the tint and a square ring stay).
  - Trophies: `paintMedal()`, `medalSvg()` and `mdPill()`. A medal is a white plate in a black rule on a black plinth with its short name. The kind is the shape: a set, region or everything is a square; a Pokémon, the Dex or a custom chase is a circle; an artist, type or rarity is a triangle. The tier is the colour: bronze blue, silver red, gold yellow, holo all three in bands. Critical cuts a black corner, Shiny turns the plate's ground black, a signature trophy wears a red block on top, and a hidden one has a black "?" circle. `drawRoom()` frames the room's panels in 3 px rules and puts a yellow field under its header.
- `styles.css`: the palette in light and dark, `--rule`, the font stack, square corners on everything except true circles, one crisp easing curve (`cubic-bezier(.7,0,.2,1)`, no overshoot) for every CSS transition and animation, and flat chrome in black rules (no glass, blur or shadows). The lens bar's active lens is a yellow field. The pages (Feed, Trade, Source) get a coloured band in rules under their titles and lists cut by rules, and a page sliding to the next room carries a rule at its edge. The trade binder cover is black with a red spine. The luck tags and list dots are flat primaries, and the medal glow, hue cycling and sparkle are off.

**Color by: Type.** Telling eleven types apart needs more than three hues, so it uses the Bauhaus's own answer, Itten's colour wheel. Fire, Water and Lightning are the primaries. Grass, Psychic and Fighting are the secondaries (green, violet, orange). Dragon and Fairy are tertiaries (blue-green, red-violet). Darkness is black, and Metal, Colorless, Trainer and Energy are four greys. All are flat and unmodulated. The painting (rules, fields, chrome) stays strictly red, yellow, blue, black and white. The cards are what's hung on it, so they keep a full but disciplined palette. Darkness lightens in dark mode so it's still seen.

**Dark mode.** The lights go down in the gallery. The white fields go charcoal (#1E1E1E on #141414) and the rules go pure black, so they read as cuts rather than lines. The primaries stay at full strength as the only light. Medal plates stay paper-white, like small paintings on a dark wall.

## Try this first on the phone
1. On the wall, pinch closed slowly and hold it halfway. The wall narrows to its column while Trade and Trophies slide in from the right, then Feed drops in from above and Source rises from below, until the painting is whole. Then spread on the yellow Trophies field and watch the rules ride out to the edges.

## Gesture contract
All checks pass at dpr 1 and 2. Navigation is unchanged: the same gestures reach the same places. The map move keeps the base's durations and snapping (speed first, then position); only its geometry changed, from a diagonal scale to two straight-line phases. Smoke, memory and landscape pass too. Landscape first failed on two style checks (the trade binder's cover must be a gradient, and the Feed's two columns needed a gap). The cover is now a stepped gradient (the red spine and the black board), the Feed's gaps are 3 px rules, and the landscape rerun passes. In the full run the art test died with "detached Frame" while two other suites ran alongside; run on its own it passes.

## Frame budget
`npm test` (perf), with two other variants' suites running at the same time:
- mosaic 16.7 ms, held pinch 20.0 ms, held pinch up to the map 24.4 ms
- binder of 64 pictures at rest 16.7 ms, pinch held into it 17.8 ms; binder mid-turn on its side 16.7 ms, upright 20.0 ms
- on its side: mosaic 16.7 ms, held pinch 20.0 ms, up to the map 18.9 ms, spread mid-turn 16.7 ms
- memory: 27.2 MB at dpr 3 after five rounds through every room, flat, 0 new canvases

The rules are a few rectangles per panel and per room, never per tile. The map's fields are the base's baked card pictures, and medals are still painted once and kept.

## Unsure about
- Tier as colour (blue, red, yellow, then all three) has no built-in order the way bronze, silver and gold do. Gold as yellow and holo as all three read right; blue below red is a rule you have to learn.
- The across-then-down move is the strongest "straight lines only" statement, but while it runs the right column has empty fields above Trade and below Trophies, waiting for Feed and Source to slide in. It reads as the painting composing itself to me; it may read as a gap.
- Futura is wide. Long set names on narrow panels ("Neo Genesis") truncate sooner than in Archivo's condensed cut.
- Card scans from the image hosts (round 22) still come in full colour inside the painting. Only the drawn faces follow the palette.
- Some motion outside the map and the wall still arcs: the trade table's lifts and the reply flights (75-trade, 76-reply), and the ripple when a card is marked. These were left alone.
