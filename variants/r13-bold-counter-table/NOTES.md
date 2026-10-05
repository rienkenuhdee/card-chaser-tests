# r13-bold-counter-table

**Round:** 13. After the handshake: what happens to a proposed trade?
**Concept:** The reply happens on the table itself. After Shake hands the table stays open with the cards gathered in
Maya's hands under a thin "Waiting on Maya" line; twelve seconds later her hand moves the cards on the same table (one
of yours slides back to your binder, or one more of hers comes down from her binder) and the balance rewrites itself,
or the cards cross over and fly on into their new binders and the wall floods, or she pushes them back with one line.
The counter is her hand on the table, not a message.

## What changed
- Added `76-reply.js` and `styles.css`. Nothing replaced or removed; `index.html` untouched (a second bar button,
  `#tb-alt`, and the waiting line, `.tb-wait`, are injected).
- The shared rule: twelve seconds after a proposal the trader replies by `h32(`${t.id}|${rec.at}|reply`)`: under 0.45
  accept, under 0.8 counter (drop one of yours they asked for, or add one more of theirs you chase, by a second seed;
  a one-card give can only get an add, no spare offers can only get a drop, neither falls through to accept),
  otherwise decline with one line ("Maya: I'd want the Charizard too.", or "Maya: I'll pass on this one."). The record
  stays in `wall-trades` as `{t, give, get, at, state, reply, round}`; `state` is proposed, countered, accepted,
  declined or done. Records from before this round read as proposed. Reset the demo clears them (base).
- Redefined `shake`: the record is written (or, after Counter back, the same record updated with a new `at` and
  round), the proposal toast keeps Undo (withdraws), and the table goes to the waiting phase instead of closing.
  Redefined `tableSlot`: while waiting the cards on the table gather in one row at the top of the strip, in her hands,
  and the existing per-frame ease carries them there and back. The pockets they left read "With Maya".
- `.tb-wait`: a thin line of text over the strip with a pulsing dot (CSS, so the canvas does not animate at rest;
  still under reduced motion). The bar reads "Waiting on Maya" with Withdraw.
- `replyTo` plays the reply on the table when it is open on that trader and waiting (`playReply`): a counter moves one
  card with the table's own `place` flight (down to your binder, or down out of her binder), the strip's border takes
  her ink and the bar becomes "Maya's counter: Added the Squirtle" with Accept and Counter back; an acceptance runs the
  handshake crossing, then `handOver` flies hers into the front of your binder and yours up into hers ("Yours now",
  "Maya's now" pockets, green and gold rings), then closes the table and `completeTrade` runs on the wall: your cards
  `setOwned(false, quiet)` and dropped as spares, hers `setOwned(true, quiet)` dated now and taken off the chase list,
  one lift flight for the whole trade (not one per card), and the toast "Traded with Maya. You're up $0.16."; a
  decline pushes every card back to its binder with her line in the middle of the empty table and the bar reading
  "Maya passed".
- Counter back puts the table back in your hands (drag again); Shake hands then sends your counter ("Countered to
  Maya: ...") and the clock restarts. While waiting or countered a touch on the table says why nothing moves; the
  binders still scroll and a pinch still closes.
- Off the table: the chip reads "Waiting on Maya", "Countered: 1 for 3", "Traded 1 for 2" or "Maya passed"; the reply
  arrives as a toast with "See the table" (the Trade lens, then the table, restored to the counter or her line), and an
  acceptance completes at once with the flood and "Maya accepted. Traded with Maya. You're up $0.16." A table reopened
  while waiting comes back with the cards in her hands; one reopened after a counter comes back with her counter on it.
  Closing the table mid-acceptance still completes the trade. A reload mid-acceptance completes it on load; pending
  proposals get their reply once the wall has inked in.
- Redefined `toast` (a button label other than Undo), `updateTradeBar`, `openTable`, `endTable`, `drawStrip`,
  `drawTable`, `drawBinder`, `drawPocket`, `drawChip`, `tDown`, `drawList`.
- The list: a "Trades in progress" section above "Trade with", one row per open record with what each side gives, the
  balance, and the state line; Withdraw while waiting, Accept and Decline on a counter. Propose is hidden while a trade
  with that collector is on the table. Traded collectors read "Traded 1 for 2".
- Reduced motion: no flights; the gathered cards appear in her hands, a counter's card appears in its place, an
  acceptance closes the table at once and the wall floods. Dark mode through `theme` and CSS variables.
- Found while building: a live deal arriving while the table is up starts a lift morph that freezes under the table
  (the base frame returns early at q = 1), so `state.trans` stays set until the table closes. The reply only waits on
  wall transitions when the table is down.

## Try this first on the phone
1. Import with "Chase every card I'm missing", open a few cards you own and mark them Spare, then tap **Trade** and
   **Maya**. Tap two green cards of hers and one gold of yours, **Shake hands**, and watch the cards slide up into her
   hands under "Waiting on Maya". Wait twelve seconds. If she counters, watch her move one card and the balance
   rewrite; tap **Accept** and watch the crossing, the cards drop into their new binders, the table close and the wall
   flood. If she passes, read her line on the empty table and try again. Then propose again, tap Back while waiting,
   and take the reply from the toast's **See the table**.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing outside the table changes; the tests run on a fresh wall with nothing proposed.

## Frame budget
`npm run test:perf -- --variant r13-bold-counter-table`: mosaic 16.7 ms, held pinch 17.8 ms (budget 34). The waiting
table draws no frames at rest (the pulse is CSS); one flight at a time; no foil while anything on the table moves.

## Unsure about
- The shared rule's counter (drop one of yours, or add one of hers) moves the balance toward you, not toward her, so
  her counters are always generous. Her "I'd want the Charizard too" decline is the only reply that asks for more.
  A counter that adds one of yours would make Counter back matter more.
- "Accept" rather than "Accept her counter": the bar on a phone has room for two short buttons, and Theo and Jun share
  the copy. The head above them reads "Maya's counter".
- After a counter the cards return to the normal left and right layout; while waiting they gather in one row at the
  top of the strip, nearer her binder. Is the gathering enough to read as "in her hands"?
- When her cards land in your binder and yours in hers, the binders shift a column to make room (an instant shift
  under the flight). Smoother would be easing the columns.
- Twelve seconds is long on a phone and the table has nothing to do while waiting. Withdraw is there; should the chip
  strip be reachable without leaving?
- A trade with Maya "done" leaves her chip reading "Traded 1 for 2" until the next proposal, and the list drops the
  record from "Trades in progress". Should done trades have a history somewhere?
