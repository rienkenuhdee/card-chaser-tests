# r18-bold-in-the-mail

**Round:** 18. Trading online: what does a trade look like when the other person isn't across the table?
**Concept:** The familiar online flow: Online in the chooser opens the same table, Send offer sends it, the thread carries the reply, and an acceptance starts a short shipping lifecycle (ship by a date, Mark shipped, in the mail, arrived). The new idea is that the mail is on your wall: a card coming to you sits faint in its own empty slot with a gold edge that fills as the parcel travels, then fills in solid when it arrives, and a copy you've sent leaves a ghost behind its tile until it reaches them and lifts away.

## What changed
- Added `86-mail.js` and a few lines in `styles.css`. No part is replaced or removed, and `index.html` is untouched. The Online row in `#trade-how` loses its "Soon" tag, and the Settings and About additions are inserted by the part.
- **Starting a trade:** `startTrade` is redefined. It asks In person or Online unless an offer is out or a parcel is in the mail with that trader, and in that case it opens the table the way that trade was made. The base skipped the question after any earlier thread, so after a done trade you're now asked again, since otherwise you could never switch to online with someone you'd met in person. If the wall is still mid-morph when you choose (a lens change finishing, a deal landing), the table now waits for it rather than the tap doing nothing, as it could before.
- **The table, online:** `shake` is redefined so the record gets `how: "online"`, and `updateTradeBar` is redefined for the online wording (Send offer, "By mail: 1 of yours for 1 of Maya's"). `accept` is redefined too. In person it is exactly the base code (playAccept or crossOnWall). Online, it starts the mail instead: the table shows "Maya accepted" with "Ship Magneton by Thu" for 2 s and then closes, and the close flight carries her cards into their own slots on your wall as ghosts (`closeTable` and `endTable` are redefined, otherwise unchanged). With the table down, her acceptance flashes the ghosts where they'll land, and a toast offers Open.
- **The lifecycle (all seeded by `h32(`${t.id}|${rec.at}|mail|…`)`):** ship by day 2 for both of you. Maya ships at day 0.3 to 1.1 and her parcel takes 1.5 to 2.5 days. You tap Mark shipped (on the toast after the table closes, in the trade bar, on the card panel of the card you're sending, or in the list), and yours takes 1.5 to 2.5 days. Each step goes in the thread ("Maya shipped: Squirtle. Arrives Wed.", "Arrived: Squirtle is in your binder.", "Maya received: Magneton.", "Traded Oct 9."), and the chip reads "Ship by Thu", then "Arrives tomorrow", then "In the mail", then "Traded".
- **The ghost coming in (`drawTile` redefined, the base body with the mail added):**
  - Far out (dots): a faint dot in the card's colour.
  - Arm's length: a faint chip with a gold hairline and a gold bar along its foot that fills.
  - Up close: the card face at 34%, a gold edge running clockwise round it (dashed until it ships), and "From Maya / Arrives Thu".
  - On arrival the card floods in solid from the middle over the ghost, with the gold flash and ripple, and the panel's count beats in gold ("78/102") for a moment. The card leaves your chase list and the set's count ticks.
- **The copy going out:**
  - Arm's length: the same gold hairline and foot bar on the solid tile.
  - Up close: a ghost copy peeks out behind the tile, offset up and right, its top and right edges filling gold as it travels.
  - The copy is spoken for: the `spares` Proxy is wrapped so a copy in the mail isn't a spare any more, which keeps it off the table and out of the Trade lift.
  - When it arrives, the copy lifts out through the top edge (`flyCard`) and the count drops by one, per the copies model.
- **Chase lens:** a chased card on its way stays lifted, but `drawFeedTile` draws it as "Coming / from Maya / Arrives Wed" with a progress bar and the card faint, in place of "the most you'd pay". Deals stop landing on it. Tapping it (`popCard` redefined) says where it is, with Open, instead of showing copies for sale.
- **Elsewhere:**
  - `emphasis`: in the Trade lens, cards in the mail either way stay at full strength.
  - `updateFlag`: the card panel's line reads "On its way from Maya: arrives tomorrow." For a card you're sending, the spare line becomes "One copy is going to Maya. Ship it by Thu." with Mark shipped. For a ghost, Find a copy becomes See the trade.
  - The list view: `lstateOf`, `rowsOf`, `chipState` and `tradeListHTML` say the same things in words, and the list has Mark shipped.
  - About gets one line on online trades.
- **The demo clock:** a day passes every 20 seconds while something is in the mail and the wall is open. A closed page pauses it, and each tick is capped at 2.5 s, so a parcel can't jump 12 years overnight. Settings has "Trading online: In this demo a day passes every 20 seconds while something is in the mail." with **Skip a day**, which closes Settings so you watch what happens. Events come one a second at most, and arrivals wait until the wall is still (no table, binder, room, transition, press, Mark or pop-up). Dates shown are demo dates, so a finished trade can read "Traded Oct 10" on Oct 6.
- **Persistence:** the record's new fields (`how`, `mail`, and the `shipped` and `arrived` log entries) ride in `wall-trades`, which a base build reads without harm: it ignores the unknown kinds and the `mail` state. The clock is in a new key, `wall-mail-clock`, which Reset clears.
- **Cost:**
  - Far out, a ghost is one `fillRect`. At arm's length it's two fills, a `strokeRect` and a bar.
  - Up close it is a `cardFace` at low alpha plus one stroked path, and that's only for the handful of cards in the mail.
  - Every other tile pays two property reads (`base.mailIn`, `base.mailOut`).
  - There are no gradients, shadows or font changes per tile on the far levels.

## Try this first on the phone
1. Open Trade, tap Maya and choose **Online**. Drag a card of hers you chase and one of yours onto the table, then tap **Send offer**. About 12 s later she answers (it's seeded, so if she counters, Accept). The table says "Maya accepted. Ship … by Thu", closes, and her card flies into its own empty slot on your wall and stays there as a faint ghost with a dashed gold edge.
2. Tap **Shipped** on the toast, then go to Have and find the ghost (gold hairline in the mosaic). Open its set and watch the gold edge run round it once she ships (around 20 s), with "From Maya / Arrives Fri". Try Chase too: the card reads "Coming", not a price.
3. Settings, **Skip a day** a couple of times. Her card fills in solid where it sits, with the flash, and the set's count beats in gold. A day or two later your copy lifts away through the top of the screen and the ×2 becomes nothing.

## Gesture contract
All checks pass. Navigation is unchanged. The only input change is in the trade chooser: the question is asked again for a new trade after a finished one (see above).

## Frame budget
`npm run test:perf -- --variant r18-bold-in-the-mail` (empty first-run wall): mosaic 16.7 ms, held pinch 17.8 to 20.0 ms over two runs.
On an imported wall with two trades in the mail (three ghosts and two outgoing copies, scratch script at dpr 2, held pinch on Base Set where a ghost and an outgoing copy are): mosaic 16.7 ms and held pinch 18.9 to 26.7 ms across runs. Those runs went in parallel with two other builders' tests, so they're noisy, but they're under 34 ms every time.

## Unsure about
- Auto-closing the table 2 s after an online acceptance mirrors in person (which closes after the crossing), and it's what shows the ghost landing. But it takes Mark shipped off the screen, so it lives on the toast, the chip's table, the card panel and the list instead.
- The demo clock jumps the calendar ahead (four or five demo days per trade), so "Traded Oct 10" can appear on Oct 6. It's honest to the demo clock, but odd next to real "2 min ago" times in the thread, which I kept for the offer and reply rows.
- The outgoing ghost copy peeks out behind the tile only up close. In the mosaic, "going" and "coming" share the gold hairline and foot bar: the faint inside means coming, the solid inside means going. That may be too subtle at a glance.
- The trade binder (`tbList` reads the counts directly) still lists a card whose only spare is in the mail. The table and the Trade lens don't.
- Arrivals wait while the table, binder, trophy room or a pop-up is up. If you sit on Maya's table you won't see her parcel land until you leave, by design, but the chip can say "Arrives today" for a while.
- An incoming card stays on your chase list until it arrives (that's what lets Chase show it as coming). "3 to find" in the Chase lens still counts it.
