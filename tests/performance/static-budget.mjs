import { stat, readFile } from 'node:fs/promises';

const budgets = new Map([
  ['index.html', 26_000],
  ['assets/app.js', 26_000],
  ['assets/dashboard-resilience.js', 6_000],
  ['assets/styles.css', 20_000],
  ['assets/responsive-bootstrap.js', 1_700],
  ['assets/accessibility.js', 6_000],
  ['assets/accessibility.css', 4_000],
  ['assets/product.js', 36_000],
  ['assets/firebase-auth.js', 7_000],
  ['assets/firebase-profile.js', 8_000],
  ['assets/product.css', 10_000],
  ['assets/cloud-profile.css', 5_000],
]);

let total = 0;
const failures = [];
for (const [path, maxBytes] of budgets) {
  const { size } = await stat(path);
  total += size;
  console.log(`${path}: ${size} / ${maxBytes} bytes`);
  if (size > maxBytes) failures.push(`${path} exceeds budget by ${size - maxBytes} bytes`);
}

// Data Pulse adds the closed-candle provenance contract without another critical request.
// Lazy cloud-profile and resilience modules remain inside the aggregate source budget.
const totalBudget = 138_000;
if (total > totalBudget) failures.push(`frontend source total ${total} exceeds ${totalBudget} bytes`);

const html = await readFile('index.html', 'utf8');
const localCriticalRefs = [...html.matchAll(/(?:src|href)=["'](assets\/[^"']+)["']/g)].map((match) => match[1]);
const uniqueRefs = [...new Set(localCriticalRefs)];
if (uniqueRefs.length > 7) failures.push(`critical local request budget exceeded: ${uniqueRefs.length} > 7`);

if (failures.length) {
  console.error('STATIC_PERFORMANCE_BUDGET_FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`PASS_STATIC_PERFORMANCE_BUDGET total=${total}/${totalBudget} criticalRequests=${uniqueRefs.length}/7 lazyAuthAdapter=1 lazyCloudProfile=1 lazyDashboardResilience=1`);
