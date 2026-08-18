import { stat, readFile } from 'node:fs/promises';

const budgets = new Map([
  ['index.html', 17_000],
  ['assets/app.js', 24_000],
  ['assets/styles.css', 20_000],
  ['assets/responsive-bootstrap.js', 1_500],
  ['assets/accessibility.js', 6_000],
  ['assets/accessibility.css', 4_000],
]);

let total = 0;
const failures = [];
for (const [path, maxBytes] of budgets) {
  const { size } = await stat(path);
  total += size;
  console.log(`${path}: ${size} / ${maxBytes} bytes`);
  if (size > maxBytes) failures.push(`${path} exceeds budget by ${size - maxBytes} bytes`);
}

const totalBudget = 70_000;
if (total > totalBudget) failures.push(`critical frontend total ${total} exceeds ${totalBudget} bytes`);

const html = await readFile('index.html', 'utf8');
const localCriticalRefs = [...html.matchAll(/(?:src|href)=["'](assets\/[^"']+)["']/g)].map((match) => match[1]);
const uniqueRefs = [...new Set(localCriticalRefs)];
if (uniqueRefs.length > 5) failures.push(`critical local request budget exceeded: ${uniqueRefs.length} > 5`);

if (failures.length) {
  console.error('STATIC_PERFORMANCE_BUDGET_FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`PASS_STATIC_PERFORMANCE_BUDGET total=${total}/${totalBudget} criticalRequests=${uniqueRefs.length}/5`);
