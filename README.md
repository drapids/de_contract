# de_contract

finds cs2 trade ups that actually make money. scans every possible contract against steam + skinport prices every 5 min, shows the ones where every outcome sells for more than you paid (after fees), plus a calculator, inventory import, a tracker and the hollow.

## setup

1. push this to github as a **public** repo (public = unlimited free actions minutes)
2. repo settings > pages > source: **github actions**
3. (optional) discord alerts: in your discord channel go to edit channel > integrations > webhooks > new webhook, copy the url. then repo settings > secrets and variables > actions > new secret called `DISCORD_WEBHOOK`
4. actions tab > enable workflows > run "scan" once by hand. after that it runs every 5 min on its own
5. site will be at `https://drapids.github.io/de_contract/`

## worker (live recheck + inventory)

steam blocks browsers from calling it directly so the site needs a tiny proxy. free on cloudflare:

```
cd worker
npx wrangler login
npx wrangler deploy
```

paste the url it gives you into settings on the site.

## good to know

- github runs the 5 min schedule when it feels like it, sometimes 10-15 min. the site shows how old the scan is
- steam only lets you pull so many prices at once so the scanner walks through the steam market a chunk at a time. skinport refreshes fully every run
- floats arent in the free price data so it assumes the top of each wear (worst case). real floats are usually better
- fees: steam takes ~13% (5% + 10%), skinport 8%
- not financial advice, the market moves fast
