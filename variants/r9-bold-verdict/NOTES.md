# r9-bold-verdict

**Round:** 9. The show floor: one-handed, glanceable, built around your wants (Sacramento, Nov 20 to 22).
**Concept:** A "Show" pill in the top strip switches on floor mode: the search steps aside for a thumb-reach keypad
along the bottom (set code chips with your want count per set, big digits) and you type what's printed on the card in
your other hand. The moment the entry resolves to one card the wall flies to it (open the set, focus the card) and a
verdict fills the top half of the screen in type readable from a metre away: NEED IT in green with "Pay up to $X" (the
price you decided on at home) for a want, NEED IT in ink with "Market $X" if it's merely unowned, HAVE IT in grey
("Spare? Trade it") if you own it. "Got it" at the thumb marks it owned, with Undo on the toast; "Next card" clears.

## What changed
- Added `75-floor.js` (one part, nothing replaced or removed) and `styles.css`. Markup is injected from the part, so
  `index.html` is untouched.
- Wants (the round's shared rule): `c.want0 = h32(c.id + "w") < 0.1`, overridden by `wall-wants` in localStorage
  (`{id: true|false}`); `isWant(c)` is false once owned; `payUpTo(c) = round(price * 0.85)`. Redefined `setOwned`
  (a copy): marking a want owned writes `wants[id] = false` (dropped from the list); taking it out again, including
  Undo, puts it back. Redefined `fillPanel` (a copy) to add the **Want it** toggle next to "I have it" (three buttons
  across when the card isn't owned; "Wanted ✓" in gold when on) and a line "On your list for Sacramento, Nov 20 to 22.
  Pay up to $X." Redefined `drawList` so the list says "Want it, pay up to $X", and `emptyPocket` (a copy) so a wanted
  pocket wears a gold hairline and "★ Want" at close range (nothing changes on the far-out levels).
- Floor mode (`body.floor`, `floorOn`): the Show pill (`#show`, after the search box; pressed look while on) and a
  `#floor` block: `.fl-top` (entry display while typing: code chip, number, caret, a one-line hint; the verdict once a
  card lands), `.fl-pad` (two rows of set code chips with want counts, 3×4 keys: digits, delete, Go), `.fl-acts`
  ("Got it" 68 px, "Next card"). While typing the top area is a 112 px bar and the keypad is up; on a verdict the top
  grows to the top half, the keypad slides down and the two buttons slide up. The lens bar, Time bar, markbar, caption,
  search box and card panel are hidden in the mode; the strip shows "Sacramento, Nov 20 to 22" in their place.
- Entry: a chip picks the set (and opens its binder behind the keypad, in the By set layout, so you see what you're
  hunting there); swiping to another set moves the chip with you (`setChrome` copy). Digits build the number. An entry
  that can only be one card lands at once; one that could still grow (12 in a set with 120s) lands after 650 ms or on
  Go; a number the set doesn't have shakes with "No EVS 238"; digits with no set picked shake with "Pick a set code
  first". A hardware keyboard works (digits, Backspace, Enter, letters for a code, Escape leaves).
- Landing: `showVerdict(c)` then `flyToCard(c)`: in the same set it's `focus(c)`; otherwise the search's own path
  (`enterGroup(g, { then: () => focus(c) })`). Redefined `focus` (a copy): in floor mode the card is framed between the
  banner and the buttons, and any card brought up close (tap, flick along the set) gets its verdict too. Redefined
  `clampCam` (a copy) to skip the binder-edge clamp only while floor mode has a card up close, so first-row and
  first-column cards still sit in the gap rather than under the banner.
- Got it: `setOwned(c, true, { undo })`, so the usual ripple, the set-complete burst and the toast with Undo all
  happen; the verdict re-renders as HAVE IT / "Yours now" and the big button becomes "Next card". Toasts sit above the
  buttons (or above the keypad while typing).
- Redefined `setListMode` (a copy) to leave floor mode first; the Show pill is hidden in the list. Redefined
  `updateCount` (a copy) for a one-word placeholder on narrow screens, and the count inside the search box steps out
  in set view under 460 px (Back does the same thing there), because the strip now holds Back, Mark, search, Show, About.
- Verdict colours come from CSS variables with a dark set: green #0B8A55 / white in light (4.7:1), #3BD597 / near-black
  in dark; ink on bg for the plain NEED IT; grey #5B6270 / white for HAVE IT. Solid fills, no glass, for a bright hall.
  Reduced motion: no height or slide transitions, no shake, no caret blink; the flights are the base's (instant).

## Try this first on the phone
1. Tap **Show** (top right). Tap **EVS**, then **9, 2**: Evolving Skies opens behind the keypad, the wall flies to
   Lycanroc VMAX and the screen says NEED IT, Pay up to $5.27 (hold the phone at arm's length). Tap **Got it**, watch it
   turn HAVE IT, then **Next card** and type **2, 3, 8** for the shake. Then tap any card in the binder: its verdict
   comes up too. Tap Show again to leave: the card panel comes back with the new **Want it** toggle.

## Gesture contract
All checks pass (dpr 1 and 2). Floor mode is a mode: nothing in the gesture layer changes, and outside it the only
difference is the Want it toggle on the panel and the Show pill in the strip.

## Frame budget
`npm run test:perf -- --variant r9-bold-verdict`: mosaic 16.7 ms, held pinch 18 to 21 ms across three runs (budget
34 ms). The verdict is
DOM; the only drawing change is a gold outline and star on wanted pockets at close range (w ≥ 44), so nothing is added
to the far-out levels.

## Unsure about
- The 650 ms pause before a number that could still grow lands (EVS 92 lands at once; EVS 12 waits a beat in case
  you're typing 120). Is the pause right, or should every entry wait for Go?
- Set code chips are two wrapped rows rather than a scroll strip, so all ten are visible without a swipe. With thirty
  sets they'd want a scroll row, or the chips ordered by what's on your list.
- In the By Pokémon and By value layouts the chips still work (the card is found by code and number, and the wall flies
  to wherever it lives), but tapping a chip alone doesn't open anything, since there's no set to open.
- "Spare? Trade it" on HAVE IT is a nod to the trading round; it may read as an instruction when you've just bought
  a card (after Got it it says "Yours now" instead).
- A tap on the binder behind the keypad still opens cards and gives verdicts, which doubles as a second input path.
  Is that welcome, or does the keypad want to be the only way in while it's up?
