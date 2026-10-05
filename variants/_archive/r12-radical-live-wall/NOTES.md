# r12-radical-live-wall

**Round:** 12. A deal arrives: how does the wall tell you a live copy just appeared on a card you chase, and what do
you do next?
**Concept:** The wall is live: a deal arriving is an event in the wall itself, wherever you are. The tile flashes green
where it sits, a green ripple runs through its panel, the panel's header shows the price for a beat ("Electrode $12"),
and a thin green line races from the card to the Chase lens button, which ticks up and glows; in the Chase lens the
new tile slides to the front of its set with "just now" under the price. Nothing is a notification, and a Live filter
by the search box rewinds the session: a slider along the bottom scrubs through the arrivals, the wall showing which
deals were live at each moment and where, with "12 live deals, 3 new since you looked".

## What changed
- Added `85-live.js` (one part, sorted after every base part so its redefinitions win; nothing replaced or removed,
  `index.html` untouched: the menu item, the badge and the bar are injected):
  - The shared feed: 6 s after load, then every 9 s, `arrive()` takes the chased cards in `h32(id + "r")` order and
    gives the first without a deal one (`round(price * (0.55 + 0.3 * h32(id + "e")), 2)`, floored at $0.25, skipped
    if not under market), or, when every chased card has one, drops the oldest deal by 10%. Each card touched keeps
    a history (`c.hist`: `{ at, price, was }`, a seeded deal first at time 0) and `c.dealAt`, `c.dealWas`,
    `c.dealSeen`. An arrival waits a moment while a transition is playing, so it never lands on a moving wall.
  - The event (`showArrival`): `c.flash` (a pop, or two pulses for a drop; still when motion is reduced) and a ring
    spreading from the tile; `g.ripple` with `live: true` so the base's marking ripple also tints the neighbours
    green; `g.beat` for the panel header; a quadratic line from the tile (or from the screen edge it is beyond, or
    the top edge when another set is open) to the Chase button, 640 ms, then the button's badge ticks up and glows.
    In the Chase lens `liftLayout(true)` flies the tile to the front of its set first. The list view redraws.
  - Looked at: popping a card, bringing it up close, or its feed tile sitting on screen for three seconds marks the
    deal seen; the badge counts the unseen ones. "just now" and "4 min ago" are green until then, muted after.
  - The Live filter: a third item in the filters menu; `body.living` (plus `timing`, so the layouts keep the bottom
    clear) shows `#livebar`, a copy of the Time bar's markup with one green tick per arrival (shorter for a drop),
    the moment ("Start", "14 s ago", "4 min ago", "Now") and the count. Scrubbing sets every touched card's deal to
    what it was at that moment; stepping forward over one arrival plays it on the wall exactly as it happened;
    Play tweens from arrival to arrival (about 1.4 s each, quicker when there are many, a step a beat apart with
    motion reduced). Turning Live on with arrivals replays from the start, like Time. Time and Live put each other
    away. A real arrival while scrubbed back waits on the slider.
  - Redefined: `drawTile` (the flash and tint on top of the base tile, with the Need ring), `drawPanel` (the beat in
    place of the stat), `drawFeedTile` (the arrival line, the struck old price beside a dropped one, marking seen),
    `drawPop` (the overlay hook: the line and the binder's header beat, and it reports whether another frame is
    needed), `popCard` and `focus` (looked at), `markFilters` and `setTime` (the third filter).
- `styles.css`: the badge and glow on the Chase button; the Live bar reuses the Time bar's styles with a green track
  and ticks, hides the Time bar while living, and steps aside when a card is focused or a trade is open.

## Try this first on the phone
1. Import with "Chase every card I'm missing", then wait on the mosaic: six seconds in, a tile flashes green, its
   panel ripples, the header reads the card and price, and a line runs down to Chase, which ticks to 1.
2. Tap Chase: the next arrival slides to the front of its set with "just now" under the price. Tap it to look (the
   badge drops), or leave it and watch "just now" become "1 min ago".
3. Filters (by the search box), Live: the session replays arrival by arrival on the slider; drag it back to see
   which deals were live then, and where.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing about tap, pinch, drag or the composed levels changes; on a fresh wall nothing
is chased, so the feed never fires during the tests.

## Frame budget
`npm run test:perf -- --variant r12-radical-live-wall`: mosaic 16.7 ms per frame, held pinch 16.7 to 17.8 ms per
frame (budget 34 ms; the base measures the same). At rest nothing animates: the flash is 1.1 s, the ripple 1.6 s, the
line 0.64 s, the beat 3 s, and `drawPop` only asks for frames while one of them is running. Text widths in the panel
header and feed tile are cached (`textW`), so the beat and the struck price measure nothing per frame.

## Unsure about
- The line and the flash are only on screen if the tile is. With 786 chases most arrivals land below the fold, so
  what you see is a line from the bottom edge and the badge ticking. Should the mosaic nudge toward the panel, or is
  the Live replay the right place to go looking?
- A tile sitting on screen for three seconds counts as looked at. It keeps the badge honest without a tap, but it
  may clear "new" before you noticed. A tap-only rule is one line to change (`drawFeedTile`'s `lookedAt`).
- In the Chase lens each arrival is a full lens flight (`liftLayout(true)`) for one tile moving to the front; it is
  the base's own motion for Chase it, but every nine seconds it may be a lot of movement. A single-tile slide would
  be the quieter version.
- The replay is session-only (reload and it is gone), and the slider's "Now" end keeps moving, so the ticks drift
  left slowly while you watch. A fixed window (the last hour) might read better.
- The Time filter shows "Invalid Date" on a wall with nothing owned (base behaviour: `T_MIN` from an empty list);
  not touched here.
