import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'intelligence.html',
  'data.json',
  'events.json',
  'intelligence-report.json'
];

for (const file of requiredFiles) {
  await access(new URL(`../${file}`, import.meta.url));
}

const report = JSON.parse(await readFile(new URL('../intelligence-report.json', import.meta.url), 'utf8'));
const data = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));
const events = JSON.parse(await readFile(new URL('../events.json', import.meta.url), 'utf8'));

const errors = [];
if (!report.marketAnalysis?.recommendations) errors.push('intelligence-report.json missing marketAnalysis.recommendations');
if (!Array.isArray(report.actionPlan)) errors.push('intelligence-report.json missing actionPlan array');
if (!data.host?.name) errors.push('data.json missing host.name');
if (!Array.isArray(events.events)) errors.push('events.json missing events array');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('App smoke check passed.');
