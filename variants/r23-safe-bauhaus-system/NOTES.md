# r23-safe-bauhaus-system

**Round:** 23. What does the Wall look like with Bauhaus and Piet Mondrian as its visual language?
**Concept:** The same Wall rebuilt on a Bauhaus design system: three true primaries plus black on warm off-white paper
(and a dark equivalent), a geometric sans (Futura on the phone), square corners or perfect circles, flat colour and an
8px grid. Primaries carry meaning (blue for the market and live deals, red for the chase and anything going down, yellow
for what's earned, chased or switched on) and black is the primary action, so it reads as the same app made rigorous.

## What changed
- `styles.css` (appended): new tokens for light and dark (`--bg` warm paper, `--ink` black, `--deal` blue, `--gold`
  yellow, `--c-red/-yellow/-blue`, and `--c-green` is now the black token, so Trade's room colour is black); `--font`
  is Futura, Avenir Next, Century Gothic, then sans-serif (no web font). Every corner is square (`border-radius: 0`),
  except the things that were round dots, knobs and avatars-as-dots, which stay perfect circles. No blur
  (`backdrop-filter`), no soft shadows (`--shadow: none` and the one-off shadows flattened), no CSS gradients except
  hard-stop bands. Floating chrome (top strip, lens bar, dialogs) wears a 2px black rule; sheets a 2px rule along the
  top. The lens you're on is a black block (white on dark); an active filter chip is yellow. Spacing on the chrome
  moved to 8px steps (strip 56, buttons 40/48, gutters 16/24).
- `11-bauhaus-ink.js` (added): recolours `TYPE` (see below) and `SET_INK` / `sets[].ink`: each set's bar and medal
  ribbon is red, yellow, blue or black, so neighbours on the wall differ.
- `98-bauhaus.js` (added), redefining:
  - `font()` and `fontOn()`: the same caching, Futura stack.
  - `rr()` and `rrOn()`: a rounded rectangle is drawn square, unless it is square and fully rounded, then a circle
    (pills become rectangles). Also cheaper than `roundRect`.
  - `faceShadow()`: nothing; cards sit flat.
  - `heat0()`: Value in four flat steps instead of a blend: quiet paper grey, blue, yellow, red.
  - `drawnFace()`: a full art is a flat field with one big disc off-centre (a poster) instead of a gradient; no
    engraving; foil is a hard-edged band of light crossing the window (same timing and the same "only at rest" rule).
  - `drawBar()`: complete is the yellow token; a black set's bar follows `--ink` in dark mode; the finishing glint is
    a white block, not a gradient.
  - `mdShape()` gains `square` and `triangle`; `MD_SHAPE` maps sets and the Dex to squares, Pokémon to circles,
    artists to triangles. `medalSvg()` / `paintMedal()`: flat rims and stars, no glow, black plates; Shiny is three
    hard bands of red, yellow and blue. `mintBurst()`: a flat disc instead of a radial glow.
  - `tbCoverPaint()` and `COVER`: the trade binder is a black board with a yellow frame and title and one red disc.
  - `mdFour()`: a black set's medal gets the black ribbon.
  - `CHASE_INKS`, `MD_TIERS`, `MD_RAINBOW`: primaries and black.

**Color by: Type.** Eleven-plus types can't be told apart with three primaries, so types keep their own hues, taken
from the Bauhaus's own colour theory (Itten's twelve-part wheel, plus black and greys). The primaries sit where the
types already were (Fire red, Water blue, Lightning yellow); Grass, Psychic, Fighting, Fairy and Dragon are the wheel's
secondaries and tertiaries; Darkness is black, Metal and Colorless are greys. All flat and square. The primaries keep
their meaning everywhere else (chrome, state, rooms), so the type view reads as the cards' own colour, as before.

## Try this first on the phone
1. Open the rooms map (the four-block button, top left), then each room: Feed blue, Chase red, Trade black, Trophies
   yellow, the same strip of colour along each. Then flip dark mode in settings and do it again.
2. On the wall, open Filters and turn on Color by: Value: the wall becomes a Mondrian of grey, blue, yellow and red.

## Gesture contract
All checks pass (navigation and gestures are unchanged).

## Frame budget
See the test run below.

## Unsure about
- Futura is on iPhone, but the font fallbacks were only checked on Linux (sans-serif) here. Futura is wide: long set
  names truncate sooner than with Archivo's condensed widths.
- The 2px black rule around the top strip and lens bar is the loudest move. It may feel heavy against a dense wall;
  the alternative is hairlines with only the black lens block.
- Trade's room colour is now black (there's no green in the system). It reads well in light; in dark it inverts to
  off-white, which is consistent but less of a "colour".
- Yellow (`--gold`) as text on paper is weaker than the old ochre ("55 wanted", Value prices on empty pockets).
- Left as they were: the trade binder's page-turn shading and the gutter (lighting in motion, not decoration), the
  set header's finishing shimmer, and the arrival plate's engraving.
