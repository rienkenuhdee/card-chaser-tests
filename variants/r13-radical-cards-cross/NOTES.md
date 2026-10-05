# r13-radical-cards-cross

**Round:** 13. After the handshake: what happens to a proposed trade?
**Concept:** The trade lives in the wall, not on the table. After Shake hands the cards you offered (and the pockets
of the ones you asked for) stay where they sit but travel: a small gold "In play" tag, a few pixels of lean toward
the Trade lens button, and a thin gold thread from each to it. When Maya answers (simulated and seeded, twelve seconds
later, the shared rule), it lands the way a deal does: the cards flash gold, the panel header beats "Maya accepted",
a gold line races to Trade, which counts it. On an acceptance the cards cross in the wall itself: yours lift out
through the top edge and leave your collection, hers fly in from it and land in their pockets with the marking flood
and the ripple, and a toast says what changed hands. On a counter her hand reaches in: a card she left out settles
back to rest, one she added flies in wearing "Maya offers", and a strip above the lens bar asks Accept or Not this
time. A decline is one line. Press and hold any card in play and the trade reads out in one line.

## What changed
- Added `78-cross.js` (one part; nothing replaced or removed, `index.html` untouched: the Trade badge and the counter
  strip are injected):
  - The records: `wall-trades` entries gain `state` (`proposed`, `countered`, `accepted`, `declined`, `done`),
    `reply` (`{ at, drop | add | reason, by }`), `done` and `seen`. Legacy records without a state count as proposed.
    `syncTrades()` schedules a reply for every proposed record (`rec.at + 12 s`, or shortly after a reload if it was
    due); a reply waits while the wall is moving (a transition, a gesture, the table, a pop, a crossing).
  - The reply (`reply`): `h32(`${t.id}|${rec.at}|reply`)` under 0.45 accepts, under 0.8 counters (one of your cards
    left out, or one more of theirs you chase put in, picked by `|pick`, `|drop`, `|add`), otherwise declines with
    "I'd want the Zapdos ex too." (a spare of yours they chase that wasn't offered, by `|why`).
  - What's in play (`play`, a map from card to its trade): every card of every proposed or countered trade. The tile
    (`drawTile`, copied from the base with the gold added) leans `LEAN = 6` px toward the Trade button
    (`c.leanK` eases 0 to 1 and back; no lean with motion reduced) and wears the tag (`drawPlayTag`: a gold hairline
    round the tile, a gold corner on tiles too small to read, "In play", "In play, Maya", "From Maya" or "Maya offers"
    on ones that aren't, on the card itself inside a spare or feed tile). Threads (`drawPlay`, drawn after the chips
    each frame via a redefined `drawTraders`): one hairline from each tile's bottom edge to the top of the Trade
    button; a card beyond the fold gets a fainter stub from the screen edge at its x, so the offer still reads as
    out there. Both only while the lens bar is up.
  - The event (`showReply`): `c.flash = { gold: true }` and a gold `g.ripple` on every card of the trade, `g.beat`
    with a colour (`drawPanel` and `drawLive` copied to honour `beat.col`), a gold race line to Trade (`drawRace`,
    the round 12 line in either colour), then the Trade button's badge ticks up and glows gold (`.xbadge`, `.xglow`).
  - The crossing (`startCross`, `flyCard`, `finishCross`): give cards `setOwned(false, quiet)`, dropped from
    `spares`, and lift out through the top edge (growing to a readable card as they leave the pocket); get cards fly
    in from the top edge, shrink into their pocket, and on landing `setOwned(true, quiet)` (dated now) and leave
    `chasing`. One `liftLayout(true)` when the last flight lands, not one per card (`lifted` is held false around
    each `setOwned`); in a lifted lens the leaving tiles fade (`c.away`) as the table does. A card whose panel is
    folded shrinks into the fold's hairline. With motion reduced, or in the list, it all just happens.
  - The counter: the dropped card leaves `play` and settles back (tag gone); the added card flies in and then joins
    `play` with `offer: true`. `#xbar` (a glass strip above the lens bar, like the Time bar) reads "Maya countered.
    Left out your Mew ex: your Giovanni's Charisma for her Pikachu. Maya's up $3.37." with Not this time (declined,
    with Undo) and Accept (the crossing).
  - Press and hold (`xPressStart`, a capture-phase touch listener plus mouse): 400 ms on a card in play cancels the
    base's press and toasts "Offered to Maya 2 min ago: your Mew ex for her Pikachu. Waiting on her." or the counter.
  - Redefined `drawChip` (Offered 2 for 1, waiting / Countered: 1 for 1 / Accepted, crossing / Traded 2 for 1 /
    Declined / You passed), `shake` (the record starts proposed and the reply is scheduled; Undo unschedules) and
    `drawList` (a Trades section on top of every lens with the line, the balance, the state and Accept and Decline
    on a counter; cards in play say so in their row).
- `styles.css`: the gold badge and glow on Trade, the counter strip (hidden with the lens bar, lifted above the Time
  bar), gold Accept.

## Try this first on the phone
1. Import with "Chase every card I'm missing", open a card you own and choose Spare (two or three that someone
   wants: Trade shows who), then Trade, tap Maya, drag a card or two of yours and one of hers onto the table and
   Shake hands. The table closes and your cards sit in the wall with gold tags, leaning toward Trade on gold threads.
   Scroll away: the threads still run in from the edge.
2. Wait twelve seconds. The cards flash gold, the panel says "Maya accepted", a line races to Trade. Then yours lift
   out through the top of the screen, hers fly in and land with the flood, and the toast reads what changed hands.
   Check Have: the count moved.
3. Propose again (the reply is seeded by the moment, so it varies): on a counter the card she left out settles back,
   or the one she added flies in wearing "Maya offers", and the strip asks Accept or Not this time. Press and hold a
   tagged card for the one-line story. On a decline, read why.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing about tap, pinch, drag or the composed levels changes; on a fresh wall nothing
is in play, so the hold listener, the lean, the threads and the reply never engage during the tests.

## Frame budget
`npm run test:perf -- --variant r13-radical-cards-cross`: mosaic 16.7 ms per frame, held pinch 16.7 to 17.8 ms per
frame (budget 34 ms; the base measures the same). At rest the lean is a static offset and a thread is one hairline;
`drawTile` only does extra work for cards in play (a map lookup guarded by `play.size`). Flights, flashes and the
race line ask for frames only while they run.

## Unsure about
- The lean is six pixels. On the tiny Have-lens tiles it reads as "something is off about those two", which is the
  intent, but the thread does most of the pointing; a bigger lean looked broken rather than pulled.
- "The Trade button offers Accept or Not this time" became a strip above the lens bar (the Time bar's spot) rather
  than something inside the button: two words inside a lens button broke the lens. The strip stays until answered.
- A counter that leaves out one of your cards means you get the same for less, so "balance shifts toward them" in
  the shared rule reads oddly here; the mechanics are as written, so the three variants compare.
- Acceptance has an `accepted` state for the two seconds the cards are crossing before `done`; a reload mid-flight
  lands as accepted-not-done, and the next load treats it as nothing to do (the cards stay). Rare, but a real app
  would replay the completion.
- In the Trade lens Maya's card usually lands in a folded panel (nothing to trade there), so the arrival is a card
  shrinking into a line; the Have lens is where the crossing reads best. Should an acceptance switch to Have first?
- Press and hold on a card in play inside a set replaces press-and-hold-to-mark for that card while the trade is
  open; marking it is the panel's I have it, or Mark mode, until the trade settles.
