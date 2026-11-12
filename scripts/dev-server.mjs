// Serves the project for the browser test bench:
// http://127.0.0.1:5173/src/renderer/index.html?mock
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentTypeFor, resolveStaticPath } from '../src/main/static-files.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 5173);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  const filePath = resolveStaticPath(root, pathname === '/' ? '/src/renderer/index.html' : pathname);
  try {
    if (!filePath) throw new Error('forbidden');
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': contentTypeFor(filePath), 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Banc d'essai : http://127.0.0.1:${port}/src/renderer/index.html?mock`);
});
