# r18-safe-ship-it

**Round:** 18. Trading online: what does a trade look like when the other person isn't across the table?
**Concept:** Online trading the way the marketplaces do it: Online in the chooser opens the same table, but their side
reads like a listing (the trader's record, each card's condition, a photo while you hold one) and Send offer replaces
Shake hands. Once both accept, the trade becomes a shipment with a short lifecycle in its thread (Ship by Fri, Mark
shipped, In the mail, Delivered, Got them), and the cards cross onto the wall the way an in-person trade's do.

## What changed
- One added part, `86-online.js`. It redefines these functions and keeps the base body for anything that isn't online:
  `startTrade`, `openTable`, `shake`, `accept`, `updateTradeBar`, `tDown` (wording only), `drawBinder`, `drawStrip`,
  `endTable`, `rowsOf`, `rowHTML`, `renderThread`, `chipState`, `drawPicks` (adds the wall marks), `drawFeedTile`,
  `popCard`, `updateFlag`, `lstateOf`, `drawList`, `tradeListHTML` and `nextArrival`.
- `styles.css` adds the photo close-up, the Mark as shipped dialog and the Settings note.
- **Chooser:** Online is live (the Soon tag is gone). The chooser now asks every time nothing is live with that trader.
  Before, it was skipped once any thread existed, so after one trade you couldn't pick again. A live offer or shipment
  still opens straight onto the table. The binder's trade and Show mode still open in person, as before.
- **Their side online:** the header says "37 trades, all arrived. Ships from Sacramento." (seeded per trader). Every card
  of theirs has a grade tag (Near mint, Lightly played, Played, Heavily played), seeded by card and trader. If you hold
  one of their cards for 0.4 s, a photo of their copy comes up: on a desk, slightly turned, with lamp glare and the wear
  its grade describes (whitened corners, scuffs, a crease). Let go and it goes away. The strip under the table says so.
- **Sending:** Send offer, "Offer sent to Maya", and then the seeded 12-second reply, the same as in person.
- **Accepted online:** the record keeps `state: "shipping"`, `mode: "online"` and a `ship` object in `wall-trades`. One
  copy of each card you're sending comes off your count straight away, so it stops being a spare. Cards coming to you go
  on your chase list. The mat turns into two parcels, From Maya and From you. Each parcel is dashed until it's posted,
  brown paper while it's in the mail, and green once it arrives. The status line sits under each parcel.
- **Lifecycle (demo clock: a day passes every 20 s, counted from acceptance):**
  - You have 3 days to ship (Ship by Fri, then Ship today).
  - Mark shipped asks for an optional tracking number.
  - Their parcel posts on day 1 or 2, with seeded tracking.
  - It's delivered 2 to 3 days later.
  - You confirm Got them. The table steps aside and their cards fly in through the top edge, landing with the marking
    flood. This reuses `flyCard` from round 13.
  - Your parcel reaches them 2 to 3 days after you post it.
  - The trade is Traded once both are done.
  - Each step gets a row in the thread dated with the demo weekday, a toast (Got them on a delivery, otherwise Open)
    and a gold flash on the cards.
- **On the wall:**
  - A card with a copy leaving shows "↑ To ship" (gold), then "↑ On its way". The tag sits at the foot of the card's
    art; on small tiles it's a dashed outline and a dot.
  - A card coming to you shows "↓ On its way" (green).
  - In the Chase lens a card coming to you gets its own tile: On its way, from Maya, Arrives Sat, its grade. Tapping it
    opens the trade, not the offers.
  - The live deal feed skips those cards.
  - The card panel says "One copy to ship to Maya, by Fri" with Open the trade.
- **Settings:** a section headed Online trades. It says plainly that a day passes every 20 seconds and has Skip a day,
  which moves every parcel a day on. Reset the demo clears everything, because it all lives in `wall-trades`.
- **List view:** the Trade lens list leads with In the mail: each shipment, where both parcels are, and the one button
  for your next step (Mark shipped or Got them). The threads under Trade with show the shipment rows. In the Chase list,
  a card coming to you says "On its way, from Maya, arrives Sat" instead of Got it.

## Try this first on the phone
1. Trade lens, then tap Maya, then Online.
2. Hold one of her cards to see the photo and its grade.
3. Tap a card of hers and one of yours onto the table, then Send offer.
4. About 12 seconds later she replies. If she counters, Accept.
5. Mark shipped (leave tracking blank or type one).
6. In Settings, tap Skip a day two or three times. Each tap moves the parcels a day on: watch the thread.
7. When "Maya's cards were delivered" appears, tap Got them and watch the cards cross onto the wall.
8. Before step 7, look at the Chase lens: the card that's coming is a dashed green "On its way" tile. The card you sent
   is marked on its tile in Have.

Without Skip a day, the whole lifecycle takes about two minutes.

## Gesture contract
All checks pass. Navigation is unchanged. The photo is a press and hold on the trade table only, while the finger stays
still. Moving more than 8 px, or a pinch, cancels it, so scrolling the binders and dragging cards work as before.

## Frame budget
- `npm test -- --variant r18-safe-ship-it`: mosaic 16.7 ms, held pinch 22.2 ms (budget 34 ms).
- On a populated wall, three runs each:
  - Base: held pinch 18.9 to 22.2 ms.
  - This variant with no shipment: 20.0 to 22.2 ms.
  - With a four-card shipment in flight: 18.9 to 24.4 ms.
- The wall marks are skipped while anything transitions. The photo is drawn once into its own canvas, not every frame.

## Unsure about
- **The demo clock.** It runs on real time since acceptance. Leave the page for an hour and every parcel has arrived;
  you just confirm. Is 20 s a day right, or should the clock only run while the page is open?
- **When your copies come off your count.** They come off when the deal is struck, not when you ship. That's what makes
  them stop being spares straight away, but a Cancel (not built) would have to put them back.
- **Cards coming to you join your chase list** so they show in Chase. If you hadn't chased one, it's now on the list
  until it lands.
- **The grade tag** is two lines on a narrow pocket ("Lightly / played"). Plain words over NM and LP, as the brief
  asked, but it's busy on a phone.
- **The chooser asking again after a finished trade** is a small change to how the in-person path starts.
- **Nothing for things going wrong:** no late penalty, no Report a problem, no Cancel. Late only changes the words to
  "Ship today".
