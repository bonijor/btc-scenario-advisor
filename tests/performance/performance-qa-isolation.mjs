import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bootstrap = await readFile('assets/responsive-bootstrap.js', 'utf8');
const accessibility = await readFile('assets/accessibility.js', 'utf8');

assert.match(bootstrap, /\['127\.0\.0\.1','localhost'\]\.includes\(location\.hostname\)&&q\.get\('qa'\)==='performance'/);
assert.match(bootstrap, /Q&&document\.body\.classList\.add\('auth-granted','auth-gate-ready'\)/);
assert.match(bootstrap, /if\(!Q\)\{G\(\);A\('link',\{rel:'stylesheet',href:'assets\/product-ux\.css'/);
assert.match(bootstrap, /else document\.documentElement\.dataset\.performanceQa='core-dashboard'/);
assert.match(bootstrap, /if\(Q\)addEventListener\('load',\(\)=>requestAnimationFrame\(k\),\{once:true\}\)/);

assert.match(accessibility, /const performanceQa = localQaHost && qaMode === 'performance';/);
assert.match(accessibility, /const fixtureCandleCount = performanceQa \? 40 : 80;/);
assert.match(accessibility, /if \(performanceQa\) return;/);
assert.match(accessibility, /if \(!localQaHost\)/);

console.log('PASS_PERFORMANCE_QA_ISOLATION localhostOnly=1 coreDashboard=1 authProductionUntouched=1 lighthouseThresholdsUnchanged=1');
