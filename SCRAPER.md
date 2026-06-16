# Lightning Fleet Dashboard — Scraper Instructions

## What This Does
This is a cron job that runs every 12 hours. It scrapes Turo fleet data and competitor pricing, updates `data.json`, commits, and pushes to GitHub Pages.

## Scraping Steps

### 1. Start Browser
```
browser action=start (profile: openclaw — has saved Turo session)
```

### 2. Scrape Fleet Calendar
- Navigate to `https://turo.com/us/en/trips/calendar`
- Extract daily prices for the Tesla Model 3 (PHL46) for the next 2-3 weeks
- Note any booked dates

### 3. Scrape Earnings
- Navigate to `https://turo.com/us/en/business/earnings`
- Extract: total earned, upcoming earnings, reimbursements, incentives, missed earnings

### 4. Scrape Performance
- Navigate to `https://turo.com/us/en/business/performance`
- Extract: cancellation rate, 5-star rate, maintenance rate, cleanliness rate, completed trips

### 5. Scrape Trips
- Navigate to `https://turo.com/us/en/trips/booked`
- Extract all booked trips: guest name, vehicle, dates, location, status

### 6. Scrape Competitor Pricing — Tesla Model 3
- Navigate to `https://turo.com/us/en/search?location=Las%20Vegas%2C%20NV&make=Tesla&model=Model%203`
- Extract all listings: year, rating, trips count, price per day, distance, all-star status

### 7. Scrape Competitor Pricing — Hyundai Santa Fe
- Navigate to `https://turo.com/us/en/search?location=Las%20Vegas%2C%20NV&make=Hyundai&model=Santa%20Fe`
- Extract all listings (if any)

### 8. Update Data
- Write updated JSON to `fleet-dashboard/data.json`
- Preserve the same JSON structure
- Set `lastUpdated` to current ISO timestamp

### 9. Push to GitHub
```bash
cd ~/.openclaw/workspace/fleet-dashboard
git add data.json
git commit -m "Auto-update: $(date -u +%Y-%m-%d-%H:%M) UTC"
git push origin main
```

### 10. Stop Browser
```
browser action=stop
```

## Data Structure
See `fleet-dashboard/data.json` for the exact structure to maintain.

## Important Notes
- The openclaw browser profile has saved Turo login cookies — no re-login needed
- If Turo session expired (redirects to login page), notify Jordyn
- Use `evaluate` JS for fast data extraction instead of snapshot when possible
- Keep scraping quick — don't linger on pages
