# The Wall: working notes for Claude Code

This is an experiment harness for Card Chaser's collection UI. Read `EXPERIMENTS.md` first: the principles there are
what a round is judged against.

## Architecture in one paragraph

`src/parts/*.js` are script fragments concatenated in filename order inside one function scope by
`scripts/build.mjs`. They share variables directly (`state`, `cam`, `view`, `groups`, `mScroll`, ...). Function
declarations are hoisted, so a later part can redefine a function and that definition wins everywhere. `src/index.html`
holds the markup with `/* STYLES */` and `/* SCRIPT */` markers; `src/styles.css` is the stylesheet. Output is one
self-contained HTML file in `dist/`.

## Variants

A variant is a folder in `variants/<name>/` that's applied on top of `src/` at build time:

- `NN-name.js`: same name as a part replaces it; a new name adds a part at that position
- `remove.txt`: part filenames to drop (anything that calls into a removed part must be replaced too)
- `styles.css`: appended after the base styles
- `index.html`: replaces the base markup (keep both markers and every element id the parts use)
- `NOTES.md`: required (see `variants/_template/NOTES.md`)

Prefer the smallest change that expresses the idea: redefine one function in an added part before replacing a whole
part. Never edit `src/` from a variant task.

## Rules

- Run `npm test -- --variant <name>` before calling a variant done. The gesture contract must pass unless the variant
  deliberately changes navigation, and then `NOTES.md` says which checks change and why.
- Keep the held-pinch frame under budget (`npm run test:perf`). What's expensive here, learned the hard way: setting
  `ctx.font` (use `font()`, which caches), measuring text (use `fitText()`, which caches), creating gradients per tile
  on the far-out levels, and foil while anything moves.
- Fingers come from Touch Events, not pointer events (pointer events left ghost fingers on iOS). Mouse uses pointer
  events. Don't reintroduce a pointer map for touch.
- Copy is plain and short, sentence case, no jargon. Prices use `money()` or `short()`.
- Respect `prefers-reduced-motion` (`reduced`), dark mode (CSS variables, read into `theme`), and the list view.
- Made-up data stays deterministic (seeded by card id) so variants are comparable.

## Running a round

`/round <question>` (see `.claude/commands/round.md`): propose three concepts (safe, bold, radical), spawn three
`variant-builder` sub-agents in parallel (one concept each), then a `ux-critic` pass, then report to Ryan with phone
links and stop. He tries them and picks moments to keep.

`/harvest <variant> [notes]` (see `.claude/commands/harvest.md`): fold the chosen moments into `src/`, normalize them
toward familiar patterns, run the full suite, log the round in `EXPERIMENTS.md`, and archive the variants.

## Where this runs

Ryan usually works from his phone, through the Code tab in the Claude app: a cloud session on this GitHub repo. So:

- He can't open a localhost dev server. Rounds are tried through Netlify deploy previews: every pull request gets one,
  and its index page (`scripts/index-page.mjs`) links the base wall and every variant.
- Work on a branch and open a pull request; don't push straight to main.
- `npm test` needs a browser download (puppeteer). If the session's network blocks it, say so plainly, run what can
  run (`node scripts/build.mjs --all` still checks every variant builds), and don't report tests as passing.

## Publishing

`npm run build` writes `dist/wall.html`. It can be published as a claude.ai artifact or hosted anywhere as one file.
