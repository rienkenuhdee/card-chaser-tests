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
- **A collector's archive, not a toy; the app is one painting.** A geometric sans, large and confident (Futura on the
  phone, no web font needed), tabular figures. Square corners, flat fields of red, yellow, blue, black and white held
  in black rules, no glass or shadows; the map is one Mondrian and every room is one of its rectangles (round 23, De
  Stijl). Rounded, bouncy type read as "comic sans". The cards keep their own fuller palette: they're what's hung on
  the painting.
- **Things move along straight lines.** Across, then up or down; nothing overshoots or springs (round 23).
- **A look Ryan loves lands exactly as he saw it.** Fixes to it are offered, not folded in (round 23: a harvest that
  "fixed" radical's weak spots lost what he loved about it, and went back to the variant as previewed).
- **Lenses over pages.** Collection and Chase recolor or rearrange what you're looking at instead of navigating away
  (Chase deals your chase list out of the wall), as long as the other flies it all home and the wall is exactly as it
  was. What used to be the Need lens is a filter now: Show (All / Missing / Have), Color by, Group by and Time sit in
  one Filters sheet on top of either, with a chip that names what's on. Places that aren't the wall (Feed, Trade,
  Trophies, Source) are rooms one level up, not lenses (round 21).
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

**Round 15: Finishing a chase.** Three answers to the last card landing: a checklist's finish (gold ticks on the
progress bar for the missing cards you chase, the bar filling gold with "Complete since Oct 6", a Finished filter
folding done panels to a line); the last card as a moment (every panel naming its next card, the final card lifting
to the centre while "Complete" stamps the header, Keep on the wall or Put it away); and a trophy wall (finished things
minted from their own tiles into gold plaques on a shelf along the top, a sealed album behind each, a ring gauge on
every panel before then). Kept: the trophy wall with the safe ticks, and Ryan's rule that a trophy stays on the
shelf at the top for a day and then moves to the trophy case at the end of the wall with the rest. A finished set or
chase is minted where it sits, flies up, and the wall flows into the space; its album packs the cards edge to edge
with Back to the wall; a finished group kept on the wall offers Put on the shelf. Learned: a finish wants to leave
the working wall, and a plaque made of the group's own colours carries the memory better than a checkmark; the ring
gauge duplicated the bar, and the stamp edged toward a toy. Dropped: the ring gauge, the Finished filter and list in
Settings, the stamp, the next-card line (worth a return). Also fixed: completing a set threw, and Select all in a
chase marked its twins instead of the cards.

