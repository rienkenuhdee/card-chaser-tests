# Experiments

## The loop

1. **Diverge.** Three takes on one question: one safe, one bold, one radical. Built in parallel as variants.
2. **Feel.** Ryan tries them on his phone. Feel beats screenshots.
3. **Harvest.** Keep the moments that were great, even if the variant as a whole wasn't.
4. **Normalize.** Reshape what's kept toward patterns people already know, so it's intuitive on first touch
   ("zeitgeist digestible"). The novelty stays in the feel, not in having to learn something.
5. **Guard.** The gesture contract and frame budget pass before anything lands.

## Principles (learned so far)

- **The interface owns the camera.** Every gesture lands on a composed view: mosaic, framed set, or card. Never a
  free-floating in-between state. Free zoom-out felt empty; composed levels felt designed.
- **Fill the screen with meaning.** No empty void at any level. The mosaic packs cards into panels; panels tile the
  screen; it scrolls when it must rather than shrinking to dust.
- **Transitions are continuous, not cuts.** A set's tiles physically become its binder. Rearranging moves every card
  to its new place. The thing you tapped is the thing that grows.
- **Gestures scrub, then snap.** A pinch holds a transition under your fingers; release snaps by speed first (a quick
  flick wins), position second. A small pinch never closes a set.
- **Familiar on top of novel.** Back button, pull to scroll, tap to open, press and hold to mark, Mark to select a
  handful like Photos. The mosaic is novel; how you move through it shouldn't be.
- **A collector's archive, not a toy.** Archivo (condensed for names, tabular figures for prices), hairlines, small
  radii, color from the cards themselves. Rounded, bouncy type read as "comic sans".
- **Lenses over pages.** Have, Need, Chase and Trade recolor what you're looking at instead of navigating away. A lens
  may rearrange as well as recolor (Chase deals your chase list out of the wall), as long as every other lens flies it
  all home and the wall is exactly as it was. Value and Time are filters by the search box: they sit on top of any lens.
- **A deal is a property of a want.** A live listing matters because you're chasing the card, so deals live inside the
  want list, leading their set, rather than as a surface of their own.
- **Frame budget is a feature.** A slow frame makes pinches lag and makes a flick read as a slow release, so snapping
  goes the wrong way. Keep the held-pinch frame under budget (see `npm run test:perf`).

## Log

**Round 1: The Wall.** Every card on one zoomable canvas, sets as blocks, semantic zoom (heat map, binders, card).
Lenses instead of filter pages. Kept: lenses, marking that floods in with a ripple, the heat map as an overview.

**Round 2: Rearrange, press and hold.** Layouts by set, by Pokémon (the Dex as region blocks), by value, with every
card flying to its new place. Press and hold to mark with Undo. A list view for screen readers. Kept: all of it; the
rearrange flight was the standout.

**Round 3: Archive look; size is worth; Time.** Moved off a rounded display face to Archivo; cards became color chips
with a printed label strip. By value sized cards by price. The Time lens replays the collection filling in, with a
growth curve behind the slider. Kept: the look, Time, size-by-worth.

**Round 4: The mosaic.** Free zoom-out felt empty, so the camera became UX-controlled: mosaic, framed set, card.
Panels tile the screen; tapping a panel grows its tiles into the binder. Kept: the structure ("we're getting somewhere").

**Round 5: Pinch that scrubs; mosaic scroll.** Pinch drives the open/close transition and snaps on release; the mosaic
scrolls. Feedback: snapping still unreliable, scrolling hit or miss on the phone.

**Round 6: Touch fixes.** Root causes: ghost fingers from dropped pointer events (fixed by reading the touch list),
touches ignored during animations (now they finish the animation and take over), diagonal drags read as set flips,
position-only snapping (now speed first), and a 374ms held-pinch frame on GPU canvases from per-card font setting and
text measuring (now 24ms). Gesture contract added as tests.

**Round 7: Where deals live.** Three answers: a bottom sheet listing live deals (their own surface), the Deals lens
rearranging every panel so deal cards fly to the corner and grow by discount, with no-deal panels folding to a line
(inside the mosaic), and deals arriving as the card tile itself flying from its panel into a tray along the bottom
edge (notifications). Kept: the lens reflow, and All flying it home. Learned: a lens can change layout as well as
colour and still feel like a lens, because nothing is navigated away from. A deal must be under market or it's noise
(the data now drops at-market copies). The sheet was a page in disguise, and the tray's up and down swipes had no
precedent, though its arrival flight is worth revisiting as the notification.

