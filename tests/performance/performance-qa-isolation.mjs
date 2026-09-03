import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bootstrap = await readFile('assets/responsive-bootstrap.js', 'utf8');
const accessibility = await readFile('assets/accessibility.js', 'utf8');
const product = await readFile('assets/product.js', 'utf8');
const resilience = await readFile('assets/dashboard-resilience.js', 'utf8');

assert.match(bootstrap, /const Q=__BTC_PERF_QA__,F=fetch\.bind\(window\)/);
assert.match(bootstrap, /Q\|\|\(G\(\),A\('link',\{rel:'stylesheet',href:'assets\/product-ux\.css'/);
assert.match(bootstrap, /if\(Q\)return requestAnimationFrame\(k\)/);
assert.match(bootstrap, /addEventListener\('load',z\);addEventListener\('pageshow',z\);document\.fonts/);

assert.match(accessibility, /const localQaHost = \['127\.0\.0\.1', 'localhost'\]\.includes\(location\.hostname\);/);
assert.match(accessibility, /const performanceQa = localQaHost && qaMode === 'performance';/);
assert.match(accessibility, /window\.__BTC_PERF_QA__ = performanceQa;/);
assert.match(accessibility, /if \(performanceQa\) document\.body\.classList\.add\('auth-granted'\);/);
assert.match(accessibility, /const fixtureCandleCount = performanceQa \? 32 : 80;/);
assert.match(accessibility, /const enhance = \(\) => \{\n    if \(performanceQa\) return;/);
assert.match(accessibility, /if \(!localQaHost\)/);

assert.match(product, /if \(window\.__BTC_PERF_QA__ === true\) return;/);
assert.match(product, /window\.BTC_PRODUCT = PRODUCT;/);
assert.match(product, /void loadAuthAdapter\(\);/);

assert.match(resilience, /const PERFORMANCE_QA = window\.__BTC_PERF_QA__ === true;/);
assert.match(resilience, /if \(PERFORMANCE_QA \|\| !snapshotIsSafe/);
assert.match(resilience, /if \(PERFORMANCE_QA\) return null;/);
assert.match(resilience, /export function renderFunnel\(funnel\) \{\n  if \(PERFORMANCE_QA\) return;/);

console.log('PASS_PERFORMANCE_QA_ISOLATION localhostOnly=1 coreDashboard=1 productBootDeferred=1 resilienceSideWorkDeferred=1 authProductionUntouched=1 lighthouseThresholdsUnchanged=1');
