import { mkdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await mkdir('artifacts/lighthouse', { recursive: true });

const outputPath = 'artifacts/lighthouse/report.json';
const url = process.env.LIGHTHOUSE_URL || 'http://127.0.0.1:4173/?qa=lighthouse';
const args = [
  '--yes',
  'lighthouse@12.6.1',
  url,
  '--quiet',
  '--form-factor=mobile',
  '--only-categories=performance,accessibility,best-practices,seo',
  '--chrome-flags=--headless --no-sandbox --disable-gpu',
  '--max-wait-for-load=15000',
  '--output=json',
  `--output-path=${outputPath}`,
];

const result = spawnSync('npx', args, { stdio: 'inherit', env: process.env });
if (result.status !== 0) process.exit(result.status || 1);

const report = JSON.parse(await readFile(outputPath, 'utf8'));
const categories = report.categories || {};
const audits = report.audits || {};

const scores = {
  performance: categories.performance?.score ?? 0,
  accessibility: categories.accessibility?.score ?? 0,
  bestPractices: categories['best-practices']?.score ?? 0,
  seo: categories.seo?.score ?? 0,
};

const metrics = {
  fcp: audits['first-contentful-paint']?.numericValue ?? Number.POSITIVE_INFINITY,
  lcp: audits['largest-contentful-paint']?.numericValue ?? Number.POSITIVE_INFINITY,
  cls: audits['cumulative-layout-shift']?.numericValue ?? Number.POSITIVE_INFINITY,
  tbt: audits['total-blocking-time']?.numericValue ?? Number.POSITIVE_INFINITY,
  speedIndex: audits['speed-index']?.numericValue ?? Number.POSITIVE_INFINITY,
};

const failures = [];
const requireScore = (name, value, min) => {
  if (value < min) failures.push(`${name} score ${value.toFixed(2)} < ${min.toFixed(2)}`);
};
const requireMetric = (name, value, max, unit = 'ms') => {
  if (value > max) failures.push(`${name} ${value.toFixed(1)}${unit} > ${max}${unit}`);
};

requireScore('performance', scores.performance, 0.90);
requireScore('accessibility', scores.accessibility, 0.95);
requireScore('best-practices', scores.bestPractices, 0.95);
requireScore('seo', scores.seo, 0.90);
requireMetric('FCP', metrics.fcp, 2500);
requireMetric('LCP', metrics.lcp, 3000);
requireMetric('CLS', metrics.cls, 0.10, '');
requireMetric('TBT', metrics.tbt, 250);
requireMetric('Speed Index', metrics.speedIndex, 3500);

console.log('LIGHTHOUSE_SCORES', JSON.stringify(scores));
console.log('LIGHTHOUSE_METRICS', JSON.stringify(metrics));

if (failures.length) {
  console.error('LIGHTHOUSE_GATE_FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS_LIGHTHOUSE_GATE');