**Round 8: Opening a booster pack.** Three answers to marking a stack fast: a Select mode inside a set like Photos
(tap to toggle, sweep along a row to paint, a bar with the count, Undo and Done); "Open a pack", a number pad where
each typed number flips the card out of the binder into a fanned hand and Done deals it in; and the pack as a gesture
(pull down past the top of a binder for a sealed pack, tear it, swipe through the set's missing cards). Kept: the Select
mode, with press and hold as the way in (hold, then keep the finger down and sweep). Learned: a numbered-ghost flight
and a holo flash are lovely, but we don't rip packs in this product, so the two pack variants stay in the archive as a
reserve of animation for later (the flip-out, the dealing-in wave, the sealed-pack reveal). Inside Select, a sideways
drag paints instead of sliding to the next set; a drag from the title still slides.

**Round 9: The show floor.** Three answers to one-handed and glanceable: a Show mode that turns the wall into a
Reminders-style checklist of wants; a thumb-reach keypad of set codes and digits that answers with a huge NEED IT /
HAVE IT verdict; and the hit list, where the wants deal out of their panels as big tiles stacked from the bottom.
Kept: the hit list, reframed. It isn't a show mode, it's the want list, and it took over the Deals lens: Wants folds
the wall back and deals the wants out by set, live deals leading each set with the asking price, "was" and percent
under (the round 7 lift's treatment, now inside the tiles), the rest showing the most you'd pay. Tap the circle or
swipe to say you got it; the tile flies home and a keypad asks what you paid. Learned: the verdict banner was the
clearest show-floor answer but needed set codes the vintage sets don't print; the budget line and the show dates were
scaffolding, not the idea. Dropped: the round 7 deal lift (replaced by this), the Show pill, the budget.

**Chrome, after round 9.** Ryan's reshuffle: the lens bar is Have, Need, Chase, Trade (Wants became Chase; Trade is your
spares, made up for now, with Spare on any card you own). Value and Time moved up by the search box as filters that
combine with any lens. A settings cog by the info button holds appearance, the list view and reset. Chase keeps the
mosaic's structure, like the other lenses: it is the round 7 lift again, keyed on the chase list. Every panel with
something to chase goes full width with the chased cards in front as feed tiles (the deal tile, green with the asking
price and percent under, or the most you'd pay), the rest of the set packed small beneath, and panels with nothing to
chase fold to a line. Tap a tile and the card pops up with every copy online to swipe through, and a Single, Pack, Box
switch looks for the packs and boxes it comes in, with the odds of pulling it.

**Round 10: Trading.** Three answers to your spares meeting someone else's wants, with made-up collectors seeded per
card: a marketplace listing per spare (who wants it, what they'd give, Propose); the pair as the unit, your spare beside
their spare you chase with a balance beam and "Even it up"; and the trade table, where tapping a collector turns the
screen into a table between you, their spares above, yours below, cards dragged onto it staying put with the balance
between the piles. Kept: the table, whole. Learned: a composed level with the Wall's own binders beats a sheet for a
two-sided act; the balance reads best as a sentence between the piles; the seeded data needed prefix keys because the
hash correlates keys that differ only in their last character.

**Fixes with round 10.** A spread inside a set now lands on the card under the fingers, centred, and a pinch from a card
lands on the set rather than closing it (closing takes a second pinch). Chase tiles carry the card itself beside the
price. Need dims what you own further and rings the cards you're chasing in gold. In Mark, press and hold puts a card on
your chase list (or, owned, up for trade). The top-left menu is the chase: by set, by Pokémon, by artist (illustrators
made up for the demo), or by value.

**Round 11: The first 30 seconds.** Three openings from an empty wall, each leading with an import from TCGplayer or
Collectr (pretend: the seeded collection floods in): a first-run sheet with three steps (pick your sets, mark a few,
chase one); the wall building itself from the first ten cards typed on a number pad; and ten flicks through famous
cards ending in the mosaic assembling itself from nothing. Kept: the welcome sheet, with Ryan's two additions: Select
all in the set during the marking step, and "Chase every card I'm missing" on the import. The wall now starts empty
on a first run; the seeded 541 are what an import brings in, and Reset the demo returns to the opening. The chase list
and spares start empty too, and a deal only shows on a card you chase. Learned: the import is the real first step for
most collectors, so the manual path is the "or"; the assembly from nothing and the typed card landing are worth
lifting into the import's flood later. Dropped: the ten-card quota and the flick axis.

**Round 12: A deal arrives.** Three answers, on a simulated feed (a live copy lands on a chased card every nine
seconds): a badge on Chase and a banner that taps through to the offers; the card itself flying up to a "Just in" shelf
and leaving a ghost; and the wall being live, the tile flashing where it sits with a ripple, the panel header beating
the price, a line racing to the Chase button, "just now" under the price in Chase, and a struck-through price on a
drop, with a Live filter that replays the session. Kept: the live wall, without the replay. Learned: the event in the
wall is noticed without nagging, and the badge on Chase is enough of a count; the shelf and the ghosts were a surface
of their own again. Open: one tap from the mosaic to the offers when the tile is off screen. Also fixed: the Time
filter showed "Invalid Date" on an empty wall.

**Round 13: After the handshake.** Three answers to a proposed trade, on a simulated other side (twelve seconds after
Shake hands the trader accepts, counters by one card, or declines with a line, seeded by the moment): the trade as a
thread in the trade bar, the counter as her hand moving a card on the same table, and the trade living in the wall
itself with the cards leaning toward Trade on gold threads and crossing through the top edge. Kept, as the critic
proposed: the thread as the bar (You proposed, Maya countered, Traded Oct 5, the rows in the list too) over the
bold table (Shake hands keeps the table up with the cards gathered in her hands under "Waiting on Maya"; a counter
moves one card with her ink on the table and offers Decline, Counter and Accept; Counter back puts the table in your
hands and Shake hands sends it; an acceptance crosses the cards, drops them into their new binders and closes on the
new wall), with the radical crossing when you've left the table: the reply flashes the cards gold where they sit and
beats the panel header, a toast carries the line with Open, and an acceptance lifts your cards out through the top
edge as hers fly in and land with the flood. The counter rule is reconciled toward them: she leaves out one of hers
or asks for one more of yours she chases. Learned: the thread is the familiar shape for state over time, the table is
the familiar place for her hand, and the wall is where the outcome belongs when you're not looking; the threads, tags
and lean read as a glitch. Dropped: the threads and the lean, the press-and-hold read-out, the counter strip above the
lens bar. Also fixed: a deal arriving while the table was up started a wall morph that froze under it; the wall now
takes its new shape at once under the table.

**Round 14: Defining a chase, and what people chase in a set.** Three ways to say what you're after: a saved
search (a New chase form behind the top-left menu, with Set, Pokémon, Artist, Dex and Custom and a live count); one-tap
rules made from the card in hand ("Chase more like this": Every Venusaur, Everything by this artist, Full art in 151,
the artist's Venusaurs, Popular in 151, All of 151); and a sentence typed into search ("arita full art") that becomes a
chase with one tap. Each set's popular cards came from one shared rule (rarity, price and a seed, the top 6%). Kept,
with Ryan's direction that a chase belongs on the wall with the real sets: a saved chase is now a panel of its own at
the end of the wall, with its binder, count and progress bar, made of twins of the cards in their sets (marking one
marks both). Chases come from the card's "Chase more like this" chips (bold), from a New chase panel at the end of the
wall that opens one plain form with every picker and a live count, the wall dimming to the match (safe's sheet,
untabbed), and from a set's "People chase" row of name-and-price chips under its title with Chase these (safe). The
top-left menu is gone: a Pokémon or an artist is a chase now, and the price-band layout sits under the Value filter. Full art is tier 4 and up; rules
are one shape folded into the card's default chase flag, so a hand-picked off still wins. Learned: a chase reads as a
set of your own once it sits beside the sets, and the card in hand is the fastest way to say "more like this"; a
sentence is a query language, and dimming the wall to the popular cards left a void. Dropped: the chase sentence, the
Popular filter, the active-chase pill, the chases list in the menu. Also: starting a trade asks In person or Online
(coming soon).

## Open questions (next rounds)

- A deal arriving off screen: one tap from the line to the offers, and whether the arrival should nudge the wall.
- Painting past the screen's edge: should a sweep scroll the binder as it goes?
- At the show: does the Wants lens alone carry a vendor table, or does the verdict (NEED IT, pay up to) earn a place when a card is looked up?
- Trading: a real other side (the twelve-second reply is a stand-in), more than one card per counter, and whether a done trade should fall off the chip after a day.
- Starting a trade: spares begin empty, so the demo needs a few marked by hand; an import option for doubles, or a hint on a spare's panel naming who wants it.
- The import's reveal: the round 11 assembly from nothing as the flood after an import.
- A chase's twins: should a custom panel's cards also lead in the Chase lens, or only their set's copy? And should a chase hide from the wall once it's complete?
- Bringing the mosaic into the real app as the Chase home.
