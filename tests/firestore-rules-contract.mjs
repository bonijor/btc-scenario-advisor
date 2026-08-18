import { readFile } from 'node:fs/promises';

const rules = await readFile('firestore.rules', 'utf8');
const required = [
  "rules_version = '2'",
  'request.auth.uid == userId',
  "match /users/{userId}",
  "match /settings/preferences",
  "match /entitlements/{userId}",
  'allow list: if false',
  'allow create, update, delete: if false',
  'data.minProbability >= 50',
  'data.minProbability <= 99',
  'match /{document=**}',
];

for (const token of required) {
  if (!rules.includes(token)) throw new Error(`Missing Firestore safety contract token: ${token}`);
}

const entitlementBlock = rules.match(/match \/entitlements\/\{userId\} \{([\s\S]*?)\n    \}/)?.[1] || '';
if (!entitlementBlock.includes('allow create, update, delete: if false')) {
  throw new Error('Entitlement client writes are not explicitly denied.');
}

if (/allow\s+(read|write)\s*:\s*if\s+true/.test(rules)) {
  throw new Error('Open Firestore rule detected.');
}

console.log('PASS_FIRESTORE_RULES_STATIC_CONTRACT');
