---
description: Run one design round of the Wall: three variants in parallel, a critique, then hand to Ryan
argument-hint: <the question this round answers>
---

Run a design round for this question: $ARGUMENTS

1. Read `EXPERIMENTS.md` and `CLAUDE.md`. Check the log so the round doesn't repeat something already tried.
2. Propose three concepts that answer the question, each in three sentences, with a short kebab-case folder name:
   - **safe:** the best version of a familiar pattern
   - **bold:** a familiar pattern with one genuinely new idea in it
   - **radical:** something we haven't tried, that could be a step change if it lands
   Show them to Ryan and wait for a go-ahead or edits before building, unless he said to just go.
3. Spawn three `variant-builder` sub-agents in parallel, one per concept, each with the question, its concept, and its
   folder name (prefix the folder with the round number, e.g. `r7-safe-deals-tab`).
4. When they're done, run `npm run build:all`, then spawn a `ux-critic` sub-agent on the three variants.
5. Commit the variants and open a pull request titled "Round N: <question>". Netlify builds a deploy preview for it:
   its index page links every variant, so Ryan can try the whole round on his phone from one link.
6. Report to Ryan, short: each variant's one-line concept, what to try first, its best moment per the critic, the
   critic's ranking, and the pull request (the preview link appears on it once Netlify finishes). On a computer he can
   also run `npm run dev -- --variant <name>`.
7. Stop. Don't merge anything until Ryan picks; that's `/harvest`.
