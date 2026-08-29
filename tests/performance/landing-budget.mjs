import { stat, readFile } from 'node:fs/promises';

const budgets = new Map([
  ['landing-v2.html', 12_000],
  ['assets/landing-v2.css', 12_000],
]);

let total = 0;
const failures = [];
for (const [path, maxBytes] of budgets) {
  const { size } = await stat(path);
  total += size;
  console.log(`${path}: ${size} / ${maxBytes} bytes`);
  if (size > maxBytes) failures.push(`${path} exceeds budget by ${size - maxBytes} bytes`);
}

const totalBudget = 24_000;
if (total > totalBudget) failures.push(`landing source total ${total} exceeds ${totalBudget} bytes`);

const html = await readFile('landing-v2.html', 'utf8');
const localCriticalRefs = [...html.matchAll(/(?:src|href)=["'](assets\/[^"']+)["']/g)].map((match) => match[1]);
const uniqueRefs = [...new Set(localCriticalRefs)];
if (uniqueRefs.length > 2) failures.push(`landing critical local request budget exceeded: ${uniqueRefs.length} > 2`);

if (failures.length) {
  console.error('LANDING_STATIC_PERFORMANCE_BUDGET_FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`PASS_LANDING_STATIC_PERFORMANCE_BUDGET total=${total}/${totalBudget} criticalRequests=${uniqueRefs.length}/2`);
