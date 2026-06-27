# Fleet Intelligence Product Vision

## North Star

This app is not just a Turo dashboard. The goal is to become an AI operating system for a rental fleet business.

Turo is one data source. The real product is the decision engine that helps the operator know what to charge, what to buy, where demand is moving, which competitors are winning, and what actions will make the most money today.

## Five questions the finished app must answer every morning

1. What should I charge today?
2. What vehicle should I buy next?
3. Where is demand increasing or falling?
4. Which competitors are outperforming me, and why?
5. What actions will make me the most money today?

## Product standard

The app should eventually answer questions like:

- If I had $35,000 today, which vehicle gives me the highest expected ROI in Las Vegas?
- What is the probability this vehicle maintains at least 70% utilization over the next six months?
- If I lower my Tesla by $5/day, how much additional utilization do I need to break even?
- Which competitors changed prices in the last 24 hours?
- Which vehicle categories are becoming oversupplied?
- What should my fleet look like at 5 cars, 20 cars, and 100 cars?

## Strategic shift

Dashboards are useful, but the long-term value is recommendations.

The app should not only show charts. It should eventually say things like:

> Buy a 2023 Toyota Sienna next. Based on your current fleet, expected demand, market competition, and risk-adjusted return, it has the highest projected ROI. Wait two weeks before buying another Model 3 because supply is increasing.

## Core engines

### 1. Market Observation Engine

Continuously gathers permitted market observations from owned data, manually verified public market research, authorized imports, and future approved integrations.

It should track:

- listings
- vehicle make/model/year/trim
- host information
- price
- delivery options
- airport delivery
- rating and reviews
- trip count
- listing status
- observed timestamp

### 2. Calendar Intelligence Engine

Tracks visible public calendar availability over time where allowed and estimates competitor booking pressure.

It should calculate:

- available days next 30/60/90
- unavailable days next 30/60/90
- unknown days
- estimated utilization
- confidence score
- booking pressure score

Important: no login automation, no private APIs, no bypassing protections, and no fake confidence.

### 3. Pricing Intelligence Engine

Recommends prices using:

- current listing price
- market median
- competitor pricing
- inferred utilization
- event demand
- seasonality
- lead time
- host rating/reviews
- fixed and variable costs
- break-even rate

Outputs:

- weekday price
- weekend price
- event price
- last-minute floor
- confidence
- reason

### 4. Demand Forecasting Engine

Predicts demand before it happens.

Inputs:

- historical utilization
- price movement
- events
- holidays
- seasonality
- competitor supply
- booking lead time

Outputs:

- demand score
- expected occupancy
- recommended pricing posture
- risk flags

### 5. Fleet Acquisition Engine

Ranks vehicles to buy next based on expected business return.

Inputs:

- acquisition cost
- car payment
- insurance
- maintenance risk
- depreciation
- market price
- inferred utilization
- competition level
- shortage/oversupply signal

Outputs:

- expected monthly revenue
- expected net profit
- expected ROI
- payback period
- utilization forecast
- risk-adjusted score
- buy / wait / avoid recommendation

### 6. Competitor Intelligence Engine

Tracks competitor behavior over time.

It should detect:

- price changes
- listing changes
- new listings
- removed listings
- high-performing hosts
- low-performing hosts
- review/trip velocity
- utilization patterns

### 7. Geographic Intelligence Engine

Does not treat Las Vegas as one generic market.

Future segments should include:

- LAS airport
- Strip
- Downtown
- Henderson
- Summerlin
- North Las Vegas
- delivery radius zones

### 8. Operations Intelligence Engine

Turns intelligence into action.

Examples:

- raise price
- lower price
- finish listing
- update photos
- add delivery
- avoid buying another saturated model
- prepare event pricing
- schedule maintenance before a demand window

### 9. Executive AI

Generates a daily briefing in plain English.

Example:

> 5 listings disappeared. 3 Cybertrucks appear booked next weekend. Average SUV utilization rose 11%. Raise the Santa Fe for July 4 weekend. Do not buy another Model 3 right now; supply is increasing. Best shortage signal: minivans and family SUVs.

## Definition of a real competitive advantage

The app is not truly finished until it can reliably answer:

- What should I buy next?
- What should I charge today?
- Which vehicles are underrepresented in my city?
- Where is demand increasing?
- Which competitors are winning and why?
- What action should I take today?

## Current state

The current repo has a useful foundation:

- static fleet dashboard
- intelligence dashboard
- event-aware report generation
- validated market snapshot import
- scheduled refresh workflow
- market snapshot status page

But the current app is not yet the full market intelligence platform. The main missing layer is high-quality recurring market observations and calendar utilization inference stored over time.

## Guardrails

- Use owned data, manually verified public market research, authorized imports, or future approved integrations.
- Do not bypass Turo protections, private APIs, login-only pages, anti-bot systems, or terms.
- If market data is missing, stale, blocked, or uncertain, mark it as low confidence or unknown.
- Never generate fake confidence.
- Store observations historically instead of overwriting them.
