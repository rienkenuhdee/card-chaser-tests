# r21-bold-one-wall

**Round:** 21. The wall inside the app: how do production's five tabs (Feed, Chase, Trade, Medal, Source) sit around the wall?
**Concept:** Production's bar, Feed · Chase · Trade · Medal, in production's four colours, replaces the lens bar. Every tab is
a lens on the same wall, so tapping one is the existing lens flight, not a page change; Source is configuration and
lives in Settings.

## What changed
- `index.html`: the lens bar becomes a four-tab `nav` (word plus a count line per tab, production style: "3 new",
  "786 to go", "174 spares", "30 earned"), with a small Have / Need toggle inside it. The About copy and a Sources
  section in Settings. Every element id is kept.
- `styles.css`: the tab bar (four equal columns, each tab with its colour stripe, an ink that slides and takes the
  tab's colour), the Have / Need toggle riding above the Chase tab, the bar staying up in the trophy room, the
  Sources switches, NEW in the list.
- `88-tabs.js` (added part, redefines rather than replaces):
  - **Feed** is the Chase lens grown into production's feed. `liftedLayout` for the Chase lens now lifts every card
    with a live listing out of its set into one column of tiles (two or three on wider screens), newest first, under
    a header ("19 listings for your chases", "8 new"). The sets fold to lines beneath under "Your sets"; tap one and it
    opens as usual. `drawFeedTile` is production's feed card: the card, name and set, the asking price, market and
    % under, a score slab (gold 80+, green 65+), where it was found (eBay Buy It Now or auction or Best Offer,
    TCGplayer, a subreddit, a shop) and when, and NEW. Sources and listing times are seeded per card id.
  - NEW means listed since you last left the Feed and never more than three days old (production's rule); it's stored
    as `wall-feed-seen`. The Feed tab's count line reads "3 new" and replaces the Chase badge; a live arrival's green
    line now races to Feed.
  - A listing that lands while you're down the feed keeps the tile you're reading still; at the top the new one slides
    in and the rest move down.
  - **Chase** is the wall itself (the Have lens). Have and Need are a small toggle above the Chase tab, shown only
    while Chase is the tab. I put them there rather than under Filters because they're views of this one tab, used
    often, and one tap; Filters stays for Value and Time, which sit on top of any tab.
  - **Trade** is the Trade lens as it was, cover and traders included.
  - **Medal** flies the wall home first (a lifted tab lands back on the wall, an open set closes, price bands go back
    to sets), then opens the trophy room's door. The bar stays up in the room with Medal lit; any other tab closes the
    room and then does its flight. The room opens on the medal catalog alone (no plaque needed). In the list view
    Medal scrolls to the trophies.
  - Tapping the tab you're on goes to its top (an open set closes; the feed or wall scrolls up).
  - A tab tapped inside a set flies the set's cards straight out of the binder into the tab's layout.
  - A tab remembers nothing but its lens: Feed and Trade land at their top, Chase lands where the wall was.
  - **Source** is Settings, Sources: eBay, TCGplayer, Reddit, Shops as switches (`wall-sources`); switching one off
    takes its listings out of the feed and the count. The offers sheet names the live listing's source.
  - The list view's Feed section is the listings, newest first, with NEW, the source and Got it.
  - Redefined: `placeInk`, `syncBadge`, `updateCount`, `setLens`, `liftLayout`, `orderGroup`, `layoutAll`,
    `liftedLayout`, `packFolded`, `emphasis`, `panelStat`, `drawWall`, `drawTraders`, `drawFeedTile`, `hit`,
    `openRoom`, `endRoom`, `offersFor`, `drawList`. The tab clicks are taken in a capture listener on window, ahead
    of the base's own, so leaving the room, table or binder is a step of the tab change rather than a cut.

## Try this first on the phone
1. Import a collection, chase a few cards (or "Chase every card I'm missing"), then tap **Feed**: the listed cards fly
   out of their sets into the feed, newest first. Wait nine seconds for one to land at the top, then tap **Chase**
   and watch them fly home to exactly where the wall was.
2. Tap **Medal** from the Feed or from inside a set: the wall flies home, then the room's door opens. Tap **Trade**
   from the room.
3. Settings, Sources: switch off eBay with the Feed up.

## Gesture contract
All checks pass. The tests click lens buttons by `data-lens`, so the tabs keep those names: Feed is
`data-lens="chase"` (the Chase lens grown into the feed), the Chase tab is `data-lens="have"`, Need is the toggle's
`data-lens="need"`, Trade is `data-lens="trade"`. One check is flaky on the base wall too: "the closest-to-done row
opens that set" sometimes clicks the summary row while the Import complete sheet is still sliding up (the row is
below the screen for the first ~100 ms on both base and variant), so a run can fail there with "Node is either not
clickable". A rerun passes.

## Frame budget
`npm run test:perf -- --variant r21-bold-one-wall`: mosaic 16.7 ms, held pinch 17.8 ms (budget 34 ms). With the Feed up
and every missing card chased: 16.7 ms still, 17.8 ms scrolled into the feed, 18.9 ms held pinch on a feed set, and
the Chase to Feed flight held 16.7 ms frames (max 16.8 ms). Feed tiles draw their card without foil.

## Unsure about
- The Have / Need toggle floats above the bar on the Chase tab. It's one tap and it's where the old buttons were, but
  it's a second row of chrome over the wall (the wall scrolls 46 px further so its end clears it). Under Filters
  would be cleaner and one tap further.
- Data-lens names no longer match the words (Feed is the Chase lens in code). Harmless, but a harvest should rename
  the lens to `feed`.
- Medal from the price-band layout switches back to sets, because the room is a level of the set wall.
- The score is made up from the discount and a seed. Production's has a price-check sheet behind it; here a tap on
  a tile opens the copies online.
- Production's feed has filter chips (25%+ under, Just listed, Under $25...). Left out: search and Value already sit
  on top of the Feed, and chips would be a second filter bar.
