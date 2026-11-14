# Card Chaser videos

Films the real app at cardchaser.app on a phone-sized screen, signed in to the demo account, and cuts vertical
videos from it. It only makes files; it posts nothing anywhere.

| Command | Makes |
| --- | --- |
| `npm run record:walkthrough` | `out/walkthrough.mp4`, about 27 s: the Wall, the 30th Celebration, making a set, the Pikachu set, a deal in Find |
| `npm run record:short` | `out/daily-short.mp4`, 12 to 15 s, on today's set from `sets.json`, and `out/caption.txt` (a post caption and 3 hashtags) |

Each is 1080x1920, H.264, 30 fps, no audio, under 10 MB, with one caption per scene and a 2-second end card.

## Setup

Node 20 or newer, and ffmpeg.

```bash
cd videos
```

```bash
npm install
```

```bash
npx playwright install --with-deps chromium
```

On a Mac, `brew install ffmpeg`; on Ubuntu, `sudo apt-get install ffmpeg fonts-dejavu-core`. The captions use DejaVu
Sans Bold; set `VIDEO_FONT` to any other `.ttf` to change it.

Then, with the demo account's sign-in in the environment (never typed into a file):

```bash
DEMO_EMAIL=... DEMO_PASSWORD=... npm run record:short
```

`npm run record:short -- --set Eevee` films a given set instead of today's. `--keep` leaves the frames and a
`timeline.json` (every clip and its length) in `out/work/`.

## The secrets (for the GitHub Action)

In this repo on GitHub: Settings, Secrets and variables, Actions, New repository secret. Add two:

- `DEMO_EMAIL`: the demo account's email
- `DEMO_PASSWORD`: its password

The workflow `.github/workflows/videos.yml` runs the short every day at 8:00 AM Pacific. To run either video by hand:
Actions, Videos, Run workflow, pick `short` or `walkthrough` (and a set, if you like). The MP4 and `caption.txt` are
on the run's page under Artifacts for 30 days. A failed run uploads a screenshot of where it stopped instead.

## Adding a set to sets.json

The set has to exist on the demo account first: in the app, signed in as the demo account, + then Add a set, Make your
own set, pick the Pokémon, and Put it on the wall. Then add a line to `sets.json`:

```json
{ "name": "Lugia", "dex": 249 }
```

- `name` is the Pokémon's name as the app writes it. The recorder finds the set on the wall by its title, "Every Lugia"
  or "Lugia". If you renamed the set, add `"panel"`, a pattern for its title: `{ "name": "Lugia", "dex": 249, "panel": "^Lugia, every card$" }`.
- `dex` is its National Dex number (only the rehearsal below uses it).
- The short picks a set by the day of the year, so a new set joins the rotation the next day. Captions say
  "Every Lugia card, on one wall".

The short needs at least one card in the set that the demo account is missing and that has an offer in Find. If there's
none that day, the run fails rather than film a set with nothing to show.

## How it works

- **Sign-in** goes through the API (`POST /api/auth/login`); the session token is put in the page's storage before the
  app loads, so the email is never typed or shown. Nothing prints the email, the password or the token.
- **Never film loading.** Every scene waits until its screen is finished: no requests in flight, fonts and pictures
  in, the screen unchanged for a second, and any "show all / load the rest" control tapped first. The log has a
  timestamped "loaded and settled" line for each. Only the time after that is kept: a tap that starts a load ends a
  clip, and the next clip starts on the finished screen.
- **Finding things on the Wall.** The Wall is one canvas. A small read-only probe (`lib/probe.js`) records where the
  app draws each piece of text, so the recorder finds "30th Celebration", a set's head and a card's price by their
  words. Everything else uses the app's own element ids (`#add`, `#cs-own`, `#cs-q`, `#cs-save`, `#p-buy`, `#fa`...).
- **The missing card with an offer** is chosen before the clip: the set's own Filters set to Missing, by Price (they
  last only while it's open and are never saved), then the likeliest cards (prices that match Find's deals) are opened
  until one says "View offers in Find · N".
- **Taps** are real touch events with a fading circle drawn at each one (`lib/ripple.js`), and a 400 to 700 ms pause.
- **Filming** is the browser's own screencast at 3x (1170x2532 frames), so the 1080x1920 video is downscaled, not
  blown up. Playwright's `recordVideo` films at the page's 1x size (390x844), which would have been scaled up about
  2x and looked soft, so it isn't used.
- **Layout.** The phone's screen sits under a dark caption band at the top, so the captions never cover the app.
- **Read-only.** The recorder refuses any change the app tries to save to the demo account other than its own
  automatic bookkeeping (the day's value, set-open counts), and fails the run if one is tried. "Put it on the wall" is
  shown but never tapped.

## It fails loudly

Any of these stops the run with a screenshot in `out/failure-*.png` and no video written:

- a selector or a set isn't there, or a screen is still loading or moving after its time limit
- the demo account's email shows anywhere on screen (no screenshot is saved for this one)
- the rooms map (the home screen, whose Trade tile shows other collectors) or the Trade room shows during a scene
- the app tries to save a change to the account
- the finished file isn't 1080x1920, 30 fps, H.264, silent, under 10 MB and the right length

## Rehearsal (no production, no sign-in)

`--rehearse` serves a local checkout of the app repo (`Card-Chaser`) inside the browser at cardchaser.app: its own
live build and its own server code on an in-memory store, with the app's made-up test account, the `sets.json` sets
added and a few made-up deals. It's for trying changes to the recorder without touching production.

```bash
cd ../../Card-Chaser && npm install && npm run catalog
```

```bash
cd videos && node record.mjs walkthrough --rehearse=/path/to/Card-Chaser
```

Card pictures are blank stand-ins there, so the look isn't the real one.
