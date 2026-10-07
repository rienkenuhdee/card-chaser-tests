# The Wall

An experimental collection UI for [Card Chaser](https://cardchaser.app). Instead of tabs and screens, your whole
collection is one surface with three composed levels, and the interface moves the camera between them:

- **Mosaic.** Every set is a panel, packed with its cards as small colored tiles. The panels tile the screen and
  scroll when there are many.
- **Set.** Tap or spread on a panel: its tiles fly out and grow into that set's binder, framed to the screen width.
  Scroll down it; flick sideways for the next set; pinch out or tap back to close it.
- **Card.** Tap a card to bring it up close. Flick it to move along the set. Press and hold any card to mark it.

Two lenses, Collection and Chase, recolor whatever you're looking at. Filters (by the search) show all, only what's
missing or only what you have, color by type or value, group the same cards by set, price (size follows worth),
rarity or type, order each binder by number, price, name or rarity, and play Time.

The cards are real (1,327 cards from 10 sets). Who owns what, prices, deals and acquisition dates are made up.

## From a phone

1. Make a new, empty GitHub repo (tick "Add a README" so it has a main branch) and upload `the-wall.zip` to it.
2. In the Claude app, open **Code**, pick the repo, and send:
   *Unpack the-wall.zip into the repo root, delete the zip, check `node scripts/build.mjs --all` works, and push to main.*
3. On Netlify, add a new site from the repo. `netlify.toml` already has the settings.
4. Start a new Code session on the repo and run `/round <question>`. Each round opens a pull request; its Netlify
   deploy preview links every variant, so you try the round on your phone and reply with what to keep.

## Run it

```bash
npm install          # puppeteer, for the tests only
npm run dev          # http://localhost:5173, rebuilds and reloads on save; open the printed address on your phone
npm test             # gesture contract, every layout/lens/theme, frame budget
npm run build        # dist/wall.html: one self-contained file you can publish or send
```

Everything is plain JavaScript with no build dependencies. `dist/wall.html` works offline except for the Archivo font.

## How it's built

`src/parts/*.js` are script fragments joined in filename order inside one function scope (see `scripts/build.mjs`).
They share state without imports, which keeps experiments fast and the output a single file.

| Part | What it owns |
| --- | --- |
| 00-data | The 1,327 real cards |
| 10-model | Card records, made-up ownership, prices, deals, acquisition dates |
| 20-arrange | Groups: by set, by Pokémon, by value |
| 30-layout | The mosaic (ordered strip treemap) and each group's binder; the camera |
| 40-render | Drawing: tiles, card faces, empty pockets, panels, headers, transitions, the frame loop |
| 41-art | Card pictures: the real scans where a card is close enough to see, lazy, cached under a cap, the drawn face as fallback |
| 50-navigation | Opening and closing groups, sliding between sets |
| 51-gestures | Touch and mouse input, pinch scrubbing and snapping, scrolling, taps |
| 52-focus | The card close-up and marking |
| 60-63 | Lenses, search, Time, keyboard |
| 70-chrome | Toast, about, rearrange menu, the list view |
| 99-start | Startup |

## Experiments

This project exists to run design rounds: try something radical, keep what's great, then reshape it toward patterns
people already know. See `EXPERIMENTS.md` for the log and principles, and `CLAUDE.md` for how rounds run in Claude Code
(`/round <question>` builds three variants in parallel with sub-agents; `/harvest <variant>` folds the winners in).