**Round 16: Where trophies live.** Three homes for a trophy after its day on the shelf: a trophy case at the end of
the wall (a header with the count, the total and a sort, plaques with a plain third line, a set's master and grand set
tucked under it, Share as a picture card); a trophy room behind a door at the end of the wall (one dark row with every
plaque's colours, tapping it slides the wall away for lit plaques on wood shelves, each with its worth over the year as
a thin line and the header summing the room, a set's other views stacked behind it and fanned on a tap); and a
timeline one level above the wall (pinch the mosaic and it shrinks to "Today" with the trophies hung on a line of dates
beside a growth curve). Kept: the room, whole. A pinch in the room or Back returns to the wall where you were; Back from
an album opened in the room returns to the room. Also: a trophy on its first day has To the case now in its album,
which sends it into the room without waiting the day (it keeps its real finish date). Learned: the room reads as an
achievement because it leaves the working wall entirely, and a worth line turns a trophy from a record into something
that is still doing something; the case's families and the timeline's history were good ideas that cost more to read.
Dropped: the sort, Share, the ghost plaques, the timeline. On a phone, safe's case didn't show a moved trophy for Ryan
(not chased down, since it was dropped).

**Round 17: Your spares.** How doubles get onto the wall and how a spare finds someone. All three gave every card a
copy count, with the import seeding doubles by card id (mostly commons and uncommons), and a done trade taking one
copy rather than the card. Safe: a stepper on the card panel ("You have 2"), every copy past the first a spare unless
you keep it, and a line saying who wants it with Trade with Maya. Bold: copies drawn as stacks at every level, and a
flick up off the stack to put one up for trade. Radical: a nine-pocket trade binder of your spares, most wanted first
with who chases each pocket, and Show mode, a dark full-screen spread handed across a table, whose picks become a trade.
Kept (the critic's mix): safe's counts, stepper and "Wanted by" line; the binder as a level behind a cover at the top
of the Trade lens, with Show mode into the table and a new Someone new that gives the picks away with Undo; bold's
copies stacked behind the mini card in spare tiles. The Trade lift stays, most wanted first. Learned: the empty Trade
lens was a data problem, not a layout one, and once copies exist a spare is just arithmetic; a binder handed across a
table is the most natural trading object we've tried. Dropped: the flick and the drag into the binder (a vertical drag
on a close-up meaning something new, depending on state you can't see), the far-out stack slivers (they read as
misdrawn tiles), the likely-doubles review (a seeded guess dressed as a review), Mark's Into the trade binder. Also
fixed: the import toast counted printings, so it disagreed with the counter.

**Round 18: Trading online (pinned).** Three takes on a trade when the other person isn't across the table, all on a
demo clock (a day every 20 s, Skip a day): a marketplace flow (the trader's record, a grade and a photo of their copy
on hold, Send offer, then Ship by, Mark shipped, Got them); the same with the mail on the wall (an incoming card faint in
its own slot, its edge filling as it travels, filling in solid on arrival); and a live shared table (the other
collector's hand on the mat, Hold to shake, both sides' cards held mid-mat until both arrive). Pinned by Ryan: online
trading needs real backend work first (accounts, addresses, shipping, trust), so nothing was harvested and the variants
live only on the round 18 branch (PR #27, left open). The critic's pick for when it returns: the incoming ghost on the
wall, the photo on hold, the shipping thread, the trader's record; not the live table or Hold to shake. Missing for
strangers in all three: swapping addresses, cancel before shipping, report a problem, a rating, a warning on a lopsided
offer, who ships first.

**Round 19: Production's trophies in the room.** Ryan asked to bring the trophy types of the live app into dev. All
three ported production's catalog where the wall's data supports it (per-chase milestones named by kind, Holo hunter,
Chase cards, Clean sweep, crowned signature trophies hand-made per set and generic, hidden "?" trophies, Dex and
global ones), production's medal artwork (a shape per kind, four tiers, nameplate), and luck (1 in 100 Shiny, about 1
in 10 Critical, seeded by trophy id here where production rolls on its server). Safe made the room production's Medal
tab (summary, Showcase, Next up, filters, a shelf per chase, the trophy sheet with the cards behind a medal); bold put
each chase's medals on its bar as pins and minted them there when the tipping card was marked; radical made the
catalog one more set on the wall. Kept: safe's room and sheet, bold's mint (inside a set only, one pin for the next
medal), bold's ribbons, and Ryan's ask that a finished set's plaque sit with that set's medals: one shelf per set or
chase, its plaque at the head with Binder Complete mounted on it, locked medals folded behind "12 more to earn". An
import or Select all earns in one card rather than a stream. Learned: production's catalog drops onto the wall's data
almost unchanged, so the two can merge; a medal earns most where its progress is (on the bar), and is read best
where its siblings are (the shelf); the catalog is long, and locked medals have to fold. Dropped: the trophy set,
pins in the mosaic (they read as glitches beside the gold ticks), the bar's end cluster, region masters past Kanto.
Left out of the catalog for want of data: buying trophies, region chases, promo milestones, Gym Circuit, Full
Evolution, the rarities the wall's sets don't have, and counts the wall can't reach (2,500 cards, 500 and 1,000
Pokémon, Splash!, Unown Alphabet).
Also, after the round: a Complete Dex chase (Ryan's ask), one pocket per Pokémon from #1 to #1,025 in Dex order,
each filled by your best print of that Pokémon (else the cheapest, to chase), the ones the wall's sets don't print as
dashed "Not in your sets" pockets that count in its total; its settings filter the prints (Any, Holo and up, Full art)
and the type. Picked in Choose your sets or the New chase sheet; it owns the Kanto, 50 and 151 Pokémon medals. It
doesn't flood the chase list; Need on its panel shows what your sets can fill.

**Round 20: The import's reveal.** What the first minute after your collection arrives shows you, now that an import
also brings spares, a trade binder, trophies and maybe the Dex, each of which used to announce itself separately.
Safe: one "Import complete" sheet after the flood, its rows doors into the wall. Bold: the camera toured composed
stops with a caption each (the set closest to done with its missing pockets ringed in gold, the binder cover, the
trophy door). Radical: the import played the collection in the order it was got, the Time clock running from the
first card to today with the moments landing on their dates. Kept (Ryan's mix): radical's story as the intro and
safe's sheet as the finish, with the critic's fixes: no empty lead-in (the clock starts on the first card), only the
first lucky trophy stops the clock (17 s from the tap to the sheet), the camera home before the sheet, worth counted
over the wall's own cards, a touch during the story ending it and leaving a toast with Open instead of the sheet, the
closest-to-done row opening that set with bold's gold rings on its gaps, and the moments kept as dots on the Time
slider when the import carries dates (an undated import does the plain flood into the sheet). Learned: an import's
news belongs in one place, and a story in time reads as yours in a way a flood set by set doesn't; an autoplay tour
that switches lenses for you teaches nothing. Dropped: the tour, radical's end card. Also fixed: the summary's worth
counted printings.

**Round 21: The wall inside the app.** How production's five tabs (Feed, Chase, Trade, Medal, Source) sit around the
wall. Safe: production's bottom tab bar, the wall as the Chase tab, Feed a list of listings. Bold: the bar as the
lens bar, every tab a lens flight on one wall. Radical: no tab bar; pinch the wall closed to a map of five live room
cards one level above it, spread or tap to go in. Kept: radical, with one home per job. The Trade room holds the
binder, the table and production's trade checker (You give / You get, conditions, cash, Fair / Close / Uneven); the
Medal room holds the trophy room (the door at the end of the wall is gone); the Source room holds where it looks,
its switches filtering the Feed. The wall keeps Have / Need / Chase (the Trade lens is gone) and the moments that
belong to a card. Ryan's line: the Chase lens and the Feed serve two purposes. The Chase lens is your want list,
each card with its best deal or what you'd pay; the Feed is every listing found, newest first, several per card,
with source, age, production's score and NEW since your last visit, and a listing opens the listing (the seller's
photo, title, price, seller, production's price proof and score), not your card. Room cards carry bold's count
lines; a sideways flick moves room to room; the rooms button carries the Feed's count; Feed and Source are real
lists. Learned: the map only earns its place if the wall stops carrying the other rooms; a listing and a card are
different things, and tapping one shouldn't open the other. Also fixed: Ryan's blank screen on an iPhone pinch.
Radical made a new full-screen picture per pinch (canvas memory climbing past 500 MB at dpr 3 over five rounds,
past Safari's cap); the harvest takes no per-pinch pictures, draws the moving room live, and holds 25 MB flat, with
a memory check in npm test. Not verified on an iPhone. Dropped: the tab bars, the deal banner (the Feed and the
badge carry the news), the cards flying from the wall into the Feed (a page above the canvas would hide them).

**Round 22: Polish.** No variants: four areas polished in parallel and merged, then a pass for text and noise, then
the critic's rough edges fixed. Trophies: "Medal" gone from everything a person reads, the room brought into the
app's own light and dark look (hairline panels, the plaque a flat gold plate heading its set's panel, medals on
threads in the set's colour; no wood), two columns when wide. Landscape everywhere: the trade binder opens as two
facing pages with rings down the spine and a page that folds over it under the thumb; a card sits beside its panel;
the map, Feed, listing, Trade room, table and sheets are laid out for a wide screen; rotating keeps your place.
Collection · Chase: Have and Need were one axis shown as two lenses, so Need became Show: Missing in one Filters sheet
(Show, Color by type or value, Group by set, price, rarity or type, the order inside a binder, Time) with a chip that
names and clears what's on; the Chase lens and the Feed gained sorts, the Feed condition filters. Card pictures:
real scans from the image hosts production uses wherever a card is big enough to see, lazy, decoded off the frame,
capped at 32 MB, with a redrawn face as the fallback (the sandbox blocks the hosts, so this is unverified on a
phone). Learned: four builders in parallel worktrees merge cleanly when each owns a lane, but their scaffolding
leaks (a committed node_modules link replaced the real folder on merge); a pass for noise needs the user's earlier
decisions in hand (it removed Remove set, which Ryan had asked to keep; restored). Open from the critic: whether
Show: Missing and the Chase lens both earn a place once everything missing is chased; greyed art in missing pockets;
the medal art is still the loudest thing on screen.

**Round 23: Bauhaus and Mondrian.** What the Wall looks like with Bauhaus and Piet Mondrian as its visual language.
Safe: the same app on a Bauhaus design system (primaries plus black on warm paper, Futura, square or circle, each
primary one meaning, the full art a poster: one disc on a flat field). Bold: heavy black rules as the structure, every
set a ruled rectangle whose header fills with colour as far as you've got, the cards in a thin-ruled grid, the map's
rectangles sized by what's in them, the trade binder's cover a small Mondrian. Radical: the app as one painting. The
map is a single Mondrian (each room one rectangle, full bleed, the rules shared), the rules carry into the rooms (the
wall's panels are fields whose gutters are rules, the trophy room's panels and the pages are cut by rules), everything
moves along straight lines (across, then down), trophies are Bauhaus primitives (the kind is the shape: square,
circle, triangle), the type is geometric, the chrome flat and square. Kept: radical, exactly as previewed (Ryan: "LOVE THE RADICAL. Harvest that"). A first harvest folded it into the
parts and fixed the critic's weak spots in its own terms (light rules in dark mode, a held pinch with no empty fields,
tier notches, an ink lens, neutral count fields, a condensed face for names), and added safe's poster full art and
bold's Mondrian binder cover. Ryan: "Not a fan of how it was integrated. I liked how radical looked exactly." So the
Wall is radical's own part (`95-de-stijl.js`) and stylesheet, pixel-identical to the preview on the wall, the map and
every room, light, dark and on its side. Then, at Ryan's ask ("Let's fix them all"), the critic's weak spots were
fixed in radical's own terms and nothing else: rules in dark mode are a warm light grey (black on charcoal hid the
painting); a held pinch to the map keeps the room whole while it narrows and brings the rest in cut along its column,
so no empty field shows; trophy tiers keep their colours and add one to four notches; nameplates fit their plinth
(smaller, then wider, then narrower); a name steps down a size before it's cut short. And trophies take their shape
from their role, not their chase ("too many squares"): a square is a signature trophy, a circle a milestone as the
chase fills, a triangle a goal inside it, so every shelf is a mix. Dropped: bold's set-title
progress fields (Ryan: "cool theory but distracting appearance"), and everything else from safe and bold. Also on this
branch: messages sit inside the top bar, in its field and rules, instead of a black banner over the wall (Ryan: "it's
always been in the way"); they let taps through to the bar and step aside, and follow the search when the bar changes
under them. The listing sheet's Open on eBay, TCGplayer, Reddit, Craigslist or Marketplace is a real link to a search
for the card (the listings are made up; the made-up shops say so). Learned: when Ryan loves a variant's look, the
harvest is the variant; "normalize" applies to how you move through it, not to how it looks. Not verified on an
iPhone: the tests run with a fallback sans, so Futura is unseen here. Before merging, an audit diffed every function
the painting redefines against what it replaces (nothing dropped) and walked every kept feature of rounds 1 to 23 at
both sizes, light, dark and reduced motion: one older bug fixed (a trade accepted off the table dropped a card you
already had instead of adding a copy, round 17's model), with a gesture check.

**Fix: a frame that throws never freezes the screen.** Ryan's recording: pinching out of the wall stopped half way to
the map, the Chase room blank, the rest of the painting in pieces. A frame clears its request before it draws, so one
that threw part way asked for no next frame, and a clip the throw left open kept anything else from drawing. Every
frame now runs guarded: one that throws resets the canvas and the next comes as usual, so the move lands; the first
error of a visit is named in the top bar, so a screenshot from the phone says what threw (the tests' browser couldn't
reproduce it). The named errors then led to the causes: Safari's "The provided value is non-finite" from a
gradient in a drawn card face, fed by a bad number. A pinch whose fingertips meet read a distance of 0 and the camera
divided by it (found by fuzzing gestures with a tracer on the camera); pinch distances now floor at 1px. And a late
frame drawn by the watchdog can be stamped after the next one, so the time step could go negative and each card's
emphasis grow instead of settle until it was NaN: the step is clamped at 0. Before every frame the guard puts right a
bad camera, scroll, layout, emphasis or move, names it in the top bar, and has kept pictures drawn again; a gradient
at a bad number is made at 0. Learned: a phone finds the numbers a test's tidy fingers never make, so every division
by a gesture needs a floor, and the screen should say what broke. The guard's own report then named the last one
("scroll"): after a pinch the finger still down rests, but moving it still ran the scroll code from a start it didn't
have, so the wall's scroll became NaN; a resting finger's moves now do nothing. Smoke checks: a fault mid-move, a bad
gradient, fingertips that meet, a finger left down after a pinch.

**Parity 1: the Feed's sorts and filters.** No variants (Ryan: "one at a time as lean as possible"). Production's
twelve sorts (best deals, newest, ending soonest, price both ways, biggest discount and savings, shops first, local and
trades first, seller feedback, free shipping, card name) and its Filters panel, as far as the listings here carry it:
source, format (auctions, Buy It Now, Best Offer), discount, how recently listed, max total price, free shipping,
favorite sellers, ending in 6 hours. A Filters button beside sort and condition opens them under the row and counts
what's on; Clear brings everything back; what they hide is counted like a source switched off.

**Parity 2: graded slabs.** No variants, one build. Production's graded copies, as far as one device carries them. On
the card up close, Add a graded copy opens a small form (PSA, BGS, CGC, SGC or TAG; only the grades that company gives;
an optional cert number). A slab counts as owning the card (marking it the way I have it does), is listed on the card
with Remove and a Verify link to the company's own lookup (PSA, CGC and TAG with the cert filled in; Beckett and SGC
open their lookup page), and Undo works through the message; removing the slab that made a card yours takes the card
out too. Kept in `wall-graded`, cleared by Reset like what you own. Its pocket in the binder wears a white tag in a
black rule ("PSA 10"), drawn in one pass over the binder once a pocket is 60px wide, and the list row says it too.
Under the price, what a PSA 10, PSA 9, BGS 9.5 and CGC 10 ask (made up, seeded by card id, from the raw market by
rarity and age), and for a raw card you own, Worth grading?: the 10 and the 9 after $30 to grade, against keeping it
raw, with a 10 never guaranteed. Every worth total counts a slab at its grade's ask. In the Feed, about one eBay copy
in seven is a slab (never a card's best listing, which is the raw deal on the wall), priced against its grade's ask;
the row, the list and the sheet say the grade, and the score and "under" compare against that ask. Filters gains Raw
or slab, Grading company and Grade at least; a slab passes Condition, its grade being its condition. Left out: the
per-set Grade you want, PSA's population and cert API, graded price history. The card's panel scrolls past half the
screen upright now that it can hold slabs. Smoke checks: a slab owns the card and badges its pocket, Remove and Undo,
the three filters narrow and clear, a slab passes Near Mint only.

**Parity 3: price history and collection value.** No variants, one build. Production's card chart and its Collection
value screen, with made-up history in place of its server's. Every card has a daily market price about a year back
and the lowest eBay ask that day, seeded by card id, worked out when asked for and cached, never stored: a drift for
the year (vintage holos climb), a new set starting high at release and settling, a few steps, day to day noise, and
the last day exactly today's market. A set out this year starts on its release. On the card up close, under the
price, one plain line ("Up 12% in 90 days", or "since it came out") and a small chart with 30 days, 90 days and 1 year:
a black rule for its baseline, the market in ink, the ask a thin red line, a day's price holding across and then
stepping up or down, today a small square. A card with a slab adds Raw or its grade ("PSA 9"): the grade's ask (scaled
from what it asks today, moving a little more than raw) is drawn on its own, since on one scale it flattened the raw
card's line. In Trophies, a field under the title, Collection at market, gives the worth and its 90 days and opens
Collection value (the listing sheet's frame): the worth now (exactly the total everywhere else, slabs at their
grade's ask), 30 days, 90 days or All with the change in money and percent, how much of that came from cards you
added, the line, one sentence saying earlier days are estimated (each card at that day's price from the day you got
it), what you paid on Got it against what those cards are worth now with the latest eight, and the six sets worth
the most with a bar each in the set's primary. The list reads the sheet's numbers as text, with a button to open it,
and every card row ends with its 90 day trend. Left out: production's server-side history (one record a day, 400
days), real TCGplayer prices and eBay asks, and value by chase (here by set). Smoke checks: a card's chart draws
with finite points and ends at its market, its ranges switch, Collection at market opens the sheet from Trophies,
its now is the worth total, and its ranges change the change line.

**Parity 4: favorites and priority.** No variants, one build. Production's two stars, lean. Favorites: up to five
cards you own, your showcase. On the card up close, a card you own has ☆ Favorite under its price; on, it's ★ in a
yellow field. They come first in Show mode of the trade binder, the Wall's in-person version of production's public
trade page: a page of their own before the trade pages, titled Favorites and "Not for trade", the cards as large as
the page lets them be (two across upright, three across on a spread), no price, and a tap on one picks nothing. A card
you take out drops off (left out when read, so Undo brings it back); a sixth takes the oldest one's place, and the
message names it with Undo. Priority: ☆ Priority on a chased card up close, and a ★ on every Feed row. A priority card
leads its panel in the Chase lens, and its panel leads the lens; the lifted tile wears a black star on a yellow field in
its corner (two rects and one glyph through `font()`); its listings score +4 ("Priority card", production's boost);
Filters gains My priority; the list view marks it. Kept in `wall-favs` and `wall-priority`, cleared by Reset. Left out:
production's favorites picker (with its up and down arrows), priority's effect on scan rotation (no scans here), and a
Show mode reached with favorites but no spares (the binder still opens only with a spare). Smoke checks: a favorite
is first in Show mode, a sixth replaces the oldest and Undo puts it back, priority boosts a listing's score and leads
the Chase lens, My priority narrows the Feed, Reset clears both.

**Parity 5: add a shop.** No variants, one build. Production's "add any Shopify card shop by its website" and its
store watcher's first-look rule, in Source. Under Card shops, Add a shop takes a website or a bare domain
("pokecorner.com", "https://www.PokeCorner.com/collections/singles"), keeps only the domain (https://pokecorner.com)
and names the shop from it (Pokecorner; card-cove.shop is Card Cove); anything else is refused under the field in plain
words ("That doesn't look like a website"), and so is a shop you already have. It becomes a source in Card shops after
the made-up two, with a switch like theirs, its website as a real link, and Remove with Undo. What it has in stock is
made up, seeded by its domain and the card: about one card you chase in eleven, at 80 to 97% of market and never under
the card's best listing, so about what Northside gives. Its listings flow into the Feed like the other shops' (the
switch, the counts, Shops in the Source filter, the map's Shops chip). The first look just records what's there and
new items show from the next look (production's rule), so its listings are dated from when you added it and are never
NEW; the page says so on its row and when you add it. Open on the listing's sheet opens the shop's own search for the
card (https://domain/search?q=name, Shopify's path); the made-up two still open nothing. Kept in `wall-shops`, cleared
by Reset. "/" no longer jumps to search while you type in a field (a website has slashes). Left out: the real check
(Shopify's products.json, the homepage fallback for shops that aren't on Shopify) and whether it worked, restocks and
price drops after the first look, the Chico shops' hours, and adding or removing shops from the list view (it keeps
their switches). Smoke checks: a bare domain adds a source with listings in the Feed (none NEW) whose sheet opens its
search, bad input is refused, the switch hides its listings, Remove and Undo, Reset clears it.

**Parity 6: completion ceremony.** No variants, one build. Production's full-screen finish ("the cards flip in, the
medal appears, and you can share the image", with confetti), lean and in the painting's language. Finishing a whole set
or chase by hand (the moment that mints its trophy) plays it before the trophy flow: the set's cards travel across
their rows into a ruled grid, rows from alternate sides, the farthest card first (at most 30, whole rows; the rest fill
row by row, drawn in from the left, so a big set is as quick as a small one), the pockets past the last card one red
field; the plate drops straight down into place under it (a yellow field in a black rule, the Binder Complete trophy on
its white square, the name beside it); the title and the counts come in across ("Fossil complete.", "62 of 62 ·
October 8, 2026", what it's worth); squares and short rules in red, yellow, blue and black fall straight down (36,
seeded by the trophy, nothing turns or bounces). About 4 s, then the final frame holds. Share and Done come up as the
plate lands. Share hands the phone's share sheet a PNG of the final frame (the grid, the plate, the title; 1170 wide),
made as the moment lands so the sheet opens inside the tap, or saves it where there's no share sheet; Done, a tap
anywhere else or Escape ends it, and the trophy flow carries on exactly as before: the mint and the shelf, the medal
mint or card, and the message with its Undo (held while the ceremony was up, said when it ends). Reduced motion: the
final frame, still. On its side the grid takes the left and the plate, the words and the buttons the right. It plays
once per finish, as production's does (a trophy is kept there, so the ceremony never repeats): Undo and the same card
again finish it with no second ceremony; a set finished quietly (an import, a trade) or before this existed is counted
as celebrated (localStorage wall-ceremony, cleared by Reset). Drawn on its own canvas over everything, from one copy
of the final frame lettered once when it opens, so a moving frame only copies rectangles and fills a few dozen squares;
both canvases are let go when it closes. Left out: production's card pictures flipping in (the grid is the cards'
colours, as the wall draws them far out; a picture would also taint the share image), the vibration pattern beyond
what Android allows, and a ceremony for the Dex's or a medal's own milestones. Smoke checks: finishing the smallest set
plays it with the message and the medal held, it lands and stops, Share gives a PNG, Done lets the flow carry on, Undo
and the card again don't replay it, and the reduced-motion still; perf: the ceremony with every card on the wall
(1,327 pockets) under 34 ms with no canvas made while it moves.

## Open questions (next rounds)

- Production parity (audit, round 23). What production has that the Wall doesn't yet, beyond what's out of scope for
  an on-device prototype (accounts, sync, real push, PSA lookups): the Feed's language, version, lots and too-cheap
  filters (the made-up listings don't carry them yet), a real check of an added shop and its restocks and price drops
  (parity 5 made its stock up), "Fill your Dex" in the Feed (Ryan: skip), grade wants (the per-set Grade you want) and
  PSA's population and cert checks (graded slabs landed in parity 2), real price history kept day by day (parity 3 made
  it up), value by chase, savings stats from "I bought it", the favorites picker and priority's scan rotation
  (favorites and priority landed in parity 4), print placeholders and card reports. The completion ceremony landed in
  parity 6. Replaced, not lost: the collection grid (the wall, search, Filters, the list view), the card sheet (the
  card up close), the public trade page (Show mode and Someone new, in person). Online trading stays pinned (round 18).

- A deal arriving off screen: one tap from the line to the offers, and whether the arrival should nudge the wall.
- Painting past the screen's edge: should a sweep scroll the binder as it goes?
- At the show: does the Wants lens alone carry a vendor table, or does the verdict (NEED IT, pay up to) earn a place when a card is looked up?
- Trading: a real other side (the twelve-second reply is a stand-in), more than one card per counter, and whether a done trade should fall off the chip after a day. Online trading is pinned on backend work (round 18).
- Spares: Show mode's Someone new gives cards away with nothing back; a stranger at a show might want to offer a card, which needs their side of the table without an account.
- The import: a real import without acquisition dates loses the story (round 20); and the Complete Dex can't be chosen on the import path, only in Choose your sets.
- A chase's twins: should a custom panel's cards also lead in the Chase lens, or only their set's copy? And should a chase hide from the wall once it's complete?
- Trophies: the worth line is a made-up year; real data would start at the finish date ("Up $27 since you finished"). Medals: whether Undo after a mint should take a medal back (production keeps it), whether the completion ceremony (parity 6) should show the cards' own pictures (production flips them in; here the grid is their colours, and a picture would taint the share image), and the server-side luck roll when the two merge. Sharing a trophy (safe's picture card), and whether a sub-chase of a finished set should fold into the set's plaque. The room hides the lenses; Value could recolour the engravings.
- Bringing the wall into the real app: the rooms map is the navigation model (round 21); production's tabs sit at the top, and a merge would put the map where they are.
- The painting (round 23): gold still marks a chased card while red is the Chase room; the yellow active lens shares yellow with earned; the count fields take the set's nearest primary; card scans come in full colour inside the painting; some motion outside the map still arcs (the trade table's lifts, the reply flights). The binder held mid-turn upright with pictures runs close to the 34 ms budget on the test machine (it did before round 23 too).
