import { readFile } from 'node:fs/promises';

const REQUIRED_TOP_LEVEL_KEYS = [
  'lastUpdated',
  'host',
  'fleet',
  'earnings',
  'costs',
  'performance',
  'calendar',
  'marketData',
  'actionItems'
];

const errors = [];
const warnings = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

const raw = await readFile(new URL('../data.json', import.meta.url), 'utf8');
const data = JSON.parse(raw);

for (const key of REQUIRED_TOP_LEVEL_KEYS) {
  assert(Object.hasOwn(data, key), `Missing top-level key: ${key}`);
}

assert(Array.isArray(data.fleet), 'fleet must be an array');
assert(data.fleet?.length > 0, 'fleet must include at least one vehicle');

for (const vehicle of data.fleet || []) {
  assert(vehicle.id, 'vehicle missing id');
  assert(vehicle.make, `vehicle ${vehicle.id || '(unknown)'} missing make`);
  assert(vehicle.model, `vehicle ${vehicle.id || '(unknown)'} missing model`);
  assert(isNumber(vehicle.year), `vehicle ${vehicle.id || '(unknown)'} year must be a number`);
  warn(isNumber(vehicle.utilization), `vehicle ${vehicle.id || '(unknown)'} utilization should be numeric`);
}

assert(isNumber(data.earnings?.totalEarned), 'earnings.totalEarned must be a number');
assert(isNumber(data.costs?.turoFeePercent), 'costs.turoFeePercent must be a number');
assert(isNumber(data.costs?.insuranceMonthly), 'costs.insuranceMonthly must be a number');
assert(Array.isArray(data.calendar?.days), 'calendar.days must be an array');

const md = data.marketData || {};
warn(isNumber(md.areaWeekendMedian), 'marketData.areaWeekendMedian should be numeric when available');
warn(isNumber(md.areaWeekdayMedian), 'marketData.areaWeekdayMedian should be numeric when available');
warn(Array.isArray(md.competitors), 'marketData.competitors should be an array');

if (data.liveCompetitors) {
  for (const [segment, payload] of Object.entries(data.liveCompetitors)) {
    warn(Array.isArray(payload.competitors), `liveCompetitors.${segment}.competitors should be an array`);
  }
}

if (warnings.length) {
  console.log('\nWarnings:');
  for (const item of warnings) console.log(`- ${item}`);
}

if (errors.length) {
  console.error('\nValidation failed:');
  for (const item of errors) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Data validation passed.');
