# Lightning Fleet Dashboard — Scraper & Data Documentation

## System Architecture
- **Dashboard:** Static HTML/CSS/JS at `fleet-dashboard/index.html`
- **Data:** JSON at `fleet-dashboard/data.json` (fetched by dashboard on load)
- **Hosting:** GitHub Pages at `lightningjd.github.io/fleet-dashboard` (public repo)
- **Automation:** Cron job every 12h (isolated session, GLM-5.2 with MiMo + GLM-5.1 fallbacks)

## Cron Job Details
- **ID:** `39745336-9c4d-4b95-a25b-3daefe417dd0`
- **Schedule:** Every 12 hours
- **Session:** Isolated (separate from main Jarvis session)

## Data Pipeline (5 steps, validated)

### Step 1: Scrape
| Data | Source | Method |
|---|---|---|
| Calendar prices | /trips/calendar | JS evaluate on price buttons |
| Market data + competitors | /trips/calendar → Insights | Click Insights, parse sample cars |
| Earnings | /business/earnings | Page text extraction |
| Performance | /business/performance | Page text extraction |
| Trips | /trips/booked | Page text extraction |
| Vehicle status | /listings | Page text extraction |
| Santa Fe competitors | Turo search | Count results |

### Step 2: Calculate Derived Values
- `yourCalendarWeekendAvg` = average of Sat/Sun prices
- `yourCalendarWeekdayAvg` = average of Mon-Fri prices
- `calendar.averagePrice` = average of all daily prices

### Step 3: Validate (STOP if any fail)
- ✅ Competitors array has 3+ entries
- ✅ Earnings totalEarned > 0
- ✅ Completed trips >= previous history value
- ✅ Calendar has 7+ days
- ✅ Turo didn't redirect to login

### Step 4: Write data.json
**PRESERVE (never modify):**
- `costs` object — hardcoded financial constants
- `actionItems` array — manually curated
- `actionItemsNote` — manual label
- `marketDataCaveats` — static disclaimers
- `history` existing entries (dedup by date — update if same day)
- `competitorHistory` — append new entry each run (no dedup)

**UPDATE (from scrape):**
- `lastUpdated`, `host`, `fleet`, `earnings`, `performance`, `calendar`, `trips`, `marketData`, `santaFeMarket`

### Step 5: Push with Verification
1. Write data.json
2. Read back to verify valid JSON
3. Git commit + push
4. If push fails → wait 10s → retry
5. If still fails → notify Jordyn

## Data Freshness & Limitations

### Turo Insights (competitor data)
- **Lag:** ~1 month behind (shows previous month's booked data)
- **Type:** Booked prices (what guests paid), NOT current listing prices
- **Scope:** Same exact model, within 10mi radius of your vehicle

### What This Dashboard Cannot Track
- Current competitor listing prices (only historical booked)
- Photo quality of competitor listings
- Delivery options / Turo Go keyless entry
- Trip duration patterns (1-day vs weekly)
- New market entrants between scrapes
- Real-time depreciation

### Price Comparison Caveat
Your calendar prices (what you're ASKING) are compared against area booked prices (what people PAID last month). This is directional guidance, not exact competitive positioning.

## Utilization Labels (estimated, not from Turo)
| Label | Estimated Range | Booked Days/Month |
|---|---|---|
| Low | <30% | Less than 9 |
| Medium | 30-50% | 9-15 |
| High | 50%+ | 15+ |

Turo does not publish exact thresholds. These ranges are based on industry research and align with observed data points.

## Turo Session Management
- Login cookies persist at `~/.openclaw/browser/openclaw/user-data`
- If session expires, cron will detect login redirect and notify Jordyn
- Re-login: start browser → navigate to turo.com/login → Jordyn logs in manually
- Session typically lasts 30-90 days

## Manual Maintenance Required
| Item | Frequency | How |
|---|---|---|
| Action items | As needed | Edit data.json or tell Jarvis |
| Costs (insurance, cleaning, fees) | When they change | Edit costs object in data.json |
| Turo login | Every 30-90 days | Log in via openclaw browser when notified |
