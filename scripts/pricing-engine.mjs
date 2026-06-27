import { readFile, writeFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
let eventsData = { events: [] };
try {
  eventsData = JSON.parse(await readFile(new URL('../events.json', import.meta.url), 'utf8'));
} catch {
  eventsData = { events: [] };
}

const now = new Date();
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: data.earnings?.currency || 'USD',
  maximumFractionDigits: 0
});

function pctGap(current, market) {
  if (!Number.isFinite(current) || !Number.isFinite(market) || market <= 0) return null;
  return Math.round(((market - current) / market) * 100);
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const middle = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[middle] : (nums[middle - 1] + nums[middle]) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function daysUntil(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getRelevantEvents() {
  return (eventsData.events || [])
    .map(event => ({ ...event, daysUntil: daysUntil(event.startsOn) }))
    .filter(event => event.daysUntil >= -3 && event.daysUntil <= 45)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

function getActiveEventMultiplier() {
  const upcoming = getRelevantEvents();
  const hot = upcoming.find(event => event.daysUntil >= 0 && event.daysUntil <= 14 && event.demandScore >= 8);
  return hot ? hot.recommendedMultiplier || 1 : 1;
}

function recommendPrice({ current, marketMedian, utilization, eventMultiplier = 1 }) {
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(marketMedian) || marketMedian <= 0) {
    return null;
  }

  let target = current;

  if (utilization < 25) {
    target = marketMedian * 0.95;
  } else if (utilization >= 25 && utilization < 50) {
    target = marketMedian;
  } else if (utilization >= 50) {
    target = marketMedian * 1.08;
  }

  target *= eventMultiplier;
  return Math.round(clamp(target, current * 0.85, current * 1.5));
}

function analyzeMarketData() {
  const md = data.marketData || {};
  const competitors = md.competitors || [];
  const eventMultiplier = getActiveEventMultiplier();

  const competitorWeekendMedian = median(competitors.map(c => c.weekendPrice));
  const competitorWeekdayMedian = median(competitors.map(c => c.weekdayPrice));

  const weekendMarket = Number.isFinite(md.areaWeekendMedian) ? md.areaWeekendMedian : competitorWeekendMedian;
  const weekdayMarket = Number.isFinite(md.areaWeekdayMedian) ? md.areaWeekdayMedian : competitorWeekdayMedian;

  const currentWeekend = md.yourCalendarWeekendAvg || md.yourMedianPrice;
  const currentWeekday = md.yourCalendarWeekdayAvg || md.yourMedianPrice;
  const utilization = md.yourUtilization ?? data.fleet?.[0]?.utilization ?? 0;

  const weekendGap = pctGap(currentWeekend, weekendMarket);
  const weekdayGap = pctGap(currentWeekday, weekdayMarket);

  const suggestedWeekend = recommendPrice({ current: currentWeekend, marketMedian: weekendMarket, utilization, eventMultiplier });
  const suggestedWeekday = recommendPrice({ current: currentWeekday, marketMedian: weekdayMarket, utilization, eventMultiplier: eventMultiplier > 1 ? Math.min(eventMultiplier, 1.25) : 1 });

  return {
    segment: 'Tesla Model 3 Las Vegas',
    sampleMonth: md.sampleMonth,
    sampleSize: md.sampleSize,
    caveat: md.dataLagWarning || 'Market numbers may lag or be manually maintained.',
    eventMultiplier,
    current: {
      weekday: currentWeekday,
      weekend: currentWeekend,
      utilization
    },
    market: {
      weekdayMedian: weekdayMarket,
      weekendMedian: weekendMarket,
      competitorWeekdayMedian,
      competitorWeekendMedian
    },
    gaps: {
      weekdayGapPercent: weekdayGap,
      weekendGapPercent: weekendGap
    },
    recommendations: {
      suggestedWeekday,
      suggestedWeekend,
      summary: buildPricingSummary({ weekdayGap, weekendGap, suggestedWeekday, suggestedWeekend, currentWeekday, currentWeekend, eventMultiplier })
    }
  };
}

function buildPricingSummary({ weekdayGap, weekendGap, suggestedWeekday, suggestedWeekend, currentWeekday, currentWeekend, eventMultiplier }) {
  const notes = [];
  if (eventMultiplier > 1) {
    notes.push(`Upcoming demand event detected. Pricing multiplier applied: ${eventMultiplier}x.`);
  }

  if (weekdayGap !== null && weekdayGap > 5) {
    notes.push(`Weekday listing price is about ${weekdayGap}% below market; test ${currency.format(suggestedWeekday)}.`);
  } else if (weekdayGap !== null && weekdayGap < -5) {
    notes.push('Weekday listing price is above market; hold only if bookings stay strong.');
  } else {
    notes.push('Weekday listing price is close to market.');
  }

  if (weekendGap !== null && weekendGap > 5) {
    notes.push(`Weekend listing price is about ${weekendGap}% below market; test ${currency.format(suggestedWeekend)}.`);
  } else if (weekendGap !== null && weekendGap < -5) {
    notes.push('Weekend listing price is above market; watch conversion and lead time.');
  } else {
    notes.push('Weekend listing price is close to market.');
  }

  if (suggestedWeekday && suggestedWeekend && (suggestedWeekday !== currentWeekday || suggestedWeekend !== currentWeekend)) {
    notes.push(`Recommended test range: ${currency.format(suggestedWeekday)} weekdays and ${currency.format(suggestedWeekend)} weekends.`);
  }

  return notes;
}

function analyzeLiveCompetitors() {
  const live = data.liveCompetitors || {};
  return Object.entries(live).map(([segment, payload]) => {
    const competitors = payload.competitors || [];
    const currentPrices = competitors.map(c => c.currentPrice).filter(Number.isFinite);
    const currentUtils = competitors
      .map(c => c.calendarUtilization?.currentMonth?.utilization)
      .filter(Number.isFinite);

    return {
      segment,
      lastScraped: payload.lastScraped,
      competitorCount: competitors.length,
      medianCurrentPrice: median(currentPrices),
      averageCurrentUtilization: currentUtils.length
        ? Math.round((currentUtils.reduce((a, b) => a + b, 0) / currentUtils.length) * 10) / 10
        : null,
      topObservedCompetitors: competitors
        .slice()
        .sort((a, b) => (b.calendarUtilization?.currentMonth?.utilization || 0) - (a.calendarUtilization?.currentMonth?.utilization || 0))
        .slice(0, 5)
        .map(c => ({
          year: c.year,
          trim: c.trim,
          currentPrice: c.currentPrice,
          tripCount: c.tripCount,
          rating: c.rating,
          hostName: c.hostName,
          currentMonthUtilization: c.calendarUtilization?.currentMonth?.utilization ?? null
        }))
    };
  });
}

function analyzeFleetProfit() {
  const gross = data.earnings?.totalEarned || 0;
  const turoFees = gross * ((data.costs?.turoFeePercent || 0) / 100);
  const insuranceMonthly = data.costs?.insuranceMonthly || 0;
  const cleaningMonthlyPerCar = data.costs?.cleaningMonthlyPerCar || 0;
  const vehiclesCovered = data.costs?.vehiclesCovered || data.fleet?.length || 1;
  const policyStart = data.costs?.policyStart ? new Date(data.costs.policyStart) : new Date(data.lastUpdated);
  const updated = new Date(data.lastUpdated);
  const monthsElapsed = Math.max(1, Math.round((updated - policyStart) / (1000 * 60 * 60 * 24 * 30)));
  const overhead = insuranceMonthly * monthsElapsed + cleaningMonthlyPerCar * vehiclesCovered * monthsElapsed;
  const netProfit = gross - turoFees - overhead;

  return {
    gross,
    turoFees: Math.round(turoFees * 100) / 100,
    overhead: Math.round(overhead * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    note: 'This excludes car payments, depreciation, charging/fuel, repairs, tires, registration, tolls, tickets, and taxes unless added to data.json.'
  };
}

function analyzeEvents() {
  const upcoming = getRelevantEvents();
  return {
    market: eventsData.market || 'Las Vegas, NV',
    next45Days: upcoming,
    highestDemandEvent: upcoming.slice().sort((a, b) => (b.demandScore || 0) - (a.demandScore || 0))[0] || null
  };
}

function buildActionPlan(marketAnalysis, liveAnalysis, profitAnalysis, eventAnalysis) {
  const actions = [];
  const rec = marketAnalysis.recommendations;

  if (rec.suggestedWeekend && rec.suggestedWeekend > marketAnalysis.current.weekend) {
    actions.push({
      priority: 'high',
      action: `Raise/test weekend Tesla Model 3 price to ${currency.format(rec.suggestedWeekend)} for the next 2 weekends.`,
      reason: `Current weekend price ${currency.format(marketAnalysis.current.weekend)} vs market median ${currency.format(marketAnalysis.market.weekendMedian)}.`
    });
  }

  if (rec.suggestedWeekday && rec.suggestedWeekday > marketAnalysis.current.weekday) {
    actions.push({
      priority: 'medium',
      action: `Test weekday Tesla Model 3 price at ${currency.format(rec.suggestedWeekday)}.`,
      reason: `Current weekday price ${currency.format(marketAnalysis.current.weekday)} vs market median ${currency.format(marketAnalysis.market.weekdayMedian)}.`
    });
  }

  for (const event of eventAnalysis.next45Days || []) {
    if (event.daysUntil >= 0 && event.daysUntil <= 30 && event.demandScore >= 8) {
      actions.push({
        priority: 'high',
        action: `Prepare event pricing for ${event.name}.`,
        reason: `${event.name} starts in ${event.daysUntil} day(s), demand score ${event.demandScore}/10, suggested multiplier ${event.recommendedMultiplier}x.`
      });
    }
  }

  const incompleteVehicles = (data.fleet || []).filter(v => !v.listingComplete);
  for (const vehicle of incompleteVehicles) {
    actions.push({
      priority: 'high',
      action: `Finish ${vehicle.year} ${vehicle.make} ${vehicle.model} listing.`,
      reason: vehicle.details || 'Incomplete listings cannot produce revenue.'
    });
  }

  if (profitAnalysis.netProfit < 0) {
    actions.push({
      priority: 'high',
      action: 'Add missing fixed costs and verify break-even pricing before scaling fleet.',
      reason: 'Current tracked profit is negative or incomplete.'
    });
  }

  return actions;
}

function buildAlerts(actionPlan) {
  return actionPlan.map((item, index) => ({
    id: `alert-${index + 1}`,
    priority: item.priority,
    title: item.action,
    body: item.reason,
    status: 'open',
    generatedAt: now.toISOString()
  }));
}

const marketAnalysis = analyzeMarketData();
const liveAnalysis = analyzeLiveCompetitors();
const profitAnalysis = analyzeFleetProfit();
const eventAnalysis = analyzeEvents();
const actionPlan = buildActionPlan(marketAnalysis, liveAnalysis, profitAnalysis, eventAnalysis);
const alerts = buildAlerts(actionPlan);

const report = {
  generatedAt: now.toISOString(),
  sourceLastUpdated: data.lastUpdated,
  marketAnalysis,
  liveAnalysis,
  profitAnalysis,
  eventAnalysis,
  actionPlan,
  alerts,
  dashboardStatus: {
    refreshCadence: 'Every 6 hours via GitHub Actions when workflow is enabled',
    dataFreshness: 'data.json and events.json are the current source of truth until live/authorized integrations are added',
    nextUpgrade: 'Connect Supabase and authorized data imports'
  },
  nextDataToCollect: [
    'Actual booked daily rates by trip',
    'Lead time from booking date to trip start',
    'Cancellation/no-show history',
    'Delivery option and delivery fee per competitor',
    'Photo quality score per competitor',
    'Vegas event calendar with demand score',
    'Car payment, depreciation, charging/fuel, maintenance, tires, registration, and cleaning labor'
  ]
};

await writeFile(new URL('../intelligence-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

console.log('Market intelligence report generated: intelligence-report.json');
console.log(`Suggested weekday: ${currency.format(marketAnalysis.recommendations.suggestedWeekday || 0)}`);
console.log(`Suggested weekend: ${currency.format(marketAnalysis.recommendations.suggestedWeekend || 0)}`);
for (const item of actionPlan) {
  console.log(`- [${item.priority}] ${item.action}`);
}
