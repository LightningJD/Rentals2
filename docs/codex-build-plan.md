# Codex Build Plan

Use this plan to continue building the Rentals2 market intelligence system.

## Product intent

Turn the existing static dashboard into a rental fleet intelligence system for Las Vegas. The system should help with:

- pricing decisions
- utilization monitoring
- competitor tracking
- profit/loss clarity
- event-based demand spikes
- buy-next-car decisions
- action alerts

## Guardrails

- Do not bypass Turo protections, login controls, private APIs, rate limits, or anti-bot systems.
- Prefer first-party host data, manual/authorized competitor research, and public event calendars.
- Keep the current static dashboard working while new architecture is added.
- Separate raw data, normalized data, analysis, and presentation.

## Current functional state

- `index.html` is the original fleet dashboard.
- `intelligence.html` is the new market intelligence dashboard.
- `data.json` is the fleet/market source of truth.
- `events.json` stores Las Vegas demand events.
- `intelligence-report.json` is generated and rendered by `intelligence.html`.
- `scripts/validate-data.mjs` validates `data.json`.
- `scripts/pricing-engine.mjs` generates `intelligence-report.json`.
- `scripts/check-app.mjs` smoke-checks the static app.
- `.github/workflows/refresh-market-intel.yml` refreshes every 6 hours after merge to `main`.
- `.github/workflows/deploy-pages.yml` deploys the static dashboard when GitHub Pages is enabled.

## Local commands

```bash
npm run validate
npm run analyze
npm run check
npm run serve
```

## MVP definition of done

- Dashboard still works.
- Data validates.
- Pricing report generates.
- Intelligence dashboard renders report data.
- Event demand affects recommendations.
- Action plan is produced from data, not written only by hand.
- GitHub Actions refreshes the generated report on a 6-hour schedule.
- GitHub Pages deploy workflow exists.

## Remaining for true production

1. Merge PR to `main`.
2. Enable GitHub Actions and GitHub Pages.
3. Add a data source process for authorized/manual competitor updates.
4. Add missing cost categories to `data.json`:
   - car payment
   - charging/fuel
   - maintenance
   - tires
   - registration
   - depreciation reserve
   - cleaning labor
5. Move data into Supabase/Postgres.
6. Add admin forms for vehicles, costs, bookings, events, and competitor entries.
7. Add Twilio/email alerts.
8. Add buy-next-car ranking from acquisition cost, expected utilization, expected rate, and operating costs.
