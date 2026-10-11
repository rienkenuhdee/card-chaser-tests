# r18-radical-live-table

**Round:** 18. Trading online: what does a trade look like when the other person isn't across the table?
**Concept:** Online opens the same trade table, but the other collector is at it right now: their named fingertip
moves over the mat, looks at your spares, picks cards up (they lift and wobble), slides them on or back, puts theirs
down, and reacts to what you do, and the trade closes only when you both hold the handshake at the same moment. Then,
because nobody hands anything over online, the cards sit in the middle of the mat ("Held until both arrive") while the
thread carries the mail a day at a time, and both walls get their cards when both parcels have arrived.

## What changed
- Added `79-live-table.js` and `styles.css`. Nothing replaced or removed; `index.html` untouched (the handshake row
  and the Settings row are injected).
- **How to trade:** Online is enabled ("Live at the same table, then you both ship") and opens
  `openTable(t, from, null, true)`. `startTrade` now asks In person or Online whenever nothing is in flight with that
  collector (the base skipped the question for anyone you'd ever traded with, which would hide Online for good); an
  offer that's out or a trade in the mail opens straight onto its table.
- **Their hand** (`lv`, `handTick`, `glide`, `drawHand`): a soft fingertip in the trader's ink with a name pill, gliding
  on a slight curve with seeded pace, a press that shrinks it, a pulse ring where it touched and a small mark that
  fades. A carried card is drawn under the finger, lifted with a shadow and a decaying wobble, and eases to its size on
  the table; the pocket it left reads "In Maya's hand". "Here now" and a green dot sit by their name. Reduced motion:
  the hand jumps (pauses stay), no wobble, no pulse rings.
- **The script** (`liveRun`, `opening`, `react`, `counterMove`, `verdict`, `herHold`, `wander`): an async loop seeded by
  `h32(trader id | step)`. Opening: they look at one or two of your spares they chase, put down one of theirs you chase,
  and ask for one of yours near it in price. Reacting (after a person's beat; your move cuts their idle short): a card
  of yours they chase gets a touch ("Maya likes your Dratini"); one they don't is slid back once ("Maya passed on your
  Pecharunt ex") and left the second time; one of theirs you take is noted ("Maya sees you want Eevee"). They're
  content when what they get (cards they chase at full price, others at half) covers what they give within a seeded
  tolerance. Not content, they counter: ask for one more of yours they chase that closes the gap (never one you took
  back), take their dearest card back, or swap it for a cheaper one. Sometimes they pause half way with a card.
- **The handshake** (`youDown`, `checkBoth`, `liveShake`): the bar's second row is two buttons, "Maya's hand" (Not
  holding, Reaching, Holding, in their ink) and "Hold to shake" (Touch Events for fingers, pointer events for the
  mouse, Space or Enter held for the keyboard). Content, they hold out a hand for about five seconds on their own, and
  join within a second when you hold yours. Both held for 650 ms (a green bar fills along both) closes the trade. Any
  change on the table lets both hands go ("The table changed. Hold again when you're happy"), the way a ready check
  resets.
- **Held until both arrive:** the record is `{ ..., state: "held", online: true, by: "both", lt: { at, skip0, them: {
  send, transit }, you: { sent, transit } } }` in `wall-trades`, its first log entry `shook`. The cards gather in one
  row in a dashed gold box mid-mat; the strip reads "Maya sends" and "You send". The bar says "Held until both arrive",
  "Day 2. Yours are in the mail. Maya's arrived." with **I sent mine** until you've tapped it (also in the list).
- **The mail:** a day is 20 seconds (`LIVE_DAY`), plus **Skip a day** in Settings under "In the mail" (shown only when
  something is). Seeded per trade: they send on day 0 or 1, each side takes 2 or 3 days. Thread lines with a day in
  place of the time: "You sent Ditto." "Maya sent Eevee." "Ditto is in the mail to Sacramento." "Eevee arrived."
  "Ditto reached Maya." and a waiting line. Off the table, their cards arriving is a toast with Open. When both have
  arrived the record goes to accepted and the cards cross: on the table with the in-person crossing (`playAccept("both")`,
  pill "Both arrived"), off it with round 13's wall crossing; `completeTrade` takes the copy. The chip reads "Send yours"
  (with the dot) or "In the mail, day 2". The skipped days persist in `wall-live-days` (Reset the demo clears it). A
  spare in the mail to one collector isn't offered to another unless you have another spare.
- Redefined (in-person branches copied unchanged): `startTrade`, `openTable` (a `live` argument; a held trade reopens
  held), `endTable`, `place` (tells the script about your moves), `tableSlot` (the held row), `drawStrip`, `drawTable`
  (draws the hand; in live mode the binders are drawn once and blitted back until something in view changes),
  `drawPocket`, `tDown` (a tap on held cards says why they don't move), `updateTradeBar`, `tbGo.onclick`, `rowsOf`,
  `rowHTML` (a day in place of the time), `chipState`, `tradeListHTML`.

## Try this first on the phone
1. Trade lens, tap Maya, then **Online**. Watch her hand come in, look over your spares, put one of hers on the table and
   pull one of yours over. Then drag one of yours she isn't after onto the table and watch her slide it back. When she
   says she's holding out a hand, press and hold **Hold to shake**. When the cards gather in the middle, tap **I sent
   mine**, then go to Settings and **Skip a day** a few times (or wait: a day is 20 seconds), and come back to watch the
   cards cross when both have arrived.

## Gesture contract
All checks pass (dpr 1 and 2). Nothing in the gesture contract touches the online table; the in-person table and the
trade binder's Show mode into the table behave as before.

## Frame budget
`npm run test:perf -- --variant r18-radical-live-table`: mosaic 16.7 to 18.9 ms, held pinch 20.0 to 24.4 ms over three
runs (base on the same machine: 16.7 and 26.7). The live table while her hand moves or carries a card: 16.7 ms a frame
(capped by the display) on the software canvas at dpr 2, because the two binders are cached as bitmaps; drawn
uncached, as the in-person table is, a forced frame there costs about 30 ms. Her hand is a few arcs, one cached
`font()` and a cached `textW()`; no gradients of its own; no foil while it moves. At rest (waiting, held) the table
draws nothing.

## Unsure about
- She's a script, and it shows after a few minutes: the same seeded habits, and she'll happily take a lopsided gift. A
  real other side needs presence, conflicting moves (two hands on one card) and someone leaving mid-trade; none of that
  is designed here.
- Hold to shake is a new gesture for this app. It reads clearly once you see her button light, but the first time
  someone will tap it; a tap says "Keep holding until Maya holds a hand out too", which may not be enough.
- The presence line lives in the bar under the balance, not by her hand. By the hand would read faster but crowd small
  cards; the bar is where the handshake is.
- Shipping is fully simulated (no addresses, no tracking numbers, no "I got them" from you). "I sent mine" is the only
  step that's yours; should arriving also wait for you to confirm?
- Who sends first, and what if one side never sends, isn't handled beyond the waiting line.
- `startTrade` asks every time now when nothing's in flight, which also changes the in-person path slightly.
- The binder caching would make the in-person table cheaper too; not done here to keep that path exactly as it was.
