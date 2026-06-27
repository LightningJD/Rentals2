# Lightning Fleet Market Intelligence

This repo contains a working static fleet dashboard plus a market-intelligence dashboard for Las Vegas rental/Turo operations.

## Functional pages

- `index.html` — current fleet dashboard.
- `intelligence.html` — pricing, event-demand, profit, alert, and action dashboard.

## Data sources

- `data.json` — fleet, earnings, costs, calendar, market data, competitors, and action items.
- `events.json` — Las Vegas demand events and pricing multipliers.
- `intelligence-report.json` — generated report consumed by `intelligence.html`.

## Run locally

```bash
npm install
npm run validate
npm run analyze
npm run serve
```

Then open:

```txt
http://localhost:5173/index.html
http://localhost:5173/intelligence.html
```

## Automated refresh

The repo includes `.github/workflows/refresh-market-intel.yml`.

When merged to `main`, GitHub Actions can regenerate `intelligence-report.json` every 6 hours:

```txt
0 */6 * * *
```

This refreshes the intelligence report from the current repo data. It does not magically pull private Turo data. Fresh data still needs to come from authorized imports, manual updates, or future connected sources.

## Deployment

The repo includes `.github/workflows/deploy-pages.yml`.

When GitHub Pages is enabled for the repo, pushes to `main` can deploy the static app.

## System direction

```txt
owned fleet data + permitted public market research + Vegas event calendar
→ normalized database
→ pricing/revenue engine
→ dashboard
→ alerts and buy-next-car recommendations
```

## Important boundary

Use authorized, permitted, or manually collected data. Do not bypass Turo protections, private APIs, login controls, rate limits, or terms. The safest sources are your own host data, manual competitor research, public listings viewed like a normal user, and external event calendars.

## Next build phases

1. Merge this PR to `main`.
2. Enable GitHub Actions and GitHub Pages.
3. Keep updating `data.json` and `events.json`.
4. Move data into Supabase/Postgres.
5. Add admin forms for fleet updates.
6. Add scheduled authorized imports.
7. Add Twilio/email alerts.
8. Build the full Next.js app once the data model is stable.
