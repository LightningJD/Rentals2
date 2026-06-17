# Turo Utilization Scraping — The Golden Technique

## Overview
Real-time calendar utilization data from Turo listing pages. No login, no API key, no extension. Same data RentScout charges for.

## The Technique

### Step 1: Navigate to a listing page
```
https://turo.com/us/en/car-rental/united-states/las-vegas-nv/tesla/model-3/{LISTING_ID}
```

### Step 2: Click the Start Date input
```js
const dateInput = document.querySelector('input[placeholder*="Start date"], input[aria-label*="Start date"]');
dateInput.click();
// Wait 1.5s for calendar to render
```

### Step 3: Count booked vs available days
```js
const cal = document.querySelector('[data-testid="reservationDates-day-picker"]');
const days = cal.querySelectorAll('button, [role="gridcell"]');
let total = 0, booked = 0;
days.forEach(el => {
  const text = el.textContent?.trim();
  if (!text || !text.match(/^\d{1,2}$/)) return; // Only count day numbers
  total++;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') booked++;
});
const utilization = total > 0 ? (booked / total * 100).toFixed(1) : 0;
```

### Step 4: Navigate to next month
```js
document.querySelector('[aria-label*="next" i], [aria-label*="forward" i]').click();
// Wait 1.5s, repeat counting
```

### Step 5: Calculate 90-day average
```
total_booked = booked_month1 + booked_month2 + booked_month3
total_days = total_month1 + total_month2 + total_month3
ninety_day_utilization = total_booked / total_days * 100
```

## Also Extractable from Listing Page

### From escaped JSON in HTML:
- `tripCount` — total trips all time
- `turoGo` — keyless entry
- `automaticTransmission`
- `year`, `make`, `model`, `trim`
- `allStarOwner`

### From JSON-LD (`<script type="application/ld+json">`):
- `offers.price` — daily rate
- `aggregateRating.ratingValue` — rating
- `aggregateRating.reviewCount` — number of reviews

### From visible page text:
- `(N trips)` — trip count
- `All-Star Host` — status badge
- `HostName NNN trips • Joined Mon YYYY` — host info
- `This car isn't available from [date]` — availability check

## Proven Results (June 16, 2026)
- Listing 1631894: June 50% (15/30 booked), July 32.3% (10/31 booked)
- 10 Tesla Model 3 competitors scraped successfully
- Data matches what RentScout displays

## Integration
- Cron job: `39745336-9c4d-4b95-a25b-3daefe417dd0`
- Runs every 6 hours
- Writes `calendarUtilization` object per competitor in `data.json`
- Dashboard renders utilization as the primary metric

## Why This Works
Turo's listing page renders a React-based calendar widget that shows real availability. Booked days are rendered as disabled buttons (`aria-disabled="true"`). This is the same data that populates Turo's own booking system — it's just rendered visually instead of via API. We read the DOM instead of intercepting the API.
