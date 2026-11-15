# Card Chaser videos

Films the real app at cardchaser.app on a phone-sized screen, signed in to the demo account, and cuts vertical
videos from it. It only makes files; it posts nothing anywhere.

| Command | Makes |
| --- | --- |
| `npm run record:walkthrough` | `out/walkthrough.mp4`, about 27 s: the Wall, the 30th Celebration, making a set, the Pikachu set, a deal in Find |
| `npm run record:short` | `out/daily-short.mp4`, 12 to 15 s, on today's set from `sets.json` with today's joke from `jokes.json`, and `out/caption.txt` (a post caption and 3 hashtags) |

Both are cut meme-style: a hook on black ("POV: you said “just one more pack” 47 times"), collector jokes for captions
("Nobody: / Me: a set of EVERY Pikachu"), reaction stickers with the app's own numbers ("237 cards and counting",
"91 MISSING", a punch-in on the dearest card with "$900?!"), and the deal as the payoff: "wait for it…", a shake,
confetti in the brand's squares, the stamp ("SAVE $234 / 26% under market") and the punchline ("sniped."). They're
silent: add a sound when you post.

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

On a Mac, `brew install ffmpeg`; on Ubuntu, `sudo apt-get install ffmpeg fonts-dejavu-core`. The captions and end card
use Archivo, fetched from cardchaser.app (a bold system sans if it can't be).

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

## The daily jokes (jokes.json)

One joke a day, picked by the day of the year (stepping differently from the sets, so the pairs change).
`npm run record:short -- --joke 3` uses a given one (counting from 0). Each joke has four lines; `{name}` becomes the
day's Pokémon:

```json
{ "hook": "POV: you said “just one more {name}” 47 times", "set": "every {name} card. one wall.", "wait": "and the one you're missing…", "punch": "sniped." }
```

- `hook`: the opener, on black, before any app (keep it to one line of about 50 characters)
- `set`: the caption while the set flies open and glides by
- `wait`: the caption while the missing card flies up and Find opens
- `punch`: the caption from the moment the deal lands

Keep them short, original and kind (no other people's memes, pictures or brands). Add as many as you like.

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
- **Taps** are real touch events with a mark drawn at each one (a brand-yellow dot inside a black ring that opens
  out, `lib/ripple.js`; scrolls get none), and a 400 to 700 ms pause.
- **Smooth motion.** Every scroll is one stroke (a quick rise to speed, a long slowing; the finger is moving within
  90 ms so the Wall never reads it as a long press, which would pick a set up and reorder the demo account's wall),
  filmed at half speed and played at 2x: the capture then has a fresh frame for every frame of the video, so nothing
  judders. Each clip is laid out at exactly 30 frames a second before ffmpeg sees it (handing it the captured frames
  with their own timings made it read them as 25 fps and repeat every sixth frame). Taps, the app's own flights and
  the deal play at their real speed.
- **It builds to the deal.** A set opens with the app's own flight (it's opened once off camera first, so its pictures
  are in and the flight is motion, not loading), the set glides by dearest first, and the climax is one take: the
  missing card flies up close and View offers in Find is tapped (that whole path is run once off camera first, so
  nothing on it is loading). The app then goes back out across the wall and Find's home before the answer opens: that
  second of in-between screens is left out, the two halves joined by a quick slide up. Then the deal lands: a yellow
  spotlight, the page leaning in, a shake, confetti, the stamp (the card's worth less the deal's price, from Find's
  answer; the percentage first when the dollars are small) and the punchline caption.
- **No blank cards on camera.** A few cards have no picture in the catalog at all (in production on November 15: 3 of the 253
  Pikachu cards; the other sets in sets.json are complete), and the app shows those as empty pockets.
  Custom sets are filmed dearest first (their own Filters, In a set by Price, never saved), which puts the best art up
  front, and before each scroll the recorder looks down the set (the probe sees which cards were drawn with no
  picture) and stops the scroll short of any. The card tapped for its deal is always one with a picture. The owner's
  Missing pictures tool in Settings lists the cards to fix.
- **Filming** is the browser's own screencast at 3x (1170x2532 frames), so the screen in the 1080x1920 video is
  downscaled, not blown up. (`VIDEO_DPR=2` films at 2x, a little lighter for the browser.) Playwright's `recordVideo` films at the page's 1x size (390x844), which would have been scaled up about
  2x and looked soft, so it isn't used.
- **Colour.** Converted to video with the BT.709 matrix and tagged so (an untagged BT.601 conversion played the logo's
  red #D1281D back as #DF3719). The fields are the app icon's own: red #D1281D, yellow #F2C300, blue #1E4C9E.
- **Look.** In the brand (BRAND.md): the phone's screen held in a black rule with a hard block shadow, on cream with
  red, yellow and blue fields in the margins, under a black caption band, so the captions never cover the app. Each
  caption slides in with a colour stripe; clips dissolve into each other inside a scene and slide between scenes; the
  deal gets a yellow spotlight and a slow push in; the end card's blocks slide in and "Free" pops. The artwork is
  drawn as HTML in the browser (`lib/art.mjs`, Archivo from cardchaser.app) and put together by ffmpeg
  (`lib/edit.mjs`). The spotlight and push in are film-only decoration on the page, never part of the app.
- **Finished means still.** "Settled" allows a rare card's foil shimmer (under 1.5% of the screen changing), not a
  move or a load.
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
added and a few made-up deals. It's for trying changes to the recorder without the demo account or any write to production (the only requests
that leave the machine are reads: public card pictures and prices, below).

```bash
cd ../../Card-Chaser && npm install && npm run catalog
```

```bash
cd videos && node record.mjs walkthrough --rehearse=/path/to/Card-Chaser
```

Card pictures load from their real public hosts (the same ones the site uses, and the site's own `/img/` copies), and
prices are today's real ones: the app's own price job fetches TCGplayer's prices (through TCGCSV) for its built-in sets,
and the filmed custom set's prices come from production's public card lookup (`/api/public/cards-by-key`, the trade
page's: read-only, no account, paced at about one request a second and kept for a day in
`out/.rehearsal-prices.json`). The deals are made up (a quarter under market), since the made-up account has no real
listings.

