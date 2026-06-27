# Market Intelligence System Architecture

## Goal

Build a rental-market intelligence system that helps Lighthouse/Lightning Fleet make better decisions on pricing, utilization, fleet expansion, and competitor positioning in Las Vegas.

## Current state

```txt
index.html
  ↓ fetches
data.json
  ↓ renders
static dashboard
```

The current dashboard is useful, but the data is manually maintained and the logic lives mostly inside one browser file.

## Target architecture

```txt
Manual/authorized data sources
  ↓
data collectors and imports
  ↓
Supabase/Postgres
  ↓
pricing + utilization engine
  ↓
AI summary layer
  ↓
web dashboard + alerts
```

## Layers

### Layer 1 — Data source rules

Use allowed and authorized sources only:

- Your own Turo host dashboard data.
- Your own fleet expenses and bookings.
- Manual competitor research.
- Public listing data viewed like a normal user.
- Vegas event calendars and holiday calendars.

Do not build around bypassing login controls, anti-bot protections, rate limits, private APIs, or Turo internal systems.

### Layer 2 — Raw data capture

The first version can keep using `data.json`.

Next version should ingest:

- `fleet`
- `bookings`
- `expenses`
- `competitor_snapshots`
- `availability_snapshots`
- `events`
- `pricing_recommendations`

### Layer 3 — Normalization

Normalize each vehicle into comparable segments:

```txt
Tesla Model 3 / 2018-2021 / EV sedan / Las Vegas / airport capable
Hyundai Santa Fe / 2020-2023 / midsize SUV / Las Vegas / family travel
Cybertruck / 2024-2026 / premium EV truck / Las Vegas / halo vehicle
```

### Layer 4 — Pricing engine

Inputs:

- Current listing price.
- Market median.
- Competitor price range.
- Utilization.
- Day of week.
- Lead time.
- Event demand score.
- Host tier.
- Reviews and trip count.
- Fixed and variable costs.

Outputs:

- Suggested weekday price.
- Suggested weekend price.
- Event price.
- Last-minute discount floor.
- Break-even rate.
- Expected monthly revenue.

### Layer 5 — Dashboard

Current dashboard sections should evolve into:

- Fleet overview.
- Profit/loss.
- Booking calendar.
- Market comparison.
- Live/manual competitor tracker.
- Pricing recommendations.
- Buy-next-car ranking.
- Action items.

### Layer 6 — Alerts

Alerts should trigger when:

- Your price is more than 10% below market.
- Your price is above market while utilization is low.
- A major event is within 30 days.
- Competitor utilization tightens.
- A vehicle is under break-even.
- A listing is incomplete.

### Layer 7 — Migration path

#### Phase 1

Keep static dashboard. Add scripts:

- `npm run validate`
- `npm run analyze`

#### Phase 2

Move JSON into Supabase tables. Keep `index.html` reading from a generated `data.json` file.

#### Phase 3

Replace static HTML with Next.js and server API routes.

#### Phase 4

Add scheduled jobs and alerts.

#### Phase 5

Add AI weekly market briefings and buy-next-car recommendations.
