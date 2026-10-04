# r9-safe-show-list

**Round:** 9. The show floor: one-handed, glanceable, built around your wants (Sacramento card show, Nov 20 to 22).
**Concept:** A Show mode you switch on ("Show" in the top strip, offered once by a toast) that turns the wall into a
one-thumb checklist like Reminders: your wants by set, oldest first, big type, the most you'd pay on the right, and
a header that says "46 wants, about $207". Tick a row when you find the card (Got it, with Undo), search along the
bottom within thumb reach (any card, not only wants, with a tick for the ones you have), and Wall takes you back to
the wall exactly where you left it.

## What changed
- Added `75-show.js` and `styles.css`. Nothing replaced or removed; the base markup is kept (the Show button, the
  Want it button and the show surface are created from the part, and About gets a line about Show).
- Wants, per the round's shared rule: a card is a want if it isn't owned and either `h32(id + "w") < 0.1` or you
  toggled it on; toggles persist in `localStorage["wall-wants"]` as `{id: true|false}`. The most you'd pay is
  `round(price * 0.85)`. Marking a want owned drops it from the list (and Undo brings it back).
- Redefined `fillPanel`: the card panel gets a third action, **Want it** / **On your list ✓**, between I have it and
  Find a copy while the card isn't yours (an owned card can't be a want, so it hides then; the actions go back to two).
- Redefined `drawList`: anything that redraws the list (marking from the wall, Undo, lenses) redraws the show list
  too, and the list view's rows say ". A want" in their meta line.
- Redefined `updateCount`: with one more button in the strip, the placeholder is "Search" below 520px. Inside a set
  the count ("541 of 1,327") steps aside (`body.inset .count`), since Back is right there and the box needs the room
  beside Mark and Show.
- The show surface: a header (city and dates, "N wants, about $X", one line of explanation) that isn't tappable; a
  scrolling list grouped by set with sticky set headings ("Base Set 1999 ... 6 wants, $1.44"); rows with a 30px
  checkbox, the name at 20px condensed, "Set number/printed", and the most you'd pay in tabular figures. When the
  list is short it sits low, near the thumb, rather than at the top. A row tap expands it: market price, the live
  deal if there is one, and Find a copy (or Buy for $X), See it on the wall, and Drop it (or Want it in search).
- Got it: the checkbox ticks (the stroke draws in), the row slides left and collapses, the header updates at once,
  and a toast at the bottom (above the bar, within reach) says "Got it. Squirtle added." with Undo. In search a got
  card stays ticked where it is, and a ticked card can be unticked ("taken out"). With reduced motion the row just goes.
- The bar along the bottom: a solid search box (filters as you type, 120ms; finds any card, the first 80 shown) and a
  **Wall** button (reads **List** when the list view is underneath). On a phone it rides up on top of the keyboard
  via `visualViewport`. Escape or "/" work as you'd expect; Escape outside the box leaves Show.
- Show stays on across a reload (`localStorage["wall-show"]`), the way the list view does. The toast offer fires
  once, 3.2s after load, and never again once you've used Show (`wall-show-offered`).
- Everything stays solid rather than glass, and the type is bigger than the rest of the wall, for a bright floor.
  Dark mode uses the same variables. Lenses, Time, search, Mark and the list view are untouched underneath.

## Try this first on the phone
1. Tap **Show** (top right, or the toast that offers it). Scroll the list with one thumb, tick **Squirtle**: it
   slides out, the header goes to 45. Tap **Undo** in the toast at the bottom.
2. Type "charizard" in the box at the bottom: every Charizard, ticked where you have one, with its market price.
   Clear it. Tap a row's name to open it; **See it on the wall** flies you to the card in its binder; **Show** again.
3. Tap **Wall**: the wall is exactly as you left it. Open a card you don't own, tap **Want it**, then **Show** again
   to find it in its set.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing about navigation changes; the show surface sits over the wall and the wall's
camera, view and lens are left alone while it's up.

## Frame budget
`npm run test:perf -- --variant r9-safe-show-list`: mosaic 16.7ms, held pinch 17.8 to 22.2ms across runs (budget
34ms); the same as the base, since the surface is DOM and nothing is drawn on the canvas while it's up.

## Unsure about
- The seeded wants are a uniform 10% of what you don't own, so the list is mostly cheap commons ($0.12 rows) with
  the odd ex. That's the shared rule for comparability, but it makes the "most you'd pay" column look like noise.
  A real wants list would skew to the cards worth hunting.
- "Everything tappable in the lower two thirds" holds for the bar, the toast and a short list, but a long list's first
  rows sit under the header. Bottom-gravity (the list hugs the bar when short) was the compromise; a reversed list
  (newest set at the top, oldest nearest the thumb) would be another.
- The Show button is text, so the strip inside a set is now Back, Mark, Search, Show, About: full on a 390px phone
  (the count is hidden there to make room). An icon would be lighter but less obvious.
- A row's expansion (market, deal, three buttons) may be more than a show-floor glance wants; the checkbox and the
  figure are the point.
