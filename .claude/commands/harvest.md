---
description: Fold the chosen moments from a round's variants into the Wall
argument-hint: <variant names> [what Ryan wants kept]
---

Harvest from: $ARGUMENTS

1. Read each named variant's `NOTES.md` and code, and what Ryan said he wants kept. Ask if it's ambiguous which
   moments he meant.
2. Bring those moments into `src/`, reshaped toward familiar patterns (EXPERIMENTS.md, "Normalize"). Keep the feel;
   drop anything a first-time user would have to learn.
3. Run `npm test`. Everything passes, including the frame budget. Add a gesture check if the harvest adds a gesture.
4. Add the round to the log in `EXPERIMENTS.md`: what was tried, what was kept, what was learned. Update the
   principles if one changed. Update the open questions.
5. Move the round's variants to `variants/_archive/` (the build skips folders starting with `_`).
6. Commit to the round's branch (or a new one) and open or update the pull request, so the deploy preview shows the
   harvested wall. Tell Ryan what changed in a few lines. He merges it when he's happy; the main site updates.
