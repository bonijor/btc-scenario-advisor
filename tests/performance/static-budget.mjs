import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const inventory = [
  'index.html',
  'assets/app.js',
  'assets/dashboard-resilience.js',
  'assets/paper-resilience.js',
  'assets/raw-economic-resilience.js',
  'assets/styles.css',
  'assets/responsive-bootstrap.js',
  'assets/accessibility.js',
  'assets/accessibility.css',
  'assets/product.js',
  'assets/firebase-auth.js',
  'assets/firebase-profile.js',
  'assets/product.css',
  'assets/cloud-profile.css',
];

// Legacy raw-source budgets are visibility signals only in V2. They no longer fail CI.
const legacyRawBudgets = new Map([
  ['index.html', 26_000],
  ['assets/app.js', 26_000],
  ['assets/dashboard-resilience.js', 6_000],
  ['assets/paper-resilience.js', 4_000],
  ['assets/raw-economic-resilience.js', 4_000],
  ['assets/styles.css', 20_000],
  ['assets/responsive-bootstrap.js', 1_500],
  ['assets/accessibility.js', 6_000],
  ['assets/accessibility.css', 4_000],
  ['assets/product.js', 36_000],
  ['assets/firebase-auth.js', 7_000],
  ['assets/firebase-profile.js', 8_000],
  ['assets/product.css', 10_000],
  ['assets/cloud-profile.css', 5_000],
]);

const criticalGzipBudget = 50_000;
const allFrontendGzipBudget = 62_000;
const lazyGzipBudgets = new Map([
  ['assets/dashboard-resilience.js', 3_500],
  ['assets/paper-resilience.js', 1_800],
  ['assets/raw-economic-resilience.js', 1_800],
  ['assets/firebase-auth.js', 4_500],
  ['assets/firebase-profile.js', 4_000],
  ['assets/cloud-profile.css', 3_000],
]);
const maxCriticalRequests = 7;

const html = await readFile('index.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)=["'](assets\/[^"']+)["']/g)].map((m) => m[1]);
const criticalRefs = [...new Set(refs)];
const criticalFiles = ['index.html', ...criticalRefs];
const failures = [];
let rawTotal = 0;
let gzipTotal = 0;
let criticalGzip = 0;

const gzipSizes = new Map();
for (const path of inventory) {
  const { size: raw } = await stat(path);
  const data = await readFile(path);
  const gzip = gzipSync(data, { level: 9 }).byteLength;
  rawTotal += raw;
  gzipTotal += gzip;
  gzipSizes.set(path, gzip);
  const legacy = legacyRawBudgets.get(path);
  const rawNote = legacy && raw > legacy ? ` RAW_INFO +${raw - legacy}` : '';
  console.log(`${path}: raw=${raw}${rawNote} gzip=${gzip}`);
}

for (const path of criticalFiles) {
  const gzip = gzipSizes.get(path);
  if (gzip == null) failures.push(`critical asset not inventoried: ${path}`);
  else criticalGzip += gzip;
}

if (criticalRefs.length > maxCriticalRequests) failures.push(`critical local requests ${criticalRefs.length} > ${maxCriticalRequests}`);
if (criticalGzip > criticalGzipBudget) failures.push(`critical gzip payload ${criticalGzip} > ${criticalGzipBudget}`);
if (gzipTotal > allFrontendGzipBudget) failures.push(`all frontend gzip payload ${gzipTotal} > ${allFrontendGzipBudget}`);

for (const [path, max] of lazyGzipBudgets) {
  if (criticalRefs.includes(path)) failures.push(`lazy module became critical: ${path}`);
  const gzip = gzipSizes.get(path);
  if (gzip == null) failures.push(`lazy module not inventoried: ${path}`);
  else if (gzip > max) failures.push(`${path} gzip ${gzip} > ${max}`);
}

console.log(`PERFORMANCE_BUDGET_V2 rawInfo=${rawTotal} criticalGzip=${criticalGzip}/${criticalGzipBudget} totalGzip=${gzipTotal}/${allFrontendGzipBudget} criticalRequests=${criticalRefs.length}/${maxCriticalRequests}`);
console.log('RAW_SOURCE_POLICY=informational; transport payload, lazy boundaries and Lighthouse are blocking gates');

if (failures.length) {
  console.error('PERFORMANCE_BUDGET_V2_FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('PASS_PERFORMANCE_BUDGET_V2');
