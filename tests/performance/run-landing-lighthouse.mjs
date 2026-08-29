process.env.LIGHTHOUSE_URL ||= 'http://127.0.0.1:4173/landing-v2.html';
await import('./run-lighthouse.mjs');
