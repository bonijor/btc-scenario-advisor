import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const HOST = '0.0.0.0';
const PORT = 4173;

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

function safePath(urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0]);
  const requested = clean === '/' ? '/index.html' : clean;
  const target = resolve(ROOT, `.${normalize(requested)}`);
  return target.startsWith(ROOT) ? target : null;
}

createServer(async (req, res) => {
  try {
    const target = safePath(req.url);
    if (!target) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not-file');
    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': TYPES.get(extname(target)) || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}).listen(PORT, HOST, () => {
  console.log(`QA static server listening on http://${HOST}:${PORT}`);
});
