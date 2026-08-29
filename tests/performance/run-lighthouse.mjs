import { mkdir, readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

await mkdir('artifacts/lighthouse', { recursive: true });

const outputPath = 'artifacts/lighthouse/report.json';
const url = process.env.LIGHTHOUSE_URL || 'http://127.0.0.1:4173/?qa=performance';

// Cloud/CI shells commonly expose a very small /dev/shm. Chromium can launch
// successfully and then crash the audited tab when Lighthouse starts tracing.
// Keep these flags deterministic and overridable for diagnostics.
const chromeFlags = process.env.LIGHTHOUSE_CHROME_FLAGS || [
  '--headless=new',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
].join(' ');

const args = [
  '--yes',
  'lighthouse@12.6.1',
  url,
  '--quiet',
  '--no-enable-error-reporting',
  '--form-factor=mobile',
  '--only-categories=performance,accessibility,best-practices,seo',
  `--chrome-flags=${chromeFlags}`,
  '--max-wait-for-load=15000',
  '--output=json',
  `--output-path=${outputPath}`,
];

let chromePath = process.env.CHROME_PATH;
if (!chromePath) {
  chromePath = chromium.executablePath();
}

try {
  await access(chromePath);
} catch {
  console.error(`LIGHTHOUSE_CHROME_NOT_FOUND ${chromePath}`);
  console.error('Run: npx playwright install chromium');
  process.exit(2);
}

console.log(`LIGHTHOUSE_CHROME_PATH ${chromePath}`);
console.log(`LIGHTHOUSE_CHROME_FLAGS ${chromeFlags}`);

// Cheap browser preflight. If Chromium itself cannot survive in the shell,
// fail before Lighthouse and make the environmental cause explicit.
const preflight = spawnSync(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--dump-dom',
  'about:blank',
], {
  encoding: 'utf8',
  timeout: 15_000,
  env: process.env,
});

if (preflight.status !== 0) {
  console.error(`LIGHTHOUSE_CHROME_PREFLIGHT_FAILED status=${preflight.status}`);
  if (preflight.stderr) console.error(preflight.stderr.trim());
  process.exit(2);
}
console.log('PASS_LIGHTHOUSE_CHROME_PREFLIGHT');

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  env: { ...process.env, CHROME_PATH: chromePath },
});
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
