# r21-safe-tab-bar

**Round:** 21. The wall inside the app: how do production's five tabs (Feed, Chase, Trade, Medal, Source) sit around the wall?
**Concept:** Production's tab bar along the bottom, in its words and four colours, with the wall as the Chase tab. Have, Need and Chase become a segmented control at the top of the Chase tab. Trade becomes its own tab (the binder's cover, the traders, your spares, the table). Medal is the trophy room. Feed and Source are plain scrolling pages.

## What changed
- `index.html`: the search strip and the lens segment share one header (`.hdr`). The lens loses its Trade button. Three pages (`#pg-feed`, `#pg-source`, `#pg-medal` for an empty room) and the `#tabbar` nav are new. The Trade tab button carries `data-lens="trade"`, so anything that clicks the Trade lens by `data-lens` still gets there. The about text and the list's "at the top" line are updated to match.
- `29-tabs-state.js` (added): tab state, read early. Each tab keeps its lens, level, camera and scroll; the pages keep their scrollTop; the tab you were on is restored on reload.
- `30-layout.js` (replaced, one line changed): `topPad` is 116 in the Chase tab, because the segment sits under the strip, and 70 everywhere else, including the room and the binder. `topPad` is a `const` arrow, so it can't be redefined from a later part. That's why the part is copied. The diff against `src` is that one line plus its comment.
- `96-tabs.js` (added): `setTab`, `leaveTab`, `enterTab`, `tabTop` (tapping the current tab goes back to its top), the Feed (`feedItems`, `srcOf`, `renderFeed`, `feedToCard`) and Source (`renderSource`, a switch per source that takes its listings out of the feed). Redefined:
  - `setLens`: Trade goes to the Trade tab.
  - `setChrome`: no Back at a tab's root.
  - `closeRoom`/`endRoom`: the Medal tab's room doesn't close.
  - `pinchMove`: a pinch in the Medal tab's room stays put.
  - `showArrival`/`syncBadge`/`glowChase`: a deal's line races to the Feed tab and its count sits there.
  - `fillPanel`/`offersFor`: the card names the source of its deal.
  - `drawList`: the list view per tab. In the Medal tab it lists the trophies.
  - `welcomeSync`/`finishWelcome`: their copy now puts the lens at the top.
  - `arToRoom`: the import summary's trophy row opens the Medal tab.
  - `placeInk`.
- `99-tabs.js` (added): starts on the tab you left.
- `styles.css`: the header and segment, the tab bar (each tab's colour along its top edge, faint until selected, so the bar's edge reads as production's four-colour stripe), the pages, feed rows and switches. The tab bar slides away under a card, Mark, the table and the binder. It fades in place under the welcome and the import's sheets, the way the lens bar did.

**Why the lens moved to the top:** the bottom now belongs to the tab bar, and to the bars that take its place (the card, Mark, the table, the binder). A second bar stacked on the tab bar would crowd the thumb zone and read as two levels of tabs. A segmented control under the header is the familiar way to show "the same content, filtered", and it stays wherever the wall's header does: in a set, under a card, in Mark. So the wall's top never jumps. It folds away only in the room and the binder, which have their own titles. Trade left the segment because in production it's an activity with its own tab, and two Trade controls would be one too many.

## Try this first on the phone
1. On an imported wall, open a set in Chase, tap Feed, then tap a listing. It flies you back to Chase with that card up close. Then tap Chase again: the set closes. Tap it once more to scroll the wall to the top.
2. Wait on the wall for a deal to arrive. The tile flashes and a line races to the Feed tab, which counts it. Open Feed: the listing sits at the top with NEW.

## Gesture contract
All checks pass. The gesture contract still clicks `[data-lens="trade"]`, which now hits the Trade tab button. That opens the Trade tab with the cover at its top, so the trade binder checks run unchanged. Smoke passes as well. On its fresh, welcome-up wall, the Have, Need and Chase clicks hit the top segment. The Trade click falls on the faded tab bar and does nothing. The base behaves the same way under its welcome sheet.

## Frame budget
`npm test -- --variant r21-safe-tab-bar`: mosaic 16.7 ms per frame, held pinch 20.0 ms. The first run gave 17.8 ms. The budget is 34 ms.

## Unsure about
- The Medal tab and the door at the end of the wall open the same trophy room. From the door it has Back; in the tab it's the root. Two ways in may be one too many. The door could go now that the tab exists.
- Production puts its tabs at the top with a count under each ("3 new", "120 to go"). This build uses a bottom bar with icons and a badge on Feed only. Should Chase and Medal carry counts too?
- Source is mostly static. Its switches really do filter the Feed, but local shops and alerts are words only.
- The segment costs the wall 46 px at the top of the Chase tab.
- Medal and Trade search the wall: typing in the Medal tab jumps to Chase.
