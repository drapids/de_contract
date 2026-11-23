# de_contract

a basement you hang out in. theres a crt in the corner that finds cs2 trade ups that actually make money (scans every contract against steam prices every 5 min, only shows ones where every outcome sells for more than you paid after fees). the rest of the basement is for wasting time.

## the basement

- **wasd** walk, **shift** run, drag the mouse to look, **e** to use stuff, **i** inventory, **b** blyatlingo
- **crt**: the trade up site. "в подвал" in the top bar brings you back down
- **barrel**: arm wrestling. space / click when the arrow is in the green. 2 players on one keyboard = space vs enter
- **card table**: durak (podkidnoy)
- **chess table**: 5 guys from 400 to 2600 elo + a slider. the strong ones use stockfish from a cdn
- **vending machine**: cases (real cs odds, real items, real steam prices), doshirak, kvas
- **chalkboard**: start beef. slaps, boxing or (rubber) knives. tally stays on the board
- **yard** (door by the stairs): hazmats scrap wheel + he buys skins for scrap, the daily airdrop, a chicken, the lada
- at night (9pm-6am) the ghost runs a night market by the vending machine, and if you leave the guy alone he falls asleep on the couch. dont poke him too much
- type **4b2a** and see what happens
- holidays follow the real date (christmas is nov 25 - dec 28)
- rubles + scrap + rank are saved in your browser

## setup

1. push this to github as a **public** repo (public = unlimited free actions minutes)
2. repo settings > pages > source: **github actions**
3. (optional) discord alerts: in your discord channel go to edit channel > integrations > webhooks > new webhook, copy the url. then repo settings > secrets and variables > actions > new secret called `DISCORD_WEBHOOK`
4. actions tab > enable workflows > run "scan" once by hand. after that it runs every 5 min on its own
5. site will be at `https://drapids.github.io/de_contract/`

## the key (defuse screen)

pick a code and add it as a repo secret called `SITE_KEY` (settings > secrets and variables > actions). every scan encrypts the data + the T model with it, so the site is useless without it. you type it into the c4 once per browser.

no `SITE_KEY` secret = no lock screen, everything is public.

## worker (live recheck + inventory + force scan)

steam blocks browsers from calling it directly so the site needs a tiny proxy. free on cloudflare:

```
cd worker
npx wrangler login
npx wrangler deploy
```

then give it its secrets:

```
npx wrangler secret put SITE_KEY      # same code as the github secret
npx wrangler secret put GH_TOKEN      # github token so "force scan" works
```

for `GH_TOKEN`: github > settings > developer settings > fine-grained tokens > new token, only select the de_contract repo, permission **Actions: read and write**.

paste the worker url into settings on the site.

## voice lines

drop mp3s into `assets/voice/` named by when they play (`dubs_1.mp3`, `fail_1.mp3`, `poke_1.mp3`, `defused.mp3`, `wrong_code.mp3`, `terrorists_win.mp3`, `idle_1.mp3`, `shot_1.mp3`...) and list the file names in `assets/voice/index.json` like `["dubs_1.mp3", "fail_1.mp3"]`.

## good to know

- github runs the 5 min schedule when it feels like it, sometimes 10-15 min. the site shows how old the scan is
- steam only lets you pull so many prices at once so the scanner walks through the steam market a chunk at a time
- floats arent in the free price data so it assumes the top of each wear (worst case). real floats are usually better
- fees: steam takes ~13% (5% + 10%)
- when steam doesnt have enough listings for something (knives a lot of the time) it uses skinport sales instead (7 day / 30 day median, then 90 day or the cheapest listing). if nothing has a price it says "no price" and that outcome gets left out of worst case + ev instead of counting as $0
- skinport numbers are after their 8% fee
- not financial advice, the market moves fast

## surf

the pc in the yard has the surf servers. real css/csgo surf maps converted to run in the browser (kitsune, mesa, phantasia, unrequited, demise, surreal, eternity). css movement: 800 gravity, 150 airaccelerate, autobhop. every new stage pays scrap, finishing pays more. pick a skin from your inventory to hold while you surf. v switches first/third person.

surf renders at full res with anti aliasing (the basement stays ps1). it runs as fast as your monitor refreshes, so 180hz = 180 fps. theres an fps counter top left. if its stuck at 60 check windows display settings > advanced display > refresh rate, and make sure chrome is on the nvidia gpu.

## just the trade up site

`solelytradeup/` is the same site without the basement, the guy or any 3d. same data, same key, same settings. its at `https://drapids.github.io/de_contract/solelytradeup/`

## credits

- surf maps belong to their mappers, converted for private use
- "FP arms" by DJMaesen on sketchfab (CC-BY-4.0): https://sketchfab.com/3d-models/fp-arms-06ee1407117d4e5ab343becb4ee44bb6
- animations from mixamo and quaternius
